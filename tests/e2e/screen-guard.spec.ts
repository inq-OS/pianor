import { expect, test, type Page } from '@playwright/test';
import { activeScene, expectNoErrors, letGameRun, openGame } from './helpers';
import { TARGET_VIEW } from './targetView';

/**
 * A window too small to play in (d105, d110: it cannot hold the 640 x 360 art canvas at 1x) shows one plain colour and
 * one line asking for a bigger window and F11; the game underneath waits, and comes back by itself when the window is big
 * enough. A normal browser window plays.
 */

/** Chrome on the laptop in a window, with its tabs and the Windows taskbar: 1536x740 CSS pixels at 125%. */
const WINDOWED = { width: 1536, height: 740 };
/** Too small: 600x338 physical pixels at 125%, under the 640 x 360 art canvas at 1x (d110). */
const TINY = { width: 480, height: 270 };

const guard = (page: Page) =>
  page.evaluate(() => {
    const cover = document.getElementById('screen-guard');
    return {
      shown: cover !== null && getComputedStyle(cover).display !== 'none',
      text: cover?.textContent ?? '',
      paused: window.__game.isPaused,
    };
  });

test('a normal browser window plays: no cover, and the game keeps the tested layout area at 4x per cell', async ({ page }) => {
  const errors = await openGame(page);
  await page.setViewportSize(WINDOWED);
  await letGameRun(page, 2);
  expect(await guard(page)).toMatchObject({ shown: false, paused: false });
  await expect.poll(() => page.evaluate(() => (window.__game.scene.getScenes(true)[0] as unknown as { px: { scale: number; width: number } }).px)).toMatchObject({ scale: 4, width: 480 });
  await page.screenshot({ path: test.info().outputPath('windowed.png') });
  expectNoErrors(errors);
});

test('a window too small to play in shows only the line asking for F11, and the game waits until it is big again', async ({ page }) => {
  const errors = await openGame(page);
  expect(await guard(page)).toEqual({ shown: false, text: 'MAKE ME BIGGER + F11!', paused: false });
  const scene = await activeScene(page);
  const xp = await page.evaluate(() => window.__game.registry.get('context').profiles.progress.totalXp as number);

  await page.setViewportSize(TINY);
  await expect.poll(() => guard(page)).toEqual({ shown: true, text: 'MAKE ME BIGGER + F11!', paused: true });
  await page.screenshot({ path: test.info().outputPath('guard-tiny-en.png') });

  // the cover goes away by itself, and the screen underneath is the one that was there, with nothing lost
  await page.setViewportSize(TARGET_VIEW.viewport);
  await expect.poll(() => guard(page)).toMatchObject({ shown: false, paused: false });
  await letGameRun(page, 2);
  expect(await activeScene(page)).toBe(scene);
  expect(await page.evaluate(() => window.__game.registry.get('context').profiles.progress.totalXp as number)).toBe(xp);
  expectNoErrors(errors);
});

test('the line is in Estonian by default', async ({ page }) => {
  const errors = await openGame(page, '?device=virtual', null, 'profiles');
  await page.setViewportSize(TINY);
  await expect.poll(() => guard(page)).toEqual({ shown: true, text: 'TEE MIND SUUREMAKS + F11!', paused: true });
  await page.screenshot({ path: test.info().outputPath('guard-tiny-et.png') });
  expectNoErrors(errors);
});

test('?anysize=1 lets a developer play in a window of any size', async ({ page }) => {
  const errors = await openGame(page, '?device=virtual&anysize=1');
  await page.setViewportSize(TINY);
  await letGameRun(page, 2);
  expect(await page.evaluate(() => document.getElementById('screen-guard'))).toBeNull();
  expect(await page.evaluate(() => window.__game.isPaused)).toBe(false);
  expectNoErrors(errors);
});
