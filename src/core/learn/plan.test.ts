// Covers ft_1_32.AC1.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { chartWith } from '../../../tests/helpers/charts';
import type { Chart } from '../chart';
import { learnPlan, learnUnits, type LearnStep } from './plan';

/** A chart of `bars` 4/4 bars with one quarter note at the start of each bar listed in `played` (default every bar). */
function piece(bars: number, played?: readonly number[]): Chart {
  const with_ = played ?? Array.from({ length: bars }, (_, i) => i);
  const notes = with_.map((bar) => ({ tick: bar * 1920, dur: 480, midi: 60 + (bar % 7) }));
  // the last bar must exist even when it is empty: a long accompaniment note keeps it in the chart
  notes.push({ tick: (bars - 1) * 1920, dur: 1920, midi: 48, track: 'bk' } as (typeof notes)[number]);
  return chartWith(notes);
}

/** Steps as "first-last" in printed bars (1-based), whole steps with their runs. */
const show = (steps: readonly LearnStep[]) => steps.map((s) => `${s.kind}:${s.firstBar + 1}-${s.lastBar + 1}${s.runs > 1 ? `x${s.runs}` : ''}`);

describe('learnUnits', () => {
  it('is one unit per bar', () => {
    expect(learnUnits(piece(3))).toEqual([{ first: 0, last: 0 }, { first: 1, last: 1 }, { first: 2, last: 2 }]);
  });

  it('puts a pick-up with the first full bar', () => {
    const chart = piece(3);
    const pickup: Chart = { ...chart, bars: [{ index: 0, startTick: 0, endTick: 480 }, { index: 1, startTick: 480, endTick: 2400 }, { index: 2, startTick: 2400, endTick: 4320 }] };
    expect(learnUnits(pickup)).toEqual([{ first: 0, last: 1 }, { first: 2, last: 2 }]);
  });
});

describe('learnPlan', () => {
  it('grows bar by bar inside chunks of four, confirms each chunk, then plays the whole piece', () => {
    expect(show(learnPlan(piece(8)))).toEqual([
      'grow:1-1', 'grow:1-2', 'grow:1-3', 'grow:1-4', 'confirm:1-4',
      'grow:5-5', 'grow:5-6', 'grow:5-7', 'grow:5-8', 'confirm:5-8',
      'whole:1-8',
    ]);
  });

  it('joins chunks by doubling on longer pieces, right after the confirmation play of each pair', () => {
    expect(show(learnPlan(piece(16))).filter((s) => !s.startsWith('grow'))).toEqual([
      'confirm:1-4', 'confirm:5-8', 'join:1-8', 'confirm:9-12', 'confirm:13-16', 'join:9-16', 'whole:1-16',
    ]);
    expect(show(learnPlan(piece(32))).filter((s) => s.startsWith('join'))).toEqual(['join:1-8', 'join:9-16', 'join:1-16', 'join:17-24', 'join:25-32', 'join:17-32']);
  });

  it('never joins a pair that is the whole piece', () => {
    expect(show(learnPlan(piece(8))).some((s) => s.startsWith('join'))).toBe(false);
    expect(show(learnPlan(piece(12))).filter((s) => !s.startsWith('grow'))).toEqual(['confirm:1-4', 'confirm:5-8', 'join:1-8', 'confirm:9-12', 'whole:1-12']);
  });

  it('ends on a shorter chunk', () => {
    expect(show(learnPlan(piece(6)))).toEqual(['grow:1-1', 'grow:1-2', 'grow:1-3', 'grow:1-4', 'confirm:1-4', 'grow:5-5', 'grow:5-6', 'confirm:5-6', 'whole:1-6']);
  });

  it('a piece of one chunk ends on its confirmation play, which is the whole piece', () => {
    expect(show(learnPlan(piece(4)))).toEqual(['grow:1-1', 'grow:1-2', 'grow:1-3', 'grow:1-4', 'confirm:1-4']);
    expect(show(learnPlan(piece(1)))).toEqual(['grow:1-1', 'confirm:1-1']);
  });

  it('adds two bars a step when the step size is 2', () => {
    expect(show(learnPlan(piece(8), 2))).toEqual(['grow:1-2', 'grow:1-4', 'confirm:1-4', 'grow:5-6', 'grow:5-8', 'confirm:5-8', 'whole:1-8']);
    expect(show(learnPlan(piece(5), 2)).slice(3)).toEqual(['grow:5-5', 'confirm:5-5', 'whole:1-5']);
  });

  it('skips a step that adds only bars with nothing to play', () => {
    expect(show(learnPlan(piece(8, [0, 2, 3, 4, 5, 6, 7]))).slice(0, 4)).toEqual(['grow:1-1', 'grow:1-3', 'grow:1-4', 'confirm:1-4']);
    // an empty first bar is learned with the bar after it
    expect(show(learnPlan(piece(4, [1, 2, 3])))).toEqual(['grow:1-2', 'grow:1-3', 'grow:1-4', 'confirm:1-4']);
    // empty last bars come with the confirmation play
    expect(show(learnPlan(piece(4, [0, 1])))).toEqual(['grow:1-1', 'grow:1-2', 'confirm:1-4']);
  });

  it('never plays a chunk with nothing to play on its own (a run that could not end)', () => {
    const lateStart = show(learnPlan(piece(16, [8, 9, 10, 11, 12, 13, 14, 15])));
    expect(lateStart.filter((s) => !s.startsWith('grow'))).toEqual(['confirm:9-12', 'confirm:13-16', 'join:9-16', 'whole:1-16']);
  });

  it('has no step for a piece with nothing to play', () => {
    expect(learnPlan(piece(4, []))).toEqual([]);
  });

  it('counts printed bars from the full bar after a pick-up', () => {
    const chart = piece(5);
    const pickup: Chart = { ...chart, bars: [{ index: 0, startTick: 0, endTick: 480 }, ...chart.bars.slice(1)] };
    const steps = learnPlan(pickup);
    expect(steps[0]).toMatchObject({ kind: 'grow', firstBar: 0, lastBar: 1, firstUnit: 0, lastUnit: 0 });
    expect(steps.at(-1)).toMatchObject({ kind: 'confirm', firstBar: 0, lastBar: 4 });
  });

  it('property: every plan ends on the whole piece, every chunk is confirmed, and every grow step starts its chunk and grows', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 40 }), fc.constantFrom(1 as const, 2 as const), (bars, size) => {
      const steps = learnPlan(piece(bars), size);
      expect(steps.at(-1)).toMatchObject({ kind: bars > 4 ? 'whole' : 'confirm', firstBar: 0, lastBar: bars - 1 });
      expect(steps.filter((s) => s.kind === 'confirm')).toHaveLength(Math.ceil(bars / 4));
      for (const [i, s] of steps.entries()) {
        if (s.kind !== 'grow') continue;
        expect(s.firstUnit % 4).toBe(0);
        const before = steps[i - 1];
        if (before?.kind === 'grow' && before.firstUnit === s.firstUnit) expect(s.lastUnit).toBeGreaterThan(before.lastUnit);
      }
    }));
  });
});
