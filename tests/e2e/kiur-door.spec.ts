// Covers ft_1_15.AC4, ft_1_15.AC5.
import { expect, test, type Page } from '@playwright/test';
import { clickButton, expectNoErrors, openGame, openPiece, sceneButton, waitForScene } from './helpers';

/** Palms on the keys: eleven keys down at once on the virtual EZ-220, away from the awaited note, then all up. */
async function bash(page: Page, release = true): Promise<void> {
  await page.evaluate((up) => {
    const keys = Array.from({ length: 11 }, (_, i) => 36 + i);
    for (const m of keys) window.__virtualDevice!.press(m, 100);
    if (up) for (const m of keys) window.__virtualDevice!.release(m);
  }, release);
}

/** Whether a scene runs now (a paused scene does not). */
const running = (page: Page, key: string) => page.evaluate((k) => window.__game.scene.getScenes(true).some((s) => s.scene.key === k), key);
const backAtPiece = (page: Page) => page.waitForFunction(() => {
  const keys = window.__game.scene.getScenes(true).map((s) => s.scene.key);
  return keys.includes('practice') && !keys.includes('kiurDoor');
});

const practiceState = (page: Page) => page.evaluate(() => {
  const scene = window.__game.scene.getScene('practice') as unknown as { playSession: { getState(): { awaiting: number[] } }; session: { wrong: Record<string, number> } };
  return { awaiting: scene.playSession.getState().awaiting, wrong: Object.values(scene.session.wrong).reduce((a, b) => a + b, 0) };
});

test.describe('Kiur at the door', () => {
  test('ft_1_15.AC4 eleven keys at once pause the piece and bring Kiur to the door; Back goes on where the cursor was', async ({ page }) => {
    const errors = await openGame(page);
    await openPiece(page, 'Little Steps');
    await page.evaluate(() => { window.__virtualDevice!.press(60, 80); window.__virtualDevice!.release(60); }); // first note right
    const before = await practiceState(page);

    await bash(page);
    await waitForScene(page, 'kiurDoor');
    expect(await running(page, 'practice')).toBe(false); // paused under the overlay
    // the bash keys were not judged beyond the two that could not be told from playing
    expect((await practiceState(page)).wrong - before.wrong).toBeLessThanOrEqual(2);
    expect((await practiceState(page)).awaiting).toEqual(before.awaiting);
    // keys pressed while Kiur is at the door do nothing
    await page.evaluate(() => { window.__virtualDevice!.press(62, 80); window.__virtualDevice!.release(62); });

    await clickButton(page, 'kiurDoor', await sceneButton(page, 'kiurDoor', 'Back to the piece'));
    await backAtPiece(page);
    expect((await practiceState(page)).awaiting).toEqual(before.awaiting);
    // and playing goes on
    await page.evaluate(() => { window.__virtualDevice!.press(62, 80); window.__virtualDevice!.release(62); });
    await expect.poll(async () => (await practiceState(page)).awaiting).not.toEqual(before.awaiting);
    expectNoErrors(errors);
  });

  test('ft_1_15.AC5 the door leads out to the room, and Esc is back to the piece', async ({ page }) => {
    const errors = await openGame(page);
    await openPiece(page, 'Little Steps');
    await bash(page);
    await waitForScene(page, 'kiurDoor');
    await page.keyboard.press('Escape');
    await backAtPiece(page);

    await bash(page);
    await waitForScene(page, 'kiurDoor');
    await clickButton(page, 'kiurDoor', await sceneButton(page, 'kiurDoor', 'Out the door'));
    await waitForScene(page, 'profile');
    expect(await running(page, 'kiurDoor')).toBe(false);
    expectNoErrors(errors);
  });

  test('ft_1_15.AC4 in Tempo mode Back starts the pass again with a fresh clock', async ({ page }) => {
    const errors = await openGame(page);
    await openPiece(page, 'Little Steps');
    await clickButton(page, 'practice', await sceneButton(page, 'practice', 'Wait')); // to Tempo mode (its following clock, started by the first note)
    await expect.poll(() => page.evaluate(() => window.__game.scene.getScene('practice').transport !== null)).toBe(true);
    await page.evaluate(() => { window.__virtualDevice!.press(60, 80); window.__virtualDevice!.release(60); }); // the first note starts the clock
    await expect.poll(() => page.evaluate(() => (window.__game.scene.getScene('practice').transport as { started: boolean }).started)).toBe(true);
    await bash(page);
    await waitForScene(page, 'kiurDoor');
    await clickButton(page, 'kiurDoor', await sceneButton(page, 'kiurDoor', 'Back to the piece'));
    await backAtPiece(page);
    await expect.poll(() => page.evaluate(() => (window.__game.scene.getScene('practice').transport as { started: boolean }).started)).toBe(false);
    expectNoErrors(errors);
  });
});
