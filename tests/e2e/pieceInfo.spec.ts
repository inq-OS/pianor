// Covers core_05.AC3, core_05.AC5.
import { expect, test, type Page } from '@playwright/test';
import { activeScenes, expectNoErrors, openGame, sceneTexts, showMenuPageWith } from './helpers';

type Target = { info: string } | 'close' | 'outside';

/**
 * Click a thing of the menu with the real mouse, at its on-screen position: a card's "i" button, the card's Close button, or
 * a point left of the info card halfway down the main area, over the first column of piece cards (outside the info card,
 * which over the strip takes almost the whole height of the main area, ft_1_20).
 */
async function click(page: Page, target: Target): Promise<void> {
  const point = await page.evaluate(
    (what) => {
      const scene = window.__game.scene.getScene('menu');
      const px = scene.px as { height: number };
      const m = (scene.root as { getWorldTransformMatrix(): { tx: number; ty: number; scaleX: number; scaleY: number } }).getWorldTransformMatrix();
      const button: { screenCenter(): { x: number; y: number } } | undefined =
        what === 'close' ? scene.infoClose : what === 'outside' ? { screenCenter: () => ({ x: m.tx + 6 * m.scaleX, y: m.ty + (px.height / 2) * m.scaleY }) } : scene.infoButtons.get(what.info);
      if (!button) throw new Error(`nothing to click for ${JSON.stringify(what)}`);
      const c = button.screenCenter();
      const canvas = document.querySelector('canvas')!;
      const r = canvas.getBoundingClientRect();
      return { x: r.left + (c.x / canvas.width) * r.width, y: r.top + (c.y / canvas.height) * r.height };
    },
    target,
  );
  await page.mouse.click(point.x, point.y);
}

test.describe('the info card of a piece', () => {
  test('shows the stars, the style and what the chart says, and Close shuts it', async ({ page }) => {
    const errors = await openGame(page);
    await showMenuPageWith(page, 'Hot Cross Buns');
    await click(page, { info: 'hot-cross-buns' });
    expect(await sceneTexts(page, 'menu')).toEqual(
      expect.arrayContaining(['How hard: Beginner', 'Style: Folk song', 'In this piece:', '- Fastest: quarter notes', 'Close']),
    );
    expect((await sceneTexts(page, 'menu')).join('|')).not.toMatch(/c position|stepwise/);

    await click(page, 'close');
    expect(await sceneTexts(page, 'menu')).not.toContain('How hard: Beginner');
    expectNoErrors(errors);
  });

  test('a piece with two hands, rests or black keys lists them', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual');
    await showMenuPageWith(page, 'Take Turns');
    await click(page, { info: 'take-turns' });
    expect(await sceneTexts(page, 'menu')).toEqual(expect.arrayContaining(['- Both hands play', '- Hands far apart', '- Rests: quiet beats']));
    expectNoErrors(errors);
  });

  test('a tap outside the card closes it and does not press what is behind it', async ({ page }) => {
    const errors = await openGame(page);
    await showMenuPageWith(page, 'Hot Cross Buns');
    await click(page, { info: 'hot-cross-buns' });
    expect(await sceneTexts(page, 'menu')).toContain('How hard: Beginner');
    // the piece cards are under the dimmed screen, outside the card
    await click(page, 'outside');
    expect(await sceneTexts(page, 'menu')).not.toContain('How hard: Beginner');
    expect(await activeScenes(page)).toEqual(['menu']);
    expectNoErrors(errors);
  });
});
