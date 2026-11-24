// Covers ft_1_32.AC19, ft_1_32.AC20.
import { describe, expect, it } from 'vitest';
import { chartWith } from '../../../tests/helpers/charts';
import { sliceChart } from '../chart/section';
import { learnPlan, type LearnStep } from './plan';
import type { LearnRewards } from './progress';
import { prizeFocus, shownWithChunk } from './view';

/** 12 bars of 4/4, a right-hand quarter at the start of each bar and a whole left-hand note under bar 1. */
const piece = chartWith([
  ...Array.from({ length: 12 }, (_, bar) => ({ tick: bar * 1920, dur: 480, midi: 60 + (bar % 5) })),
  { tick: 0, dur: 1920, midi: 48, track: 'lh' },
]); // the left hand's note last, after bars it is not in: notes are not kept in time order

const stepOf = (kind: LearnStep['kind'], firstUnit: number, lastUnit: number): LearnStep => ({ kind, firstUnit, lastUnit, firstBar: firstUnit, lastBar: lastUnit, runs: 1 });

describe('shownWithChunk', () => {
  it('ft_1_32.AC20 the rest of the chunk is drawn after the bars of the step, its notes after those of the step', () => {
    const step = stepOf('grow', 0, 0);
    const played = sliceChart(piece, 0, 0);
    const shown = shownWithChunk(piece, step);
    expect(shown.chart.bars).toHaveLength(4);
    expect(shown.faintFrom).toBe(1);
    // the judge's notes are the first notes of what is drawn, in the same order, so their indexes are the same
    expect(shown.chart.notes.slice(0, played.notes.length).map((n) => [n.tick, n.midi])).toEqual(played.notes.map((n) => [n.tick, n.midi]));
    expect(shown.chart.notes.slice(played.notes.length).every((n) => n.bar >= 1)).toBe(true);
  });

  it('draws nothing more when the step ends its chunk, or in the second chunk past its own end', () => {
    expect(shownWithChunk(piece, stepOf('confirm', 0, 3)).faintFrom).toBeNull();
    const second = shownWithChunk(piece, stepOf('grow', 4, 5));
    expect(second.chart.bars).toHaveLength(4);
    expect(second.faintFrom).toBe(2);
  });

  it('keeps a hand step\'s resting hand off the judge in the bars after it too', () => {
    const shown = shownWithChunk(piece, { ...stepOf('grow', 0, 0), hand: 'RH' });
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
