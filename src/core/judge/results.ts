import type { Chart } from '../chart';
import type { PlayStep } from './steps';
import {
  JUDGE_EVENT_VERSION, type BarCompleted, type Hints, type PhraseCompleted, type PieceCompleted, type PlayStats, type TimingVerdict,
} from './types';

interface Acc {
  notes: number;
  firstTryCorrect: number;
  mistakes: number;
  rhythmSum: number;
  rhythmCount: number;
  hintNames: number;
  hintFingers: number;
  bothNotes: number;
  bothTogether: number;
  /** Tempo mode: how the notes were timed. */
  onTime: number;
  early: number;
  late: number;
  missed: number;
  absErrorSum: number;
  scoreSum: number;
  heldFull: number;
  heldShort: number;
}

const emptyAcc = (): Acc => ({
  notes: 0, firstTryCorrect: 0, mistakes: 0, rhythmSum: 0, rhythmCount: 0, hintNames: 0, hintFingers: 0, bothNotes: 0, bothTogether: 0,
  onTime: 0, early: 0, late: 0, missed: 0, absErrorSum: 0, scoreSum: 0, heldFull: 0, heldShort: 0,
});

function toStats(a: Acc, timed: boolean, holds: boolean): PlayStats {
  const played = a.onTime + a.early + a.late;
  return {
    notes: a.notes,
    firstTryCorrect: a.firstTryCorrect,
    mistakes: a.mistakes,
    accuracy: a.notes === 0 ? 1 : a.firstTryCorrect / a.notes,
    rhythmErrorMs: a.rhythmCount === 0 ? null : a.rhythmSum / a.rhythmCount,
    hints: { noteNames: a.hintNames, fingers: a.hintFingers },
    bothHands: { notes: a.bothNotes, together: a.bothTogether },
    ...(timed
      ? {
          timing: {
            played, onTime: a.onTime, early: a.early, late: a.late, missed: a.missed,
            meanAbsErrorMs: played === 0 ? null : a.absErrorSum / played,
            score: a.notes === 0 ? 100 : a.scoreSum / a.notes,
            ...(holds ? { holds: { full: a.heldFull, short: a.heldShort } } : {}),
          },
        }
      : {}),
  };
}

function sum(accs: readonly Acc[]): Acc {
  const total = emptyAcc();
  for (const a of accs) {
    total.notes += a.notes;
    total.firstTryCorrect += a.firstTryCorrect;
    total.mistakes += a.mistakes;
    total.rhythmSum += a.rhythmSum;
    total.rhythmCount += a.rhythmCount;
    total.hintNames += a.hintNames;
    total.hintFingers += a.hintFingers;
    total.bothNotes += a.bothNotes;
    total.bothTogether += a.bothTogether;
    total.onTime += a.onTime;
    total.early += a.early;
    total.late += a.late;
    total.missed += a.missed;
    total.absErrorSum += a.absErrorSum;
    total.scoreSum += a.scoreSum;
    total.heldFull += a.heldFull;
    total.heldShort += a.heldShort;
  }
  return total;
}

export type CompletionEvent = BarCompleted | PhraseCompleted | PieceCompleted;

/**
 * Aggregates judged notes into bar, phrase and piece results and emits the completion events.
 * Shared by play modes so each mode only decides what counts as a correct press.
 * A bar completes when its last step does; bars without notes complete together with the bar before them
 * (leading empty bars with the first step) and trailing ones with the last step. Steps may complete out of order (Tempo
 * mode's holds, d093): a bar then waits until every step up to its last one has completed.
 */
export class ResultTracker {
  private readonly bars: Acc[];
  private readonly lastStepOfBar: number[];
  private readonly completed: boolean[];
  /** How many steps from the first have all completed. */
  private completedPrefix = 0;
  private nextBar = 0;
  private readonly emittedPhrases = new Set<number>();
  private pieceEmitted = false;

