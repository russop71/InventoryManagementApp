import { createHmac, timingSafeEqual } from 'crypto';
import { subscriptionBillingPatch } from './_subscription-policy.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dpicnqksnvasquxkfxqs.supabase.co';
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_PRICE_ADDITIONAL_LOCATION = process.env.STRIPE_PRICE_ADDITIONAL_LOCATION;
const FALLBACK_AGREEMENT_VERSION = '2026-08-25';

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json');
  return res.end(JSON.stringify(body));
}

async function rawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

export function verifyStripeSignature(payload, header, secret, now = Date.now()) {
  if (!payload || !header || !secret) return false;
  const fields = String(header).split(',').map(part => part.split('='));
  const timestamp = fields.find(([key]) => key === 't')?.[1];
  const signatures = fields.filter(([key]) => key === 'v1').map(([, value]) => value);
  if (!timestamp || !/^\d+$/.test(timestamp) || signatures.length === 0) return false;
  if (Math.abs(now / 1000 - Number(timestamp)) > 300) return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}.${payload.toString('utf8')}`).digest('hex');
  const expectedBuffer = Buffer.from(expected);
  return signatures.some(signature => {
    const received = Buffer.from(signature);
    return received.length === expectedBuffer.length && timingSafeEqual(received, expectedBuffer);
  });
}

async function updateAccount(accountId, patch) {
  if (!SUPABASE_SECRET_KEY) throw new Error('Supabase server credentials are not configured');
  const response = await fetch(`${SUPABASE_URL}/rest/v1/accounts?id=eq.${encodeURIComponent(accountId)}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_SECRET_KEY,
      Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
  });
  if (!response.ok) throw new Error(`Unable to update billing state (${response.status})`);
}

async function getAccountOnboardingState(accountId) {
  if (!SUPABASE_SECRET_KEY || !accountId) return {};
  const response = await fetch(`${SUPABASE_URL}/rest/v1/accounts?id=eq.${encodeURIComponent(accountId)}&select=onboarding_state&limit=1`, {
    headers: { apikey: SUPABASE_SECRET_KEY, Authorization: `Bearer ${SUPABASE_SECRET_KEY}` },
  });
  if (!response.ok) return {};
  const rows = await response.json();
  return rows?.[0]?.onboarding_state && typeof rows[0].onboarding_state === 'object'
    ? rows[0].onboarding_state
    : {};
}

async function recordSubscriptionAgreement(accountId, checkoutSession, acceptedAt) {
  if (!SUPABASE_SECRET_KEY || !accountId) return;
  const customerAccepted = checkoutSession?.consent?.terms_of_service === 'accepted';
  if (!customerAccepted) return;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/subscription_agreements`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SECRET_KEY,
      Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=ignore-duplicates,return=minimal',
    },
    body: JSON.stringify({
      account_id: accountId,
      agreement_version: checkoutSession?.metadata?.agreement_version || FALLBACK_AGREEMENT_VERSION,
      accepted_at: acceptedAt,
      customer_accepted: true,
      acceptance_channel: 'stripe_checkout',
      customer_email: checkoutSession?.customer_details?.email || checkoutSession?.customer_email || null,
      stripe_checkout_session_id: checkoutSession?.id || null,
      stripe_customer_id: typeof checkoutSession?.customer === 'string' ? checkoutSession.customer : checkoutSession?.customer?.id || null,
      stripe_subscription_id: typeof checkoutSession?.subscription === 'string' ? checkoutSession.subscription : checkoutSession?.subscription?.id || null,
    }),
  });
  if (!response.ok) throw new Error(`Unable to record subscription agreement (${response.status})`);
}

async function accountIdForStripeSubscription(subscription) {
  const subscriptionId = typeof subscription === 'string' ? subscription : subscription?.id;
  if (!SUPABASE_SECRET_KEY || !subscriptionId) return null;
  const response = await fetch(`${SUPABASE_URL}/rest/v1/accounts?stripe_subscription_id=eq.${encodeURIComponent(subscriptionId)}&select=id&limit=1`, {
    headers: { apikey: SUPABASE_SECRET_KEY, Authorization: `Bearer ${SUPABASE_SECRET_KEY}` },
  });
  if (!response.ok) return null;
  const rows = await response.json();
  return rows?.[0]?.id || null;
}

function unixDate(value) {
  return Number(value) > 0 ? new Date(Number(value) * 1000).toISOString() : null;
}

function commitmentEnd(startDate) {
  const start = new Date(startDate);
  const end = new Date(start);
  end.setUTCFullYear(end.getUTCFullYear() + 1);
  return end.toISOString();
}

async function readSubscription(value) {
  const id = typeof value === 'string' ? value : value?.id;
  if (!id || !STRIPE_SECRET_KEY) throw new Error('Stripe subscription or server credentials are missing');
  const response = await fetch(`https://api.stripe.com/v1/subscriptions/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
  });
  if (!response.ok) throw new Error(`Unable to read current subscription (${response.status})`);
  return response.json();
}

