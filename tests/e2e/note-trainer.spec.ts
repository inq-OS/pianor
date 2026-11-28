// Covers ft_0_17.AC1, ft_0_17.AC2, ft_0_17.AC3, ft_0_17.AC4, ft_0_17.AC6, ft_0_17.AC8, ft_0_17.AC9, ft_0_17.AC11, ft_0_17.AC12.
// The player's room opens the note-name trainer from the stand's panel (ft_1_08.AC11): one note on the staff with its name hidden, a wrong press costs a life
// (a heart goes grey) and puts the name on the note, three lost lives end the round (a key or the toolbar's loop starts a new
// one), and the B/H letter setting. Almost no text on the screen: hearts, not "Lives: 3"; no hints.
import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { clickAndRedraw, clickButton, expectNoErrors, openFromStand, openGame, profileButton, playWithVirtualPiano as playTogether, sceneTexts, totalXp, waitForScene } from './helpers';

/**
 * Keys played one press after another: keys within a short window are one press (AC8), so each press waits a little
 * longer than that window after the last.
 */
const playWithVirtualPiano = async (page: Page, midis: number[]) => {
  for (const midi of midis) {
    await page.waitForTimeout(60);
    await playTogether(page, [midi]);
  }
};

const target = (page: Page) => page.evaluate(() => (window.__game.scene.getScene('noteTrainer') as unknown as { round: { target: number } }).round.target);

/** A key next to the shown note, always on the keyboard: a wrong press. */
const wrongKey = (midi: number) => (midi + 1 <= 96 ? midi + 1 : midi - 1);

const openTrainer = async (page: Page) => {
  const errors = await openGame(page, '?device=virtual', 'en', 'profiles');
  await clickButton(page, 'profiles', await profileButton(page, 'TUVI'));
  await waitForScene(page, 'profile');
  await openFromStand(page, 'Note names');
  await waitForScene(page, 'noteTrainer');
  return errors;
};

/** The hearts as drawn, lit of total. */
const hearts = (page: Page) => page.evaluate(() => (window.__game.scene.getScene('noteTrainer') as unknown as { shownHearts: { lit: number; total: number } }).shownHearts);
/** The index of the toolbar item `n` (0 = the step, 1 = the letters, 2 = the new round's loop). */
/** The band's action `n` (0 the step, 1 New round once the lives are gone): its button's index. */
const bandAction = (page: Page, n: number) => page.evaluate((i) => {
  const scene = window.__game.scene.getScene('noteTrainer') as unknown as { buttons: unknown[]; toolbarButtons: { items: unknown[] } };
  return scene.buttons.indexOf(scene.toolbarButtons.items[i]);
}, n);
/** The letter naming, an item in the band (ft_1_20 rule 2): the button whose word is B or H. */
const namingItem = (page: Page) => page.evaluate(() =>
  (window.__game.scene.getScene('noteTrainer').buttons as { objects: { text?: string }[] }[]).findIndex((b) => b.objects.some((o) => o.text === 'B' || o.text === 'H')));
