import type { PieceResult } from '../judge/types';
import { bothHandsMultiplier } from '../scoring/handsBonus';
import { starsFor, type Stars } from '../scoring/stars';
import type { ProgressionConfig } from './config';
import { factorFor, type HelpId, type ModifierTable } from './modifiers';

/** What happened before this attempt for this piece. */
export interface PieceHistory {
  completions: number;
  /** Best stars so far, 0 when never finished. */
  bestStars: 0 | Stars;
}

export type XpKind = 'first' | 'improved' | 'replay';

export interface XpBreakdown {
  kind: XpKind;
  /** XP for finishing. */
  completion: number;
  /** XP for accuracy. */
  accuracy: number;
  /** First-time bonus or improvement bonus (0 for a plain replay). */
  bonus: number;
  /** 1, or the replay factor for a repeat that did not improve. */
  replayFactor: number;
  /** 1 minus the hint discount, never below 0.5. */
  hintFactor: number;
  /** 1 plus the two-hands bonus. */
  bothHandsMultiplier: number;
  /** XP awarded: always at least 1 for finishing, never negative. */
  total: number;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * XP for finishing a piece. Pure and deterministic.
 * - First time: completion + accuracy + first-time bonus. Better stars than before: completion + accuracy + a bonus per extra star.
 *   Otherwise (a plain repeat): the base reduced by the replay factor, so grinding one piece pays little.
 * - Hints cost reward in proportion to how many notes were played with them, never more than half of it.
 * - Playing both hands together multiplies the reward (up to +50%).
 * - There is no way to lose XP, and finishing always earns at least 1.
 */
export function computeXp(result: PieceResult, previous: PieceHistory, config: ProgressionConfig): XpBreakdown {
  const stars = starsFor(result.accuracy);
  const completion = config.xp.completion;
  const accuracy = Math.round(config.xp.accuracy * clamp01(result.accuracy));

  const kind: XpKind = previous.completions === 0 ? 'first' : stars > previous.bestStars ? 'improved' : 'replay';
  const bonus =
    kind === 'first' ? config.xp.firstTimeBonus : kind === 'improved' ? config.xp.improvementPerStar * (stars - previous.bestStars) : 0;
  const replayFactor = kind === 'replay' ? config.xp.replayFactor : 1;

  const notes = Math.max(1, result.notes);
  const hintDiscount =
    config.xp.hintDiscount.noteNames * clamp01(result.hints.noteNames / notes) + config.xp.hintDiscount.fingers * clamp01(result.hints.fingers / notes);
  const hintFactor = Math.max(0.5, 1 - hintDiscount);

  const multiplier = bothHandsMultiplier(result, config.xp.bothHandsMaxBonus);
  const total = Math.max(1, Math.round((completion + accuracy) * replayFactor * hintFactor * multiplier + bonus * hintFactor * multiplier));
  return { kind, completion, accuracy, bonus, replayFactor, hintFactor, bothHandsMultiplier: multiplier, total };
}

/**
 * XP of a play after the helps in force (core_07, WP-G2). Pure.
 * - A play where a key light appeared after the wrong presses (ft_Y_06) earns 0 new XP: it takes none away.
 * - Otherwise the base is multiplied by factorFor(table, helps) and floored, so a help reduces XP and never zeroes it:
 *   a play that earned XP keeps at least 1. A base of 0 stays 0. No helps leaves the base unchanged.
 * The small epsilon keeps a product that is exact in maths (e.g. 19.9999999999 for 19) from flooring one lower.
 */
export function applyHelpFactors(baseXp: number, helps: Iterable<HelpId>, table: ModifierTable, keyLightLit: boolean): number {
  if (keyLightLit || baseXp <= 0) return 0;
  const reduced = Math.floor(baseXp * factorFor(table, helps) + 1e-9);
  return Math.max(1, reduced);
}

export interface LevelInfo {
  level: number;
  /** XP earned since this level began. */
  xpIntoLevel: number;
  /** XP this level spans, or null at the top level. */
  xpForLevel: number | null;
  /** 0 to 1 towards the next level; 1 at the top level. */
  progress: number;
}

/** Player level for a total XP. The top level of the table is the maximum. */
export function levelForXp(totalXp: number, levels: readonly number[]): LevelInfo {
  const xp = Math.max(0, totalXp);
  let level = 1;
  for (let i = 1; i < levels.length; i++) if (xp >= levels[i]!) level = i + 1;
  const start = levels[level - 1]!;
  const next = levels[level];
  if (next === undefined) return { level, xpIntoLevel: xp - start, xpForLevel: null, progress: 1 };
  return { level, xpIntoLevel: xp - start, xpForLevel: next - start, progress: (xp - start) / (next - start) };
}
