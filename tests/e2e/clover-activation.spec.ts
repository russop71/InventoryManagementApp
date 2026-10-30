import { expect, test } from '@playwright/test';

test('imported Clover data does not offer an unavailable direct sync', async ({ page }) => {
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
    else if (path.includes('/integrations/toast')) body = { toast: data.integrations.toast };
    else if (path.includes('/labor')) body = { labor: data.integrations.labor };
    else if (path.endsWith('/waste')) body = { entries: [] };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  const cloverRequests: string[] = [];
  page.on('request', request => { if (request.url().includes('/api/clover/')) cloverRequests.push(request.url()); });
  await page.goto('/app/integrations');
  await page.getByRole('button', { name: 'Open Clover Dining integration settings', exact: true }).click();
  await expect(page.getByText('Imported data available', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Direct connection' }).click();
  await expect(page.getByText('Clover automatic sync is not activated. Import sales now or request activation.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sync Clover now' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Connect Clover securely' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Request direct activation' })).toHaveAttribute('href', /^mailto:/);
  await page.getByRole('button', { name: 'Import Clover sales instead' }).click();
  await expect(page.getByRole('button', { name: 'Import Clover Dining sales', exact: true })).toBeVisible();
  expect(cloverRequests).toEqual([]);
  expect(errors).toEqual([]);
});
