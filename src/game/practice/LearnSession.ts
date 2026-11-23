import type { Chart } from '../../core/chart';
import { sliceChart } from '../../core/chart/section';
import type { JudgeEvent, WrongNoteJudged, WrongReason } from '../../core/judge';
import { markersByNote, mistakeMarkers } from '../../core/learn/markers';
import { handChart, learnPlan, learnUnits, type LearnStep } from '../../core/learn/plan';
import {
  afterRun, currentRun, goldenBars, isLearned, isMeasured, learnHandsApart, learnRewards, learnStepBars, measuredOutcome, sitDown, withTest, type LearnProgress, type LearnRewards, type LearnRun, type LearnSettings, type RunOutcome,
} from '../../core/learn/progress';
import { LearnRunJudge, type LearnRunVerdict } from '../../core/learn/run';
import { baselineBpm, runTempo, TEMPO_RULES, type RunTempo } from '../../core/learn/tempo';
import type { BarPlay } from '../../core/progression/practiceLog';
import { t, type StringKey } from '../../core/text/strings';

/** What the practice screen needs of the player's profile to learn a piece. */
export interface LearnProfile {
  readonly learnSettings: LearnSettings;
  learnProgressOf(pieceId: string): LearnProgress;
  saveLearnProgress(pieceId: string, progress: LearnProgress): Promise<boolean>;
  practiceFor(pieceId: string): BarPlay[];
  recordFor(pieceId: string): { completions: number } | undefined;
}

/**
 * AX-3 provisional (TODO(architect) in ft_1_32): a piece played to the end this many times before learning came counts as
 * learned, so a student who already plays it is not sent back to bar 1.
 */
export const KNOWN_COMPLETIONS = 3;

const REASON_KEY: Record<WrongReason, StringKey> = {
  'wrong-octave': 'learn.reason.wrongOctave', 'neighbour-key': 'learn.reason.neighbourKey', 'wrong-letter': 'learn.reason.wrongLetter',
};

/**
 * Learning one piece bar by bar on the practice screen (ft_1_32 slice 2): the plan, where the player is in it and the run
 * being played now. The scene shows `chart` (only the run's bars), feeds the judge's events to `push`, and on the run's end
 * calls `finish`, which keeps the progress; the next start of the scene opens the next run. Rules live in `src/core/learn`.
 */
export class LearnSession {
  /** The verdict of this run; made at its first events, with the chart the judge plays (`push`). */
  private judge: LearnRunJudge | null = null;
  /** The judge's events of this run, for the tempo of a measured run. */
  private readonly events: JudgeEvent[] = [];
  /** The measures of this run once it was played to its end, when it is a measured one: kept with the progress (ft_1_32.AC8). */
  private measured: RunTempo | null = null;

  private constructor(
    private readonly profile: LearnProfile,
    readonly piece: Chart,
    private readonly plan: readonly LearnStep[],
    private progress: LearnProgress,
    private readonly today: string,
    private readonly now: () => Date,
  ) {}

  /**
   * The learning of `piece` for this player on `today`, or null when there is nothing to learn: the piece is learned, has
   * no notes to play, or was played to the end `KNOWN_COMPLETIONS` times before its learning began. A piece in progress
   * keeps the step size its learning began with (`learnStepBars`).
   */
  static open(profile: LearnProfile, piece: Chart, today: string, now: () => Date = () => new Date()): LearnSession | null {
    const kept = profile.learnProgressOf(piece.id);
    const stepBars = learnStepBars(kept, profile.learnSettings);
    const handsApart = learnHandsApart(kept);
    const plan = learnPlan(piece, stepBars, handsApart);
    const saved = { ...kept, stepBars, handsApart };
    if (plan.length === 0 || isLearned(plan, saved)) return null;
    const started = saved.lastDay !== null;
    if (!started && (profile.recordFor(piece.id)?.completions ?? 0) >= KNOWN_COMPLETIONS) return null;
    return new LearnSession(profile, piece, plan, sitDown(plan, saved, today), today, now);
  }

  /** The run being played now (never null: a learned piece has no session). */
  get run(): LearnRun {
    return currentRun(this.plan, this.progress)!;
  }

  /** The run's bars of the piece, only its hand's notes for a hand step: what the staff shows and the judge waits for. */
  get chart(): Chart {
    return handChart(sliceChart(this.piece, this.run.firstBar, this.run.lastBar), this.run.step.hand);
  }

  /** Whether the note names must stay off for this run (the run after one with names shown). */
  get namesHidden(): boolean {
    return this.run.noteNames === 'hidden';
  }

  get learned(): boolean {
    return isLearned(this.plan, this.progress);
  }

  /** The run is a measured play of the whole piece (the whole step, or a one-chunk piece's confirmation play): a pass of the piece. */
  get wholePiece(): boolean {
    const run = this.run;
    return isMeasured(run) && run.firstBar === 0 && run.lastBar === this.piece.bars.length - 1;
  }

  /** The piece's baseline tempo so far (BPM): the middle of the measured runs, rounded down to 5; null before the first. */
  get baseline(): number | null {
    return baselineBpm(this.progress.bpm ?? []);
  }

  /** What Kiur says about a run played to its end, before the next run's line. */
  endLine(outcome: RunOutcome, bpm: number | undefined): string {
    if (outcome === 'hinted') return '';
    if (outcome === 'unsteady') return t('learn.unsteady');
    if (this.learned && this.baseline !== null) return t('learn.learned', { bpm: this.baseline });
    return bpm === undefined ? t('learn.clean') : t('learn.pace', { bpm });
  }

