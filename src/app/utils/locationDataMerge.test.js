import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeLocationData } from './locationDataMerge.js';

test('mergeLocationData falls back to local arrays when the server payload omits them', () => {
  const result = mergeLocationData(
    {
      inventory: [{ id: '1' }],
      recipes: [{ id: 'r1' }],
      storageAreas: ['Cooler'],
    },
    {
      inventory: [{ id: '2' }],
      recipes: [{ id: 'r2' }],
      storageAreas: ['Dry'],
      orders: [{ id: 'o1' }],
      invoices: [{ id: 'i1' }],
      suppliers: [{ id: 's1' }],
      preppedRecipes: [{ id: 'p1' }],
    }
  );

  assert.deepEqual(result.orders, [{ id: 'o1' }]);
  assert.deepEqual(result.invoices, [{ id: 'i1' }]);
  assert.deepEqual(result.suppliers, [{ id: 's1' }]);
  assert.deepEqual(result.preppedRecipes, [{ id: 'p1' }]);
});
