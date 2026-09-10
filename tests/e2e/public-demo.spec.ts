import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
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
    { name: 'Fresh Basil', quantity: 30, unit: 'g', packSize: 30, packCount: 1, unitCost: 0.0185, totalCost: 0.555, category: 'Produce', confidence: 0.98 },
  ],
  subtotal: 0.555,
  tax: 0,
  credits: 0,
  total: 0.555,
  confidence: 0.98,
};

async function mockInvoiceScan(page: Page, capturedImages: string[] = []) {
  await page.route('**/api/scan-invoice', async route => {
    const body = route.request().postDataJSON() as { imageData?: string };
    capturedImages.push(body.imageData || '');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(scannedInvoiceResponse) });
  });
}

async function addInventoryItem(page: Page, values: { name: string; category?: string; supplier?: string; unit?: string; onHand?: string; par?: string; cost?: string }) {
  await page.getByRole('button', { name: 'Add Item' }).click();
  await page.getByLabel('Item name', { exact: true }).fill(values.name);
  await page.getByLabel('Category', { exact: true }).fill(values.category || 'Produce');
  await page.getByLabel('Supplier', { exact: true }).fill(values.supplier || 'QA Produce Supplier');
  await page.getByLabel('Unit', { exact: true }).fill(values.unit || 'kg');
  await page.getByLabel('On hand', { exact: true }).fill(values.onHand || '5');
  await page.getByLabel('Par level', { exact: true }).fill(values.par || '8');
  await page.getByLabel('Unit cost', { exact: true }).fill(values.cost || '4.25');
  await page.getByRole('button', { name: 'Save item' }).click();
  await expect(page.getByText(values.name, { exact: true }).first()).toBeVisible();
}

async function addRecipeIngredient(page: Page, name: string) {
  const dialog = page.getByRole('dialog');
  const search = dialog.getByPlaceholder('Start typing an inventory item...');
  await search.fill(name);
  await expect(dialog.getByText(name, { exact: true }).last()).toBeVisible();
  await search.press('Enter');
  await expect(dialog.getByLabel(`Quantity for ${name}`)).toBeVisible();
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
  await page.getByLabel('I reviewed the unclear, new, or unmatched information').check();
  await page.getByRole('button', { name: /Save Invoice & Update Inventory/ }).click();
  await expect(page).toHaveURL(/\/app\/invoices\?invoice=/);
  await expect(page.getByText('QA-CAMERA-1001-CORRECTED').first()).toBeVisible();
});

test('invoice upload validates files and explains scan-service failures', async ({ page }) => {
  await freshDemoLogin(page);
  await page.goto('/app/invoice-scanner');
  const upload = page.locator('#invoice-upload');

  await upload.setInputFiles({ name: 'invoice.txt', mimeType: 'text/plain', buffer: Buffer.from('not an invoice image') });
  await expect(page.getByRole('alert')).toContainText('JPEG, PNG, WebP, or PDF');

  await upload.setInputFiles({ name: 'too-large.png', mimeType: 'image/png', buffer: Buffer.alloc((4 * 1024 * 1024) + 1) });
  await expect(page.getByRole('alert')).toContainText('smaller than 4 MB');

  await page.route('**/api/scan-invoice', route => route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'Invoice extraction failed. Try a clearer image or PDF.' }) }));
  await upload.setInputFiles(path.resolve('tests/fixtures/handwritten-tomato-basil-recipe.png'));
  await page.getByRole('button', { name: 'Scan Invoice' }).click();
  await expect(page.getByRole('alert')).toContainText('Try a clearer image or PDF');
  await expect(page.getByRole('button', { name: 'Scan Invoice' })).toBeEnabled();
});

test('invoice PDF upload reaches review with editable extracted fields', async ({ page }) => {
  const capturedDocuments: string[] = [];
  await mockInvoiceScan(page, capturedDocuments);
  await freshDemoLogin(page);
  await page.goto('/app/invoice-scanner');
  await page.locator('#invoice-upload').setInputFiles({
    name: 'supplier-invoice.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF'),
  });
  await expect(page.getByTitle('Invoice PDF preview')).toBeVisible();
  await page.getByRole('button', { name: 'Scan Invoice' }).click();
  await expect(page.getByText('Invoice Extracted')).toBeVisible();
  expect(capturedDocuments).toHaveLength(1);
  expect(capturedDocuments[0]).toMatch(/^data:application\/pdf;base64,/);
  await expect(page.getByLabel('Vendor')).toBeEditable();
  await expect(page.getByLabel('Invoice #')).toBeEditable();
  await expect(page.getByLabel('Date')).toBeEditable();
});

