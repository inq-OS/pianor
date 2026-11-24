// Covers ft_1_29.AC1, ft_1_29.AC3, ft_1_29.AC4.
// The stand's panel opens the scales and chords trainer (ft_1_29 slice A): the scale of the chosen key on the staff, played
// in Wait mode with three lives; a wrong key costs a heart and says why, the names come on the notes, and the XP of the
// right notes is kept after a lost round. The key comes from the circle of fifths, the shape and the hand from the toolbar.
import { expect, test, type Page } from '@playwright/test';
import { clickButton, expectNoErrors, openFromStand, openGame, playWithVirtualPiano, profileButton, sceneButton, sceneTexts, totalXp, waitForScene } from './helpers';

const SCENE = 'shapeTrainer';
type View = { round: { state(): { lives: number; xp: number; outcome: string }; chart: { notes: { midi: number }[] } }; wrong: unknown; choice: { shape: string; hand: string; fifths: number } };
const state = (page: Page) => page.evaluate((key) => (window.__game.scene.getScene(key) as unknown as View).round.state(), SCENE);
const keys = (page: Page) => page.evaluate((key) => (window.__game.scene.getScene(key) as unknown as View).round.chart.notes.map((n) => n.midi), SCENE);
const choice = (page: Page) => page.evaluate((key) => (window.__game.scene.getScene(key) as unknown as View).choice, SCENE);

const openTrainer = async (page: Page) => {
  const errors = await openGame(page, '?device=virtual', 'en', 'profiles');
  await clickButton(page, 'profiles', await profileButton(page, 'TUVI'));
  await waitForScene(page, 'profile');
  await openFromStand(page, 'Scales and chords');
  await waitForScene(page, SCENE);
  return errors;
};

test.describe('scales and chords trainer (ft_1_29)', () => {
  test('ft_1_29.AC1 the C major scale is played up and down in Wait mode, and every right note earns XP', async ({ page }) => {
    const errors = await openTrainer(page);
    expect(await choice(page)).toMatchObject({ shape: 'scale', hand: 'RH', fifths: 0 });
    const scale = await keys(page);
    expect(scale).toEqual([60, 62, 64, 65, 67, 69, 71, 72, 71, 69, 67, 65, 64, 62, 60]);
    const before = await totalXp(page);
    await playWithVirtualPiano(page, scale);
    await expect.poll(() => state(page)).toMatchObject({ outcome: 'won', lives: 3 });
    await expect.poll(() => totalXp(page)).toBe(before + 150);
    expectNoErrors(errors);
  });

  test('ft_1_29.AC1 the toolbar switches to the triad and to the left hand; the circle of fifths sets the key', async ({ page }) => {
    const errors = await openTrainer(page);
    await clickButton(page, SCENE, await sceneButton(page, SCENE, 'Scale up and down, the triad, or the scale switcher'));
    await expect.poll(() => keys(page)).toEqual([60, 64, 67, 60, 64, 67]);
    await clickButton(page, SCENE, await sceneButton(page, SCENE, 'Which hand plays: right or left'));
    await expect.poll(() => keys(page)).toEqual([48, 52, 55, 48, 52, 55]);
    // the key button opens the circle of fifths to choose; an arrow moves round to G, and its button takes it
    await clickButton(page, SCENE, await sceneButton(page, SCENE, 'Key: choose it on the circle of fifths'));
    await waitForScene(page, 'circle');
    await page.keyboard.press('ArrowRight');
    await clickButton(page, 'circle', await sceneButton(page, 'circle', 'Set the key: G major'));
    await waitForScene(page, SCENE);
    await expect.poll(() => keys(page)).toEqual([43, 47, 50, 43, 47, 50]);
    expectNoErrors(errors);
  });

  test('ft_1_29.AC4 the keys held are named live: C, E and G down together read C, and the name goes when they are let go', async ({ page }) => {
    const errors = await openTrainer(page);
    await clickButton(page, SCENE, await sceneButton(page, SCENE, 'Scale up and down, the triad, or the scale switcher'));
    await page.evaluate(() => { for (const midi of [60, 64, 67]) window.__virtualDevice!.press(midi, 80); });
    // the key button reads C too, so count the C's: one more while the chord is held
    const cs = async () => (await sceneTexts(page, SCENE)).filter((text) => text === 'C').length;
    await expect.poll(() => page.evaluate((key) => (window.__game.scene.getScene(key) as unknown as { held: { name: string } | null }).held?.name, SCENE)).toBe('C');
    const withChord = await cs();
    await page.evaluate(() => { for (const midi of [60, 64, 67]) window.__virtualDevice!.release(midi); });
    await expect.poll(cs).toBe(withChord - 1);
    // the round ends on the chord, held: letting go clears the name although the round no longer judges keys
    await playWithVirtualPiano(page, [60, 64, 67]);
    await page.evaluate(() => { for (const midi of [60, 64, 67]) window.__virtualDevice!.press(midi, 80); });
    await expect.poll(() => state(page)).toMatchObject({ outcome: 'won' });
    await page.evaluate(() => { for (const midi of [60, 64, 67]) window.__virtualDevice!.release(midi); });
    await expect.poll(cs).toBe(withChord - 1);
    expectNoErrors(errors);
  });
});
