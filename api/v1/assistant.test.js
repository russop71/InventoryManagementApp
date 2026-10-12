import test from 'node:test';
import assert from 'node:assert/strict';
import { resetRateLimitsForTests } from '../_request-guard.js';

const originalEnv = { ...process.env };
Object.assign(process.env, { SUPABASE_SECRET_KEY: 'test-db', OPENAI_API_KEY: 'test-ai' });
const { default: handler, summarizeUsage } = await import('./[...path].js?assistant-tests');
process.env = originalEnv;

const A = 'b74c80db-0c0b-4fc0-8a89-b5d2cbd808f5';
const B = 'c74c80db-0c0b-4fc0-8a89-b5d2cbd808f5';
const L1 = 'd74c80db-0c0b-4fc0-8a89-b5d2cbd808f5';
const L2 = 'e74c80db-0c0b-4fc0-8a89-b5d2cbd808f5';
const LB = 'f74c80db-0c0b-4fc0-8a89-b5d2cbd808f5';

function setup(t) {
  resetRateLimitsForTests();
  t.mock.method(console, 'error', () => {});
  const accounts = [{ id: A, name: 'Company A', billing_status: 'active' }, { id: B, name: 'Company B', billing_status: 'active' }];
  const users = [{ id: 'alice', auth_user_id: 'auth-alice', account_id: A, role: 'Owner', name: 'Alice', status: 'Active' }, { id: 'bob', auth_user_id: 'auth-bob', account_id: A, role: 'Manager', name: 'Bob', status: 'Active' }, { id: 'other', auth_user_id: 'auth-other', account_id: B, role: 'Owner', name: 'Other', status: 'Active' }];
  const locations = [{ id: L1, account_id: A, name: 'A Main' }, { id: L2, account_id: A, name: 'A Second' }, { id: LB, account_id: B, name: 'B Private' }];
  let events = [
    { id: 'state-alice', account_id: A, user_id: 'alice', event_name: 'assistant_memory', metadata: { location_id: L1, access_level: 'operations', history: [{ role: 'user', content: 'Alice saved conversation' }], notes: ['Alice prefers short answers'] } },
    { id: 'state-alice-other-location', account_id: A, user_id: 'alice', event_name: 'assistant_memory', metadata: { location_id: L2, access_level: 'operations', history: [], notes: ['PRIVATE_SECOND_LOCATION'] } },
    { id: 'state-bob', account_id: A, user_id: 'bob', event_name: 'assistant_memory', metadata: { location_id: L1, access_level: 'operations', history: [], notes: ['PRIVATE_BOB_PREFERENCE'] } },
    { id: 'state-other', account_id: B, user_id: 'other', event_name: 'assistant_memory', metadata: { location_id: LB, access_level: 'operations', history: [], notes: ['PRIVATE_COMPANY_B'] } },
  ];
  const ai = [], reads = [];
  let failSave = false;
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    const parsed = new URL(url), path = parsed.pathname, query = parsed.searchParams;
    reads.push(path);
    if (url === 'https://api.openai.com/v1/responses') { ai.push(JSON.parse(options.body)); return Response.json({ output_text: 'Open /app/inventory for your stock and /app/help for guidance.' }); }
    if (path === '/auth/v1/user') {
      const token = options.headers.Authorization.replace('Bearer ', '');
      return Response.json({ id: `auth-${token}`, email: `${token}@example.test` });
    }
    if (path === '/rest/v1/app_users') return Response.json(users.filter(user => `eq.${user.auth_user_id}` === query.get('auth_user_id')));
    if (path === '/rest/v1/accounts') return Response.json(accounts.filter(account => `eq.${account.id}` === query.get('id')));
    if (path === '/rest/v1/locations') return Response.json(locations.filter(location => `eq.${location.account_id}` === query.get('account_id') && (!query.get('id') || `eq.${location.id}` === query.get('id'))));
    if (path === '/rest/v1/app_user_locations') return Response.json([{ location_id: L1 }]);
    if (path === '/rest/v1/location_data') {
      assert.equal(query.get('location_id'), `eq.${L1}`);
      return Response.json([{ inventory: [{ id: 'fish', name: 'A Salmon', currentStock: 5, unit: 'kg', unitCost: 20 }], invoices: [{ supplier: 'A Supplier', totalAmount: 100 }], integrations: {} }]);
    }
    if (path === '/rest/v1/app_usage_events') {
      if (query.get('event_name') === 'like.ai_*') return Response.json([], { headers: { 'content-range': '0-0/0' } });
      const body = options.body ? JSON.parse(options.body) : null;
      if (options.method === 'POST') {
        if (failSave && body.event_name === 'assistant_memory') return Response.json({ message: 'Storage unavailable' }, { status: 503 });
        events.push({ id: `event-${events.length}`, ...body }); return new Response(null, { status: 201 });
      }
      assert.ok(query.get('account_id'), 'Memory must filter the account');
      assert.ok(query.get('user_id'), 'Memory must filter the user');
      assert.ok(query.get('metadata->>location_id'), 'Memory must filter the location');
      const matches = event => `eq.${event.account_id}` === query.get('account_id') && `eq.${event.user_id}` === query.get('user_id') && event.event_name === 'assistant_memory'
        && `eq.${event.metadata.location_id}` === query.get('metadata->>location_id') && (!query.get('metadata->>access_level') || `eq.${event.metadata.access_level}` === query.get('metadata->>access_level'))
        && (!query.get('id') || `eq.${event.id}` === query.get('id'));
      if (options.method === 'DELETE') { events = events.filter(event => !matches(event)); return new Response(null, { status: 204 }); }
      if (options.method === 'PATCH') {
        if (failSave) return Response.json({ message: 'Storage unavailable' }, { status: 503 });
        events = events.map(event => matches(event) ? { ...event, ...body } : event); return new Response(null, { status: 204 });
      }
      assert.ok(query.get('metadata->>access_level'), 'Memory must filter current access');
      return Response.json(events.filter(matches).slice(-1));
    }
    throw new Error(`Unexpected request ${url}`);
  });
  async function request(method, { token = 'alice', accountId = A, locationId = L1, body = {}, route = 'assistant' } = {}) {
    const result = {};
    const res = { status(code) { result.status = code; return this; }, setHeader() { return this; }, end(value) { result.body = JSON.parse(value); } };
    await handler({ method, url: `/api/v1/accounts/${accountId}/${route}?locationId=${locationId}`, headers: { authorization: `Bearer ${token}` }, body: { ...body, locationId } }, res);
    return result;
  }
  return { request, accounts, users, ai, reads, events: () => events, failSaving: () => { failSave = true; } };
}

