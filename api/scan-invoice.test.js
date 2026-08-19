import test from 'node:test';
import assert from 'node:assert/strict';

import { extractResponseText, mapInvoiceExtractionError, normalizeInvoice } from './scan-invoice.js';

test('extractResponseText supports Responses API output content', () => {
  const text = extractResponseText({
    output: [{ content: [{ type: 'output_text', text: '{"vendor":"Daily Seafood"}' }] }],
  });

  assert.equal(text, '{"vendor":"Daily Seafood"}');
});

test('normalizeInvoice sanitizes numbers and calculates missing line totals', () => {
  const invoice = normalizeInvoice({
    vendor: ' Daily Seafood ',
    invoiceNumber: 'INV-42',
    date: '2026-08-18',
    items: [{ name: 'Salmon', quantity: '2', unit: 'case', unitCost: '45.50', category: 'Seafood' }],
  });

  assert.equal(invoice.vendor, 'Daily Seafood');
  assert.equal(invoice.items[0].totalCost, 91);
  assert.equal(invoice.total, 91);
  assert.equal(invoice.aiUsed, true);
});

test('mapInvoiceExtractionError distinguishes exhausted quota from a temporary rate limit', () => {
  assert.deepEqual(
    mapInvoiceExtractionError({ status: 429, code: 'insufficient_quota' }),
    { status: 503, error: 'OpenAI API quota is exhausted. Add API billing or credits, then try again.' },
  );
  assert.deepEqual(
    mapInvoiceExtractionError({ status: 429, code: 'rate_limit_exceeded' }),
    { status: 429, error: 'AI invoice scanning is busy. Try again shortly.' },
  );
});
