import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { LITTLE_STEPS, activeScenes, clickButton, expectNoErrors, openGame, openPiece, pieceXp, playWithVirtualPiano, sceneTexts, totalXp, waitForScene, bandAction } from './helpers';

/** The looping play of the training piano (ft_1_12, slice 2). */

const practice = (page: Page) => ({
  lap: () => page.evaluate(() => (window.__game.scene.getScene('practice').startData.lap ?? 0) as number),
  rounds: () => page.evaluate(() => (window.__game.scene.getScene('practice').session.rounds as number[]).length),
  scoreShown: () => page.evaluate(() => (window.__game.scene.getScene('practice').playSession.passScore as unknown[]).length > 0),
});
const attempts = (page: Page) => page.evaluate(() => (window.__game.registry.get('context').profiles.profile.attempts as unknown[]).length);

test.describe('looping play (ft_1_12)', () => {
  test('ft_1_12.AC3 ft_1_12.AC4 a pass shows its score past the last bar and loops to bar 1; Escape shows one score screen', async ({ page }) => {
    test.slow();
    const errors = await openGame(page);
    await openPiece(page, 'Little Steps');
    const scene = practice(page);

    // pass 1, clean: the score shows past the last bar, the pass is saved, and the piece starts again at bar 1
    await playWithVirtualPiano(page, LITTLE_STEPS);
    await expect.poll(scene.scoreShown).toBe(true);
    expect(await activeScenes(page)).not.toContain('results');
    await expect.poll(scene.lap).toBe(1);
    expect(await attempts(page)).toBe(1);
    // the pass earns the piece XP, not the player (ft_1_13.AC2)
    expect(await pieceXp(page, 'little-steps')).toBeGreaterThan(0);
    expect(await totalXp(page)).toBe(0);
    expect(await page.evaluate(() => window.__game.scene.getScene('practice').playSession.controller.getState().stepIndex)).toBe(0);
    expect(await scene.scoreShown()).toBe(false);

    // pass 2 with one key next door (C# where D is awaited)
    await playWithVirtualPiano(page, [60, 61, ...LITTLE_STEPS.slice(1)]);
    await expect.poll(scene.lap).toBe(2);
    expect(await scene.rounds()).toBe(2);
    expect(await attempts(page)).toBe(2);

    await page.keyboard.press('Escape');
    await waitForScene(page, 'results');
    const texts = await sceneTexts(page, 'results');
    expect(texts).toEqual(expect.arrayContaining(['You played it to the end 2 times!', 'Best round: 100% right the first time', 'Wrong keys: 1']));
    // the graph, when the 124 rows under the band leave it room (TODO in ft_1_12), shows both passes
    const graph = await page.evaluate(() => (window.__game.scene.getScene('results').graph as { shown: number } | null)?.shown ?? null);
    if (graph !== null) expect(graph).toBe(2);
    expect(texts.some((line) => /^\+\d+ XP$/.test(line))).toBe(true);
    expect(await page.evaluate(() => window.__game.scene.getScene('results').summary.rounds as number)).toBe(2);

    // Play again starts the piece afresh
    await clickButton(page, 'results', await bandAction(page, 'results', 0));
    await waitForScene(page, 'practice');
    expect(await scene.lap()).toBe(0);
    expectNoErrors(errors);
  });

  test('ft_1_12.AC4 leaving before any key goes straight back to the piece list', async ({ page }) => {
    const errors = await openGame(page);
    await openPiece(page, 'Little Steps');
    await page.keyboard.press('Escape');
    await waitForScene(page, 'menu');
    expect(await activeScenes(page)).not.toContain('results');
    expectNoErrors(errors);
  });

  test('ft_1_12.AC3 a section loop that holds the last bar shows no score and saves no pass', async ({ page }) => {
    const errors = await openGame(page);
    await openPiece(page, 'Little Steps');
    await page.evaluate(() => {
      const s = window.__game.scene.getScene('practice') as unknown as { scene: { restart(d: unknown): void }; startData: object };
      s.scene.restart({ ...s.startData, section: { first: 2, last: 3 } });
    });
    await expect.poll(() => page.evaluate(() => window.__game.scene.getScene('practice').startData.section?.first as number | undefined)).toBe(2);
    await playWithVirtualPiano(page, LITTLE_STEPS.slice(6));
    await expect.poll(practice(page).lap).toBe(1);
    expect(await practice(page).scoreShown()).toBe(false);
    expect(await attempts(page)).toBe(0);
    expectNoErrors(errors);
  });

  test('ft_1_12.AC5 the stats pane takes the keyboard\'s place and gets a bar for each pass', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual&keys=1');
    await openPiece(page, 'Little Steps');
    expect(await page.evaluate(() => window.__game.registry.get('context').keyboardSwitch.shown() as boolean)).toBe(true);
    await page.evaluate(() => (window.__game.scene.getScene('practice') as unknown as { toggleStatsPane(): void }).toggleStatsPane());
    await expect.poll(() => page.evaluate(() => window.__game.registry.get('context').keyboardSwitch.shown() as boolean)).toBe(false);
    const bars = () => page.evaluate(() => (window.__game.scene.getScene('practice').paneData as { bars: unknown[] } | null)?.bars.length ?? -1);
    expect(await bars()).toBe(0);
    await playWithVirtualPiano(page, LITTLE_STEPS);
    await expect.poll(practice(page).lap).toBe(1);
    await expect.poll(bars).toBe(1);
    expectNoErrors(errors);
  });

  test('ft_1_12.AC5 every bar of the stats pane shows its play\'s wrong keys as a number', async ({ page }) => {
    test.slow();
    const errors = await openGame(page, '?device=virtual');
    await openPiece(page, 'Little Steps');
    await page.evaluate(() => (window.__game.scene.getScene('practice') as unknown as { toggleStatsPane(): void }).toggleStatsPane());
    const counts = () => page.evaluate(() => (window.__game.scene.getScene('practice').paneData as { bars: { mistakes: number }[] } | null)?.bars.map((b) => b.mistakes) ?? []);
    await playWithVirtualPiano(page, LITTLE_STEPS);
    await expect.poll(counts).toEqual([0]);
    // two wrong keys (C# and E where D is awaited)
    await playWithVirtualPiano(page, [60, 61, 64, ...LITTLE_STEPS.slice(1)]);
    await expect.poll(counts).toEqual([0, 2]);
    await expect.poll(() => sceneTexts(page, 'practice')).toEqual(expect.arrayContaining(['0', '2']));
    expectNoErrors(errors);
  });

  test('ft_1_12.AC3 after each pass Kiur says its numbers: right the first time and wrong keys', async ({ page }) => {
    test.slow();
    const errors = await openGame(page, '?device=virtual');
    await openPiece(page, 'Little Steps');
    const said = () => sceneTexts(page, 'practice');
    await playWithVirtualPiano(page, LITTLE_STEPS);
    await expect.poll(said).toContain('100% right   No wrong keys!');
    // the next pass starts and the numbers stay while it begins
    await expect.poll(practice(page).lap).toBe(1);
    expect(await said()).toContain('100% right   No wrong keys!');
    await playWithVirtualPiano(page, [60, 61, 64, ...LITTLE_STEPS.slice(1)]);
    await expect.poll(said).toContain('91% right   Wrong keys: 2');
    expectNoErrors(errors);
  });
});
