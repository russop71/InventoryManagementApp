import { requireActiveUser } from './_authenticated-user.js';
import { enforceAiQuota, recordAiUsage } from './_ai-quota.js';

const DEFAULT_MODEL = 'gpt-5.6-luna';
const MAX_IMAGE_DATA_LENGTH = 6_000_000;
const SUPPORTED_IMAGE_DATA_URL = /^data:image\/(?:jpeg|png|webp);base64,/i;
const MIN_NAME_MATCH_SCORE = 0.82;
const MIN_NAME_MATCH_MARGIN = 0.06;
const RECIPE_NAME_STOP_WORDS = new Set([
  'bottle', 'bottles', 'can', 'cans', 'case', 'cases', 'cs', 'cup', 'cups', 'ea', 'each',
  'g', 'gram', 'grams', 'jar', 'jars', 'kg', 'kilogram', 'kilograms', 'l', 'lb', 'lbs',
  'liter', 'liters', 'litre', 'litres', 'ml', 'ounce', 'ounces', 'oz', 'pack', 'packs',
  'pkg', 'pound', 'pounds', 'tablespoon', 'tablespoons', 'tbsp', 'teaspoon', 'teaspoons',
  'tsp', 'unit', 'units',
]);

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

function singularizeIngredientToken(token) {
  if (token.length <= 3 || token.endsWith('ss') || token.endsWith('us') || token.endsWith('is')) return token;
  if (token.endsWith('ies') && token.length > 4) return `${token.slice(0, -3)}y`;
  if (token.endsWith('oes') && token.length > 4) return token.slice(0, -2);
  if (/(?:ches|shes|xes|zes)$/.test(token)) return token.slice(0, -2);
  if (token.endsWith('s')) return token.slice(0, -1);
  return token;
}

export function normalizeRecipeIngredientName(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\bevoo\b/g, 'extra virgin olive oil')
    .replace(/\ball[\s-]+purpose\b/g, 'ap')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter(token => token && !/^\d+(?:\.\d+)?$/.test(token) && !RECIPE_NAME_STOP_WORDS.has(token))
    .map(singularizeIngredientToken)
    .join(' ')
    .trim();
}

function ingredientNameScore(sourceName, inventoryName) {
  const source = normalizeRecipeIngredientName(sourceName);
  const candidate = normalizeRecipeIngredientName(inventoryName);
  if (!source || !candidate) return 0;
  if (source === candidate) return 1;

  const sourceTokens = new Set(source.split(' '));
  const candidateTokens = new Set(candidate.split(' '));
  const sharedCount = [...sourceTokens].filter(token => candidateTokens.has(token)).length;
  if (sharedCount === 0) return 0;

  const sourceCoverage = sharedCount / sourceTokens.size;
  const candidateCoverage = sharedCount / candidateTokens.size;
  if (sourceCoverage === 1) return 0.9 + (0.09 * candidateCoverage);
  if (candidateCoverage === 1) return 0.78 + (0.08 * sourceCoverage);

  const diceScore = (2 * sharedCount) / (sourceTokens.size + candidateTokens.size);
  return diceScore >= 0.8 ? 0.72 + (0.18 * diceScore) : 0.55 * diceScore;
}

function bestIngredientScore(ingredient, catalogItem) {
  const extractedName = String(ingredient?.name || '').trim();
  const rawText = String(ingredient?.rawText || '').trim();
  return Math.max(
    ingredientNameScore(extractedName, catalogItem.name),
    ingredientNameScore(rawText, catalogItem.name),
  );
}

function resolveInventoryMatch(ingredient, catalog) {
  const requestedId = String(ingredient?.matchedInventoryItemId || '').trim();
  const requestedItem = catalog.find(item => item.id === requestedId);
  const suppliedConfidence = Number(ingredient?.matchConfidence);
  const aiConfidence = Number.isFinite(suppliedConfidence)
    ? Math.min(1, Math.max(0, suppliedConfidence))
    : 0;
  const ranked = catalog
    .map(item => ({ item, score: bestIngredientScore(ingredient, item) }))
    .filter(entry => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.item.name.localeCompare(right.item.name));
  const best = ranked[0];
  const runnerUp = ranked[1];

  if (best?.score >= MIN_NAME_MATCH_SCORE) {
    const tied = runnerUp && (best.score - runnerUp.score) < MIN_NAME_MATCH_MARGIN;
    if (!tied) return { item: best.item, confidence: best.score };

    const requestedRank = requestedItem
      ? ranked.find(entry => entry.item.id === requestedItem.id)
      : null;
    if (requestedRank && (best.score - requestedRank.score) < MIN_NAME_MATCH_MARGIN && aiConfidence >= 0.7) {
      return { item: requestedRank.item, confidence: Math.max(requestedRank.score, aiConfidence) };
    }
    return null;
  }

  if (requestedItem) {
    const requestedScore = bestIngredientScore(ingredient, requestedItem);
    if (requestedScore >= 0.72 && aiConfidence >= 0.7) {
      return { item: requestedItem, confidence: Math.max(requestedScore, aiConfidence) };
    }
  }

  return null;
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
  const source = payload || {};
  const ingredients = Array.isArray(source.ingredients)
    ? source.ingredients.map(item => {
        const inventoryMatch = resolveInventoryMatch(item, catalog);
        const catalogItem = inventoryMatch?.item;
        const quantity = Number(item?.quantity);
        const extractedName = String(item?.name || 'Unknown ingredient').trim() || 'Unknown ingredient';
        return {
          rawText: String(item?.rawText || extractedName).trim(),
          name: catalogItem?.name || extractedName,
          quantity: Number.isFinite(quantity) && quantity >= 0 ? quantity : 0,
          unit: String(item?.unit || catalogItem?.unit || 'ea').trim() || 'ea',
          matchedInventoryItemId: catalogItem?.id || '',
          matchedInventoryItemName: catalogItem?.name || '',
          matchConfidence: inventoryMatch?.confidence || 0,
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
              'Match each ingredient to an item in the inventory catalog below by its saved inventory name.',
              'When matched, copy the catalog name exactly into name and copy its exact ID into matchedInventoryItemId.',
              'Never invent, paraphrase, or alter a matched inventory name or ID. If the match is ambiguous, return the transcribed ingredient name and an empty matchedInventoryItemId.',
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
  if (error?.code === 'AI_DAILY_LIMIT') return { status: 429, error: error.message };
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

  let appUser;
  try {
    ({ appUser } = await requireActiveUser(req));
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
    await enforceAiQuota({ accountId: appUser.account_id, userId: appUser.id, eventName: 'ai_recipe_scan' });
    const result = await extractRecipe(imageData, inventoryCatalog, apiKey);
    await recordAiUsage({ accountId: appUser.account_id, userId: appUser.id, eventName: 'ai_recipe_scan', path: '/app/recipes' }).catch(() => {});
    return res.status(200).json(result);
  } catch (error) {
    console.error('api/scan error', error);
    const mappedError = mapRecipeScanError(error);
    return res.status(mappedError.status).json({ error: mappedError.error });
  }
}
