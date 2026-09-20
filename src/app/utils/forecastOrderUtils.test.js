import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateForecastOrderQuantity, estimateDemandForTomorrow } from './forecastOrderUtils.js';

test('deducts forecast usage before replenishing stock to par', () => {
  assert.equal(calculateForecastOrderQuantity({
    currentStock: 5,
    expectedUsage: 10,
    parLevel: 10,
  }), 15);
});

test('adds selectable forecast demand buffers above the par target', () => {
  const input = { currentStock: 5, expectedUsage: 10, parLevel: 10 };
  assert.equal(calculateForecastOrderQuantity({ ...input, safetyBuffer: 0.5 }), 16);
  assert.equal(calculateForecastOrderQuantity({ ...input, safetyBuffer: 1 }), 16);
  assert.equal(calculateForecastOrderQuantity({ ...input, safetyBuffer: 1.5 }), 17);
});

test('does not force a minimum order when there is no shortage', () => {
  assert.equal(calculateForecastOrderQuantity({
    currentStock: 30,
    expectedUsage: 2,
    parLevel: 10,
    minimumOrderQty: 5,
  }), 0);
});

test('fractional buffers can change while the rounded order stays the same', () => {
  const input = { currentStock: 16, expectedUsage: 2.4, parLevel: 24 };
  for (const percent of [0, 5, 10, 15]) {
    assert.equal(calculateForecastOrderQuantity({ ...input, safetyBuffer: 2.4 * percent / 100 }), 11);
  }
});

test('applies a minimum order only after a shortage exists', () => {
  assert.equal(calculateForecastOrderQuantity({
    currentStock: 10,
    expectedUsage: 1,
    parLevel: 10,
    minimumOrderQty: 5,
  }), 5);
});

test('uses the nearest applicable saved forecast for an inventory item', () => {
  const item = { id: 'salmon', category: 'Proteins', parLevel: 20 };
  const forecasts = [
    { date: '2099-01-02', items: [{ itemId: 'salmon', expectedUsage: 7.5 }] },
    { date: '2099-01-03', items: [{ itemId: 'salmon', expectedUsage: 9 }] },
  ];
  assert.equal(estimateDemandForTomorrow({ inventoryItem: item, forecastItems: forecasts }), 7.5);
});

test('adjusts fallback demand using recent POS sales direction', () => {
  const item = { id: 'tomatoes', category: 'Produce', parLevel: 20 };
  const rising = estimateDemandForTomorrow({
    inventoryItem: item,
    salesData: [{ revenue: 100 }, { revenue: 130 }],
  });
  const falling = estimateDemandForTomorrow({
    inventoryItem: item,
    salesData: [{ revenue: 130 }, { revenue: 100 }],
  });
  assert.equal(rising, 4.8);
  assert.equal(falling, 3.4);
});
