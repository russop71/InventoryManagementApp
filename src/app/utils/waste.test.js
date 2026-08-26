import test from 'node:test';
import assert from 'node:assert/strict';
import { wasteByReason, wasteTotal } from './waste.js';

const entries = [
  { occurredAt: '2026-08-26T10:00:00Z', reason: 'Spoilage', totalCost: 12.5 },
  { occurredAt: '2026-08-25T10:00:00Z', reason: 'Prep waste', totalCost: 4 },
  { occurredAt: '2026-08-26T12:00:00Z', reason: 'Spoilage', totalCost: 2.5 },
];

test('wasteTotal respects date bounds', () => assert.equal(wasteTotal(entries, '2026-08-26', '2026-08-26'), 15));
test('wasteByReason groups and sorts costs', () => assert.deepEqual(wasteByReason(entries), [{ reason: 'Spoilage', total: 15 }, { reason: 'Prep waste', total: 4 }]));
