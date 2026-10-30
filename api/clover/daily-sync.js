import { timingSafeEqual } from 'node:crypto';
import { cloverDatabase as database } from '../v1/[...path].js';
import { cloverConfiguration } from '../_clover-config.js';
import { syncClover } from '../_clover.js';
export const config = { maxDuration: 300 };
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const expected = Buffer.from(`Bearer ${process.env.CRON_SECRET || ''}`), actual = Buffer.from(req.headers?.authorization || '');
  if (!process.env.CRON_SECRET || expected.length !== actual.length || !timingSafeEqual(expected, actual)) return res.status(401).json({ error: 'Unauthorized' });
  if (!cloverConfiguration().available) return res.status(200).json({ skipped: 'not_configured' });
  try {
    // Oldest-first processing avoids starving a connection after a busy scheduled run.
    const connections = await database('clover_connections?status=eq.connected&select=*&order=last_sync_at.asc.nullsfirst&limit=1001');
    const deadline = Date.now() + 250_000;
    let synced = 0, failed = 0, processed = 0;
    for (const row of connections.slice(0, 1000)) {
      if (Date.now() > deadline) break;
      try { await syncClover(row, { deadline: deadline - 10_000 }); synced++; }
      catch { failed++; }
      processed++;
    }
    // Non-200 when any connection could not be processed; never report all-green silently.
    const remaining = connections.length - processed;
    return res.status(failed || remaining ? 503 : 200).json({ synced, failed, remaining, batchLimit: 1000 });
  } catch { return res.status(503).json({ error: 'Clover scheduled sync could not run.' }); }
}
