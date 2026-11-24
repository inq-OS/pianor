/**
 * Whether a tug may open now (ft_1_21.AC19, ft_1_21.AC13; WP-13): practise, then show. The piece's level as core_12
 * measures it (the median score of its last plays in the room, d139), counted in the mode the level's show uses, must
 * reach the level's share, with at least three plays; and after a lost tug of that piece the student first plays it clean
 * three more times. When it stays shut, `wait` says what practice it waits for, from the plays (AX-2.1), so the character
 * can say it. Before all that the piece must be learned bar by bar (ft_1_32.AC15). Pure.
 */
import type { PieceId } from '../contracts';
import { scoreStats, selectPlays } from '../curriculum/evaluate';
import type { PlayResult } from '../curriculum/play';
import type { TugRules } from './tug';

/** Fewer plays than this never open the gate (ft_1_21.AC19). */
export const GATE_MIN_PLAYS = 3;

export type TugWait =
  | { readonly kind: 'learn' }
  | { readonly kind: 'plays'; readonly more: number }
  | { readonly kind: 'level'; readonly reached: number; readonly need: number }
  | { readonly kind: 'clean'; readonly more: number };

export type TugGate = { readonly open: true } | { readonly open: false; readonly wait: TugWait };

export interface TugGateInput {
  /** The student's room plays (`playResultsFromLog`); other pieces' are left out here. */
  readonly plays: readonly PlayResult[];
  readonly piece: PieceId;
  readonly level: 1 | 2 | 3;
  readonly rules: Pick<TugRules, 'levels'>;
  /** How many of the last plays make the level (core_12's `lastPlays`, 10). */
  readonly lastPlays: number;
  /** The character's last lost tug (`MetRecord.lastLostTug`), if any. */
  readonly lastLost?: { readonly piece: PieceId; readonly at: string };
  /** Clean plays of the piece since that loss (`cleanPlaysSince`). */
  readonly cleanPlaysSinceLost: number;
  /** The character's `meet.cooldownCleanPlays` (3). */
  readonly cooldownCleanPlays: number;
  /**
   * Whether the student has learned the piece bar by bar (ft_1_32, `isLearned`): a tug is only for a learned piece
   * (ft_1_32.AC15). Absent: not asked.
   */
  readonly learned?: boolean;
}

export function tugGate(input: TugGateInput): TugGate {
  if (input.learned === false) return { open: false, wait: { kind: 'learn' } };
  if (input.lastLost?.piece === input.piece && input.cleanPlaysSinceLost < input.cooldownCleanPlays) {
    return { open: false, wait: { kind: 'clean', more: input.cooldownCleanPlays - input.cleanPlaysSinceLost } };
  }
  const { share, mode } = input.rules.levels[input.level - 1]!;
  const plays = selectPlays(input.plays, input.piece, { mode, lastPlays: input.lastPlays });
  if (plays.length < GATE_MIN_PLAYS) return { open: false, wait: { kind: 'plays', more: GATE_MIN_PLAYS - plays.length } };
  const reached = scoreStats(plays.map((p) => p.score)).median!;
  const need = Math.round(share * 100);
  // the level said is never rounded up to the one it waits for
  return reached >= need ? { open: true } : { open: false, wait: { kind: 'level', reached: Math.floor(reached), need } };
}
