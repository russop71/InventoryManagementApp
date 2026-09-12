import { test, expect } from '@playwright/test';
import { buildDemoLocationData } from '../../src/app/utils/demoData';
import { buildDemoSales } from '../../src/app/utils/demoSales';
import { convertIngredientQuantity } from '../../src/app/utils/unitConversion';

test('demo usage fixtures reconcile every inventory item for seven and fourteen days', () => {
  const data = buildDemoLocationData();
  const closing = data.inventoryCounts!.find(count => count.id === 'demo-usage-count-0')!;
  const sales = buildDemoSales(data.recipes.map(recipe => ({ name: recipe.menuItemName, price: recipe.price })), new Date(`${closing.countDate}T12:00:00Z`));
  for (const days of [7, 14]) {
    const opening = data.inventoryCounts!.find(count => count.id === `demo-usage-count-${days}`)!;
    for (const [index, item] of data.inventory.entries()) {
      const start = opening.entries.find(line => line.itemId === item.id)!.counted;
      const end = closing.entries.find(line => line.itemId === item.id)!.counted;
      const receipts = data.invoices.filter(invoice => invoice.status === 'received' && String(invoice.date) > opening.countDate && String(invoice.date) <= closing.countDate)
        .flatMap(invoice => invoice.items as Array<{ itemId: string; quantity: number }>).filter(line => line.itemId === item.id).reduce((sum, line) => sum + line.quantity, 0);
      let theoretical = 0;
      for (const recipe of data.recipes) {
        const sold = sales.filter(day => day.date > opening.countDate && day.date <= closing.countDate).flatMap(day => day.topItems).filter(sale => sale.itemName === recipe.menuItemName).reduce((sum, sale) => sum + sale.quantity, 0);
        for (const ingredient of recipe.ingredients.filter(line => line.inventoryItemId === item.id)) {
          const amount = convertIngredientQuantity(item, ingredient.quantity, ingredient.unit, item.unit);
          expect(amount).not.toBeNull();
          theoretical += amount! * sold;
        }
      }
      expect(theoretical, item.name).toBeGreaterThan(0);
      expect(start, item.name).toBeGreaterThanOrEqual(0);
      expect(end).toBe(item.currentStock);
      expect(start + receipts - end, item.name).toBeCloseTo(theoretical * (1 + [0, .03, -.02, .06][index % 4]), 4);
    }
  }
  for (const invoice of data.invoices) {
    expect(invoice.totalAmount).toBeCloseTo((invoice.items as Array<{cost: number}>).reduce((sum, line) => sum + line.cost, 0), 2);
  }
});

test('order receipt date defaults to tomorrow and action labels fit narrow dialogs', async ({ page }) => {
  await page.goto('/login');
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload();
  await page.getByRole('button', { name: /Try Demo Account/i }).last().click();
  await expect(page).toHaveURL(/\/app/, { timeout: 25000 });
  await page.goto('/app/orders');
  await page.getByRole('button', { name: /Order #.*Great Lakes Seafood/ }).click();
  const date = page.getByLabel('Expected receipt date for Great Lakes Seafood');
  const expected = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10);
  await expect(date).toHaveValue(expected);
  for (const width of [390, 877]) {
    await page.setViewportSize({ width, height: 758 });
    const button = page.getByRole('button', { name: 'Receive & save invoice', exact: true });
    await button.scrollIntoViewIfNeeded();
    expect(await button.evaluate(node => node.scrollWidth <= node.clientWidth && node.scrollHeight <= node.clientHeight)).toBeTruthy();
  }
  await date.fill('2027-01-03');
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: /Order #.*Great Lakes Seafood/ }).click();
  await expect(date).toHaveValue('2027-01-03');
});

test('order quantity and line cost edits update the linked invoice and survive reload', async ({ page }) => {
  await page.goto('/login');
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload();
  await page.getByRole('button', { name: /Try Demo Account/i }).last().click();
  await expect(page).toHaveURL(/\/app/, { timeout: 25000 });
  await page.goto('/app/orders');
  await page.getByRole('button', { name: /Order #.*Northern Produce/ }).click();
  await page.getByLabel('Order quantity for Russet Potatoes').fill('24');
  await page.getByLabel('Order cost for Russet Potatoes').fill('60');
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: /Order #.*Northern Produce/ }).click();
  await expect(page.getByLabel('Order quantity for Russet Potatoes')).toHaveValue('24');
  await expect(page.getByLabel('Order cost for Russet Potatoes')).toHaveValue('60');
  await page.goto('/app/invoices');
  await page.getByLabel('Search invoices or suppliers').fill('PO-DEMO-0002');
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.getByLabel('Quantity for Russet Potatoes')).toHaveValue('24');
  await expect(page.getByLabel('Unit price for Russet Potatoes')).toHaveValue('2.5');
  await expect(page.getByText('$60.00', { exact: true }).first()).toBeVisible();
});

test('linked received invoice edits survive save and reload with correct unit prices', async ({ page }) => {
  await page.goto('/login');
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload();
  await page.getByRole('button', { name: /Try Demo Account/i }).last().click();
  await expect(page).toHaveURL(/\/app/, { timeout: 25000 });
  await page.goto('/app/invoices');
  await page.getByLabel('Search invoices or suppliers').fill('PO-DEMO-0002');
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.getByLabel('Quantity for Russet Potatoes')).toHaveValue('30');
  await expect(page.getByLabel('Unit price for Russet Potatoes')).toHaveValue('1.35');
  await page.getByLabel('Quantity for Russet Potatoes').fill('20');
  await page.getByLabel('Unit price for Russet Potatoes').fill('2.50');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.reload();
  await page.getByLabel('Search invoices or suppliers').fill('PO-DEMO-0002');
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.getByLabel('Quantity for Russet Potatoes')).toHaveValue('20');
  await expect(page.getByLabel('Unit price for Russet Potatoes')).toHaveValue('2.5');
  await expect(page.getByText('$50.00', { exact: true }).first()).toBeVisible();
});

test('fresh demo usage report displays linked sample values and selectable fourteen-day counts', async ({ page }) => {
  await page.goto('/login');
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload();
  await page.getByRole('button', { name: /Try Demo Account/i }).last().click();
  await expect(page).toHaveURL(/\/app/, { timeout: 25000 });
  await page.goto('/app/usage-variance');
  await expect(page.getByText('Sample demo data:', { exact: false })).toBeVisible();
  await expect(page.getByLabel('Opening count')).toHaveValue('demo-usage-count-7');
  await expect(page.getByLabel('Closing count')).toHaveValue('demo-usage-count-0');
  const rows = page.locator('tbody tr');
  await expect(rows).toHaveCount(35);
  await expect(page.locator('tbody')).not.toContainText('Unavailable');
  await expect(page.locator('tbody')).not.toContainText('No linked');
  await page.getByLabel('Opening count').selectOption('demo-usage-count-14');
  await expect(page.locator('tbody')).not.toContainText('Unavailable');
  await expect(page.getByText(/14 POS daily records/)).toBeVisible();
  await page.reload();
  await expect(page.locator('tbody')).not.toContainText('Unavailable');
});
