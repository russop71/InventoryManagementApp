import test from 'node:test';
import assert from 'node:assert/strict';
import { paidAdditionalLocations } from './_location-policy.js';

const paid = { status: 'active', latest_invoice: { status: 'paid' }, items: { data: [{ price: { id: 'location' }, quantity: 2 }] } };
test('only paid active location add-ons unlock extra locations', () => {
  assert.equal(paidAdditionalLocations(paid, 'location'), 2);
  for (const status of ['trialing', 'incomplete', 'past_due', 'unpaid', 'canceled']) {
    assert.equal(paidAdditionalLocations({ ...paid, status }, 'location'), 0);
  }
  assert.equal(paidAdditionalLocations({ ...paid, latest_invoice: { status: 'open' } }, 'location'), 0);
  assert.equal(paidAdditionalLocations({ ...paid, pending_update: {} }, 'location'), 0);
  assert.equal(paidAdditionalLocations(paid, 'other'), 0);
  assert.equal(paidAdditionalLocations(null, 'location'), 0);
});
