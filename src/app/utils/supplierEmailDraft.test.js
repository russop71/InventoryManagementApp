import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSupplierEmailDrafts, getSupplierEmailAddress } from './supplierEmailDraft.js';

test('buildSupplierEmailDrafts uses supplier emails and creates a mail draft', () => {
  const drafts = buildSupplierEmailDrafts({
    restaurantName: 'Zestiq',
    suggestions: [
      { itemId: '1', itemName: 'Salmon', suggestedQuantity: 4, unit: 'lb', totalCost: 40, supplier: 'Daily Seafood', priority: 'critical' },
    ],
    suppliers: [{ name: 'Daily Seafood', email: 'order@dailyseafood.ca' }],
  });

  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].supplierEmail, 'order@dailyseafood.ca');
  assert.match(drafts[0].emailSubject, /Order Request/);
  assert.match(drafts[0].emailBody, /Salmon/);
});

test('getSupplierEmailAddress falls back to testing email address', () => {
  const email = getSupplierEmailAddress('Woodward', [{ name: 'Woodward', email: '' }]);
  assert.equal(email, 'russop71@gmail.com');
});

test('getSupplierEmailAddress preserves custom manually entered supplier emails', () => {
  const email = getSupplierEmailAddress('Woodward', [{ name: 'Woodward', email: 'buyer@woodward-custom.com' }]);
  assert.equal(email, 'buyer@woodward-custom.com');
});

test('getSupplierEmailAddress rewrites legacy seeded supplier emails to testing inbox', () => {
  const email = getSupplierEmailAddress('Woodward', [{ name: 'Woodward', email: 'orderdesk@woodwardmeats.com' }]);
  assert.equal(email, 'russop71@gmail.com');
});