  /** `timed` adds the timing statistics (Tempo mode) to every result; `holds` adds their hold counts (d093). */
  constructor(private readonly chart: Chart, private readonly steps: readonly PlayStep[], private readonly timed = false, private readonly holds = false) {
    this.bars = chart.bars.map(emptyAcc);
    this.completed = steps.map(() => false);
    for (const step of steps) this.bars[step.bar]!.notes += step.noteIndices.length;
    let last = -1;
    this.lastStepOfBar = chart.bars.map((_, bar) => {
      for (const step of steps) if (step.bar === bar) last = Math.max(last, step.index);
      return last;
    });
  }

  recordMistake(stepIndex: number): void {
    this.bars[this.steps[stepIndex]!.bar]!.mistakes++;
  }

  recordCorrect(stepIndex: number, firstTry: boolean, intervalErrorMs: number | null, hints: Hints): void {
    const acc = this.bars[this.steps[stepIndex]!.bar]!;
    if (firstTry) acc.firstTryCorrect++;
    if (intervalErrorMs !== null) {
      acc.rhythmSum += Math.abs(intervalErrorMs);
      acc.rhythmCount++;
    }
    if (hints.noteNames) acc.hintNames++;
    if (hints.fingers) acc.hintFingers++;
  }

  /** Tempo mode: a note was pressed `errorMs` off its time (positive is late) and scored `score`. */
  recordTiming(stepIndex: number, errorMs: number, verdict: TimingVerdict, score: number): void {
    const acc = this.bars[this.steps[stepIndex]!.bar]!;
    if (verdict === 'on-time') acc.onTime++;
    else if (verdict === 'early') acc.early++;
    else acc.late++;
    acc.absErrorSum += Math.abs(errorMs);
    acc.scoreSum += score;
  }

  /** Tempo mode with hold grading: a played note was held in `full` or let go too early. */
  recordHold(stepIndex: number, full: boolean): void {
    const acc = this.bars[this.steps[stepIndex]!.bar]!;
    if (full) acc.heldFull++;
    else acc.heldShort++;
  }

  /** Tempo mode: a note's time ran out with no press (it scores 0). */
  recordMissed(stepIndex: number): void {
    this.bars[this.steps[stepIndex]!.bar]!.missed++;
  }

  /** A two-hand step was completed: `notes` keys, played `together` or not. */
  recordBothHands(stepIndex: number, notes: number, together: boolean): void {
    const acc = this.bars[this.steps[stepIndex]!.bar]!;
    acc.bothNotes += notes;
    if (together) acc.bothTogether += notes;
  }

  /**
   * Call after step `stepIndex` is fully played (and, with hold grading, all its holds are known). Returns the bar, phrase
   * and piece events it finishes, in that order.
   */
  completeStep(stepIndex: number, timeMs: number): CompletionEvent[] {
    const out: CompletionEvent[] = [];
    const base = { v: JUDGE_EVENT_VERSION, timeMs } as const;
    this.completed[stepIndex] = true;
    while (this.completed[this.completedPrefix]) this.completedPrefix++;
    while (this.nextBar < this.bars.length && this.lastStepOfBar[this.nextBar]! < this.completedPrefix) {
      out.push({ ...base, type: 'BarCompleted', result: { bar: this.nextBar, ...toStats(this.bars[this.nextBar]!, this.timed, this.holds) } });
      this.nextBar++;
    }
    this.chart.phrases.forEach((phrase, i) => {
      if (this.emittedPhrases.has(i) || phrase.endBar >= this.nextBar) return;
      this.emittedPhrases.add(i);
      const stats = toStats(sum(this.bars.slice(phrase.startBar, phrase.endBar + 1)), this.timed, this.holds);
      out.push({ ...base, type: 'PhraseCompleted', result: { name: phrase.name, startBar: phrase.startBar, endBar: phrase.endBar, ...stats } });
    });
    if (!this.pieceEmitted && this.nextBar === this.bars.length && this.completedPrefix === this.steps.length) {
      this.pieceEmitted = true;
      out.push({
        ...base, type: 'PieceCompleted',
        result: { chartId: this.chart.id, contentVersion: this.chart.contentVersion, ...toStats(sum(this.bars), this.timed, this.holds) },
      });
    }
    return out;
  }
}
