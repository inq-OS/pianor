// Covers ft_1_24.AC6 (WP-07): a script runs in an adventure scene; the placeholder boat sails in to the docks.
import { expect, test, type Page } from '@playwright/test';
import { activeScenes, expectNoErrors, openGame, waitForScene } from './helpers';

interface Box { x: number; y: number; w: number; h: number }
interface ScriptState { id: string; done: boolean; given: string[]; saying: string | null; line: Box | null; picture: Box | null }

/** Opens the docks with the boat's script, from the menu. */
async function openDocksWithBoat(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.__game.scene.stop('menu');
    window.__game.scene.start('docks', { script: 'boat-arrives' });
  });
  await waitForScene(page, 'docks');
}

const scriptState = (page: Page) =>
  page.evaluate(() => (window.__game.scene.getScene('docks') as unknown as { scriptState: ScriptState | null }).scriptState);

/** The boat's box (no art yet): where it stands, in the canvas's own pixels. */
const boatAt = (page: Page) => page.evaluate(() => {
  const scene = window.__game.scene.getScene('docks') as unknown as { children: { list: { list?: { name: string; visible: boolean; getBounds(): { x: number; y: number } }[] }[] } };
  const all = scene.children.list.flatMap((c) => c.list ?? []);
  const boat = all.find((o) => o.name === 'actor:boat' && o.visible);
  return boat ? boat.getBounds() : null;
});

test.describe('scripts in adventure scenes (ft_1_24.AC6, WP-07)', () => {
  test('ft_1_24.AC6 the boat sails in from the sea to the pier, Kiur says his line and plays a tune, and the script ends', async ({ page }) => {
    test.slow(); // the boat sails for a few seconds and the tune plays to its end
    const errors = await openGame(page);
    await openDocksWithBoat(page);
    await expect.poll(() => boatAt(page)).not.toBeNull();
    const start = (await boatAt(page))!;
    await expect.poll(async () => (await scriptState(page))?.saying, { timeout: 15000 }).toBe('A boat came in!');
    // Kiur's line is WP-09's spoken line, drawn whole inside the picture (ft_1_24)
    const { line, picture } = (await scriptState(page))!;
    expect(line).not.toBeNull();
    expect(line!.x).toBeGreaterThanOrEqual(picture!.x);
    expect(line!.y).toBeGreaterThanOrEqual(picture!.y);
    expect(line!.x + line!.w).toBeLessThanOrEqual(picture!.x + picture!.w);
    expect(line!.y + line!.h).toBeLessThanOrEqual(picture!.y + picture!.h);
    expect(await page.evaluate(() => (window.__game.scene.getScene('docks') as unknown as { children: { list: { list?: { name: string; visible: boolean }[] }[] } })
      .children.list.flatMap((c) => c.list ?? []).some((o) => o.name === 'scriptLine' && o.visible))).toBe(true);
    const moored = (await boatAt(page))!;
    expect(moored.x).toBeGreaterThan(start.x);
    expect(moored.y).toBeGreaterThan(start.y);
    // a press ends the line, as in MI2; the tune follows
    await page.keyboard.press('Space');
    await expect.poll(async () => (await scriptState(page))?.saying ?? null).not.toBe('A boat came in!');
    await expect.poll(async () => (await scriptState(page))?.done, { timeout: 40000 }).toBe(true);
    expect(await boatAt(page)).toEqual(moored);
    expectNoErrors(errors);
  });

  test('ft_1_24.AC6 Esc skips the script, the boat at the pier at once; Esc again goes back to the map', async ({ page }) => {
    const errors = await openGame(page);
    await openDocksWithBoat(page);
    await expect.poll(() => boatAt(page)).not.toBeNull();
    const start = (await boatAt(page))!;
    await page.keyboard.press('Escape');
    expect(await scriptState(page)).toMatchObject({ id: 'boat-arrives', done: true });
    await expect.poll(async () => (await boatAt(page))?.x ?? 0).toBeGreaterThan(start.x);
    expect(await activeScenes(page)).toContain('docks');
    await page.keyboard.press('Escape');
    await waitForScene(page, 'keriMap');
    expectNoErrors(errors);
  });

  test('ft_1_24.AC6 the docks without a script run none', async ({ page }) => {
    const errors = await openGame(page);
    await page.evaluate(() => {
      window.__game.scene.stop('menu');
      window.__game.scene.start('docks');
    });
    await waitForScene(page, 'docks');
    expect(await scriptState(page)).toBeNull();
    expect(await boatAt(page)).toBeNull();
    expectNoErrors(errors);
  });

  test('ft_1_24.AC6 an item a script gives goes to the player\'s world: it stands in the band at once and again after the scene is opened anew', async ({ page }) => {
    const errors = await openGame(page);
    await openDocksWithBoat(page);
    await expect.poll(() => scriptState(page)).not.toBeNull();
    // no script in content gives an item yet (which one gives what is a story the maintainer tells), so the scene's handler for a
    // script's give is called as the script would call it, on the visit it runs in
    await page.evaluate(() => {
      const scene = window.__game.scene.getScene('docks') as unknown as { keepGiven(item: string, visit: number): Promise<void>; talkVisit: number };
      return scene.keepGiven('golden-leaf', scene.talkVisit);
    });
    const inventory = () => page.evaluate(() => (window.__game.scene.getScene('docks') as unknown as { bandInventory: string[] }).bandInventory);
    await expect.poll(inventory).toEqual(['golden-leaf']);
    await page.evaluate(() => { window.__game.scene.stop('docks'); window.__game.scene.start('docks'); });
    await waitForScene(page, 'docks');
    await expect.poll(inventory).toEqual(['golden-leaf']);
    expect(await activeScenes(page)).toContain('docks');
    expectNoErrors(errors);
  });
});
