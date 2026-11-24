import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { buttonPoint, expectNoErrors, openGame, sceneButton, sceneTexts, waitForScene, clickButton } from './helpers';

/**
 * Icon buttons and the delayed tooltip (ft_1_08 slice 2). The delay runs on the game's clock, which runs slow when
 * the frame rate drops (software WebGL in CI and cloud runs), so the waits for a tooltip are generous.
 */

async function pointAt(page: Page, key: string, index: number): Promise<void> {
  const c = await buttonPoint(page, key, index);
  await page.mouse.move(c.x, c.y);
}

async function tooltipOf(page: Page, key: string, index: number): Promise<string | null> {
  return page.evaluate(({ k, i }) => window.__game.scene.getScene(k).buttons[i].tooltipShown as string | null, { k: key, i: index });
}

test.describe('icon buttons', () => {
  test('ft_1_08.AC4 the room toolbar shows Settings and Back as icons only, and they still work', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual', 'en', 'profiles');
    await clickButton(page, 'profiles', 0);
    await waitForScene(page, 'profile');
    const texts = await sceneTexts(page, 'profile');
    expect(texts).not.toContain('Settings');
    expect(texts).not.toContain('Back');
    await clickButton(page, 'profile', await sceneButton(page, 'profile', 'Settings'));
    await waitForScene(page, 'settings');
    expectNoErrors(errors);
  });

  test('ft_1_08.AC5 a tooltip with the full name shows after the pointer rests about 0.6 s, and goes when it leaves', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual', 'en', 'profiles');
    await clickButton(page, 'profiles', 0);
    await waitForScene(page, 'profile');
    const back = await sceneButton(page, 'profile', 'Back');
    await pointAt(page, 'profile', back);
    await page.waitForTimeout(200);
    expect(await tooltipOf(page, 'profile', back)).toBeNull();
    await expect.poll(() => tooltipOf(page, 'profile', back), { timeout: 10_000 }).toBe('Back');
    expect(await sceneTexts(page, 'profile')).toContain('Back');
    await page.mouse.move(2, 2);
    await expect.poll(() => tooltipOf(page, 'profile', back)).toBeNull();
    expect(await sceneTexts(page, 'profile')).not.toContain('Back');
    expectNoErrors(errors);
  });

  test('ft_1_08.AC4 the main menu\'s free place, bare piano and gear are pictures alone, their words in a bubble under the pointer', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual', 'en', 'profiles');
    for (const label of ['New player', 'Piece maker', 'Settings']) {
      const index = await sceneButton(page, 'profiles', label);
      expect(index, label).toBeGreaterThanOrEqual(0);
      expect(await sceneTexts(page, 'profiles'), label).not.toContain(label);
      const point = await buttonPoint(page, 'profiles', index);
      await page.mouse.move(point.x, point.y);
      await expect.poll(() => tooltipOf(page, 'profiles', index), { message: label }).toBe(label);
    }
    expectNoErrors(errors);
  });
});
