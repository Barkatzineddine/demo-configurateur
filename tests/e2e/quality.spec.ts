import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect, scene, test } from './fixtures';

const axe = async (page: Page) => {
  // entrance animations: measure contrast once the finite ones are over (a slow runner catches them halfway)
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity));
  return new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
};
const serious = (r: Awaited<ReturnType<typeof axe>>) =>
  r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(', ')}`);

test.describe('accessibility (axe, WCAG 2.2 AA)', () => {
  test('configurator, with the 3D view and the price details open', async ({ page }) => {
    await page.goto('./');
    await scene(page);
    await page.getByText('Détail du prix').click();
    expect(serious(await axe(page))).toEqual([]);
  });
  for (const [name, path] of [['workshop sheet', './#/atelier'], ['designs', './#/projets'], ['quote request', './#/devis']] as const) {
    test(name, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(serious(await axe(page))).toEqual([]);
    });
  }
});

test.describe('security', () => {
  test('ships a strict CSP with Trusted Types', async ({ page }) => {
    await page.goto('./');
    const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content');
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("script-src 'self' 'sha256-");
    expect(csp).toContain("require-trusted-types-for 'script'");
  });

  test.describe('with the violation expected', () => {
    test.use({ allowedConsole: /TrustedHTML|Trusted Type/ });
    test('the browser refuses raw HTML injection', async ({ page }) => {
      await page.goto('./');
      const result = await page.evaluate(() => {
        // eslint-disable-next-line no-restricted-properties -- this test proves the browser blocks it
        try { document.createElement('div').innerHTML = '<img src=x onerror=alert(1)>'; return 'allowed'; } catch { return 'blocked'; }
      });
      expect(result).toBe('blocked');
    });
  });

  test('an altered link falls back to the starting model and says so', async ({ page }) => {
    await page.goto('./#/?w=99999&h=2200&d=350&c=0&r=0&s=1&f=1&b=p&p=push&m=%3Cscript%3E&l=0&i=0');
    await expect(page.locator('.toast')).toContainText('Le lien ouvert était incomplet ou modifié');
    await expect(page.getByRole('spinbutton', { name: 'Largeur' })).toHaveValue('180');
    await expect(page).toHaveURL(/w=1800/);
  });

  test('tampered storage is discarded, not shown', async ({ page }) => {
    await page.goto('./');
    await page.evaluate(() => {
      localStorage.setItem('lisiere:v1', JSON.stringify({ v: 1, designs: [{ id: 'pX1', name: '<img src=x onerror=alert(1)>', config: { width: -5 }, saved: 'now' }], requests: [], seq: {} }));
    });
    await page.goto('./#/projets');
    await page.reload();
    await expect(page.locator('.design')).toHaveCount(0);
    await expect(page.getByText('Aucun projet enregistré')).toBeVisible();
  });
});

test('works offline once visited (service worker)', async ({ page, context, isMobile }) => {
  test.skip(isMobile, 'same code path as desktop');
  await page.goto('./');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
  await scene(page); // the 3D chunk is cached too
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Votre bibliothèque sur mesure' })).toBeVisible();
  await scene(page);
  await page.getByRole('link', { name: 'Fiche atelier', exact: true }).click(); // lazy-loaded screen, precached
  await expect(page.getByRole('heading', { name: 'Fiche atelier' })).toBeVisible();
  await context.setOffline(false);
});
