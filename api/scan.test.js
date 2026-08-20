import test from 'node:test';
import assert from 'node:assert/strict';

import { mapRecipeScanError, normalizeScannedRecipe } from './scan.js';

test('normalizes AI recipe matches against authoritative inventory IDs', () => {
  const recipe = normalizeScannedRecipe({
    menuItemName: 'Handwritten Ranch',
    category: 'Sauces',
    price: 0,
    yieldQuantity: 2,
    yieldUnit: 'L',
    ingredients: [
      { rawText: '500 ml buttermilk', name: 'Buttermilk', quantity: 500, unit: 'ml', matchedInventoryItemId: 'milk-1', matchConfidence: 0.94 },
      { rawText: 'salt', name: 'Salt', quantity: 0, unit: 'g', matchedInventoryItemId: 'made-up', matchConfidence: 0.8 },
    ],
  }, [{ id: 'milk-1', name: 'Buttermilk', unit: 'L', supplier: 'Dairy Co' }]);

  assert.equal(recipe.ingredients[0].matchedInventoryItemId, 'milk-1');
  assert.equal(recipe.ingredients[0].matchedInventoryItemName, 'Buttermilk');
  assert.equal(recipe.ingredients[0].quantity, 500);
  assert.equal(recipe.ingredients[1].matchedInventoryItemId, '');
  assert.equal(recipe.ingredients[1].matchConfidence, 0);
});

test('reports exhausted API quota separately from temporary rate limiting', () => {
  assert.deepEqual(
    mapRecipeScanError({ status: 429, code: 'insufficient_quota' }),
    { status: 503, error: 'OpenAI API quota is exhausted. Add API billing or credits, then try again.' },
  );
  assert.deepEqual(
    mapRecipeScanError({ status: 429, code: 'rate_limit_exceeded' }),
    { status: 429, error: 'AI recipe scanning is busy. Try again shortly.' },
  );
});
