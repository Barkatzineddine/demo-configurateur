// Shared Playwright fixtures: any console error or uncaught exception fails the test, so a CSP or
// Trusted Types violation anywhere in a flow is caught, not just in the tests written for it.
import { test as base, expect, type Page } from '@playwright/test';

export const test = base.extend<{ allowedConsole: RegExp | null; consoleErrors: string[] }>({
  allowedConsole: [null, { option: true }],
  // a first visit starts on the inert pre-rendered copy (build/prerender.ts): navigations wait until the
  // app has replaced it, as a person would, unless a test asks to look at the copy (waitUntil: 'commit')
  page: async ({ page }, use) => {
    const goto = page.goto.bind(page);
    const reload = page.reload.bind(page);
    const live = async (waitUntil?: string) => { if (waitUntil !== 'commit') await page.locator('[data-prerendered]').waitFor({ state: 'detached' }); };
    page.goto = async (url, options) => { const response = await goto(url, options); await live(options?.waitUntil); return response; };
    page.reload = async (options) => { const response = await reload(options); await live(options?.waitUntil); return response; };
    await use(page);
  },
  consoleErrors: [async ({ page, allowedConsole }, use) => {
    const errors: string[] = [];
    page.on('console', (m) => { if (m.type() === 'error' && !(allowedConsole?.test(m.text()))) errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(`uncaught: ${e.message}`));
    await use(errors);
    expect(errors, 'console errors').toEqual([]);
  }, { auto: true }],
});
export { expect };

/** The estimated total shown, in euros. */
export async function total(page: Page): Promise<number> {
  const text = (await page.locator('.summary .total strong').textContent()) ?? '';
  return Number(text.replace(/[^\d]/g, ''));
}

/** Waits for the 3D view to be on screen, asking for it where it loads on request (phones). */
export async function scene(page: Page): Promise<void> {
  const ask = page.getByRole('button', { name: 'Afficher en 3D' });
  if (await ask.isVisible()) await ask.click();
  await expect(page.locator('.stage-ready canvas')).toBeVisible({ timeout: 20_000 });
}

/** Reads what the app saved in localStorage. */
export async function stored<T>(page: Page, pick: (s: { designs: { name: string }[]; requests: { ref: string; total: number }[] }) => T): Promise<T> {
  const raw = await page.evaluate(() => localStorage.getItem('lisiere:v1') ?? '{"designs":[],"requests":[]}');
  return pick(JSON.parse(raw));
}
