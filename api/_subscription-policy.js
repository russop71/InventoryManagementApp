export const SUBSCRIPTION_AGREEMENT_VERSION = '2026-09-19';
export const COMMITMENT_TERMS = '30-day free trial; separate 12-month paid commitment billed monthly; then month-to-month; cancellation by email';
export const CHECKOUT_DISCLOSURE = 'Payment details are required. No subscription fee during your 30-day trial. Email hello@zestiq.ca before the trial ends to cancel without charge or commitment. Otherwise, your first monthly payment plus applicable tax starts a separate 12-month paid commitment. After that, billing continues month-to-month with 30 days’ cancellation notice by email. Another annual term requires your express agreement.';

export function checkoutReady(env = process.env) {
  return Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_PRICE_MONTHLY
    && env.STRIPE_WEBHOOK_SECRET && env.STRIPE_BILLING_PORTAL_CONFIGURATION_ID);
}

// Apply once, after line items and the customer have been selected. Both owner
// checkout and platform-created checkout links must use the same policy.
export function applyCheckoutPolicy(form) {
  return {
    ...form,
    // ZestIQ is the merchant; Managed Payments rejects our trial disclosure.
    'managed_payments[enabled]': 'false',
    'automatic_tax[enabled]': 'true',
    billing_address_collection: 'required',
    payment_method_collection: 'always',
    'payment_method_types[0]': 'card',
    'subscription_data[trial_period_days]': '30',
    'subscription_data[trial_settings][end_behavior][missing_payment_method]': 'cancel',
    'metadata[agreement_version]': SUBSCRIPTION_AGREEMENT_VERSION,
    'metadata[commitment_terms]': COMMITMENT_TERMS,
    'subscription_data[metadata][agreement_version]': SUBSCRIPTION_AGREEMENT_VERSION,
    'subscription_data[metadata][commitment_terms]': COMMITMENT_TERMS,
    'consent_collection[terms_of_service]': 'required',
    'custom_text[submit][message]': CHECKOUT_DISCLOSURE,
    ...(form.customer ? { 'customer_update[address]': 'auto' } : {}),
  };
}

export function unixDate(value) {
  return Number(value) > 0 ? new Date(Number(value) * 1000).toISOString() : null;
}

export function paidCommitment(subscription) {
  // The trial is separate from the paid year. Do not restart the commitment
  // at every monthly invoice, or turn a renewal into another annual term.
  const start = unixDate(subscription.trial_end || subscription.start_date || subscription.created);
  if (!start) throw new Error('Subscription start date is missing');
  const end = new Date(start);
  const month = end.getUTCMonth();
  end.setUTCFullYear(end.getUTCFullYear() + 1);
  if (end.getUTCMonth() !== month) end.setUTCDate(0); // February 29 -> February 28
  return { commitment_started_at: start, commitment_ends_at: end.toISOString() };
}

export function subscriptionBillingPatch(subscription, additionalLocationPriceId) {
  const items = subscription.items?.data || [];
  const patch = {
    stripe_customer_id: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id,
    stripe_subscription_id: subscription.id,
    billing_status: subscription.status,
    trial_ends_at: unixDate(subscription.trial_end),
    current_period_end: unixDate(subscription.current_period_end || items[0]?.current_period_end),
    additional_location_quantity: subscription.status === 'canceled' ? 0
      : Number(items.find(item => item.price?.id === additionalLocationPriceId)?.quantity || 0),
  };
  if (subscription.metadata?.plan) patch.billing_plan = subscription.metadata.plan;
  if (subscription.metadata?.agreement_version === SUBSCRIPTION_AGREEMENT_VERSION) {
    Object.assign(patch, paidCommitment(subscription));
  }
  return patch;
}
