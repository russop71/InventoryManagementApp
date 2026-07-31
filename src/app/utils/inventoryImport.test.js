import test from 'node:test';
import assert from 'node:assert/strict';
import { parseInventoryCountCsv, buildInventoryUpdates } from './inventoryImport.js';

test('parseInventoryCountCsv parses quoted headers and values', () => {
  const csv = 'Name,CurrentStock,ParLevel,UnitCost\n"Basil",12,20,3.5\n"Tomatoes",8,10,2.25\n';

  const rows = parseInventoryCountCsv(csv);

  assert.deepEqual(rows, [
    { name: 'Basil', currentStock: 12, parLevel: 20, unitCost: 3.5, supplier: '', category: '' },
    { name: 'Tomatoes', currentStock: 8, parLevel: 10, unitCost: 2.25, supplier: '', category: '' },
  ]);
});

test('buildInventoryUpdates matches inventory items by normalized name', () => {
  const inventory = [
    { id: '1', name: 'Basil' },
    { id: '2', name: 'Tomatoes' },
  ];

  const rows = parseInventoryCountCsv('Name,CurrentStock\n"BASIL",15\n');
  const updates = buildInventoryUpdates(inventory, rows);

  assert.deepEqual(updates, [{ id: '1', updates: { currentStock: 15, lastUpdated: updates[0].updates.lastUpdated } }]);
});
