// Covers ft_1_32.AC19, ft_1_32.AC20.
import { describe, expect, it } from 'vitest';
import { chartWith } from '../../../tests/helpers/charts';
import { sliceChart } from '../chart/section';
import { learnPlan, type LearnStep } from './plan';
import type { LearnRewards } from './progress';
import { prizeFocus, shownWithPiece } from './view';

/** 12 bars of 4/4, a right-hand quarter at the start of each bar and a whole left-hand note under bar 1. */
const piece = chartWith([
  ...Array.from({ length: 12 }, (_, bar) => ({ tick: bar * 1920, dur: 480, midi: 60 + (bar % 5) })),
  { tick: 0, dur: 1920, midi: 48, track: 'lh' },
]); // the left hand's note last, after bars it is not in: notes are not kept in time order

const stepOf = (kind: LearnStep['kind'], firstUnit: number, lastUnit: number): LearnStep => ({ kind, firstUnit, lastUnit, firstBar: firstUnit, lastBar: lastUnit, runs: 1 });

describe('shownWithPiece', () => {
  it('ft_1_32.AC20 the whole piece stays on the staff, the bars outside the run faint, the notes of the run first', () => {
    const step = stepOf('grow', 4, 5);
    const played = sliceChart(piece, 4, 5);
    const shown = shownWithPiece(piece, step);
    expect(shown.chart.bars).toHaveLength(12);
    expect(shown.faint).toEqual([{ from: 0, to: 3 }, { from: 6, to: 11 }]);
    // the judge's notes are the first notes of what is drawn, in the same order, so their indexes are the same
    expect(shown.chart.notes.slice(0, played.notes.length).map((n) => [n.tick - piece.bars[4]!.startTick, n.midi])).toEqual(played.notes.map((n) => [n.tick, n.midi]));
    expect(shown.chart.notes.slice(played.notes.length).every((n) => n.bar < 4 || n.bar > 5)).toBe(true);
    expect(shown.chart.notes).toHaveLength(piece.notes.length);
  });

  it('a run from the first bar to the last has nothing faint, and one from the first bar only the bars after it', () => {
    expect(shownWithPiece(piece, stepOf('whole', 0, 11)).faint).toEqual([]);
    expect(shownWithPiece(piece, stepOf('grow', 0, 0)).faint).toEqual([{ from: 1, to: 11 }]);
  });

  it('keeps a hand step\'s resting hand off the judge in the other bars too', () => {
    const shown = shownWithPiece(piece, { ...stepOf('grow', 0, 0), hand: 'RH' });
    expect(shown.chart.tracks.find((t) => t.id === 'lh')?.role).not.toBe('play');
  });
});

describe('prizeFocus', () => {
  const plan = learnPlan(piece);
  const none: LearnRewards = { chunks: [0, 1, 2].map(() => ({ quarters: [], units: 4, merged: null })), piece: null };

  it('ft_1_32.AC19 a growing step aims at its new bar, a confirmation play at its chunk, a join at its chunks and the whole run at the clef', () => {
    expect(prizeFocus(stepOf('grow', 0, 0), plan, none)).toEqual({ chunk: 0, bars: [0], chunks: [], clef: false });
    const two: LearnRewards = { ...none, chunks: [{ quarters: ['gold'], units: 4, merged: null }, ...none.chunks.slice(1)] };
    expect(prizeFocus(stepOf('grow', 0, 1), plan, two)).toEqual({ chunk: 0, bars: [1], chunks: [], clef: false });
    expect(prizeFocus(stepOf('grow', 4, 4), plan, none)).toEqual({ chunk: 1, bars: [0], chunks: [], clef: false });
    expect(prizeFocus(stepOf('confirm', 4, 7), plan, none)).toEqual({ chunk: 1, bars: [], chunks: [1], clef: false });
    expect(prizeFocus(stepOf('join', 0, 7), plan, none)).toEqual({ chunk: 1, bars: [], chunks: [0, 1], clef: false });
    expect(prizeFocus(plan.at(-1)!, plan, none)).toEqual({ chunk: 2, bars: [], chunks: [], clef: true });
  });

  it('a step played again over bars already secured (a recall, a hand step) aims at its last bar', () => {
    const all: LearnRewards = { ...none, chunks: [{ quarters: ['gold', 'gold'], units: 4, merged: null }, ...none.chunks.slice(1)] };
    expect(prizeFocus(stepOf('grow', 0, 1), plan, all).bars).toEqual([1]);
  });

  it('a piece of one chunk aims at its chunk and its clef on its last confirmation play', () => {
    const short = chartWith(Array.from({ length: 4 }, (_, bar) => ({ tick: bar * 1920, dur: 480, midi: 60 })));
    const shortPlan = learnPlan(short);
    expect(prizeFocus(shortPlan.at(-1)!, shortPlan, { chunks: [{ quarters: [], units: 4, merged: null }], piece: null })).toMatchObject({ chunks: [0], clef: true });
  });
});
