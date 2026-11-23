// Covers ft_1_32.AC4, ft_1_32.AC5, ft_1_32.AC6, ft_1_32.AC11, ft_1_32.AC12, ft_1_32.AC13, ft_1_32.AC14.
import { expect, test, type Page } from '@playwright/test';
import { clickButton, expectNoErrors, letGameRun, openGame, openPiece, playWithKeys, sceneButton, showMenuPageWith, waitForScene } from './helpers';

/** The bars the practice screen shows now (0-based, of the whole piece), and the notes to play in them in order. */
async function shown(page: Page): Promise<{ bars: number; first: number; midis: number[] }> {
  return page.evaluate(() => {
    const scene = window.__game.scene.getScene('practice') as unknown as {
      chart: { bars: unknown[]; notes: { tick: number; midi: number; track: string }[]; tracks: { id: string; role: string }[] };
      learn: { run: { firstBar: number } } | null;
    };
    const play = new Set(scene.chart.tracks.filter((t) => t.role === 'play').map((t) => t.id));
    const midis = scene.chart.notes.filter((n) => play.has(n.track)).sort((a, b) => a.tick - b.tick).map((n) => n.midi);
    return { bars: scene.chart.bars.length, first: scene.learn?.run.firstBar ?? -1, midis };
  });
}

const progress = (page: Page) => page.evaluate(() => window.__game.registry.get('context').profiles.learnProgressOf('little-steps') as { step: number; misses: number; unsteady?: number });
const kiurSays = (page: Page) => page.evaluate(() => (window.__game.scene.getScene('practice') as unknown as { startMessage: string }).startMessage);

/** From the piece book to the room: Kiur on the bed pressed, and his question open. */
async function askKiur(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.__game.scene.stop('menu');
    window.__game.scene.start('profile');
  });
  await waitForScene(page, 'profile');
  await expect.poll(() => sceneButton(page, 'profile', 'Kiur')).toBeGreaterThanOrEqual(0);
  await clickButton(page, 'profile', await sceneButton(page, 'profile', 'Kiur'));
  await expect.poll(() => sceneButton(page, 'profile', 'Learn')).toBeGreaterThanOrEqual(0);
}

/** A piece opened to be learned bar by bar: Kiur pressed in the room, Learn, and the piece picked in the book (ft_1_32 rule 14). */
async function learnPiece(page: Page, title: string): Promise<void> {
  await askKiur(page);
  await clickButton(page, 'profile', await sceneButton(page, 'profile', 'Learn'));
  await waitForScene(page, 'menu');
  await openPiece(page, title);
}

const kiurInRoom = (page: Page) => page.evaluate(() => (window.__game.scene.getScene('profile') as unknown as { talkState: { text: string } | null }).talkState?.text ?? null);

test('ft_1_32.AC13 the piano is a sandbox: a piece picked there plays in full with no learning', async ({ page }) => {
  const errors = await openGame(page, '?device=virtual&learn=1');
  await openPiece(page, 'Little Steps');
  const whole = await page.evaluate(() => (window.__game.registry.get('context').pieces.find('little-steps').chart.bars as unknown[]).length);
  expect(await shown(page)).toMatchObject({ bars: whole, first: -1 });
  expectNoErrors(errors);
});

test('ft_1_32.AC14 Kiur tugs a song only once it is learned: before that he says to learn it with him', async ({ page }) => {
  const errors = await openGame(page, '?device=virtual&learn=1');
  await askKiur(page);
  await clickButton(page, 'profile', await sceneButton(page, 'profile', 'Tug'));
  await waitForScene(page, 'menu');
  await clickButton(page, 'menu', await showMenuPageWith(page, 'Little Steps'));
  await waitForScene(page, 'profile');
  await expect.poll(() => kiurInRoom(page)).toBe('We tug Little Steps once you have learned it. Press me and pick Learn.');
  expect(await page.evaluate(() => (window.__game.scene.getScene('profile') as unknown as { tug: unknown }).tug)).toBeNull();
  expectNoErrors(errors);
});

