import { expect, test, type Page } from '@playwright/test';

const auditedRoutes = [
  '/app',
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

async function enterFreshDemo(page: Page) {
  await page.goto('/login');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
  await page.getByRole('button', { name: 'Try Demo Account' }).last().click();
  await expect(page).toHaveURL(/\/app(?:\/dashboard)?$/);
}

async function auditRenderedDocument(page: Page) {
  return page.evaluate(() => {
    const visible = (element: Element) => {
      const htmlElement = element as HTMLElement;
      const style = getComputedStyle(htmlElement);
      const bounds = htmlElement.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && bounds.width > 0 && bounds.height > 0;
    };
    const referencedText = (ids: string | null) => (ids || '')
      .split(/\s+/)
      .map(id => document.getElementById(id)?.textContent?.trim() || '')
      .join(' ')
      .trim();
    const accessibleName = (element: Element) => {
      const htmlElement = element as HTMLElement;
      const labelledBy = referencedText(element.getAttribute('aria-labelledby'));
      const labels = 'labels' in htmlElement
        ? Array.from((htmlElement as HTMLInputElement).labels || []).map(label => label.textContent?.trim() || '').join(' ').trim()
        : '';
      return (
        element.getAttribute('aria-label')
        || labelledBy
        || labels
        || element.getAttribute('alt')
        || element.getAttribute('title')
        || element.textContent?.trim()
        || ''
      ).trim();
    };
    const describe = (element: Element) => {
      const id = element.id ? `#${element.id}` : '';
      const classes = typeof element.className === 'string'
        ? `.${element.className.trim().split(/\s+/).slice(0, 2).join('.')}`
        : '';
      const markup = element.outerHTML.replace(/\s+/g, ' ');
      const snippet = `${markup.slice(0, 120)} … ${markup.slice(-220)}`;
      return `${element.tagName.toLowerCase()}${id}${classes}: ${snippet}`;
    };

    const duplicateIds = Array.from(document.querySelectorAll<HTMLElement>('[id]'))
      .map(element => element.id)
      .filter((id, index, ids) => id && ids.indexOf(id) !== index);
    const unnamedControls = Array.from(document.querySelectorAll('button, a[href], input:not([type="hidden"]), select, textarea'))
      .filter(visible)
      .filter(element => !accessibleName(element))
      .map(describe);
    const imagesWithoutAlternatives = Array.from(document.querySelectorAll('img'))
      .filter(visible)
      .filter(image => !image.hasAttribute('alt'))
      .map(describe);
    const invalidAriaReferences = Array.from(document.querySelectorAll('[aria-labelledby], [aria-describedby]'))
      .filter(element => ['aria-labelledby', 'aria-describedby'].some(attribute => {
        const value = element.getAttribute(attribute);
        return value?.split(/\s+/).some(id => id && !document.getElementById(id));
      }))
      .map(describe);

    return {
      mainCount: document.querySelectorAll('main').length,
      duplicateIds: [...new Set(duplicateIds)],
      unnamedControls,
      imagesWithoutAlternatives,
      invalidAriaReferences,
    };
  });
}

test('every public-demo route has a sound accessible document structure', async ({ page }) => {
  test.setTimeout(120_000);
  await enterFreshDemo(page);

  for (const route of auditedRoutes) {
    await test.step(route, async () => {
      await page.goto(route);
      await expect(page.locator('main').first()).toBeVisible();
      const audit = await auditRenderedDocument(page);
      expect(audit.mainCount, `${route} should contain one main landmark`).toBe(1);
      expect(audit.duplicateIds, `${route} has duplicate element IDs`).toEqual([]);
      expect(audit.unnamedControls, `${route} has controls without accessible names`).toEqual([]);
      expect(audit.imagesWithoutAlternatives, `${route} has images without alt text`).toEqual([]);
      expect(audit.invalidAriaReferences, `${route} has broken ARIA references`).toEqual([]);
    });
  }
});
test('keyboard focus is visible and reduced-motion preferences are respected', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await enterFreshDemo(page);
  await page.goto('/app/inventory');
  await expect(page.getByText('Loading ZestIQ…')).toHaveCount(0);
  await expect(page.locator('main').first()).toBeVisible();

  const focusChecks: Array<{ tag: string; name: string; indicator: boolean }> = [];
  for (let index = 0; index < 18; index += 1) {
    await page.keyboard.press('Tab');
    focusChecks.push(await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      if (!element) return { tag: 'none', name: '', indicator: false };
      const style = getComputedStyle(element);
      const indicator = style.outlineStyle !== 'none' || style.boxShadow !== 'none';
      return {
        tag: element.tagName.toLowerCase(),
        name: element.getAttribute('aria-label') || element.textContent?.trim().slice(0, 80) || '',
        indicator,
      };
    }));
  }
  expect(focusChecks.filter(check => check.tag === 'body')).toEqual([]);
  expect(focusChecks.filter(check => !check.indicator), 'Every sampled keyboard target should show a focus indicator').toEqual([]);

  const animatedElements = await page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('*'))
    .filter(element => {
      const style = getComputedStyle(element);
      return style.animationName !== 'none' && style.animationIterationCount !== '1';
    })
    .map(element => `${element.tagName.toLowerCase()}.${element.className}`));
  expect(animatedElements, 'Reduced-motion mode should not leave repeating animations active').toEqual([]);
});

test('application remains usable at a 200-percent-equivalent viewport', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 900 });
  await enterFreshDemo(page);

  for (const route of auditedRoutes) {
    await page.goto(route);
    await expect(page.locator('main').first()).toBeVisible();
    const horizontalOverflow = await page.evaluate(() => Math.max(
      document.body.scrollWidth - window.innerWidth,
      document.documentElement.scrollWidth - window.innerWidth,
    ));
    expect(horizontalOverflow, `${route} overflows at a 200%-equivalent viewport`).toBeLessThanOrEqual(2);
  }
});
