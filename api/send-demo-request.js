import { randomUUID } from 'node:crypto';
import { enforceRateLimit } from './_request-guard.js';
import { reportServerError } from './_observability.js';

const REQUIRED_FIELDS = ['firstName', 'email', 'restaurant'];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(value, maxLength = 500) {
  return String(value ?? '').trim().replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, maxLength);
}

function escapeHtml(value) {
  return clean(value, 4000)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function normalizeDemoRequest(body = {}) {
  return {
    website: clean(body.website, 250),
    firstName: clean(body.firstName, 100),
    lastName: clean(body.lastName, 100),
    email: clean(body.email, 254).toLowerCase(),
    phone: clean(body.phone, 60),
    restaurant: clean(body.restaurant, 180),
    role: clean(body.role, 100),
    pos: clean(body.pos, 120),
    venues: clean(body.venues, 60),
    goal: clean(body.goal, 2000),
  };
}

function requestText(request) {
  const provided = value => value || 'Not provided';
  return [
    'New ZestIQ demo request',
    '',
    `Name: ${request.firstName}${request.lastName ? ` ${request.lastName}` : ''}`,
    `Work email: ${request.email}`,
    `Phone: ${provided(request.phone)}`,
    `Restaurant/company: ${request.restaurant}`,
    `Role: ${provided(request.role)}`,
    `POS: ${provided(request.pos)}`,
    `Number of venues: ${provided(request.venues)}`,
    '',
    'Main goal:',
    provided(request.goal),
  ].join('\n');
}

function requestHtml(request) {
  const provided = value => value || 'Not provided';
  const rows = [
    ['Name', `${request.firstName}${request.lastName ? ` ${request.lastName}` : ''}`],
    ['Work email', request.email],
    ['Phone', provided(request.phone)],
    ['Restaurant/company', request.restaurant],
    ['Role', provided(request.role)],
    ['POS', provided(request.pos)],
    ['Number of venues', provided(request.venues)],
  ];
  return `<div style="font-family:Arial,sans-serif;line-height:1.55;color:#172238;max-width:680px;margin:0 auto">
    <h1 style="font-size:24px;margin:0 0 18px">New ZestIQ demo request</h1>
    <table role="presentation" style="border-collapse:collapse;width:100%">${rows.map(([label, value]) => `<tr><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:700;width:190px">${escapeHtml(label)}</td><td style="padding:8px 12px;border:1px solid #e2e8f0">${escapeHtml(value)}</td></tr>`).join('')}</table>
    <h2 style="font-size:16px;margin:20px 0 6px">Main goal</h2>
    <p style="white-space:pre-wrap;margin:0">${escapeHtml(provided(request.goal))}</p>
  </div>`;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    enforceRateLimit(req, res, 'demo-request', { limit: 5, windowMs: 60 * 60 * 1000 });
  } catch (error) {
    return res.status(error.status || 429).json({ error: error.message });
  }

  const request = normalizeDemoRequest(req.body);
  if (request.website) return res.status(200).json({ sent: true });

  const missing = REQUIRED_FIELDS.filter(field => !request[field]);
  if (missing.length) return res.status(400).json({ error: 'Please complete every required field.' });
  if (!EMAIL_PATTERN.test(request.email)) return res.status(400).json({ error: 'Please enter a valid work email.' });

  const apiKey = process.env.RESEND_API_KEY || process.env.RESEND_API_TOKEN || process.env.RESEND_KEY || '';
  const from = process.env.DEMO_FROM_EMAIL || process.env.WELCOME_FROM_EMAIL || process.env.RESEND_FROM_EMAIL || 'ZestIQ <hello@zestiq.ca>';
  const to = process.env.DEMO_REQUEST_TO || 'Pat@zestiq.ca';
  const databaseUrl = process.env.SUPABASE_URL || 'https://dpicnqksnvasquxkfxqs.supabase.co';
  const databaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const id = randomUUID();
  const databaseHeaders = {
    apikey: databaseKey, Authorization: `Bearer ${databaseKey}`, 'Content-Type': 'application/json',
  };
  const databaseEndpoint = `${databaseUrl}/rest/v1/demo_requests`;
  const context = { route: '/api/send-demo-request', method: 'POST', requestId: id };
  // Persist first: an email outage must never discard a prospective customer's inquiry.
  try {
    if (!databaseKey) throw new Error('Demo request storage is not configured');
    const { website, firstName, lastName, ...contact } = request;
    const saved = await fetch(databaseEndpoint, {
      method: 'POST', headers: { ...databaseHeaders, Prefer: 'return=minimal' },
      body: JSON.stringify({ id, first_name: firstName, last_name: lastName, ...contact, notification_to: to }),
      signal: AbortSignal.timeout(10000),
    });
    if (!saved.ok) throw new Error(`Demo request storage failed (${saved.status})`);
  } catch (error) {
    console.error('demo_request_storage_failed', { requestId: id });
    await reportServerError(error, context);
    return res.status(503).json({ error: 'We could not save your request. Please try again or email Pat@zestiq.ca.' });
  }

  async function recordNotification(update) {
    try {
      const updated = await fetch(`${databaseEndpoint}?id=eq.${id}`, {
        method: 'PATCH', headers: databaseHeaders,
        body: JSON.stringify({ ...update, notification_attempted_at: new Date().toISOString() }),
        signal: AbortSignal.timeout(10000),
      });
      if (!updated.ok) throw new Error(`Notification status storage failed (${updated.status})`);
    } catch (error) {
      console.error('demo_request_notification_status_failed', { requestId: id });
      await reportServerError(error, context);
    }
  }

  try {
    if (!apiKey) throw new Error('Demo notification email is not configured');
    const providerResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: request.email,
        subject: `Demo request — ${request.restaurant}`,
        text: requestText(request),
        html: requestHtml(request),
      }),
      signal: AbortSignal.timeout(10000),
    });
    const providerPayload = await providerResponse.json().catch(() => ({}));
    if (!providerResponse.ok) {
      throw new Error(`Email provider request failed (${providerResponse.status})`);
    }
    if (!providerPayload.id) throw new Error('Email provider did not return a message ID');
    await recordNotification({ notification_status: 'accepted', notification_provider_id: providerPayload.id, notification_error: null });
    return res.status(200).json({ received: true, sent: true });
  } catch (error) {
    await recordNotification({ notification_status: 'failed', notification_error: String(error.message || 'Notification failed').slice(0, 500) });
    console.error('demo_request_notification_failed', { requestId: id });
    await reportServerError(error, context);
    return res.status(200).json({ received: true, sent: false });
  }
}
