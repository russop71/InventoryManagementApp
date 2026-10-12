import { expect, test } from '@playwright/test';

test('assistant restores private memory, links to help pages and clears saved history', async ({ page }) => {
  const accountId = 'b74c80db-0c0b-4fc0-8a89-b5d2cbd808f5';
  const locationId = 'd74c80db-0c0b-4fc0-8a89-b5d2cbd808f5';
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  let history = [{ role: 'user', content: 'My saved invoice question' }, { role: 'assistant', content: 'You can scan invoices from /app/invoices.' }];
  let notes = ['I prefer clear step-by-step instructions.'];
  const session = { token: 'test-token', refreshToken: 'test-refresh', user: { id: 'private-user', name: 'Test Chef', email: 'test@example.com', role: 'Owner' },
    account: { id: accountId, name: 'Test Kitchen', billingStatus: 'active', productAccess: true, features: { scheduling: false }, onboarding: { status: 'completed', currentStep: 'count', completedSteps: [], skippedSteps: [] } },
    locations: [{ id: locationId, name: 'Main Location' }], activeLocationId: locationId };
  const data = { inventory: [], recipes: [], invoices: [], orders: [], suppliers: [], forecasts: [], storageAreas: [], inventoryCounts: [], preppedRecipes: [], categories: [],
    integrations: { toast: { connected: false, salesData: [], menuItems: [], cogsCategories: [] }, labor: { employees: [], shifts: [], timeOffRequests: [], shiftSwapRequests: [], targetLaborPercent: 30 }, waste: { entries: [] } }, version: '2026-10-12T13:00:00Z' };
  await page.addInitScript(({ accountId, locationId }) => {
    localStorage.setItem('zestiq:auth:session', JSON.stringify({ token: 'test-token', refreshToken: 'test-refresh', accountId, activeLocationId: locationId }));
  }, { accountId, locationId });
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    let body: unknown = data;
    if (path.includes('/auth/session/')) body = session;
    else if (path.endsWith('/assistant')) {
      expect(path).toContain(accountId);
      if (request.method() === 'POST') {
        const input = request.postDataJSON();
        expect(input.locationId).toBe(locationId);
        expect(input.history).toBeUndefined();
        const answer = 'Open /app/recipes and check each ingredient’s unit and package size.';
        history = [...history, { role: 'user', content: input.message }, { role: 'assistant', content: answer }];
        body = { answer, memorySaved: true, notes };
      } else if (request.method() === 'DELETE') { history = []; notes = []; body = { cleared: true }; }
      else body = { history, notes };
    } else if (path.endsWith('/locations')) body = { locations: session.locations };
    else if (path.includes('/integrations/toast')) body = { toast: data.integrations.toast };
    else if (path.includes('/labor')) body = { labor: data.integrations.labor };
    else if (path.endsWith('/waste')) body = { entries: [] };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/app');
  await page.getByRole('button', { name: 'Open zestIQ AI assistant', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('My saved invoice question');
  await dialog.getByRole('button', { name: 'Saved preferences (1)' }).click();
  await expect(dialog).toContainText(notes[0]);
  await page.screenshot({ path: test.info().outputPath('assistant-memory.png') });
  const input = dialog.getByPlaceholder('Ask me anything about ZestIQ…');
  await expect(input).toBeEnabled();
  await input.fill('How do I fix my recipe units?');
  await input.press('Enter');
  await expect(dialog).toContainText('check each ingredient’s unit and package size.');
  await dialog.getByRole('link', { name: '/app/recipes', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/recipes$/);
  await expect(dialog).not.toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Open zestIQ AI assistant', exact: true }).click();
  await expect(dialog).toContainText('How do I fix my recipe units?');
  await dialog.getByRole('button', { name: 'Clear memory', exact: true }).click();
  await expect(dialog).toContainText('Your chat and saved preferences for this location have been cleared.');
  await expect(dialog).not.toContainText('My saved invoice question');
  await expect(dialog).not.toContainText('How do I fix my recipe units?');
  await expect(dialog.getByRole('button', { name: 'Saved preferences (0)' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(2);
  expect(errors).toEqual([]);
});
