import type { Chart } from '../../core/chart';
import { sliceChart } from '../../core/chart/section';
import type { JudgeEvent } from '../../core/judge';
import { markersByNote, mistakeMarkers } from '../../core/learn/markers';
import { PRIZE } from '../../core/layout/learnPrizes';
import { handChart, learnPlan, type LearnStep } from '../../core/learn/plan';
import {
  afterRun, currentRun, goldenBars, halfLearned, isLearned, isMeasured, learnHandsApart, learnRewards, learnStepBars, measuredOutcome, playsOn, sitDown, startOver, withTest, type LearnProgress, type LearnRewards, type LearnRun, type LearnSettings, type RunOutcome,
} from '../../core/learn/progress';
import { LearnRunJudge, type LearnRunVerdict } from '../../core/learn/run';
import { prizeFocus, shownWithPiece, type PrizeFocus } from '../../core/learn/view';
import { baselineBpm, runTempo, TEMPO_RULES, type RunTempo } from '../../core/learn/tempo';
import { learnPace, type LearnPace } from '../../core/learn/livePace';
import type { BarPlay } from '../../core/progression/practiceLog';

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
  /** The chart the judge plays, from the run's first events (`push`). */
  private played: Chart | null = null;
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
   * no notes to play, or was played to the end `KNOWN_COMPLETIONS` times before its learning began (unless the player
   * `asked` for its learning, from Kiur). A piece in progress keeps the step size its learning began with (`learnStepBars`).
   */
  static open(profile: LearnProfile, piece: Chart, today: string, now: () => Date = () => new Date(), asked = false): LearnSession | null {
    const kept = profile.learnProgressOf(piece.id);
    const stepBars = learnStepBars(kept, profile.learnSettings);
    const handsApart = learnHandsApart(kept, profile.learnSettings);
    const plan = learnPlan(piece, stepBars, handsApart);
    const saved = { ...kept, stepBars, handsApart };
    if (plan.length === 0 || isLearned(plan, saved)) return null;
    const started = saved.lastDay !== null;
    if (!asked && !started && (profile.recordFor(piece.id)?.completions ?? 0) >= KNOWN_COMPLETIONS) return null;
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

  /**
   * What the staff draws (ft_1_32.AC20): the whole piece, the bars outside the run very faint; the run's notes come first, so
   * the judge's note indexes are the staff's.
   */
  get shown(): { chart: Chart; faint: { from: number; to: number }[]; offset: number } {
    return shownWithPiece(this.piece, this.run.step);
  }

  /** Which prizes the run on the staff is for (ft_1_32.AC19). */
  prizeFocus(rewards: LearnRewards): PrizeFocus {
    // the piece just learned: nothing is aimed at, and the last chunk's quarters stay with the clef earned
    if (this.learned) return { chunk: Math.max(0, rewards.chunks.length - 1), bars: [], chunks: [], clef: false };
    return prizeFocus(this.run.step, this.plan, rewards);
  }

  /** The staff spaces the column of the prizes takes at the staff's right (ft_1_32.AC19). */
  get prizeRoom(): number {
    return PRIZE.room;
  }

  /**
   * The tracks of the hand that rests in a hand step (ft_1_32.AC18): drawn grey on their own staff, so both hands are read,
   * and never awaited. None outside a hand step.
   */
  get restingTracks(): string[] {
    const hand = this.run.step.hand;
    return hand === undefined ? [] : this.piece.tracks.filter((t) => t.role === 'play' && t.hand !== hand).map((t) => t.id);
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

  /**
   * Read the judge's events (`played` is the chart the judge plays); the verdict of the run so far. A step run is stopped
   * when it speeds up beyond the piece's baseline tempo (the rushing stop, ft_1_32.AC11) while the step may still be asked
   * again (`rushStops`).
   */
  push(events: readonly JudgeEvent[], played: Chart): LearnRunVerdict {
    this.events.push(...events);
    this.played = played;
    // the plays of a step asked several times go on past a wrong key (d300)
    this.judge ??= new LearnRunJudge(this.rushStops ? { chart: played, baselineBpm: this.baseline } : undefined, { playOn: this.run.kind === 'step' && playsOn(this.run.step, this.progress) });
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

  /**
   * The run measured so far, for the stats pane while it is played (ft_1_32.AC17): the pace, spread and wobble of the
   * notes played up to now; null before three steps are played.
   */
  get liveTempo(): RunTempo | null {
    return this.played ? runTempo(this.played, this.events) : null;
  }

  /**
   * The live pace (core_13.AC5): the latest key against the student's own pace so far, or the piece's baseline before
   * the run has one; null before the run's first events.
   */
  get pace(): LearnPace | null {
    if (!this.played) return null;
    // read every frame by the beat lane: measured again only when a new event came
    if (this.paceAt?.events !== this.events.length) this.paceAt = { events: this.events.length, pace: learnPace(this.played, this.events, this.baseline) };
    return this.paceAt.pace;
  }
  private paceAt: { events: number; pace: LearnPace } | null = null;

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
    // a play with wrong keys counts as a play, with no tempo kept (d300)
    if (this.verdict.state === 'flawed') return { outcome: 'flawed' };
    this.measured = isMeasured(this.run) ? runTempo(played, this.events) : null;
    return measuredOutcome(this.progress, this.measured);
  }

  /** The learning has begun and is past its first step: opening it asks to go on or start over (ft_1_32.AC16). */
  get halfway(): boolean {
    return halfLearned(this.progress);
  }

  /** Start the learning over from the first step, on the player's settings now, and keep it (ft_1_32.AC16). */
  startOver(): Promise<boolean> {
    this.progress = startOver(this.progress, this.profile.learnSettings, this.today);
    return this.profile.saveLearnProgress(this.piece.id, this.progress).catch((error: unknown) => {
      console.error('saveLearnProgress failed', error);
      return false;
    });
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
