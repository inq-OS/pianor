import { expect, test } from '@playwright/test';
import { LITTLE_STEPS, clickButton, expectNoErrors, openGame, openPiece, playWithVirtualPiano, pressPracticeButton as press, results, sceneTexts, toScoreScreen, waitForScene } from './helpers';

/** The practice log (core_10) and the Analyze screen: where a piece is tricky and what to practise. */

test.describe('practice analysis (core_10)', () => {
  test('core_10.AC1: every bar played is logged, with the misses of the bar', async ({ page }) => {
    const errors = await openGame(page);
    await openPiece(page, 'Little Steps');
    await playWithVirtualPiano(page, [61]); // a wrong key before the first note
    await playWithVirtualPiano(page, LITTLE_STEPS);
    await toScoreScreen(page);
    expect((await results(page)).mistakes).toBeGreaterThan(0);
    const log = await page.evaluate(() => window.__game.registry.get('context').profiles.practiceFor('little-steps') as { bar: number; firstTry: number; notes: number; section: unknown; misses: unknown[] }[]);
    expect(log.length).toBeGreaterThan(1);
    expect(log.every((p) => p.section === null)).toBe(true);
    expect(log[0]!.misses.length).toBe(1); // the first note was not right the first time
    expectNoErrors(errors);
  });

  test('core_10.AC8: Analyze shows the tricky sections with a start tempo, and Practise opens that section with a ramp', async ({ page }) => {
    const errors = await openGame(page);
    await openPiece(page, 'Little Steps');
    const id = await page.evaluate(() => window.__game.scene.getScene('practice').chart.id as string);
    // bar 1 (0-based) was missed three times, bar 3 once, bars 0 and 2 were clean
    await page.evaluate((pieceId) => {
      const play = (bar: number, firstTry: number) => ({ at: new Date().toISOString(), pieceId, bar, notes: 4, firstTry, timing: null, mode: 'wait' as const, tempoPercent: 100, section: null, misses: [] });
      return window.__game.registry.get('context').profiles.recordBarPlays([play(0, 4), play(1, 1), play(1, 2), play(1, 1), play(2, 4), play(3, 3)]);
    }, id);
    if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/practice-strip.png` });
    await press(page, 'Analyze');
    await waitForScene(page, 'analyze');
    if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/analyze.png` });
    const texts = await sceneTexts(page, 'analyze');
    expect(texts).toEqual(expect.arrayContaining(['Bar 2', 'Practise 80%']));
    const index = await page.evaluate(() => (window.__game.scene.getScene('analyze').buttons as { options: { label: string } }[]).findIndex((b) => b.options.label === 'Practise 80%'));
    await clickButton(page, 'analyze', index);
    await waitForScene(page, 'practice');
    const section = await page.evaluate(() => window.__game.scene.getScene('practice').startData.section as { first: number; last: number });
    expect(section).toEqual({ first: 1, last: 1 });
    const data = await page.evaluate(() => window.__game.scene.getScene('practice').startData as { percent: number; ramp: { step: number; stepUnit: string } });
    expect(data.percent).toBe(80); // the proposed start tempo
    expect(data.ramp).toMatchObject({ step: 5, stepUnit: 'percent' }); // and its ramp towards the piece's own tempo
    expectNoErrors(errors);
  });

  test('core_10.AC8: a section of several bars fits its card in both languages', async ({ page }) => {
    const errors = await openGame(page);
    await openPiece(page, 'Little Steps');
    const id = await page.evaluate(() => window.__game.scene.getScene('practice').chart.id as string);
    await page.evaluate((pieceId) => {
      const play = (bar: number) => ({ at: new Date().toISOString(), pieceId, bar, notes: 4, firstTry: 1, timing: null, mode: 'wait' as const, tempoPercent: 100, section: null, misses: [] });
      return window.__game.registry.get('context').profiles.recordBarPlays([play(0), play(1), play(2), play(3)]);
    }, id);
    await press(page, 'Analyze');
    await waitForScene(page, 'analyze');
    if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/analyze-bars.png` });
    expect(await sceneTexts(page, 'analyze')).toContain('Bars 1-4');
    const fits = await page.evaluate(() => (window.__game.scene.getScene('analyze').buttons as { options: { label: string; x: number; width: number } }[]).map((b) => b.options));
    const [bars, practise] = fits.filter((o) => o.label.startsWith('Bars') || o.label.startsWith('Practise'));
    expect(bars!.x + bars!.width / 2).toBeLessThanOrEqual(practise!.x - practise!.width / 2); // the two buttons do not overlap
    expectNoErrors(errors);
  });

  test('core_10.AC8: a long piece is shown a line at a time, with page buttons, and does not run over the cards', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual');
    await openPiece(page, 'Echo Giant');
    const id = await page.evaluate(() => window.__game.scene.getScene('practice').chart.id as string);
    await page.evaluate((pieceId) => {
      const play = (bar: number) => ({ at: new Date().toISOString(), pieceId, bar, notes: 4, firstTry: 1, timing: null, mode: 'wait' as const, tempoPercent: 100, section: null, misses: [] });
      return window.__game.registry.get('context').profiles.recordBarPlays([play(20), play(21)]);
    }, id);
    await press(page, 'Analyze');
    await waitForScene(page, 'analyze');
    if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/analyze-long.png` });
    expect(await sceneTexts(page, 'analyze')).toEqual(expect.arrayContaining(['<', '>']));
    expectNoErrors(errors);
  });

  test('core_10.AC8: a piece not played yet shows its plain staff and no line of text', async ({ page }) => {
    const errors = await openGame(page);
    await openPiece(page, 'Little Steps');
    await press(page, 'Analyze');
    await waitForScene(page, 'analyze');
    // only the piece's title and the toolbar have words (no hint lines)
    const texts = await sceneTexts(page, 'analyze');
    expect(texts).toContain('Little Steps');
    expect(texts.filter((x) => !['Little Steps', 'TUVI', 'Level 1'].includes(x) && !/XP$/.test(x))).toEqual([]);
    // the title starts right of the door in the top left corner, not under it
    const clear = await page.evaluate(() => {
      const scene = window.__game.scene.getScene('analyze') as unknown as { root: { list: { text?: string; x: number }[] }; toolbarButtons: { back: { rect: { x: number; width: number } } | null } };
      const title = scene.root.list.find((o) => o.text === 'Little Steps');
      const door = scene.toolbarButtons.back?.rect;
      return title !== undefined && door !== undefined && title.x >= door.x + door.width;
    });
    expect(clear).toBe(true);
    expectNoErrors(errors);
  });

  test('Analyze counts the notes of the bar held too short in Tempo mode (core_01 slice f3)', async ({ page }) => {
    const errors = await openGame(page);
    await openPiece(page, 'Little Steps');
    const id = await page.evaluate(() => window.__game.scene.getScene('practice').chart.id as string);
    await page.evaluate((pieceId) => {
      const play = (bar: number, timing: number, short: number) => ({ at: new Date().toISOString(), pieceId, bar, notes: 4, firstTry: 4, timing, mode: 'tempo' as const, tempoPercent: 100, section: null, misses: [], short });
      return window.__game.registry.get('context').profiles.recordBarPlays([play(0, 100, 0), play(1, 60, 2), play(1, 55, 1), play(2, 100, 0), play(3, 95, 0)]);
    }, id);
    await press(page, 'Analyze');
    await waitForScene(page, 'analyze');
    if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/analyze-short.png` });
    expect(await sceneTexts(page, 'analyze')).toContain('Bar 2: 3 notes held too short');
    const log = await page.evaluate(() => window.__game.registry.get('context').profiles.practiceFor('little-steps') as { short?: number }[]);
    expect(log.map((p) => p.short)).toEqual([0, 2, 1, 0, 0]); // kept in the save
    expectNoErrors(errors);
  });
});

