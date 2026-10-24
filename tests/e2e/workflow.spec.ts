import { readFileSync } from 'node:fs';
import { expect, scene, stored, test, total } from './fixtures';

test('sizes, materials and options change the price, the drawing and the address', async ({ page }) => {
  await page.goto('./');
  await scene(page);
  const start = await total(page);
  await page.getByRole('spinbutton', { name: 'Largeur' }).fill('250');
  await expect.poll(() => total(page)).toBeGreaterThan(start);
  await expect(page).toHaveURL(/w=2500/);
  await expect(page.locator('.stepper').first().locator('output')).toHaveText('4'); // three would make 81 cm shelves
  const wide = await total(page);
  await page.locator('label.swatch', { hasText: 'Noyer' }).click();
  await expect.poll(() => total(page)).toBeGreaterThan(wide);
  await expect(page).toHaveURL(/m=noyer/);
  await page.getByRole('radio', { name: 'Tiroirs' }).check();
  await page.getByLabel('Éclairage LED des cases').check();
  await page.getByText('Détail du prix').click();
  await expect(page.locator('.lines')).toContainText('Coulisses à sortie totale');
  await expect(page.locator('.lines')).toContainText('Ruban LED');
  // the 3D view is described to screen readers (the drawing under it is hidden once the scene is up)
  await expect(page.locator('.stage').getByRole('img', { name: /noyer, 250 × 220 × 35 cm, 4 colonnes de 6 cases, tiroirs en bas/ })).toBeVisible();
});

test('the workshop rules adjust what cannot be built and explain why', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('spinbutton', { name: 'Profondeur' }).fill('25');
  await page.getByRole('spinbutton', { name: 'Hauteur' }).fill('250');
  await expect(page.locator('.notice-warn')).toContainText('la fixation murale est indispensable');
  // asking for one column on 2.4 m would make 2.3 m shelves
  await page.getByRole('spinbutton', { name: 'Largeur' }).fill('240');
  const columns = page.locator('.stepper').first();
  await columns.getByRole('checkbox', { name: 'Auto' }).uncheck();
  for (let i = 0; i < 3; i++) await columns.getByRole('button', { name: /Une de moins/ }).click({ force: true }).catch(() => undefined);
  await expect(columns.locator('output')).toHaveText('3');
  await expect(columns.getByRole('button', { name: /Une de moins/ })).toBeDisabled();
  await page.getByRole('spinbutton', { name: 'Largeur' }).fill('320');
  await expect(page.locator('.notices')).toContainText('dessus, dessous et socle sont en deux parties');
});

test('a shared link reopens the same configuration; undo and redo walk the history', async ({ page, context }) => {
  await page.goto('./');
  await page.locator('label.swatch', { hasText: 'Laque vert sauge' }).click();
  await page.getByRole('radio', { name: 'Ouvert' }).check();
  const link = page.url();
  const price = await total(page);
  const other = await context.newPage();
  await other.goto(link);
  await expect(other.locator('label.swatch', { hasText: 'Laque vert sauge' }).locator('input')).toBeChecked();
  await expect(other.getByRole('radio', { name: 'Ouvert' })).toBeChecked();
  expect(await total(other)).toBe(price);

  await page.getByRole('button', { name: 'Annuler' }).click();
  await expect(page.getByRole('radio', { name: 'Portes' })).toBeChecked();
  await page.getByRole('button', { name: 'Annuler' }).click();
  await expect(page.locator('label.swatch', { hasText: 'Chêne' }).locator('input')).toBeChecked();
  await page.keyboard.press('Control+Shift+Z');
  await expect(page.locator('label.swatch', { hasText: 'Laque vert sauge' }).locator('input')).toBeChecked();
});

test('the 3D view turns, shows dimensions, opens the doors and saves an image', async ({ page, isMobile }) => {
  test.skip(isMobile, 'same scene, desktop is enough');
  await page.goto('./');
  await scene(page);
  await page.getByRole('button', { name: 'Face' }).click();
  await expect(page.getByRole('button', { name: 'Face' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Cotes' }).click();
  await page.getByRole('button', { name: 'Ouvrir', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Ouvrir', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const [image] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Image' }).click()]);
  expect(image.suggestedFilename()).toBe('bibliotheque-180x220.png');
  const png = readFileSync(await image.path());
  expect(png.subarray(1, 4).toString('latin1')).toBe('PNG');
  expect(png.length).toBeGreaterThan(20_000); // a real render, not an empty canvas
});

test('on a phone the 3D view waits for a tap, the front view is there meanwhile', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'desktop loads it by itself');
  await page.goto('./');
  await expect(page.locator('.stage svg.elevation')).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(page.locator('.stage canvas')).toHaveCount(0);
  await expect(page.getByText('la 3D (environ 250 Ko) se charge à la demande')).toBeVisible();
  await page.getByRole('button', { name: 'Afficher en 3D' }).click();
  await expect(page.locator('.stage-ready canvas')).toBeVisible({ timeout: 20_000 });
});

