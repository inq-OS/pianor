/**
 * The plays of the practice log as `PlayResult`s (core_12, WP-04). Each hand's measure is summed from the bars' per-hand
 * shares (core_12.AC2); a play with a bar kept before those existed has no hands (`hands: {}`). The score is folded from the
 * bars' totals either way.
 */
import type { DayString, Hand, PieceId } from '../contracts';
import type { BarPlay, HandBar, PracticeLog } from '../progression/practiceLog';
import { foldScore, type EvaluationRules } from './evaluate';
import type { HandMeasure, PlayResult } from './play';

/** The whole-piece plays of `piece` in the log, as runs of bars, oldest first (see `playResultsFromLog`). */
export function wholePiecePlays(log: PracticeLog, piece: PieceId, barCount: number): BarPlay[][] {
  const bars = log.bars.filter((b) => b.pieceId === piece && b.section === null);
  const runs: BarPlay[][] = [];
  bars.forEach((b, i) => {
    const before = bars[i - 1];
    const continues = before !== undefined && before.bar + 1 === b.bar && before.mode === b.mode && before.tempoPercent === b.tempoPercent;
    if (continues) runs[runs.length - 1]!.push(b);
    else runs.push([b]);
  });
  return runs.filter((run) => run[0]!.bar === 0 && run[run.length - 1]!.bar === barCount - 1);
}

const HAND_OF = { RH: 'right', LH: 'left' } as const satisfies Record<'RH' | 'LH', Hand>;

/**
 * Each hand's measure over a run of bars (A.11 `HandMeasure`): notes and first tries summed; in Tempo mode the notes on time
 * and the mean and standard deviation of the onset deviations in ticks, exact from each bar's count, sum and sum of squares.
 * Empty when any bar has no per-hand shares.
 */
function handMeasures(run: readonly BarPlay[]): PlayResult['hands'] {
  if (run.some((b) => b.hands === undefined)) return {};
  const out: Partial<Record<Hand, HandMeasure>> = {};
  for (const key of ['RH', 'LH'] as const) {
    const shares = run.map((b) => b.hands![key]).filter((h): h is HandBar => h !== undefined);
    if (shares.length === 0) continue;
    const sum = (f: (h: HandBar) => number) => shares.reduce((n, h) => n + f(h), 0);
    const timed = shares.some((h) => h.onTime !== undefined);
    const n = sum((h) => h.onsets?.n ?? 0);
    const mean = n > 0 ? sum((h) => h.onsets?.sum ?? 0) / n : 0;
    const spread = n > 0 ? Math.sqrt(Math.max(0, sum((h) => h.onsets?.sumSq ?? 0) / n - mean * mean)) : 0;
    out[HAND_OF[key]] = {
      notes: sum((h) => h.notes),
      firstTry: sum((h) => h.firstTry),
      ...(timed ? { onTime: sum((h) => h.onTime ?? 0) } : {}),
      ...(n > 0 ? { onsetMeanTicks: mean, onsetSpreadTicks: spread } : {}),
    };
  }
  return out;
}

/**
 * The clean plays of `piece` that ended after `since` (an ISO time): whole-piece plays with every note right the first time
 * (ft_1_25.AC3, ft_1_21.AC13: the cool-down after a lost tug); timing is not asked, as the judge is pitch first.
 */
export function cleanPlaysSince(log: PracticeLog, piece: PieceId, barCount: number, since: string): number {
  const from = Date.parse(since);
  return wholePiecePlays(log, piece, barCount).filter((run) =>
    Date.parse(run[run.length - 1]!.at) > from && isClean(run)).length;
}

/** The local day of every whole clean play of `piece` (every note right first try, no wrong key), oldest first (ft_1_22.AC5). */
export function cleanPlayDays(log: PracticeLog, piece: PieceId, barCount: number, dayOf: (iso: string) => DayString): DayString[] {
  return wholePiecePlays(log, piece, barCount).filter(isClean).map((run) => dayOf(run[run.length - 1]!.at));
}

const isClean = (run: readonly BarPlay[]): boolean => run.every((b) => b.firstTry === b.notes && b.misses.length === 0);

/**
 * Every whole-piece play of `piece` that reached its last bar (`barCount - 1`), oldest first. A play is a run of
 * consecutive bars with the same mode, tempo and section, starting at bar 0 (as `partPlays` reads the log); a run
 * stopped early is not a play of the piece. `dayOf` turns a bar's ISO time into the player's local day.
 */
export function playResultsFromLog(
  log: PracticeLog,
  piece: PieceId,
  barCount: number,
  dayOf: (iso: string) => DayString,
  rules: EvaluationRules,
): PlayResult[] {
  const results: PlayResult[] = [];
  for (const run of wholePiecePlays(log, piece, barCount)) {
    const end = run[run.length - 1]!;
    results.push({
      piece,
      day: dayOf(end.at),
      at: Date.parse(end.at),
      mode: end.mode,
      tempoPercent: end.tempoPercent,
      hands: handMeasures(run),
      score: runScore(run, rules),
    });
  }
  return results;
}

/** The play score (core_12, 0 to 100) of one run of bars, folded from the bars' totals in the mode and tempo of its last bar. */
export function runScore(run: readonly BarPlay[], rules: EvaluationRules): number {
  const end = run[run.length - 1]!;
  const notes = run.reduce((n, b) => n + b.notes, 0);
  const firstTry = run.reduce((n, b) => n + b.firstTry, 0);
  // A bar's timing is 0 to 100 over its notes; weighted by notes it gives the notes on time.
  const onTime = run.reduce((n, b) => n + ((b.timing ?? 0) * b.notes) / 100, 0);
  return foldScore(end.mode, end.tempoPercent, { notes, firstTry, onTime }, rules);
}
