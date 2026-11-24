/**
 * Fitting the points above Beginner to graded pieces (core_08 rule 15, core_08.AC12): each item's label (a Henle level,
 * an exam grade) is mapped onto the points 1 to 100 of d157, each item is scored by the Rules model, and `tail` of
 * `DIFFICULTY_WEIGHTS` is fitted so the points above Beginner match. It only reports: a person accepts the number by
 * writing it into `src/core/piece/difficulty.ts`. `fit-grades-cli.ts` is the command.
 */
import { join } from 'node:path';
import { DIFFICULTY_WEIGHTS, difficultyOf, upperPoints } from '../../src/core/piece/difficulty';
import { spearman } from './fitting';
import { readScore, type Manifest, type ReadResult } from './labelledSet';

/** One graded item: its label, its Rules score (the hardest movement of a work) and the points its label stands for. */
export interface GradedScore {
  id: string;
  label: number;
  score: number;
  points: number;
}

export interface TailFit {
  /** Items scored. */
  items: number;
  /** The suggested `tail`; today's when no item scores above Beginner. */
  tail: number;
  /** Items scored at or past `beginnerEnd`, the ones the fit uses. */
  used: number;
  /** Items whose label is above Beginner but whose score is not: the Rules model orders them too low, the fit cannot help. */
  belowBeginnerEnd: number;
  /** Mean absolute error in points over the used items, at the suggested tail. */
  mae: number;
  /** Share of the used items whose points land in the grade their label stands for. */
  sameGrade: number;
  /** Rank correlation of score and label over every item, -1 to 1: how well the Rules model orders the set at all. */
  spearman: number;
}

/**
 * The points a label stands for: its lowest value 10 (mid Beginner), its highest 98 (Master), linear between, so Henle
 * 2 is 21, the first of Intermediate.
 * AX-3 provisional: no published table maps Henle onto our grades (TODO(architect) in core_08).
 */
export function targetPoints(label: number, range: { min: number; max: number }): number {
  if (range.max <= range.min) return 10;
  return Math.round(10 + ((label - range.min) / (range.max - range.min)) * 88);
}

/** The grade of a number of points, 0 Beginner to 4 Master, twenty points to a grade (d157). */
export function gradeOf(points: number): number {
  return Math.min(4, Math.max(0, Math.floor((points - 1) / 20)));
}

/** Every item of a set scored by the Rules model, the hardest movement of a work as in `buildSamples`; unreadable ones with why. */
export function scoreItems(manifest: Manifest, baseDir: string, read: (path: string) => ReadResult = readScore): { items: GradedScore[]; skipped: { id: string; reason: string }[] } {
  const items: GradedScore[] = [];
  const skipped: { id: string; reason: string }[] = [];
  for (const item of manifest.items) {
    const scores: number[] = [];
    const reasons = new Set<string>();
    for (const file of item.files) {
      const result = read(join(baseDir, file));
      if (result.ok) scores.push(difficultyOf(result.chart).score);
      else reasons.add(result.reason);
    }
    if (reasons.size > 0) skipped.push({ id: item.id, reason: [...reasons].join('; ') });
    else items.push({ id: item.id, label: item.label, score: Math.max(...scores), points: targetPoints(item.label, manifest.label) });
  }
  return { items, skipped };
}

/** The points of a score above Beginner without rounding, so the fit has a smooth error to walk down. */
const smooth = (score: number, beginnerEnd: number, tail: number) => Math.min(100, 20 + 80 * (1 - Math.exp(-(score - beginnerEnd) / tail)));

/** Least squares over `tail` by a coarse grid, then a fine one round the best: one number, no solver needed. */
export function fitTail(items: readonly GradedScore[], beginnerEnd: number): TailFit {
  const used = items.filter((i) => i.score >= beginnerEnd);
  const belowBeginnerEnd = items.filter((i) => i.score < beginnerEnd && i.points > 20).length;
  const rank = items.length > 1 ? spearman(items.map((i) => i.score), items.map((i) => i.label)) : 0;
  const cost = (tail: number) => used.reduce((sum, i) => sum + (smooth(i.score, beginnerEnd, tail) - i.points) ** 2, 0);
  let tail: number = DIFFICULTY_WEIGHTS.tail;
  if (used.length > 0) {
    const best = (from: number, to: number, step: number) => {
      let at = from;
      for (let t = from; t <= to; t += step) if (cost(t) < cost(at)) at = t;
      return at;
    };
    const coarse = best(1, 400, 1);
    tail = Math.round(best(Math.max(0.1, coarse - 1), coarse + 1, 0.01) * 10) / 10;
  }
  const shown = used.map((i) => upperPoints(i.score, beginnerEnd, tail));
  return {
    items: items.length,
    tail,
    used: used.length,
    belowBeginnerEnd,
    mae: used.length > 0 ? used.reduce((sum, i, k) => sum + Math.abs(shown[k]! - i.points), 0) / used.length : 0,
    sameGrade: used.length > 0 ? used.filter((i, k) => gradeOf(shown[k]!) === gradeOf(i.points)).length / used.length : 0,
    spearman: rank,
  };
}

/** The lines the command prints: the suggestion, how well it fits, how to accept it, then what could not be read. */
export function gradeFitReport(name: string, fit: TailFit, skipped: readonly { id: string; reason: string }[]): string[] {
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  return [
    `${name}: ${fit.items} item(s), ${fit.used} scored above Beginner, ${fit.belowBeginnerEnd} graded above Beginner but scored as Beginner`,
    `  rank correlation of score and label ${fit.spearman.toFixed(2)} (1 orders the set perfectly)`,
    fit.used > 0
      ? `  suggested tail ${fit.tail} (today ${DIFFICULTY_WEIGHTS.tail}): mean error ${fit.mae.toFixed(1)} points, same grade ${pct(fit.sameGrade)}`
      : `  nothing scored above Beginner: tail stays ${DIFFICULTY_WEIGHTS.tail}`,
    `  to accept it, write it into DIFFICULTY_WEIGHTS.tail in src/core/piece/difficulty.ts and run npm test`,
    ...(skipped.length > 0 ? [`${skipped.length} item(s) not read:`, ...skipped.map((s) => `  ${s.id}: ${s.reason}`)] : []),
  ];
}

