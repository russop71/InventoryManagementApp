import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const hash = value => createHash('sha256').update(value).digest('hex');
const uuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
export function cloverConfig(env = process.env) {
  const environment = env.CLOVER_ENVIRONMENT || 'sandbox';
  if (!['sandbox', 'production'].includes(environment)) throw fail('Invalid Clover environment', 503);
  const origin = new URL(env.APP_URL || 'https://zestiq.ca');
  if (origin.protocol !== 'https:') throw fail('Clover requires an HTTPS application URL', 503);
  const key = Buffer.from(env.CLOVER_TOKEN_KEY || '', 'base64');
  return {
    environment, origin: origin.origin, key,
    clientId: env.CLOVER_CLIENT_ID, secret: env.CLOVER_CLIENT_SECRET,
    ready: Boolean(env.CLOVER_CLIENT_ID && env.CLOVER_CLIENT_SECRET && key.length === 32 && env.CLOVER_ENABLED === 'true'),
    api: environment === 'sandbox' ? 'https://apisandbox.dev.clover.com' : 'https://api.clover.com',
    authorize: environment === 'sandbox' ? 'https://sandbox.dev.clover.com' : 'https://www.clover.com',
    callback: `${origin.origin}/api/v1/clover/callback`,
  };
}

export function seal(value, key, context) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(context));
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
}
export function unseal(value, key, context) {
  const raw = Buffer.from(value, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
  decipher.setAAD(Buffer.from(context));
  decipher.setAuthTag(raw.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString());
}
const contextFor = row => `${row.account_id}:${row.location_id}:${row.environment}`;
function cookie(req, name) {
  return String(req.headers?.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(`${name}=`))?.slice(name.length + 1) || '';
}
export function matchesState(state, browserState) {
  if (!/^[a-f0-9]{64}$/.test(state) || !/^[a-f0-9]{64}$/.test(browserState)) return false;
  return timingSafeEqual(Buffer.from(state), Buffer.from(browserState));
}
async function provider(config, path, { token, body } = {}) {
  const response = await fetch(`${config.api}${path}`, {
    method: body ? 'POST' : 'GET', redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  // Never propagate provider response bodies, OAuth codes, or tokens to logs/clients.
  if (!response.ok) throw fail(response.status === 401 ? 'Clover authorization expired. Reconnect Clover.' : 'Clover could not complete the request. Try again later.', response.status === 401 ? 409 : 502);
  return response.json();
}
function validateTokens(value) {
  if (!value.access_token || !value.refresh_token || !Number.isFinite(value.access_token_expiration) || !Number.isFinite(value.refresh_token_expiration)) throw fail('Clover returned incomplete authorization', 502);
  return value;
}
export async function collectClover(config, path, token) {
  const result = [];
  for (let offset = 0; offset < 10000; offset += 100) {
    const page = await provider(config, `${path}${path.includes('?') ? '&' : '?'}limit=100&offset=${offset}`, { token });
    if (!Array.isArray(page.elements)) throw fail('Clover returned incomplete data', 502);
    result.push(...page.elements);
    if (page.elements.length < 100) return result;
  }
  throw fail('Clover dataset exceeds one sync batch. No partial results were saved.', 422);
}

// Dependencies use the existing validated ZestIQ session and service-only database client.
export function createCloverHandler({ db, authenticate, rateLimit, config = cloverConfig }) {
  async function access(req, locationId) {
    const auth = await authenticate(req);
    if (!['Owner', 'Admin'].includes(auth.appUser.role) || /^demo@zestiq\.(com|ca)$/i.test(auth.authUser.email || '')) throw fail('Only a private workspace owner or admin can manage Clover', 403);
    if (!uuid(locationId)) throw fail('Choose a valid restaurant location');
    const rows = await db(`locations?id=eq.${locationId}&account_id=eq.${auth.appUser.account_id}&select=id,account_id,timezone`);
    if (!rows?.[0]) throw fail('Location is not available to this account', 403);
    return { ...auth, location: rows[0] };
  }
  return async function handle(req, res, action) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    const cfg = config();
    const query = new URL(req.url, cfg.origin).searchParams;
    const send = (status, value) => { res.status(status); res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)); };
    const redirect = result => { res.status(303); res.setHeader('Location', `${cfg.origin}/app/integrations?clover=${result}`); res.end(); };
    if (action === 'callback' && req.method === 'GET') {
      try {
        if (!cfg.ready) throw fail('Clover setup is not enabled', 503);
        const state = query.get('state') || '';
        if (!matchesState(state, cookie(req, '__Host-zestiq-clover'))) throw fail('Clover connection session expired');
        res.setHeader('Set-Cookie', '__Host-zestiq-clover=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
        // Atomic delete consumes the nonce exactly once, including failed/cancelled attempts.
        const states = await db(`clover_oauth_states?state_hash=eq.${hash(state)}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}`, { method: 'DELETE', prefer: 'return=representation' });
        const pending = states?.[0];
        if (!pending || pending.environment !== cfg.environment) throw fail('Clover connection session expired');
        if (query.has('error')) return redirect('cancelled');
        if (query.get('client_id') !== cfg.clientId || !/^[A-Z0-9]{13}$/i.test(query.get('merchant_id') || '') || !query.get('code')) throw fail('Invalid Clover response');
        const users = await db(`app_users?id=eq.${pending.user_id}&account_id=eq.${pending.account_id}&status=eq.Active&select=role`);
        if (!['Owner', 'Admin'].includes(users?.[0]?.role)) throw fail('Connection permission changed', 403);
        const locations = await db(`locations?id=eq.${pending.location_id}&account_id=eq.${pending.account_id}&select=id`);
        if (!locations?.length) throw fail('Location is no longer available', 403);
        const tokens = validateTokens(await provider(cfg, '/oauth/v2/token', { body: { client_id: cfg.clientId, client_secret: cfg.secret, code: query.get('code') } }));
        const merchantId = query.get('merchant_id');
        const merchant = await provider(cfg, `/v3/merchants/${merchantId}`, { token: tokens.access_token });
        if (merchant.id !== merchantId) throw fail('Clover merchant could not be verified', 403);
        const row = { account_id: pending.account_id, location_id: pending.location_id, environment: cfg.environment, merchant_id: merchantId, merchant_name: String(merchant.name || '').slice(0, 200), token_ciphertext: seal(tokens, cfg.key, contextFor(pending)), status: 'connected', last_error: null };
        // A merchant is unique per environment and cannot silently migrate across clients.
        await db('rpc/clover_save_connection', { method: 'POST', body: { connection: row } });
        return redirect('connected');
      } catch { return redirect('failed'); }
    }
    const locationId = req.method === 'GET' ? query.get('locationId') : req.body?.locationId;
    const auth = await access(req, locationId);
    const where = `location_id=eq.${locationId}&account_id=eq.${auth.appUser.account_id}&environment=eq.${cfg.environment}`;
    if (action === 'status' && req.method === 'GET') {
      if (!cfg.ready) return send(200, { configured: false, environment: cfg.environment, status: 'not_configured' });
      const rows = await db(`clover_connections?${where}&select=status,merchant_name,last_sync,last_error`);
      return send(200, { configured: true, environment: cfg.environment, ...(rows?.[0] || { status: 'disconnected' }) });
    }
    if (!cfg.ready) throw fail('Clover is awaiting secure server configuration. File imports are still available.', 503);
    if (req.method !== 'POST') return send(405, { error: 'Method not allowed' });
    rateLimit(req, res, `clover-${action}-${auth.appUser.id}`, { limit: 10, windowMs: 60000 });
    if (action === 'start') {
      const state = randomBytes(32).toString('hex');
      await db('clover_oauth_states', { method: 'POST', prefer: 'return=minimal', body: { state_hash: hash(state), account_id: auth.appUser.account_id, location_id: locationId, user_id: auth.appUser.id, environment: cfg.environment, expires_at: new Date(Date.now() + 600000).toISOString() } });
      res.setHeader('Set-Cookie', `__Host-zestiq-clover=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
      const url = new URL('/oauth/v2/authorize', cfg.authorize);
      url.search = new URLSearchParams({ client_id: cfg.clientId, redirect_uri: cfg.callback, response_type: 'code', state }).toString();
      return send(200, { authorizeUrl: url.toString() });
    }
    if (action === 'disconnect') {
      await db('rpc/clover_disconnect', { method: 'POST', body: { target_location: locationId, target_account: auth.appUser.account_id, target_environment: cfg.environment } });
      return send(200, { disconnected: true });
    }
    if (action === 'sync') {
      const lease = randomBytes(24).toString('hex');
      const rows = await db('rpc/clover_claim_sync', { method: 'POST', body: { target_location: locationId, target_account: auth.appUser.account_id, target_environment: cfg.environment, lease } });
      const connection = rows?.[0];
      if (!connection) throw fail('Clover is disconnected or another sync is running', 409);
      try {
        let tokens = unseal(connection.token_ciphertext, cfg.key, contextFor(connection));
        if (tokens.access_token_expiration * 1000 < Date.now() + 120000) {
          if (tokens.refresh_token_expiration * 1000 <= Date.now()) throw fail('Clover authorization expired. Reconnect Clover.', 409);
          tokens = validateTokens(await provider(cfg, '/oauth/v2/refresh', { body: { client_id: cfg.clientId, refresh_token: tokens.refresh_token } }));
          const saved = await db(`clover_connections?${where}&sync_lease=eq.${lease}`, { method: 'PATCH', prefer: 'return=representation', body: { token_ciphertext: seal(tokens, cfg.key, contextFor(connection)) } });
          if (!saved?.length) throw fail('Connection changed during token refresh', 409);
        }
        const prefix = `/v3/merchants/${connection.merchant_id}`;
        const items = await collectClover(cfg, `${prefix}/items`, tokens.access_token);
        const from = Date.now() - 7 * 86400000;
        const orders = await collectClover(cfg, `${prefix}/orders?filter=${encodeURIComponent(`createdTime>=${from}`)}`, tokens.access_token);
        // Store minimal operational data; no customer, employee or payment-card data.
        const snapshot = {
          from: new Date(from).toISOString(), to: new Date().toISOString(),
          items: items.map(x => ({ id: x.id, name: x.name, price: x.price, priceType: x.priceType, deleted: x.deleted })),
          orders: orders.map(x => ({ id: x.id, createdTime: x.createdTime, modifiedTime: x.modifiedTime, total: x.total, currency: x.currency, state: x.state, payType: x.payType })),
        };
        await db('rpc/clover_finish_sync', { method: 'POST', body: { target_location: locationId, target_account: auth.appUser.account_id, target_environment: cfg.environment, lease, snapshot } });
        return send(200, { synced: true, reportingReady: false, items: items.length, orders: orders.length });
      } catch (error) {
        const message = error.status === 409 ? 'Reconnect Clover or retry when the current sync finishes.' : 'Sync failed. Previous data was preserved.';
        await db(`clover_connections?${where}&sync_lease=eq.${lease}`, { method: 'PATCH', prefer: 'return=minimal', body: { sync_lease: null, sync_until: null, last_error: message, ...(error.status === 409 ? { status: 'reconnect_required' } : {}) } });
        throw fail(message, error.status || 502);
      }
    }
    return send(404, { error: 'Unknown Clover action' });
  };
}
