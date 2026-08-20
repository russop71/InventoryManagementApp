import { createHmac, timingSafeEqual } from 'crypto';

export const config = {
  api: {
    bodyParser: false,
  },
};

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dpicnqksnvasquxkfxqs.supabase.co';
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const STRIPE_PRICE_ADDITIONAL_LOCATION = process.env.STRIPE_PRICE_ADDITIONAL_LOCATION;

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
  if (!timestamp || signatures.length === 0) return false;
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

function unixDate(value) {
  return Number(value) > 0 ? new Date(Number(value) * 1000).toISOString() : null;
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

    if (event.type === 'checkout.session.completed') {
      const accountId = object.client_reference_id || object.metadata?.account_id;
      if (accountId) {
        await updateAccount(accountId, {
          stripe_customer_id: typeof object.customer === 'string' ? object.customer : object.customer?.id,
          stripe_subscription_id: typeof object.subscription === 'string' ? object.subscription : object.subscription?.id,
          billing_plan: object.metadata?.plan || null,
          billing_status: object.payment_status === 'paid' ? 'active' : 'incomplete',
          additional_location_quantity: Math.max(0, Number(object.metadata?.location_count || 1) - 1),
        });
      }
    }

    if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const accountId = object.metadata?.account_id;
      if (accountId) {
        const additionalLocationItem = object.items?.data?.find(item => item.price?.id === STRIPE_PRICE_ADDITIONAL_LOCATION);
        await updateAccount(accountId, {
          stripe_customer_id: typeof object.customer === 'string' ? object.customer : object.customer?.id,
          stripe_subscription_id: object.id || null,
          billing_plan: object.metadata?.plan || null,
          billing_status: object.status || 'canceled',
          trial_ends_at: unixDate(object.trial_end),
          current_period_end: unixDate(object.current_period_end),
          additional_location_quantity: event.type === 'customer.subscription.deleted'
            ? 0
            : Number(additionalLocationItem?.quantity || 0),
        });
      }
    }

    if (event.type === 'invoice.payment_succeeded' || event.type === 'invoice.payment_failed') {
      const subscriptionDetails = object.parent?.subscription_details || {};
      const accountId = subscriptionDetails.metadata?.account_id || object.subscription_details?.metadata?.account_id;
      if (accountId) {
        await updateAccount(accountId, {
          stripe_customer_id: typeof object.customer === 'string' ? object.customer : object.customer?.id,
          stripe_subscription_id: typeof object.subscription === 'string'
            ? object.subscription
            : subscriptionDetails.subscription || object.subscription?.id || null,
          billing_plan: subscriptionDetails.metadata?.plan || null,
          billing_status: event.type === 'invoice.payment_succeeded' ? 'active' : 'past_due',
          current_period_end: unixDate(object.lines?.data?.[0]?.period?.end),
        });
      }
    }

    return json(res, 200, { received: true });
  } catch (error) {
    console.error('Stripe webhook error', error);
    return json(res, 500, { error: 'Unable to process Stripe webhook' });
  }
}
