function parseJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return {};
}

function parseJsonFromModelText(text) {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    // continue
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced && fenced[1]) {
    try {
      return JSON.parse(fenced[1]);
    } catch {
      // continue
    }
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try {
      return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
    } catch {
      return null;
    }
  }

  return null;
}

function normalizeScanPayload(payload) {
  const recipe = payload?.recipe || payload || {};
  const name = (recipe.menuItemName || recipe.menu_item_name || recipe.name || 'Scanned Recipe').toString().trim();
  const category = (recipe.category || 'Uncategorized').toString().trim();
  const priceSource = recipe.price ?? recipe.price_usd ?? recipe.priceUsd ?? '0.00';
  const priceNum = Number.parseFloat(String(priceSource).replace(/[^0-9.]/g, ''));
  const ingredients = Array.isArray(recipe.ingredients)
    ? recipe.ingredients
        .map((item) => (typeof item === 'string' ? item.trim() : String(item || '').trim()))
        .filter(Boolean)
    : [];

  return {
    menuItemName: name || 'Scanned Recipe',
    category: category || 'Uncategorized',
    price: Number.isFinite(priceNum) ? priceNum.toFixed(2) : '0.00',
    ingredients,
    aiUsed: Boolean(payload?.aiUsed),
    method: payload?.method || (payload?.aiUsed ? 'openai' : 'fallback'),
  };
}

function isOpenAIUnavailableError(error) {
  const status = Number(error?.openaiStatus || 0);
  const code = String(error?.openaiCode || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();

  if ([401, 402, 403, 429].includes(status)) return true;
  if (code === 'insufficient_quota') return true;
  if (message.includes('quota') || message.includes('billing') || message.includes('rate limit')) return true;
  return false;
}

async function callOpenAIForRecipeScan(imageData, apiKey) {
  const prompt = [
    'Extract recipe fields from this image and return strict JSON only.',
    'Required JSON keys: menuItemName, category, price, ingredients.',
    'ingredients must be an array of concise strings (for example: "2 tbsp olive oil").',
    'If a field is missing, infer best guess. No markdown.',
  ].join('\n');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content: 'You output strict valid JSON only.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageData } },
          ],
        },
      ],
      max_tokens: 900,
    }),
  });

  const json = await response.json();
  if (!response.ok) {
    const message = json?.error?.message || `OpenAI request failed (${response.status})`;
    const error = new Error(message);
    error.openaiStatus = response.status;
    error.openaiCode = json?.error?.code;
    throw error;
  }

  const text = json?.choices?.[0]?.message?.content || '';
  const parsed = parseJsonFromModelText(text);
  if (!parsed) throw new Error('OpenAI returned non-JSON response for scan');

  return {
    ...parsed,
    aiUsed: true,
    method: 'openai-vision',
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = parseJsonBody(req);
    const imageData = body?.imageData;
    if (!imageData || typeof imageData !== 'string') {
      return res.status(400).json({ error: 'imageData required' });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(503).json({
        error: 'OPENAI_API_KEY not configured',
        aiAvailable: false,
      });
    }

    const parsed = await callOpenAIForRecipeScan(imageData, apiKey);
    return res.status(200).json(normalizeScanPayload(parsed));
  } catch (error) {
    console.error('api/scan error', error);
    if (isOpenAIUnavailableError(error)) {
      return res.status(503).json({
        error: 'AI provider temporarily unavailable',
        aiAvailable: false,
      });
    }
    return res.status(500).json({ error: 'Recipe scan failed' });
  }
}
