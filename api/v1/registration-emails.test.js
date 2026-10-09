import test from 'node:test';
import assert from 'node:assert/strict';
import { resetRateLimitsForTests } from '../_request-guard.js';

const previousKey = process.env.SUPABASE_SECRET_KEY;
process.env.SUPABASE_SECRET_KEY = 'registration-test-key';
const { default: handler } = await import('./[...path].js?registration-emails-test');
if (previousKey === undefined) delete process.env.SUPABASE_SECRET_KEY;
else process.env.SUPABASE_SECRET_KEY = previousKey;

async function register(t, { duplicate = false, emailFailure = false } = {}) {
  resetRateLimitsForTests();
  const originalEmailKey = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = 'email-test-key';
  t.after(() => {
    if (originalEmailKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalEmailKey;
  });
  t.mock.method(console, 'error', () => {});
  const account = { id: 'b74c80db-0c0b-4fc0-8a89-b5d2cbd808f5', name: 'Customer Restaurant' };
  const authUser = { id: 'auth-user', email: 'customer@example.com' };
  const user = { id: 'app-user', account_id: account.id, auth_user_id: authUser.id, role: 'Owner', status: 'Active', email: authUser.email, name: 'Customer' };
  const emails = [];
  const operations = [];
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    const path = new URL(url).pathname;
    operations.push(path);
    if (url === 'https://api.resend.com/emails') {
      emails.push(JSON.parse(options.body));
      return emailFailure ? Response.json({ message: 'Invalid sender' }, { status: 422 }) : Response.json({ id: 'email-id' });
    }
    if (path === '/auth/v1/admin/users') return Response.json(authUser);
    if (path === '/auth/v1/token') return Response.json({ user: authUser, access_token: 'token', refresh_token: 'refresh' });
    if (path === '/rest/v1/accounts') return Response.json([account]);
    if (path === '/rest/v1/locations') return Response.json([{ id: 'main-location', account_id: account.id, name: 'Main Location' }]);
    if (path === '/rest/v1/location_data') return new Response(null, { status: 201 });
    if (path === '/rest/v1/app_users') {
      if (options.method === 'POST') return new Response(null, { status: 201 });
      if (new URL(url).searchParams.get('select') === 'id') return Response.json(duplicate ? [{ id: user.id }] : []);
      return Response.json([user]);
    }
    throw new Error(`Unexpected request ${url}`);
  });
  const result = {};
  const res = { status(code) { result.status = code; return this; }, setHeader() { return this; }, end(body) { result.body = JSON.parse(body); } };
  await handler({ method: 'POST', url: '/api/v1/auth/register', headers: {}, body: { name: 'Customer', companyName: account.name, email: authUser.email, password: 'private-password-123' } }, res);
  return { ...result, emails, operations };
}

test('real registration handler sends both emails after creating the owner account', async t => {
  const result = await register(t);
  assert.equal(result.status, 201);
  assert.equal(result.emails.length, 2);
  assert.equal(result.body.welcomeEmailSent, true);
  assert.equal(result.body.signupAlertSent, true);
  assert.deepEqual(result.emails[1].to, ['pat@zestiq.ca']);
  assert.doesNotMatch(JSON.stringify(result.emails), /private-password/);
  assert.ok(result.operations.indexOf('/rest/v1/app_users') < result.operations.indexOf('/emails'));
});

test('duplicate registration does not send welcome or owner alerts', async t => {
  const result = await register(t, { duplicate: true });
  assert.equal(result.status, 409);
  assert.equal(result.emails.length, 0);
});

test('email provider failure does not delete or reject a successfully created account', async t => {
  const result = await register(t, { emailFailure: true });
  assert.equal(result.status, 201);
  assert.equal(result.body.welcomeEmailSent, false);
  assert.equal(result.body.signupAlertSent, false);
  assert.equal(result.body.token, 'token');
});
