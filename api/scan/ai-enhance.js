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

function normalizePayload(payload) {
  const source = payload?.recipe || payload || {};
  const ingredients = Array.isArray(source.ingredients)
    ? source.ingredients
        .map((item) => (typeof item === 'string' ? item.trim() : String(item || '').trim()))
        .filter(Boolean)
    : [];

  const priceNum = Number.parseFloat(String(source.price ?? '0').replace(/[^0-9.]/g, ''));

  return {
    menuItemName: (source.menuItemName || source.name || 'Scanned Recipe').toString().trim() || 'Scanned Recipe',
    category: (source.category || 'Uncategorized').toString().trim() || 'Uncategorized',
    price: Number.isFinite(priceNum) ? priceNum.toFixed(2) : '0.00',
    ingredients,
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

async function callOpenAIForEnhance(input, apiKey) {
  const prompt = [
    'Normalize this scanned recipe object and return strict JSON only.',
    'Required keys: menuItemName, category, price, ingredients.',
    'ingredients must be an array of concise ingredient lines.',
    'No markdown, no explanations.',
    '',
    `Input JSON: ${JSON.stringify(input)}`,
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
        { role: 'system', content: 'You output strict valid JSON only.' },
        { role: 'user', content: prompt },
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
  if (!parsed) throw new Error('OpenAI returned non-JSON response for ai-enhance');

  return parsed;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = parseJsonBody(req);
    const normalizedInput = normalizePayload(body);

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(200).json({
        ...normalizedInput,
        aiUsed: false,
        aiAvailable: false,
        method: 'heuristic',
      });
    }

    let aiOutput;
    try {
      aiOutput = await callOpenAIForEnhance(normalizedInput, apiKey);
    } catch (error) {
      console.error('api/scan/ai-enhance openai error', error);
      const aiAvailable = !isOpenAIUnavailableError(error);
      return res.status(200).json({
        ...normalizedInput,
        aiUsed: false,
        aiAvailable,
        method: 'heuristic',
      });
    }

    const normalizedOutput = normalizePayload(aiOutput);
    return res.status(200).json({
      ...normalizedOutput,
      aiUsed: true,
      aiAvailable: true,
      method: 'openai',
    });
  } catch (error) {
    console.error('api/scan/ai-enhance error', error);
    return res.status(500).json({ error: 'AI enhancement failed' });
  }
}
