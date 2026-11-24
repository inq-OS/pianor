import type { Difficulty } from '../piece/difficulty';
import type { BarPlay } from './practiceLog';

/**
 * The measured difficulty of a piece's bars (core_08 rule 10, slice B): how far each bar's share of notes right the first
 * time falls below the piece's mean, over the player's latest plays of it, whole piece and sections alike. A bar with few
 * plays keeps its prior, the score from its notes. Pure: read from the practice log (core_10), nothing stored, no save change.
 * It never changes XP (rule 14, AX-1.1): it only chooses which bars and phrases to point at.
 */

/** AX-3 provisional: the latest plays of a bar read, the plays a bar needs to be measured, the gap that makes it one of the hardest, and how many are named. */
export const MEASURED_RULES = { window: 10, minPlays: 3, hardGap: 0.1, most: 3 } as const;

export interface MeasuredBar {
  /** 0-based, as in the chart and the practice log. */
  bar: number;
  /** Plays of the bar read (at most the window), counting only plays with notes to play. */
  plays: number;
  /** Share of its notes right the first time over those plays, 0 to 1; null with too few plays. */
  share: number | null;
  /** The piece's mean share minus this bar's: above 0 the bar is harder for this player than the piece's others. */
  gap: number | null;
  /** The bar's score from its notes (`difficultyOf`). */
  prior: number;
}

export interface MeasuredPiece {
  bars: MeasuredBar[];
  /** Mean share over the measured bars; null when fewer than two bars are measured. */
  mean: number | null;
  /** Whether two or more bars are measured, so the gaps say something. */
  measured: boolean;
  /** The hardest bars for this player, in bar order; the prior's hardest when the piece is not measured. */
  hardest: number[];
}

export function measuredDifficulty(log: readonly BarPlay[], pieceId: string, prior: Difficulty, rules: typeof MEASURED_RULES = MEASURED_RULES): MeasuredPiece {
  const byBar = new Map<number, BarPlay[]>();
  for (const play of log) {
    if (play.pieceId !== pieceId || play.notes === 0) continue;
    const list = byBar.get(play.bar) ?? [];
    list.push(play);
    byBar.set(play.bar, list);
  }
  const shares = prior.bars.map((b) => {
    const recent = (byBar.get(b.index) ?? []).slice(-rules.window);
    const notes = recent.reduce((sum, p) => sum + p.notes, 0);
    const share = recent.length >= rules.minPlays && notes > 0 ? recent.reduce((sum, p) => sum + p.firstTry, 0) / notes : null;
    return { bar: b.index, plays: recent.length, share, prior: b.score };
  });
  const known = shares.flatMap((b) => (b.share === null ? [] : [b.share]));
  const measured = known.length >= 2;
  const mean = measured ? known.reduce((a, b) => a + b, 0) / known.length : null;
  const bars = shares.map((b) => ({ bar: b.bar, plays: b.plays, share: b.share, gap: mean !== null && b.share !== null ? mean - b.share : null, prior: b.prior }));
  const hardest = measured
    ? bars
        .filter((b) => b.gap !== null && b.gap >= rules.hardGap)
        .sort((a, b) => b.gap! - a.gap! || a.bar - b.bar)
        .slice(0, rules.most)
        .map((b) => b.bar)
        .sort((a, b) => a - b)
    : [...prior.hardest];
  return { bars, mean, measured, hardest };
}
