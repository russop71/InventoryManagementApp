import test from 'node:test';
import assert from 'node:assert/strict';

import { mapRecipeScanError, normalizeRecipeIngredientName, normalizeScannedRecipe, recipeInputContent } from './scan.js';

test('recipe documents use native file input and photos retain image input', () => {
  for (const [mime, extension] of [['application/pdf', 'pdf'], ['application/msword', 'doc'], ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx']]) {
    const data = `data:${mime};base64,cmVjaXBl`;
    assert.deepEqual(recipeInputContent(data), { type: 'input_file', filename: `recipe.${extension}`, file_data: data });
  }
  const image = 'data:image/png;base64,cmVjaXBl';
  assert.deepEqual(recipeInputContent(image), { type: 'input_image', image_url: image, detail: 'high' });
});

test('recipe input rejects unsupported, empty, malformed and oversized documents', () => {
  for (const data of [undefined, 'data:text/html;base64,YQ==', 'data:application/pdf;base64,', 'data:application/pdf;base64,!!']) {
    assert.throws(() => recipeInputContent(data), { status: 400 });
  }
  assert.throws(() => recipeInputContent(`data:application/pdf;base64,${Buffer.alloc(3 * 1024 * 1024 + 1).toString('base64')}`), { status: 413 });
});

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
  assert.equal(recipe.ingredients[0].name, 'Buttermilk');
  assert.equal(recipe.ingredients[0].quantity, 500);
  assert.equal(recipe.ingredients[1].matchedInventoryItemId, '');
  assert.equal(recipe.ingredients[1].matchConfidence, 0);
});

test('matches extracted ingredient wording to the canonical inventory name when AI omits the ID', () => {
  const recipe = normalizeScannedRecipe({
    ingredients: [
      { rawText: '2 lb chicken breasts', name: 'Chicken Breasts', quantity: 2, unit: 'lb', matchedInventoryItemId: '', matchConfidence: 0 },
    ],
  }, [
    { id: 'chicken-1', name: 'Boneless Chicken Breast', unit: 'kg', supplier: 'Food Supplier' },
    { id: 'chicken-2', name: 'Chicken Thigh', unit: 'kg', supplier: 'Food Supplier' },
    { id: 'chicken-3', name: 'Chicken', unit: 'kg', supplier: 'Food Supplier' },
  ]);

  assert.equal(recipe.ingredients[0].matchedInventoryItemId, 'chicken-1');
  assert.equal(recipe.ingredients[0].matchedInventoryItemName, 'Boneless Chicken Breast');
  assert.equal(recipe.ingredients[0].name, 'Boneless Chicken Breast');
  assert.ok(recipe.ingredients[0].matchConfidence >= 0.7);
});

test('uses the ingredient name to correct an incorrect AI inventory ID', () => {
  const recipe = normalizeScannedRecipe({
    ingredients: [
      { rawText: '10 g kosher salt', name: 'Kosher Salt', quantity: 10, unit: 'g', matchedInventoryItemId: 'oil-1', matchConfidence: 0.98 },
    ],
  }, [
    { id: 'oil-1', name: 'Canola Oil', unit: 'L', supplier: 'Food Supplier' },
    { id: 'salt-1', name: 'Kosher Salt', unit: 'kg', supplier: 'Food Supplier' },
  ]);

  assert.equal(recipe.ingredients[0].matchedInventoryItemId, 'salt-1');
  assert.equal(recipe.ingredients[0].name, 'Kosher Salt');
  assert.equal(recipe.ingredients[0].matchConfidence, 1);
});

test('leaves ambiguous generic ingredient names for human review', () => {
  const recipe = normalizeScannedRecipe({
    ingredients: [
      { rawText: '1 cup oil', name: 'Oil', quantity: 1, unit: 'cup', matchedInventoryItemId: '', matchConfidence: 0 },
    ],
  }, [
    { id: 'oil-1', name: 'Canola Oil', unit: 'L', supplier: 'Food Supplier' },
    { id: 'oil-2', name: 'Olive Oil', unit: 'L', supplier: 'Food Supplier' },
  ]);

  assert.equal(recipe.ingredients[0].matchedInventoryItemId, '');
  assert.equal(recipe.ingredients[0].matchedInventoryItemName, '');
  assert.equal(recipe.ingredients[0].name, 'Oil');
  assert.equal(recipe.ingredients[0].matchConfidence, 0);
});

test('matches clear handwritten ingredient wording and leaves unsafe substitutions for review', () => {
  const recipe = normalizeScannedRecipe({
    menuItemName: 'Classic Tomato Basil Sauce',
    yieldQuantity: 4,
    yieldUnit: 'L',
    ingredients: [
      { rawText: '2 kg Roma tomatoes', name: 'Roma tomatoes', quantity: 2, unit: 'kg', matchedInventoryItemId: '', matchConfidence: 0 },
      { rawText: '30 g fresh basil', name: 'Fresh basil leaves', quantity: 30, unit: 'g', matchedInventoryItemId: '', matchConfidence: 0 },
      { rawText: '20 g kosher salt', name: 'Kosher salt', quantity: 20, unit: 'g', matchedInventoryItemId: '', matchConfidence: 0 },
      { rawText: '60 ml olive oil', name: 'Olive oil', quantity: 60, unit: 'ml', matchedInventoryItemId: '', matchConfidence: 0 },
    ],
  }, [
    { id: 'tomato-sauce', name: 'Tomato Sauce', unit: 'case', supplier: 'Food Supplier' },
    { id: 'basil', name: 'Fresh Basil', unit: 'kg', supplier: 'Produce Supplier' },
    { id: 'olive-oil', name: 'Extra Virgin Olive Oil', unit: 'L', supplier: 'Food Supplier' },
  ]);

  assert.equal(recipe.ingredients[0].matchedInventoryItemId, '', 'raw tomatoes must not silently become tomato sauce');
  assert.equal(recipe.ingredients[1].matchedInventoryItemId, 'basil');
  assert.equal(recipe.ingredients[2].matchedInventoryItemId, '', 'missing salt must stay in human review');
  assert.equal(recipe.ingredients[3].matchedInventoryItemId, 'olive-oil');
});

test('normalizes common recipe quantities and plural item names before matching', () => {
  assert.equal(normalizeRecipeIngredientName('2.5 kg Tomatoes (case)'), 'tomato');
  assert.equal(normalizeRecipeIngredientName('All-purpose flours'), 'ap flour');
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
