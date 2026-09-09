import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCogsUsageVariance } from './cogsUsageVariance.js';

const inventory = [{ id: 'beef', name: 'Ground Beef', category: 'Food', unit: 'lb', unitCost: 8 }];
const menuItems = [{ id: 'burger', name: 'Burger', ingredients: [{ inventoryItemId: 'beef', quantity: 0.5 }] }];
const salesData = [
  { date: '2026-08-02', topItems: [{ itemName: 'Burger', quantity: 10, revenue: 200 }] },
  { date: '2026-08-03', topItems: [{ itemName: 'Burger', quantity: 6, revenue: 120 }] },
];
const inventoryCounts = [
  { id: 'opening', countDate: '2026-08-01', status: 'finalized', entries: [{ itemId: 'beef', counted: 20 }] },
  { id: 'closing', countDate: '2026-08-04', status: 'finalized', entries: [{ itemId: 'beef', counted: 16 }] },
];

test('compares POS recipe usage with counted inventory usage and received purchases', () => {
  const report = buildCogsUsageVariance({
    inventory,
    menuItems,
    salesData,
    inventoryCounts,
    invoices: [{ date: '2026-08-03', status: 'received', items: [{ itemId: 'beef', quantity: 5 }] }],
    startDate: '2026-08-01',
    endDate: '2026-08-04',
  });

  assert.equal(report.coverage.startDate, '2026-08-01');
  assert.equal(report.rows[0].theoreticalUsage, 8);
  assert.equal(report.rows[0].actualUsage, 9);
  assert.equal(report.rows[0].varianceQuantity, 1);
  assert.equal(report.theoreticalCost, 64);
  assert.equal(report.actualCost, 72);
  assert.equal(report.varianceCost, 8);
});

test('keeps theoretical usage available when there are not two finalized counts', () => {
  const report = buildCogsUsageVariance({ inventory, menuItems, salesData, inventoryCounts: [inventoryCounts[0]], startDate: '2026-08-01', endDate: '2026-08-04' });
  assert.equal(report.coverage, null);
  assert.equal(report.rows[0].theoreticalUsage, 8);
  assert.equal(report.rows[0].actualUsage, null);
  assert.equal(report.actualCost, null);
});

test('uses the first and last finalized counts inside a selected range', () => {
  const report = buildCogsUsageVariance({ inventory, menuItems, salesData, inventoryCounts, startDate: '2026-07-01', endDate: '2026-08-31' });
  assert.equal(report.coverage.openingCountId, 'opening');
  assert.equal(report.coverage.closingCountId, 'closing');
});
