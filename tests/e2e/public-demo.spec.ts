import { expect, test, type Page } from '@playwright/test';

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

test('fresh public-demo visitor can enter with the keyboard and traverse every demo route', async ({ page }) => {
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
