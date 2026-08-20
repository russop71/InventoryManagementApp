import { requireActiveUser } from './_authenticated-user.js';

const DEFAULT_MODEL = 'gpt-5.6-luna';
const MAX_IMAGE_DATA_LENGTH = 6_000_000;
const SUPPORTED_IMAGE_DATA_URL = /^data:image\/(?:jpeg|png|webp);base64,/i;

const recipeSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['menuItemName', 'category', 'price', 'yieldQuantity', 'yieldUnit', 'ingredients'],
  properties: {
    menuItemName: { type: 'string' },
    category: { type: 'string' },
    price: { type: 'number' },
    yieldQuantity: { type: 'number' },
    yieldUnit: { type: 'string' },
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['rawText', 'name', 'quantity', 'unit', 'matchedInventoryItemId', 'matchConfidence'],
        properties: {
          rawText: { type: 'string' },
          name: { type: 'string' },
          quantity: { type: 'number' },
          unit: { type: 'string' },
          matchedInventoryItemId: { type: 'string' },
          matchConfidence: { type: 'number' },
        },
      },
    },
  },
};

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

function normalizeInventoryCatalog(inventory) {
  if (!Array.isArray(inventory)) return [];
  return inventory
    .slice(0, 500)
    .map(item => ({
      id: String(item?.id || '').trim(),
      name: String(item?.name || '').trim(),
      unit: String(item?.unit || 'ea').trim() || 'ea',
      supplier: String(item?.supplier || '').trim(),
    }))
    .filter(item => item.id && item.name);
}

export function extractResponseText(payload) {
  if (typeof payload?.output_text === 'string') return payload.output_text;
  for (const item of payload?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === 'output_text' && typeof content.text === 'string') return content.text;
    }
  }
  return '';
}

export function normalizeScannedRecipe(payload, inventoryCatalog = []) {
  const catalog = normalizeInventoryCatalog(inventoryCatalog);
  const catalogById = new Map(catalog.map(item => [item.id, item]));
  const source = payload || {};
  const ingredients = Array.isArray(source.ingredients)
    ? source.ingredients.map(item => {
        const requestedId = String(item?.matchedInventoryItemId || '').trim();
        const catalogItem = catalogById.get(requestedId);
        const quantity = Number(item?.quantity);
        const confidence = Number(item?.matchConfidence);
        return {
          rawText: String(item?.rawText || item?.name || '').trim(),
          name: String(item?.name || 'Unknown ingredient').trim() || 'Unknown ingredient',
          quantity: Number.isFinite(quantity) && quantity >= 0 ? quantity : 0,
          unit: String(item?.unit || catalogItem?.unit || 'ea').trim() || 'ea',
          matchedInventoryItemId: catalogItem?.id || '',
          matchedInventoryItemName: catalogItem?.name || '',
          matchConfidence: catalogItem && Number.isFinite(confidence)
            ? Math.min(1, Math.max(0, confidence))
            : 0,
        };
      })
    : [];
  const price = Number(source.price);
  const yieldQuantity = Number(source.yieldQuantity);

  return {
    menuItemName: String(source.menuItemName || 'Scanned Recipe').trim() || 'Scanned Recipe',
    category: String(source.category || 'Prepped Items').trim() || 'Prepped Items',
    price: Number.isFinite(price) && price >= 0 ? price : 0,
    yieldQuantity: Number.isFinite(yieldQuantity) && yieldQuantity > 0 ? yieldQuantity : 1,
    yieldUnit: String(source.yieldUnit || 'batch').trim() || 'batch',
    ingredients,
    aiUsed: true,
    method: 'openai-vision-inventory-match',
  };
}

async function extractRecipe(imageData, inventoryCatalog, apiKey) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_RECIPE_MODEL || DEFAULT_MODEL,
      input: [{
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: [
              'Read this handwritten or printed restaurant recipe.',
              'Transcribe the recipe name, category, selling price when present, yield, and every ingredient quantity and unit.',
              'Match each ingredient to the closest item in the inventory catalog below.',
              'Use matchedInventoryItemId only when it exactly equals an ID from the catalog. Otherwise return an empty string.',
              'Set matchConfidence from 0 to 1. Use a conservative score when the handwriting or match is uncertain.',
              'Do not invent costs or prices. Costs are calculated separately from stored inventory prices.',
              `Inventory catalog: ${JSON.stringify(inventoryCatalog)}`,
            ].join('\n'),
          },
          { type: 'input_image', image_url: imageData, detail: 'high' },
        ],
      }],
      text: {
        format: {
          type: 'json_schema',
          name: 'inventory_matched_recipe',
          strict: true,
          schema: recipeSchema,
        },
      },
      max_output_tokens: 2500,
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload?.error?.message || `OpenAI request failed (${response.status})`);
    error.status = response.status;
    error.code = payload?.error?.code;
    throw error;
  }

  const outputText = extractResponseText(payload);
  if (!outputText) throw new Error('OpenAI returned no recipe data');
  return normalizeScannedRecipe(JSON.parse(outputText), inventoryCatalog);
}

export function mapRecipeScanError(error) {
  const status = Number(error?.status);
  if ([401, 403].includes(status)) {
    return { status: 503, error: 'AI recipe scanning is not configured correctly' };
  }
  if (status === 429 && error?.code === 'insufficient_quota') {
    return { status: 503, error: 'OpenAI API quota is exhausted. Add API billing or credits, then try again.' };
  }
  if (status === 429) {
    return { status: 429, error: 'AI recipe scanning is busy. Try again shortly.' };
  }
  return { status: 502, error: 'Recipe extraction failed. Try a clearer, well-lit photo.' };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    await requireActiveUser(req);
  } catch (error) {
    return res.status(Number(error?.status) || 401).json({ error: error?.message || 'Sign in is required' });
  }

  const body = parseJsonBody(req);
  const imageData = body?.imageData;
  if (typeof imageData !== 'string' || !SUPPORTED_IMAGE_DATA_URL.test(imageData)) {
    return res.status(400).json({ error: 'A JPEG, PNG, or WebP recipe image is required' });
  }
  if (imageData.length > MAX_IMAGE_DATA_LENGTH) {
    return res.status(413).json({ error: 'Recipe image is too large. Use a file under 4 MB.' });
  }

  const inventoryCatalog = normalizeInventoryCatalog(body?.inventory);
  if (inventoryCatalog.length === 0) {
    return res.status(400).json({ error: 'Add inventory items before scanning a recipe so ingredients can be matched and costed.' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'AI recipe scanning is not configured' });

  try {
    return res.status(200).json(await extractRecipe(imageData, inventoryCatalog, apiKey));
  } catch (error) {
    console.error('api/scan error', error);
    const mappedError = mapRecipeScanError(error);
    return res.status(mappedError.status).json({ error: mappedError.error });
  }
}
