import test from 'node:test';
import assert from 'node:assert/strict';
import handler, { normalizeDemoRequest } from './send-demo-request.js';
import { resetRateLimitsForTests } from './_request-guard.js';

function responseMock() {
  return {
    headers: {}, statusCode: 200, payload: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
}

const validBody = {
  firstName: 'Pat', lastName: 'Russo', email: 'pat@example.com', phone: '416-555-0100',
  restaurant: 'Example Restaurant', role: 'Owner / CEO', pos: 'Toast', venues: '1 venue', goal: 'Improve food cost.',
};

test('normalizes and bounds public demo-request input', () => {
  const request = normalizeDemoRequest({ ...validBody, email: ' PAT@EXAMPLE.COM ', restaurant: ` ${'x'.repeat(300)} ` });
  assert.equal(request.email, 'pat@example.com');
  assert.equal(request.restaurant.length, 180);
});

async function withBackend(run, { storageFails = false, emailFails = false, missingEmailKey = false, patchFails = false } = {}) {
  resetRateLimitsForTests();
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-database-key';
  delete process.env.SUPABASE_SECRET_KEY;
  process.env.RESEND_API_KEY = 'test-email-key';
  delete process.env.DEMO_REQUEST_TO;
  if (missingEmailKey) {
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_TOKEN;
    delete process.env.RESEND_KEY;
  }
  const calls = [];
  global.fetch = async (url, options) => {
    const body = JSON.parse(options.body);
    calls.push({ url, method: options.method, body });
    if (url.includes('/rest/v1/demo_requests')) {
      return { ok: options.method === 'POST' ? !storageFails : !patchFails, status: 503 };
    }
    if (url === 'https://api.resend.com/emails') {
      return { ok: !emailFails, status: emailFails ? 503 : 200, json: async () => ({ id: 'email-1' }) };
    }
    return { ok: true, json: async () => ({}) };
  };
  try { await run(calls); }
  finally { global.fetch = originalFetch; process.env = originalEnv; }
}

function submit(body = validBody) {
  const res = responseMock();
  return handler({ method: 'POST', body, headers: {}, socket: { remoteAddress: 'test-ip' } }, res).then(() => res);
}

test('saves the lead before notifying Pat and records provider acceptance', async () => {
  await withBackend(async calls => {
    const res = await submit();
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.payload, { received: true, sent: true });
    assert.equal(calls[0].method, 'POST');
    assert.match(calls[0].url, /rest\/v1\/demo_requests$/);
    assert.equal(calls[0].body.first_name, 'Pat');
    assert.equal(calls[0].body.email, validBody.email);
    assert.equal(calls[0].body.website, undefined);
    assert.deepEqual(calls[1].body.to, ['Pat@zestiq.ca']);
    assert.equal(calls[1].body.reply_to, validBody.email);
    assert.equal(calls[2].method, 'PATCH');
    assert.match(calls[2].url, new RegExp(calls[0].body.id));
    assert.equal(calls[2].body.notification_status, 'accepted');
    assert.equal(calls[2].body.notification_provider_id, 'email-1');
  });
});

test('keeps the inquiry and records failure when the email provider fails', async () => {
  await withBackend(async calls => {
    const res = await submit();
    assert.deepEqual(res.payload, { received: true, sent: false });
    assert.equal(calls[2].body.notification_status, 'failed');
    assert.match(calls[2].body.notification_error, /503/);
  }, { emailFails: true });
});

test('saves inquiries even when no email key is configured', async () => {
  await withBackend(async calls => {
    const res = await submit();
    assert.deepEqual(res.payload, { received: true, sent: false });
    assert.equal(calls[1].body.notification_status, 'failed');
    assert.equal(calls.some(call => call.url === 'https://api.resend.com/emails'), false);
  }, { missingEmailKey: true });
});

test('does not send email or claim receipt if storage fails', async () => {
  await withBackend(async calls => {
    const res = await submit();
    assert.equal(res.statusCode, 503);
    assert.match(res.payload.error, /could not save/);
    assert.equal(calls.some(call => call.url === 'https://api.resend.com/emails'), false);
  }, { storageFails: true });
});

test('a notification-status write failure does not lose a saved inquiry', async () => {
  await withBackend(async () => {
    const res = await submit();
    assert.deepEqual(res.payload, { received: true, sent: true });
  }, { patchFails: true });
});

test('accepts essential contact fields and honours a configured notification inbox', async () => {
  await withBackend(async calls => {
    process.env.DEMO_REQUEST_TO = 'owner@example.com';
    const res = await submit({ firstName: 'Pat', email: 'pat@example.com', restaurant: 'Example Restaurant' });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(calls[1].body.to, ['owner@example.com']);
  });
});

test('accepts the honeypot silently without sending email', async () => {
  resetRateLimitsForTests();
  const originalFetch = global.fetch;
  let called = false;
  global.fetch = async () => { called = true; };
  try {
    const res = responseMock();
    await handler({ method: 'POST', body: { ...validBody, website: 'spam.example' }, headers: {}, socket: { remoteAddress: 'bot-ip' } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(called, false);
  } finally {
    global.fetch = originalFetch;
  }
});

test('rejects incomplete requests before calling the provider', async () => {
  resetRateLimitsForTests();
  const res = responseMock();
  await handler({ method: 'POST', body: { email: 'pat@example.com' }, headers: {}, socket: { remoteAddress: 'missing-ip' } }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.payload.error, /required field/);
});
