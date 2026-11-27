// Covers ft_1_39.AC3, ft_1_39.AC4, ft_1_39.AC5.
import { describe, expect, it } from 'vitest';
import catalogJson from '../../../content/lessons/catalog.json';
import halfStep from '../../../content/lessons/half-step.json';
import type { NoteEvent } from '../judge/types.ts';
import { strings } from '../text/strings.ts';
import { loadCatalog } from './catalog.ts';
import { loadLessons, type Lesson } from './lesson.ts';
import { LESSON_RULES, LessonRun, type LessonPress } from './run.ts';

const [lesson] = loadLessons([halfStep], loadCatalog(catalogJson), (k) => k in strings) as [Lesson];
const on = (midi: number): NoteEvent => ({ kind: 'on', midi, velocity: 90, timeMs: 0, source: 'test' });

/** Plays the awaited notes of the current item, right. */
function playRight(run: LessonRun) {
  const item = run.current();
  if (!item) throw new Error('nothing awaited');
  let last: LessonPress = { verdict: 'ignored' };
  for (const midi of item.answer.slice(item.played)) last = run.press(on(midi));
  return last;
}
/** A key that is not the awaited one and not its neighbour. */
const wrongFor = (run: LessonRun) => run.current()!.answer[run.current()!.played]! + 5;

/** A run moved on to `step`, every step before it played right. */
function runAt(step: 'copy' | 'pitfall' | 'try' | 'playAlong' | 'check', seed = 'seed'): LessonRun {
  const run = new LessonRun(lesson, seed);
  run.showDone();
  while (run.step() !== step) playRight(run);
  return run;
}

describe('a lesson runs its six steps in order (ft_1_39.AC3)', () => {
  it('ft_1_39.AC3 goes show, copy, pitfall, try, play-along, check, done', () => {
    const run = new LessonRun(lesson, 's');
    const seen = [run.step()];
    expect(run.current()).toBeNull();
    run.showDone();
    while (run.step() !== 'done') {
      if (seen.at(-1) !== run.step()) seen.push(run.step());
      playRight(run);
    }
    expect([...seen, 'done']).toEqual(['show', 'copy', 'pitfall', 'try', 'playAlong', 'check', 'done']);
  });

  it('ft_1_39.AC3 Copy asks for the notes Kiur showed, one by one, and a wrong key does not move on', () => {
    const run = runAt('copy');
    expect(run.current()!.answer).toEqual(lesson.show.notes);
    expect(run.press(on(wrongFor(run)))).toMatchObject({ verdict: 'wrong' });
    expect(run.current()!.played).toBe(0);
    expect(run.press(on(lesson.show.notes[0]!))).toMatchObject({ verdict: 'right' });
    expect(run.current()!.played).toBe(1);
  });

  it(`ft_1_39.AC3 Try ends only after ${LESSON_RULES.tryRun} clean items in a row; a wrong key empties the run`, () => {
    const run = runAt('try');
    for (let i = 0; i < LESSON_RULES.tryRun - 1; i++) playRight(run);
    expect(run.cleanRun()).toBe(LESSON_RULES.tryRun - 1);
    run.press(on(wrongFor(run)));
    expect(run.cleanRun()).toBe(0);
    playRight(run); // the item with the mistake is finished, but it was not clean
    expect(run.cleanRun()).toBe(0);
    for (let i = 0; i < LESSON_RULES.tryRun - 1; i++) playRight(run);
    expect(run.step()).toBe('try');
    expect(playRight(run)).toMatchObject({ verdict: 'right', stepDone: true });
    expect(run.step()).toBe('playAlong');
  });

  it("ft_1_39.AC3 a wrong key with the reason of the lesson's pitfall brings the pitfall card back", () => {
    const run = runAt('try');
    const awaited = run.current()!.answer[0]!;
    expect(run.press(on(awaited + 1))).toMatchObject({ verdict: 'wrong', reason: 'neighbour-key', pitfall: true });
    expect(run.press(on(awaited + 7))).toMatchObject({ verdict: 'wrong', pitfall: false });
  });

  it('gives theory XP for every right note after the show, and none for the show', () => {
    const run = new LessonRun(lesson, 'xp');
    run.showDone();
    expect(run.xp()).toBe(0);
    playRight(run);
    expect(run.xp()).toBe(LESSON_RULES.xpPerNote * lesson.show.notes.length);
  });
});

describe('the help fades in Try (ft_1_39.AC4)', () => {
  it('ft_1_39.AC4 lights the awaited key at once, then only after two wrong presses, then not at all', () => {
    const run = runAt('try');
    const fade = LESSON_RULES.fade;
    for (let clean = 0; clean < fade.litUntil; clean++) {
      expect(run.lit()).toEqual([run.current()!.answer[0]]);
      playRight(run);
    }
    for (let clean = fade.litUntil; clean < fade.afterWrongUntil; clean++) {
      expect(run.lit()).toEqual([]);
      run.press(on(wrongFor(run)));
      expect(run.lit()).toEqual([]);
      run.press(on(wrongFor(run)));
      expect(run.lit()).toEqual([run.current()!.answer[0]]);
      playRight(run);
    }
    // the mistakes above emptied the run, so this is still Try, now with no light at all
    expect(run.step()).toBe('try');
    run.press(on(wrongFor(run)));
    run.press(on(wrongFor(run)));
    run.press(on(wrongFor(run)));
    expect(run.lit()).toEqual([]);
  });

  it('ft_1_39.AC4 lights every awaited key in Copy and the pitfall, and none in the play-along', () => {
    const copy = runAt('copy');
    expect(copy.lit()).toEqual([copy.current()!.answer[0]]);
    const pitfall = runAt('pitfall');
    expect(pitfall.lit()).toEqual([pitfall.current()!.answer[0]]);
    expect(runAt('playAlong').lit()).toEqual([]);
  });
});

describe('the check and its medal (ft_1_39.AC5)', () => {
  it(`ft_1_39.AC5 asks ${halfStep.check.count} items with no light, and all right the first time is gold`, () => {
    const run = runAt('check');
    expect(run.lit()).toEqual([]);
    run.press(on(wrongFor(run)));
    run.press(on(wrongFor(run)));
    run.press(on(wrongFor(run)));
    expect(run.lit()).toEqual([]);
    const clean = runAt('check', 'gold');
    while (clean.step() === 'check') playRight(clean);
    expect(clean.checkScore()).toEqual({ firstTry: halfStep.check.count, of: halfStep.check.count });
    expect(clean.medal()).toBe('gold');
  });

  it('ft_1_39.AC5 counts an item with a wrong key as not right the first time: one or two silver, more bronze', () => {
    const medalAfter = (misses: number) => {
      const run = runAt('check', `m${misses}`);
      let missed = 0;
      while (run.step() === 'check') {
        if (missed < misses) {
          run.press(on(wrongFor(run)));
          missed += 1;
        }
        playRight(run);
      }
      return run.medal();
    };
    expect(medalAfter(1)).toBe('silver');
    expect(medalAfter(2)).toBe('silver');
    expect(medalAfter(3)).toBe('bronze');
  });

  it('has no medal before the check is finished', () => {
    expect(runAt('check').medal()).toBeNull();
  });
});
