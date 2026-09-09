import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

const demoRoutes = [
  '/app',
  '/app/dashboard',
  '/app/inventory',
  '/app/inventory/demo-basil',
  '/app/recipes',
  '/app/forecasting',
  '/app/orders',
  '/app/invoices',
  '/app/ai-orders',
  '/app/costs',
  '/app/cogs',
  '/app/integrations',
  '/app/invoice-scanner',
  '/app/suppliers',
  '/app/users',
  '/app/account',
  '/app/notifications',
  '/app/order-alarms',
  '/app/help',
  '/app/contact',
  '/app/terms',
  '/app/privacy',
  '/app/labor',
  '/app/waste',
  '/app/beverages',
] as const;

function captureRuntimeFailures(page: Page) {
  const failures: string[] = [];
  page.on('pageerror', error => failures.push(`page error: ${error.message}`));
  page.on('response', response => {
    if (response.status() >= 400) failures.push(`HTTP ${response.status()}: ${response.url()}`);
  });
  page.on('console', message => {
    if (message.type() === 'error' && !message.text().includes('Failed to load resource')) {
      failures.push(`console error: ${message.text()}`);
    }
  });
  return failures;
}

async function freshDemoLogin(page: Page) {
  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
  const demoButton = page.getByRole('button', { name: 'Try Demo Account' }).last();
  await expect(demoButton).toBeVisible();
  await demoButton.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/app(?:\/dashboard)?$/);
  await expect(page.locator('main')).toBeVisible();
}

async function expectUsableRoute(page: Page, route: string) {
  await page.goto(route);
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
  await expect(page.locator('main').first()).toBeVisible();
  await expect(page.locator('main').first()).not.toBeEmpty();
  await expect(page.locator('body')).not.toContainText(/invalid JWT|unable to parse or verify signature/i);
  const overflow = await page.evaluate(() => ({
    body: document.body.scrollWidth - window.innerWidth,
    document: document.documentElement.scrollWidth - window.innerWidth,
  }));
  expect(overflow.body, `${route} body horizontal overflow`).toBeLessThanOrEqual(2);
  expect(overflow.document, `${route} document horizontal overflow`).toBeLessThanOrEqual(2);
}

const scannedRecipeResponse = {
  menuItemName: 'Classic Tomato Basil Sauce',
  category: 'Sauces',
  price: 0,
  yieldQuantity: 4,
  yieldUnit: 'L',
  aiUsed: true,
  method: 'openai-vision-inventory-match',
  ingredients: [
    { rawText: '2 kg Roma tomatoes', name: 'Roma tomatoes', quantity: 2, unit: 'kg', matchedInventoryItemId: '', matchedInventoryItemName: '', matchConfidence: 0 },
    { rawText: '30 g fresh basil', name: 'Fresh Basil', quantity: 30, unit: 'g', matchedInventoryItemId: 'demo-basil', matchedInventoryItemName: 'Fresh Basil', matchConfidence: 0.98 },
    { rawText: '60 ml olive oil', name: 'Extra Virgin Olive Oil', quantity: 60, unit: 'ml', matchedInventoryItemId: 'demo-olive-oil', matchedInventoryItemName: 'Extra Virgin Olive Oil', matchConfidence: 0.94 },
  ],
};

async function mockRecipeScan(page: Page, capturedImages: string[] = []) {
  await page.route('**/api/scan', async route => {
    const body = route.request().postDataJSON() as { imageData?: string };
    capturedImages.push(body.imageData || '');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(scannedRecipeResponse) });
  });
}

const scannedInvoiceResponse = {
  vendor: 'Northern Produce Co.',
  invoiceNumber: 'QA-CAMERA-1001',
  date: '2026-09-09',
  items: [
    { name: 'Fresh Basil', quantity: 30, unit: 'g', packSize: 30, packCount: 1, unitCost: 0.0185, totalCost: 0.555, category: 'Produce' },
  ],
  total: 0.555,
};

async function mockInvoiceScan(page: Page, capturedImages: string[] = []) {
  await page.route('**/api/scan-invoice', async route => {
    const body = route.request().postDataJSON() as { imageData?: string };
    capturedImages.push(body.imageData || '');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(scannedInvoiceResponse) });
  });
}

test('fresh public-demo visitor can enter with the keyboard and traverse every demo route', async ({ page }) => {
  test.setTimeout(120_000);
  const runtimeFailures = captureRuntimeFailures(page);
  await freshDemoLogin(page);

  for (const route of demoRoutes) {
    await test.step(route, async () => expectUsableRoute(page, route));
  }

  expect(runtimeFailures).toEqual([]);
});

