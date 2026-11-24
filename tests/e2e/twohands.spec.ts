// Covers ft_0_15.AC1, ft_0_15.AC2, ft_0_15.AC5.
import { expect, test } from './fixtures';
import { expectNoErrors, openGame, openPiece, playStepsWithKeys, playStepsWithVirtualPiano, results, sceneTexts, showMenuPageWith, toScoreScreen, useOneLine } from './helpers';
import { TARGET_VIEW } from './targetView';

/** Level-4 and level-5 pieces are open to every player: levels lock no piece (ft_1_13.AC3). */
const OPEN = '?device=virtual';

/**
 * Both Hands: RH C2 E2 | G4 | F2 D2 | C4 | E2 G2 | G2 E2 | F E D C | C4 over LH C,4 | E,2 G,2 | G,4 | C,4 | C,2 G,2 | E,2 C,2 | G,4 | C,4.
 * Each inner array is what the student plays at one moment: [RH + LH] or one hand alone.
 */
const BOTH_HANDS: number[][] = [
  [60, 48], [64], [67, 52], [55], [65, 55], [62], [60, 48],
  [64, 48], [67, 55], [67, 52], [64, 48],
  [65, 55], [64], [62], [60],
  [60, 48],
];
const BOTH_HANDS_NOTES = 26;
const BOTH_HANDS_TWO_HAND_NOTES = 20;

/** Take Turns: RH C D E F | G2 E2 | F E D C | rest x3, then the left hand answers an octave down. */
const TAKE_TURNS: number[][] = [
  [60], [62], [64], [65], [67], [64], [65], [64], [62], [60],
  [48], [50], [52], [53], [55], [52], [53], [52], [50], [48],
];

const practice = (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    const scene = window.__game.scene.getScene('practice');
    const state = scene.playSession.controller.getState();
    const layout = scene.playSession.staffView.layout;
    return {
      awaiting: state.awaiting as number[],
      awaitingMidi: (state.awaiting as number[]).map((i) => scene.chart.notes[i].midi as number).sort((a: number, b: number) => a - b),
      stepIndex: state.stepIndex as number,
      staves: layout.systems[0].staves.length as number,
      braces: layout.braces.length as number,
      systems: layout.systems.length as number,
      fits: layout.fits as boolean,
      staffSpace: layout.staffSpace as number,
      pageCount: layout.pageCount as number,
      lit: [...scene.playSession.staffView.cursors] as number[],
      wrong: [...scene.playSession.staffView.wrong] as number[],
    };
  });

