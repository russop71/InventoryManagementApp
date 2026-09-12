import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultOrderReceiptDate } from './orderReceiptDate.js';

test('receipt defaults to next calendar day across month, year, and DST boundaries', () => {
  for (const [input, expected] of [['2026-09-12', '2026-09-13'], ['2026-12-31', '2027-01-01'], ['2028-02-28', '2028-02-29'], ['2026-03-08T23:30:00Z', '2026-03-09']]) {
    assert.equal(defaultOrderReceiptDate(input), expected);
  }
  assert.equal(defaultOrderReceiptDate(''), '');
});
