import test from 'node:test';
import assert from 'node:assert/strict';
import { applyCheckoutPolicy, checkoutReady, paidCommitment, subscriptionBillingPatch, SUBSCRIPTION_AGREEMENT_VERSION } from './_subscription-policy.js';
import { hasActiveSubscription } from './_launch-controls.js';

const timestamp = value => Date.parse(value) / 1000;
const subscription = {
  id: 'sub_test', customer: 'cus_test', status: 'trialing',
  start_date: timestamp('2026-09-19T12:00:00Z'),
  trial_end: timestamp('2026-10-19T12:00:00Z'),
  metadata: { account_id: 'account_test', plan: 'monthly', agreement_version: SUBSCRIPTION_AGREEMENT_VERSION },
  items: { data: [{ price: { id: 'price_base' }, current_period_end: timestamp('2026-10-19T12:00:00Z') }] },
};

test('checkout requires payment details, a 30-day trial, automatic tax and acceptance', () => {
  const form = applyCheckoutPolicy({ mode: 'subscription', customer_email: 'test@example.test', 'line_items[0][price]': 'price_base' });
  assert.equal(form['subscription_data[trial_period_days]'], '30');
  assert.equal(form.payment_method_collection, 'always');
  assert.equal(form['payment_method_types[0]'], 'card');
  assert.equal(form['automatic_tax[enabled]'], 'true');
  assert.equal(form['managed_payments[enabled]'], 'false');
  assert.equal(form.billing_address_collection, 'required');
  assert.equal(form['consent_collection[terms_of_service]'], 'required');
  assert.equal(form['customer_update[address]'], undefined);
  assert.equal(form['line_items[0][price]'], 'price_base');
  assert.match(form['custom_text[submit][message]'], /hello@zestiq.ca/);
  assert.doesNotMatch(form['custom_text[submit][message]'], /90 days/);
  assert.equal(applyCheckoutPolicy({ customer: 'cus_test' })['customer_update[address]'], 'auto');
});

test('checkout cannot become available with just a live key and prices', () => {
  const env = { STRIPE_SECRET_KEY: 'test', STRIPE_PRICE_MONTHLY: 'price_test' };
  assert.equal(checkoutReady(env), false);
  env.STRIPE_WEBHOOK_SECRET = 'webhook_test';
  assert.equal(checkoutReady(env), false);
  env.STRIPE_BILLING_PORTAL_CONFIGURATION_ID = 'portal_test';
  assert.equal(checkoutReady(env), true);
});

test('paid year starts after the trial, does not roll forward with invoices, and clamps leap day', () => {
  assert.deepEqual(paidCommitment(subscription), {
    commitment_started_at: '2026-10-19T12:00:00.000Z',
    commitment_ends_at: '2027-10-19T12:00:00.000Z',
  });
  assert.deepEqual(paidCommitment({ ...subscription, current_period_end: timestamp('2028-04-19T12:00:00Z') }), paidCommitment(subscription));
  assert.equal(paidCommitment({ trial_end: timestamp('2028-02-29T12:00:00Z') }).commitment_ends_at, '2029-02-28T12:00:00.000Z');
  assert.throws(() => paidCommitment({}), /missing/);
});

test('billing patch preserves trial status and supports item-level billing dates', () => {
  const patch = subscriptionBillingPatch(subscription, 'price_extra');
  assert.equal(patch.billing_status, 'trialing');
  assert.equal(patch.current_period_end, '2026-10-19T12:00:00.000Z');
  assert.equal(patch.commitment_ends_at, '2027-10-19T12:00:00.000Z');
  assert.equal(patch.non_renewal_requested_at, undefined);
  const older = subscriptionBillingPatch({ ...subscription, metadata: {} }, 'price_extra');
  assert.equal(older.commitment_started_at, undefined);
  assert.equal(older.billing_plan, undefined);
});

test('only a verified unexpired trial grants product access', () => {
  const account = { billing_status: 'trialing', stripe_subscription_id: 'sub_test', trial_ends_at: new Date(Date.now() + 60000).toISOString() };
  assert.equal(hasActiveSubscription(account), true);
  assert.equal(hasActiveSubscription({ ...account, trial_ends_at: '2020-01-01' }), false);
  assert.equal(hasActiveSubscription({ ...account, trial_ends_at: null }), false);
  assert.equal(hasActiveSubscription({ ...account, stripe_subscription_id: null }), false);
  assert.equal(hasActiveSubscription({ ...account, billing_status: 'canceled' }), false);
});
