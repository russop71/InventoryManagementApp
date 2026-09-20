import test from 'node:test';
import assert from 'node:assert/strict';
import { stockBarColor } from './stockLevels.js';
test('stock colours follow par-level bands including boundaries', () => {
  for (const [stock, colour] of [[0,'red'],[49,'red'],[50,'orange'],[74,'orange'],[75,'yellow'],[99,'yellow'],[100,'green'],[120,'green']]) {
    assert.equal(stockBarColor(stock, 100), `bg-${colour}-500`);
  }
  assert.equal(stockBarColor(0, 0), 'bg-red-500');
  assert.equal(stockBarColor(1, 0), 'bg-green-500');
});
