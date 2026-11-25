// Covers core_09.AC1, core_09.AC56.
import { expect, test } from './fixtures';
import { expectNoErrors, openGame, openPiece, playStepsWithVirtualPiano, results, toScoreScreen } from './helpers';

/** Chord Steps (level 1, right hand): two and three keys at once in the C position. */
const CHORD_STEPS: number[][] = [
  [60, 64], [62, 65], [64, 67], [62, 65], [60, 64], [60, 64, 67],
  [60], [60, 64], [62], [62, 65], [64], [64, 67], [65], [62, 65], [64, 67], [62, 65], [60, 64, 67],
];

/** Evening Chords (level 5): a tune over left-hand chords, with the half-diminished C Eb Gb Bb in bar 7. */
const EVENING_CHORDS: number[][] = [
  [64, 48, 52, 55], [67], [65, 50, 53, 57], [64], [62], [64, 48, 53, 57], [69], [67, 50, 55, 59],
  [69, 48, 53, 57], [67], [65], [64, 48, 52, 55], [62], [60], [63, 48, 51, 54, 58], [62], [60, 48, 52, 55],
];

const count = (steps: number[][]) => steps.reduce((sum, s) => sum + s.length, 0);

test.describe('chords in a piece', () => {
  for (const [title, steps] of [['Chord Steps', CHORD_STEPS], ['Evening Chords', EVENING_CHORDS]] as const) {
    test(`core_09.AC56 ${title} plays to its end in Wait mode, every key of each chord pressed together`, async ({ page }) => {
      const errors = await openGame(page, '?device=virtual');
      await openPiece(page, title);
      await playStepsWithVirtualPiano(page, steps as number[][]);
      await toScoreScreen(page);
      expect(await results(page)).toMatchObject({ accuracy: 1, mistakes: 0, notes: count(steps as number[][]) });
      expectNoErrors(errors);
    });
  }

  test('core_09.AC56 a chord waits for its last key: the cursor stays until every key is down', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual');
    await openPiece(page, 'Chord Steps');
    const step = () => page.evaluate(() => window.__game.scene.getScene('practice').playSession.controller.getState().stepIndex as number);
    await playStepsWithVirtualPiano(page, [[60]]);
    await expect.poll(step).toBe(0);
    await playStepsWithVirtualPiano(page, [[64]]);
    await expect.poll(step).toBe(1);
    expectNoErrors(errors);
  });
});