test('invoice review handles tax, credits, low confidence, new records, duplicates, and unreadable scans', async ({ page }) => {
  test.setTimeout(60_000);
  const reviewInvoice = {
    vendor: 'QA New Farm Supplier',
    invoiceNumber: 'QA-EDGE-1001',
    date: '2026-09-09',
    items: [{ name: 'QA Purple Carrots', quantity: 10, unit: 'kg', packSize: 5, packCount: 2, unitCost: 10, totalCost: 100, category: 'Produce', confidence: 0.52 }],
    subtotal: 100,
    tax: 13,
    credits: 5,
    total: 108,
    confidence: 0.58,
  };

  await page.route('**/api/scan-invoice', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(reviewInvoice) }));
  await freshDemoLogin(page);
  await page.goto('/app/invoice-scanner');
  const upload = page.locator('#invoice-upload');
  await upload.setInputFiles(path.resolve('tests/fixtures/handwritten-tomato-basil-recipe.png'));
  await page.getByRole('button', { name: 'Scan Invoice' }).click();

  await expect(page.getByText('Review required')).toBeVisible();
  await expect(page.getByText('This supplier is not in ZestIQ yet')).toBeVisible();
  await expect(page.getByText('New inventory item will be created after approval.')).toBeVisible();
  await expect(page.getByLabel('Tax')).toHaveValue('13');
  await expect(page.getByLabel('Credits / allowances')).toHaveValue('5');
  await expect(page.getByText('$108.00')).toBeVisible();
  const saveInvoice = page.getByRole('button', { name: /Save Invoice & Update Inventory/ });
  await expect(saveInvoice).toBeDisabled();
  await page.getByLabel('I reviewed the unclear, new, or unmatched information').check();
  await saveInvoice.click();

  await expect(page).toHaveURL(/\/app\/invoices\?invoice=/);
  await expect(page.getByText('QA-EDGE-1001').first()).toBeVisible();
  await expect(page.getByText('Credits / allowances')).toBeVisible();
  await expect(page.getByText('$108.00').first()).toBeVisible();

  await page.goto('/app/invoice-scanner');
  await upload.setInputFiles(path.resolve('tests/fixtures/handwritten-tomato-basil-recipe.png'));
  await page.getByRole('button', { name: 'Scan Invoice' }).click();
  await page.getByLabel('I reviewed the unclear, new, or unmatched information').check();
  await page.getByRole('button', { name: /Save Invoice & Update Inventory/ }).click();
  await expect(page.getByRole('alert')).toContainText('has already been saved. Inventory was not changed.');

  await page.goto('/app/inventory');
  await page.getByPlaceholder('Search items...').fill('QA Purple Carrots');
  await expect(page.getByText('QA Purple Carrots', { exact: true }).first()).toBeVisible();
  const persistedStock = await page.evaluate(() => {
    for (const [key, value] of Object.entries(localStorage)) {
      if (!key.includes('inventory')) continue;
      try {
        const items = JSON.parse(value);
        const match = Array.isArray(items) ? items.find(item => item?.name === 'QA Purple Carrots') : null;
        if (match) return match.currentStock;
      } catch {
        // Ignore unrelated local values.
      }
    }
    return null;
  });
  expect(persistedStock).toBe(10);

  await page.unroute('**/api/scan-invoice');
  await page.route('**/api/scan-invoice', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ vendor: '', invoiceNumber: '', date: '', items: [], total: 0, confidence: 0.05 }) }));
  await page.goto('/app/invoice-scanner');
  await page.locator('#invoice-upload').setInputFiles(path.resolve('tests/fixtures/handwritten-tomato-basil-recipe.png'));
  await page.getByRole('button', { name: 'Scan Invoice' }).click();
  await expect(page.getByRole('alert')).toContainText('No invoice line items could be read');
  await expect(page.getByText('Invoice Extracted')).toHaveCount(0);
});

