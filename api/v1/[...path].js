import { randomUUID } from 'crypto';
import { normalizePosImportPayload } from '../../server/pos-import.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dpicnqksnvasquxkfxqs.supabase.co';
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json');
  return res.end(JSON.stringify(body));
}

function normalizeSlug(input = '') {
  return String(input).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'default';
}

function userNameFromEmail(email = '') {
  const username = String(email).split('@')[0] || email;
  return username.split(/[._-]/).filter(Boolean).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function roleFromEmail(email = '') {
  const normalized = String(email).trim().toLowerCase();
  if (normalized === 'owner@zestiq.com' || normalized === 'demo@zestiq.com') return 'Owner';
  if (normalized.startsWith('admin')) return 'Admin';
  if (normalized.startsWith('manager')) return 'Manager';
  return 'Staff';
}

function accountSlugFromEmail(email = '') {
  const normalized = String(email).trim().toLowerCase();
  if (['demo@zestiq.com', 'russop71@gmail.com', 'russop71', 'owner@zestiq.com'].includes(normalized)) return 'russop71';
  return normalizeSlug(normalized.split('@')[0] || 'local-account');
}

function accountNameFromSlug(slug) {
  return String(slug).split(/[-_]/).filter(Boolean).map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ') || 'Restaurant';
}

function defaultToast() {
  return { connected: false, apiKey: '', restaurantId: '', salesData: [], menuItems: [], cogsCategories: [], lastSync: null };
}

function defaultLocationData() {
  return { inventory: [], recipes: [], storageAreas: [], orders: [], invoices: [], suppliers: [], preppedRecipes: [], forecasts: [], integrations: { toast: defaultToast() } };
}

async function supabase(path, { method = 'GET', body, prefer } = {}) {
  if (!SUPABASE_SECRET_KEY) throw new Error('SUPABASE_SECRET_KEY is not configured');
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: SUPABASE_SECRET_KEY,
      Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error(payload?.message || payload?.hint || `Supabase request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

function mapUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    lastLogin: row.last_login || 'Never',
  };
}

function mapLocation(row) {
  return { id: row.id, name: row.name };
}

function mapLocationData(row) {
  const base = defaultLocationData();
  return {
    ...base,
    inventory: row?.inventory || [],
    recipes: row?.recipes || [],
    storageAreas: row?.storage_areas || [],
    orders: row?.orders || [],
    invoices: row?.invoices || [],
    suppliers: row?.suppliers || [],
    preppedRecipes: row?.prepped_recipes || [],
    forecasts: row?.forecasts || [],
    integrations: row?.integrations || base.integrations,
  };
}

async function getAccount(accountId) {
  const rows = await supabase(`accounts?id=eq.${encodeURIComponent(accountId)}&select=*`);
  return rows?.[0] || null;
}

async function listLocations(accountId) {
  return supabase(`locations?account_id=eq.${encodeURIComponent(accountId)}&select=*&order=created_at.asc`);
}

async function ensureAccountForEmail(email) {
  const slug = accountSlugFromEmail(email);
  let accounts = await supabase(`accounts?slug=eq.${encodeURIComponent(slug)}&select=*`);
  let account = accounts?.[0];
  if (!account) {
    const created = await supabase('accounts?select=*', {
      method: 'POST',
      prefer: 'return=representation',
      body: { slug, name: accountNameFromSlug(slug) },
    });
    account = created[0];
  }

  let locations = await listLocations(account.id);
  if (!locations.length) {
    const created = await supabase('locations?select=*', {
      method: 'POST',
      prefer: 'return=representation',
      body: { account_id: account.id, slug: 'main', name: 'Main Location', timezone: 'America/Toronto' },
    });
    locations = created;
  }

  for (const location of locations) {
    await supabase('location_data?on_conflict=location_id', {
      method: 'POST',
      prefer: 'resolution=ignore-duplicates,return=minimal',
      body: { location_id: location.id },
    });
  }

  return { account, locations };
}

async function ensureLocationBelongsToAccount(accountId, locationId) {
  const rows = await supabase(`locations?id=eq.${encodeURIComponent(locationId)}&account_id=eq.${encodeURIComponent(accountId)}&select=*`);
  return rows?.[0] || null;
}

function parseSegments(req) {
  if (Array.isArray(req.query?.path)) return req.query.path;
if (typeof req.query?.path === 'string') {
  return req.query.path.split('/').filter(Boolean).map(decodeURIComponent);
}
  const pathname = new URL(req.url, 'http://localhost').pathname;
  return pathname.replace(/^\/api\/v1\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
}

export default async function handler(req, res) {
  try {
    const segments = parseSegments(req);
    const method = req.method || 'GET';

    if (segments[0] === 'auth' && segments[1] === 'login' && method === 'POST') {
      const { email, password } = req.body || {};
      if (!email || !password) return json(res, 400, { error: 'email and password are required' });
      const normalizedEmail = String(email).trim().toLowerCase();
      const { account, locations } = await ensureAccountForEmail(normalizedEmail);
      const now = new Date().toISOString();
      const name = userNameFromEmail(normalizedEmail);
      const role = roleFromEmail(normalizedEmail);

      let users = await supabase(`app_users?account_id=eq.${account.id}&email=eq.${encodeURIComponent(normalizedEmail)}&select=*`);
      let user = users?.[0];
      if (user) {
        const updated = await supabase(`app_users?id=eq.${user.id}&select=*`, {
          method: 'PATCH', prefer: 'return=representation', body: { name, role, status: 'Active', last_login: now, updated_at: now },
        });
        user = updated[0];
      } else {
        const created = await supabase('app_users?select=*', {
          method: 'POST', prefer: 'return=representation', body: { account_id: account.id, email: normalizedEmail, name, role, status: 'Active', last_login: now },
        });
        user = created[0];
      }

      const token = randomUUID();
      await supabase('app_sessions', { method: 'POST', prefer: 'return=minimal', body: { token, user_id: user.id, account_id: account.id } });
      return json(res, 200, {
        token,
        user: mapUser(user),
        account: { id: account.id, name: account.name },
        locations: locations.map(mapLocation),
        activeLocationId: locations[0]?.id || null,
      });
    }

    if (segments[0] === 'auth' && segments[1] === 'session' && segments[2] && method === 'GET') {
      const token = segments[2];
      const sessions = await supabase(`app_sessions?token=eq.${encodeURIComponent(token)}&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=*`);
      const session = sessions?.[0];
      if (!session) return json(res, 404, { error: 'session not found' });
      const users = await supabase(`app_users?id=eq.${session.user_id}&select=*`);
      const user = users?.[0];
      const account = await getAccount(session.account_id);
      if (!user || !account) return json(res, 404, { error: 'session data not found' });
      const locations = await listLocations(account.id);
      return json(res, 200, { token, user: mapUser(user), account: { id: account.id, name: account.name }, locations: locations.map(mapLocation), activeLocationId: locations[0]?.id || null });
    }

    if (segments[0] !== 'accounts' || !segments[1]) return json(res, 404, { error: 'not found' });
    const accountId = segments[1];
    const account = await getAccount(accountId);
    if (!account) return json(res, 404, { error: 'account not found' });

    if (segments.length === 2 && method === 'DELETE') {
      await supabase(`accounts?id=eq.${accountId}`, { method: 'DELETE', prefer: 'return=minimal' });
      return json(res, 200, { success: true });
    }

    if (segments[2] === 'users') {
      if (segments.length === 3 && method === 'GET') {
        const rows = await supabase(`app_users?account_id=eq.${accountId}&select=*&order=name.asc`);
        return json(res, 200, { users: rows.map(mapUser) });
      }
      if (segments.length === 3 && method === 'POST') {
        const { name, email, role } = req.body || {};
        if (!name || !email || !role) return json(res, 400, { error: 'name, email, role are required' });
        const normalizedEmail = String(email).trim().toLowerCase();
        const existing = await supabase(`app_users?account_id=eq.${accountId}&email=eq.${encodeURIComponent(normalizedEmail)}&select=id`);
        if (!existing.length) {
          await supabase('app_users', { method: 'POST', prefer: 'return=minimal', body: { account_id: accountId, name: String(name).trim(), email: normalizedEmail, role, status: 'Active' } });
        }
        const rows = await supabase(`app_users?account_id=eq.${accountId}&select=*&order=name.asc`);
        return json(res, 201, { users: rows.map(mapUser) });
      }
      const userId = segments[3];
      if (userId && method === 'PUT') {
        const { name, email, role, status } = req.body || {};
        const patch = { updated_at: new Date().toISOString() };
        if (name !== undefined) patch.name = String(name).trim();
        if (email !== undefined) patch.email = String(email).trim().toLowerCase();
        if (role !== undefined) patch.role = role;
        if (status !== undefined) patch.status = status;
        await supabase(`app_users?id=eq.${userId}&account_id=eq.${accountId}`, { method: 'PATCH', prefer: 'return=minimal', body: patch });
        const rows = await supabase(`app_users?account_id=eq.${accountId}&select=*&order=name.asc`);
        return json(res, 200, { users: rows.map(mapUser) });
      }
      if (userId && method === 'DELETE') {
        await supabase(`app_users?id=eq.${userId}&account_id=eq.${accountId}`, { method: 'DELETE', prefer: 'return=minimal' });
        const rows = await supabase(`app_users?account_id=eq.${accountId}&select=*&order=name.asc`);
        return json(res, 200, { users: rows.map(mapUser) });
      }
    }

    if (segments[2] === 'locations') {
      if (segments.length === 3 && method === 'GET') {
        const rows = await listLocations(accountId);
        return json(res, 200, { locations: rows.map(mapLocation) });
      }
      if (segments.length === 3 && method === 'POST') {
        const name = String(req.body?.name || '').trim();
        if (!name) return json(res, 400, { error: 'location name is required' });
        const slug = normalizeSlug(name);
        let rows = await supabase(`locations?account_id=eq.${accountId}&slug=eq.${encodeURIComponent(slug)}&select=*`);
        if (!rows.length) {
          rows = await supabase('locations?select=*', { method: 'POST', prefer: 'return=representation', body: { account_id: accountId, slug, name, timezone: 'America/Toronto' } });
          await supabase('location_data', { method: 'POST', prefer: 'return=minimal', body: { location_id: rows[0].id } });
        }
        const all = await listLocations(accountId);
        return json(res, 201, { locations: all.map(mapLocation) });
      }

      const locationId = segments[3];
      if (!locationId) return json(res, 404, { error: 'location not found' });
      const location = await ensureLocationBelongsToAccount(accountId, locationId);
      if (!location) return json(res, 404, { error: 'location not found' });

      if (segments[4] === 'data') {
        const rows = await supabase(`location_data?location_id=eq.${locationId}&select=*`);
        const current = rows?.[0] || { location_id: locationId };
        if (method === 'GET') return json(res, 200, mapLocationData(current));
        if (method === 'PUT') {
          const body = req.body || {};
          const next = {
            location_id: locationId,
            inventory: Array.isArray(body.inventory) ? body.inventory : (current.inventory || []),
            recipes: Array.isArray(body.recipes) ? body.recipes : (current.recipes || []),
            storage_areas: Array.isArray(body.storageAreas) ? body.storageAreas : (current.storage_areas || []),
            orders: Array.isArray(body.orders) ? body.orders : (current.orders || []),
            invoices: Array.isArray(body.invoices) ? body.invoices : (current.invoices || []),
            suppliers: Array.isArray(body.suppliers) ? body.suppliers : (current.suppliers || []),
            prepped_recipes: Array.isArray(body.preppedRecipes) ? body.preppedRecipes : (current.prepped_recipes || []),
            forecasts: Array.isArray(body.forecasts) ? body.forecasts : (current.forecasts || []),
            integrations: current.integrations || { toast: defaultToast() },
            updated_at: new Date().toISOString(),
          };
          const saved = await supabase('location_data?on_conflict=location_id&select=*', { method: 'POST', prefer: 'resolution=merge-duplicates,return=representation', body: next });
          return json(res, 200, mapLocationData(saved[0]));
        }
      }

      if (segments[4] === 'integrations' && segments[5] === 'toast') {
        const rows = await supabase(`location_data?location_id=eq.${locationId}&select=*`);
        const current = rows?.[0] || { location_id: locationId, integrations: { toast: defaultToast() } };
        const existingToast = current.integrations?.toast || defaultToast();
        if (segments.length === 6 && method === 'GET') return json(res, 200, { toast: existingToast });
        if (segments.length === 6 && method === 'PUT') {
          const payload = req.body || {};
          const toast = {
            connected: typeof payload.connected === 'boolean' ? payload.connected : Boolean(existingToast.connected),
            apiKey: typeof payload.apiKey === 'string' ? payload.apiKey : (existingToast.apiKey || ''),
            restaurantId: typeof payload.restaurantId === 'string' ? payload.restaurantId : (existingToast.restaurantId || ''),
            salesData: Array.isArray(payload.salesData) ? payload.salesData : (existingToast.salesData || []),
            menuItems: Array.isArray(payload.menuItems) ? payload.menuItems : (existingToast.menuItems || []),
            cogsCategories: Array.isArray(payload.cogsCategories) ? payload.cogsCategories : (existingToast.cogsCategories || []),
            lastSync: payload.lastSync ?? existingToast.lastSync ?? null,
          };
          const integrations = { ...(current.integrations || {}), toast };
          await supabase(`location_data?location_id=eq.${locationId}`, { method: 'PATCH', prefer: 'return=minimal', body: { integrations, updated_at: new Date().toISOString() } });
          return json(res, 200, { toast });
        }
        if (segments[6] === 'import' && method === 'POST') {
          const normalized = normalizePosImportPayload(req.body || {});
          const toast = { ...existingToast, connected: true, salesData: normalized.salesData, menuItems: normalized.menuItems, lastSync: new Date().toISOString() };
          const integrations = { ...(current.integrations || {}), toast };
          await supabase(`location_data?location_id=eq.${locationId}`, { method: 'PATCH', prefer: 'return=minimal', body: { integrations, updated_at: new Date().toISOString() } });
          return json(res, 200, { toast });
        }
      }
    }

    return json(res, 404, { error: 'not found' });
  } catch (error) {
    console.error('ZestIQ API error', error);
    return json(res, Number(error.status) || 500, { error: error.message || 'internal server error' });
  }
}
