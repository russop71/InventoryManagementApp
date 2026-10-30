import { expect, test, type Page } from '@playwright/test';

async function setup(page: Page, cloverStatus: Record<string, unknown>) {
  const actions: { path: string; body: unknown }[] = [];
  const accountId = 'b74c80db-0c0b-4fc0-8a89-b5d2cbd808f5';
  const locationId = 'd74c80db-0c0b-4fc0-8a89-b5d2cbd808f5';
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const session = { token: 'test-token', refreshToken: 'test-refresh', user: { id: 'private-user', name: 'Test Chef', email: 'test@example.com', role: 'Owner' },
    account: { id: accountId, name: 'Test Kitchen', billingStatus: 'active', productAccess: true, features: { scheduling: false }, onboarding: { status: 'completed', currentStep: 'count', completedSteps: [], skippedSteps: [] } },
    locations: [{ id: locationId, name: 'Main Location' }], activeLocationId: locationId };
  const data = { inventory: [], recipes: [], invoices: [], orders: [], suppliers: [], forecasts: [], storageAreas: [], inventoryCounts: [], preppedRecipes: [], categories: [],
    integrations: { toast: { connected: true, provider: 'clover', connectionMode: 'import', salesData: [], menuItems: [], cogsCategories: [] }, labor: { employees: [], shifts: [], timeOffRequests: [], shiftSwapRequests: [], targetLaborPercent: 30 }, waste: { entries: [] } }, version: '2026-10-12T13:00:00Z' };
  await page.addInitScript(({ accountId, locationId }) => {
    localStorage.setItem('zestiq:auth:session', JSON.stringify({ token: 'test-token', refreshToken: 'test-refresh', accountId, activeLocationId: locationId }));
  }, { accountId, locationId });
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    let body: unknown = data;
    if (path.includes('/auth/session/')) body = session;
    else if (path.endsWith('/locations')) body = { locations: session.locations };
    else if (path === '/api/clover/status') { if (request.method() === 'DELETE') { actions.push({ path, body: request.postDataJSON() }); body = { disconnected: true }; } else body = cloverStatus; }
    else if (path === '/api/clover/start') { actions.push({ path, body: request.postDataJSON() }); body = { authorizeUrl: 'https://www.clover.com/oauth/v2/authorize?client_id=test' }; }
    else if (path === '/api/clover/sync') { actions.push({ path, body: request.postDataJSON() }); body = { synced: true }; }
    else if (path.includes('/integrations/toast')) body = { toast: data.integrations.toast };
    else if (path.includes('/labor')) body = { labor: data.integrations.labor };
    else if (path.endsWith('/waste')) body = { entries: [] };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/app/integrations');
  await page.getByRole('button', { name: 'Open Clover Dining integration settings', exact: true }).click();
  await expect(page.getByText('Imported data available', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Direct connection' }).click();
  return { actions, errors, locationId };
}

test('unconfigured Clover keeps imports available without offering an unavailable sync', async ({ page }) => {
  const { actions, errors } = await setup(page, { available: false, connected: false });
  await expect(page.getByText(/Clover automatic sync is not activated yet/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sync Clover now' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Connect Clover securely' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Import Clover sales instead' }).click();
  await expect(page.getByRole('button', { name: 'Import Clover Dining sales', exact: true })).toBeVisible();
  expect(actions).toEqual([]); expect(errors).toEqual([]);
});

test('restaurant can start provider authorization for the selected location', async ({ page }) => {
  const { actions, errors, locationId } = await setup(page, { available: true, connected: false });
  await page.route('https://www.clover.com/**', route => route.fulfill({ contentType: 'text/html', body: 'Clover authorization test page' }));
  await page.getByRole('button', { name: 'Connect Clover securely' }).click();
  await expect(page).toHaveURL('https://www.clover.com/oauth/v2/authorize?client_id=test');
  expect(actions).toEqual([{ path: '/api/clover/start', body: { locationId } }]);
  expect(errors).toEqual([]);
});

test('authorized restaurant sees merchant and confirms the first sync', async ({ page }) => {
  const { actions, errors, locationId } = await setup(page, { available: true, connected: true, merchantName: 'Test Clover Kitchen' });
  await expect(page.getByText('Authorized: Test Clover Kitchen')).toBeVisible();
  await page.getByRole('button', { name: 'Sync Clover now', exact: true }).click();
  expect(actions).toEqual([]);
  await page.getByRole('button', { name: 'Confirm and sync Clover', exact: true }).click();
  await expect.poll(() => actions.length).toBe(1);
  expect(actions[0]).toEqual({ path: '/api/clover/sync', body: { locationId } });
  expect(errors).toEqual([]);
});

test('restaurant can stop automatic updates without erasing saved sales', async ({ page }) => {
  const { actions, errors, locationId } = await setup(page, { available: true, connected: true, merchantName: 'Test Clover Kitchen' });
  await page.getByRole('button', { name: 'Stop automatic Clover sync', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm stop sync', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Connect Clover securely', exact: true })).toBeVisible();
  expect(actions).toEqual([{ path: '/api/clover/status', body: { locationId } }]);
  expect(errors).toEqual([]);
});
