import test from 'node:test';
import assert from 'node:assert/strict';
import {
  groupBySupplier,
  calculateInvoiceTotal,
  filterInvoiceItems,
  hasDuplicateInvoiceNumber,
  normalizeInventoryItemName,
  inventoryItemMatchesInvoiceName,
  resolveInvoiceInventoryItem,
  sortInvoicesNewestFirst,
  sortRecordsNewestFirst,
} from './invoiceWorkflow.js';

test('orders put latest additions first on equal dates without mutating stored order', () => {
  const orders = [
    { id: 'old', date: '2026-09-19' },
    { id: 'first', date: '2026-09-20', createdAt: '2026-09-20T09:00:00Z' },
    { id: 'latest', date: '2026-09-20', createdAt: '2026-09-20T10:00:00Z' },
  ];
  assert.deepEqual(sortRecordsNewestFirst(orders).map(order => order.id), ['latest', 'first', 'old']);
  assert.equal(orders[0].id, 'old');
});

test('sorts invoices newest first with creation and legacy insertion tie breakers', () => {
  const invoices = [
    { id: 'older', date: '2026-08-31' },
    { id: 'same-early', date: '2026-09-20', createdAt: '2026-09-20T10:00:00Z' },
    { id: 'invalid', date: 'not-a-date' },
    { id: 'same-late', date: '2026-09-20', createdAt: '2026-09-20T12:00:00Z' },
    { id: 'legacy-first', date: '2026-09-19' },
    { id: 'legacy-last', date: '2026-09-19' },
  ];
  assert.deepEqual(sortInvoicesNewestFirst(invoices).map(item => item.id),
    ['same-late', 'same-early', 'legacy-last', 'legacy-first', 'older', 'invalid']);
  assert.equal(invoices[0].id, 'older');
  assert.deepEqual(sortInvoicesNewestFirst([]), []);
});

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

test('repeat invoices reuse existing stock identity despite supplier and formatting changes', () => {
  const stock = [{ id: 'salmon', name: 'Atlantic Salmon', unit: 'lb', currentStock: 10, supplier: 'A' }];
  const first = resolveInvoiceInventoryItem(stock, { name: ' ATLANTIC SALMON - CS ', quantity: 3 });
  assert.equal(first.item.id, 'salmon');
  const afterReceipt = [{ ...first.item, currentStock: first.item.currentStock + 3 }];
  const second = resolveInvoiceInventoryItem(afterReceipt, { name: 'Atlantic Salmon', quantity: 5, supplier: 'B' });
  assert.equal(second.item.id, 'salmon');
  assert.equal(second.item.currentStock + 5, 18);
  assert.equal(resolveInvoiceInventoryItem(stock, { name: 'Atlantic Salmon', inventoryItemId: 'new' }).item.id, 'salmon');
});

test('unrecognized descriptions require explicit creation or a confirmed existing item', () => {
  const stock = [{ id: 'salmon', name: 'Atlantic Salmon' }];
  assert.match(resolveInvoiceInventoryItem(stock, { name: 'Fresh ATL SALM' }).error, /Choose/);
  assert.equal(resolveInvoiceInventoryItem(stock, { name: 'Fresh ATL SALM', inventoryItemId: 'salmon' }).item.id, 'salmon');
  assert.equal(resolveInvoiceInventoryItem(stock, { name: 'Cheddar', inventoryItemId: 'new' }).createNew, true);
  assert.ok(resolveInvoiceInventoryItem(stock, { name: 'Cheddar', inventoryItemId: 'deleted' }).error);
  const remembered = [{ ...stock[0], invoiceAliases: ['Fresh ATL SALM'] }];
  assert.equal(resolveInvoiceInventoryItem(remembered, { name: 'Fresh ATL SALM' }).item.id, 'salmon');
});

test('ambiguous names require selection, including when new was requested', () => {
  const stock = [{ id: 'a', name: 'Salmon' }, { id: 'b', name: 'Salmon' }];
  assert.ok(resolveInvoiceInventoryItem(stock, { name: 'Salmon' }).error);
  assert.ok(resolveInvoiceInventoryItem(stock, { name: 'Salmon', inventoryItemId: 'new' }).error);
  assert.equal(resolveInvoiceInventoryItem(stock, { name: 'Salmon', inventoryItemId: 'b' }).item.id, 'b');
});

test('matches supplier invoice descriptions through hidden inventory aliases', () => {
  const mozzarella = {
    name: 'Mozzarella',
    invoiceAliases: ['Bella Casara Mozzarella'],
    purchaseOptions: [{ productName: 'BC Mozzarella 2.2 kg' }],
  };

  assert.equal(inventoryItemMatchesInvoiceName(mozzarella, 'Bella Casara Mozzarella'), true);
  assert.equal(inventoryItemMatchesInvoiceName(mozzarella, 'BC Mozzarella 2.2 kg'), true);
  assert.equal(inventoryItemMatchesInvoiceName(mozzarella, 'Cheddar'), false);
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

test('detects duplicate invoice numbers despite formatting differences', () => {
  const invoices = [{ invoiceNumber: 'INV-001 42' }];

  assert.equal(hasDuplicateInvoiceNumber(invoices, 'inv00142'), true);
  assert.equal(hasDuplicateInvoiceNumber(invoices, 'INV-00143'), false);
});

test('normalizes equivalent supplier item names to one inventory identity', () => {
  assert.equal(normalizeInventoryItemName('Atlantic Salmon (Case)'), 'atlantic salmon');
  assert.equal(normalizeInventoryItemName('Atlantic Salmon - CS'), 'atlantic salmon');
});
