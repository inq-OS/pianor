import type { Chart } from '../chart';
import { tickToMs } from '../chart';
import { classifyWrongNote } from './classify';
import { ResultTracker } from './results';
import { buildSteps, stepGraces, stepOrnaments } from './steps';
import {
  JUDGE_EVENT_VERSION, type Hints, type JudgeEvent, type NoteEvent, type NoteJudged, type NoteProgress, type PlayMode, type PlayState,
} from './types';
import { playStateOf } from './playState';

export interface WaitModeOptions {
  hints?: Hints;
  /** Keys of a two-hand step count as played together when pressed within this many ms. Default 300. */
  togetherWindowMs?: number;
  /**
   * A wrong key does not wait: it is judged wrong, the step's notes not yet pressed are missed and the cursor moves on
   * (a level-1 tug, played from memory with no tempo; d100). Default false.
   */
  moveOnWrong?: boolean;
}

export const DEFAULT_TOGETHER_WINDOW_MS = 300;

/**
 * Wait mode: the cursor stays on the current note (or chord) until the right keys are pressed.
 * - A wrong key never advances and never ends the piece; it carries a reason for gentle feedback.
 * - Chords: keys in any order, a released key still counts, a repeated press of a satisfied key is ignored.
 * - Every note-on is a press, so a missed note-off cannot block a repeated note. Input sources must not send
 *   key-repeat events (the mock keyboard filters them).
 * - Rhythm is measured (interval error against the chart tempo) but never decides a verdict.
 * - A grace note (d121, core_09.AC33) is never awaited: a press of its pitch while its main note is awaited is ignored.
 * - An ornament sign (d306, core_09.AC65) is optional: a press of a pitch it uses while its note is awaited, or after it
 *   until a key of the next step is right, is ignored.
 */
export class WaitMode implements PlayMode {
  readonly id = 'wait';

  private readonly steps;
  /** Per step, the grace pitches a press may give before it without being wrong (d121). */
  private readonly graces: ReadonlySet<number>[];
  /** Per step, the pitches its ornament signs use (d306). */
  private readonly ornaments: ReadonlySet<number>[];
  private readonly tracker: ResultTracker;
  private readonly progress: NoteProgress[];
  /** Per chart note: right only after a wrong key in its step. */
  private readonly retried: boolean[];
  private readonly held = new Set<number>();
  private hints: Hints;
  private stepIndex = 0;
  private pressed = new Set<number>(); // chart note indices pressed in the current step
  private wrongsInStep = 0;
  private lastOnsetMs: number | null = null;
  private lastExpectedMs: number | null = null;
  private stepOnsetMs: number | null = null;
  private stepLastPressMs = 0;
  private readonly togetherWindowMs: number;
  private readonly moveOnWrong: boolean;
  private lastJudged: NoteJudged | null = null;

  constructor(private readonly chart: Chart, options: WaitModeOptions = {}) {
    this.steps = buildSteps(chart);
    this.graces = stepGraces(chart, this.steps);
    this.ornaments = stepOrnaments(chart, this.steps);
    this.tracker = new ResultTracker(chart, this.steps);
    this.progress = chart.notes.map(() => 'pending');
    this.retried = chart.notes.map(() => false);
    this.hints = options.hints ? { ...options.hints } : { noteNames: false, fingers: false };
    this.togetherWindowMs = options.togetherWindowMs ?? DEFAULT_TOGETHER_WINDOW_MS;
    this.moveOnWrong = options.moveOnWrong === true;
  }

  setHints(hints: Hints): void {
    this.hints = { ...hints };
  }

