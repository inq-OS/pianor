import type { StatsConfig } from './config';
import type { Attempt } from './profile';

/**
 * What a player's history says about one piece (docs/features/core_04-piece-stats.md). All of it is folded from the log of
 * attempts, never stored, so changing what counts as "played well" re-reads the whole history.
 */
export interface PieceStats {
  /** Finished plays of the piece, ever. */
  plays: number;
  /** Plays in the window (the last `window`): what the other numbers are about. */
  windowPlays: number;
  /** Plays in the window that were played well. */
  goodPlays: number;
  /** Mean share of notes right the first time over the window, 0 to 1; null with no plays. */
  accuracy: number | null;
  /** Mean timing score (0 to 100) over the Tempo-mode plays in the window; null with none. */
  timing: number | null;
  /** The highest tempo percent a Tempo-mode play was played well at, ever (above 100 is faster than written); null with none. */
  speed: number | null;
  /** Share of the window played well, 0 to 100: 15 of the last 60 is 25. It can go down: it measures keeping a piece. */
  proficiency: number;
}

/** A play is played well with enough notes right first time, no hint (unless allowed) and, in Tempo mode, good enough timing. */
export function playedWell(attempt: Attempt, config: StatsConfig): boolean {
  if (attempt.result.accuracy < config.goodAccuracy) return false;
  if (!config.allowHints && attempt.result.hints.noteNames + attempt.result.hints.fingers > 0) return false;
  if (attempt.play.mode === 'tempo' && (attempt.result.timing?.score ?? 0) < config.goodTimingScore) return false;
  return true;
}

const mean = (values: readonly number[]): number | null => (values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length);

export function pieceStats(attempts: readonly Attempt[], pieceId: string, config: StatsConfig): PieceStats {
  const all = attempts.filter((a) => a.pieceId === pieceId);
  const recent = all.slice(-config.window);
  const goodPlays = recent.filter((a) => playedWell(a, config)).length;
  const tempoSpeeds = all.filter((a) => a.play.mode === 'tempo' && playedWell(a, config)).map((a) => a.play.tempoPercent);
  return {
    plays: all.length,
    windowPlays: recent.length,
    goodPlays,
    accuracy: mean(recent.map((a) => a.result.accuracy)),
    timing: mean(recent.flatMap((a) => (a.play.mode === 'tempo' && a.result.timing ? [a.result.timing.score] : []))),
    speed: tempoSpeeds.length === 0 ? null : Math.max(...tempoSpeeds),
    proficiency: recent.length === 0 ? 0 : Math.round((100 * goodPlays) / recent.length),
  };
}

/** The tempo percent a piece starts at: where the player last played it (100 for a piece not played yet). */
export function startPercent(attempts: readonly Attempt[], pieceId: string): number {
  for (let i = attempts.length - 1; i >= 0; i--) if (attempts[i]!.pieceId === pieceId) return attempts[i]!.play.tempoPercent;
  return 100;
}
