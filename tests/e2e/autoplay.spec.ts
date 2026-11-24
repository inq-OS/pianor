import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { activeScenes, expectNoErrors, letGameRun, openGame, waitForScene } from './helpers';

/**
 * The director leaves the looping piece for the score screen by itself (src/dev/autoplay/director.ts), so the test only waits
 * for it. `toScoreScreen` would press Escape as well: on a fast page that press could land on the score screen just opened and
 * leave it for the piece list, and neither the director nor the test ever saw the results.
 */
const directorScoreScreen = (page: Page) => waitForScene(page, 'results');

/**
 * ft_Y_09: the dev-only autoplay plays a scenario from the menu to the results by itself. These tests press nothing: no key, no click.
 * They only open the address and watch.
 */

interface Status {
  scenario: string;
  phase: string;
  run: number;
  pieceId: string | null;
  last: { accuracy: number; mistakes: number; timingScore: number | null; missed: number | null } | null;
  error: string | null;
  log: string[];
}
const autoplayStatus = (page: Page) => page.evaluate(() => (window as unknown as { __autoplay: { status: Status } }).__autoplay.status);
const resultOf = (page: Page) => page.evaluate(() => window.__game.scene.getScene('results').result);
const savedKeys = (page: Page) => page.evaluate(() => Object.keys(window.localStorage));