  handle(event: NoteEvent): JudgeEvent[] {
    if (event.kind === 'off' || event.velocity === 0) {
      this.held.delete(event.midi);
      return [];
    }
    this.held.add(event.midi);
    const step = this.steps[this.stepIndex];
    if (!step) return [];

    const awaiting = step.noteIndices.filter((i) => !this.pressed.has(i));
    const match = awaiting.find((i) => this.chart.notes[i]!.midi === event.midi);
    const base = { v: JUDGE_EVENT_VERSION, timeMs: event.timeMs, stepIndex: step.index, bar: step.bar, hints: { ...this.hints } } as const;

    if (match === undefined) {
      // A key the chord already has is a harmless repeat, not a mistake.
      if (step.noteIndices.some((i) => this.chart.notes[i]!.midi === event.midi)) return [];
      // The grace note before the awaited note is played or not, as the student likes: never wrong, never needed (d121).
      if (this.graces[step.index]!.has(event.midi)) return [];
      // An ornament is played or not, as the student likes (d306): its notes before the main note, and after it until the next step starts.
      if (this.ornaments[step.index]!.has(event.midi)) return [];
      if (step.index > 0 && this.pressed.size === 0 && this.ornaments[step.index - 1]!.has(event.midi)) return [];
      const diagnosis = classifyWrongNote(event.midi, awaiting.map((i) => this.chart.notes[i]!.midi));
      this.wrongsInStep++;
      this.tracker.recordMistake(step.index);
      const judged: NoteJudged = { ...base, type: 'NoteJudged', verdict: 'wrong', midi: event.midi, ...diagnosis };
      this.lastJudged = judged;
      if (!this.moveOnWrong) return [judged];
      for (const i of awaiting) this.progress[i] = 'missed';
      return [judged, ...this.finishStep(step, event.timeMs)];
    }

    let intervalErrorMs: number | null = null;
    if (this.stepOnsetMs === null) {
      this.stepOnsetMs = event.timeMs;
      const expected = tickToMs(this.chart.tempoMap, step.tick, this.chart.ppq);
      if (this.lastOnsetMs !== null && this.lastExpectedMs !== null) {
        intervalErrorMs = event.timeMs - this.lastOnsetMs - (expected - this.lastExpectedMs);
      }
    }
    const firstTry = this.wrongsInStep === 0;
    this.stepLastPressMs = event.timeMs;
    this.pressed.add(match);
    this.progress[match] = 'correct';
    this.retried[match] = !firstTry;
    this.tracker.recordCorrect(step.index, firstTry, intervalErrorMs, this.hints);
    const judged: NoteJudged = {
      ...base, type: 'NoteJudged', verdict: 'correct', midi: event.midi, noteIndex: match, firstTry, intervalErrorMs,
    };
    this.lastJudged = judged;
    const events: JudgeEvent[] = [judged];

    if (this.pressed.size === step.noteIndices.length) {
      for (const tied of step.tiedNoteIndices) {
        this.progress[tied] = 'correct';
        this.retried[tied] = this.wrongsInStep > 0;
      }
      if (step.hands.length === 2) {
        const together = this.wrongsInStep === 0 && this.stepLastPressMs - this.stepOnsetMs <= this.togetherWindowMs;
        this.tracker.recordBothHands(step.index, step.noteIndices.length, together);
      }
      events.push(...this.finishStep(step, event.timeMs));
    }
    return events;
  }

  /** The step is over (all its keys, or a wrong key with `moveOnWrong`): the cursor goes to the next one. */
  private finishStep(step: (typeof this.steps)[number], timeMs: number): JudgeEvent[] {
    // a step left by a wrong key has no onset of its own: the rhythm is measured again from the next played step
    this.lastOnsetMs = this.stepOnsetMs;
    this.lastExpectedMs = this.stepOnsetMs === null ? null : tickToMs(this.chart.tempoMap, step.tick, this.chart.ppq);
    this.stepOnsetMs = null;
    this.pressed = new Set();
    this.wrongsInStep = 0;
    this.stepIndex++;
    return this.tracker.completeStep(step.index, timeMs);
  }

  getState(): PlayState {
    return playStateOf({
      stepIndex: this.stepIndex,
      steps: this.steps,
      pressed: this.pressed,
      progress: this.progress,
      held: this.held,
      lastJudged: this.lastJudged,
      retried: this.retried,
    });
  }
}
