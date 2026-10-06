import test from 'node:test';
import assert from 'node:assert/strict';
import { invoiceMatchingCatalog, applyInvoiceAiMatch } from './invoiceAiMatching.js';

const inventory = [{ id: 'basil', name: 'Fresh basil', unit: 'lb', supplier: 'Produce', currentStock: 50 }];
const line = { name: 'BASIL (BAG)', unit: 'lb', suggestedInventoryItemId: 'basil', matchConfidence: 0.98, confidence: 0.96, quantity: 2, unitCost: 12.12 };
test('clear AI match preselects only an existing item and preserves measurements', () => {
  assert.deepEqual(applyInvoiceAiMatch(line, inventory), { ...line, inventoryItemId: 'basil', aiMatchApplied: true });
  assert.equal(inventory[0].currentStock, 50);
  assert.equal(line.inventoryItemId, undefined);
});
test('unknown, inactive, uncertain, unreadable and different-unit candidates stay for review', () => {
  for (const change of [{ suggestedInventoryItemId: 'invented' }, { matchConfidence: 0.8 }, { matchConfidence: undefined }, { confidence: 0.2 }, { unit: 'bag' }]) {
    const input = { ...line, ...change };
    assert.equal(applyInvoiceAiMatch(input, inventory).inventoryItemId, undefined);
  }
  assert.equal(applyInvoiceAiMatch(line, [{ ...inventory[0], inactive: true }]).inventoryItemId, undefined);
});
test('explicit choices and ambiguous exact names are not overwritten by AI', () => {
  const manual = { ...line, inventoryItemId: 'new' };
  assert.equal(applyInvoiceAiMatch(manual, inventory), manual);
  const duplicate = inventory.map(i => ({ ...i, name: 'Basil' }));
  duplicate.push({ ...duplicate[0], id: 'basil2' });
  assert.equal(applyInvoiceAiMatch(line, duplicate).inventoryItemId, undefined);
});
test('matching catalog excludes stock/prices/inactive records and limits inputs', () => {
  const catalog = invoiceMatchingCatalog([...inventory, { id: 'off', name: 'Old', inactive: true }]);
  assert.equal(catalog.length, 1);
  assert.equal(catalog[0].currentStock, undefined);
  assert.deepEqual(invoiceMatchingCatalog(null), []);
  assert.equal(invoiceMatchingCatalog(Array(1001).fill(inventory[0])).length, 1000);
});
