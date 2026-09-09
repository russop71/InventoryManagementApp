import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSupplierEmailDrafts, getSupplierCcEmails, getSupplierEmailAddress, parseEmailList } from './supplierEmailDraft.js';

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

test('buildSupplierEmailDrafts combines account and supplier-specific CC recipients', () => {
  const drafts = buildSupplierEmailDrafts({
    restaurantName: 'Zestiq',
    suggestions: [
      { itemId: '1', itemName: 'Limes', suggestedQuantity: 2, unit: 'case', totalCost: 30, supplier: 'Produce Co', priority: 'low' },
    ],
    suppliers: [{ name: 'Produce Co', email: 'orders@produce.example', ccEmails: ['Chef@Zestiq.ca', 'manager@zestiq.ca'] }],
    defaultCc: ['manager@zestiq.ca', 'owner@zestiq.ca'],
  });

  assert.deepEqual(drafts[0].ccEmails, ['manager@zestiq.ca', 'owner@zestiq.ca', 'chef@zestiq.ca']);
});

test('parseEmailList accepts commas, semicolons, and new lines and removes duplicates', () => {
  assert.deepEqual(
    parseEmailList('Chef@Zestiq.ca; manager@zestiq.ca\nchef@zestiq.ca'),
    ['chef@zestiq.ca', 'manager@zestiq.ca'],
  );
});

test('getSupplierCcEmails never copies the supplier primary recipient', () => {
  assert.deepEqual(
    getSupplierCcEmails('Bar Co', [{ name: 'Bar Co', email: 'orders@bar.example', ccEmails: ['orders@bar.example', 'bar@zestiq.ca'] }]),
    ['bar@zestiq.ca'],
  );
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