test('inventory supports validated add, edit, aliases, multiple areas, merge, persistence, and delete', async ({ page }) => {
  test.setTimeout(90_000);
  const primaryName = 'QA Golden Tomatoes';
  const duplicateName = 'QA Golden Tomatoes Duplicate';
  await freshDemoLogin(page);
  await page.goto('/app/inventory');

  await page.getByRole('button', { name: 'Add Item' }).click();
  await page.getByRole('button', { name: 'Save item' }).click();
  await expect(page.getByRole('alert')).toContainText('Enter an item name');
  await page.getByLabel('Item name', { exact: true }).fill(primaryName);
  await page.getByLabel('On hand', { exact: true }).fill('-1');
  await page.getByRole('button', { name: 'Save item' }).click();
  await expect(page.getByRole('alert')).toContainText('zero or greater');
  await page.getByRole('button', { name: 'Cancel' }).click();

  await addInventoryItem(page, { name: primaryName, onHand: '5', par: '8', cost: '4.25' });
  await page.reload();
  await expect(page.getByText(primaryName, { exact: true }).first()).toBeVisible();
  await page.getByText(primaryName, { exact: true }).first().click();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Invoice aliases').fill('Golden Roma 5 KG, GR-TOMATO');
  await page.getByLabel('Category').fill('Fresh Produce');
  await page.getByRole('button', { name: 'Save Changes' }).click();

  await page.getByLabel('New storage area').fill('Prep Cooler');
  await page.getByLabel('Storage area on hand').fill('3');
  await page.getByLabel('Storage area par').fill('4');
  await page.getByRole('button', { name: 'Save area' }).click();
  await expect(page.getByText('Prep Cooler', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/Total: 8 kg on hand · par 12/)).toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();

  await page.getByPlaceholder('Search items...').fill('Golden Roma 5 KG');
  await expect(page.getByText(primaryName, { exact: true }).first()).toBeVisible();
  await page.getByPlaceholder('Search items...').fill('');
  await addInventoryItem(page, { name: duplicateName, onHand: '2', par: '3', cost: '4.50' });

  await page.getByLabel(`Select ${primaryName}`, { exact: true }).check();
  await page.getByLabel(`Select ${duplicateName}`, { exact: true }).check();
  page.once('dialog', dialog => void dialog.accept());
  await page.getByRole('button', { name: 'Merge items' }).click();
  await expect(page.getByLabel(`Select ${duplicateName}`, { exact: true })).toHaveCount(0);
  await page.getByPlaceholder('Search items...').fill(duplicateName);
  await expect(page.getByText(primaryName, { exact: true }).first()).toBeVisible();
  await page.getByText(primaryName, { exact: true }).first().click();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.getByLabel('Invoice aliases')).toHaveValue(/Golden Roma 5 KG/);
  await expect(page.getByLabel('Invoice aliases')).toHaveValue(/QA Golden Tomatoes Duplicate/);
  await page.getByRole('button', { name: 'Cancel' }).click();

  page.once('dialog', dialog => void dialog.accept());
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/inventory$/);
  await page.getByPlaceholder('Search items...').fill(primaryName);
  await expect(page.getByText(primaryName, { exact: true })).toHaveCount(0);
});