const stepIndex = (page: Page) => page.evaluate(() => (window.__game.scene.getScene('noteTrainer') as unknown as { stepIndex: number }).stepIndex);
/** A note name on the staff (B or H naming, a sharp or flat after it). */
const isNoteName = (text: string) => /^[A-H](#|b|♯|♭)?$/.test(text);

const lives = (page: Page) => page.evaluate(() => (window.__game.scene.getScene('noteTrainer') as unknown as { round: { lives: number } }).round.lives);

test.describe('note-name trainer (ft_0_17)', () => {
  test('the room opens it, and the note name stays hidden until a wrong press', async ({ page }) => {
    const errors = await openTrainer(page);
    // only the band's step number and letter naming have words (the player is in the room, ft_1_20.AC13); no title, hint or lives text
    const texts = await sceneTexts(page, 'noteTrainer');
    expect([...texts].sort()).toEqual(['1', 'B']);
    expect(await hearts(page)).toEqual({ lit: 3, total: 3 });
    // no note name is drawn while the student has not pressed a wrong key (AC1): the B on the toolbar is the letter switch
    expect(await page.evaluate(() => (window.__game.scene.getScene('noteTrainer') as unknown as { wrong: unknown }).wrong)).toBeNull();
    expectNoErrors(errors);
  });

  test('a wrong press costs one heart and puts the name on the note; finding it then earns no XP, the next note read alone does (AC1, AC2, AC3, AC9)', async ({ page }) => {
    const errors = await openTrainer(page);
    const namesBefore = (await sceneTexts(page, 'noteTrainer')).filter(isNoteName).length;
    const midi = await target(page);
    await playWithVirtualPiano(page, [wrongKey(midi)]);
    expect(await lives(page)).toBe(2);
    expect(await hearts(page)).toEqual({ lit: 2, total: 3 });
    // the name now stands on the note: one more letter on the screen than the toolbar's B
    expect((await sceneTexts(page, 'noteTrainer')).filter(isNoteName).length).toBe(namesBefore + 1);

    const before = await totalXp(page);
    await playWithVirtualPiano(page, [await target(page)]);
    expect((await sceneTexts(page, 'noteTrainer')).filter(isNoteName).length).toBe(namesBefore);
    // the name was given away: the note counts as found, with no XP (AC9)
    expect(await totalXp(page)).toBe(before);
    await playWithVirtualPiano(page, [await target(page)]);
    // a right name read alone is saved to the profile at once (AC3)
    expect(await totalXp(page)).toBe(before + 10);
    expectNoErrors(errors);
  });

  test('a wrong key slipped together with the right one is a right press (AC8)', async ({ page }) => {
    const errors = await openTrainer(page);
    const before = await totalXp(page);
    const midi = await target(page);
    await playTogether(page, [wrongKey(midi), midi]);
    expect(await lives(page)).toBe(3);
    expect(await totalXp(page)).toBe(before + 10);
    expect(await target(page)).not.toBe(midi);
    expectNoErrors(errors);
  });

  test('two wrong keys together cost one heart (AC8)', async ({ page }) => {
    const errors = await openTrainer(page);
    const midi = await target(page);
    await playTogether(page, [wrongKey(midi), midi + 2 <= 96 ? midi + 2 : midi - 2]);
    expect(await lives(page)).toBe(2);
    expectNoErrors(errors);
  });

  test('a new player level reached in the trainer is shown under the hearts: its shield and number (AC12, d312)', async ({ page }) => {
    const errors = await openTrainer(page);
    // one right name (10 XP) short of the player's next level
    const next = await page.evaluate(async () => {
      const profiles = window.__game.registry.get('context').profiles as { progress: { level: { level: number; xpIntoLevel: number; xpForLevel: number } }; addTrainerXp(xp: number): Promise<unknown> };
      const { level, xpIntoLevel, xpForLevel } = profiles.progress.level;
      await profiles.addTrainerXp(xpForLevel - xpIntoLevel - 10);
      return level + 1;
    });
    await playWithVirtualPiano(page, [await target(page)]);
    await expect.poll(() => sceneTexts(page, 'noteTrainer')).toContain(String(next));
    expectNoErrors(errors);
  });

  test('a key one octave off stands beside the note as its ghost with its name and an 8 (AC2, d312)', async ({ page }) => {
    const errors = await openTrainer(page);
    const midi = await target(page);
    await playWithVirtualPiano(page, [midi + 12 <= 96 ? midi + 12 : midi - 12]);
    const staff = await page.evaluate(() => {
      const view = (window.__game.scene.getScene('noteTrainer') as unknown as { staff: { playedShown: string | null; playedOctaveShown: boolean } }).staff;
      return { name: view.playedShown, octave: view.playedOctaveShown };
    });
    expect(staff.name).toMatch(/^[A-H]#?$/);
    expect(staff.octave).toBe(true);
    expectNoErrors(errors);
  });

  test('three lost lives end the round, and the band loop starts a new one with three lives (AC3)', async ({ page }) => {
    const errors = await openTrainer(page);
    await playWithVirtualPiano(page, [await target(page)]);
    const earned = await totalXp(page);
    for (let i = 0; i < 3; i++) {
      await playWithVirtualPiano(page, [wrongKey(await target(page))]);
    }
    expect(await lives(page)).toBe(0);
    expect(await totalXp(page)).toBe(earned);
    expect(await hearts(page)).toEqual({ lit: 0, total: 3 });
    // the round's result in one objective line until the next round (AC11)
    expect(await sceneTexts(page, 'noteTrainer')).toContain('✓1  +10 XP');
    await clickButton(page, 'noteTrainer', await bandAction(page, 1));
    expect(await lives(page)).toBe(3);
    expect(await sceneTexts(page, 'noteTrainer')).not.toContain('✓1  +10 XP');
    // Again keeps the XP already saved (AC3)
    expect(await totalXp(page)).toBe(earned);
    expectNoErrors(errors);
  });

  test('after the last life a key starts a new round, but not the key that lost it (AC3)', async ({ page }) => {
    const errors = await openTrainer(page);
    for (let i = 0; i < 3; i++) await playWithVirtualPiano(page, [wrongKey(await target(page))]);
    expect(await lives(page)).toBe(0);
    await playWithVirtualPiano(page, [60]);
    expect(await lives(page)).toBe(0);
    await page.waitForTimeout(1100);
    await playWithVirtualPiano(page, [60]);
    expect(await lives(page)).toBe(3);
    expectNoErrors(errors);
  });

  test('the step button shows its number and cycles the four steps, each a new round', async ({ page }) => {
    const errors = await openTrainer(page);
    for (const expected of [1, 2, 3, 0]) {
      await clickButton(page, 'noteTrainer', await bandAction(page, 0));
      expect(await stepIndex(page)).toBe(expected);
      expect(await sceneTexts(page, 'noteTrainer')).toContain(String(expected + 1));
    }
    expectNoErrors(errors);
  });

  test('the letter naming switches between B and H and is saved (AC4)', async ({ page }) => {
    const errors = await openTrainer(page);
    await clickAndRedraw(page, 'noteTrainer', await namingItem(page));
    expect(await sceneTexts(page, 'noteTrainer')).toContain('H');
    const saved = await page.evaluate(() => window.__game.registry.get('context').profiles.noteNaming as string);
    expect(saved).toBe('H');
    expectNoErrors(errors);
  });
});
