import type { BarPlay } from '../progression/practiceLog';

/**
 * Bar heat (core_10, AC5 and AC6): how hot a bar is on the practice screen, from the practice log. Pure: a function of the
 * plays only. Heat is 0 for a bar played cleanly and 1 for a bar with nothing right the first time (provisional, AX-3).
 */

/** The tuning of the heat gradient and the weakest sections. Provisional (AX-3). */
export const HEAT = { decay: 0.7, minHeat: 0.15, maxSectionBars: 4, sections: 3 } as const;

export interface HeatSection {
  first: number;
  last: number;
  heat: number;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * How badly one play went on its bar, 0 to 1: the share of notes not right the first time, or in Tempo mode the timing
 * loss (100 - timing) / 200, whichever is worse.
 */
export function barBadness(play: BarPlay): number {
  const firstTryLoss = play.notes === 0 ? 0 : 1 - play.firstTry / play.notes;
  const timingLoss = play.timing === null ? 0 : (100 - play.timing) / 200;
  return clamp01(Math.max(firstTryLoss, timingLoss));
}

/**
 * The heat of one bar: a weighted mean of the badness of its plays, oldest to newest in array order. The newest play has
 * weight 1, the one before it HEAT.decay, then HEAT.decay squared, and so on, so clean recent plays cool a bar down.
 * null when the bar has no plays.
 */
export function barHeat(plays: readonly BarPlay[], bar: number): number | null {
  let weightedSum = 0;
  let totalWeight = 0;
  let weight = 1;
  for (let i = plays.length - 1; i >= 0; i -= 1) {
    const play = plays[i];
    if (play === undefined || play.bar !== bar) continue;
    weightedSum += weight * barBadness(play);
    totalWeight += weight;
    weight *= HEAT.decay;
  }
  return totalWeight === 0 ? null : clamp01(weightedSum / totalWeight);
}

/** The heat of every bar 0 to barCount - 1; null for a bar without plays. */
export function pieceHeat(plays: readonly BarPlay[], barCount: number): (number | null)[] {
  return Array.from({ length: barCount }, (_, bar) => barHeat(plays, bar));
}

/**
 * The HEAT.sections hottest sections: runs of consecutive bars at or above HEAT.minHeat (a null bar never qualifies), a run
 * longer than HEAT.maxSectionBars cut into chunks from the left, each section's heat the mean of its bars. Hottest first,
 * equally hot ones earlier bar first. Empty when no bar qualifies.
 */
export function weakestSections(heat: readonly (number | null)[]): HeatSection[] {
  const sections: HeatSection[] = [];
  let runStart = -1;
  for (let bar = 0; bar <= heat.length; bar += 1) {
    const value = heat[bar] ?? null;
    const hot = value !== null && value >= HEAT.minHeat;
    if (hot && runStart === -1) runStart = bar;
    if (!hot && runStart !== -1) {
      const runEnd = bar - 1;
      for (let first = runStart; first <= runEnd; first += HEAT.maxSectionBars) {
        const last = Math.min(first + HEAT.maxSectionBars - 1, runEnd);
        let sum = 0;
        for (let b = first; b <= last; b += 1) sum += heat[b] as number;
        sections.push({ first, last, heat: sum / (last - first + 1) });
      }
      runStart = -1;
    }
  }
  return sections
    .sort((a, b) => b.heat - a.heat || a.first - b.first)
    .slice(0, HEAT.sections);
}

/** The hottest bar of a section (first to last, inclusive); the earlier one on a tie; `first` when none has been played. */
export function hottestBar(heat: readonly (number | null)[], first: number, last: number): number {
  let best = first;
  for (let bar = first; bar <= last; bar++) if ((heat[bar] ?? 0) > (heat[best] ?? 0)) best = bar;
  return best;
}
