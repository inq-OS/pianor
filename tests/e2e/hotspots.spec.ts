// Covers ft_1_24.AC1 and ft_1_24.AC4 (WP-05): a scene's hotspots and exits are pressed; a hotspot's look line is said
// over it, an exit leaves to its place.
import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { activeScenes, clickButton, expectNoErrors, letGameRun, openGame, sceneButton, waitForScene, type PageErrors } from './helpers';

interface Box { x: number; y: number; width: number; height: number }

async function openKnoll(page: Page, query = '?device=virtual'): Promise<PageErrors> {
  const errors = await openGame(page, query);
  await page.evaluate(() => {
    window.__game.scene.stop('menu');
    window.__game.scene.start('knoll');
  });
  await waitForScene(page, 'knoll');
  await letGameRun(page, 3, 50);
  return errors;
}

const lookingAt = (page: Page) => page.evaluate(() => (window.__game.scene.getScene('knoll') as unknown as { lookingAt: string | null }).lookingAt);

/** A named object's box on the canvas, or null when none is shown. */
const boxOf = (page: Page, name: string) => page.evaluate((n) => {
  const scene = window.__game.scene.getScene('knoll') as unknown as { children: { list: { name: string; list?: { name: string; getBounds(): Box }[]; getBounds?(): Box }[] } };
  const all = scene.children.list.flatMap((c) => [c, ...(c.list ?? [])]);
  const found = all.find((o) => o.name === n);
  return found?.getBounds ? found.getBounds() : null;
}, name);

test.describe('hotspots and exits in a scene (ft_1_24.AC1, ft_1_24.AC4, WP-05)', () => {
  test('ft_1_24.AC4 pressing the knoll\'s fire place says its look line over it; it goes after its reading time, and a second press ends it sooner', async ({ page }) => {
    const errors = await openKnoll(page);
    const fire = await sceneButton(page, 'knoll', 'Fire place');
    expect(fire).toBeGreaterThanOrEqual(0);
    await clickButton(page, 'knoll', fire);
    await expect.poll(() => lookingAt(page)).toBe('fire');
    const line = await boxOf(page, 'lookLine');
    expect(line).not.toBeNull();
    const canvas = await page.evaluate(() => ({ w: document.querySelector('canvas')!.width, h: document.querySelector('canvas')!.height }));
    expect(line!.x).toBeGreaterThanOrEqual(0);
    expect(line!.x + line!.width).toBeLessThanOrEqual(canvas.w);
    // it goes by itself (2.5 s at least)
    await expect.poll(() => lookingAt(page), { timeout: 8000 }).toBeNull();
    expect(await boxOf(page, 'lookLine')).toBeNull();
    // a second press ends it at once
    await clickButton(page, 'knoll', await sceneButton(page, 'knoll', 'Fire place'));
    await expect.poll(() => lookingAt(page)).toBe('fire');
    await clickButton(page, 'knoll', await sceneButton(page, 'knoll', 'Fire place'));
    await expect.poll(() => lookingAt(page)).toBeNull();
    expectNoErrors(errors);
  });

  test('ft_1_24.AC4 a look line ends when a talk opens over the scene', async ({ page }) => {
    const errors = await openKnoll(page, '?actors=1');
    expect(await page.evaluate(() => (window.__game.scene.getScene('knoll') as unknown as { lookAt(id: string): boolean }).lookAt('fire'))).toBe(true);
    await expect.poll(() => lookingAt(page)).toBe('fire');
    await clickButton(page, 'knoll', await sceneButton(page, 'knoll', '???')); // not asked who he is (ft_1_22.AC10)
    await expect.poll(() => lookingAt(page)).toBeNull();
    expect(await boxOf(page, 'lookLine')).toBeNull();
    expectNoErrors(errors);
  });

  test('ft_1_24.AC1 an exit leaves to the map (an exit added to the scene\'s data for the test; the scene files have none yet)', async ({ page }) => {
    const errors = await openKnoll(page);
    const left = await page.evaluate(() => {
      const scene = window.__game.scene.getScene('knoll') as unknown as { sceneData: { exits: unknown[] }; leaveBy(id: string): boolean };
      scene.sceneData.exits.push({ id: 'down-the-path', area: { x: 10, y: 150, w: 40, h: 20 }, to: 'map', name: 'scene.knoll.fire' });
      try {
        return scene.leaveBy('down-the-path');
      } finally {
        scene.sceneData.exits.pop();
      }
    });
    expect(left).toBe(true);
    await waitForScene(page, 'keriMap');
    expect(await activeScenes(page)).not.toContain('knoll');
    expectNoErrors(errors);
  });
});
