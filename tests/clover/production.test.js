import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cloverConfiguration, sealTokens, openTokens } from '../../api/_clover-config.js';
import { calendarDay, cloverList, summarizeCloverOrders, zonedMidnight } from '../../api/_clover-client.js';

Object.assign(process.env, { SUPABASE_SECRET_KEY: 'test-db-key', APP_URL: 'https://zestiq.ca', CLOVER_PRODUCTION_ENABLED: 'true', CLOVER_CLIENT_ID: 'test-client', CLOVER_CLIENT_SECRET: 'test-secret', CLOVER_ENCRYPTION_KEY: 'ab'.repeat(32), CRON_SECRET: 'test-cron' });
const { default: start } = await import('../../api/clover/start.js');
const { default: status } = await import('../../api/clover/status.js');
const { default: callback } = await import('../../api/clover/callback.js');
const { default: sync } = await import('../../api/clover/sync.js');
const A = '11111111-1111-4111-8111-111111111111', L = '44444444-4444-4444-8444-444444444444', U = '33333333-3333-4333-8333-333333333333';
const tokens = { access_token: 'private-access', refresh_token: 'private-refresh', access_token_expiration: Math.floor(Date.now() / 1000) + 1000, refresh_token_expiration: Math.floor(Date.now() / 1000) + 9000 };
const hashed = value => createHash('sha256').update(value).digest('hex');
function response() { return { headers: {}, setHeader(key, value) { this.headers[key] = value; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; }, end() { return this; } }; }
function authFixture(t, { role = 'Owner', account = A, locationAccount = A, assignments = [], extra = () => undefined } = {}) {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (target, init = {}) => {
    const url = new URL(target), body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, method: init.method || 'GET', body });
    const override = await extra(url, init, body);
    if (override !== undefined) return override;
    if (url.pathname.endsWith('/auth/v1/user')) return Response.json({ id: 'auth-user', email: 'owner@example.com' });
    if (url.pathname.endsWith('/app_users')) return Response.json([{ id: U, account_id: account, status: 'Active', role }]);
    if (url.pathname.endsWith('/accounts')) return Response.json([{ id: account, slug: 'private-kitchen', billing_status: 'active' }]);
    if (url.pathname.endsWith('/locations')) return Response.json(locationAccount === account ? [{ id: L, account_id: account, timezone: 'America/Toronto' }] : []);
    if (url.pathname.endsWith('/app_user_locations')) return Response.json(assignments.map(location_id => ({ location_id })));
    if (url.pathname.endsWith('/clover_connections')) return Response.json([]);
    if (url.pathname.endsWith('/clover_oauth_states')) return Response.json([]);
    if (url.pathname.endsWith('/rpc/disconnect_clover')) return Response.json(true);
    throw new Error(`Unexpected request ${url.pathname}`);
  });
  return calls;
}
const req = (method, body = {}, url = '/api/clover/start') => ({ method, body, url, headers: { authorization: 'Bearer test-token', 'x-forwarded-for': '127.0.0.1' } });

