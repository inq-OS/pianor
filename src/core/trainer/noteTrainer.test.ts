// Covers ft_0_17.AC2 (a wrong press costs a life and gives a reason), ft_0_17.AC3 (three lives; the third loss ends the round; XP kept).
import { describe, expect, it } from 'vitest';
import { Random } from '../random';
import { NOTE_TRAINER_LIVES, createRound, pickTarget, pressKey } from './noteTrainer';

const RANGE = { low: 60, high: 72 };

describe('note-name trainer rules', () => {
  it('starts with three lives, no XP and a target inside the range', () => {
    const round = createRound(RANGE, 'seed-1');
    expect(NOTE_TRAINER_LIVES).toBe(3);
    expect(round.lives).toBe(3);
    expect(round.xp).toBe(0);
    expect(round.over).toBe(false);
    expect(round.target).toBeGreaterThanOrEqual(RANGE.low);
    expect(round.target).toBeLessThanOrEqual(RANGE.high);
  });

  it('the same seed gives the same targets', () => {
    expect(createRound(RANGE, 'x').target).toBe(createRound(RANGE, 'x').target);
    expect(pickTarget(new Random('x'), RANGE, null)).toBe(pickTarget(new Random('x'), RANGE, null));
  });

  it('a new target never repeats the previous one when the range allows it', () => {
    const random = new Random('repeat');
    for (let i = 0; i < 200; i++) {
      expect(pickTarget(random, RANGE, 66)).not.toBe(66);
    }
  });

  it('a right press gives XP and moves on to a new target', () => {
    const round = createRound(RANGE, 'seed-2');
    const result = pressKey(round, round.target);
    expect(result.verdict).toBe('correct');
    expect(result.round.xp).toBeGreaterThan(0);
    expect(result.round.lives).toBe(3);
    expect(result.round.target).not.toBe(round.target);
  });

  it('a wrong press costs one life and says why (AC2)', () => {
    const round = createRound(RANGE, 'seed-3');
    const result = pressKey(round, round.target + 12);
    expect(result.verdict).toBe('wrong');
    expect(result.reason).toBe('wrong-octave');
    expect(result.round.lives).toBe(2);
    expect(result.round.target).toBe(round.target);
    expect(result.round.over).toBe(false);
  });

  it('the third lost life ends the round and keeps the XP earned', () => {
    let round = createRound(RANGE, 'seed-4');
    round = pressKey(round, round.target).round;
    const earned = round.xp;
    const wrongKey = (r: typeof round): typeof round => pressKey(r, r.target === 60 ? 61 : 60).round;
    round = wrongKey(round);
    round = wrongKey(round);
    expect(round.over).toBe(false);
    round = wrongKey(round);
    expect(round.lives).toBe(0);
    expect(round.over).toBe(true);
    expect(round.xp).toBe(earned);
  });

  it('a press after the round is over changes nothing', () => {
    let round = createRound({ low: 60, high: 60 }, 'seed-5');
    for (let i = 0; i < 3; i++) round = pressKey(round, 61).round;
    const after = pressKey(round, 60);
    expect(after.verdict).toBe('over');
    expect(after.round).toEqual(round);
  });

  it('rejects a range outside the EZ-220 keys or an empty one', () => {
    expect(() => createRound({ low: 20, high: 72 }, 'bad')).toThrow(RangeError);
    expect(() => createRound({ low: 60, high: 128 }, 'bad')).toThrow(RangeError);
    expect(() => createRound({ low: 72, high: 60 }, 'bad')).toThrow(RangeError);
  });
});

// Covers ft_0_17.AC2: a wrong press says whether the key is higher or lower than the note shown.
describe('pressKey direction (ft_0_17.AC2)', () => {
  it('reports higher and lower for a wrong key', () => {
    const round = createRound({ low: 60, high: 72 }, 'dir');
    const up = pressKey(round, round.target + 2);
    const down = pressKey(round, round.target - 2);
    expect(up.verdict).toBe('wrong');
    expect(up.direction).toBe('higher');
    expect(down.direction).toBe('lower');
  });
});
