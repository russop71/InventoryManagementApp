import test from 'node:test';
import assert from 'node:assert/strict';

import { extractResponseText, normalizeInvoice } from './scan-invoice.js';

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
