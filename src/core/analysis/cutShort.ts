import type { BarPlay } from '../progression/practiceLog';

/**
 * Notes let go too early (core_01 slice f3, d093): the sum of `short` over the bar plays that have it. Pure.
 * null when no play has the field (Wait mode, or Tempo without hold grading), so the screen can say nothing about it.
 */
export function notesCutShort(plays: readonly BarPlay[]): number | null {
  let total: number | null = null;
  for (const play of plays) {
    if (play.short === undefined) continue;
    total = (total ?? 0) + play.short;
  }
  return total;
}
