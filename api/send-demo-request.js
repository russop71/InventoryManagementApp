import { enforceRateLimit } from './_request-guard.js';
import { reportServerError } from './_observability.js';

const REQUIRED_FIELDS = ['firstName', 'lastName', 'email', 'phone', 'restaurant', 'role', 'pos', 'venues', 'goal'];
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
  return [
    'New ZestIQ demo request',
    '',
    `Name: ${request.firstName} ${request.lastName}`,
    `Work email: ${request.email}`,
    `Phone: ${request.phone}`,
    `Restaurant/company: ${request.restaurant}`,
    `Role: ${request.role}`,
    `POS: ${request.pos}`,
    `Number of venues: ${request.venues}`,
    '',
    'Main goal:',
    request.goal,
  ].join('\n');
}

function requestHtml(request) {
  const rows = [
    ['Name', `${request.firstName} ${request.lastName}`],
    ['Work email', request.email],
    ['Phone', request.phone],
    ['Restaurant/company', request.restaurant],
    ['Role', request.role],
    ['POS', request.pos],
    ['Number of venues', request.venues],
  ];
  return `<div style="font-family:Arial,sans-serif;line-height:1.55;color:#172238;max-width:680px;margin:0 auto">
    <h1 style="font-size:24px;margin:0 0 18px">New ZestIQ demo request</h1>
    <table role="presentation" style="border-collapse:collapse;width:100%">${rows.map(([label, value]) => `<tr><td style="padding:8px 12px;border:1px solid #e2e8f0;font-weight:700;width:190px">${escapeHtml(label)}</td><td style="padding:8px 12px;border:1px solid #e2e8f0">${escapeHtml(value)}</td></tr>`).join('')}</table>
    <h2 style="font-size:16px;margin:20px 0 6px">Main goal</h2>
    <p style="white-space:pre-wrap;margin:0">${escapeHtml(request.goal)}</p>
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
  const to = process.env.DEMO_REQUEST_TO || 'demo@zestiq.ca';
  if (!apiKey) return res.status(503).json({ error: 'Demo requests are temporarily unavailable. Please email demo@zestiq.ca.' });

  try {
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
    });
    const providerPayload = await providerResponse.json().catch(() => ({}));
    if (!providerResponse.ok) {
      const error = new Error(providerPayload?.message || providerPayload?.error || 'Email provider request failed');
      await reportServerError(error, { route: '/api/send-demo-request', method: 'POST' });
      return res.status(502).json({ error: 'We could not send your request. Please email demo@zestiq.ca.' });
    }
    return res.status(200).json({ sent: true });
  } catch (error) {
    await reportServerError(error, { route: '/api/send-demo-request', method: 'POST' });
    return res.status(500).json({ error: 'We could not send your request. Please email demo@zestiq.ca.' });
  }
}