test('without WebGL the front view stays, and everything else works', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      return /webgl/.test(type) ? null : (original as (this: HTMLCanvasElement, ...a: unknown[]) => RenderingContext | null).call(this, type, ...rest);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  await page.goto('./');
  const ask = page.getByRole('button', { name: 'Afficher en 3D' }); // phones ask first
  if (await ask.isVisible()) await ask.click();
  await expect(page.getByText('La 3D n’est pas disponible sur cet appareil')).toBeVisible();
  await expect(page.locator('.stage svg.elevation')).toBeVisible();
  await expect(page.locator('.stage canvas')).toHaveCount(0);
  await page.getByRole('spinbutton', { name: 'Hauteur' }).fill('120');
  await expect(page.locator('.stage svg.elevation')).toHaveAttribute('aria-label', /180 × 120 × 35 cm/);
});

test('a design is saved, listed, reopened and deleted', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('spinbutton', { name: 'Hauteur' }).fill('140');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await page.getByRole('dialog').getByLabel('Nom du projet').fill('Salon, sous la fenêtre');
  await page.getByRole('dialog').getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.locator('.toast')).toContainText('Projet enregistré');
  await page.getByRole('link', { name: /Mes projets/ }).click();
  const card = page.locator('.design', { hasText: 'Salon, sous la fenêtre' });
  await expect(card).toContainText('180 × 140 × 35 cm');
  await page.getByRole('link', { name: 'Configurer' }).click();
  await page.getByRole('spinbutton', { name: 'Hauteur' }).fill('200');
  await page.getByRole('link', { name: /Mes projets/ }).click();
  await card.getByRole('button', { name: 'Ouvrir' }).click();
  await expect(page.getByRole('spinbutton', { name: 'Hauteur' })).toHaveValue('140');
  await page.getByRole('link', { name: /Mes projets/ }).click();
  await card.getByRole('button', { name: /Supprimer/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Supprimer' }).click();
  await expect(page.locator('.design')).toHaveCount(0);
});

test('a quote request is checked, numbered, and its summary downloads as a PDF', async ({ page }) => {
  await page.goto('./');
  const price = await total(page);
  await page.getByRole('link', { name: 'Demander un devis' }).click();
  await page.getByRole('button', { name: 'Envoyer la demande' }).click();
  await expect(page.getByText('Indiquez votre nom et votre prénom.')).toBeVisible();
  await expect(page.getByLabel('Nom et prénom')).toBeFocused();
  await page.getByLabel('Nom et prénom').fill('Camille Durand');
  await page.getByLabel('E-mail').fill('camille.durand@example.com');
  await page.getByLabel('Téléphone').fill('06 39 98 12 34');
  await page.getByLabel('Code postal du lieu de pose').fill('74000');
  await page.getByLabel(/Précisions/).fill('Mur de 2,40 m dans le séjour, plinthe de 10 cm.');
  await page.getByLabel(/J’accepte/).check();
  await page.waitForTimeout(1600); // the anti-bot guard refuses forms sent faster than a person can
  await page.getByRole('button', { name: 'Envoyer la demande' }).click();
  await expect(page.getByRole('heading', { name: 'Demande envoyée' })).toBeVisible();
  await expect(page.locator('.done-ref')).toHaveText(/^Référence AL-\d{4}-0001$/);
  expect(Math.round((await stored(page, (s) => s.requests[0]?.total ?? 0)) / 100)).toBe(price); // shown in whole euros

  const [pdf] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Télécharger le récapitulatif/ }).click()]);
  expect(pdf.suggestedFilename()).toMatch(/^recapitulatif-al-\d{4}-0001\.pdf$/);
  const bytes = readFileSync(await pdf.path());
  expect(bytes.subarray(0, 8).toString('latin1')).toBe('%PDF-1.4');
  expect(bytes.toString('latin1')).toContain('/Count 2'); // summary and cutting list
});

test('the workshop sheet lists the pieces, draws the cutting plan and exports CSV', async ({ page }) => {
  await page.goto('./#/atelier');
  await expect(page.getByRole('heading', { name: 'Fiche atelier' })).toBeVisible();
  await expect(page.locator('.table')).toContainText('Montant');
  await expect(page.locator('.sheet')).toHaveCount(3); // two oak sheets, one for the backs
  await expect(page.locator('.sheet').first().getByRole('img')).toHaveAttribute('aria-label', /Panneau 1 sur 2/);
  const [file] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exporter en CSV' }).click()]);
  expect(file.suggestedFilename()).toBe('fiche-de-debit-180x220.csv');
  const text = readFileSync(await file.path(), 'utf8');
  expect(text).toContain('Montant;2;2120;350;19');
});

test('the language switch translates the interface', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your made-to-measure bookcase');
  await expect(page.locator('.summary')).toContainText('Estimated price');
});
