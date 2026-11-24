import type { Chart } from '../chart';
import { learnPlan } from './plan';
import type { BarPlay } from '../progression/practiceLog';
import { goldenBars, isLearned, learnHandsApart, learnRewards, learnStepBars, type LearnProgress, type LearnSettings, type Medal } from './progress';

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

/**
 * The clef prize of `piece` for the piece book (ft_1_32.AC21): its medal once the piece is learned (raised to gold by three
 * perfect plays of every bar since, from `practice`), null before.
 */
export function pieceClef(piece: Chart, kept: LearnProgress, settings: LearnSettings, practice: readonly BarPlay[]): Medal | null {
  const plan = learnPlan(piece, learnStepBars(kept, settings), learnHandsApart(kept, settings));
  return learnRewards(plan, kept, piece, goldenBars(practice, piece.id, kept.learnedAt ?? null)).piece;
}
