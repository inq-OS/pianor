// Covers ft_1_28.AC1, ft_1_28.AC2, ft_1_28.AC3, ft_1_28.AC5, ft_1_28.AC7.
import { expect, test, type Page } from '@playwright/test';
import { clickButton, expectNoErrors, menuButton, openFromStand, openGame, openPiece, profileButton, sceneButton, sceneTexts, waitForScene, reachButton } from './helpers';

const SHOTS = process.env.CIRCLE_SHOTS;

/** Whether a scene runs now (a paused scene does not). */
const running = (page: Page, key: string) => page.evaluate((k) => window.__game.scene.getScenes(true).some((s) => s.scene.key === k), key);

const circleState = (page: Page) => page.evaluate(() => {
  const scene = window.__game.scene.getScene('circle') as unknown as { selectedKey: { fifths: number; mode: string }; playing: boolean };
  return { ...scene.selectedKey, playing: scene.playing };
});

/** Press the wheel button on the screen `key` and wait for the circle over it. */
async function openCircle(page: Page, key: string): Promise<void> {
  // on practice and the piece maker the wheel is in the bubble (ft_1_20, d282)
  await expect.poll(() => reachButton(page, key, 'Circle of fifths')).toBeGreaterThanOrEqual(0);
  await clickButton(page, key, await reachButton(page, key, 'Circle of fifths'));
  await waitForScene(page, 'circle');
  expect(await running(page, key)).toBe(false); // paused under the overlay
}

async function closeWithEsc(page: Page, key: string): Promise<void> {
  await page.keyboard.press('Escape');
  await page.waitForFunction((k) => {
    const keys = window.__game.scene.getScenes(true).map((s) => s.scene.key);
    return keys.includes(k) && !keys.includes('circle');
  }, key);
}

/** A real click on the middle of a step's major or minor name on the wheel. */
async function clickStep(page: Page, step: number, ring: 'major' | 'minor'): Promise<void> {
  const point = await page.evaluate(({ s, r }) => {
    const scene = window.__game.scene.getScene('circle') as unknown as { layout: { steps: { majorAt: { x: number; y: number }; minorAt: { x: number; y: number } }[] }; root: { x: number; y: number }; px: { scale: number } };
    const at = r === 'major' ? scene.layout.steps[s]!.majorAt : scene.layout.steps[s]!.minorAt;
    const element = document.querySelector('canvas')!;
    const canvas = element.getBoundingClientRect();
    const ratio = canvas.width / element.width;
    return { x: canvas.left + (scene.root.x + at.x * scene.px.scale) * ratio, y: canvas.top + (scene.root.y + at.y * scene.px.scale) * ratio };
  }, { s: step, r: ring });
  await page.mouse.click(point.x, point.y);
}

async function newPiece(page: Page): Promise<void> {
  await expect.poll(() => menuButton(page, '+ New piece')).toBeGreaterThanOrEqual(0);
  await clickButton(page, 'menu', await menuButton(page, '+ New piece'));
  await waitForScene(page, 'editor');
}

