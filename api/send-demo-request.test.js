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

test('sends a valid demo request to the configured inbox', async () => {
  resetRateLimitsForTests();
  const originalFetch = global.fetch;
  const originalKey = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = 'test-key';
  let sentPayload;
  global.fetch = async (_url, options) => {
    sentPayload = JSON.parse(options.body);
    return { ok: true, json: async () => ({ id: 'email-1' }) };
  };
  try {
    const res = responseMock();
    await handler({ method: 'POST', body: validBody, headers: {}, socket: { remoteAddress: 'test-ip' } }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.payload, { sent: true });
    assert.deepEqual(sentPayload.to, ['demo@zestiq.ca']);
    assert.equal(sentPayload.reply_to, 'pat@example.com');
    assert.match(sentPayload.subject, /Example Restaurant/);
  } finally {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalKey;
  }
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