test('production config rejects sandbox URLs, missing secrets and invalid encryption keys', () => {
  assert.equal(cloverConfiguration().available, true);
  assert.equal(cloverConfiguration({ ...process.env, APP_URL: 'https://sandbox.dev.clover.com' }).available, false);
  assert.equal(cloverConfiguration({ ...process.env, CLOVER_ENCRYPTION_KEY: 'bad' }).available, false);
  assert.equal(cloverConfiguration({ ...process.env, CLOVER_CLIENT_SECRET: '' }).available, false);
});
test('tokens are encrypted and cannot be moved to another location', () => {
  const sealed = sealTokens(tokens, `${A}:${L}:MERCHANT123`);
  assert.ok(!sealed.includes('private-access'));
  assert.deepEqual(openTokens(sealed, `${A}:${L}:MERCHANT123`), tokens);
  assert.throws(() => openTokens(sealed, `${A}:other:MERCHANT123`));
});
test('authorization URL uses production v2 OAuth, random state and an HttpOnly browser cookie', async t => {
  let stateRow;
  authFixture(t, { extra(url, init, body) { if (url.pathname.endsWith('/clover_oauth_states') && init.method === 'POST') { stateRow = body; return Response.json(null); } } });
  const res = response(); await start(req('POST', { locationId: L }), res);
  assert.equal(res.statusCode, 200);
  const target = new URL(res.body.authorizeUrl);
  assert.equal(target.origin, 'https://www.clover.com'); assert.equal(target.pathname, '/oauth/v2/authorize');
  assert.equal(target.searchParams.get('redirect_uri'), 'https://zestiq.ca/api/clover/callback');
  assert.equal(stateRow.location_id, L); assert.equal(stateRow.account_id, A); assert.equal(stateRow.user_id, U);
  assert.equal(stateRow.state_hash, hashed(target.searchParams.get('state')));
  assert.match(res.headers['Set-Cookie'], /HttpOnly; Secure; SameSite=Lax/);
  assert.ok(!JSON.stringify(res.body).includes('test-secret'));
});
test('staff cannot connect Clover', async t => {
  const calls = authFixture(t, { role: 'Staff' }); const res = response(); await start(req('POST', { locationId: L }), res);
  assert.equal(res.statusCode, 403); assert.ok(!calls.some(call => call.url.pathname.endsWith('/clover_oauth_states')));
});
test('manager cannot connect an unassigned location', async t => {
  authFixture(t, { role: 'Manager' }); const res = response(); await start(req('POST', { locationId: L }), res); assert.equal(res.statusCode, 403);
});
test('cross-company location is rejected before any Clover call', async t => {
  const calls = authFixture(t, { locationAccount: 'other-account' }); const res = response(); await start(req('POST', { locationId: L }), res);
  assert.equal(res.statusCode, 404); assert.ok(calls.every(call => call.url.hostname !== 'api.clover.com'));
});
test('status exposes merchant and sync health without credentials', async t => {
  authFixture(t, { extra(url) { if (url.pathname.endsWith('/clover_connections')) return Response.json([{ status: 'connected', merchant_name: 'Test Kitchen', last_sync_at: '2026-10-30', encrypted_tokens: 'must-not-leak' }]); } });
  const res = response(); await status(req('GET', {}, `/api/clover/status?locationId=${L}`), res);
  assert.equal(res.body.connected, true); assert.equal(res.body.merchantName, 'Test Kitchen'); assert.ok(!JSON.stringify(res.body).includes('must-not-leak'));
});
test('callback without browser cookie never exchanges a code or saves a connection', async t => {
  const calls = authFixture(t); const res = response(); await callback({ method: 'GET', url: '/api/clover/callback?state=fake&code=secret&merchant_id=MERCHANT123', headers: {} }, res);
  assert.equal(res.statusCode, 303); assert.match(res.headers.Location, /clover=expired/); assert.equal(calls.length, 0);
});
test('callback consumes a browser-bound state and stores only encrypted credentials', async t => {
  let connected;
  const calls = authFixture(t, { extra(url, init, body) {
    if (url.pathname.endsWith('/clover_oauth_states') && init.method === 'PATCH') {
      assert.equal(url.searchParams.get('browser_hash'), `eq.${hashed('browser')}`);
      assert.equal(url.searchParams.get('consumed_at'), 'is.null');
      return Response.json([{ user_id: U, account_id: A, location_id: L }]);
    }
    if (url.pathname === '/oauth/v2/token') { assert.equal(body.code, 'auth-code'); return Response.json(tokens); }
    if (url.pathname === '/v3/merchants/MERCHANT123') return Response.json({ id: 'MERCHANT123', name: 'Kitchen' });
    if (url.pathname.endsWith('/rpc/connect_clover')) { connected = body; return Response.json(true); }
  } });
  const res = response(); await callback({ method: 'GET', url: '/api/clover/callback?state=random-state&code=auth-code&merchant_id=MERCHANT123', headers: { cookie: '__Host-zestiq-clover=browser' } }, res);
  assert.equal(res.headers.Location, '/app/integrations?clover=authorized');
  assert.equal(connected.p_connection.location_id, L); assert.equal(connected.p_connection.account_id, A);
  assert.equal(connected.p_state_hash, hashed('random-state'));
  assert.ok(!JSON.stringify(connected).includes('private-access'));
  assert.ok(!JSON.stringify(res).includes('auth-code'));
  assert.equal(calls.filter(call => call.url.pathname.endsWith('/app_users')).length, 2);
});
test('replayed callback state cannot exchange tokens', async t => {
  const calls = authFixture(t); const res = response(); await callback({ method: 'GET', url: '/api/clover/callback?state=replayed&code=auth-code&merchant_id=MERCHANT123', headers: { cookie: '__Host-zestiq-clover=browser' } }, res);
  assert.match(res.headers.Location, /expired/); assert.ok(calls.every(call => call.url.hostname !== 'api.clover.com'));
});
test('disconnect erases credentials and cancels any pending lease and authorization', async t => {
  const calls = authFixture(t); const res = response(); await status(req('DELETE', { locationId: L }, '/api/clover/status'), res);
  assert.equal(res.statusCode, 200);
  const write = calls.find(call => call.url.pathname.endsWith('/rpc/disconnect_clover'));
  assert.equal(write.body.p_location_id, L); assert.equal(write.body.p_account_id, A);

});
test('sync requires an authorized connection and never treats imports as OAuth', async t => {
  authFixture(t); const res = response(); await sync(req('POST', { locationId: L }, '/api/clover/sync'), res);
  assert.equal(res.statusCode, 409); assert.equal(res.body.code, 'CLOVER_RECONNECT_REQUIRED');
});
test('Clover pagination retrieves subsequent pages and refuses truncated batches', async t => {
  let count = 0;
  t.mock.method(globalThis, 'fetch', async target => {
    const offset = Number(new URL(target).searchParams.get('offset')); count++;
    return Response.json({ elements: Array.from({ length: offset === 0 ? 100 : 1 }, (_, index) => ({ id: String(offset + index) })) });
  });
  const rows = await cloverList('/v3/merchants/MERCHANT123/items', 'test-pagination-token');
  assert.equal(rows.length, 101); assert.equal(count, 2);
  await assert.rejects(cloverList('/v3/merchants/MERCHANT123/items', 'test-cap-token', { maxPages: 1 }), /No partial data was saved/);
});
test('restaurant day boundaries handle Toronto daylight saving changes', () => {
  assert.equal(new Date(zonedMidnight('2026-03-08', 'America/Toronto')).toISOString(), '2026-03-08T05:00:00.000Z');
  assert.equal(new Date(zonedMidnight('2026-03-09', 'America/Toronto')).toISOString(), '2026-03-09T04:00:00.000Z');
  assert.equal(calendarDay(Date.parse('2026-10-30T02:00:00Z'), 'America/Toronto'), '2026-10-29');
});
test('sales use cents, weighted quantities, void filtering and complete local days', () => {
  const order = { id: 'o1', createdTime: Date.parse('2026-10-02T01:00:00Z'), state: 'locked', paymentState: 'PAID', lines: [
    { id: 'l1', name: 'Pasta', item: { id: 'fixed' }, priceWithModifiersAndItemAndOrderDiscounts: 2000 },
    { id: 'l2', name: 'Weighted', item: { id: 'weight' }, unitQty: 2500, priceWithModifiersAndItemAndOrderDiscounts: 400 },
    { id: 'l3', isDeleted: true, priceWithModifiersAndItemAndOrderDiscounts: 1000 },
  ] };
  const sales = summarizeCloverOrders([order, { ...order, state: 'open' }, { ...order, deletedTime: 123 }, { ...order, testMode: true }], [{ id: 'fixed' }, { id: 'weight', priceType: 'PER_UNIT' }], 'America/Toronto', '2026-10-01', '2026-10-03');
  assert.equal(sales[0].revenue, 30); assert.equal(sales[0].covers, 0); assert.equal(sales[0].topItems[1].quantity, 2.5); assert.equal(sales[1].revenue, 0);
  assert.throws(() => summarizeCloverOrders([{ ...order, lines: [{ name: 'Incomplete', price: 1000 }] }], [], 'America/Toronto', '2026-10-01', '2026-10-03'), /No sales were changed/);
});