test.describe('two hands on a grand staff', () => {
  test('both staves are drawn with a brace, and the cursor lights one note per hand', async ({ page }) => {
    const errors = await openGame(page, OPEN);
    await openPiece(page, 'Both Hands');
    const state = await practice(page);
    expect(state).toMatchObject({ staves: 2, fits: true });
    expect(state.braces).toBe(state.systems); // one brace for each system
    expect(state.awaitingMidi).toEqual([48, 60]);
    expect([...state.lit].sort()).toEqual([...state.awaiting].sort());
    expectNoErrors(errors);
  });

  test('hands together: the whole piece is played and earns the two-hands bonus', async ({ page }) => {
    const errors = await openGame(page, OPEN);
    await openPiece(page, 'Both Hands');
    await playStepsWithVirtualPiano(page, BOTH_HANDS);
    await toScoreScreen(page);
    const result = await results(page);
    expect(result).toMatchObject({ accuracy: 1, mistakes: 0, notes: BOTH_HANDS_NOTES });
    expect(await page.evaluate(() => window.__game.scene.getScene('results').result.bothHands)).toEqual({ notes: BOTH_HANDS_TWO_HAND_NOTES, together: BOTH_HANDS_TWO_HAND_NOTES });
    const multiplier = await page.evaluate(() => window.__game.scene.getScene('results').outcome?.events.find((e: { type: string }) => e.type === 'XpAwarded')?.xp.bothHandsMultiplier);
    expect(multiplier).toBeCloseTo(1.38, 2);
    expectNoErrors(errors);
  });

  test('a wrong key flashes both awaited notes, shows the key played, does not stop the piece and costs the bonus for that step', async ({ page }) => {
    const errors = await openGame(page, OPEN);
    await openPiece(page, 'Both Hands');
    await playStepsWithVirtualPiano(page, [[61]]); // C#4, next to the awaited C4
    await expect.poll(async () => (await practice(page)).wrong.length).toBe(2);
    expect((await practice(page)).stepIndex).toBe(0);
    expect(await page.evaluate(() => window.__game.scene.getScene('practice').playSession.staffView?.playedShown ?? null)).toMatch(/^C/); // ft_1_12.AC7: what was played, no sentence
    await playStepsWithVirtualPiano(page, BOTH_HANDS);
    await toScoreScreen(page);
    expect(await results(page)).toMatchObject({ mistakes: 1 });
    expect(await page.evaluate(() => window.__game.scene.getScene('results').result.bothHands)).toEqual({ notes: BOTH_HANDS_TWO_HAND_NOTES, together: BOTH_HANDS_TWO_HAND_NOTES - 2 });
    expectNoErrors(errors);
  });

  test('with the computer keyboard one octave down, pressing the pair of keys plays a two-hand step', async ({ page }) => {
    const errors = await openGame(page, '');
    await openPiece(page, 'Both Hands');
    await playStepsWithKeys(page, BOTH_HANDS);
    await toScoreScreen(page);
    expect(await results(page)).toMatchObject({ accuracy: 1, mistakes: 0 });
    expectNoErrors(errors);
  });

  test('on the on-screen keyboard two fingers at once (two pointers) play a two-hand step', async ({ page }) => {
    const errors = await openGame(page, '?keys=1');
    await openPiece(page, 'Both Hands');
    await page.evaluate(() => {
      const press = (id: number, midi: number) =>
        document.querySelector(`[data-testid="on-screen-keyboard"] [data-midi="${midi}"]`)!.dispatchEvent(new PointerEvent('pointerdown', { pointerId: id, bubbles: true }));
      press(1, 60);
      press(2, 48);
    });
    await expect.poll(async () => (await practice(page)).stepIndex).toBe(1);
    expectNoErrors(errors);
  });

  test('hands taking turns: whole-bar rests on the resting hand, and the piece plays to the end with no bonus', async ({ page }) => {
    const errors = await openGame(page, OPEN);
    await useOneLine(page);
    await openPiece(page, 'Take Turns');
    const turns = await practice(page);
    expect(turns).toMatchObject({ staves: 2, fits: true, awaitingMidi: [60] });
    expect(turns.braces).toBe(turns.systems); // six bars, one line at a time: a brace on every line
    expect(turns.pageCount).toBe(turns.systems);
    await playStepsWithVirtualPiano(page, TAKE_TURNS);
    await toScoreScreen(page);
    expect(await results(page)).toMatchObject({ accuracy: 1, mistakes: 0, notes: 20 });
    expect(await page.evaluate(() => window.__game.scene.getScene('results').result.bothHands)).toEqual({ notes: 0, together: 0 });
    expect((await sceneTexts(page, 'results')).some((t) => t.includes('Both hands together'))).toBe(false);
    expectNoErrors(errors);
  });

  test('ft_1_13.AC3: the two-hand pieces are open at level 1: levels lock no piece', async ({ page }) => {
    const errors = await openGame(page);
    for (const title of ['Take Turns', 'Both Hands']) {
      const index = await showMenuPageWith(page, title);
      expect(await page.evaluate((i) => window.__game.scene.getScene('menu').buttons[i].disabled, index), `${title} is open`).toBe(false);
    }
    expectNoErrors(errors);
  });
});

// the 1920x1080 full screen at Windows 125% scaling (d105)
test.describe('grand staff on the laptop full screen', () => {
  test('fits without overlap and the notes are large enough to read', async ({ page }) => {
    const errors = await openGame(page, OPEN);
    await useOneLine(page);
    await openPiece(page, 'Both Hands');
    const state = await practice(page);
    expect(state.fits).toBe(true);
    // One line at a time; in canvas pixels, which under display scaling are screen pixels: the notes stay as big as at 100%
    expect(state.staffSpace).toBeGreaterThanOrEqual(20 * TARGET_VIEW.deviceScaleFactor);
    expectNoErrors(errors);
  });
});
