import type { Chart } from '../chart';
import { learnPlan } from './plan';
import { isLearned, learnHandsApart, learnStepBars, type LearnProgress, type LearnSettings } from './progress';

/**
 * Where a play of a piece comes from (ft_1_32 rules 14 and 15): the piano, which is a sandbox, or Kiur asked to teach the
 * piece bar by bar.
 */
export type PlayRoute = 'piano' | 'kiur';

/**
 * Whether a piece opens in learning bar by bar. The piano plays any piece in full with no gate, except a piece that must be
 * learned (a character's piece); a piece Kiur is asked to teach is always learned. Pure.
 */
export function learnsOnOpen(play: { readonly route: PlayRoute; readonly mustLearn: boolean }): boolean {
  return play.route === 'kiur' || play.mustLearn;
}

/**
 * Whether the player has learned `piece`: every step of its plan done (`isLearned`). Free plays of the piece never count,
 * so a tug (which needs a learned piece) is earned by learning it. A piece with nothing to play has nothing to learn.
 */
export function pieceLearned(piece: Chart, kept: LearnProgress, settings: LearnSettings): boolean {
  const plan = learnPlan(piece, learnStepBars(kept, settings), learnHandsApart(kept, settings));
  return plan.length === 0 || isLearned(plan, kept);
}
