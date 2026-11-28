// Covers ft_1_10.AC1 (the screen shows the level and the stars, and no staff or name while a question is open),
// ft_1_10.AC3 (a wrong press is a miss with a reason), ft_1_10.AC4 (points by misses), ft_1_10.AC7 (the answer after the question),
// ft_1_10.AC10 (5 round stars, one dimmed per miss, a two-note question's slots), ft_1_10.AC11 (any key continues; that key is not an answer),
// ft_1_10.AC13 (any step can be chosen, up or down), ft_1_10.AC5 (a new level is shown by a card, not by colour alone).
// The room's loudspeaker opens it (the room entry); the other tests open the scene through the scene manager to keep to one step each.
import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { clickButton, expectNoErrors, openFromStand, openGame, pickChoice, profileButton, playWithVirtualPiano, sceneButton, sceneTexts, waitForScene } from './helpers';

type EarView = { notes: number[]; questionNumber: number; question: { misses: number; done: boolean }; shownStars: { lit: number; total: number }; shownSlots: boolean[]; step: number; levelUpCard: unknown };
const ear = (page: Page) => page.evaluate(() => {
  const scene = window.__game.scene.getScene('earTrainer') as unknown as EarView;
  return { notes: scene.notes, questionNumber: scene.questionNumber, misses: scene.question.misses, done: scene.question.done, stars: [scene.shownStars.lit, scene.shownStars.total], slots: scene.shownSlots, step: scene.step, levelUpCard: scene.levelUpCard !== null };
});
/** Every text on the screen with no question found: the ear level, and the note length and the step beside their pictures (ft_1_10.AC13). */
const ONLY_TEXTS = ['1', '1 s', '1'];
const STEP = 'Step: one note or two, and which keys';
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
    expect(texts).toContain('1');
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

  test('ft_1_10.AC2 a question sounds alone: the notes left of the last sounding stop and never start in the next one', async ({ page }) => {
    const errors = await openEar(page);
    // every note the game's piano starts or stops, with the time it happened
    await page.evaluate(() => {
      const piano = window.__game.registry.get('context').audio.piano as { noteOn: (m: number, v: number) => void; noteOff: (m: number) => void };
      const log: { kind: 'on' | 'off'; midi: number; at: number }[] = [];
      (window as unknown as { __soundLog: typeof log }).__soundLog = log;
      const on = piano.noteOn.bind(piano);
      const off = piano.noteOff.bind(piano);
      piano.noteOn = (m, v) => { log.push({ kind: 'on', midi: m, at: performance.now() }); on(m, v); };
      piano.noteOff = (m) => { log.push({ kind: 'off', midi: m, at: performance.now() }); off(m); };
    });
    // Play again, then the next question before the first sounding has ended
    await page.evaluate(() => (window.__game.scene.getScene('earTrainer') as unknown as { play(): void }).play());
    await page.waitForTimeout(300);
    const mark = await page.evaluate(() => {
      (window.__game.scene.getScene('earTrainer') as unknown as { nextQuestion(pause: number): void }).nextQuestion(0);
      return performance.now();
    });
    const next = (await ear(page)).notes;
    type Sound = { kind: 'on' | 'off'; midi: number; at: number };
    const soundsAfter = async () => (await page.evaluate(() => (window as unknown as { __soundLog: Sound[] }).__soundLog)).filter((e) => e.at > mark);
    // wait on the game's own clock, not the wall's: until every note of the new question has started and stopped
    await expect.poll(async () => {
      const after = await soundsAfter();
      return next.every((m) => after.some((e) => e.kind === 'on' && e.midi === m) && after.some((e) => e.kind === 'off' && e.midi === m && after.some((o) => o.kind === 'on' && o.midi === m && o.at <= e.at)));
    }, { timeout: 15_000 }).toBe(true);
    const all = await soundsAfter();
    // up to the new question's last stop (a repeat of the question, later on the game's clock, is not this sounding)
    const lastStop = Math.max(...next.map((m) => all.find((e) => e.kind === 'off' && e.midi === m && all.some((o) => o.kind === 'on' && o.midi === m && o.at <= e.at))!.at));
    const after = all.filter((e) => e.at <= lastStop);
    // after the new question started only its own notes start
    expect(after.filter((e) => e.kind === 'on').map((e) => e.midi)).toEqual(next);
    // the last sounding was stopped when the new question started, not later in the middle of it
    expect(after.filter((e) => e.kind === 'off').every((e) => next.includes(e.midi))).toBe(true);
    // and nothing left of it cuts a new note short: each new note stops once, after it started
    for (const midi of next) {
      const events = after.filter((e) => e.midi === midi).map((e) => e.kind);
      expect(events, `note ${midi}`).toEqual(['on', 'off']);
    }
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

  test('ft_1_10.AC3 d312: a wrong octave shows only its mark (the letter right, 8 and the way); any other miss only dims a star', async ({ page }) => {
    const errors = await openEar(page);
    const target = (await ear(page)).notes[0]!;
    const up = target + 12 <= 96;
    await playWithVirtualPiano(page, [up ? target + 12 : target - 12]);
    let texts = await sceneTexts(page, 'earTrainer');
    expect(texts.some((text) => new RegExp(`^[A-H]#?✓ 8${up ? '▲' : '▼'}$`).test(text))).toBe(true);
    expect((await ear(page)).stars).toEqual([4, 5]);
    await playWithVirtualPiano(page, [missKey(target)]);
    texts = await sceneTexts(page, 'earTrainer');
    expect(texts).toEqual(ONLY_TEXTS);
    expect(texts.some((text) => /almost|higher|lower|below|above/i.test(text))).toBe(false);
    expect((await ear(page)).stars).toEqual([3, 5]);
    expectNoErrors(errors);
  });

  test('ft_1_10.AC13 any step can be chosen at ear level 1: a two-note step asks two notes, and the slots fill as each is found (AC10)', async ({ page }) => {
    const errors = await openEar(page);
    expect((await ear(page)).step).toBe(1);
    expect((await ear(page)).slots).toEqual([]);
    await pickChoice(page, 'earTrainer', STEP, 'Step 4: two notes');
    await expect.poll(async () => (await ear(page)).step).toBe(4);
    const now = await ear(page);
    expect(now.notes).toHaveLength(2);
    expect(now.slots).toEqual([false, false]);
    await page.waitForTimeout(700);
    await playWithVirtualPiano(page, [now.notes[0]!]);
    expect((await ear(page)).slots).toEqual([true, false]);
    // the slots carry no name: the notes are named only once both are found (AC1, AC7)
    expect((await sceneTexts(page, 'earTrainer')).some(isNoteName)).toBe(false);
    await playWithVirtualPiano(page, [now.notes[1]!]);
    expect((await ear(page)).slots).toEqual([true, true]);
    // and back down to the first step: levels never lock a row
    await pickChoice(page, 'earTrainer', STEP, 'Step 1: one note');
    await expect.poll(async () => (await ear(page)).step).toBe(1);
    expect((await ear(page)).notes).toHaveLength(1);
    expectNoErrors(errors);
  });

  test('ft_1_10.AC5 a new ear level shows a card with the level, then it goes', async ({ page }) => {
    const errors = await openEar(page);
    // 50 points short of level 2, then a question found with no miss
    await page.evaluate(async () => {
      const context = window.__game.registry.get('context') as { profiles: { addEarPoints(n: number): Promise<boolean> } };
      await context.profiles.addEarPoints(550);
    });
    await page.waitForTimeout(700);
    expect((await ear(page)).levelUpCard).toBe(false);
    await playWithVirtualPiano(page, (await ear(page)).notes);
    expect((await ear(page)).levelUpCard).toBe(true);
    // the card stands on the top card, clear of the staff with the answer on it
    const clear = await page.evaluate(() => {
      const scene = window.__game.scene.getScene('earTrainer') as unknown as { levelUpCard: { getBounds(): { bottom: number } }; staff: { layout?: unknown } | null; mainTop: number; px: { scale: number } };
      return scene.levelUpCard.getBounds().bottom <= scene.mainTop + 48 * scene.px.scale;
    });
    expect(clear).toBe(true);
    expect((await sceneTexts(page, 'earTrainer')).filter((text) => text === '2')).toHaveLength(2);
    await expect.poll(async () => (await ear(page)).levelUpCard, { timeout: 10_000 }).toBe(false);
    expectNoErrors(errors);
  });
});
