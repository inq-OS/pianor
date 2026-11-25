// Covers ft_1_32.AC13, ft_1_32.AC14, ft_1_32.AC21, ft_1_32.AC24.
import { describe, expect, it } from 'vitest';
import { chartWith } from '../../../tests/helpers/charts';
import { learnPlan } from './plan';
import { DEFAULT_LEARN_SETTINGS, relearn, START_PROGRESS } from './progress';
import { learnsOnOpen, pieceClef, pieceLearned } from './route';

const bars = (n: number) => chartWith(Array.from({ length: n }, (_, bar) => ({ tick: bar * 1920, dur: 480, midi: 60 + bar })));

describe('where a piece is learned bar by bar', () => {
  it('ft_1_32.AC13 the piano plays any piece in full, and a piece of a character is learned first', () => {
    expect(learnsOnOpen({ route: 'piano', mustLearn: false })).toBe(false);
    expect(learnsOnOpen({ route: 'piano', mustLearn: true })).toBe(true);
  });

  it('ft_1_32.AC13 a piece Kiur is asked to teach is always learned bar by bar', () => {
    expect(learnsOnOpen({ route: 'kiur', mustLearn: false })).toBe(true);
    expect(learnsOnOpen({ route: 'kiur', mustLearn: true })).toBe(true);
  });

  it('ft_1_32.AC14 a piece is learned for the tug only once its whole plan is done, never from free plays', () => {
    const piece = bars(4);
    const plan = learnPlan(piece, 1, true);
    expect(pieceLearned(piece, START_PROGRESS, DEFAULT_LEARN_SETTINGS)).toBe(false);
    expect(pieceLearned(piece, { ...START_PROGRESS, step: plan.length - 1, lastDay: '1998-11-22', handsApart: true, stepBars: 1 }, DEFAULT_LEARN_SETTINGS)).toBe(false);
    expect(pieceLearned(piece, { ...START_PROGRESS, step: plan.length, lastDay: '1998-11-22', handsApart: true, stepBars: 1 }, DEFAULT_LEARN_SETTINGS)).toBe(true);
  });

  it('ft_1_32.AC21 the book\'s clef is empty before the piece is learned, and in the medal it was learned with', () => {
    const piece = bars(4);
    const plan = learnPlan(piece);
    expect(pieceClef(piece, START_PROGRESS, DEFAULT_LEARN_SETTINGS, [])).toBeNull();
    const learned = { ...START_PROGRESS, step: plan.length, lastDay: '1998-11-22', stepBars: 1 as const, medals: plan.map(() => 'silver' as const) };
    expect(pieceClef(piece, learned, DEFAULT_LEARN_SETTINGS, [])).toBe('silver');
  });

  it('ft_1_32.AC24 a piece learned again stays learned for the tug, its clef never lower than before', () => {
    const piece = bars(4);
    const plan = learnPlan(piece);
    const learned = { ...START_PROGRESS, step: plan.length, lastDay: '1998-11-22', stepBars: 1 as const, medals: plan.map(() => 'silver' as const), learnedAt: '1998-11-22T10:00:00.000Z' };
    const again = relearn(learned, 'silver', DEFAULT_LEARN_SETTINGS, '1998-11-23');
    expect(pieceLearned(piece, again, DEFAULT_LEARN_SETTINGS)).toBe(true);
    expect(pieceClef(piece, again, DEFAULT_LEARN_SETTINGS, [])).toBe('silver');
    // learned again with a lower medal: the clef stays at the better one; with a higher one it rises
    expect(pieceClef(piece, { ...again, step: plan.length, medals: plan.map(() => 'bronze' as const) }, DEFAULT_LEARN_SETTINGS, [])).toBe('silver');
    expect(pieceClef(piece, { ...again, step: plan.length, medals: plan.map(() => 'gold' as const) }, DEFAULT_LEARN_SETTINGS, [])).toBe('gold');
  });
});
