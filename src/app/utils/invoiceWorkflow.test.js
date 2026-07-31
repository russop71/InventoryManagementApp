import test from 'node:test';
import assert from 'node:assert/strict';
import { groupBySupplier, calculateInvoiceTotal, filterInvoiceItems } from './invoiceWorkflow.js';

test('groups order suggestions by supplier and totals each supplier group', () => {
  const suggestions = [
    { itemId: '1', supplier: 'Sysco', totalCost: 40 },
    { itemId: '2', supplier: 'US Foods', totalCost: 20 },
    { itemId: '3', supplier: 'Sysco', totalCost: 30 },
  ];

  const grouped = groupBySupplier(suggestions);

  assert.deepEqual(grouped, [
    { supplier: 'Sysco', items: [suggestions[0], suggestions[2]], totalCost: 70 },
    { supplier: 'US Foods', items: [suggestions[1]], totalCost: 20 },
  ]);
});

test('calculates invoice totals from line items', () => {
  const items = [
    { quantity: 2, cost: 10 },
    { quantity: 1, cost: 15 },
  ];

  assert.equal(calculateInvoiceTotal(items), 25);
});

test('filters inventory items by search query', () => {
  const inventory = [
    { id: '1', name: 'Chicken Breast', supplier: 'Sysco' },
    { id: '2', name: 'Beef Short Rib', supplier: 'US Foods' },
    { id: '3', name: 'Chicken Thigh', supplier: 'Sysco' },
  ];

  const results = filterInvoiceItems(inventory, 'chicken');

  assert.deepEqual(results.map(item => item.id), ['1', '3']);
});
