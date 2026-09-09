import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSupplierOrdersPdf } from './supplierOrderPdf.js';

test('builds a valid branded supplier-order PDF with reviewed quantities', () => {
  const bytes = buildSupplierOrdersPdf({
    restaurantName: 'Zestaurant',
    drafts: [{
      supplier: 'Northern Produce Co.',
      items: [{ itemName: 'Roma Tomatoes', suggestedQuantity: 10, unit: 'kg', totalCost: 42.5 }],
    }],
  });
  const content = new TextDecoder().decode(bytes);
  assert.match(content, /^%PDF-1\.4/);
  assert.match(content, /ZestIQ/);
  assert.match(content, /Northern Produce Co\./);
  assert.match(content, /Roma Tomatoes/);
  assert.match(content, /ORDER TOTAL: \$42\.50/);
  assert.match(content, /%%EOF$/);
});

test('creates additional pages for multiple suppliers and long orders', () => {
  const items = Array.from({ length: 16 }, (_, index) => ({
    itemName: `Item ${index + 1}`,
    suggestedQuantity: index + 1,
    unit: 'case',
    totalCost: 10,
  }));
  const bytes = buildSupplierOrdersPdf({
    drafts: [
      { supplier: 'Supplier A', items },
      { supplier: 'Supplier B', items: items.slice(0, 1) },
    ],
  });
  const content = new TextDecoder().decode(bytes);
  assert.match(content, /\/Count 3/);
  assert.match(content, /Page 3 of 3/);
});

test('refuses to create an empty PDF', () => {
  assert.throws(() => buildSupplierOrdersPdf({ drafts: [] }), /At least one supplier order/);
});
