import test from 'node:test';
import assert from 'node:assert/strict';

test('weekly emails contain only each account and recipient’s authorized locations', async t => {
  const originalEnv = { ...process.env };
  Object.assign(process.env, { SUPABASE_SECRET_KEY: 'test-db-key', CRON_SECRET: 'test-cron', RESEND_API_KEY: 'test-email-key' });
  const { default: handler } = await import('./weekly-manager-digest.js?scoped-test');
  t.after(() => { process.env = originalEnv; });
  const now = new Date().toISOString();
  const accounts = [{ id: 'a', name: 'Company A', onboarding_state: { clientProfile: { foodCostTarget: '30' } } }, { id: 'b', name: 'Company B' }];
  const locations = [{ id: 'a1', account_id: 'a', name: 'A One' }, { id: 'a2', account_id: 'a', name: 'A Two' }, { id: 'b1', account_id: 'b', name: 'B Secret' }];
  const users = [{ id: 'manager-a', account_id: 'a', name: 'Manager A', email: 'manager@a.example', role: 'Manager', status: 'Active' }, { id: 'owner-a', account_id: 'a', name: 'Owner A', email: 'owner@a.example', role: 'Owner', status: 'Active' }, { id: 'owner-b', account_id: 'b', name: 'Owner B', email: 'owner@b.example', role: 'Owner', status: 'Active' }];
  const assignments = [{ user_id: 'manager-a', account_id: 'a', location_id: 'a1' }, { user_id: 'manager-a', account_id: 'b', location_id: 'a2' }];
  const rows = locations.map(location => ({ location_id: location.id, inventory: [], invoices: [{ createdAt: now, date: now.slice(0, 10), supplier: `Supplier ${location.id}`, invoiceNumber: location.id, status: 'received' }], orders: [], recipes: [] }));
  const sent = [];
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    const parsed = new URL(url);
    if (url === 'https://api.resend.com/emails') { sent.push(JSON.parse(options.body)); return Response.json({ id: 'email-id' }); }
    const resource = parsed.pathname.split('/').at(-1);
    const values = { accounts, locations, location_data: rows, app_users: users, app_user_locations: assignments, app_usage_events: [] };
    if (options.method === 'POST' && resource === 'app_usage_events') return new Response(null, { status: 201 });
    assert.ok(resource in values, `Unexpected request ${url}`);
    return Response.json(values[resource]);
  });
  let result;
  const res = { status(code) { assert.equal(code, 200); return this; }, json(value) { result = value; } };
  await handler({ method: 'GET', headers: { authorization: 'Bearer test-cron' } }, res);
  assert.equal(result.ok, true);
  assert.equal(sent.length, 3);
  const manager = sent.find(email => email.to[0] === 'manager@a.example');
  assert.match(manager.html, /A One/);
  assert.doesNotMatch(manager.html, /A Two|B Secret|Company B|Supplier b1/);
  const owner = sent.find(email => email.to[0] === 'owner@a.example');
  assert.match(owner.html, /A One/);
  assert.match(owner.html, /A Two/);
  assert.doesNotMatch(owner.html, /B Secret|Company B/);
  const other = sent.find(email => email.to[0] === 'owner@b.example');
  assert.match(other.html, /B Secret/);
  assert.doesNotMatch(other.html, /A One|A Two|Company A/);
});