test('a new piece is learned bar by bar: one bar shown, a wrong key repeats it, a perfect run adds the next bar', async ({ page }) => {
  const errors = await openGame(page, '?device=virtual&learn=1');
  await learnPiece(page, 'Little Steps');
  const first = await shown(page);
  expect(first).toMatchObject({ bars: 1, first: 0 });
  expect(await kiurSays(page)).toBe('Bar 1: every note right');

  // a wrong key ends the run at once: Kiur names it, the same bar starts again, and progress keeps its miss
  const wrong = first.midis[0]! + 1;
  await playWithKeys(page, [wrong]);
  await expect.poll(() => kiurSays(page), { timeout: 10_000 }).toMatch(/in bar 1\. Again from the start$/);
  expect(await shown(page)).toMatchObject({ bars: 1, first: 0 });
  expect(await progress(page)).toMatchObject({ step: 0, misses: 1 });

  // the same mistake again: the note it was for gets a mistake marker (ft_1_32.AC5, at the 2nd miss by default)
  await playWithKeys(page, [wrong]);
  await expect.poll(() => progress(page), { timeout: 10_000 }).toMatchObject({ misses: 2 });
  await expect.poll(() => page.evaluate(() => (window.__game.scene.getScene('practice') as unknown as { playSession: { staffView: { markersShown: number } } }).playSession.staffView.markersShown), { timeout: 10_000 }).toBeGreaterThanOrEqual(1);

  // every note right: the next step shows bars 1 and 2, and the first bar's note is earned
  await playWithKeys(page, first.midis);
  await expect.poll(async () => (await shown(page)).bars, { timeout: 10_000 }).toBe(2);
  expect(await progress(page)).toMatchObject({ step: 1, misses: 0 });
  expect(await kiurSays(page)).toBe('Every note right! Now bars 1 to 2');
  const rewards = await page.evaluate(() => (window.__game.scene.getScene('practice') as unknown as { rewardsData: { chunks: { quarters: string[] }[] } }).rewardsData);
  expect(rewards.chunks[0]!.quarters).toEqual(['silver']); // two runs that did not count
  await letGameRun(page, 5);
  expectNoErrors(errors);
});

test('the learning is kept: the piece opens again on the step the player reached', async ({ page }) => {
  const errors = await openGame(page, '?device=virtual&learn=1');
  await learnPiece(page, 'Little Steps');
  await playWithKeys(page, (await shown(page)).midis);
  await expect.poll(async () => (await shown(page)).bars, { timeout: 10_000 }).toBe(2);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.__game.scene.getScenes(true).map((s) => s.scene.key)), { timeout: 10_000 }).toContain('menu');
  await learnPiece(page, 'Little Steps');
  expect(await shown(page)).toMatchObject({ bars: 2, first: 0 });
  expectNoErrors(errors);
});

test('ft_1_32.AC11 a run that speeds up beyond the baseline tempo is stopped and asked again', async ({ page }) => {
  const errors = await openGame(page, '?device=virtual&learn=1');
  // a piece begun earlier, whose confirmation play measured a slow 40 BPM
  await page.evaluate(() => window.__game.registry.get('context').profiles.saveLearnProgress('little-steps', {
    step: 0, wholeStreak: 0, recall: false, confirm: false, misses: 0, medals: [], lastDay: '1998-11-21', bpm: [40], stepBars: 1,
  }));
  await learnPiece(page, 'Little Steps');
  // the keys pressed one right after the other: far faster than 40 BPM
  await playWithKeys(page, (await shown(page)).midis);
  await expect.poll(() => kiurSays(page), { timeout: 10_000 }).toBe('Too fast: keep the speed you started with. Once more');
  expect(await shown(page)).toMatchObject({ bars: 1, first: 0 });
  expect(await progress(page)).toMatchObject({ step: 0, misses: 0, unsteady: 1 }); // nothing lost, asked again
  expectNoErrors(errors);
});

test('ft_1_32.AC12 a two-hand piece is learned hands apart: one staff for the right hand first', async ({ page }) => {
  const errors = await openGame(page, '?device=virtual&learn=1');
  await learnPiece(page, 'Both Hands');
  expect(await kiurSays(page)).toBe('Bar 1, right hand alone: every note right');
  const staves = await page.evaluate(() => (window.__game.scene.getScene('practice') as unknown as { chart: { tracks: { role: string; hand: string | null }[] } })
    .chart.tracks.filter((t) => t.role === 'play').map((t) => t.hand));
  expect(staves).toEqual(['RH']);
  await playWithKeys(page, (await shown(page)).midis);
  await expect.poll(() => kiurSays(page), { timeout: 10_000 }).toBe('Every note right! Bar 1, left hand alone: every note right');
  expectNoErrors(errors);
});
