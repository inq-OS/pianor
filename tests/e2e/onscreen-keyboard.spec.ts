// Covers ft_Y_12.AC1 to AC4: the on-screen piano is a developer's tool (d099): hidden at first with or without a piano (the
// computer keys still play), and the switch on the settings screen shows or hides it for this visit only.
import { expect, test, type Page } from '@playwright/test';
import { LITTLE_STEPS, clickToolbar, expectNoErrors, openGame, openPiece, openSettings, playWithVirtualPiano, results, toScoreScreen, waitForScene } from './helpers';
import { TARGET_VIEW } from './targetView';

/** No device: the computer keys play; the on-screen piano is hidden at first like with a piano (d099). */
const NO_PIANO = '';

/** The on-screen piano's box on the page, or null when it is not visible (hidden, or not drawn). */
const pianoBox = (page: Page) =>
  page.evaluate(() => {
    const host = document.getElementById('keyboard')!;
    const visible = getComputedStyle(host).display !== 'none' && getComputedStyle(host).visibility !== 'hidden';
    if (!visible || !document.querySelector('[data-testid="on-screen-keyboard"]')) return null;
    const r = host.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom };
  });

/** Press the keyboard switch on the settings screen and come back to the piece list (d099). */
async function toggleInSettings(page: Page): Promise<void> {
  await openSettings(page);
  await clickToolbar(page, 'keys');
  await clickToolbar(page, 'back');
  await waitForScene(page, 'menu');
}

/** The space the on-screen piano takes on the page, whether or not it is visible. */
const keyboardSpace = (page: Page) =>
  page.evaluate(() => {
    const r = document.getElementById('keyboard')!.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, height: r.height };
  });

/** The game area (where the staff is drawn) and the height of its canvas in screen pixels. */
const gameArea = (page: Page) =>
  page.evaluate(() => {
    const r = document.getElementById('game')!.getBoundingClientRect();
    const scale = (window.__game as unknown as { scale: { height: number } }).scale;
    return { top: r.top, bottom: r.bottom, canvasHeight: scale.height };
  });

const staff = (page: Page) =>
  page.evaluate(() => {
    const layout = window.__game.scene.getScene('practice').playSession.staffView.layout;
    return { fits: layout.fits as boolean, staffSpace: layout.staffSpace as number, height: layout.height as number, width: layout.width as number };
  });

test.describe('on-screen keyboard switch (d099)', () => {
  test('ft_Y_12.AC1: with or without a piano no on-screen piano is drawn at first; the settings screen\'s switch shows it on every screen for this visit', async ({ page }) => {
    for (const query of [NO_PIANO, '?device=virtual']) {
      const errors = await openGame(page, query);
      await openPiece(page, 'Little Steps');
      expect(await pianoBox(page), query).toBeNull();
      await page.keyboard.press('Escape');
      await waitForScene(page, 'menu');
      await toggleInSettings(page); // shows it
      await openPiece(page, 'Little Steps');
      expect(await pianoBox(page), query).not.toBeNull(); // this visit: the next piece keeps the switch's choice
      await page.keyboard.press('Escape');
      await waitForScene(page, 'menu');
      expect(await pianoBox(page), query).not.toBeNull();
      await toggleInSettings(page); // hides it again
      expect(await pianoBox(page), query).toBeNull();
      expectNoErrors(errors);
    }
  });

  test.describe('staff on the laptop full screen (d105)', () => {

    test('ft_Y_12.AC2: with the piano hidden the game takes its height, the staff fits and is no smaller, and nothing overlaps', async ({ page }) => {
      const errors = await openGame(page);
      await openPiece(page, 'Little Steps');
      const hidden = await staff(page);
      const hiddenArea = await gameArea(page);
      const hiddenSpace = await keyboardSpace(page);
      expect(await pianoBox(page)).toBeNull(); // nothing is drawn
      expect(hiddenSpace.height).toBe(0); // and it takes no room
      // the game, with its toolbar inside it (d088), starts at the top of the page
      expect(hiddenArea.top).toBe(0);
      expect(hidden.fits).toBe(true);
      expect(hiddenArea.bottom).toBeLessThanOrEqual(TARGET_VIEW.viewport.height + 1); // still on the screen

      // the switch is on the settings screen (d099); here it is pressed in place, so the practice screen stays up
      await page.evaluate(() => window.__game.registry.get('context').keyboardSwitch.toggle());
      await expect.poll(async () => (await keyboardSpace(page)).height).toBeGreaterThan(0);
      const shown = await staff(page);
      const shownArea = await gameArea(page);
      const shownSpace = await keyboardSpace(page);
      expect(shownSpace.height).toBeGreaterThan(0);
      expect(shownArea.bottom).toBeLessThanOrEqual(shownSpace.top + 1); // the game area ends where the piano starts: no overlap
      expect(hiddenArea.canvasHeight).toBeGreaterThan(shownArea.canvasHeight); // the game gets the keyboard's height
      expect(hidden.width).toBe(shown.width);
      expect(hidden.height).toBeGreaterThan(shown.height);
      expect(hidden.staffSpace).toBeGreaterThanOrEqual(shown.staffSpace);
      expectNoErrors(errors);
    });
  });

  test('ft_Y_12.AC4: with the piano hidden the virtual EZ-220 still plays a piece to the results screen', async ({ page }) => {
    const errors = await openGame(page);
    await openPiece(page, 'Little Steps');
    expect(await pianoBox(page)).toBeNull();
    await playWithVirtualPiano(page, LITTLE_STEPS);
    await toScoreScreen(page);
    expect(await results(page)).toMatchObject({ notes: 11, accuracy: 1, mistakes: 0 });
    expectNoErrors(errors);
  });
});
