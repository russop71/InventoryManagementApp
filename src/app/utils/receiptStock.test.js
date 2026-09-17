import test from 'node:test';
import assert from 'node:assert/strict';
import { addReceivedStock } from './receiptStock.js';

test('two Basil receipts update storage and total together without mutating original', () => {
  const basil = { currentStock: 0, storageLocations: [{ storageArea: 'Cooler', currentStock: 0, parLevel: 10 }] };
  const received = addReceivedStock(addReceivedStock(basil, 2), 4);
  assert.equal(received.currentStock, 6);
  assert.equal(received.storageLocations[0].currentStock, 6);
  assert.equal(basil.currentStock, 0);
  assert.equal(basil.storageLocations[0].currentStock, 0);
});
test('receipts preserve secondary storage quantities', () => {
  const received = addReceivedStock({ storageLocations: [{ storageArea: 'Cooler', currentStock: 1 }, { storageArea: 'Kitchen', currentStock: 3 }] }, 4);
  assert.equal(received.currentStock, 8);
  assert.equal(received.storageLocations[1].currentStock, 3);
});
test('legacy items get storage quantities matching their stock', () => {
  const received = addReceivedStock({ storageArea: 'Cooler', currentStock: 2, parLevel: 10 }, 4);
  assert.equal(received.currentStock, 6);
  assert.equal(received.storageLocations[0].currentStock, 6);
});
