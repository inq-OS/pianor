// Covers ft_0_17.AC2 (a wrong press costs a life and gives a reason), ft_0_17.AC3 (three lives; the third loss ends the round; XP kept).
import { describe, expect, it } from 'vitest';
import { Random } from '../random';
import { NOTE_TRAINER_CHORD_WINDOW_MS, NOTE_TRAINER_LIVES, NOTE_TRAINER_XP_PER_NOTE, createRound, pickTarget, pressKey } from './noteTrainer';

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

// Covers ft_0_17.AC8: keys pressed together (a slipped finger, a chord) are one press.
describe('a slipped chord is one press (ft_0_17.AC8)', () => {
  const wrongOf = (target: number) => (target === 60 ? 61 : 60);

  it('ft_0_17.AC8: a right key with a wrong one at the same moment is a right press, with no life lost', () => {
    const round = createRound(RANGE, 'chord-1');
    const first = pressKey(round, wrongOf(round.target), 1000);
    expect(first.verdict).toBe('wrong');
    const second = pressKey(first.round, round.target, 1000 + NOTE_TRAINER_CHORD_WINDOW_MS);
    expect(second.verdict).toBe('correct');
    expect(second.round.lives).toBe(3);
    expect(second.round.xp).toBe(NOTE_TRAINER_XP_PER_NOTE);
    expect(second.earned).toBe(NOTE_TRAINER_XP_PER_NOTE);
    expect(second.round.found).toBe(1);
  });

  it('ft_0_17.AC8: two wrong keys together cost one life', () => {
    const round = createRound({ low: 60, high: 60 }, 'chord-2');
    const first = pressKey(round, 62, 500);
    const second = pressKey(first.round, 64, 510);
    expect(second.verdict).toBe('joined');
    expect(second.round.lives).toBe(2);
  });

  it('ft_0_17.AC8: a key with a right one is not judged again', () => {
    const round = createRound(RANGE, 'chord-3');
    const first = pressKey(round, round.target, 0);
    const second = pressKey(first.round, wrongOf(first.round.target), 20);
    expect(second.verdict).toBe('joined');
    expect(second.round).toEqual(first.round);
  });

  it('ft_0_17.AC8: a key after the window is a press of its own', () => {
    const round = createRound({ low: 60, high: 60 }, 'chord-4');
    const first = pressKey(round, 62, 0);
    const second = pressKey(first.round, 64, NOTE_TRAINER_CHORD_WINDOW_MS + 1);
    expect(second.verdict).toBe('wrong');
    expect(second.round.lives).toBe(1);
  });

  it('ft_0_17.AC8: the right key slipped with the last life\'s wrong one keeps the round going', () => {
    let round = createRound({ low: 60, high: 61 }, 'chord-5');
    round = pressKey(round, 70, 0).round;
    round = pressKey(round, 70, 1000).round;
    const last = pressKey(round, 70, 2000);
    expect(last.round.over).toBe(true);
    const saved = pressKey(last.round, round.target, 2010);
    expect(saved.verdict).toBe('correct');
    expect(saved.round.over).toBe(false);
    expect(saved.round.lives).toBe(1);
  });

  it('ft_0_17.AC8: presses without a time are never joined', () => {
    const round = createRound({ low: 60, high: 60 }, 'chord-6');
    const first = pressKey(round, 62);
    expect(pressKey(first.round, 64).verdict).toBe('wrong');
  });
});

// Covers ft_0_17.AC9: a right press after the name was shown earns no XP (AX-1), but the note counts as found.
describe('a named note earns no XP (ft_0_17.AC9)', () => {
  it('ft_0_17.AC9: a right press after a wrong one moves on with 0 XP', () => {
    const round = createRound(RANGE, 'named-1');
    const wrong = pressKey(round, round.target + 12, 0);
    expect(wrong.round.named).toBe(true);
    const right = pressKey(wrong.round, round.target, 1000);
    expect(right.verdict).toBe('correct');
    expect(right.earned).toBe(0);
    expect(right.round.xp).toBe(0);
    expect(right.round.found).toBe(1);
    expect(right.round.named).toBe(false);
    expect(right.round.target).not.toBe(round.target);
  });

  it('ft_0_17.AC9: the next note, read without help, earns XP again', () => {
    let round = createRound(RANGE, 'named-2');
    round = pressKey(round, round.target + 12, 0).round;
    round = pressKey(round, round.target, 1000).round;
    const next = pressKey(round, round.target, 2000);
    expect(next.earned).toBe(NOTE_TRAINER_XP_PER_NOTE);
    expect(next.round.xp).toBe(NOTE_TRAINER_XP_PER_NOTE);
    expect(next.round.found).toBe(2);
  });
});

// Covers ft_0_17.AC10: a step can ask white keys only.
describe('white keys only (ft_0_17.AC10)', () => {
  const WHITE = [0, 2, 4, 5, 7, 9, 11];

  it('ft_0_17.AC10: a white-key step never asks a black key', () => {
    const range = { low: 60, high: 72, whiteKeys: true };
    const random = new Random('white');
    let previous: number | null = null;
    const seen = new Set<number>();
    for (let i = 0; i < 300; i++) {
      const key = pickTarget(random, range, previous);
      expect(WHITE).toContain(key % 12);
      expect(key).not.toBe(previous);
      seen.add(key);
      previous = key;
    }
    expect(seen.size).toBe(8);
  });

  it('ft_0_17.AC10: a white-key round starts on a white key', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      expect(WHITE).toContain(createRound({ low: 60, high: 67, whiteKeys: true }, seed).target % 12);
    }
  });

  it('ft_0_17.AC10: a white-key range with no white key is rejected', () => {
    expect(() => createRound({ low: 61, high: 61, whiteKeys: true }, 'x')).toThrow(RangeError);
  });
});
