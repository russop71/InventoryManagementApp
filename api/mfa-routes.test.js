import test from 'node:test';
import assert from 'node:assert/strict';
process.env.SUPABASE_SECRET_KEY = 'test-only';
const { default: handler } = await import('./v1/[...path].js');
const id = '10000000-0000-4000-8000-000000000001';
const factor = { id, factor_type: 'totp', status: 'verified' };
const token = aal => `header.${Buffer.from(JSON.stringify({ aal })).toString('base64url')}.signature`;

test('MFA routes enforce optional enrollment and verified-session boundaries', async t => {
  let factors = [], role = 'Owner', requests = [];
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    requests.push({ url: String(url), method: options.method || 'GET' });
    if (String(url).endsWith('/auth/v1/user')) return Response.json({ id: 'user', email: 'owner@example.test', factors });
    if (String(url).includes('/rest/v1/app_users?')) return Response.json([{ id: 'app-user', role, status: 'Active', account_id: 'account' }]);
    if (String(url).endsWith(`/factors/${id}`) && options.method === 'DELETE') return Response.json({});
    if (String(url).endsWith(`/factors/${id}/challenge`)) return Response.json({ id: 'challenge' });
    if (String(url).endsWith(`/factors/${id}/verify`)) return Response.json({ message: 'Invalid code' }, { status: 422 });
    if (String(url).endsWith('/factors') && options.method === 'POST') return Response.json({ id, totp: { qr_code: '<svg xmlns="http://www.w3.org/2000/svg"/>', uri: 'otpauth://totp/Test?secret=TEST', secret: 'TEST' } });
    throw new Error(`Unexpected upstream request: ${url}`);
  });
  const call = async (path, { method = 'GET', aal = 'aal1', body = {} } = {}) => {
    let status, payload;
    const res = { status(value) { status = value; return this; }, setHeader() { return this; }, end(value) { payload = JSON.parse(value); return this; } };
    await handler({ url: `/api/v1/${path}`, method, body, headers: { authorization: `Bearer ${token(aal)}` } }, res);
    return { status, payload };
  };
  assert.equal((await call('auth/mfa/status')).payload.required, false);
  factors = [{ ...factor, status: 'unverified' }];
  assert.equal((await call('auth/mfa/status')).payload.required, false);
  const enrolled = await call('auth/mfa/enroll', { method: 'POST' });
  assert.equal(enrolled.status, 200);
  assert.equal(enrolled.payload.secret, 'TEST');
  assert.ok(requests.some(request => request.url.endsWith(`/factors/${id}`) && request.method === 'DELETE'));
  factors = [factor];
  assert.equal((await call('auth/mfa/status')).payload.required, true);
  assert.equal((await call('auth/mfa/remove', { method: 'POST', body: { factorId: id } })).status, 403);
  assert.equal((await call('auth/password', { method: 'POST', body: { password: 'testpassword' } })).status, 401);
  assert.equal((await call('accounts/account', {})).status, 401);
  assert.equal((await call('auth/mfa/verify', { method: 'POST', body: { factorId: id, code: 'wrong' } })).status, 400);
  assert.notEqual((await call('auth/mfa/verify', { method: 'POST', body: { factorId: id, code: '123456' } })).status, 200);
  assert.equal((await call('auth/mfa/remove', { method: 'POST', aal: 'aal2', body: { factorId: 'someone-else' } })).status, 404);
  assert.equal((await call('auth/mfa/remove', { method: 'POST', aal: 'aal2', body: { factorId: id } })).status, 200);
  factors = []; role = 'Staff';
  assert.equal((await call('auth/mfa/enroll', { method: 'POST' })).status, 403);
});
