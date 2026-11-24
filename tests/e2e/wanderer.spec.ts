import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { LITTLE_STEPS, clickButton, expectNoErrors, letGameRun, openGame, playWithVirtualPiano, waitForScene } from './helpers';

type Here = { ids: string[]; saying: string | null };
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
    expect((await here(page)).saying).toBe("Would you play me Little Steps? Press me again and I'll listen.");
    await page.screenshot({ path: 'test-results/wanderer-asks.png' });
    await press(page);
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