test.describe('autoplay (ft_Y_09, dev only)', () => {
  test('ft_Y_09.AC1 ft_Y_09.AC4 clean-wait plays a piece from the menu to the results with no key press, and saves nothing @smoke', async ({ page }) => {
    const errors = await openGame(page, '?autoplay=1&scenario=clean-wait&speed=4');
    await directorScoreScreen(page);
    expect(await resultOf(page)).toMatchObject({ chartId: 'little-steps', notes: 11, accuracy: 1, mistakes: 0 });
    await expect.poll(async () => (await autoplayStatus(page)).phase).toBe('finished');
    expect(await autoplayStatus(page)).toMatchObject({ scenario: 'clean-wait', run: 1, pieceId: 'little-steps', error: null, last: { accuracy: 1 } });
    // an in-memory player: the real saves are never read or written
    expect((await savedKeys(page)).filter((k) => k.startsWith('pianor'))).toEqual([]);
    expectNoErrors(errors);
  });

  test('ft_1_26.AC2 the teacher scenario practises a curriculum piece three times, then opens her screen with its measured level', async ({ page }) => {
    test.slow(); // three runs of the piece, then the teacher's screen
    const errors = await openGame(page, '?autoplay=1&scenario=teacher&speed=4');
    await page.waitForFunction(() => '__autoplay' in window);
    await expect.poll(async () => (await autoplayStatus(page)).phase, { timeout: 120_000 }).toBe('finished');
    expect(await autoplayStatus(page)).toMatchObject({ scenario: 'teacher', run: 3, error: null });
    await waitForScene(page, 'teacher');
    const statuses = await page.evaluate(() => (window.__game.scene.getScene('teacher') as unknown as { statuses: { piece: string; plays: number; level: number | null }[] }).statuses);
    // three clean plays in Wait mode: a level of 100 against an expected 92 (base 85 + priority 7)
    expect(statuses).toEqual([expect.objectContaining({ piece: 'au-clair-de-la-lune', plays: 3, level: 100, expected: 92 })]);
    expectNoErrors(errors);
  });

  test('ft_Y_09.AC5 clean-tempo plays on the game clock: every note is on time and the timing result is real', async ({ page }) => {
    test.slow(); // a bar counted in, then the whole piece at its own speed
    const errors = await openGame(page, '?autoplay=1&scenario=clean-tempo');
    await directorScoreScreen(page);
    const result = await resultOf(page);
    expect(result).toMatchObject({ notes: 11, accuracy: 1, timing: { played: 11, missed: 0 } });
    expect(result.timing.score).toBeGreaterThan(90);
    expect(await page.evaluate(() => window.__game.registry.get('context').profiles.playSettings.mode)).toBe('tempo');
    expectNoErrors(errors);
  });

  test('ft_Y_09.AC3 ft_Y_09.AC5 messy-tempo makes its planned mistakes: wrong keys, a missed note and mistimed notes', async ({ page }) => {
    test.slow();
    const errors = await openGame(page, '?autoplay=1&scenario=messy-tempo');
    await expect.poll(async () => (await activeScenes(page)).includes('practice'), { timeout: 30_000 }).toBe(true);
    // the staff of the scored piece, a moment before the results (the colours are on the notes once played)
    await expect.poll(() => page.evaluate(() => window.__game.scene.getScene('practice').transport?.started ?? false)).toBe(true);
    await directorScoreScreen(page);
    const result = await resultOf(page);
    expect(result.mistakes).toBe(3);
    expect(result.accuracy).toBeLessThan(1);
    expect(result.timing).toMatchObject({ missed: 1, played: 10 });
    expect(result.timing.early + result.timing.late).toBeGreaterThan(0);
    expect(result.timing.score).toBeLessThan(100);
    expectNoErrors(errors);
  });

  test('ft_Y_09.AC3 the same seed gives the same run', async ({ browser }) => {
    test.slow();
    const run = async () => {
      const page = await browser.newPage();
      const errors = await openGame(page, '?autoplay=1&scenario=messy-tempo');
      await directorScoreScreen(page);
      const result = await resultOf(page);
      expectNoErrors(errors);
      await page.close();
      return result;
    };
    const [a, b] = [await run(), await run()];
    // the plan is exact (unit-tested); the live clock adds a few ms of noise, so the verdicts agree and the numbers are close
    expect(a.timing).toMatchObject({ missed: 1 });
    for (const key of ['played', 'onTime', 'early', 'late', 'missed']) expect(a.timing[key], key).toBe(b.timing[key]);
    expect(Math.abs(a.timing.score - b.timing.score)).toBeLessThan(3);
    expect(Math.abs(a.timing.meanAbsErrorMs - b.timing.meanAbsErrorMs)).toBeLessThan(10);
    expect(a.mistakes).toBe(b.mistakes);
  });

  test('ft_Y_09.AC1 without ?autoplay=1 nothing plays by itself', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual&scenario=clean-wait');
    await letGameRun(page, 90, 1500); // frames as well as time: a slow machine would start a scenario late
    expect(await activeScenes(page)).toEqual(['menu']);
    expect(await page.evaluate(() => '__autoplay' in window)).toBe(false);
    expectNoErrors(errors);
  });
  test('ft_Y_09.AC6 a looping scenario goes back to the menu and plays the next piece', async ({ page }) => {
    test.slow();
    const errors = await openGame(page, '?autoplay=1&scenario=tour&speed=6');
    await page.waitForFunction(() => '__autoplay' in window);
    await expect.poll(async () => (await autoplayStatus(page)).run, { timeout: 60_000 }).toBeGreaterThanOrEqual(2);
    const status = await autoplayStatus(page);
    expect(status.error).toBeNull();
    expect(status.last).toMatchObject({ accuracy: 1 }); // the first piece was played cleanly to its results
    expectNoErrors(errors);
  });

  test('ft_1_21.AC10 the challenge scenario practises Puuvaim\'s phrase, meets him on the knoll and wins his tug with the virtual player (WP-13)', async ({ page }) => {
    test.slow(); // three runs in the room, then six phrases of the tug, his at his own tempo
    const errors = await openGame(page, '?autoplay=1&scenario=challenge&speed=4');
    await page.waitForFunction(() => '__autoplay' in window);
    await expect.poll(async () => (await autoplayStatus(page)).phase, { timeout: 150_000 }).toBe('finished');
    expect(await autoplayStatus(page)).toMatchObject({ scenario: 'challenge', run: 1, error: null });
    expect((await autoplayStatus(page)).log.some((line) => line.startsWith('The tug is won'))).toBe(true);
    const items = await page.evaluate(async () => {
      const { profiles } = window.__game.registry.get('context');
      return ((await profiles.worldOf(profiles.profile.id)) as { items: string[] }).items;
    });
    expect(items).toEqual(['oak-leaf']);
    expect(await activeScenes(page)).toContain('knoll');
    expectNoErrors(errors);
  });

  test('ft_1_27.AC2 the week scenario practises the piece, then the teacher comes into the room on its deadline, hears it once and gives her verdict (WP-15)', async ({ page }) => {
    test.slow(); // two runs, then the room's talk and the check-up's play
    const errors = await openGame(page, '?autoplay=1&scenario=week&speed=4');
    await page.waitForFunction(() => '__autoplay' in window);
    await expect.poll(async () => (await autoplayStatus(page)).phase, { timeout: 120_000 }).toBe('finished');
    const status = await autoplayStatus(page);
    expect(status).toMatchObject({ scenario: 'week', run: 3, error: null });
    expect(status.log).toContain('teacher: The deadline is today. Play this for me: Little Steps.');
    // a clean play reaches the expected level, whatever it is on the day the demo runs
    expect(status.log.find((line) => line.startsWith('The check-up:'))).toMatch(/^The check-up: teacher: Score 100, I expected \d+\. teacher: The piece is learned\.$/);
    const visits = await page.evaluate(async () => {
      const { profiles } = window.__game.registry.get('context');
      return ((await profiles.worldOf(profiles.profile.id)) as { teacherVisits: unknown[] }).teacherVisits;
    });
    expect(visits).toEqual([{ day: expect.any(String), piece: 'little-steps', result: 'passed' }]);
    expect(await activeScenes(page)).toContain('profile');
    expectNoErrors(errors);
  });

  test('ft_1_24.AC6 the boat-arrives scenario runs the boat\'s script in the docks to its end (WP-07)', async ({ page }) => {
    test.slow(); // the boat sails in, Kiur speaks, the tune plays to its end
    const errors = await openGame(page, '?autoplay=1&scenario=boat-arrives');
    await page.waitForFunction(() => '__autoplay' in window);
    await expect.poll(async () => (await autoplayStatus(page)).phase, { timeout: 60000 }).toBe('finished');
    expect(await autoplayStatus(page)).toMatchObject({ scenario: 'boat-arrives', run: 1, error: null });
    expect(await activeScenes(page)).toContain('docks');
    expectNoErrors(errors);
  });
});
