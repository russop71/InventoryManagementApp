import { hasAttention, managerRecipients, sendWeeklyManagerDigest, summarizeLocationAttention, weekKey } from './_weekly-manager-digest.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dpicnqksnvasquxkfxqs.supabase.co';
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

async function database(path, options = {}) {
  if (!SUPABASE_SECRET_KEY) throw new Error('Supabase server credentials are not configured');
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: options.method || 'GET',
    headers: { apikey: SUPABASE_SECRET_KEY, Authorization: `Bearer ${SUPABASE_SECRET_KEY}`, 'Content-Type': 'application/json', ...(options.prefer ? { Prefer: options.prefer } : {}) },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(payload?.message || `Database request failed (${response.status})`);
  return payload;
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const now = new Date();
    const since = new Date(now);
    since.setUTCDate(since.getUTCDate() - 7);
    const digestKey = weekKey(now);
    const [accounts, locations, locationRows, users] = await Promise.all([
      database('accounts?select=id,name'),
      database('locations?select=id,account_id,name'),
      database('location_data?select=location_id,inventory,invoices,orders'),
      database('app_users?status=eq.Active&select=id,account_id,name,email,role,status'),
    ]);
    const dataByLocation = new Map(locationRows.map(row => [row.location_id, row]));
    const outcomes = [];
    for (const account of accounts) {
      const accountUsers = users.filter(user => user.account_id === account.id);
      const recipients = managerRecipients(accountUsers);
      if (!recipients.length) continue;
      const summaries = locations
        .filter(location => location.account_id === account.id)
        .map(location => summarizeLocationAttention({ ...dataByLocation.get(location.id), name: location.name }, since))
        .filter(hasAttention);
      if (!summaries.length) continue;
      const existing = await database(`app_usage_events?account_id=eq.${encodeURIComponent(account.id)}&event_name=eq.weekly_manager_digest_sent&metadata-%3E%3Eweek_key=eq.${encodeURIComponent(digestKey)}&select=id&limit=1`);
      if (existing.length) {
        outcomes.push({ accountId: account.id, status: 'already_sent' });
        continue;
      }
      const managers = recipients.map(email => accountUsers.find(user => String(user.email).trim().toLowerCase() === email)).filter(Boolean);
      const results = [];
      for (const manager of managers) {
        results.push(await sendWeeklyManagerDigest({ recipients: [manager.email], recipientName: manager.name, accountName: account.name, locations: summaries, periodStart: since, periodEnd: now }));
      }
      const allSent = results.length > 0 && results.every(result => result.sent);
      if (allSent) {
        await database('app_usage_events', { method: 'POST', prefer: 'return=minimal', body: { account_id: account.id, user_id: managers[0].id, event_name: 'weekly_manager_digest_sent', path: '/api/weekly-manager-digest', metadata: { week_key: digestKey, recipient_count: managers.length, location_count: summaries.length } } });
      }
      outcomes.push({ accountId: account.id, status: allSent ? 'sent' : (results[0]?.reason || 'not_sent'), recipientCount: managers.length });
    }
    return res.status(200).json({ ok: true, weekKey: digestKey, outcomes });
  } catch (error) {
    console.error('Weekly manager digest failed', error);
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Weekly digest failed' });
  }
}