  /**
   * Read the judge's events (`played` is the chart the judge plays); the verdict of the run so far. A step run is stopped
   * when it speeds up beyond the piece's baseline tempo (the rushing stop, ft_1_32.AC11) while the step may still be asked
   * again (`rushStops`).
   */
  push(events: readonly JudgeEvent[], played: Chart): LearnRunVerdict {
    this.events.push(...events);
    this.judge ??= new LearnRunJudge(this.rushStops ? { chart: played, baselineBpm: this.baseline } : undefined);
    return this.judge.push(events);
  }

  /**
   * Whether this run is stopped for speed: a step run (never the recall check, which is never asked again), with a baseline
   * tempo, while the step has been asked again fewer than `TEMPO_RULES.asks` times; then a run counts at any speed, so a
   * student who keeps rushing is never held at a step.
   */
  get rushStops(): boolean {
    return this.run.kind === 'step' && this.baseline !== null && (this.progress.unsteady ?? 0) < TEMPO_RULES.asks;
  }

  get verdict(): LearnRunVerdict {
    return this.judge?.verdict ?? { state: 'going' };
  }

  /**
   * How a run played to its end counts (`played` is the chart the judge played, `noteNames` whether names were shown): not
   * at all with note names; a measured run (a confirmation play, a whole run) only when its pace was kept evenly, and then
   * with the tempo the student chose (ft_1_32.AC7). A run too short to measure counts, and so does an uneven one once it
   * has been asked again `TEMPO_RULES.asks` times.
   */
  outcomeOf(played: Chart, noteNames: boolean): { outcome: RunOutcome; bpm?: number } {
    this.measured = null;
    if (noteNames) return { outcome: 'hinted' };
    this.measured = isMeasured(this.run) ? runTempo(played, this.events) : null;
    return measuredOutcome(this.progress, this.measured);
  }

  /** The run ended: keep where the student is now, and save it (a failed save is reported, never shown to the player). */
  finish(outcome: RunOutcome, bpm?: number): Promise<boolean> {
    const kept = this.measured ? withTest(this.progress, this.measured, this.today, { kind: this.run.step.kind, firstBar: this.run.firstBar }) : this.progress;
    this.progress = afterRun(this.plan, kept, outcome, this.today, bpm, this.now().toISOString());
    this.measured = null;
    return this.profile.saveLearnProgress(this.piece.id, this.progress).catch((error: unknown) => {
      console.error('saveLearnProgress failed', error);
      return false;
    });
  }

  /** The printed number (from 1) of chart bar `bar`: a pick-up counts with the first full bar. */
  printedBar(bar: number): number {
    return learnUnits(this.piece).findIndex((u) => u.first <= bar && bar <= u.last) + 1;
  }

  /** What Kiur says as the run starts. */
  startLine(): string {
    const run = this.run;
    const from = run.step.firstUnit + 1;
    const to = run.step.lastUnit + 1;
    if (run.kind === 'recall') return from === to ? t('learn.recallOne', { n: from }) : t('learn.recall', { from, to });
    if (this.namesHidden) return t('learn.hidden');
    if (run.step.kind === 'whole') return t('learn.whole');
    if (run.step.kind === 'join') return t('learn.join', { from, to });
    if (run.step.kind === 'confirm') return from === to ? t('learn.confirmOne', { n: from }) : t('learn.confirm', { from, to });
    if (run.step.hand) {
      const hand = t(run.step.hand === 'RH' ? 'learn.handRH' : 'learn.handLH');
      return from === to ? t('learn.handStepOne', { n: from, hand }) : t('learn.handStep', { from, to, hand });
    }
    return from === to ? t('learn.stepOne', { n: from }) : t('learn.step', { from, to });
  }

  /** What Kiur says after a perfect run, about the run that comes next: its bars, or the start line of a whole run or recall. */
  nextLine(): string {
    const run = this.run;
    if (run.kind === 'recall' || run.step.kind !== 'grow' || run.step.hand || this.namesHidden) return this.startLine();
    const from = run.step.firstUnit + 1;
    const to = run.step.lastUnit + 1;
    return from === to ? t('learn.nextOne', { n: from }) : t('learn.next', { from, to });
  }

  /** What Kiur says when the run is stopped for speeding up (ft_1_32.AC11). */
  rushLine(): string {
    return t('learn.rushed');
  }

  /** What Kiur says when a wrong key ends the run: the mistake and its bar (`bar` is the piece's bar of the wrong key). */
  stopLine(wrong: WrongNoteJudged, bar: number): string {
    return t('learn.stopped', { reason: t(REASON_KEY[wrong.reason]), bar: this.printedBar(bar) });
  }

  /** The notes earned so far, each in its medal (ft_1_32.AC4). */
  rewards(): LearnRewards {
    return learnRewards(this.plan, this.progress, this.piece, goldenBars(this.profile.practiceFor(this.piece.id), this.piece.id, this.progress.learnedAt ?? null));
  }
}

/**
 * The mistake markers of the chart shown (the piece, or its bars from `firstBar`) by note index, when the player has them on
 * (ft_1_32.AC5): from the practice log, at the player's threshold.
 */
export function markersFor(profile: Pick<LearnProfile, 'learnSettings' | 'practiceFor'>, pieceId: string, shown: Chart, firstBar: number): Map<number, number> {
  const settings = profile.learnSettings;
  if (!settings.markers) return new Map();
  return markersByNote(shown, mistakeMarkers(profile.practiceFor(pieceId), pieceId, { from: settings.markersFrom }), firstBar);
}
