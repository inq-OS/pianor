import type { PlayStats } from '../judge/types';

/** Largest bonus for playing both hands together: +50%. */
export const BOTH_HANDS_MAX_BONUS = 0.5;

/**
 * XP multiplier for playing both hands at the same time:
 * 1 + maxBonus x (notes played together first try) / (notes played). It only ever adds: a piece with no two-hand steps,
 * or none played together, gives 1, and nothing is ever taken away. It does not change stars.
 */
export function bothHandsMultiplier(
  stats: Pick<PlayStats, 'notes' | 'bothHands'>,
  maxBonus: number = BOTH_HANDS_MAX_BONUS,
): number {
  if (stats.notes <= 0) return 1;
  const share = Math.min(1, Math.max(0, stats.bothHands.together / stats.notes));
  return 1 + Math.max(0, maxBonus) * share;
}
