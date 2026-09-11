import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCogsCategory } from './cogsCategoryMapping.js';

const categories = [
  { id: 'food', name: 'Food', posCategoryNames: ['Mains', 'Sandwiches'] },
  { id: 'beverage', name: 'Beverage', posCategoryNames: ['Draft Beer'] },
];

test('POS category mappings override a legacy item-level COGS category', () => {
  assert.deepEqual(resolveCogsCategory(categories, ' draft beer ', 'food'), { id: 'beverage', name: 'Beverage' });
});

test('item-level COGS category remains the fallback for an unmapped POS category', () => {
  assert.deepEqual(resolveCogsCategory(categories, 'Desserts', 'food'), { id: 'food', name: 'Food' });
});

test('unmapped items without a fallback stay visible as uncategorized', () => {
  assert.deepEqual(resolveCogsCategory(categories, 'Desserts'), { id: 'uncategorized', name: 'Uncategorized' });
});
