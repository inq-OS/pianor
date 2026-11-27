import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { clickButton, expectNoErrors, menuButton, menuLabels, openGame, profileButton, sceneButton, sceneTexts, waitForScene } from './helpers';

const SHOTS = process.env.NAMING_SHOTS;

/** Open the scales and chords trainer from the stand, in Estonian. */
async function openShapes(page: Page): Promise<void> {
  await clickButton(page, 'profiles', await profileButton(page, 'TUVI'));
  await waitForScene(page, 'profile');
  await clickButton(page, 'profile', await sceneButton(page, 'profile', 'Harjutused'));
  await expect.poll(() => sceneButton(page, 'profile', 'Gammad ja akordid')).toBeGreaterThanOrEqual(0);
  await clickButton(page, 'profile', await sceneButton(page, 'profile', 'Gammad ja akordid'));
  await waitForScene(page, 'shapeTrainer');
}

/** A new round of the trainer in a key, as the circle's tick would choose it. */
const chooseKey = (page: Page, fifths: number, mode: 'major' | 'minor') =>
  page.evaluate(({ f, m }) => (window.__game.scene.getScene('shapeTrainer') as unknown as { choose(c: { fifths: number; mode: string }): void }).choose({ fifths: f, mode: m }), { f: fifths, m: mode });

// ft_0_18: the students's game is in Estonian. The English game is covered by every other test, which opens with `?lang=en`.
test.describe('Estonian text (ft_0_18)', () => {
  test('ft_0_18.AC1 the menu opens in Estonian with no language switch @smoke', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual', null);
    expect(await menuButton(page, 'Seaded')).toBeGreaterThanOrEqual(0); // the toolbar's settings gear, named in Estonian (d088)
    expect(await sceneButton(page, 'menu', '+ Uus lugu')).toBeGreaterThanOrEqual(0); // a staff-and-pencil picture whose label stays on the button; the one piece list (ft_1_12): no Harjutus / Mängi / Tee tabs
    expect(await menuLabels(page)).not.toContain('Harjutus');
    expectNoErrors(errors);
  });

  test('a key is named the Estonian way with H naming, and a C flat scale reads seven different letters (d087, core_09.AC6)', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual', null, 'profiles');
    await openShapes(page);
    // the test players start with B naming; an Estonian school's player turns H on in the settings
    await page.evaluate(() => (window.__game.registry.get('context').profiles as { updateNoteNaming(n: string): Promise<void> }).updateNoteNaming('H'));

    await chooseKey(page, 6, 'major');
    await expect.poll(() => sceneButton(page, 'shapeTrainer', 'Fis-duur')).toBeGreaterThanOrEqual(0);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/shapes-key-button-Fis-duur.png` });

    // C flat major with its names on the notes: no note of the scale reads H or E
    await chooseKey(page, -7, 'major');
    await expect.poll(() => sceneButton(page, 'shapeTrainer', 'Ces-duur')).toBeGreaterThanOrEqual(0);
    await page.evaluate(() => { window.__virtualDevice!.press(61, 80); window.__virtualDevice!.release(61); });
    await expect.poll(() => sceneTexts(page, 'shapeTrainer')).toContain('Fb');
    const names = await sceneTexts(page, 'shapeTrainer');
    for (const name of ['Cb', 'Db', 'Eb', 'Fb', 'Gb', 'Ab', 'B']) expect(names).toContain(name);
    expect(names).not.toContain('H');
    expect(names).not.toContain('E');
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/shapes-Ces-duur-hints.png` });

    // the circle's title and its ticks: gis-moll, and as-moll beside it for the same step
    await chooseKey(page, 5, 'minor');
    await clickButton(page, 'shapeTrainer', await sceneButton(page, 'shapeTrainer', 'Helistik: vali see kvindiringilt'));
    await waitForScene(page, 'circle');
    await expect.poll(() => sceneTexts(page, 'circle')).toContain('gis-moll');
    expect(await sceneButton(page, 'circle', 'Võta helistik: gis-moll')).toBeGreaterThanOrEqual(0);
    expect(await sceneButton(page, 'circle', 'Võta helistik: as-moll')).toBeGreaterThanOrEqual(0);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/circle-gis-moll.png` });
    await page.keyboard.press('ArrowUp');
    await expect.poll(() => sceneTexts(page, 'circle')).toContain('H-duur');
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/circle-H-duur.png` });
    expectNoErrors(errors);
  });
});
