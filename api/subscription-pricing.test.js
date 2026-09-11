import assert from 'node:assert/strict';
import test from 'node:test';
import { addCheckoutLineItems, checkoutLineItems, monthlySubscriptionTotalCents } from './_subscription-pricing.js';

test('monthly subscription pricing applies scheduling to the first and additional locations', () => {
  assert.equal(monthlySubscriptionTotalCents(1, false), 24999);
  assert.equal(monthlySubscriptionTotalCents(1, true), 29998);
  assert.equal(monthlySubscriptionTotalCents(2, false), 44998);
  assert.equal(monthlySubscriptionTotalCents(2, true), 52496);
  assert.equal(monthlySubscriptionTotalCents(3, true), 74994);
});

test('checkout creates separate quantities for locations and their scheduling seats', () => {
  const items = checkoutLineItems({
    basePriceId: 'base',
    additionalLocationPriceId: 'location',
    schedulingPriceId: 'scheduling-base',
    additionalLocationSchedulingPriceId: 'scheduling-extra',
    locationCount: 3,
    schedulingEnabled: true,
  });
  assert.deepEqual(items, [
    { price: 'base', quantity: 1 },
    { price: 'location', quantity: 2 },
    { price: 'scheduling-base', quantity: 1 },
    { price: 'scheduling-extra', quantity: 2 },
  ]);
  assert.deepEqual(addCheckoutLineItems({}, items), {
    'line_items[0][price]': 'base', 'line_items[0][quantity]': '1',
    'line_items[1][price]': 'location', 'line_items[1][quantity]': '2',
    'line_items[2][price]': 'scheduling-base', 'line_items[2][quantity]': '1',
    'line_items[3][price]': 'scheduling-extra', 'line_items[3][quantity]': '2',
  });
});
