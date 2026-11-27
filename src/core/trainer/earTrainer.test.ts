// Covers ft_1_10.AC2 (seeded questions, notes in order, never the same as the last), ft_1_10.AC3 (a wrong press is a miss with a reason),
// ft_1_10.AC4 (points by misses), ft_1_10.AC5 (level and stars from total points, nothing taken away), ft_1_10.AC6 (repeat time), ft_1_10.AC8,
// ft_1_10.AC10 (5 round stars, one dimmed per miss), ft_1_10.AC11 (any key continues and never counts as an answer).
import { describe, expect, it } from 'vitest';
import {
  EAR_ANSWER_MIN_MS,
  EAR_NEXT_PAUSE_MS,
  EAR_ROUND_STARS,
  EAR_STAR_POINTS,
  earKeyAction,
  earLevelOf,
  earRowFor,
  isRepeatDue,
  pickQuestion,
  pointsForMisses,
  pressEar,
  repeatAfterMs,
  roundStars,
  startQuestion,
  starsNeeded,
} from './earTrainer';

const SINGLE = { mode: 'single' as const, keys: [60, 64, 67] };
const TWO = { mode: 'two' as const, keys: [60, 64, 67] };

describe('ear trainer points (AC4)', () => {
  it('scores 100, 50, 25, 12, 6, 0 for 0 to 4 misses and 0 from 5 on', () => {
    expect([0, 1, 2, 3, 4, 5, 9].map(pointsForMisses)).toEqual([100, 50, 25, 12, 6, 0, 0]);
  });
});

describe('ear level from total points (AC5)', () => {
  it('level N needs 5 + N stars of 100 points', () => {
    expect(EAR_STAR_POINTS).toBe(100);
    expect(starsNeeded(1)).toBe(6);
    expect(starsNeeded(2)).toBe(7);
  });

  it('starts at level 1 with no stars and no points', () => {
    expect(earLevelOf(0)).toEqual({ level: 1, stars: 0, starPoints: 0 });
  });

  it('counts stars and the points of the current star from one total', () => {
    expect(earLevelOf(250)).toEqual({ level: 1, stars: 2, starPoints: 50 });
  });

  it('a level-up carries the leftover points into the next level (level 1 takes 600)', () => {
    expect(earLevelOf(599)).toEqual({ level: 1, stars: 5, starPoints: 99 });
    expect(earLevelOf(600)).toEqual({ level: 2, stars: 0, starPoints: 0 });
    expect(earLevelOf(650)).toEqual({ level: 2, stars: 0, starPoints: 50 });
    expect(earLevelOf(1300)).toEqual({ level: 3, stars: 0, starPoints: 0 });
  });

  it('rejects a negative or fractional total', () => {
    expect(() => earLevelOf(-1)).toThrow(RangeError);
    expect(() => earLevelOf(1.5)).toThrow(RangeError);
  });
});

describe('ear levels table (AC2)', () => {
  const table = [SINGLE, TWO];
  it('level N uses row N, and a level past the table uses the last row', () => {
    expect(earRowFor(table, 1)).toBe(SINGLE);
    expect(earRowFor(table, 2)).toBe(TWO);
    expect(earRowFor(table, 9)).toBe(TWO);
  });

  it('rejects an empty table and levels below 1', () => {
    expect(() => earRowFor([], 1)).toThrow(RangeError);
    expect(() => earRowFor(table, 0)).toThrow(RangeError);
  });
});

describe('seeded questions (AC2)', () => {
  it('the same seed and index give the same question', () => {
    expect(pickQuestion('s', 3, TWO, null)).toEqual(pickQuestion('s', 3, TWO, null));
  });

  it('a single question is one key from the row', () => {
    for (let i = 0; i < 50; i++) {
      const q = pickQuestion('single', i, SINGLE, null);
      expect(q).toHaveLength(1);
      expect(SINGLE.keys).toContain(q[0]);
    }
  });

  it('a two-note question is two different keys from the row', () => {
    for (let i = 0; i < 50; i++) {
      const q = pickQuestion('two', i, TWO, null);
      expect(q).toHaveLength(2);
      expect(q[0]).not.toBe(q[1]);
      expect(TWO.keys).toContain(q[0]);
      expect(TWO.keys).toContain(q[1]);
    }
  });

  it('a single question never repeats the previous one when the row has another key', () => {
    for (let i = 0; i < 100; i++) {
      expect(pickQuestion('rep', i, SINGLE, [64])[0]).not.toBe(64);
    }
  });
});

