import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createHmac } from 'node:crypto';

test('verified checkout and invoice events use current Stripe subscription state', async t => {
  const original = { ...process.env };
  Object.assign(process.env, { SUPABASE_SECRET_KEY: 'test_db', STRIPE_SECRET_KEY: 'test_key', STRIPE_WEBHOOK_SECRET: 'test_webhook' });
  const { default: handler } = await import(`./stripe-webhook.js?lifecycle=${Date.now()}`);
  const previousFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = previousFetch; process.env = original; });
  const patches = [];
  const audits = [];
  let state = 'trialing';
  globalThis.fetch = async (url, options = {}) => {
    if (String(url).startsWith('https://api.stripe.com/v1/subscriptions/')) {
      return Response.json({ id: 'sub_test', customer: 'cus_test', status: state,
        trial_end: 1792411200, start_date: 1789819200,
        metadata: { account_id: 'account_test', plan: 'monthly', agreement_version: '2026-09-19' }, items: { data: [] } });
    }
    if (String(url).includes('/accounts?') && options.method === 'PATCH') {
      patches.push(JSON.parse(options.body)); return new Response(null, { status: 204 });
    }
    if (String(url).endsWith('/subscription_agreements')) {
      audits.push(JSON.parse(options.body)); return new Response(null, { status: 201 });
    }
    throw new Error(`Unexpected request: ${url}`);
  };
  async function send(type, object) {
    const body = Buffer.from(JSON.stringify({ type, data: { object } }));
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = createHmac('sha256', 'test_webhook').update(`${timestamp}.${body}`).digest('hex');
    const req = Readable.from([body]);
    req.method = 'POST'; req.headers = { 'stripe-signature': `t=${timestamp},v1=${signature}` };
    const res = { code: null, status(code) { this.code = code; return this; }, setHeader() { return this; }, end() {} };
    await handler(req, res);
    assert.equal(res.code, 200);
    return patches.at(-1);
  }
  const checkout = { id: 'cs_test', created: 1789819200, customer: 'cus_test', subscription: 'sub_test', client_reference_id: 'account_test', payment_status: 'no_payment_required', metadata: { plan: 'monthly', agreement_version: '2026-09-19' }, consent: { terms_of_service: 'accepted' } };
  assert.equal((await send('checkout.session.completed', checkout)).billing_status, 'trialing');
  assert.equal(audits[0].customer_accepted, true);
  assert.equal(patches[0].commitment_started_at, new Date(1792411200 * 1000).toISOString());
  const invoice = { amount_paid: 0, parent: { subscription_details: { subscription: 'sub_test' } } };
  assert.equal((await send('invoice.payment_succeeded', invoice)).billing_status, 'trialing');
  state = 'active';
  assert.equal((await send('invoice.payment_succeeded', invoice)).billing_status, 'active');
  state = 'canceled';
  assert.equal((await send('customer.subscription.deleted', { id: 'sub_test' })).billing_status, 'canceled');
  assert.equal((await send('invoice.payment_succeeded', invoice)).billing_status, 'canceled');
  assert.equal((await send('checkout.session.completed', checkout)).billing_status, 'canceled');
});