test.describe('Circle of fifths', () => {
  test('ft_1_28.AC1 ft_1_28.AC3 ft_1_28.AC7 the wheel button opens the circle over the piece maker, its tick sets the key, and the key is marked next time', async ({ page }) => {
    const errors = await openGame(page);
    await newPiece(page);
    const key = () => page.evaluate(() => { const p = window.__game.scene.getScene('editor').history.present as { fifths: number; mode: string }; return { fifths: p.fifths, mode: p.mode }; });
    await openCircle(page, 'editor');
    expect(await circleState(page)).toMatchObject({ fifths: 0, mode: 'major' });
    // b minor on the wheel, then its tick: the piece is in two sharps, minor, as an edit Undo takes back
    await clickStep(page, 2, 'minor');
    await clickButton(page, 'circle', await sceneButton(page, 'circle', 'Set the key: b minor'));
    await page.waitForFunction(() => !window.__game.scene.getScenes(true).some((s) => s.scene.key === 'circle'));
    expect(await key()).toEqual({ fifths: 2, mode: 'minor' });
    expect(await page.evaluate(() => (window.__game.scene.getScene('editor') as unknown as { history: { past: unknown[] } }).history.past.length)).toBe(1);
    await openCircle(page, 'editor');
    expect(await circleState(page)).toMatchObject({ fifths: 2, mode: 'minor' });
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/editor-D.png` });
    // the bottom step has two spellings, each its own tick: G flat major is six flats
    await clickStep(page, 6, 'major');
    expect(await sceneButton(page, 'circle', 'Set the key: F# major')).toBeGreaterThanOrEqual(0);
    await clickButton(page, 'circle', await sceneButton(page, 'circle', 'Set the key: G♭ major'));
    await page.waitForFunction(() => !window.__game.scene.getScenes(true).some((s) => s.scene.key === 'circle'));
    expect(await key()).toEqual({ fifths: -6, mode: 'major' });
    // Esc closes it with the key as it was
    await openCircle(page, 'editor');
    await closeWithEsc(page, 'editor');
    expect(await key()).toEqual({ fifths: -6, mode: 'major' });
    expectNoErrors(errors);
  });

  test('ft_1_28.AC1 ft_1_28.AC2 the circle opens over the practice screen and the note-name trainer, with every key and its count', async ({ page }) => {
    const errors = await openGame(page);
    await openPiece(page, 'Little Steps');
    await openCircle(page, 'practice');
    const texts = await sceneTexts(page, 'circle');
    // flats are written with the flat sign, as on the staff (the painter)
    for (const name of ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'G♭', 'D♭', 'A♭', 'E♭', 'B♭', 'F', 'a', 'e', 'b', 'f#', 'c#', 'g#', 'd#', 'b♭', 'f', 'c', 'g', 'd']) expect(texts).toContain(name);
    for (const count of ['1', '2', '3', '4', '5', '6']) expect(texts).toContain(count);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/practice.png` });
    await closeWithEsc(page, 'practice');

    await openGame(page, '?device=virtual', 'en', 'profiles');
    await clickButton(page, 'profiles', await profileButton(page, 'TUVI'));
    await waitForScene(page, 'profile');
    await openFromStand(page, 'Note names');
    await waitForScene(page, 'noteTrainer');
    await openCircle(page, 'noteTrainer');
    // a key played on the piano under the circle is not judged by the trainer
    const lives = () => page.evaluate(() => (window.__game.scene.getScene('noteTrainer') as unknown as { round: { lives: number } }).round.lives);
    const before = await lives();
    for (const midi of [61, 63, 66]) await page.evaluate((m) => { window.__virtualDevice!.press(m, 80); window.__virtualDevice!.release(m); }, midi);
    expect(await lives()).toBe(before);
    await closeWithEsc(page, 'noteTrainer');
    expectNoErrors(errors);
  });

  test('ft_1_28.AC5 a click, the arrows or a key on the piano choose a key, and a click or an arrow plays its scale', async ({ page }) => {
    const errors = await openGame(page);
    await openPiece(page, 'Little Steps');
    await openCircle(page, 'practice');

    await clickStep(page, 1, 'minor');
    await expect.poll(() => circleState(page)).toMatchObject({ fifths: 1, mode: 'minor', playing: true });
    expect(await sceneTexts(page, 'circle')).toContain('e minor');
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/e-minor.png` });

    await page.keyboard.press('ArrowRight');
    await expect.poll(() => circleState(page)).toMatchObject({ fifths: 2, mode: 'minor', playing: true });
    await page.keyboard.press('ArrowUp');
    await expect.poll(() => circleState(page)).toMatchObject({ fifths: 2, mode: 'major' });

    // F on the piano: F major, one flat; the scale is not played over the student's own playing
    await clickStep(page, 0, 'major');
    await page.evaluate(() => { window.__virtualDevice!.press(65, 80); window.__virtualDevice!.release(65); });
    await expect.poll(() => circleState(page)).toMatchObject({ fifths: -1, mode: 'major', playing: false });
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/F-major.png` });

    // the close button on the circle goes back too
    await clickButton(page, 'circle', await sceneButton(page, 'circle', 'Close'));
    await page.waitForFunction(() => !window.__game.scene.getScenes(true).some((s) => s.scene.key === 'circle'));
    expect(await running(page, 'practice')).toBe(true);
    expectNoErrors(errors);
  });
});
