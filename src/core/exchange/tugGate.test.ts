// Covers ft_1_06.AC15 (practise, then show: the tug opens on practice evidence) and ft_1_21.AC13 (the cool-down after a lost tug).
import { describe, expect, it } from 'vitest';
import type { PlayResult } from '../curriculum/play';
import { DEFAULT_TUG_RULES } from './tug';
import { tugGate } from './tugGate';

const play = (score: number, i: number, mode: PlayResult['mode'] = 'wait', piece = 'puuvaim-1'): PlayResult =>
  ({ piece, day: '1998-11-20', at: 1000 + i, mode, tempoPercent: 100, hands: {}, score });
const base = { piece: 'puuvaim-1', level: 1 as const, rules: DEFAULT_TUG_RULES, lastPlays: 10, cleanPlaysSinceLost: 0, cooldownCleanPlays: 3 };

describe('the practice gate before a tug (ft_1_06.AC15)', () => {
  it('ft_1_06.AC15 under three plays of the piece in the level\'s mode it stays shut, saying how many plays are missing', () => {
    expect(tugGate({ ...base, plays: [play(100, 1), play(100, 2)] })).toEqual({ open: false, wait: { kind: 'plays', more: 1 } });
    expect(tugGate({ ...base, plays: [] })).toEqual({ open: false, wait: { kind: 'plays', more: 3 } });
  });

  it('ft_1_06.AC15 it opens when the median of the last plays reaches the level\'s share; below it, it says the level reached and the level needed', () => {
    expect(tugGate({ ...base, plays: [play(50, 1), play(70, 2), play(90, 3)] })).toEqual({ open: true });
    expect(tugGate({ ...base, plays: [play(50, 1), play(55, 2), play(90, 3)] })).toEqual({ open: false, wait: { kind: 'level', reached: 55, need: 60 } });
    // a median just under the share is said as it is, never as the share itself
    expect(tugGate({ ...base, plays: [play(59, 1), play(60, 2), play(10, 3), play(90, 4)] })).toEqual({ open: false, wait: { kind: 'level', reached: 59, need: 60 } });
  });

  it('ft_1_06.AC15 only the last plays count, and only those in the mode the level\'s show uses, of that piece', () => {
    const old = Array.from({ length: 10 }, (_, i) => play(10, i));
    const recent = Array.from({ length: 10 }, (_, i) => play(80, 20 + i));
    expect(tugGate({ ...base, plays: [...old, ...recent] })).toEqual({ open: true });
    const otherMode = [play(100, 1, 'tempo'), play(100, 2, 'tempo'), play(100, 3, 'tempo')];
    expect(tugGate({ ...base, plays: otherMode })).toEqual({ open: false, wait: { kind: 'plays', more: 3 } });
    expect(tugGate({ ...base, level: 2, plays: otherMode })).toEqual({ open: true });
    expect(tugGate({ ...base, plays: [play(100, 1, 'wait', 'other'), play(100, 2, 'wait', 'other'), play(100, 3, 'wait', 'other')] }).open).toBe(false);
  });
});

describe('the cool-down after a lost tug (ft_1_21.AC13)', () => {
  const ready = [play(90, 1), play(90, 2), play(90, 3)];

  it('ft_1_21.AC13 after a lost tug of this piece it waits for three clean plays since, saying how many are left', () => {
    const lost = { piece: 'puuvaim-1', at: '1998-11-20T10:00:00.000Z' };
    expect(tugGate({ ...base, plays: ready, lastLost: lost, cleanPlaysSinceLost: 1 })).toEqual({ open: false, wait: { kind: 'clean', more: 2 } });
    expect(tugGate({ ...base, plays: ready, lastLost: lost, cleanPlaysSinceLost: 3 })).toEqual({ open: true });
  });

  it('a lost tug of another piece does not hold this one back', () => {
    expect(tugGate({ ...base, plays: ready, lastLost: { piece: 'other', at: 'x' } })).toEqual({ open: true });
  });
});

describe('a tug waits for its piece to be learned (ft_1_32.AC15)', () => {
  const ready = [play(90, 1), play(90, 2), play(90, 3)];

  it('ft_1_32.AC15 a piece not learned bar by bar keeps the tug shut, saying so, before any other wait', () => {
    expect(tugGate({ ...base, plays: ready, learned: false })).toEqual({ open: false, wait: { kind: 'learn' } });
    expect(tugGate({ ...base, plays: [], learned: false })).toEqual({ open: false, wait: { kind: 'learn' } });
    expect(tugGate({ ...base, plays: ready, learned: true })).toEqual({ open: true });
  });
});