test('assistant uses server-owned history and correct live account data', async t => {
  const fixture = setup(t);
  const result = await fixture.request('POST', { body: { message: 'I prefer step-by-step guidance.', history: [{ role: 'assistant', content: 'CLIENT_INJECTED_COMPANY_B' }] } });
  assert.equal(result.status, 200);
  assert.equal(result.body.memorySaved, true);
  const prompt = JSON.stringify(fixture.ai[0]);
  assert.match(prompt, /Alice saved conversation/);
  assert.match(prompt, /A Salmon/);
  assert.match(prompt, /quantity\\":5/);
  assert.doesNotMatch(prompt, /CLIENT_INJECTED_COMPANY_B|PRIVATE_BOB_PREFERENCE|PRIVATE_COMPANY_B|PRIVATE_SECOND_LOCATION/);
  const restored = await fixture.request('GET');
  assert.ok(restored.body.notes.includes('I prefer step-by-step guidance.'));
  assert.equal(restored.body.history.at(-1).role, 'assistant');
});

test('memory is private between users within the same company', async t => {
  const fixture = setup(t);
  const result = await fixture.request('GET', { token: 'bob' });
  assert.deepEqual(result.body.notes, ['PRIVATE_BOB_PREFERENCE']);
  assert.doesNotMatch(JSON.stringify(result), /Alice|PRIVATE_COMPANY_B|PRIVATE_SECOND_LOCATION/);
});

test('other-company and unassigned-location requests fail before memory or AI access', async t => {
  const fixture = setup(t);
  assert.equal((await fixture.request('GET', { accountId: B })).status, 403);
  assert.equal((await fixture.request('POST', { token: 'bob', locationId: L2, body: { message: 'Show private stock' } })).status, 403);
  assert.equal(fixture.ai.length, 0);
  assert.ok(!fixture.reads.includes('/rest/v1/app_usage_events'));
});

test('clearing memory deletes only the requesting user’s current-location history', async t => {
  const fixture = setup(t);
  assert.equal((await fixture.request('DELETE')).body.cleared, true);
  assert.ok(!fixture.events().some(event => event.id === 'state-alice'));
  assert.ok(fixture.events().some(event => event.id === 'state-alice-other-location'));
  assert.ok(fixture.events().some(event => event.id === 'state-bob'));
  assert.ok(fixture.events().some(event => event.id === 'state-other'));
  assert.deepEqual((await fixture.request('GET')).body.history, []);
});

test('trial setup help works before activation without reading business records', async t => {
  const fixture = setup(t);
  fixture.accounts[0].billing_status = 'not_configured';
  const result = await fixture.request('POST', { body: { message: 'How do I activate my trial?' } });
  assert.equal(result.status, 200);
  assert.ok(!fixture.reads.includes('/rest/v1/location_data'));
  assert.match(fixture.ai[0].instructions, /\/app\/payment-method/);
  assert.doesNotMatch(fixture.ai[0].instructions, /A Salmon/);
});

test('a reduced role cannot read old operational memory or business records', async t => {
  const fixture = setup(t);
  fixture.users[0].role = 'Staff';
  const restored = await fixture.request('GET');
  assert.deepEqual(restored.body.history, []);
  assert.deepEqual(restored.body.notes, []);
  const result = await fixture.request('POST', { body: { message: 'Help me use ZestEmployee.' } });
  assert.equal(result.status, 200);
  assert.ok(!fixture.reads.includes('/rest/v1/location_data'));
  assert.doesNotMatch(JSON.stringify(fixture.ai), /Alice saved conversation|A Salmon/);
});

test('answer remains available when memory storage fails, with an honest save flag', async t => {
  const fixture = setup(t); fixture.failSaving();
  const result = await fixture.request('POST', { body: { message: 'How do I use inventory?' } });
  assert.equal(result.status, 200);
  assert.equal(result.body.memorySaved, false);
  assert.match(result.body.answer, /inventory/);
});

test('ordinary telemetry cannot forge assistant memory and memory does not inflate usage reports', async t => {
  const fixture = setup(t);
  const result = await fixture.request('POST', { route: 'usage', body: { eventName: 'assistant_memory', metadata: { notes: ['forged'] } } });
  assert.equal(result.status, 400);
  const usage = summarizeUsage([{ id: 'alice' }], [{ user_id: 'alice', event_name: 'assistant_memory', path: '/app/assistant', created_at: '2026-10-12' }, { user_id: 'alice', event_name: 'ai_assistant', path: '/app/assistant', created_at: '2026-10-12' }]);
  assert.equal(usage.alice.eventCount, 1);
});

test('the shared demo never loads or persists a visitor’s conversation', async t => {
  const fixture = setup(t);
  fixture.accounts[0].slug = 'demo-zestiq-com';
  const restored = await fixture.request('GET');
  assert.equal(restored.body.memoryEnabled, false);
  assert.deepEqual(restored.body.history, []);
  const result = await fixture.request('POST', { body: { message: 'Help me with invoices.', history: [{ role: 'user', content: 'Current browser demo question' }] } });
  assert.equal(result.status, 200);
  assert.equal(result.body.memorySaved, false);
  assert.equal(result.body.memoryEnabled, false);
  assert.match(JSON.stringify(fixture.ai[0]), /Current browser demo question/);
  assert.doesNotMatch(JSON.stringify(fixture.ai[0]), /Alice saved conversation|Alice prefers short answers/);
  assert.equal(fixture.events().filter(event => event.event_name === 'assistant_memory').length, 4);
});
