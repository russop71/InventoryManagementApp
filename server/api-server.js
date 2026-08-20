import express from 'express';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import bodyParser from 'body-parser';
import multer from 'multer';
import swaggerUi from 'swagger-ui-express';
import yaml from 'js-yaml';
import Tesseract from 'tesseract.js';
import http from 'http';
import { WebSocketServer } from 'ws';
import { randomUUID } from 'crypto';
import { normalizePosImportPayload } from './pos-import.js';
import { buildForecastFromHistory } from './forecasting.js';

const PORT = process.env.PORT || 4001;
const app = express();
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } });

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

const LIVE_DATA_PATH = process.env.ZESTIQ_LOCAL_DATA_PATH
  ? path.resolve(process.env.ZESTIQ_LOCAL_DATA_PATH)
  : path.resolve(process.cwd(), 'server/data/live-data.json');

function normalizeId(input = '') {
  return String(input)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'default';
}

function userNameFromEmail(email = '') {
  const username = String(email).split('@')[0] || email;
  return username
    .split(/[._-]/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function roleFromEmail(email = '') {
  const normalized = String(email).trim().toLowerCase();
  if (normalized === 'owner@zestiq.com') return 'Owner';
  if (normalized === 'demo@zestiq.com') return 'Owner';
  if (normalized.startsWith('admin')) return 'Admin';
  if (normalized.startsWith('manager')) return 'Manager';
  return 'Staff';
}

function resolvePersistentAccountId(email = '') {
  const normalized = String(email).trim().toLowerCase();
  if (['russop71@gmail.com', 'russop71', 'owner@zestiq.com'].includes(normalized)) {
    return 'russop71';
  }
  return normalizeId(normalized || 'local-account');
}

function accountFromEmail(email = '') {
  const normalized = String(email).trim().toLowerCase();
  const accountId = resolvePersistentAccountId(normalized);
  const username = accountId === 'russop71' ? 'Russop71' : (normalized.split('@')[0] || 'local-account');
  const displayName = String(username)
    .split(/[-_]/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'Restaurant';

  return {
    id: accountId,
    name: displayName || 'Restaurant',
  };
}

const DEFAULT_LIVE_DATA = {
  accounts: {},
  sessions: {},
  locationData: {},
};

function ensureDataFile() {
  const dir = path.dirname(LIVE_DATA_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(LIVE_DATA_PATH)) {
    fs.writeFileSync(LIVE_DATA_PATH, JSON.stringify(DEFAULT_LIVE_DATA, null, 2));
  }
}

function readLiveData() {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(LIVE_DATA_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      accounts: parsed.accounts || {},
      sessions: parsed.sessions || {},
      locationData: parsed.locationData || {},
    };
  } catch {
    return { ...DEFAULT_LIVE_DATA };
  }
}

function writeLiveData(nextData) {
  ensureDataFile();
  fs.writeFileSync(LIVE_DATA_PATH, JSON.stringify(nextData, null, 2));
}

function withLiveData(mutator) {
  const current = readLiveData();
  const next = mutator(current) || current;
  writeLiveData(next);
  return next;
}

function ensureAccount(data, accountId, accountName) {
  if (!data.accounts[accountId]) {
    data.accounts[accountId] = {
      id: accountId,
      name: accountName,
      locations: [{ id: 'main', name: 'Main Location' }],
      users: [],
      onboarding: accountId === 'demo-zestiq-com'
        ? { status: 'completed', currentStep: 'count', completedSteps: ['restaurant', 'location', 'suppliers', 'inventory', 'recipes', 'count'], skippedSteps: [], startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
        : { status: 'not_started', currentStep: 'restaurant', completedSteps: [], skippedSteps: [], startedAt: null, completedAt: null, updatedAt: null },
    };
  }

  if (!Array.isArray(data.accounts[accountId].locations) || data.accounts[accountId].locations.length === 0) {
    data.accounts[accountId].locations = [{ id: 'main', name: 'Main Location' }];
  }

  if (!Array.isArray(data.accounts[accountId].users)) {
    data.accounts[accountId].users = [];
  }

  if (!data.locationData[accountId]) {
    data.locationData[accountId] = {};
  }

  data.accounts[accountId].locations.forEach(location => {
    ensureLocationData(data, accountId, location.id);
  });

  return data.accounts[accountId];
}

function buildDefaultLocationData() {
  return {
    inventory: [],
    recipes: [],
    storageAreas: [],
    orders: [],
    invoices: [],
    suppliers: [],
    preppedRecipes: [],
    forecasts: [],
    inventoryCounts: [],
    integrations: {
      toast: {
        connected: false,
        provider: 'generic',
        connectionMode: 'import',
        restaurantId: '',
        salesData: [],
        menuItems: [],
        cogsCategories: [],
        lastSync: null,
      },
    },
  };
}

function ensureLocationData(data, accountId, locationId) {
  if (!data.locationData[accountId]) {
    data.locationData[accountId] = {};
  }
  if (!data.locationData[accountId][locationId]) {
    data.locationData[accountId][locationId] = buildDefaultLocationData();
  }
  return data.locationData[accountId][locationId];
}

// Shared live-data API
app.post('/api/v1/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const { id: accountId, name: accountName } = accountFromEmail(normalizedEmail);
  const role = roleFromEmail(normalizedEmail);
  const name = userNameFromEmail(normalizedEmail);
  const issuedToken = randomUUID();

  const result = withLiveData(data => {
    const account = ensureAccount(data, accountId, accountName);
    const now = new Date().toISOString();
    const existingUser = account.users.find(user => user.email === normalizedEmail);

    if (existingUser) {
      existingUser.name = name;
      existingUser.role = role;
      existingUser.status = 'Active';
      existingUser.lastLogin = now;
    } else {
      account.users.push({
        id: randomUUID(),
        name,
        email: normalizedEmail,
        role,
        status: 'Active',
        lastLogin: now,
      });
    }

    data.sessions[issuedToken] = {
      token: issuedToken,
      email: normalizedEmail,
      accountId,
      issuedAt: now,
    };

    return data;
  });

  const account = result.accounts[accountId];
  const user = account.users.find(u => u.email === normalizedEmail);

  return res.json({
    token: issuedToken,
    user,
    account: { id: account.id, name: account.name, onboarding: account.onboarding },
    locations: account.locations,
    activeLocationId: account.locations[0]?.id || 'main',
  });
});

app.get('/api/v1/auth/session/:token', (req, res) => {
  const { token } = req.params;
  const data = readLiveData();
  const session = data.sessions[token];
  if (!session) {
    return res.status(404).json({ error: 'session not found' });
  }

  const account = ensureAccount(data, session.accountId, session.accountId);
  const user = account.users.find(candidate => candidate.email === session.email);
  if (!user) {
    return res.status(404).json({ error: 'user not found for session' });
  }

  return res.json({
    token,
    user,
    account: { id: account.id, name: account.name, onboarding: account.onboarding },
    locations: account.locations,
    activeLocationId: account.locations[0]?.id || 'main',
  });
});

app.get('/api/v1/accounts/:accountId/users', (req, res) => {
  const { accountId } = req.params;
  const data = readLiveData();
  const account = data.accounts[accountId];
  if (!account) return res.status(404).json({ error: 'account not found' });
  return res.json({ users: account.users || [] });
});

app.post('/api/v1/accounts/:accountId/users', (req, res) => {
  const { accountId } = req.params;
  const { name, email, role } = req.body || {};
  if (!name || !email || !role) {
    return res.status(400).json({ error: 'name, email, role are required' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  const result = withLiveData(data => {
    const account = data.accounts[accountId];
    if (!account) return data;

    const exists = account.users.find(user => user.email === normalizedEmail);
    if (exists) return data;

    account.users.push({
      id: randomUUID(),
      name: String(name).trim(),
      email: normalizedEmail,
      role,
      status: 'Active',
      lastLogin: 'Never',
    });
    return data;
  });

  const account = result.accounts[accountId];
  if (!account) return res.status(404).json({ error: 'account not found' });
  return res.status(201).json({ users: account.users || [] });
});

app.put('/api/v1/accounts/:accountId/users/:userId', (req, res) => {
  const { accountId, userId } = req.params;
  const { name, email, role, status } = req.body || {};

  const result = withLiveData(data => {
    const account = data.accounts[accountId];
    if (!account) return data;

    const target = account.users.find(user => user.id === userId);
    if (!target) return data;

    if (name !== undefined) target.name = String(name).trim();
    if (email !== undefined) target.email = String(email).trim().toLowerCase();
    if (role !== undefined) target.role = role;
    if (status !== undefined) target.status = status;

    return data;
  });

  const account = result.accounts[accountId];
  if (!account) return res.status(404).json({ error: 'account not found' });
  return res.json({ users: account.users || [] });
});

app.delete('/api/v1/accounts/:accountId/users/:userId', (req, res) => {
  const { accountId, userId } = req.params;
  const result = withLiveData(data => {
    const account = data.accounts[accountId];
    if (!account) return data;
    account.users = (account.users || []).filter(user => user.id !== userId);
    return data;
  });

  const account = result.accounts[accountId];
  if (!account) return res.status(404).json({ error: 'account not found' });
  return res.json({ users: account.users || [] });
});

app.get('/api/v1/accounts/:accountId/locations', (req, res) => {
  const { accountId } = req.params;
  const data = readLiveData();
  const account = data.accounts[accountId];
  if (!account) return res.status(404).json({ error: 'account not found' });
  return res.json({ locations: account.locations || [] });
});

app.post('/api/v1/accounts/:accountId/locations', (req, res) => {
  const { accountId } = req.params;
  const { name } = req.body || {};
  const normalizedName = String(name || '').trim();
  if (!normalizedName) {
    return res.status(400).json({ error: 'location name is required' });
  }

  const result = withLiveData(data => {
    const account = data.accounts[accountId];
    if (!account) return data;

    const locationId = normalizeId(normalizedName);
    if (!account.locations.find(location => location.id === locationId)) {
      account.locations.push({ id: locationId, name: normalizedName });
      ensureLocationData(data, accountId, locationId);
    }
    return data;
  });

  const account = result.accounts[accountId];
  if (!account) return res.status(404).json({ error: 'account not found' });
  return res.status(201).json({ locations: account.locations || [] });
});

app.get('/api/v1/accounts/:accountId/locations/:locationId/data', (req, res) => {
  const { accountId, locationId } = req.params;
  const data = readLiveData();
  const account = data.accounts[accountId];
  if (!account) return res.status(404).json({ error: 'account not found' });

  const locationExists = (account.locations || []).some(location => location.id === locationId);
  if (!locationExists) return res.status(404).json({ error: 'location not found' });

  const locationData = ensureLocationData(data, accountId, locationId);
  return res.json(locationData);
});

app.put('/api/v1/accounts/:accountId/locations/:locationId/data', (req, res) => {
  const { accountId, locationId } = req.params;
  const { inventory: nextInventory, recipes: nextRecipes, storageAreas: nextStorageAreas } = req.body || {};

  const result = withLiveData(data => {
    const account = data.accounts[accountId];
    if (!account) return data;

    const locationExists = (account.locations || []).some(location => location.id === locationId);
    if (!locationExists) return data;

    const locationData = ensureLocationData(data, accountId, locationId);
    if (Array.isArray(nextInventory)) locationData.inventory = nextInventory;
    if (Array.isArray(nextRecipes)) locationData.recipes = nextRecipes;
    if (Array.isArray(nextStorageAreas)) locationData.storageAreas = nextStorageAreas;

    return data;
  });

  const account = result.accounts[accountId];
  if (!account) return res.status(404).json({ error: 'account not found' });
  const locationExists = (account.locations || []).some(location => location.id === locationId);
  if (!locationExists) return res.status(404).json({ error: 'location not found' });

  return res.json(result.locationData[accountId][locationId]);
});

app.get('/api/v1/accounts/:accountId/locations/:locationId/integrations/toast', (req, res) => {
  const { accountId, locationId } = req.params;
  const data = readLiveData();
  const account = data.accounts[accountId];
  if (!account) return res.status(404).json({ error: 'account not found' });

  const locationExists = (account.locations || []).some(location => location.id === locationId);
  if (!locationExists) return res.status(404).json({ error: 'location not found' });

  const locationData = ensureLocationData(data, accountId, locationId);
  return res.json({
    toast: locationData.integrations?.toast || buildDefaultLocationData().integrations.toast,
  });
});

app.put('/api/v1/accounts/:accountId/locations/:locationId/integrations/toast', (req, res) => {
  const { accountId, locationId } = req.params;
  const payload = req.body || {};

  const result = withLiveData(data => {
    const account = data.accounts[accountId];
    if (!account) return data;

    const locationExists = (account.locations || []).some(location => location.id === locationId);
    if (!locationExists) return data;

    const locationData = ensureLocationData(data, accountId, locationId);
    const existingToast = locationData.integrations?.toast || {};
    locationData.integrations = locationData.integrations || {};
    locationData.integrations.toast = {
      connected: typeof payload.connected === 'boolean' ? payload.connected : Boolean(existingToast.connected),
      provider: typeof payload.provider === 'string' ? payload.provider.slice(0, 80) : (existingToast.provider || 'generic'),
      connectionMode: payload.connectionMode === 'direct' ? 'direct' : 'import',
      restaurantId: typeof payload.restaurantId === 'string' ? payload.restaurantId : (existingToast.restaurantId || ''),
      salesData: Array.isArray(payload.salesData) ? payload.salesData : (existingToast.salesData || []),
      menuItems: Array.isArray(payload.menuItems) ? payload.menuItems : (existingToast.menuItems || []),
      cogsCategories: Array.isArray(payload.cogsCategories) ? payload.cogsCategories : (existingToast.cogsCategories || []),
      lastSync: payload.lastSync ?? existingToast.lastSync ?? null,
    };

    return data;
  });

  const account = result.accounts[accountId];
  if (!account) return res.status(404).json({ error: 'account not found' });
  const locationExists = (account.locations || []).some(location => location.id === locationId);
  if (!locationExists) return res.status(404).json({ error: 'location not found' });

  const locationData = result.locationData[accountId][locationId];
  return res.json({ toast: locationData.integrations?.toast || buildDefaultLocationData().integrations.toast });
});

app.post('/api/v1/accounts/:accountId/locations/:locationId/integrations/toast/import', (req, res) => {
  const { accountId, locationId } = req.params;
  const payload = req.body || {};

  const result = withLiveData(data => {
    const account = data.accounts[accountId];
    if (!account) return data;

    const locationExists = (account.locations || []).some(location => location.id === locationId);
    if (!locationExists) return data;

    const locationData = ensureLocationData(data, accountId, locationId);
    const normalized = normalizePosImportPayload(payload);
    locationData.integrations = locationData.integrations || {};
    locationData.integrations.toast = {
      ...(locationData.integrations.toast || buildDefaultLocationData().integrations.toast),
      connected: true,
      provider: String(req.body?.provider || locationData.integrations.toast?.provider || 'generic').slice(0, 80),
      connectionMode: 'import',
      salesData: normalized.salesData,
      menuItems: normalized.menuItems,
      lastSync: new Date().toISOString(),
    };

    return data;
  });

  const account = result.accounts[accountId];
  if (!account) return res.status(404).json({ error: 'account not found' });
  const locationExists = (account.locations || []).some(location => location.id === locationId);
  if (!locationExists) return res.status(404).json({ error: 'location not found' });

  const locationData = result.locationData[accountId][locationId];
  return res.json({ toast: locationData.integrations?.toast || buildDefaultLocationData().integrations.toast });
});

// Load OpenAPI
const openapiPath = path.resolve(process.cwd(), 'openapi.yaml');
let swaggerDocument = null;
if (fs.existsSync(openapiPath)) {
  const txt = fs.readFileSync(openapiPath, 'utf8');
  swaggerDocument = yaml.load(txt);
}

if (swaggerDocument) {
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, { explorer: true }));
}

app.get('/openapi.yaml', (req, res) => {
  if (!fs.existsSync(openapiPath)) return res.status(404).json({ error: 'not found' });
  res.type('text/yaml').send(fs.readFileSync(openapiPath, 'utf8'));
});

// In-memory stores (simple)
let inventory = [];
let recipes = [];
let suppliers = [];

function heuristicSuggest(inv = [], salesData = []) {
  const suggestions = [];
  inv.forEach(item => {
    const estDaily = (item.parLevel || 10) * 0.12;
    const days = estDaily > 0 ? Math.floor((item.currentStock || 0) / estDaily) : 999;
    if (days <= 7) {
      const qty = Math.max(1, Math.ceil(((item.parLevel || 0) - (item.currentStock || 0)) * 1.0));
      suggestions.push({
        itemId: item.id,
        itemName: item.name,
        currentStock: item.currentStock || 0,
        parLevel: item.parLevel || 0,
        suggestedQuantity: qty,
        unitCost: item.unitCost || 0,
        totalCost: qty * (item.unitCost || 0),
        supplier: item.supplier || 'Unknown',
        unit: item.unit || 'ea',
        priority: days <= 2 ? 'critical' : days <= 4 ? 'high' : 'medium',
        reasoning: `Heuristic: estimated ${days} days until stockout`,
        daysUntilStockout: days,
        confidence: 0.6,
      });
    }
  });
  return suggestions;
}

async function callOpenAI(prompt) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY not set');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful assistant that outputs JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 1000,
    })
  });
  const json = await res.json();
  return json?.choices?.[0]?.message?.content ?? json?.choices?.[0]?.text;
}