describe('a question and its misses (AC3)', () => {
  it('a single note ends on the right key with no misses', () => {
    const q = startQuestion([62]);
    const r = pressEar(q, 62);
    expect(r.verdict).toBe('done');
    expect(r.question.misses).toBe(0);
    expect(r.question.done).toBe(true);
  });

  it('a wrong key is a miss with the reason, and the note stays expected', () => {
    const q = startQuestion([60]);
    const r = pressEar(q, 72);
    expect(r.verdict).toBe('miss');
    expect(r.reason).toBe('wrong-octave');
    expect(r.question.misses).toBe(1);
    expect(r.question.done).toBe(false);
  });

  it('a two-note question plays the notes in order and adds up its misses (AC2, AC4)', () => {
    const miss = pressEar(startQuestion([60, 67]), 67);
    expect(miss.verdict).toBe('miss');
    const q = miss.question;
    expect(q.misses).toBe(1);
    const first = pressEar(q, 60);
    expect(first.verdict).toBe('next');
    const second = pressEar(first.question, 67);
    expect(second.verdict).toBe('done');
    expect(second.question.misses).toBe(1);
    expect(pointsForMisses(second.question.misses)).toBe(50);
  });

  it('presses after a question is done change nothing', () => {
    const done = pressEar(startQuestion([60]), 60).question;
    expect(pressEar(done, 61).verdict).toBe('closed');
  });
});

describe('repeat time (AC6)', () => {
  it('repeats after twice the sounding time: sound plus an equal wait', () => {
    expect(repeatAfterMs(1, 1)).toBe(2000);
    expect(repeatAfterMs(3, 1)).toBe(6000);
  });

  it('counts the sounding time of all the notes: a two-note question waits twice as long', () => {
    expect(repeatAfterMs(1, 2)).toBe(4000);
    expect(repeatAfterMs(3, 2)).toBe(12000);
    expect(isRepeatDue({ now: 3999, lastActivityMs: 0, seconds: 1, notes: 2, repeatOn: true })).toBe(false);
    expect(isRepeatDue({ now: 4000, lastActivityMs: 0, seconds: 1, notes: 2, repeatOn: true })).toBe(true);
  });

  it('is due only with repeat on and no activity for that long', () => {
    expect(isRepeatDue({ now: 2000, lastActivityMs: 0, seconds: 1, notes: 1, repeatOn: true })).toBe(true);
    expect(isRepeatDue({ now: 1999, lastActivityMs: 0, seconds: 1, notes: 1, repeatOn: true })).toBe(false);
    expect(isRepeatDue({ now: 9000, lastActivityMs: 0, seconds: 1, notes: 1, repeatOn: false })).toBe(false);
  });

  it('rejects a duration outside whole seconds 1 to 3', () => {
    expect(() => repeatAfterMs(0, 1)).toThrow(RangeError);
    expect(() => repeatAfterMs(4, 1)).toThrow(RangeError);
    expect(() => repeatAfterMs(1.5, 1)).toThrow(RangeError);
  });

  it('rejects a question with no notes or a fraction of one', () => {
    expect(() => repeatAfterMs(1, 0)).toThrow(RangeError);
    expect(() => repeatAfterMs(1, 1.5)).toThrow(RangeError);
  });
});

describe('round stars (ft_1_10.AC10)', () => {
  it('a round shows 5 stars, all lit on the first try; each miss dims one, down to 0', () => {
    expect(EAR_ROUND_STARS).toBe(5);
    expect([0, 1, 2, 3, 4, 5, 6, 12].map(roundStars)).toEqual([5, 4, 3, 2, 1, 0, 0, 0]);
  });

  it('a lit star means points: 0 stars is exactly 0 points', () => {
    for (let misses = 0; misses <= 7; misses += 1) expect(roundStars(misses) === 0).toBe(pointsForMisses(misses) === 0);
  });

  it('rejects a miss count that is not a whole number, 0 or more', () => {
    expect(() => roundStars(-1)).toThrow(RangeError);
    expect(() => roundStars(1.5)).toThrow(RangeError);
  });
});

describe('any key continues; that key is never an answer (ft_1_10.AC11)', () => {
  const done = { done: true, doneAtMs: 1000, soundsAtMs: 0 };
  const open = { done: false, doneAtMs: null, soundsAtMs: 5000 };

  it('after a round, a key continues once the answer was shown for a moment', () => {
    expect(earKeyAction(done, 1000)).toBe('ignore');
    expect(earKeyAction(done, 1000 + EAR_ANSWER_MIN_MS - 1)).toBe('ignore');
    expect(earKeyAction(done, 1000 + EAR_ANSWER_MIN_MS)).toBe('continue');
  });

  it('keys before the next question sounds are not answers (so the continuing key never counts as a miss)', () => {
    expect(earKeyAction(open, 5000 - 1)).toBe('ignore');
    expect(earKeyAction(open, 5000 - EAR_NEXT_PAUSE_MS)).toBe('ignore');
    expect(earKeyAction(open, 5000)).toBe('answer');
    expect(earKeyAction(open, 9000)).toBe('answer');
  });

  it('the pause after a key is the swallow window, so a press in the same moment as the continue is ignored', () => {
    const continuedAt = 2000;
    const next = { done: false, doneAtMs: null, soundsAtMs: continuedAt + EAR_NEXT_PAUSE_MS };
    expect(earKeyAction(next, continuedAt)).toBe('ignore');
  });
});
