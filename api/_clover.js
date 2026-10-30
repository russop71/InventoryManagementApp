import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { cloverDatabase as database, requireCloverAccess, revalidateCloverAccess } from './v1/[...path].js';
import { cloverCallbackUrl, cloverConfiguration, requireCloverConfiguration, sealTokens, openTokens } from './_clover-config.js';
import { calendarDay, zonedMidnight, cloverList, cloverRequest, summarizeCloverOrders, validatedTokenPair } from './_clover-client.js';
import { enforceRateLimit } from './_request-guard.js';

const id = value => encodeURIComponent(String(value));
const hash = value => createHash('sha256').update(String(value)).digest('hex');
const cookieName = '__Host-zestiq-clover';
const cookie = (value, age = 600) => `${cookieName}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
export const tokenContext = row => `${row.account_id}:${row.location_id}:${row.merchant_id}`;
const connectionPath = locationId => `clover_connections?location_id=eq.${id(locationId)}`;
const safeFailure = error => error?.code?.startsWith('CLOVER_') ? error.message : 'Clover could not complete the operation. Please try again or contact ZestIQ support.';

async function withLease(row, work) {
  const leaseId = randomUUID();
  const claimed = await database(`${connectionPath(row.location_id)}&status=eq.connected&or=(lease_until.is.null,lease_until.lt.${id(new Date().toISOString())})`, {
    method: 'PATCH', prefer: 'return=representation', body: { lease_id: leaseId, lease_until: new Date(Date.now() + 240_000).toISOString() },
  });
  if (!claimed?.length) throw Object.assign(new Error('Clover is already syncing. Please try again shortly.'), { status: 409, code: 'CLOVER_SYNC_BUSY' });
  const current = claimed[0];
  try { return await work(current, leaseId); }
  catch (error) {
    await database(`${connectionPath(row.location_id)}&lease_id=eq.${leaseId}`, {
      method: 'PATCH', prefer: 'return=minimal', body: { lease_id: null, lease_until: null, last_error: safeFailure(error), ...(error.code === 'CLOVER_RECONNECT_REQUIRED' ? { status: 'reconnect_required' } : {}) },
    }).catch(() => {});
    throw error;
  }
}

export async function syncClover(row, { deadline = Date.now() + 180_000 } = {}) {
  try { await revalidateCloverAccess(row.connected_by, row.account_id, row.location_id); }
  catch (error) {
    if ([402, 403, 404].includes(error.status)) {
      await database(connectionPath(row.location_id), { method: 'PATCH', prefer: 'return=minimal', body: { last_error: 'Clover sync paused because company or location access changed. An authorized manager should review the connection.', ...([403, 404].includes(error.status) ? { status: 'reconnect_required' } : {}) } }).catch(() => {});
    }
    throw error;
  }
  return withLease(row, async (connection, leaseId) => {
    const { location } = await revalidateCloverAccess(connection.connected_by, connection.account_id, connection.location_id);
    let tokens = openTokens(connection.encrypted_tokens, tokenContext(connection));
    if (tokens.access_token_expiration * 1000 < Date.now() + 60_000) {
      if (tokens.refresh_token_expiration * 1000 <= Date.now()) throw Object.assign(new Error('Reconnect Clover to renew access.'), { status: 409, code: 'CLOVER_RECONNECT_REQUIRED' });
      tokens = validatedTokenPair(await cloverRequest('/oauth/v2/refresh', { body: { client_id: process.env.CLOVER_CLIENT_ID, refresh_token: tokens.refresh_token } }));
      // Refresh tokens rotate once. Persist the new pair before any sales request.
      const saved = await database(`${connectionPath(connection.location_id)}&lease_id=eq.${leaseId}`, { method: 'PATCH', prefer: 'return=representation', body: { encrypted_tokens: sealTokens(tokens, tokenContext(connection)) } });
      if (!saved?.length) throw Object.assign(new Error('Clover connection changed. Please retry.'), { status: 409, code: 'CLOVER_CONNECTION_CHANGED' });
    }
    const signal = AbortSignal.timeout(Math.max(1, Math.min(180_000, deadline - Date.now())));
    const prefix = `/v3/merchants/${id(connection.merchant_id)}`;
    const today = calendarDay(Date.now(), location.timezone || 'America/Toronto');
    const since = new Date(`${today}T12:00:00Z`); since.setUTCDate(since.getUTCDate() - 7);
    const fromDay = calendarDay(since, 'UTC');
    // Calendar-day boundaries are resolved in the restaurant timezone, including DST.
    const query = new URLSearchParams();
    query.append('filter', `createdTime>=${zonedMidnight(fromDay, location.timezone || 'America/Toronto')}`);
    query.append('filter', `createdTime<${zonedMidnight(today, location.timezone || 'America/Toronto')}`);
    const items = await cloverList(`${prefix}/items?expand=categories`, tokens.access_token, { signal });
    const orders = await cloverList(`${prefix}/orders?${query}`, tokens.access_token, { signal });
    const validOrders = orders.filter(order => !order.deletedTime && !order.testMode && order.state === 'locked' && ['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'CREDITED'].includes(String(order.paymentState || '').toUpperCase()) && calendarDay(order.createdTime, location.timezone || 'America/Toronto') >= fromDay && calendarDay(order.createdTime, location.timezone || 'America/Toronto') < today);
    // Three concurrent requests respect merchant rate limits and avoid incomplete expansions.
    let cursor = 0;
    await Promise.all(Array.from({ length: 3 }, async () => {
      while (cursor < validOrders.length) {
        const order = validOrders[cursor++];
        order.lines = await cloverList(`${prefix}/orders/${id(order.id)}/line_items`, tokens.access_token, { maxPages: 31, signal });
      }
    }));
    const sales = summarizeCloverOrders(validOrders, items, location.timezone || 'America/Toronto', fromDay, today);
    const menu = items.filter(item => !item.deleted && item.isRevenue !== false).map(item => ({ id: item.id, name: String(item.name || 'Unnamed item'), category: item.categories?.elements?.[0]?.name || 'Uncategorized', price: Number(item.price || 0) / 100, ingredients: [] }));
    const published = await database('rpc/publish_clover_sync', { method: 'POST', body: { p_location_id: connection.location_id, p_lease_id: leaseId, p_sales: sales, p_menu: menu, p_from_day: fromDay, p_until_day: today } });
    if (published !== true) throw Object.assign(new Error('Clover connection changed before the sync finished. Please retry.'), { status: 409, code: 'CLOVER_CONNECTION_CHANGED' });
    return { synced: true, fromDay, untilDay: today, days: sales.length, menuItems: menu.length };
  });
}

export async function cloverStart(req, res) {
  requireCloverConfiguration();
  const { appUser, account, location } = await requireCloverAccess(req, req.body?.locationId);
  enforceRateLimit(req, res, `clover-start:${appUser.id}`, { limit: 10, windowMs: 60_000 });
  const existing = await database(`${connectionPath(location.id)}&select=status,lease_until`);
  if (existing?.[0]?.lease_until && Date.parse(existing[0].lease_until) > Date.now()) throw Object.assign(new Error('Wait for the current sync to finish before reconnecting.'), { status: 409 });
  const state = randomBytes(32).toString('base64url'), browser = randomBytes(32).toString('base64url');
  await database(`clover_oauth_states?expires_at=lt.${id(new Date().toISOString())}`, { method: 'DELETE', prefer: 'return=minimal' });
  await database(`clover_oauth_states?location_id=eq.${id(location.id)}`, { method: 'DELETE', prefer: 'return=minimal' });
  await database('clover_oauth_states', { method: 'POST', prefer: 'return=minimal', body: { state_hash: hash(state), browser_hash: hash(browser), user_id: appUser.id, account_id: account.id, location_id: location.id, expires_at: new Date(Date.now() + 600_000).toISOString() } });
  res.setHeader('Set-Cookie', cookie(browser));
  const url = new URL('https://www.clover.com/oauth/v2/authorize');
  url.search = new URLSearchParams({ client_id: process.env.CLOVER_CLIENT_ID, response_type: 'code', redirect_uri: cloverCallbackUrl(), state }).toString();
  return res.status(200).json({ authorizeUrl: url.toString() });
}

export async function cloverCallback(req, res) {
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Set-Cookie', cookie('', 0));
  const redirect = code => { res.setHeader('Location', `/app/integrations?clover=${code}`); return res.status(303).end(); };
  try {
    requireCloverConfiguration();
    const query = new URL(req.url, 'https://zestiq.ca').searchParams;
    const state = query.get('state'), code = query.get('code'), merchantId = query.get('merchant_id');
    const browser = String(req.headers?.cookie || '').split(';').map(value => value.trim()).find(value => value.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
    if (!state || !browser) return redirect('expired');
    const states = await database(`clover_oauth_states?state_hash=eq.${hash(state)}&browser_hash=eq.${hash(browser)}&expires_at=gt.${id(new Date().toISOString())}&consumed_at=is.null`, { method: 'PATCH', prefer: 'return=representation', body: { consumed_at: new Date().toISOString() } });
    const saved = states?.[0];
    if (!saved) return redirect('expired');
    if (query.get('error') || !code || !merchantId || !/^[A-Z0-9]{8,32}$/i.test(merchantId)) return redirect('cancelled');
    if (query.get('client_id') && query.get('client_id') !== process.env.CLOVER_CLIENT_ID) return redirect('failed');
    await revalidateCloverAccess(saved.user_id, saved.account_id, saved.location_id);
    const tokens = validatedTokenPair(await cloverRequest('/oauth/v2/token', { body: { client_id: process.env.CLOVER_CLIENT_ID, client_secret: process.env.CLOVER_CLIENT_SECRET, code } }));
    const merchant = await cloverRequest(`/v3/merchants/${id(merchantId)}`, { token: tokens.access_token });
    if (merchant.id !== merchantId) return redirect('failed');
    await revalidateCloverAccess(saved.user_id, saved.account_id, saved.location_id);
    const row = { location_id: saved.location_id, account_id: saved.account_id, connected_by: saved.user_id, merchant_id: merchantId, merchant_name: String(merchant.name || 'Clover restaurant'), status: 'connected', last_error: null };
    row.encrypted_tokens = sealTokens(tokens, tokenContext(row));
    // The RPC refuses replacement during a sync and enforces merchant/location uniqueness.
    await database('rpc/connect_clover', { method: 'POST', body: { p_connection: row, p_state_hash: hash(state) } });
    return redirect('authorized');
  } catch { return redirect('failed'); }
}

export async function cloverStatus(req, res) {
  const config = cloverConfiguration();
  const locationId = req.query?.locationId || new URL(req.url, 'https://zestiq.ca').searchParams.get('locationId');
  if (!locationId) {
    if (!config.available) return res.status(200).json({ available: false });
    try { await database('clover_connections?select=location_id&limit=0'); }
    catch { return res.status(200).json({ available: false }); }
    return res.status(200).json({ available: true });
  }
  const { location } = await requireCloverAccess(req, locationId);
  if (!config.available) return res.status(200).json({ available: false, connected: false });
  const rows = await database(`${connectionPath(location.id)}&select=status,merchant_name,last_sync_at,last_error,lease_until`);
  const row = rows?.[0];
  return res.status(200).json({ available: true, connected: row?.status === 'connected', reconnectRequired: row?.status === 'reconnect_required', merchantName: row?.status !== 'disconnected' ? row?.merchant_name : undefined, lastSync: row?.last_sync_at || null, lastError: row?.last_error || null, syncing: Date.parse(row?.lease_until) > Date.now() });
}

export async function cloverSync(req, res) {
  requireCloverConfiguration();
  const { location, appUser } = await requireCloverAccess(req, req.body?.locationId);
  enforceRateLimit(req, res, `clover-sync:${appUser.id}`, { limit: 5, windowMs: 60_000 });
  const rows = await database(`${connectionPath(location.id)}&status=eq.connected&select=*`);
  if (!rows?.[0]) throw Object.assign(new Error('Connect Clover for this restaurant location first.'), { status: 409, code: 'CLOVER_RECONNECT_REQUIRED' });
  return res.status(200).json(await syncClover(rows[0]));
}

export async function cloverDisconnect(req, res) {
  requireCloverConfiguration();
  const { location, account } = await requireCloverAccess(req, req.body?.locationId);
  // Cancel pending authorizations and the current lease in the same transaction.
  const stopped = await database('rpc/disconnect_clover', { method: 'POST', body: { p_location_id: location.id, p_account_id: account.id } });
  if (!stopped) throw Object.assign(new Error('Clover could not be disconnected. Please retry.'), { status: 409 });
  return res.status(200).json({ disconnected: true });
}

export function cloverHandler(methods, action) {
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!methods.includes(req.method)) { res.setHeader('Allow', methods.join(', ')); return res.status(405).json({ error: 'Method not allowed' }); }
    try { return await action(req, res); }
    catch (error) {
      const known = error.code?.startsWith('CLOVER_') || [400, 401, 402, 403, 404, 409, 429].includes(error.status);
      return res.status(known ? error.status || 500 : 503).json({ error: known ? error.message : 'Clover setup is incomplete or temporarily unavailable. Contact ZestIQ support.', ...(known && error.code ? { code: error.code } : {}) });
    }
  };
}