test('inventory supports keyboard search and a clear empty result state', async ({ page }) => {
  await freshDemoLogin(page);
  await page.goto('/app/inventory');
  const search = page.getByPlaceholder('Search items...');
  await search.focus();
  await page.keyboard.type('a-result-that-does-not-exist');
  await expect(page.getByText(/no inventory items|no items found|no matching/i).first()).toBeVisible();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.press('Backspace');
  await expect(page.getByText('Ground Beef').first()).toBeVisible();
});

test('demo-login API failure is explained and the sign-in screen remains usable', async ({ page }) => {
  await page.route('**/api/v1/auth/demo', route => route.abort('failed'));
  await page.goto('/login');
  await page.getByRole('button', { name: 'Try Demo Account' }).last().click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText(/unable|failed|try again|demo/i).last()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try Demo Account' }).last()).toBeEnabled();
});

test('handwritten recipe photo can be reviewed, corrected, and approved before saving', async ({ page }) => {
  await mockRecipeScan(page);
  await freshDemoLogin(page);
  await page.goto('/app/recipes');
  await page.getByRole('button', { name: 'Scan Recipe' }).click();

  const fixture = path.resolve('tests/fixtures/handwritten-tomato-basil-recipe.png');
  await page.locator('input[type="file"][accept*="image/jpeg"]').setInputFiles(fixture);
  await expect(page.getByText('AI scan complete')).toBeVisible();
  await expect(page.getByText('2 cost-ready · 1 need review')).toBeVisible();

  await page.getByLabel('Inventory item').first().selectOption('demo-tomato-sauce');
  await page.getByLabel('Quantity for scanned ingredient 1').fill('2');
  await page.getByLabel('Unit for scanned ingredient 1').fill('case');
  await page.getByLabel('Scanned ingredient text 1').fill('Tomato Sauce');
  await expect(page.getByText('3 cost-ready · 0 need review')).toBeVisible();

  await page.getByRole('button', { name: 'Review Recipe' }).click();
  await expect(page.getByRole('dialog').getByText('AI scan review')).toBeVisible();
  await expect(page.getByLabel('Quantity for Tomato Sauce')).toHaveValue('2');
  await page.getByLabel('Quantity for Tomato Sauce').fill('1.5');
  await page.getByRole('button', { name: 'Save Recipe' }).click();
  await expect(page.getByText('Classic Tomato Basil Sauce').last()).toBeVisible();
});

test('camera capture produces a recipe image and opens human review', async ({ page }) => {
  const capturedImages: string[] = [];
  await mockRecipeScan(page, capturedImages);
  await freshDemoLogin(page);
  await page.goto('/app/recipes');
  await page.getByRole('button', { name: 'Scan Recipe' }).click();
  await page.getByRole('button', { name: 'Take Photo' }).click();

  const video = page.locator('video');
  await expect(video).toBeVisible();
  await expect.poll(() => video.evaluate(element => (element as HTMLVideoElement).videoWidth)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Capture Recipe' }).click();

  await expect(page.getByText('AI scan complete')).toBeVisible();
  expect(capturedImages).toHaveLength(1);
  expect(capturedImages[0]).toMatch(/^data:image\/jpeg;base64,/);
  await expect(page.getByRole('button', { name: 'Review Recipe' })).toBeVisible();
});

test('invoice camera capture supports correction and approval before posting', async ({ page }) => {
  const capturedImages: string[] = [];
  await mockInvoiceScan(page, capturedImages);
  await freshDemoLogin(page);
  await page.goto('/app/invoice-scanner');
  await page.getByRole('button', { name: 'Take Photo' }).click();

  const video = page.locator('video');
  await expect(video).toBeVisible();
  await expect.poll(() => video.evaluate(element => (element as HTMLVideoElement).videoWidth)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Capture Invoice' }).click();
  await expect(page.getByText(/invoice-\d+\.jpg/)).toBeVisible();
  await page.getByRole('button', { name: 'Scan Invoice' }).click();

  await expect(page.getByText('Invoice Extracted')).toBeVisible();
  expect(capturedImages).toHaveLength(1);
  expect(capturedImages[0]).toMatch(/^data:image\/jpeg;base64,/);
  await page.getByLabel('Vendor').fill('Northern Produce Company');
  await page.getByLabel('Invoice #').fill('QA-CAMERA-1001-CORRECTED');
  await page.getByLabel('Date').fill('2026-09-08');
  await page.getByLabel('Item Name').fill('Fresh Basil Leaves');
  await page.getByLabel('Pack size').fill('50');
  await page.getByLabel('Packages on invoice').fill('2');
  await expect(page.getByLabel('Quantity')).toHaveValue('100');
  await expect(page.getByText('$1.85').first()).toBeVisible();
  await page.getByRole('button', { name: /Save Invoice & Update Inventory/ }).click();
  await expect(page).toHaveURL(/\/app\/invoices\?invoice=/);
  await expect(page.getByText('QA-CAMERA-1001-CORRECTED').first()).toBeVisible();
});
