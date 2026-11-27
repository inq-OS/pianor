// Covers ft_1_29.AC2.
// The stand's panel opens chord from its name (ft_1_29 slice B): the chord's name stands large, the student plays it in any
// inversion and octave with all its notes held together, and a key outside the chord costs a heart and is named.
import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { clickButton, expectNoErrors, openFromStand, openGame, profileButton, sceneButton, sceneTexts, totalXp, waitForScene } from './helpers';

const SCENE = 'chordTrainer';
type View = { round: { target(): { name: string; pitchClasses: number[] }; state(): { lives: number; xp: number; solved: number; over: boolean } } };
const target = (page: Page) => page.evaluate((key) => (window.__game.scene.getScene(key) as unknown as View).round.target(), SCENE);
const state = (page: Page) => page.evaluate((key) => (window.__game.scene.getScene(key) as unknown as View).round.state(), SCENE);
/** Keys down together on the virtual EZ-220, then all let go. */
const holdTogether = (page: Page, keys: number[]) => page.evaluate((notes) => {
  for (const midi of notes) window.__virtualDevice!.press(midi, 80);
  for (const midi of notes) window.__virtualDevice!.release(midi);
}, keys);

const openTrainer = async (page: Page) => {
  const errors = await openGame(page, '?device=virtual', 'en', 'profiles');
  await clickButton(page, 'profiles', await profileButton(page, 'TUVI'));
  await waitForScene(page, 'profile');
  await openFromStand(page, 'Chord from its name');
  await waitForScene(page, SCENE);
  return errors;
};

test.describe('chord from its name (ft_1_29)', () => {
  test('ft_1_29.AC2 the chord shown large, played in an inversion, counts and earns XP; a note outside it costs a heart and is named', async ({ page }) => {
    const errors = await openTrainer(page);
    const first = await target(page);
    expect(await sceneTexts(page, SCENE)).toContain(first.name);
    const before = await totalXp(page);
    // the first inversion an octave up: the third at the bottom
    const [root, ...rest] = first.pitchClasses;
    await holdTogether(page, [...rest.map((pc) => 60 + pc), 72 + root!]);
    await expect.poll(() => state(page)).toMatchObject({ solved: 1, lives: 3 });
    await expect.poll(() => totalXp(page)).toBe(before + 30);
    const second = await target(page);
    const outside = [61, 63, 66, 68, 70].find((k) => !second.pitchClasses.includes(k % 12))!;
    await holdTogether(page, [outside]);
    await expect.poll(() => state(page)).toMatchObject({ lives: 2, solved: 1 });
    expect((await sceneTexts(page, SCENE)).some((text) => text.endsWith(`is not in ${second.name}`))).toBe(true);
    // two more wrong keys end the round: one line says how many chords were played and the XP
    await holdTogether(page, [outside]);
    await holdTogether(page, [outside]);
    await expect.poll(() => state(page)).toMatchObject({ lives: 0, over: true });
    expect(await sceneTexts(page, SCENE)).toContain('Chords played: 1, 30 XP');
    // the step button names the step and goes on to the next one, a new round
    expect(await sceneTexts(page, SCENE)).toContain('White triads');
    await clickButton(page, SCENE, await sceneButton(page, SCENE, 'Step: which chords come'));
    await expect.poll(() => state(page)).toMatchObject({ lives: 3, solved: 0 });
    await expect.poll(() => sceneTexts(page, SCENE)).toContain('All triads');
    expectNoErrors(errors);
  });

  test('ft_1_29.AC2 a common tone kept down from the last chord counts for the next one', async ({ page }) => {
    const errors = await openTrainer(page);
    const first = await target(page);
    const firstKeys = first.pitchClasses.map((pc) => 60 + pc);
    await page.evaluate((notes) => { for (const midi of notes) window.__virtualDevice!.press(midi, 80); }, firstKeys);
    await expect.poll(() => state(page)).toMatchObject({ solved: 1 });
    const second = await target(page);
    // keep the keys the two chords share, let the others go, and press only the new chord's other notes
    const kept = firstKeys.filter((k) => second.pitchClasses.includes(k % 12));
    await page.evaluate((notes) => { for (const midi of notes) window.__virtualDevice!.release(midi); }, firstKeys.filter((k) => !kept.includes(k)));
    const missing = second.pitchClasses.filter((pc) => !kept.some((k) => k % 12 === pc)).map((pc) => 72 + pc);
    await holdTogether(page, missing);
    await expect.poll(() => state(page)).toMatchObject({ solved: 2, lives: 3 });
    expectNoErrors(errors);
  });
});