test('sync renews a token once, persists it before API reads, then atomically publishes', async t => {
  const row = { location_id: L, account_id: A, connected_by: U, merchant_id: 'MERCHANT123', status: 'connected', encrypted_tokens: sealTokens({ ...tokens, access_token_expiration: 1 }, `${A}:${L}:MERCHANT123`) };
  const steps = [];
  let leaseId;
  authFixture(t, { extra(url, init, body) {
    if (url.pathname.endsWith('/clover_connections')) {
      if (init.method === 'PATCH' && body.lease_id) { leaseId = body.lease_id; return Response.json([{ ...row, lease_id: leaseId }]); }
      if (init.method === 'PATCH' && body.encrypted_tokens) { steps.push('persist-token'); assert.equal(openTokens(body.encrypted_tokens, `${A}:${L}:MERCHANT123`).access_token, 'renewed'); return Response.json([row]); }
      return Response.json([row]);
    }
    if (url.pathname === '/oauth/v2/refresh') { steps.push('refresh'); return Response.json({ ...tokens, access_token: 'renewed' }); }
    if (url.pathname === '/v3/merchants/MERCHANT123/items') { steps.push('items'); return Response.json({ elements: [{ id: 'menu1', name: 'Pasta', price: 2000 }] }); }
    if (url.pathname === '/v3/merchants/MERCHANT123/orders') {
      steps.push('orders');
      const yesterday = new Date(); yesterday.setUTCDate(yesterday.getUTCDate() - 1); yesterday.setUTCHours(16, 0, 0, 0);
      return Response.json({ elements: [{ id: 'order1', state: 'locked', paymentState: 'PAID', createdTime: yesterday.getTime() }] });
    }
    if (url.pathname === '/v3/merchants/MERCHANT123/orders/order1/line_items') return Response.json({ elements: [{ id: 'line1', name: 'Pasta', item: { id: 'menu1' }, priceWithModifiersAndItemAndOrderDiscounts: 2000 }] });
    if (url.pathname.endsWith('/rpc/publish_clover_sync')) {
      steps.push('publish'); assert.equal(body.p_location_id, L); assert.equal(body.p_lease_id, leaseId);
      assert.equal(body.p_sales.reduce((total, day) => total + day.revenue, 0), 20);
      return Response.json(true);
    }
  } });
  const res = response(); await sync(req('POST', { locationId: L }, '/api/clover/sync'), res);
  assert.equal(res.statusCode, 200); assert.equal(res.body.synced, true);
  assert.deepEqual(steps, ['refresh', 'persist-token', 'items', 'orders', 'publish']);
});

test('provider failure does not publish partial data and releases the lease', async t => {
  const row = { location_id: L, account_id: A, connected_by: U, merchant_id: 'MERCHANT123', status: 'connected', encrypted_tokens: sealTokens(tokens, `${A}:${L}:MERCHANT123`) };
  let published = false, released = false;
  authFixture(t, { extra(url, init, body) {
    if (url.pathname.endsWith('/clover_connections')) {
      if (init.method === 'PATCH' && body.lease_id) return Response.json([row]);
      if (init.method === 'PATCH' && body.lease_id === null) { released = true; return Response.json(null); }
      return Response.json([row]);
    }
    if (url.hostname === 'api.clover.com') return new Response('do-not-expose-provider-secret', { status: 500 });
    if (url.pathname.endsWith('/rpc/publish_clover_sync')) { published = true; return Response.json(true); }
  } });
  const res = response(); await sync(req('POST', { locationId: L }, '/api/clover/sync'), res);
  assert.equal(res.statusCode, 502); assert.equal(published, false); assert.equal(released, true);
  assert.ok(!JSON.stringify(res.body).includes('do-not-expose'));
});
