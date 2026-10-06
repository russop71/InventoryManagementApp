import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 713, height: 758 } });
  const session = { token: 'local-qa-only', user: { id: 'demo', email: 'demo@zestiq.com', name: 'Demo', role: 'Owner' }, account: { id: 'qa-demo', name: 'QA Demo', billingStatus: 'active', productAccess: true, features: { scheduling: true } }, locations: [{ id: 'qa-main', name: 'Main Location' }], activeLocationId: 'qa-main' };
  await page.route('**/api/**', route => route.fulfill({ json: route.request().url().includes('/auth/') ? session : {} }));
  await page.goto('http://127.0.0.1:5192/login');
  await page.getByRole('button', { name: /Try Demo Account/i }).last().click();
  await page.waitForURL(/\/app/, { timeout: 25000, waitUntil: 'domcontentloaded' });
  await page.route('**/api/scan-invoice', async route => {
    const request = route.request().postDataJSON();
    const candidate = request.inventoryCatalog.find(item => item.unit);
    assert.ok(candidate);
    await route.fulfill({ json: { vendor: 'QA Produce', invoiceNumber: 'QA-123', date: '2026-10-06', subtotal: 20, tax: 0, credits: 0, total: 20, confidence: 0.99,
      items: [{ name: 'QA supplier product label', unit: candidate.unit, quantity: 2, packSize: 1, packCount: 2, unitsPerPack: 1, innerUnit: 'bag', unitCost: 10, totalCost: 20, category: 'Produce', confidence: 0.99, suggestedInventoryItemId: candidate.id, matchConfidence: 0.99 }] } });
  });
  await page.goto('http://127.0.0.1:5192/app/invoice-scanner');
  await page.locator('input[type=file]').setInputFiles({ name: 'qa.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6nGQAAAAASUVORK5CYII=', 'base64') });
  await page.getByRole('button', { name: 'Scan Invoice', exact: true }).click();
  await page.getByText('AI-selected match — please verify.', { exact: false }).waitFor();
  assert.ok(await page.locator('#invoice-item-match-0').inputValue());
  for (const selector of ['#scanned-invoice-vendor', 'label[for=scanned-invoice-vendor]', '#invoice-item-match-0']) {
    assert.equal(await page.locator(selector).evaluate(el => getComputedStyle(el).color), 'rgb(0, 0, 0)');
  }
  await page.locator('.invoice-review-readable').first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: '/private/tmp/zestiq-invoice-review.png' });
  console.log('Mock scan: AI match preselected; review required; field, label and selector text black. No invoice saved.');
} finally { await browser.close(); }
