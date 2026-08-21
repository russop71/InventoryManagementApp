import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSupplierEmailDrafts, getSupplierEmailAddress } from './supplierEmailDraft.js';

test('buildSupplierEmailDrafts uses supplier emails and creates a mail draft', () => {
  const drafts = buildSupplierEmailDrafts({
    restaurantName: 'Zestiq',
    suggestions: [
      { itemId: '1', itemName: 'Salmon', suggestedQuantity: 4, unit: 'lb', totalCost: 40, supplier: 'Example Seafood', priority: 'critical' },
    ],
    suppliers: [{ name: 'Example Seafood', email: 'orders@seafood.example' }],
  });

  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].supplierEmail, 'orders@seafood.example');
  assert.equal(drafts[0].canSend, true);
  assert.match(drafts[0].emailSubject, /Order Request/);
  assert.match(drafts[0].emailBody, /Salmon/);
});

test('getSupplierEmailAddress requires a configured supplier email', () => {
  const email = getSupplierEmailAddress('Example Meats', [{ name: 'Example Meats', email: '' }]);
  assert.equal(email, '');
});

test('getSupplierEmailAddress preserves custom manually entered supplier emails', () => {
  const email = getSupplierEmailAddress('Example Meats', [{ name: 'Example Meats', email: 'buyer@meats.example' }]);
  assert.equal(email, 'buyer@meats.example');
});

test('getSupplierEmailAddress preserves the address stored on the supplier', () => {
  const email = getSupplierEmailAddress('Example Meats', [{ name: 'Example Meats', email: 'orderdesk@meats.example' }]);
  assert.equal(email, 'orderdesk@meats.example');
});
