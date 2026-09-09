import { expect, test } from '@playwright/test';
import path from 'node:path';

test.skip(process.env.LIVE_AI_RECIPE_TEST !== '1', 'Run explicitly against production to consume an AI scan.');

test('production AI reads handwriting and makes conservative inventory matches', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
  await page.getByRole('button', { name: 'Try Demo Account' }).last().click();
  await expect(page).toHaveURL(/\/app(?:\/dashboard)?$/);
  await page.goto('/app/recipes');
  await page.getByRole('button', { name: 'Scan Recipe' }).click();

  const scanResponsePromise = page.waitForResponse(response => response.url().endsWith('/api/scan') && response.request().method() === 'POST');
  const fixture = path.resolve('tests/fixtures/handwritten-tomato-basil-recipe.png');
  await page.locator('input[type="file"][accept*="image/jpeg"]').setInputFiles(fixture);
  const scanResponse = await scanResponsePromise;
  const body = await scanResponse.json();
  expect(scanResponse.ok(), body?.error || `Recipe scan failed (${scanResponse.status()})`).toBeTruthy();
  await expect(page.getByText('AI scan complete')).toBeVisible();

  expect(body.menuItemName.toLowerCase()).toContain('tomato basil');
  expect(body.yieldQuantity).toBe(4);
  expect(String(body.yieldUnit).toLowerCase()).toBe('l');

  const basil = body.ingredients.find((ingredient: { rawText?: string; name?: string }) => /basil/i.test(`${ingredient.rawText} ${ingredient.name}`));
  const oil = body.ingredients.find((ingredient: { rawText?: string; name?: string }) => /olive oil/i.test(`${ingredient.rawText} ${ingredient.name}`));
  const tomatoes = body.ingredients.find((ingredient: { rawText?: string; name?: string }) => /roma tomato/i.test(`${ingredient.rawText} ${ingredient.name}`));
  const salt = body.ingredients.find((ingredient: { rawText?: string; name?: string }) => /kosher salt/i.test(`${ingredient.rawText} ${ingredient.name}`));

  expect(basil?.matchedInventoryItemName).toBe('Fresh Basil');
  expect(oil?.matchedInventoryItemName).toBe('Extra Virgin Olive Oil');
  expect(tomatoes?.matchedInventoryItemId || '').toBe('');
  expect(salt?.matchedInventoryItemId || '').toBe('');
});
