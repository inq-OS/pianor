// Covers ft_1_27.AC2 (WP-15): the teacher's galleon comes in to the southern harbour and she goes ashore, a script on WP-07's interpreter.
import { expect, test, type Page } from '@playwright/test';
import { activeScenes, expectNoErrors, openGame, waitForScene } from './helpers';

const SCENE = 'port';

interface ScriptState { id: string; done: boolean; given: string[]; saying: string | null }

/** Opens the southern harbour with the teacher's arrival, from the menu (the map does not lead there yet). */
async function openArrival(page: Page): Promise<void> {
  await page.evaluate((key) => {
    window.__game.scene.stop('menu');
    window.__game.scene.start(key, { script: 'teacher-arrives' });
  }, SCENE);
  await waitForScene(page, SCENE);
}

const scriptState = (page: Page) =>
  page.evaluate((key) => (window.__game.scene.getScene(key) as unknown as { scriptState: ScriptState | null }).scriptState, SCENE);

/** An actor's box (no art yet for the teacher; the galleon is the picture's own): where it stands in the canvas's own pixels, or null when it is not shown. */
const actorAt = (page: Page, id: string) => page.evaluate(({ key, name }) => {
  const scene = window.__game.scene.getScene(key) as unknown as { children: { list: { list?: { name: string; visible: boolean; getBounds(): { x: number; y: number } }[] }[] } };
  const all = scene.children.list.flatMap((c) => c.list ?? []);
  const found = all.find((o) => o.name === name && o.visible);
  return found ? found.getBounds() : null;
}, { key: SCENE, name: `actor:${id}` });

test.describe('the teacher arrives at the southern harbour (ft_1_27.AC2, WP-15)', () => {
  test('ft_1_27.AC2 Kiur sees the galleon, it sails in to its berth, the teacher steps onto the quay and walks off toward the island, and the script ends', async ({ page }) => {
    test.slow(); // the galleon sails and she walks for some seconds
    const errors = await openGame(page);
    await openArrival(page);
    await expect.poll(() => actorAt(page, 'galleon')).not.toBeNull();
    const far = (await actorAt(page, 'galleon'))!;
    expect(await actorAt(page, 'teacher')).toBeNull();
    await expect.poll(async () => (await scriptState(page))?.saying ?? '', { timeout: 15000 }).toContain('Maybe it is the teacher');
    // a press ends Kiur's line; the galleon sails in and she steps off
    await page.keyboard.press('Space');
    await expect.poll(() => actorAt(page, 'teacher'), { timeout: 20000 }).not.toBeNull();
    const moored = (await actorAt(page, 'galleon'))!;
    // in from the open sea past the quay's head, toward the island
    expect(moored.x).toBeLessThan(far.x);
    await expect.poll(async () => (await scriptState(page))?.done, { timeout: 40000 }).toBe(true);
    expect(await actorAt(page, 'teacher')).toBeNull();
    expect(await actorAt(page, 'galleon')).toEqual(moored);
    expectNoErrors(errors);
  });

  test('ft_1_27.AC2 Esc skips her arrival to its end; Esc again leaves the harbour', async ({ page }) => {
    const errors = await openGame(page);
    await openArrival(page);
    await expect.poll(() => actorAt(page, 'galleon')).not.toBeNull();
    await page.keyboard.press('Escape');
    expect(await scriptState(page)).toMatchObject({ id: 'teacher-arrives', done: true });
    expect(await actorAt(page, 'teacher')).toBeNull();
    expect(await activeScenes(page)).toContain(SCENE);
    await page.keyboard.press('Escape');
    await expect.poll(() => activeScenes(page)).not.toContain(SCENE);
    expectNoErrors(errors);
  });
});
