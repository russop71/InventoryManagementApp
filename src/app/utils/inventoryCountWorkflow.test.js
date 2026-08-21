import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getLatestDraftInventoryCount,
  getLatestFinalizedInventoryCount,
  getUnusualInventoryLosses,
  isInventoryCountFinalized,
  summarizeInventoryCount,
} from './inventoryCountWorkflow.js';

test('separates resumable drafts from finalized inventory counts', () => {
  const counts = [
    { id: 'old', status: 'finalized', finalizedAt: '2026-08-01T12:00:00Z' },
    { id: 'draft', status: 'draft', updatedAt: '2026-08-03T12:00:00Z' },
    { id: 'latest', status: 'finalized', finalizedAt: '2026-08-04T12:00:00Z' },
  ];

  assert.equal(getLatestDraftInventoryCount(counts)?.id, 'draft');
  assert.equal(getLatestFinalizedInventoryCount(counts)?.id, 'latest');
  assert.equal(isInventoryCountFinalized({ locked: 'Yes' }), true);
});

test('summarizes draft progress and dollar variance using completed lines only', () => {
  const summary = summarizeInventoryCount({
    status: 'draft',
    entries: [
      { hypothetical: 10, counted: 8, unitCost: 5, isCounted: true },
      { hypothetical: 4, counted: 0, unitCost: 10, isCounted: false },
    ],
  });

  assert.equal(summary.completedItems, 1);
  assert.equal(summary.remainingItems, 1);
  assert.equal(summary.progressPercent, 50);
  assert.equal(summary.expectedValue, 90);
  assert.equal(summary.countedValue, 40);
  assert.equal(summary.varianceValue, -10);
  assert.equal(summary.lossValue, 10);
});

test('flags material finalized count losses and identifies the responsible items', () => {
  const alert = getUnusualInventoryLosses({
    status: 'finalized',
    entries: [
      { itemId: 'salmon', name: 'Atlantic Salmon', storageArea: 'Walk-In', hypothetical: 20, counted: 15, unit: 'lb', unitCost: 14 },
      { itemId: 'salt', name: 'Salt', storageArea: 'Dry', hypothetical: 10, counted: 9.8, unit: 'kg', unitCost: 1 },
    ],
  });

  assert.equal(alert.isUnusual, true);
  assert.equal(alert.affectedItems, 1);
  assert.equal(alert.totalLossValue, 70);
  assert.equal(alert.items[0].name, 'Atlantic Salmon');
});