test('inventory count supports drafts, repeated storage-area lines, finalization, and locking', async ({ page }) => {
  test.setTimeout(90_000);
  await freshDemoLogin(page);
  await page.goto('/app/inventory');
  await page.getByRole('button', { name: 'Start count' }).click();
  await expect(page.getByText('Count in progress')).toBeVisible();
  await page.getByLabel('Description').fill('QA closing count');
  await page.getByPlaceholder('Search inventory…').fill('Ground Beef');

  const initialCount = page.locator('input[aria-label="Count Ground Beef"]:visible');
  await expect(initialCount).toHaveCount(1);
  await initialCount.fill('9');
  await expect(initialCount).toHaveValue('9');
  await page.getByLabel('Additional count item').selectOption({ label: 'Ground Beef' });
  await page.getByLabel('Additional count storage area').selectOption('Bar');
  await page.getByRole('button', { name: 'Add count line' }).click();
  const repeatedCounts = page.locator('input[aria-label="Count Ground Beef"]:visible');
  await expect(repeatedCounts).toHaveCount(2);
  expect((await repeatedCounts.evaluateAll(inputs => inputs.map(input => (input as HTMLInputElement).value))).sort()).toEqual(['', '9']);
  for (let index = 0; index < await repeatedCounts.count(); index += 1) {
    if ((await repeatedCounts.nth(index).inputValue()) === '') await repeatedCounts.nth(index).fill('2');
  }
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByText(/Saved \d{1,2}:\d{2}/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Save & exit' }).click();

  await expect(page.getByRole('button', { name: 'Resume count' })).toBeVisible();
  await page.getByRole('button', { name: 'Resume count' }).click();
  await page.getByPlaceholder('Search inventory…').fill('Ground Beef');
  const resumedCounts = page.locator('input[aria-label="Count Ground Beef"]:visible');
  await expect(resumedCounts).toHaveCount(2);
  expect((await resumedCounts.evaluateAll(inputs => inputs.map(input => (input as HTMLInputElement).value))).sort()).toEqual(['2', '9']);

  page.once('dialog', dialog => void dialog.accept());
  await page.getByRole('button', { name: 'Finalize count' }).click();
  await expect(page).toHaveURL(/\/app\/inventory$/);
  await expect(page.getByText('QA closing count', { exact: true }).first()).toBeVisible();
  await page.getByText('QA closing count', { exact: true }).first().click();
  await page.getByRole('button', { name: 'Count view' }).click();
  await expect(page.getByText('Finalized count')).toBeVisible();
  await expect(page.getByText('This count is locked and included in inventory history.')).toBeVisible();
  await expect(page.locator('input[aria-label^="Count "]:visible')).toHaveCount(0);
});

test('recipes support validated create, costing, unit conversion, editing, persistence, and delete', async ({ page }) => {
  await freshDemoLogin(page);
  await page.goto('/app/recipes');

  const dialog = page.getByRole('dialog');
  await page.getByRole('button', { name: 'Local Lager', exact: true }).click();
  const lagerUnit = dialog.getByLabel('Unit for Local Lager 24-pack');
  await expect(dialog.getByLabel('Quantity for Local Lager 24-pack')).toHaveValue('1');
  await expect(lagerUnit).toHaveValue('ea');
  await expect(lagerUnit.locator('option')).toHaveText(['case', 'can', 'each']);
  await expect(dialog.getByText('$2.25', { exact: true }).first()).toBeVisible();
  await lagerUnit.selectOption('case');
  await expect(dialog.getByText('$2.25', { exact: true }).first()).toBeVisible();
  await lagerUnit.selectOption('ea');
  await expect(dialog.getByLabel('Quantity for Local Lager 24-pack')).toHaveValue('1');
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await page.reload();

  await page.getByRole('button', { name: 'New Menu Item' }).click();
  await dialog.getByLabel('Menu Item Name').fill('QA Costed Bowl');
  await dialog.getByLabel('Category').fill('QA Specials');
  await dialog.getByLabel('Price').fill('-1');
  await dialog.getByRole('button', { name: 'Save Menu Item' }).click();
  await expect(dialog).toBeVisible();
  expect(await dialog.getByLabel('Price').evaluate((input: HTMLInputElement) => input.validity.rangeUnderflow)).toBe(true);

  await dialog.getByLabel('Price').fill('20');
  await addRecipeIngredient(page, 'Extra Virgin Olive Oil');
  await dialog.getByLabel('Quantity for Extra Virgin Olive Oil').fill('0');
  await dialog.getByRole('button', { name: 'Save Menu Item' }).click();
  await expect(dialog).toBeVisible();
  expect(await dialog.getByLabel('Quantity for Extra Virgin Olive Oil').evaluate((input: HTMLInputElement) => input.validity.rangeUnderflow)).toBe(true);
  await dialog.getByLabel('Quantity for Extra Virgin Olive Oil').fill('0.5');
  await expect(dialog.getByText('$6.20', { exact: true }).first()).toBeVisible();

  const ingredientSearch = dialog.getByPlaceholder('Start typing an inventory item...');
  await ingredientSearch.fill('Extra Virgin Olive Oil');
  await ingredientSearch.press('Enter');
  await expect(page.getByText('Ingredient already added')).toBeVisible();
  await dialog.getByRole('button', { name: 'Save Menu Item' }).click();
  await expect(page.getByRole('button', { name: 'QA Costed Bowl', exact: true })).toBeVisible();

  await page.reload();
  await page.getByRole('button', { name: 'QA Costed Bowl', exact: true }).click();
  await dialog.getByLabel('Menu Item Name').fill('QA Costed Bowl Revised');
  await dialog.getByLabel('Price').fill('24');
  await dialog.getByLabel('Unit for Extra Virgin Olive Oil').selectOption('ml');
  await expect(dialog.getByLabel('Quantity for Extra Virgin Olive Oil')).toHaveValue('500');
  await expect(dialog.getByText('$6.20', { exact: true }).first()).toBeVisible();
  await dialog.getByRole('button', { name: 'Update Menu Item' }).click();
  await expect(page.getByRole('button', { name: 'QA Costed Bowl Revised', exact: true })).toBeVisible();

  page.once('dialog', confirmation => confirmation.accept());
  await page.getByRole('button', { name: 'Delete QA Costed Bowl Revised' }).click();
  await expect(page.getByText('QA Costed Bowl Revised', { exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'New Menu Item' }).click();
  await dialog.getByLabel('Menu Item Name').fill('QA Uncosted Item');
  await dialog.getByLabel('Category').fill('QA Specials');
  await dialog.getByLabel('Price').fill('12');
  await dialog.getByRole('button', { name: 'Save Menu Item' }).click();
  await page.getByRole('button', { name: 'QA Uncosted Item', exact: true }).click();
  await expect(dialog.getByText('$0.00', { exact: true }).first()).toBeVisible();
  await expect(dialog.getByText('Add ingredients from inventory to compute food cost.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  page.once('dialog', confirmation => confirmation.accept());
  await page.getByRole('button', { name: 'Delete QA Uncosted Item' }).click();
  await expect(page.getByText('QA Uncosted Item', { exact: true })).toHaveCount(0);
});

test('prepared recipes validate yield, prevent duplicate/circular ingredients, persist edits, and delete', async ({ page }) => {
  await freshDemoLogin(page);
  await page.goto('/app/recipes');
  await page.getByRole('tab', { name: 'Recipes', exact: true }).click();
  await page.getByRole('button', { name: 'New Recipe' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Recipe Name').fill('QA House Dressing');
  await dialog.getByLabel('Category').fill('Dressings');
  await dialog.getByLabel('Yield Qty').fill('0');
  await dialog.getByLabel('Yield Unit').fill('portions');
  await addRecipeIngredient(page, 'Extra Virgin Olive Oil');
  await dialog.getByLabel('Quantity for Extra Virgin Olive Oil').fill('1');

  const ingredientSearch = dialog.getByPlaceholder('Start typing an inventory item...');
  await ingredientSearch.fill('Extra Virgin Olive Oil');
  await ingredientSearch.press('Enter');
  await expect(page.getByText('Ingredient already added')).toBeVisible();
  await dialog.getByRole('button', { name: 'Save Recipe' }).click();
  await expect(dialog).toBeVisible();
  expect(await dialog.getByLabel('Yield Qty').evaluate((input: HTMLInputElement) => input.validity.rangeUnderflow)).toBe(true);

  await dialog.getByLabel('Yield Qty').fill('4');
  await expect(dialog.getByText('$12.40', { exact: true }).first()).toBeVisible();
  await expect(dialog.getByText('$3.10 / portions')).toBeVisible();
  await dialog.getByRole('button', { name: 'Save Recipe' }).click();
  await expect(page.getByText('QA House Dressing', { exact: true })).toBeVisible();

  await page.reload();
  await page.getByRole('tab', { name: 'Recipes', exact: true }).click();
  await page.getByRole('button', { name: 'Edit QA House Dressing' }).click();
  await dialog.getByLabel('Yield Qty').fill('8');
  await expect(dialog.getByText('$1.55 / portions')).toBeVisible();
  await dialog.getByRole('button', { name: 'Update Recipe' }).click();
  await expect(page.getByText('8 portions', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'New Recipe' }).click();
  await dialog.getByPlaceholder('Start typing an inventory item...').fill('QA House Dressing');
  await expect(dialog.getByText('No inventory items match “QA House Dressing”.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel' }).click();

  await page.getByRole('button', { name: 'Delete QA House Dressing' }).click();
  await expect(page.getByText('QA House Dressing', { exact: true })).toHaveCount(0);
});

test('builds and saves a POS-informed supplier forecast', async ({ page }) => {
  await freshDemoLogin(page);
  await page.goto('/app/forecasting');

  await page.getByRole('button', { name: "Build tomorrow's forecast" }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Create Sales Forecast' })).toBeVisible();
  await expect(dialog.locator('input[name="date"]')).not.toHaveValue('');
  await expect(dialog.locator('input[name="expectedRevenue"]')).not.toHaveValue('');
  await expect(dialog.getByText(/items$/).first()).toBeVisible();
  await dialog.getByRole('button', { name: 'Create Forecast' }).click();
  await expect(page.getByText('Forecast added successfully')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Generate Order' })).toHaveCount(1);

  await page.reload();
  await expect(page.getByRole('button', { name: 'Generate Order' })).toHaveCount(1);
});

test('forecast buffers create editable supplier-grouped orders and recover from missing email setup', async ({ page }) => {
  test.setTimeout(60_000);
  await freshDemoLogin(page);
  await page.goto('/app/inventory');
  await addInventoryItem(page, { name: 'QA Buffer Tomatoes', supplier: 'QA Forecast One', onHand: '0', par: '10', cost: '2' });
  await addInventoryItem(page, { name: 'QA Buffer Peppers', supplier: 'QA Forecast Two', onHand: '0', par: '10', cost: '3' });

  await page.goto('/app/ai-orders');
  const bufferControl = page.getByLabel('Forecast safety buffer percentage');
  await bufferControl.getByRole('button', { name: '0%', exact: true }).click();
  await expect(page.getByLabel('Order quantity for QA Buffer Tomatoes')).toHaveValue('12');
  await bufferControl.getByRole('button', { name: '10%', exact: true }).click();
  await expect(page.getByLabel('Order quantity for QA Buffer Tomatoes')).toHaveValue('13');

  const tomatoesCard = page.getByText('QA Buffer Tomatoes', { exact: true }).locator('xpath=ancestor::*[@data-slot="card"][1]');
  const peppersCard = page.getByText('QA Buffer Peppers', { exact: true }).locator('xpath=ancestor::*[@data-slot="card"][1]');
  await tomatoesCard.click();
  await peppersCard.click();
  await page.getByLabel('Order quantity for QA Buffer Tomatoes').fill('9');
  await expect(page.getByText('QA Forecast One', { exact: true }).last()).toBeVisible();
  await expect(page.getByText('1 item • $18.00', { exact: true })).toBeVisible();
  await expect(page.getByText('QA Forecast Two', { exact: true }).last()).toBeVisible();

  const approve = page.getByRole('button', { name: 'Approve 2 orders' });
  await approve.evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  const emailDialog = page.getByRole('dialog');
  await expect(emailDialog.getByText('Supplier email drafts (2)')).toBeVisible();
  await expect(emailDialog.getByLabel('Draft quantity for QA Buffer Tomatoes')).toHaveValue('9');
  await emailDialog.getByLabel('Draft quantity for QA Buffer Tomatoes').fill('10');
  await expect(emailDialog.getByLabel('Body for QA Forecast One')).toContainText('QA Buffer Tomatoes - 10');
  await emailDialog.getByLabel('Subject for QA Forecast One').fill('QA reviewed supplier order');
  const downloadPromise = page.waitForEvent('download');
  await emailDialog.getByRole('button', { name: 'Download PDF' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^zestiq-supplier-orders-.*\.pdf$/);
  const downloadedBytes = await readFile(await download.path());
  expect(downloadedBytes.subarray(0, 8).toString()).toBe('%PDF-1.4');
  expect(downloadedBytes.toString('latin1')).toContain('QA Buffer Tomatoes');
  await emailDialog.getByRole('button', { name: 'Open Email' }).first().click();
  await expect(page.getByText('No supplier email address is configured')).toBeVisible();
  await emailDialog.getByRole('button', { name: 'Close' }).click();

  await page.goto('/app/orders');
  const firstSupplierOrder = page.locator('button:has-text("QA Forecast One"):visible');
  await expect(firstSupplierOrder).toHaveCount(1);
  await expect(page.locator('button:has-text("QA Forecast Two"):visible')).toHaveCount(1);
  await firstSupplierOrder.click();
  const orderDialog = page.getByRole('dialog');
  await orderDialog.getByLabel('Order quantity for QA Buffer Tomatoes').fill('11');
  await orderDialog.getByLabel('Order cost for QA Buffer Tomatoes').fill('22');
  await orderDialog.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page.getByText('Order lines updated')).toBeVisible();
  await orderDialog.getByRole('button', { name: 'Close' }).first().click();

  await page.reload();
  await page.locator('button:has-text("QA Forecast One"):visible').click();
  await expect(page.getByRole('dialog').getByLabel('Order quantity for QA Buffer Tomatoes')).toHaveValue('11');
  await expect(page.getByRole('dialog').getByLabel('Order cost for QA Buffer Tomatoes')).toHaveValue('22');
});
