// Covers ft_1_10.AC1 (the screen shows the level and the stars, and no staff or name while a question is open),
// ft_1_10.AC3 (a wrong press is a miss with a reason), ft_1_10.AC4 (points by misses), ft_1_10.AC7 (the answer after the question),
// ft_1_10.AC10 (5 round stars, one dimmed per miss), ft_1_10.AC11 (any key continues; that key is not an answer).
// The room's loudspeaker opens it (the room entry); the other tests open the scene through the scene manager to keep to one step each.
import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { clickButton, expectNoErrors, openFromStand, openGame, profileButton, playWithVirtualPiano, sceneButton, sceneTexts, waitForScene } from './helpers';

type EarView = { notes: number[]; questionNumber: number; question: { misses: number; done: boolean }; shownStars: { lit: number; total: number } };
const ear = (page: Page) => page.evaluate(() => {
  const scene = window.__game.scene.getScene('earTrainer') as unknown as EarView;
  return { notes: scene.notes, questionNumber: scene.questionNumber, misses: scene.question.misses, done: scene.question.done, stars: [scene.shownStars.lit, scene.shownStars.total] };
});
/** Every text on the screen with no question found: the ear level and, in the band, the note length (the player is in the room, ft_1_20.AC13). */
const ONLY_TEXTS = ['Ear level 1', '1 s'];
/** A note name on the staff (H or B naming, a sharp or flat after it). */
const isNoteName = (text: string) => /^[A-H](#|b|♯|♭)?$/.test(text);
const questionNotes = async (page: Page) => (await ear(page)).notes;

const missKey = (midi: number) => (midi + 1 <= 96 ? midi + 1 : midi - 1);

const openEar = async (page: Page) => {
  const errors = await openGame(page, '?device=virtual', 'en', 'profiles');
  await clickButton(page, 'profiles', await profileButton(page, 'TUVI'));
  await waitForScene(page, 'profile');
  await page.evaluate(() => window.__game.scene.start('earTrainer'));
  await waitForScene(page, 'earTrainer');
  return errors;
};

/** Opens the trainer the way the student does, from the room, so no other screen keeps listening to the keys. */
const openEarFromRoom = async (page: Page) => {
  const errors = await openGame(page, '?device=virtual', 'en', 'profiles');
  await clickButton(page, 'profiles', await profileButton(page, 'TUVI'));
  await waitForScene(page, 'profile');
  await openFromStand(page, 'Ear training');
  await waitForScene(page, 'earTrainer');
  return errors;
};

test.describe('pitch trainer by ear (ft_1_10)', () => {
  test('the ear in the stand\'s panel opens the trainer (room entry, AC1, ft_1_08.AC11)', async ({ page }) => {
    const errors = await openGame(page, '?device=virtual', 'en', 'profiles');
    await clickButton(page, 'profiles', await profileButton(page, 'TUVI'));
    await waitForScene(page, 'profile');
    await openFromStand(page, 'Ear training');
    await waitForScene(page, 'earTrainer');
    expectNoErrors(errors);
  });

  test('no staff or note name is shown while the question is open; the screen shows the level and stars (AC1)', async ({ page }) => {
    const errors = await openEar(page);
    const texts = await sceneTexts(page, 'earTrainer');
    expect(texts).toContain('Ear level 1');
    expect(texts.some(isNoteName)).toBe(false);
    // no hints or instructions
    expect(texts).toEqual(ONLY_TEXTS);
    expectNoErrors(errors);
  });

  test('a wrong press dims a star, with no hint; the right notes finish the question, score it and show the names on the staff (AC3, AC4, AC7)', async ({ page }) => {
    const errors = await openEar(page);
    const notes = await questionNotes(page);
    await playWithVirtualPiano(page, [missKey(notes[0]!)]);
    expect((await ear(page)).stars).toEqual([4, 5]);
    expect(await sceneTexts(page, 'earTrainer')).toEqual(ONLY_TEXTS);
    await playWithVirtualPiano(page, notes);
    // one miss pays 50 points (AC4); the note names stand on the staff's notes (AC7)
    const texts = await sceneTexts(page, 'earTrainer');
    expect(texts.filter(isNoteName)).toHaveLength(notes.length);
    expect(await page.evaluate(() => (window.__game.scene.getScene('earTrainer') as unknown as { points: number }).points)).toBe(50);
    expectNoErrors(errors);
  });

  test('after a round, a piano key goes on and is not counted as an answer in the next round (AC11)', async ({ page }) => {
    const errors = await openEarFromRoom(page);
    const first = await ear(page);
    // the answer stays a moment: a key pressed at once (a double press) does not skip it
    await playWithVirtualPiano(page, [...first.notes, missKey(first.notes[0]!)]);
    expect((await ear(page)).done).toBe(true);
    expect((await ear(page)).questionNumber).toBe(first.questionNumber);
    await page.waitForTimeout(700);
    await playWithVirtualPiano(page, [missKey(first.notes[0]!)]);
    let now = await ear(page);
    expect(now.questionNumber).toBe(first.questionNumber + 1);
    expect(now.misses).toBe(0);
    // a key pressed with the one that goes on, before the next question sounds, is ignored, not a miss
    await page.waitForTimeout(700);
    await playWithVirtualPiano(page, [...now.notes, missKey(now.notes[0]!)]);
    await page.waitForTimeout(700);
    await playWithVirtualPiano(page, [missKey(now.notes[0]!), missKey(now.notes[0]!)]);
    now = await ear(page);
    expect(now.questionNumber).toBe(first.questionNumber + 2);
    expect(now.misses).toBe(0);
    await page.waitForTimeout(700);
    await playWithVirtualPiano(page, [missKey(now.notes[0]!)]);
    now = await ear(page);
    expect(now.misses).toBe(1);
    expectNoErrors(errors);
  });

  test('after a round, any computer key goes on, a note key too, and neither counts as an answer (AC11)', async ({ page }) => {
    const errors = await openEarFromRoom(page);
    const first = await ear(page);
    await playWithVirtualPiano(page, first.notes);
    await page.waitForTimeout(700);
    await page.keyboard.press('Space');
    let now = await ear(page);
    expect(now.questionNumber).toBe(first.questionNumber + 1);
    expect(now.misses).toBe(0);
    await page.waitForTimeout(700);
    await playWithVirtualPiano(page, now.notes);
    await page.waitForTimeout(700);
    // a computer-keyboard note key (Z is a piano key there) goes on and is not a miss in the new question
    await page.keyboard.press('KeyZ');
    now = await ear(page);
    expect(now.questionNumber).toBe(first.questionNumber + 2);
    expect(now.misses).toBe(0);
    expectNoErrors(errors);
  });

  test('a click on the screen goes on after a round; the note length is one button cycling 1, 2, 3 s (AC6, AC11)', async ({ page }) => {
    const errors = await openEarFromRoom(page);
    const first = await ear(page);
    await playWithVirtualPiano(page, first.notes);
    await page.waitForTimeout(700);
    const size = page.viewportSize()!;
    await page.mouse.click(size.width / 2, size.height / 2);
    expect((await ear(page)).questionNumber).toBe(first.questionNumber + 1);
    const seconds = () => page.evaluate(() => (window.__game.scene.getScene('earTrainer') as unknown as { seconds: number }).seconds);
    expect(await seconds()).toBe(1);
    // the length button, a cell of the strip; a real click on it
    const lengthButton = () => sceneButton(page, 'earTrainer', 'Note length');
    for (const expected of [2, 3, 1]) {
      await clickButton(page, 'earTrainer', await lengthButton());
      await expect.poll(seconds).toBe(expected);
    }
    expectNoErrors(errors);
  });

  test('ft_1_10.AC3: a wrong octave says only "right letter, wrong octave"; any other miss only dims a star, never a direction', async ({ page }) => {
    const errors = await openEar(page);
    const target = (await ear(page)).notes[0]!;
    await playWithVirtualPiano(page, [target + 12 <= 96 ? target + 12 : target - 12]);
    let texts = await sceneTexts(page, 'earTrainer');
    expect(texts).toContain('Right letter, wrong octave');
    expect((await ear(page)).stars).toEqual([4, 5]);
    await playWithVirtualPiano(page, [missKey(target)]);
    texts = await sceneTexts(page, 'earTrainer');
    expect(texts).toEqual(ONLY_TEXTS);
    expect(texts.some((text) => /almost|higher|lower|below|above/i.test(text))).toBe(false);
    expect((await ear(page)).stars).toEqual([3, 5]);
    expectNoErrors(errors);
  });
});
