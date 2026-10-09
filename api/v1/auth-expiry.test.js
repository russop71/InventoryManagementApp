import test from 'node:test';
import assert from 'node:assert/strict';

// Load the handler with a dummy server credential; all network calls are mocked.
const previousKey = process.env.SUPABASE_SECRET_KEY;
process.env.SUPABASE_SECRET_KEY = 'test-server-key';
const { default: handler } = await import('./[...path].js?auth-expiry-test');
if (previousKey === undefined) delete process.env.SUPABASE_SECRET_KEY;
else process.env.SUPABASE_SECRET_KEY = previousKey;

async function failedAuth(t, status, payload, url = '/api/v1/accounts/company/assistant') {
  t.mock.method(globalThis, 'fetch', async (requestUrl) => {
    assert.ok(String(requestUrl).endsWith('/auth/v1/user'));
    return new Response(JSON.stringify(payload), { status });
  });
  t.mock.method(console, 'error', () => {});
  const result = {};
  const res = {
    status(value) { result.status = value; return this; },
    setHeader() { return this; },
    end(value) { result.body = JSON.parse(value); },
  };
  await handler({ url, method: 'POST', headers: { authorization: 'Bearer expired-token' }, body: { message: 'inventory' } }, res);
  return result;
}

test('assistant returns 401 for Supabase expired JWT so the client can refresh', async t => {
  const result = await failedAuth(t, 403, {
    error_code: 'bad_jwt',
    msg: 'invalid JWT: unable to parse or verify signature, token has invalid claims: token is expired',
  });
  assert.equal(result.status, 401);
  assert.equal(result.body.code, 'SESSION_EXPIRED');
  assert.doesNotMatch(result.body.error, /invalid JWT/);
});

test('legacy invalid JWT responses without an error code also trigger refresh', async t => {
  const result = await failedAuth(t, 403, { message: 'invalid JWT: token is expired' });
  assert.equal(result.status, 401);
});

test('genuine forbidden authentication responses remain forbidden', async t => {
  const result = await failedAuth(t, 403, { error_code: 'user_banned', msg: 'User is banned' });
  assert.equal(result.status, 403);
  assert.equal(result.body.code, 'user_banned');
});

test('password login failures are not treated as expired user sessions', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ error_code: 'invalid_credentials', msg: 'Invalid login credentials' }), { status: 400 }));
  t.mock.method(console, 'error', () => {});
  const result = {};
  const res = {
    status(value) { result.status = value; return this; },
    setHeader() { return this; },
    end(value) { result.body = JSON.parse(value); },
  };
  await handler({ url: '/api/v1/auth/login', method: 'POST', headers: {}, body: { email: 'owner@example.com', password: 'wrong-password' } }, res);
  assert.equal(result.status, 400);
  assert.equal(result.body.code, 'invalid_credentials');
});
