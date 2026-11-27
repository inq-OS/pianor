import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { LITTLE_STEPS, activeScenes, clickButton, expectNoErrors, letGameRun, openGame, playWithVirtualPiano, sceneButton, waitForScene } from './helpers';

type Here = { ids: string[]; saying: string | null; asking: boolean };
const here = (page: Page) => page.evaluate(() => (window.__game.scene.getScene('knoll') as unknown as { wanderersHere: Here }).wanderersHere);
const press = (page: Page) => page.evaluate(() => (window.__game.scene.getScene('knoll') as unknown as { pressWanderer(id: string): boolean }).pressWanderer('traveller'));
const world = (page: Page) => page.evaluate(async () => {
  const { profiles } = window.__game.registry.get('context');
  return (await profiles.worldOf(profiles.profile.id)) as { items: string[]; wandererGifts?: unknown[] };
});

test.describe('a wanderer the teacher sends (ft_1_37)', () => {
  test('ft_1_37.AC6 ft_1_37.AC7 ft_1_37.AC9 stands in an open scene the day it is sent, asks for its piece, hears one pass and gives one keepsake', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual', 'en', 'profiles');
    await page.evaluate(async () => {
      const { profiles } = window.__game.registry.get('context');
      const d = new Date();
      const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const ok = await profiles.saveCurriculum(profiles.profiles[0].id, { base: 85, pieces: [], calendar: [], cast: { sent: [{ wanderer: 'traveller', day, piece: 'little-steps' }] } });
      if (!ok) throw new Error('the curriculum was not saved');
    });
    await clickButton(page, 'profiles', 0);
    await waitForScene(page, 'profile');
    await page.evaluate(() => window.__game.scene.start('knoll'));
    await waitForScene(page, 'knoll');
    // the knoll is the one scene open at level 1, so it stands there
    await expect.poll(async () => (await here(page)).ids).toEqual(['traveller']);
    expect(await press(page)).toBe(true);
    expect(await here(page)).toMatchObject({ saying: 'Would you play me Little Steps?', asking: true });
    // a double tap on the wanderer never answers: another press while it asks does nothing
    expect(await press(page)).toBe(false);
    await page.screenshot({ path: 'test-results/wanderer-asks.png' });
    // the ask waits for an answer: it is still there after its reading time
    await letGameRun(page, 10, 400);
    expect((await here(page)).asking).toBe(true);
    // both answers are on the board with their words: Not now closes the ask, and the wanderer stays to be asked again
    await clickButton(page, 'knoll', await sceneButton(page, 'knoll', 'Not now'));
    await expect.poll(async () => (await here(page)).asking).toBe(false);
    expect((await here(page)).ids).toEqual(['traveller']);
    expect(await press(page)).toBe(true);
    await letGameRun(page, 10, 400);
    const words = await page.evaluate(() => (window.__game.scene.getScene('knoll') as unknown as { root: { list: { name: string; visible: boolean }[] } }).root.list.filter((o) => o.name.endsWith(':word') && o.visible).map((o) => o.name));
    expect(words).toEqual(['wanderer:play:word', 'wanderer:notNow:word']);
    // the answer is the board's picture, Play it in its bubble
    await clickButton(page, 'knoll', await sceneButton(page, 'knoll', 'Play it'));
    await waitForScene(page, 'practice');
    await letGameRun(page, 5, 200);
    await playWithVirtualPiano(page, LITTLE_STEPS);
    await waitForScene(page, 'knoll');
    await expect.poll(async () => (await here(page)).saying ?? '').toMatch(/^\d+ of \d+ notes right the first time\. Here, take this: /);
    await page.screenshot({ path: 'test-results/wanderer-keepsake.png' });
    const after = await world(page);
    expect(after.items).toHaveLength(1);
    expect(after.wandererGifts).toHaveLength(1);
    // one keepsake a day: a press says so and asks nothing more
    await press(page);
    expect((await here(page)).saying).toBe('I gave you something already today. Come again another day.');
    expectNoErrors(errors);
  });

  test('ft_1_37.AC1 a character the teacher switched off does not stand in its scene for an ordinary player; on, with its chance at 100, it does', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual', 'en', 'profiles');
    const setCast = (on: boolean) => page.evaluate(async (on) => {
      const { profiles } = window.__game.registry.get('context');
      // an hour of practice, so the oak spirit may be met (its threshold is 30 minutes)
      const start = Date.now() - 2 * 3_600_000;
      const bars = Array.from({ length: 121 }, (_, i) => ({ at: new Date(start + i * 30_000).toISOString(), pieceId: 'little-steps', bar: 0, notes: 4, firstTry: 4, timing: null, mode: 'wait', tempoPercent: 100, section: null, misses: [] }));
      if (on === false && !(await profiles.recordBarPlays(bars))) throw new Error('the practice was not kept');
      const ok = await profiles.saveCurriculum(profiles.profile.id, { base: 85, pieces: [], calendar: [], cast: { characters: { puuvaim: on ? { chance: 1 } : { on: false, chance: 1 } } } });
      if (!ok) throw new Error('the curriculum was not saved');
    }, on);
    const actors = () => page.evaluate(() => (window.__game.scene.getScene('knoll') as unknown as { root: { list: { name: string }[] } }).root.list.filter((o) => o.name === 'actor:puuvaim').length);
    await clickButton(page, 'profiles', 0);
    await waitForScene(page, 'profile');
    await setCast(false);
    await page.evaluate(() => window.__game.scene.start('knoll'));
    await waitForScene(page, 'knoll');
    await letGameRun(page, 5, 200);
    expect(await actors()).toBe(0);
    await setCast(true);
    await page.evaluate(() => window.__game.scene.start('knoll'));
    await waitForScene(page, 'knoll');
    await expect.poll(actors).toBeGreaterThan(0);
    expectNoErrors(errors);
  });
});

