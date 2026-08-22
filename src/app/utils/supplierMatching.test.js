import test from 'node:test';
import assert from 'node:assert/strict';
import { findBestSupplierMatch, mergeDuplicateSuppliers, normalizeSupplierName } from './supplierMatching.js';

test('normalizes supplier punctuation and company suffixes', () => {
  assert.equal(normalizeSupplierName('Northern Produce, Inc.'), 'northern produce');
  assert.equal(normalizeSupplierName('Northern Produce Ltd'), 'northern produce');
});

test('matches a small invoice OCR typo to the existing supplier', () => {
  const result = findBestSupplierMatch('Nortern Produce', [
    { id: 'northern', name: 'Northern Produce' },
    { id: 'harbour', name: 'Harbour Seafood' },
  ]);
  assert.equal(result?.supplier.id, 'northern');
  assert.ok(result.confidence > 0.9);
});

test('does not merge different suppliers that share a generic word', () => {
  assert.equal(findBestSupplierMatch('Daily Produce', [{ id: 'northern', name: 'Northern Produce' }]), null);
});

test('merges duplicate supplier records and preserves useful contact data', () => {
  const result = mergeDuplicateSuppliers([
    { id: 'one', name: 'Northern Produce', email: '', phone: '111', source: 'invoice', dateAdded: '2026-01-02' },
    { id: 'two', name: 'Northern Produce Inc.', email: 'orders@produce.example', phone: '', source: 'manual', dateAdded: '2026-01-01' },
  ]);
  assert.equal(result.length, 1);
  assert.equal(result[0].name, 'Northern Produce Inc.');
  assert.equal(result[0].email, 'orders@produce.example');
  assert.equal(result[0].phone, '111');
});