async function activateAccountFromCheckout(accountId, session, subscription) {
  const startedAt = unixDate(session.created) || new Date().toISOString();
  const patch = {
    stripe_customer_id: typeof session.customer === 'string' ? session.customer : session.customer?.id,
    stripe_subscription_id: typeof session.subscription === 'string' ? session.subscription : session.subscription?.id,
    billing_plan: session.metadata?.plan || null,
    billing_status: subscription.status,
    additional_location_quantity: Math.max(0, Number(session.metadata?.location_count || 1) - 1),
    commitment_started_at: startedAt,
    commitment_ends_at: commitmentEnd(startedAt),
    ...subscriptionBillingPatch(subscription, STRIPE_PRICE_ADDITIONAL_LOCATION),
  };
  if (['active', 'trialing'].includes(subscription.status) && session.metadata?.scheduling_enabled === 'true') {
    const onboardingState = await getAccountOnboardingState(accountId);
    patch.onboarding_state = {
      ...onboardingState,
      clientProfile: {
        ...(onboardingState.clientProfile || {}),
        schedulingEnabled: true,
      },
    };
  }
  await updateAccount(accountId, patch);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method not allowed' });
  if (!STRIPE_WEBHOOK_SECRET) return json(res, 503, { error: 'Stripe webhook is not configured' });

  try {
    const payload = await rawBody(req);
    const signature = req.headers['stripe-signature'];
    if (!verifyStripeSignature(payload, signature, STRIPE_WEBHOOK_SECRET)) {
      return json(res, 400, { error: 'invalid Stripe signature' });
    }

    const event = JSON.parse(payload.toString('utf8'));
    const object = event?.data?.object || {};

    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded' || event.type === 'checkout.session.async_payment_failed') {
      const accountId = object.client_reference_id || object.metadata?.account_id;
      if (accountId) {
        const acceptedAt = unixDate(object.created) || new Date().toISOString();
        const subscription = await readSubscription(object.subscription);
        if (subscription.metadata?.account_id !== accountId) throw new Error('Checkout subscription account mismatch');
        await activateAccountFromCheckout(accountId, object, subscription);
        if (event.type !== 'checkout.session.async_payment_failed') {
          await recordSubscriptionAgreement(accountId, object, acceptedAt);
        }
      }
    }

    if (['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'].includes(event.type)) {
      // Stripe may deliver events out of order. Read current state rather than
      // letting an older trial or invoice event reactivate a canceled account.
      const subscription = await readSubscription(object.id);
      const accountId = subscription.metadata?.account_id;
      if (accountId) {
        await updateAccount(accountId, subscriptionBillingPatch(subscription, STRIPE_PRICE_ADDITIONAL_LOCATION));
      }
    }

    if (event.type === 'invoice.payment_succeeded' || event.type === 'invoice.payment_failed') {
      const subscriptionDetails = object.parent?.subscription_details || {};
      const subscriptionId = subscriptionDetails.subscription || object.subscription;
      if (subscriptionId) {
        const subscription = await readSubscription(subscriptionId);
        const accountId = subscription.metadata?.account_id || await accountIdForStripeSubscription(subscription.id);
        if (accountId) await updateAccount(accountId, subscriptionBillingPatch(subscription, STRIPE_PRICE_ADDITIONAL_LOCATION));
      }
    }

    return json(res, 200, { received: true });
  } catch (error) {
    console.error('Stripe webhook error', error);
    return json(res, 500, { error: 'Unable to process Stripe webhook' });
  }
}
