import { requireActiveUser } from '../_authenticated-user.js';
import { enforceAiQuota, recordAiUsage } from '../_ai-quota.js';

const DEFAULT_MODEL = 'gpt-5.6-luna';

function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch { return {}; }
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function responseText(payload) {
  if (typeof payload?.output_text === 'string') return payload.output_text;
  for (const output of payload?.output || []) {
    for (const content of output?.content || []) {
      if (content?.type === 'output_text' && typeof content.text === 'string') return content.text;
    }
  }
  return '';
}

function normalizeForecast(value, inventoryIds) {
  const allowedIds = new Set(inventoryIds);
  const usageByItem = new Map();
  for (const item of Array.isArray(value?.ingredientUsage) ? value.ingredientUsage : []) {
    const itemId = String(item?.itemId || '');
    const expectedUsage = Math.max(0, number(item?.expectedUsage));
    if (allowedIds.has(itemId) && expectedUsage > 0) usageByItem.set(itemId, expectedUsage);
  }
  return {
    predictedMenuItems: (Array.isArray(value?.predictedMenuItems) ? value.predictedMenuItems : []).slice(0, 120).map(item => ({
      name: String(item?.name || '').trim().slice(0, 160),
      quantity: Math.max(0, Math.round(number(item?.quantity))),
    })).filter(item => item.name && item.quantity > 0),
    ingredientUsage: [...usageByItem.entries()].map(([itemId, expectedUsage]) => ({ itemId, expectedUsage })),
    summary: String(value?.summary || 'Forecast generated from your sales history and local conditions.').trim().slice(0, 600),
    confidence: Math.max(0, Math.min(1, number(value?.confidence, 0.6))),
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let appUser;
  try {
    ({ appUser } = await requireActiveUser(req));
  } catch (error) {
    return res.status(Number(error?.status) || 401).json({ error: error?.message || 'Sign in is required' });
  }

  const body = readBody(req);
  const date = String(body.date || '');
  const expectedRevenue = Math.max(0, number(body.expectedRevenue));
  const inventory = Array.isArray(body.inventory) ? body.inventory.slice(0, 1000).map(item => ({
    id: String(item?.id || ''), name: String(item?.name || '').slice(0, 160), unit: String(item?.unit || '').slice(0, 32), category: String(item?.category || '').slice(0, 80),
  })).filter(item => item.id && item.name) : [];
  const history = Array.isArray(body.history) ? body.history.slice(-90) : [];
  const menuItems = Array.isArray(body.menuItems) ? body.menuItems.slice(0, 300) : [];

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || expectedRevenue <= 0 || !inventory.length || !history.length) {
    return res.status(400).json({ error: 'A date, expected revenue, inventory catalog and sales history are required' });
  }
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'AI forecasting is not configured' });

  try {
    await enforceAiQuota({ accountId: appUser.account_id, userId: appUser.id, eventName: 'ai_sales_forecast' });
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: process.env.OPENAI_FORECAST_MODEL || DEFAULT_MODEL,
        input: [{ role: 'user', content: [{ type: 'input_text', text: [
          'Create a conservative one-day restaurant demand forecast.',
          'Use historical sales, the chosen revenue target, local weather and event context.',
          'Return only expected menu quantities and inventory ingredient usage that maps to the supplied inventory IDs.',
          'Do not invent inventory IDs, costs, suppliers or operational facts. Keep the summary short and explain the largest demand driver.',
          `Forecast date: ${date}`,
          `Expected revenue: ${expectedRevenue}`,
          `Weather: ${JSON.stringify(body.weather || {})}`,
          `Events: ${JSON.stringify(body.events || {})}`,
          `Sales history: ${JSON.stringify(history)}`,
          `Menu items: ${JSON.stringify(menuItems)}`,
          `Inventory catalog: ${JSON.stringify(inventory)}`,
        ].join('\n') }] }],
        text: { format: { type: 'json_schema', name: 'restaurant_demand_forecast', strict: true, schema: {
          type: 'object', additionalProperties: false, required: ['predictedMenuItems', 'ingredientUsage', 'summary', 'confidence'], properties: {
            predictedMenuItems: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'quantity'], properties: { name: { type: 'string' }, quantity: { type: 'number' } } } },
            ingredientUsage: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['itemId', 'expectedUsage'], properties: { itemId: { type: 'string' }, expectedUsage: { type: 'number' } } } },
            summary: { type: 'string' }, confidence: { type: 'number' },
          },
        } } },
      }),
    });
    const payload = await response.json();
    if (!response.ok) throw Object.assign(new Error(payload?.error?.message || 'Forecast request failed'), { status: response.status, code: payload?.error?.code });
    const text = responseText(payload);
    if (!text) throw new Error('AI returned no forecast');
    const forecast = normalizeForecast(JSON.parse(text), inventory.map(item => item.id));
    await recordAiUsage({ accountId: appUser.account_id, userId: appUser.id, eventName: 'ai_sales_forecast', path: '/app/forecasting', metadata: { date, weather: body.weather?.summary || null } }).catch(() => {});
    return res.status(200).json(forecast);
  } catch (error) {
    const quotaError = error?.status === 429 && error?.code === 'insufficient_quota';
    return res.status(quotaError ? 503 : Number(error?.status) || 502).json({ error: quotaError ? 'OpenAI API quota is exhausted. Add API billing or credits, then try again.' : error?.message || 'Forecast generation failed' });
  }
}
