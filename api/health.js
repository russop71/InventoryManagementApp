import { launchReadiness } from './_launch-readiness.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  res.setHeader('Cache-Control', 'no-store');
  const requestId = String(req.headers?.['x-vercel-id'] || globalThis.crypto?.randomUUID?.() || Date.now());
  if (req.query?.mode === 'liveness') return res.status(200).json({ ok: true, service: 'zestiq-api', requestId });
  const readiness = launchReadiness();
  return res.status(readiness.ready ? 200 : 503).json({ ok: readiness.ready, service: 'zestiq-api', requestId, ...readiness });
}
