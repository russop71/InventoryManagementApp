import { requireActiveUser } from './_authenticated-user.js';
import { enforceAiQuota, recordAiUsage } from './_ai-quota.js';

const DEFAULT_MODEL = 'gpt-5.6-luna';
const MAX_DOCUMENT_DATA_LENGTH = 6_000_000;
const SUPPORTED_DOCUMENT_DATA_URL = /^data:(?:image\/(?:jpeg|png|webp)|application\/pdf);base64,/i;

const invoiceSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['vendor', 'invoiceNumber', 'date', 'items', 'total'],
  properties: {
    vendor: { type: 'string' },
    invoiceNumber: { type: 'string' },
    date: { type: 'string', description: 'Invoice date in YYYY-MM-DD format, or an empty string.' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'quantity', 'unit', 'unitCost', 'totalCost', 'category'],
        properties: {
          name: { type: 'string' },
          quantity: { type: 'number' },
          unit: { type: 'string' },
          unitCost: { type: 'number' },
          totalCost: { type: 'number' },
          category: { type: 'string' },
        },
      },
    },
    total: { type: 'number' },
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

export function extractResponseText(payload) {
  if (typeof payload?.output_text === 'string') return payload.output_text;
  for (const item of payload?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === 'output_text' && typeof content.text === 'string') return content.text;
    }
  }
  return '';
}

export function normalizeInvoice(payload) {
  const source = payload || {};
  const items = Array.isArray(source.items)
    ? source.items.map((item) => {
        const quantity = Number(item?.quantity);
        const unitCost = Number(item?.unitCost);
        const totalCost = Number(item?.totalCost);
        const safeQuantity = Number.isFinite(quantity) && quantity >= 0 ? quantity : 0;
        const safeUnitCost = Number.isFinite(unitCost) && unitCost >= 0 ? unitCost : 0;
        return {
          name: String(item?.name || 'Unknown item').trim() || 'Unknown item',
          quantity: safeQuantity,
          unit: String(item?.unit || 'ea').trim() || 'ea',
          unitCost: safeUnitCost,
          totalCost: Number.isFinite(totalCost) && totalCost >= 0 ? totalCost : safeQuantity * safeUnitCost,
          category: String(item?.category || 'Uncategorized').trim() || 'Uncategorized',
        };
      })
    : [];

  const statedTotal = Number(source.total);
  const calculatedTotal = items.reduce((sum, item) => sum + item.totalCost, 0);

  return {
    vendor: String(source.vendor || 'Unknown supplier').trim() || 'Unknown supplier',
    invoiceNumber: String(source.invoiceNumber || '').trim(),
    date: /^\d{4}-\d{2}-\d{2}$/.test(String(source.date || '')) ? String(source.date) : '',
    items,
    total: Number.isFinite(statedTotal) && statedTotal >= 0 ? statedTotal : calculatedTotal,
    aiUsed: true,
    method: 'openai-vision',
  };
}

async function extractInvoice(imageData, apiKey) {
  const documentInput = imageData.startsWith('data:application/pdf')
    ? { type: 'input_file', filename: 'invoice.pdf', file_data: imageData }
    : { type: 'input_image', image_url: imageData, detail: 'high' };

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_INVOICE_MODEL || DEFAULT_MODEL,
      input: [{
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: [
              'Extract this restaurant supplier invoice.',
              'Copy printed values; do not invent missing line items.',
              'Use an empty string when invoice number or date is unreadable.',
              'Normalize units to concise labels such as ea, case, kg, lb, L, or mL.',
              'Choose a practical restaurant inventory category for each item.',
            ].join('\n'),
          },
          documentInput,
        ],
      }],
      text: {
        format: {
          type: 'json_schema',
          name: 'restaurant_invoice',
          strict: true,
          schema: invoiceSchema,
        },
      },
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
  if (!outputText) throw new Error('OpenAI returned no invoice data');
  return normalizeInvoice(JSON.parse(outputText));
}

export function mapInvoiceExtractionError(error) {
  const status = Number(error?.status);
  if (error?.code === 'AI_DAILY_LIMIT') return { status: 429, error: error.message };
  if ([401, 403].includes(status)) {
    return { status: 503, error: 'AI invoice scanning is not configured correctly' };
  }
  if (status === 429 && error?.code === 'insufficient_quota') {
    return { status: 503, error: 'OpenAI API quota is exhausted. Add API billing or credits, then try again.' };
  }
  if (status === 429) {
    return { status: 429, error: 'AI invoice scanning is busy. Try again shortly.' };
  }
  return { status: 502, error: 'Invoice extraction failed. Try a clearer image or PDF.' };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let appUser;
  try {
    ({ appUser } = await requireActiveUser(req));
  } catch (error) {
    return res.status(Number(error?.status) || 401).json({ error: error?.message || 'Sign in is required' });
  }

  const { imageData } = parseJsonBody(req);
  if (typeof imageData !== 'string' || !SUPPORTED_DOCUMENT_DATA_URL.test(imageData)) {
    return res.status(400).json({ error: 'A JPEG, PNG, WebP, or PDF invoice is required' });
  }
  if (imageData.length > MAX_DOCUMENT_DATA_LENGTH) {
    return res.status(413).json({ error: 'Invoice file is too large. Use a file under 4 MB.' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'AI invoice scanning is not configured' });

  try {
    await enforceAiQuota({ accountId: appUser.account_id, userId: appUser.id, eventName: 'ai_invoice_scan' });
    const result = await extractInvoice(imageData, apiKey);
    await recordAiUsage({ accountId: appUser.account_id, userId: appUser.id, eventName: 'ai_invoice_scan', path: '/app/invoice-scanner' }).catch(() => {});
    return res.status(200).json(result);
  } catch (error) {
    console.error('api/scan-invoice error', error);
    const mappedError = mapInvoiceExtractionError(error);
    return res.status(mappedError.status).json({ error: mappedError.error });
  }
}
