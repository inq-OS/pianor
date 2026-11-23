// Covers ft_1_32.AC13, ft_1_32.AC14.
import { describe, expect, it } from 'vitest';
import { chartWith } from '../../../tests/helpers/charts';
import { learnPlan } from './plan';
import { DEFAULT_LEARN_SETTINGS, START_PROGRESS } from './progress';
import { learnsOnOpen, pieceLearned } from './route';

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
});