/** Puts the traveller in scene `key` today without the day's draw, once the scene has read who stands there. */
async function standTravellerIn(page: Page, key: string): Promise<void> {
  await page.evaluate(() => window.__game.scene.stop('menu'));
  await page.evaluate((k) => window.__game.scene.start(k), key);
  await waitForScene(page, key);
  await page.waitForFunction((k) => (window.__game.scene.getScene(k) as unknown as { today: unknown }).today !== null, key);
  await page.evaluate((k) => {
    const scene = window.__game.scene.getScene(k) as unknown as { today: unknown; redraw(): void };
    scene.today = { characters: {}, wanderers: { traveller: { scene: k, piece: 'little-steps' } } };
    scene.redraw();
  }, key);
}

const traveller = (page: Page, key: string) => page.evaluate((k) => {
  const scene = window.__game.scene.getScene(k) as unknown as { buttons: { options: { label: string }; getBounds?: unknown }[]; root: { list: { name: string; visible: boolean; y: number; scaleY: number }[] } };
  const actor = scene.root.list.find((o) => o.name === 'actor:traveller' && o.visible);
  return { pressable: scene.buttons.some((b) => b.options.label === 'Traveler'), scale: actor?.scaleY ?? null };
}, key);

test.describe('a wanderer in any scene', () => {
  test('a wanderer in a scene whose first place is far out on the sea stands on a near place, full size and pressable', async ({ page }) => {
    const errors = await openGame(page);
    await standTravellerIn(page, 'docks');
    await expect.poll(async () => (await traveller(page, 'docks')).pressable).toBe(true);
    // the docks' first place is far out on the sea, drawn at 0.4: the traveller stands on the pier at full size (1 / ART_DETAIL)
    expect((await traveller(page, 'docks')).scale).toBe(0.5);
    expectNoErrors(errors);
  });

  test('Esc while a wanderer asks closes the ask and stays in the scene; Esc again leaves', async ({ page }) => {
    const errors = await openGame(page);
    await standTravellerIn(page, 'knoll');
    expect(await press(page)).toBe(true);
    expect((await here(page)).asking).toBe(true);
    await page.keyboard.press('Escape');
    await expect.poll(async () => (await here(page)).asking).toBe(false);
    expect(await activeScenes(page)).toContain('knoll');
    await page.keyboard.press('Escape');
    await expect.poll(() => activeScenes(page)).not.toContain('knoll');
    expectNoErrors(errors);
  });

  test('the backpack opened while a line is said stays open when the line runs out', async ({ page }) => {
    const errors = await openGame(page);
    await page.evaluate(async () => {
      const { profiles } = window.__game.registry.get('context');
      const world = await profiles.worldOf(profiles.profile.id);
      if (!(await profiles.saveWorld(profiles.profile.id, { ...world, items: ['glass-bead'] }))) throw new Error('the world was not saved');
    });
    await page.evaluate(() => window.__game.scene.stop('menu'));
    await page.evaluate(() => window.__game.scene.start('knoll'));
    await waitForScene(page, 'knoll');
    await expect.poll(() => sceneButton(page, 'knoll', 'Backpack')).toBeGreaterThanOrEqual(0);
    expect(await page.evaluate(() => (window.__game.scene.getScene('knoll') as unknown as { lookAt(id: string): boolean }).lookAt('fire'))).toBe(true);
    await clickButton(page, 'knoll', await sceneButton(page, 'knoll', 'Backpack'));
    const state = () => page.evaluate(() => {
      const scene = window.__game.scene.getScene('knoll') as unknown as { menuOpen: boolean; lookingAt: string | null };
      return { open: scene.menuOpen, looking: scene.lookingAt };
    });
    expect(await state()).toEqual({ open: true, looking: 'fire' });
    await expect.poll(async () => (await state()).looking, { timeout: 20000 }).toBeNull();
    expect((await state()).open).toBe(true);
    expectNoErrors(errors);
  });
});
