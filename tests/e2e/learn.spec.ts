// Covers ft_1_32.AC4, ft_1_32.AC5, ft_1_32.AC6.
import { expect, test, type Page } from '@playwright/test';
import { expectNoErrors, letGameRun, openGame, openPiece, playWithKeys } from './helpers';

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

const progress = (page: Page) => page.evaluate(() => window.__game.registry.get('context').profiles.learnProgressOf('little-steps') as { step: number; misses: number });
const kiurSays = (page: Page) => page.evaluate(() => (window.__game.scene.getScene('practice') as unknown as { startMessage: string }).startMessage);

test('a new piece is learned bar by bar: one bar shown, a wrong key repeats it, a perfect run adds the next bar', async ({ page }) => {
  const errors = await openGame(page, '?device=virtual&learn=1');
  await openPiece(page, 'Little Steps');
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
  await openPiece(page, 'Little Steps');
  await playWithKeys(page, (await shown(page)).midis);
  await expect.poll(async () => (await shown(page)).bars, { timeout: 10_000 }).toBe(2);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.__game.scene.getScenes(true).map((s) => s.scene.key)), { timeout: 10_000 }).toContain('menu');
  await openPiece(page, 'Little Steps');
  expect(await shown(page)).toMatchObject({ bars: 2, first: 0 });
  expectNoErrors(errors);
});
