import test from 'node:test';
import assert from 'node:assert/strict';
import { checkoutAlert, sendCheckoutAlert, sendCustomerEmail, sendRegistrationEmails, signupAlert, welcomeEmail } from './_customer-emails.js';
import legacyWelcomeHandler from './send-welcome-email.js';

const details = { userId: 'new-user', name: 'Chef <Joe>', email: 'joe@example.com', account: { id: 'new-account', name: 'Joe’s Kitchen' } };

function configured(t) {
  const original = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = 'test-key';
  t.after(() => {
    if (original === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = original;
  });
}

test('registration sends a welcome to the customer and a separate alert to Pat', async t => {
  configured(t);
  const emails = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails');
    emails.push({ ...JSON.parse(options.body), key: options.headers['Idempotency-Key'] });
    return Response.json({ id: 'email-id' });
  });
  const result = await sendRegistrationEmails(details);
  assert.deepEqual(result, { welcomeEmailSent: true, signupAlertSent: true });
  assert.deepEqual(emails[0].to, ['joe@example.com']);
  assert.equal(emails[0].reply_to, 'pat@zestiq.ca');
  assert.equal(emails[0].key, 'welcome/new-user');
  assert.deepEqual(emails[1].to, ['pat@zestiq.ca']);
  assert.equal(emails[1].reply_to, 'joe@example.com');
  assert.equal(emails[1].key, 'signup-alert/new-user');
  assert.match(emails[1].text, /Joe’s Kitchen/);
});

test('notification input cannot inject HTML or subject line breaks', () => {
  const welcome = welcomeEmail({ name: '<script>alert(1)</script>', email: 'customer@example.com' });
  assert.doesNotMatch(welcome.html, /<script>/);
  assert.match(welcome.html, /&lt;script&gt;/);
  assert.doesNotMatch(signupAlert({ ...details, account: { id: 'a', name: 'Company\r\nBcc: stranger@example.com' } }).subject, /[\r\n]/);
});

test('transient email errors retry with the same payload and idempotency key', async t => {
  configured(t);
  const requests = [];
  const result = await sendCustomerEmail(welcomeEmail(details), 'welcome/new-user', async (_url, options) => {
    requests.push(options);
    return requests.length === 1 ? Response.json({ message: 'Temporarily unavailable' }, { status: 503 }) : Response.json({ id: 'retry-email' });
  });
  assert.equal(result.sent, true);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].body, requests[1].body);
  assert.equal(requests[0].headers['Idempotency-Key'], requests[1].headers['Idempotency-Key']);
});

test('welcome delivery is independent of an owner-alert failure', async t => {
  configured(t);
  t.mock.method(console, 'error', () => {});
  t.mock.method(globalThis, 'fetch', async (_url, options) => JSON.parse(options.body).to[0] === 'joe@example.com'
    ? Response.json({ id: 'welcome-ok' }) : Response.json({ message: 'Invalid recipient' }, { status: 422 }));
  assert.deepEqual(await sendRegistrationEmails(details), { welcomeEmailSent: true, signupAlertSent: false });
});

test('unpaid and canceled Stripe checkouts do not send successful checkout alerts', async t => {
  t.mock.method(globalThis, 'fetch', () => { throw new Error('Should not send'); });
  assert.deepEqual(await sendCheckoutAlert({ id: 'cs_unpaid', payment_status: 'unpaid' }, { status: 'active' }), { sent: false });
  assert.deepEqual(await sendCheckoutAlert({ id: 'cs_old', payment_status: 'paid' }, { status: 'canceled' }), { sent: false });
});

test('checkout alerts distinguish free trial activation from paid charges', () => {
  const session = { id: 'cs_trial', customer: 'cus_customer', client_reference_id: 'company', payment_status: 'no_payment_required', customer_details: { name: 'Customer', email: 'customer@example.com' }, metadata: { location_count: '2', scheduling_enabled: 'true' } };
  const alert = checkoutAlert(session, { id: 'sub_trial' });
  assert.deepEqual(alert.to, ['pat@zestiq.ca']);
  assert.equal(alert.reply_to, 'customer@example.com');
  assert.match(alert.text, /no_payment_required/);
  assert.match(alert.text, /does not mean a paid charge occurred/);
  assert.match(alert.text, /Locations: 2/);
});

test('cached clients cannot cause a duplicate welcome email', async t => {
  t.mock.method(globalThis, 'fetch', () => { throw new Error('Should not send'); });
  let payload;
  const res = { status(code) { assert.equal(code, 200); return this; }, json(body) { payload = body; } };
  await legacyWelcomeHandler({ method: 'POST', body: { email: 'joe@example.com' } }, res);
  assert.equal(payload.handledByRegistration, true);
});
