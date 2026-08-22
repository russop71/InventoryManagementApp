const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dpicnqksnvasquxkfxqs.supabase.co';
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

function quotaNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

async function request(path, init = {}) {
  if (!SUPABASE_SECRET_KEY) throw Object.assign(new Error('AI usage controls are not configured'), { status: 503 });
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_SECRET_KEY,
      Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw Object.assign(new Error(payload?.message || 'Unable to verify AI usage'), { status: 503 });
  return payload;
}

export async function enforceAiQuota({ accountId, userId, eventName }) {
  if (!SUPABASE_SECRET_KEY) throw Object.assign(new Error('AI usage controls are not configured'), { status: 503 });
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const userLimit = quotaNumber(process.env.ZESTIQ_AI_DAILY_USER_LIMIT, 60);
  const accountLimit = quotaNumber(process.env.ZESTIQ_AI_DAILY_ACCOUNT_LIMIT, 600);
  const base = `app_usage_events?account_id=eq.${encodeURIComponent(accountId)}&event_name=like.ai_*&created_at=gte.${encodeURIComponent(since.toISOString())}`;
  const [userResponse, accountResponse] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/${base}&user_id=eq.${encodeURIComponent(userId)}&select=id`, { headers: { apikey: SUPABASE_SECRET_KEY, Authorization: `Bearer ${SUPABASE_SECRET_KEY}`, Prefer: 'count=exact', Range: '0-0' } }),
    fetch(`${SUPABASE_URL}/rest/v1/${base}&select=id`, { headers: { apikey: SUPABASE_SECRET_KEY, Authorization: `Bearer ${SUPABASE_SECRET_KEY}`, Prefer: 'count=exact', Range: '0-0' } }),
  ]);
  if (!userResponse.ok || !accountResponse.ok) throw Object.assign(new Error('Unable to verify AI usage'), { status: 503 });
  const count = response => Number(String(response.headers.get('content-range') || '').split('/')[1] || 0);
  if (count(userResponse) >= userLimit || count(accountResponse) >= accountLimit) {
    throw Object.assign(new Error('Today\'s AI usage limit has been reached. Try again tomorrow or contact your company owner.'), { status: 429, code: 'AI_DAILY_LIMIT' });
  }
  return { eventName, userLimit, accountLimit };
}

export async function recordAiUsage({ accountId, userId, eventName, path, metadata = {} }) {
  await request('app_usage_events', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ account_id: accountId, user_id: userId, event_name: eventName, path, metadata }),
  });
}
