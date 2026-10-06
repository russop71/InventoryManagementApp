import test from 'node:test';
import assert from 'node:assert/strict';
import { orderGuideGroups, orderGuideHtml } from './printOrderGuide.js';

const items = [
  { name: 'Tomatoes', supplier: 'Produce', unit: 'lb', currentStock: 12, parLevel: 20 },
  { name: 'Apples', supplier: 'Produce', unit: 'each', currentStock: 0, parLevel: 8 },
  { name: 'Old item', supplier: 'Produce', inactive: true },
  { name: 'Salt', supplier: '', unit: 'kg' },
];
test('groups selected suppliers, sorts items and excludes inactive without mutation', () => {
  const before = JSON.stringify(items);
  const groups = orderGuideGroups(items, ['Produce']);
  assert.deepEqual(groups[0].items.map(i => i.name), ['Apples', 'Tomatoes']);
  assert.equal(groups.length, 1);
  assert.equal(JSON.stringify(items), before);
  assert.equal(orderGuideGroups(items, ['Unassigned supplier'])[0].items[0].name, 'Salt');
});
test('print document escapes fields and leaves order quantities blank', () => {
  const html = orderGuideHtml({ items: [...items, { name: '<script>alert(1)</script>', supplier: 'Produce', vendorItemCode: 'A&B' }], selectedSuppliers: ['Produce'], accountName: 'A&B', locationName: '<Main>', date: '2026-10-06' });
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('A&amp;B'));
  assert.ok(html.includes('&lt;Main&gt;'));
  assert.ok(html.includes('<td>0</td>'));
  assert.equal((html.match(/<td>&nbsp;<\/td>/g) || []).length, 3);
  assert.ok(html.includes('break-before:page'));
});
test('empty selections cannot generate misleading guides', () => {
  assert.throws(() => orderGuideHtml({ items, selectedSuppliers: [] }), /No active items/);
});
