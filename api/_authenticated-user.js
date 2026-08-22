import { hasProductAccess } from './_launch-controls.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dpicnqksnvasquxkfxqs.supabase.co';
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

function bearerToken(req) {
  const authorization = String(req.headers?.authorization || '');
  return authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
}

async function readJson(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error_description || payload?.message || 'Sign in is required');
    error.status = response.status === 401 ? 401 : 503;
    throw error;
  }
  return payload;
}

export async function requireActiveUser(req) {
  if (!SUPABASE_SECRET_KEY) {
    throw Object.assign(new Error('Authentication is not configured'), { status: 503 });
  }
  const token = bearerToken(req);
  if (!token) throw Object.assign(new Error('Sign in is required'), { status: 401 });

  const authUser = await readJson(await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_SECRET_KEY,
      Authorization: `Bearer ${token}`,
    },
  }));
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/app_users?auth_user_id=eq.${encodeURIComponent(authUser.id)}&status=eq.Active&select=id,account_id,role`,
    {
      headers: {
        apikey: SUPABASE_SECRET_KEY,
        Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
      },
    },
  );
  const users = await readJson(response);
  if (!users?.[0]) throw Object.assign(new Error('This account access is inactive'), { status: 403 });
  const accountResponse = await fetch(`${SUPABASE_URL}/rest/v1/accounts?id=eq.${encodeURIComponent(users[0].account_id)}&select=*`, {
    headers: { apikey: SUPABASE_SECRET_KEY, Authorization: `Bearer ${SUPABASE_SECRET_KEY}` },
  });
  const accounts = await readJson(accountResponse);
  const account = accounts?.[0];
  if (!account) throw Object.assign(new Error('Company account not found'), { status: 404 });
  if (!hasProductAccess({ account, authUser })) {
    throw Object.assign(new Error(users[0].role === 'Owner'
      ? 'Activate the ZestIQ Premium subscription to use AI scanning.'
      : 'This company subscription is not active. Ask the company owner to update billing.'), { status: 402, code: 'SUBSCRIPTION_REQUIRED' });
  }
  return { authUser, appUser: users[0], account };
}
