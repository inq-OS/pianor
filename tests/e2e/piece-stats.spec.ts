// Covers core_04.AC5.
import { expect, test, type Page } from '@playwright/test';
import { LITTLE_STEPS, clickButton, expectNoErrors, openGame, openPiece, playWithKeys, playWithVirtualPiano, sceneTexts, showMenuPageWith, toScoreScreen, waitForScene, stripAction } from './helpers';

/** Click a card's "S" button with the real mouse, at its on-screen position. */
async function openStats(page: Page, chartId: string): Promise<void> {
  const point = await page.evaluate((id) => {
    const button = window.__game.scene.getScene('menu').statsButtons.get(id);
    if (!button) throw new Error(`no stats button for ${id}`);
    const c = button.screenCenter();
    const canvas = document.querySelector('canvas')!;
    const r = canvas.getBoundingClientRect();
    return { x: r.left + (c.x / canvas.width) * r.width, y: r.top + (c.y / canvas.height) * r.height };
  }, chartId);
  await page.mouse.click(point.x, point.y);
  await waitForScene(page, 'results');
}

const graph = (page: Page) =>
  page.evaluate(() => {
    const g = window.__game.scene.getScene('results').graph as { shown: number; total: number; points: { mode: string }[] };
    return { shown: g.shown, total: g.total, modes: g.points.map((p) => p.mode) };
  });

test.describe('the stats of a piece on the score screen (ft_1_12.AC4)', () => {
  test('core_04.AC5 the S button opens it; a piece not played yet says so kindly, and Back goes to the menu', async ({ page }) => {
    const errors = await openGame(page);
    await showMenuPageWith(page, 'Little Steps');
    await openStats(page, 'little-steps');
    const texts = await sceneTexts(page, 'results');
    // Back is a door picture: its label is the tooltip, not drawn text
    expect(texts).toEqual(expect.arrayContaining(['Little Steps', 'Not played yet. Play the whole piece, and your graph starts here!', '100%', '50%', '0%']));
    expect(await graph(page)).toEqual({ shown: 0, total: 0, modes: [] });

    await page.keyboard.press('Escape');
    await waitForScene(page, 'menu');
    await openStats(page, 'little-steps');
    await clickButton(page, 'results', await stripAction(page, 'results', 1)); // More pieces
    await waitForScene(page, 'menu');
    expectNoErrors(errors);
  });

  test('core_04.AC5 a full play is on the page and its graph; a section played over and over is not', async ({ page }) => {
    test.slow();
    const errors = await openGame(page);
    // a section of bars 2 and 3, played twice round: no attempt, so nothing on the stats page
    await page.evaluate(() => {
      const menu = window.__game.scene.getScene('menu') as unknown as { scene: { start(key: string, data: unknown): void } };
      menu.scene.start('practice', { chartId: 'little-steps', section: { first: 1, last: 2 } });
    });
    await waitForScene(page, 'practice');
    await expect.poll(() => page.evaluate(() => window.__game.scene.getScene('practice').chart.id as string)).toBe('little-steps#bars-2-3');
    await playWithVirtualPiano(page, [67, 65, 65, 64, 62, 60]);
    await expect.poll(() => page.evaluate(() => window.__game.scene.getScene('practice').startData.lap)).toBe(1);
    // leaving after keys were played shows the score screen of the session (ft_1_12), with no pass to the end
    await page.keyboard.press('Escape');
    await waitForScene(page, 'results');
    await clickButton(page, 'results', await stripAction(page, 'results', 1)); // More pieces
    await waitForScene(page, 'menu');
    await showMenuPageWith(page, 'Little Steps');
    await openStats(page, 'little-steps');
    expect(await sceneTexts(page, 'results')).toContain('Not played yet. Play the whole piece, and your graph starts here!');
    await clickButton(page, 'results', await stripAction(page, 'results', 1));
    await waitForScene(page, 'menu');

    // the whole piece, played clean
    await openPiece(page, 'Little Steps');
    await playWithKeys(page, LITTLE_STEPS);
    await toScoreScreen(page);
    await clickButton(page, 'results', await stripAction(page, 'results', 1)); // More pieces
    await waitForScene(page, 'menu');
    await showMenuPageWith(page, 'Little Steps');
    await openStats(page, 'little-steps');
    expect(await sceneTexts(page, 'results')).toEqual(expect.arrayContaining(['Played once', 'Keeping it up: 100%', 'Right the first time: 100%']));
    expect(await graph(page)).toEqual({ shown: 1, total: 1, modes: ['wait'] });
    expect((await sceneTexts(page, 'results')).join('|')).not.toMatch(/worse|less than|lower than/i);
    expectNoErrors(errors);
  });
});
