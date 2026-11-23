import { describe, expect, it } from 'vitest';
import type { Difficulty } from '../piece/difficulty';
import { MEASURED_RULES, measuredDifficulty } from './measuredDifficulty';
import type { BarPlay } from './practiceLog';

/** synthetic: a prior of `n` bars, bar i scoring `scores[i]`, its hardest bars `hardest`. */
function prior(scores: number[], hardest: number[] = []): Difficulty {
  return {
    scale: 1, points: 1, score: 1, parts: {} as Difficulty['parts'], hardest, piece: {} as Difficulty['piece'],
    bars: scores.map((score, index) => ({ index, printed: index + 1, score, parts: {} as Difficulty['parts'], features: {} as Difficulty['bars'][number]['features'] })),
  };
}

let clock = 0;
/** synthetic: one play of `bar` with `right` of `notes` right the first time. */
const play = (bar: number, right: number, notes = 4, pieceId = 'p'): BarPlay => ({
  at: new Date(Date.UTC(2000, 0, 1) + clock++ * 60_000).toISOString(), pieceId, bar, notes, firstTry: right, timing: null, mode: 'wait', tempoPercent: 100, section: null, misses: [],
});
const times = (n: number, make: () => BarPlay) => Array.from({ length: n }, make);

describe('measured difficulty from the practice log (core_08.AC13)', () => {
  it('core_08.AC13 a bar played less cleanly than the piece\'s mean is measured harder, whatever its notes say', () => {
    const plays = [...times(5, () => play(0, 4)), ...times(5, () => play(1, 2)), ...times(5, () => play(2, 4))];
    const m = measuredDifficulty(plays, 'p', prior([5, 1, 5]));
    expect(m.measured).toBe(true);
    expect(m.bars.map((b) => b.share)).toEqual([1, 0.5, 1]);
    expect(m.mean).toBeCloseTo(5 / 6);
    expect(m.bars[1]!.gap).toBeCloseTo(1 / 3);
    expect(m.bars[0]!.gap).toBeCloseTo(-1 / 6);
    expect(m.hardest).toEqual([1]);
  });

  it('core_08.AC13 reads only the latest plays of each bar, counted by notes, and only of that piece', () => {
    const plays = [...times(20, () => play(0, 0)), ...times(MEASURED_RULES.window, () => play(0, 4)), play(0, 0, 4, 'other'), ...times(3, () => play(1, 1, 2))];
    const m = measuredDifficulty(plays, 'p', prior([1, 1]));
    expect(m.bars[0]).toMatchObject({ plays: MEASURED_RULES.window, share: 1 });
    expect(m.bars[1]).toMatchObject({ plays: 3, share: 0.5 });
  });

  it('core_08.AC13 a bar with too few plays falls back to the prior: no share, no gap, its notes\' score kept', () => {
    const plays = [...times(3, () => play(0, 4)), ...times(3, () => play(1, 2)), ...times(MEASURED_RULES.minPlays - 1, () => play(2, 0))];
    const m = measuredDifficulty(plays, 'p', prior([1, 2, 9]));
    expect(m.bars[2]).toEqual({ bar: 2, plays: MEASURED_RULES.minPlays - 1, share: null, gap: null, prior: 9 });
    expect(m.mean).toBeCloseTo(0.75);
  });

  it('core_08.AC13 with fewer than two bars measured the piece is not measured, and its hardest bars are the prior\'s', () => {
    const m = measuredDifficulty(times(5, () => play(0, 1)), 'p', prior([1, 7, 2], [1]));
    expect(m.measured).toBe(false);
    expect(m.mean).toBeNull();
    expect(m.bars.every((b) => b.gap === null)).toBe(true);
    expect(m.hardest).toEqual([1]);
  });

  it('core_08.AC13 names at most three hardest bars, each clearly below the mean, in bar order; bars with nothing to play are left out', () => {
    const plays = [
      ...[0, 1, 2, 3, 4, 5].flatMap((bar) => times(4, () => play(bar, 4))),
      ...[6, 7, 8, 9].flatMap((bar) => times(4, () => play(bar, bar === 9 ? 3 : 1))),
      ...times(4, () => play(10, 0, 0)),
    ];
    const m = measuredDifficulty(plays, 'p', prior(Array(11).fill(1)));
    expect(m.hardest).toEqual([6, 7, 8]);
    expect(m.bars[10]).toMatchObject({ plays: 0, share: null });
  });
});