function parseJsonFromModelText(text) {
  if (!text || typeof text !== 'string') return null;

  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // fall through
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1]);
    } catch {
      // fall through
    }
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const slice = trimmed.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(slice);
    } catch {
      return null;
    }
  }

  return null;
}

function parseIngredientLineHeuristic(line) {
  const cleaned = String(line || '').trim().replace(/^[-*\u2022]\s*/, '');
  if (!cleaned) return null;

  const match = cleaned.match(/^([0-9]+(?:\.[0-9]+)?(?:\/[0-9]+)?)?\s*(oz|lb|lbs|g|gr|kg|ml|l|cup|cups|tbsp|tsp|ea|each|clove|cloves|slice|slices)?\s*(.+)$/i);
  if (!match) return cleaned;

  const qtyRaw = match[1] || '';
  const unitRaw = match[2] || '';
  const nameRaw = (match[3] || '').trim();
  const normalizedQty = qtyRaw.trim();
  const normalizedUnit = unitRaw.trim().toLowerCase();
  const normalizedName = nameRaw.replace(/\s+/g, ' ').trim();

  return [normalizedQty, normalizedUnit, normalizedName].filter(Boolean).join(' ').trim() || cleaned;
}

function normalizeRecipePayloadFallback(payload = {}) {
  const ingredientsRaw = Array.isArray(payload.ingredients) ? payload.ingredients : [];
  const ingredients = ingredientsRaw
    .map(parseIngredientLineHeuristic)
    .filter(Boolean);

  const priceNum = Number.parseFloat(String(payload.price ?? '0').replace(/[^0-9.]/g, ''));

  return {
    menuItemName: (payload.menuItemName || payload.name || 'Scanned Recipe').toString().trim() || 'Scanned Recipe',
    category: (payload.category || 'Uncategorized').toString().trim() || 'Uncategorized',
    price: Number.isFinite(priceNum) ? priceNum.toFixed(2) : '0.00',
    ingredients,
  };
}

