import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { cloverConfig, createCloverHandler, matchesState, seal, unseal, collectClover } from './_clover.js';

const locationId = '10000000-0000-4000-8000-000000000001';
const accountId = '20000000-0000-4000-8000-000000000001';
const configuration = () => cloverConfig({ APP_URL: 'https://zestiq.ca', CLOVER_CLIENT_ID: 'TESTCLIENT123', CLOVER_CLIENT_SECRET: 'test-secret', CLOVER_TOKEN_KEY: Buffer.alloc(32, 1).toString('base64'), CLOVER_ENABLED: 'true' });
function response() {
  return { headers: {}, statusCode: 200, status(value) { this.statusCode = value; return this; }, setHeader(name, value) { this.headers[name] = value; }, end(value) { this.body = value; } };
}
const auth = { appUser: { id: 'user', role: 'Owner', account_id: accountId }, authUser: { email: 'owner@example.test' } };

test('Clover configuration is disabled by default and isolates sandbox from production', () => {
  assert.equal(cloverConfig({}).ready, false);
  assert.equal(configuration().api, 'https://apisandbox.dev.clover.com');
  assert.equal(configuration().callback, 'https://zestiq.ca/api/v1/clover/callback');
  assert.throws(() => cloverConfig({ CLOVER_ENVIRONMENT: 'attacker-host' }));
  assert.throws(() => cloverConfig({ APP_URL: 'http://zestiq.ca' }));
});
test('encrypted tokens cannot be decrypted by another tenant or location', () => {
  const key = randomBytes(32), context = `${accountId}:${locationId}:sandbox`;
  const encrypted = seal({ access_token: 'private-token' }, key, context);
  assert.ok(!encrypted.includes('private-token'));
  assert.equal(unseal(encrypted, key, context).access_token, 'private-token');
  assert.throws(() => unseal(encrypted, key, 'other-location'));
  assert.throws(() => unseal(encrypted, randomBytes(32), context));
  assert.throws(() => unseal(encrypted.slice(0, -4) + 'AAAA', key, context));
});
test('OAuth browser state rejects absent, mismatched, or malformed values', () => {
  const state = 'a'.repeat(64);
  assert.equal(matchesState(state, state), true);
  for (const other of ['', 'a', 'b'.repeat(64), '../unsafe']) assert.equal(matchesState(state, other), false);
});
test('Clover connection refuses staff, demo, and foreign locations', async () => {
  for (const [actor, locations] of [[{ ...auth, appUser: { ...auth.appUser, role: 'Staff' } }, [{}]], [{ ...auth, authUser: { email: 'demo@zestiq.com' } }, [{}]], [auth, []]]) {
    const handler = createCloverHandler({ db: async () => locations, authenticate: async () => actor, rateLimit() {}, config: configuration });
    await assert.rejects(() => handler({ url: '/api/v1/clover/start', method: 'POST', body: { locationId } }, response(), 'start'), { status: 403 });
  }
});
test('start scopes nonce to authenticated account/location and never returns credentials', async () => {
  let pending;
  const handler = createCloverHandler({ authenticate: async () => auth, rateLimit() {}, config: configuration,
    db: async (path, options) => {
      if (path.startsWith('locations?')) { assert.ok(path.includes(`account_id=eq.${accountId}`)); return [{ id: locationId }]; }
      assert.equal(path, 'clover_oauth_states'); pending = options.body; return [];
    } });
  const res = response();
  await handler({ method: 'POST', url: '/api/v1/clover/start', body: { locationId, accountId: 'attacker' } }, res, 'start');
  const url = new URL(JSON.parse(res.body).authorizeUrl);
  assert.equal(url.host, 'sandbox.dev.clover.com');
  assert.equal(pending.account_id, accountId);
  assert.equal(pending.location_id, locationId);
  assert.notEqual(pending.state_hash, url.searchParams.get('state'));
  assert.match(res.headers['Set-Cookie'], /HttpOnly; Secure; SameSite=Lax/);
  assert.ok(!res.body.includes('test-secret'));
});
test('callback rejects CSRF before any database or provider call', async () => {
  const handler = createCloverHandler({ db: async () => assert.fail('must not access db'), authenticate: async () => auth, rateLimit() {}, config: configuration });
  const res = response();
  await handler({ method: 'GET', url: '/api/v1/clover/callback?code=private-code&state=wrong', headers: {} }, res, 'callback');
  assert.equal(res.statusCode, 303);
  assert.equal(res.headers.Location, 'https://zestiq.ca/app/integrations?clover=failed');
});
test('callback exchanges code once and stores only encrypted credentials', async t => {
  let consumed = false, saved, calls = 0;
  const state = 'a'.repeat(64);
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls++;
    if (url.endsWith('/oauth/v2/token')) { assert.equal(JSON.parse(options.body).code, 'test-code'); return Response.json({ access_token: 'access', refresh_token: 'refresh', access_token_expiration: 9999999999, refresh_token_expiration: 9999999999 }); }
    return Response.json({ id: 'ABC1234567890', name: 'Test restaurant' });
  });
  const handler = createCloverHandler({ authenticate: async () => auth, rateLimit() {}, config: configuration, db: async (path, options) => {
    if (path.startsWith('clover_oauth_states?')) { assert.equal(options.method, 'DELETE'); if (consumed) return []; consumed = true; return [{ account_id: accountId, location_id: locationId, user_id: 'user', environment: 'sandbox' }]; }
    if (path.startsWith('app_users?')) return [{ role: 'Owner' }];
    if (path.startsWith('locations?')) return [{ id: locationId }];
    assert.equal(path, 'rpc/clover_save_connection'); saved = options.body.connection;
  } });
  const req = { method: 'GET', url: `/api/v1/clover/callback?state=${state}&client_id=TESTCLIENT123&merchant_id=ABC1234567890&code=test-code`, headers: { cookie: `__Host-zestiq-clover=${state}` } };
  const res = response(); await handler(req, res, 'callback');
  assert.match(res.headers.Location, /clover=connected$/);
  assert.equal(saved.account_id, accountId);
  assert.ok(!JSON.stringify(saved).includes('"access_token"'));
  const replay = response(); await handler(req, replay, 'callback');
  assert.match(replay.headers.Location, /clover=failed$/);
  assert.equal(calls, 2);
});
test('Clover pagination fetches all pages and refuses malformed collections', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => Response.json({ elements: calls++ === 0 ? Array.from({ length: 100 }, (_, id) => ({ id })) : [{ id: 100 }] }));
  assert.equal((await collectClover(configuration(), '/v3/merchants/ABC1234567890/items', 'test')).length, 101);
  t.mock.method(globalThis, 'fetch', async () => Response.json({ error: 'wrong shape' }));
  await assert.rejects(() => collectClover(configuration(), '/items', 'test'), { status: 502 });
});
