import { reportServerError } from './_observability.js';

const clean = value => String(value || '').replace(/[\r\n\u0000]/g, ' ').trim().slice(0, 250);
const escapeHtml = value => clean(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
const ownerInbox = () => process.env.ZESTIQ_CUSTOMER_ALERT_EMAIL || 'pat@zestiq.ca';

export function welcomeEmail({ name, email }) {
  const firstName = clean(name).split(/\s+/)[0] || 'there';
  return {
    to: [email],
    reply_to: 'pat@zestiq.ca',
    subject: 'Welcome to ZestIQ',
    text: `Hi ${firstName},\n\nThanks for joining ZestIQ! We’re here to help you run a tighter, smarter kitchen.\n\nGet started at https://zestiq.ca/app: add your payment details to activate your trial, then set up your restaurant, suppliers, inventory and recipes. You can scan invoices, monitor food costs and build supplier orders from your forecasts.\n\nNeed a hand getting set up? Reply to this email and we’ll help.\n\nWelcome aboard,\nThe ZestIQ Team`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#303A43;max-width:640px;margin:auto"><h1 style="color:#F58220">Welcome to ZestIQ, ${escapeHtml(firstName)}.</h1><p>Thanks for joining! We’re here to help you run a tighter, smarter kitchen.</p><p>Add your payment details to activate your trial, then set up your restaurant, suppliers, inventory and recipes.</p><p>Scan invoices, monitor food costs and build supplier orders from your forecasts.</p><p><a href="https://zestiq.ca/app" style="display:inline-block;background:#F58220;color:#fff;padding:12px 20px;text-decoration:none;border-radius:8px">Get started with ZestIQ</a></p><p>Need a hand getting set up? Reply to this email and we’ll help.</p><p>Welcome aboard,<br>The ZestIQ Team</p></div>`,
  };
}

export function signupAlert({ name, email, account }) {
  return {
    to: [ownerInbox()],
    reply_to: email,
    subject: `New ZestIQ signup — ${clean(account.name)}`,
    text: `A new customer created a ZestIQ account.\n\nName: ${clean(name)}\nEmail: ${clean(email)}\nCompany: ${clean(account.name)}\nAccount ID: ${account.id}\n\nThis is an account signup. Stripe checkout and trial activation are reported separately.\n\nManage customers: https://zestiq.ca/app`,
  };
}

export function checkoutAlert(session, subscription) {
  const email = session.customer_details?.email || session.customer_email || '';
  return {
    to: [ownerInbox()],
    ...(email ? { reply_to: email } : {}),
    subject: 'ZestIQ customer completed Stripe checkout',
    text: `A customer completed Stripe checkout for ZestIQ.\n\nName: ${clean(session.customer_details?.name) || 'Not provided'}\nEmail: ${clean(email) || 'Not provided'}\nAccount ID: ${clean(session.client_reference_id || session.metadata?.account_id)}\nPlan: ${clean(session.metadata?.plan) || 'Subscription'}\nLocations: ${clean(session.metadata?.location_count) || '1'}\nScheduling: ${session.metadata?.scheduling_enabled === 'true' ? 'Included' : 'Not selected'}\nPayment status at checkout: ${clean(session.payment_status)}\nCheckout ID: ${clean(session.id)}\nSubscription ID: ${clean(subscription.id)}\n\nA trial checkout may have no payment due today. This alert does not mean a paid charge occurred.\n\nView customer: https://dashboard.stripe.com/customers/${encodeURIComponent(typeof session.customer === 'string' ? session.customer : session.customer?.id || '')}`,
  };
}

export async function sendCustomerEmail(message, key, fetchImpl = fetch) {
  const apiKey = process.env.RESEND_API_KEY || process.env.RESEND_API_TOKEN || process.env.RESEND_KEY;
  if (!apiKey) throw new Error('Customer email service is not configured');
  const from = process.env.WELCOME_FROM_EMAIL || process.env.RESEND_FROM_EMAIL || 'ZestIQ <hello@zestiq.ca>';
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetchImpl('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': key },
        body: JSON.stringify({ from, ...message }),
        signal: AbortSignal.timeout(8000),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(payload?.message || `Customer email delivery failed (${response.status})`);
        error.retryable = response.status === 429 || response.status >= 500 || payload?.name === 'concurrent_idempotent_requests';
        throw error;
      }
      return { sent: true, id: payload.id || null };
    } catch (error) {
      if (attempt === 1 || error.retryable === false) throw error;
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
}

export async function sendRegistrationEmails(details) {
  const results = await Promise.allSettled([
    sendCustomerEmail(welcomeEmail(details), `welcome/${details.userId}`),
    sendCustomerEmail(signupAlert(details), `signup-alert/${details.userId}`),
  ]);
  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('ZestIQ registration email failed', result.reason);
      await reportServerError(result.reason, { route: '/api/v1/auth/register', method: 'POST' });
    }
  }
  return { welcomeEmailSent: results[0].status === 'fulfilled', signupAlertSent: results[1].status === 'fulfilled' };
}

export async function sendCheckoutAlert(session, subscription) {
  if (!['active', 'trialing'].includes(subscription.status) ||
      !['paid', 'no_payment_required'].includes(session.payment_status)) return { sent: false };
  return sendCustomerEmail(checkoutAlert(session, subscription), `checkout-alert/${session.id}`);
}
