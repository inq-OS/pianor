import type { Attempt } from './profile';

/** One full play of a piece on the stats graph (docs/features/core_04-piece-stats.md). */
export interface HistoryPoint {
  /** When the play was finished (ISO 8601). */
  at: string;
  /** Share of notes right the first time, 0 to 1. */
  accuracy: number;
  /** Wrong key presses in the play. */
  mistakes: number;
  mode: 'wait' | 'tempo';
}

/**
 * The full plays of one piece, oldest first, as graph points. The attempt log holds full plays only, so section plays
 * never appear here (core_04). Ties on the same instant keep the order of the log.
 */
export function pieceHistory(attempts: readonly Attempt[], pieceId: string): HistoryPoint[] {
  return attempts
    .map((attempt, index) => ({ attempt, index }))
    .filter(({ attempt }) => attempt.pieceId === pieceId)
    .sort((a, b) => (a.attempt.at < b.attempt.at ? -1 : a.attempt.at > b.attempt.at ? 1 : a.index - b.index))
    .map(({ attempt }) => ({ at: attempt.at, accuracy: attempt.result.accuracy, mistakes: attempt.result.mistakes, mode: attempt.play.mode }));
}