// Inventory routes
app.get('/api/inventory', (req, res) => res.json({ items: inventory }));
app.post('/api/inventory', (req, res) => {
  const body = req.body || {};
  const id = `${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
  const item = { id, deletable: true, ...body };
  inventory.push(item);
  res.status(201).json(item);
});
app.post('/api/inventory/bulk-delete', (req, res) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids required' });
  const deleted = [];
  inventory = inventory.filter(i => {
    if (ids.includes(i.id)) {
      if (i.deletable === false) return true; // keep
      deleted.push(i.id);
      return false;
    }
    return true;
  });
  res.json({ deleted });
});
app.post('/api/inventory/merge', (req, res) => {
  const { primaryId, mergeIds, name } = req.body || {};
  const primary = inventory.find(i => i.id === primaryId);
  if (!primary) return res.status(404).json({ error: 'primary not found' });
  const totalStock = ((primary.currentStock || 0) + (mergeIds || []).reduce((s, id) => s + (inventory.find(i => i.id === id)?.currentStock || 0), 0));
  primary.currentStock = totalStock;
  if (name) primary.name = name;
  inventory = inventory.filter(i => !mergeIds.includes(i.id));
  res.json(primary);
});

// OCR endpoints
app.post('/api/scan', upload.single('file'), async (req, res) => {
  try {
    let imageData = null;
    if (req.file) {
      imageData = req.file.buffer.toString('base64');
      imageData = `data:${req.file.mimetype};base64,${imageData}`;
    } else if (req.body?.imageData) {
      imageData = req.body.imageData;
    }
    if (!imageData) return res.status(400).json({ error: 'imageData required' });
    const base64 = imageData.replace(/^data:image\/.+;base64,/, '');
    const buffer = Buffer.from(base64, 'base64');
    const { data: { text } } = await Tesseract.recognize(buffer, 'eng', { logger: m => {} });
    if (process.env.OPENAI_API_KEY) {
      const prompt = `Extract recipe fields from the following text. Return JSON with keys: menuItemName, category, price, ingredients (array of strings). Text:\n\n${text}`;
      try {
        const aiRes = await callOpenAI(prompt);
        let parsed = null;
        try { parsed = JSON.parse(aiRes); } catch (e) { parsed = null; }
        if (parsed && parsed.ingredients) return res.json(parsed);
      } catch (e) { console.error('OpenAI parse failed', e); }
    }
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const menuItemName = lines[0] || 'Scanned Recipe';
    let price = '';
    const ingredients = lines.filter(l => /\d/.test(l) || /tbsp|tsp|oz|lb|g|kg|cup|slice|clove/i.test(l));
    for (const l of lines.slice(0,5)) {
      const m = l.match(/\$?([0-9]+\.?[0-9]{0,2})/);
      if (m) { price = m[1]; break; }
    }
    res.json({ menuItemName, category: 'Uncategorized', price: price || '0.00', ingredients });
  } catch (err) {
    console.error('scan error', err);
    res.status(500).json({ error: 'OCR failed' });
  }
});

app.post('/api/scan/ai-enhance', async (req, res) => {
  try {
    const source = req.body || {};
    const normalized = normalizeRecipePayloadFallback(source);

    if (!source?.menuItemName && (!Array.isArray(source?.ingredients) || source.ingredients.length === 0)) {
      return res.status(400).json({ error: 'menuItemName or ingredients required' });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.json({
        ...normalized,
        aiUsed: false,
        aiAvailable: false,
        method: 'heuristic',
      });
    }

    const prompt = [
      'You normalize scanned recipe data into strict JSON.',
      'Return ONLY valid JSON with keys: menuItemName, category, price, ingredients.',
      'ingredients must be an array of concise strings in the form "quantity unit ingredient name" when possible.',
      'Do not include markdown.',
      '',
      `Input JSON: ${JSON.stringify(source)}`,
    ].join('\n');

    let modelResponse = null;
    try {
      const aiText = await callOpenAI(prompt);
      modelResponse = parseJsonFromModelText(aiText);
    } catch (error) {
      console.error('AI recipe enhancement failed, using fallback', error);
    }

    if (modelResponse && Array.isArray(modelResponse.ingredients)) {
      const aiNormalized = normalizeRecipePayloadFallback(modelResponse);
      return res.json({
        ...aiNormalized,
        aiUsed: true,
        aiAvailable: true,
        method: 'openai',
      });
    }

    return res.json({
      ...normalized,
      aiUsed: false,
      aiAvailable: true,
      method: 'heuristic',
    });
  } catch (err) {
    console.error('scan ai-enhance error', err);
    res.status(500).json({ error: 'AI enhancement failed' });
  }
});

app.post('/api/forecast/sales', async (req, res) => {
  try {
    const payload = req.body || {};
    const history = Array.isArray(payload.history) ? payload.history : [];
    const menuItems = Array.isArray(payload.menuItems) ? payload.menuItems : [];
    const inventory = Array.isArray(payload.inventory) ? payload.inventory : [];

    if (history.length === 0 || menuItems.length === 0) {
      return res.status(400).json({ error: 'history and menuItems are required' });
    }

    if (!process.env.OPENAI_API_KEY) {
      const forecast = buildForecastFromHistory({ history, menuItems, inventory, payload });
      return res.json({
        ...forecast,
        summary: forecast.summary || 'Forecast generated using historical POS trend and inventory context.',
        confidence: forecast.confidence || 0.7,
      });
    }

    const prompt = [
      'You are forecasting restaurant sales for one future day.',
      'Return STRICT JSON with keys: predictedMenuItems (array of {name, quantity}), ingredientUsage (array of {itemId, expectedUsage}), summary, confidence.',
      'Use the historical POS data, menu item mix, inventory availability, weather, events, seasonality, and day-of-week context.',
      'Be practical and conservative. Do not include markdown.',
      '', `Input JSON: ${JSON.stringify(payload)}`,
    ].join('\n');

    const aiText = await callOpenAI(prompt);
    const parsed = parseJsonFromModelText(aiText);

    if (parsed && Array.isArray(parsed.predictedMenuItems) && Array.isArray(parsed.ingredientUsage)) {
      return res.json({
        predictedMenuItems: parsed.predictedMenuItems,
        ingredientUsage: parsed.ingredientUsage.filter(item => inventory.some(entry => entry.id === item.itemId)),
        summary: parsed.summary || 'AI forecast prepared from historical sales, weather, and local events.',
        confidence: Number(parsed.confidence) || 0.8,
      });
    }

    throw new Error('AI forecast payload malformed');
  } catch (error) {
    console.error('sales forecast error', error);
    res.status(500).json({ error: 'Unable to generate sales forecast' });
  }
});

app.post('/api/scan-invoice', upload.single('file'), async (req, res) => {
  try {
    let imageData = null;
    if (req.file) {
      imageData = req.file.buffer.toString('base64');
      imageData = `data:${req.file.mimetype};base64,${imageData}`;
    } else if (req.body?.imageData) {
      imageData = req.body.imageData;
    }
    if (!imageData) return res.status(400).json({ error: 'imageData required' });
    const base64 = imageData.replace(/^data:image\/.+;base64,/, '');
    const buffer = Buffer.from(base64, 'base64');
    const { data: { text } } = await Tesseract.recognize(buffer, 'eng', { logger: m => {} });
    if (process.env.OPENAI_API_KEY) {
      const prompt = `Extract invoice fields from the following OCR text. Return JSON with keys: vendor, invoiceNumber, date (YYYY-MM-DD), total (number), items (array of {name,quantity,unit,unitCost,totalCost,category}). Text:\n\n${text}`;
      try {
        const aiRes = await callOpenAI(prompt);
        let parsed = null;
        try { parsed = JSON.parse(aiRes); } catch (e) { parsed = null; }
        if (parsed && parsed.items) return res.json(parsed);
      } catch (e) { console.error('OpenAI invoice parse failed', e); }
    }
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    let vendor = lines[0] || 'Unknown Vendor';
    let invoiceNumber = '';
    let date = new Date().toISOString().split('T')[0];
    let total = 0;
    const items = [];
    for (const l of lines.slice(0,10)) {
      const invMatch = l.match(/inv(?:oice)?\s*#?:?\s*([A-Z0-9-]+)/i);
      if (invMatch) invoiceNumber = invMatch[1];
      const dateMatch = l.match(/(\d{4}-\d{2}-\d{2})|(\d{1,2}\/\d{1,2}\/\d{2,4})/);
      if (dateMatch) { date = dateMatch[0]; break; }
    }
    for (const l of lines) {
      const m = l.match(/(.+?)\s+(\d+(?:[\.,]\d+)?)\s+(lbs|lb|oz|g|kg|each|ea|gallons|gal|case|unit|units|pack)?\s+\$?(\d+[\.,]?\d{0,2})/i);
      if (m) {
        const name = m[1].trim();
        const qty = parseFloat(m[2].replace(',', '.')) || 1;
        const unit = (m[3] || '').trim() || 'ea';
        const unitCost = parseFloat(m[4].replace(',', '.')) || 0;
        const totalCost = qty * unitCost;
        items.push({ name, quantity: qty, unit, unitCost, totalCost, category: 'Unknown' });
      }
    }
    for (let i = lines.length - 1; i >= 0; i--) {
      const l = lines[i];
      const m = l.match(/total\s*[:\-]?\s*\$?([0-9]+[\.,]?[0-9]{0,2})/i) || l.match(/\$([0-9]+[\.,]?[0-9]{0,2})/);
      if (m) { total = parseFloat(m[1].replace(',', '.')); break; }
    }
    res.json({ vendor, invoiceNumber, date, items, total });
  } catch (err) {
    console.error('invoice scan error', err);
    res.status(500).json({ error: 'OCR failed' });
  }
});

// Start HTTP + WebSocket server
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('WS: client connected');
  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'requestAiOrder') {
        const { inventory: inv = [], salesData = [] } = msg.payload || {};
        if (process.env.OPENAI_API_KEY) {
          const prompt = `Produce a JSON array of order suggestions. Inventory:${JSON.stringify(inv)} Sales:${JSON.stringify(salesData)}`;
          try {
            const text = await callOpenAI(prompt);
            let parsed;
            try { parsed = JSON.parse(text); } catch (e) { parsed = heuristicSuggest(inv, salesData); }
            ws.send(JSON.stringify({ type: 'aiOrder', data: parsed }));
          } catch (e) {
            const fallback = heuristicSuggest(inv, salesData);
            ws.send(JSON.stringify({ type: 'aiOrder', data: fallback }));
          }
        } else {
          const fallback = heuristicSuggest(inv, salesData);
          ws.send(JSON.stringify({ type: 'aiOrder', data: fallback }));
        }
      }
      if (msg.type === 'ping') ws.send(JSON.stringify({ type: 'pong' }));
    } catch (err) {
      console.error('ws message error', err);
      ws.send(JSON.stringify({ type: 'error', message: String(err) }));
    }
  });
  ws.on('close', () => console.log('WS: client disconnected'));
});

server.listen(PORT, () => console.log(`API + WS server listening on http://localhost:${PORT}`));
