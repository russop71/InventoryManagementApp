import test from 'node:test';
import assert from 'node:assert/strict';
import { convertQuantity, normalizeUnit } from './unitConversion.ts';

test('missing legacy recipe units do not crash quantity conversion', () => {
  assert.equal(normalizeUnit(undefined), '');
  assert.equal(convertQuantity(2, undefined, 'kg'), null);
  assert.equal(convertQuantity(2, 'kg', undefined), null);
});

test('valid units still normalize and convert normally', () => {
  assert.equal(normalizeUnit(' KG '), 'kg');
  assert.equal(convertQuantity(1, 'kg', 'g'), 1000);
});
