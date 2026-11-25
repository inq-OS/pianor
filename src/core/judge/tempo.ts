import { tieChain, tieLinks, type Chart } from '../chart';
import type { Transport } from '../transport';
import { classifyWrongNote } from './classify';
import { ResultTracker } from './results';
import { buildSteps, stepGraces, stepOrnaments, type PlayStep } from './steps';
import { DEFAULT_HOLD_RULES, DEFAULT_TEMPO_WINDOWS, GRACE_EARLY_MS, followRate, fullHoldMs, holdAgainst, timingOf, type FollowRules, type HoldRules, type TempoWindows } from './timing';
import { DEFAULT_TOGETHER_WINDOW_MS } from './wait';
import {
  JUDGE_EVENT_VERSION, type Hints, type JudgeEvent, type NoteEvent, type NoteJudged, type NoteMissed, type NoteProgress, type NoteTiming,
  type PlayMode, type PlayState,
} from './types';
import { playStateOf } from './playState';

export interface TempoModeOptions {
  hints?: Hints;
  windows?: TempoWindows;
  /** Keys of a two-hand step count as played together when pressed within this many ms. Default 300. */
  togetherWindowMs?: number;
  /**
   * The chart is a section that loops (core_03.AC4): after its end the next lap begins at once, so the last step's late
   * window and the first step's early window each take at most half the gap between them, like any two steps.
   */
  loop?: boolean;
  /**
   * Grade how long each note is held (d093, core_01 slice f). On by default; off (the admin switch, core_01.AC9) the judge
   * is exactly that of before slice f: onsets only, results on the last press, no hold in the timings.
   */
  gradeHold?: boolean;
  hold?: HoldRules;
  /**
   * How the clock starts (core_01.AC10). `anyKey` (default): the first key press starts the transport (its count-in) and is
   * not judged. `firstNote`: nothing runs until every key of the first step is down at once; the press that completes it
   * puts that step on the clock there, and its keys are judged on time. Give it a transport with no count-in.
   */
  start?: TempoStart;
  /**
   * The following clock (core_01.AC12): the piece never runs on without the player. A step whose window has run out is
   * waited for instead of missed, every step played puts the clock on its press, and the tempo leans toward the pace
   * played, inside the rules' band. Left out: the strict clock, which never waits.
   */
  follow?: FollowRules;
}

/** How Tempo mode starts: any key starts the count-in, or the first note itself starts the piece (core_01.AC10). */
export type TempoStart = 'anyKey' | 'firstNote';

/** A looped section decides its last holds this long (ms) before the next lap's first window opens. */
const LOOP_WRAP_SLACK_MS = 50;

/** A right note whose key is still down and whose hold is not decided yet. */
interface OpenHold {
  noteIndex: number;
  stepIndex: number;
  pressMs: number;
  /**
   * When the hold counts as full: the written start plus the full hold (a lost note-off is not waited for beyond it), or
   * a looped section's wrap. A release is graded against this same moment.
   */
  dueMs: number;
  timing: NoteTiming;
}

/**
 * Tempo mode (`docs/features/core_01-tempo-mode.md`): the piece runs on the clock instead of waiting.
 * - The first key press only starts the transport: one bar is counted in, then tick 0 follows. That press is not judged.
 * - Every step has a window around its time: `windowMs` either side, cut to half the gap to the step before and after,
 *   so the windows of neighbouring steps never overlap and a press belongs to exactly one step.
 * - A right key in the window is judged with its timing (early or late, a score); a wrong key in the window is a wrong note
 *   but time goes on; a key outside every window is ignored. When a window has passed (`advance`), the notes still not
 *   pressed are missed and the step is over: the piece never waits.
 * - Pitch rules (wrong-note reasons, chords, the together bonus) are those of Wait mode.
 * - Holds (d093, unless `gradeHold` is off): a right note's score is its press score times a hold factor (`holdOf`), known
 *   when its key is released or once it has been held long enough (`fullHoldMs` from its written start, so a lost note-off
 *   counts as full). Legato overlap does not matter: each key is graded on its own release. A bar, phrase or piece completes
 *   once every note in it has its hold.
 * - A grace note (d121, core_09.AC33) is never needed: a press of its pitch up to `GRACE_EARLY_MS` before its main note's
 *   time is ignored, also while the note before still has its window; a right note of the open step wins over it.
 * - With `follow` (core_01.AC12) the clock follows the player: no note is ever missed. When a step's window runs out the
 *   clock stands at its end until the step is played (a key then is late by the window, never ignored), a right key before
 *   the window is early instead of ignored once the step before is done, each step played
 *   puts the clock on its first press, and the gap from the step before sets the tempo for what comes (`followRate`); a
 *   gap that was waited in sets nothing.
 * Results come from the shared tracker with timing statistics. Nothing here is punishing: a missed note only scores 0.
 */
export class TempoMode implements PlayMode {
  readonly id = 'tempo';

  private readonly steps: PlayStep[];
  /** Per step, the grace pitches a press may give just before it without being wrong (d121). */
  private readonly graces: ReadonlySet<number>[];
  /** Per step, the pitches its ornament signs use (d303). */
  private readonly ornaments: ReadonlySet<number>[];
  private readonly tracker: ResultTracker;
  private readonly progress: NoteProgress[];
  private readonly timings: (NoteTiming | null)[];
  private readonly held = new Set<number>();
  private readonly windows: TempoWindows;
  private readonly togetherWindowMs: number;
  private readonly loop: boolean;
  private readonly startOn: TempoStart;
  private readonly gradeHold: boolean;
  private readonly holdRules: HoldRules;
  private readonly follow: FollowRules | null;
  /** The following clock: the clock time `advance` last held the open step's window at, and whether that step was waited for. */
  private heldAtMs: number | null = null;
  private waited = false;
  /** The following clock: the last step played in full and its first press. */
  private lastPlayed: { index: number; pressMs: number } | null = null;
  /** Per chart note: the tick where it (its tie chain) ends. */
  private readonly endTicks: number[];
  /** Open holds by key: MIDI releases a key before it can be pressed again, so one per key. */
  private readonly openHolds = new Map<number, OpenHold>();
  /** Per step: holds not decided yet, and whether its window is over. */
  private readonly holdsLeft: number[];
  private readonly stepOver: boolean[];
  private hints: Hints;
  private stepIndex = 0;
  private pressed = new Set<number>();
  private pressTimes: number[] = [];
  private wrongsInStep = 0;
  private missedInStep = 0;
  private lastJudged: NoteJudged | null = null;

  constructor(private readonly chart: Chart, private readonly transport: Transport, options: TempoModeOptions = {}) {
    this.steps = buildSteps(chart);
    this.graces = stepGraces(chart, this.steps);
    this.ornaments = stepOrnaments(chart, this.steps);
    this.gradeHold = options.gradeHold !== false;
    this.holdRules = options.hold ?? DEFAULT_HOLD_RULES;
    this.tracker = new ResultTracker(chart, this.steps, true, this.gradeHold);
    const links = tieLinks(chart, new Set(chart.tracks.filter((t) => t.role === 'play').map((t) => t.id)));
    this.endTicks = chart.notes.map((note, i) => {
      const last = tieChain(links, i).at(-1);
      const end = last === undefined ? note : chart.notes[last]!;
      return end.tick + end.dur;
    });
    this.holdsLeft = this.steps.map(() => 0);
    this.stepOver = this.steps.map(() => false);
    this.progress = chart.notes.map(() => 'pending');
    this.timings = chart.notes.map(() => null);
    this.hints = options.hints ? { ...options.hints } : { noteNames: false, fingers: false };
    this.windows = options.windows ?? DEFAULT_TEMPO_WINDOWS;
    this.togetherWindowMs = options.togetherWindowMs ?? DEFAULT_TOGETHER_WINDOW_MS;
    this.loop = options.loop === true;
    this.startOn = options.start ?? 'anyKey';
    this.follow = options.follow ?? null;
  }

  setHints(hints: Hints): void {
    this.hints = { ...hints };
  }

  /** Clock time of a step; only valid once the transport has started. */
  private timeOf(index: number): number {
    return this.transport.timeOfTick(this.steps[index]!.tick)!;
  }

  /** A looped section: the time from its last step to the next lap's first step (the end of the chart, then its first step again). */
  private wrapGapMs(): number {
    const last = this.steps[this.steps.length - 1]!;
    const endTick = this.chart.bars[this.chart.bars.length - 1]!.endTick;
    return this.transport.timeOfTick(endTick)! - this.timeOf(last.index) + this.timeOf(0) - this.transport.timeOfTick(0)!;
  }

  /** The clock times between which a press belongs to step `index`. */
  private windowOf(index: number): { from: number; to: number } {
    const at = this.timeOf(index);
    const wrap = this.loop ? this.wrapGapMs() / 2 : Infinity;
    const early = index === 0 ? Math.min(this.windows.windowMs, wrap) : Math.min(this.windows.windowMs, (at - this.timeOf(index - 1)) / 2);
    const late = index + 1 === this.steps.length ? Math.min(this.windows.windowMs, wrap) : Math.min(this.windows.windowMs, (this.timeOf(index + 1) - at) / 2);
    return { from: at - early, to: at + late };
  }

  /** A looped section: when the next lap's first window opens. Every hold is decided by then, so the lap can wrap on. */
  private nextLapOpensMs(): number {
    const endMs = this.transport.timeOfTick(this.chart.bars[this.chart.bars.length - 1]!.endTick)!;
    return endMs + this.timeOf(0) - this.transport.timeOfTick(0)! - Math.min(this.windows.windowMs, this.wrapGapMs() / 2);
  }

  /** The open hold that is due first, if any. */
  private nextDueHold(): OpenHold | undefined {
    let first: OpenHold | undefined;
    for (const open of this.openHolds.values()) if (first === undefined || open.dueMs < first.dueMs) first = open;
    return first;
  }

  advance(nowMs: number): JudgeEvent[] {
    const events: JudgeEvent[] = [];
    if (!this.transport.started) return events;
    // windows that close and holds that fall due, in time order
    for (;;) {
      const step = this.steps[this.stepIndex];
      const to = step ? this.windowOf(step.index).to : Infinity;
      const due = this.nextDueHold();
      if (due && due.dueMs <= nowMs && due.dueMs <= to) events.push(...this.decideHold(due, due.dueMs, true));
      else if (step && nowMs > to && this.follow) {
        if (this.heldAtMs === nowMs) break; // held already: rounding may leave the window a hair short of now
        this.waitFor(step, nowMs, to);
      } else if (step && nowMs > to) events.push(...this.closeStep(step, to));
      else break;
    }
    return events;
  }

  /** The following clock: the window of `step` ran out at `to`, so the clock stands there, the window's end staying at now. */
  private waitFor(step: PlayStep, nowMs: number, to: number): void {
    this.transport.follow(step.tick, nowMs - (to - this.timeOf(step.index)));
    this.heldAtMs = nowMs;
    this.waited = true;
  }

  /** The following clock: `step` is played, so the clock is on its first press, at the tempo its gap asks for. */
  private followStep(step: PlayStep): void {
    const pressMs = Math.min(...this.pressTimes);
    let rate = this.transport.rate;
    const last = this.lastPlayed;
    if (last && !this.waited && pressMs > last.pressMs) {
      const written = (this.timeOf(step.index) - this.timeOf(last.index)) * rate; // the gap at the set tempo
      rate = followRate(rate, written / (pressMs - last.pressMs), this.follow!);
    }
    this.transport.follow(step.tick, pressMs, rate);
    this.lastPlayed = { index: step.index, pressMs };
    this.waited = false;
    this.heldAtMs = null;
  }

  /** The hold of `open` is known at `timeMs`: `full` (held long enough, or its note-off was lost) or released then. */
  private decideHold(open: OpenHold, timeMs: number, full: boolean): JudgeEvent[] {
    this.openHolds.delete(this.chart.notes[open.noteIndex]!.midi);
    const { timing } = open;
    const hold = holdAgainst(full ? Infinity : timeMs - open.pressMs, open.dueMs - open.pressMs, this.holdRules);
    // rounded down, so a hold short of full never shows the full press score
    const score = Math.floor(timing.score * hold.factor);
    this.timings[open.noteIndex] = { ...timing, score, pressScore: timing.score, hold: hold.hold };
    this.tracker.recordTiming(open.stepIndex, timing.errorMs, timing.verdict, score);
    this.tracker.recordHold(open.stepIndex, hold.hold === 100);
    this.holdsLeft[open.stepIndex]!--;
    return this.completeIfDone(open.stepIndex, timeMs);
  }

  /** A step's results are in once its window is over and all its holds are known. */
  private completeIfDone(stepIndex: number, timeMs: number): JudgeEvent[] {
    if (!this.stepOver[stepIndex] || this.holdsLeft[stepIndex]! > 0) return [];
    return this.tracker.completeStep(stepIndex, timeMs);
  }

  /** The window of `step` is over: what is still not pressed is missed. */
  private closeStep(step: PlayStep, timeMs: number): JudgeEvent[] {
    const events: JudgeEvent[] = [];
    for (const index of step.noteIndices) {
      if (this.pressed.has(index)) continue;
      this.progress[index] = 'missed';
      this.tracker.recordMissed(step.index);
      this.missedInStep++;
      const missed: NoteMissed = {
        v: JUDGE_EVENT_VERSION, type: 'NoteMissed', timeMs, midi: this.chart.notes[index]!.midi, noteIndex: index, stepIndex: step.index,
        bar: step.bar, hints: { ...this.hints },
      };
      events.push(missed);
    }
    return events.concat(this.finishStep(step, timeMs));
  }

  private finishStep(step: PlayStep, timeMs: number): JudgeEvent[] {
    const missedAll = step.noteIndices.every((i) => this.progress[i] === 'missed');
    for (const tied of step.tiedNoteIndices) this.progress[tied] = missedAll ? 'missed' : 'correct';
    if (step.hands.length === 2) {
      const spread = this.pressTimes.length > 0 ? Math.max(...this.pressTimes) - Math.min(...this.pressTimes) : 0;
      const together = this.wrongsInStep === 0 && this.missedInStep === 0 && spread <= this.togetherWindowMs;
      this.tracker.recordBothHands(step.index, step.noteIndices.length, together);
    }
    this.stepIndex++;
    this.pressed = new Set();
    this.pressTimes = [];
    this.wrongsInStep = 0;
    this.missedInStep = 0;
    this.stepOver[step.index] = true;
    return this.completeIfDone(step.index, timeMs);
  }

  handle(event: NoteEvent): JudgeEvent[] {
    if (event.kind === 'off' || event.velocity === 0) {
      this.held.delete(event.midi);
      if (!this.gradeHold || !this.transport.started) return []; // without hold grading a release changes nothing
      const events = this.advance(event.timeMs);
      const open = this.openHolds.get(event.midi);
      return open ? events.concat(this.decideHold(open, event.timeMs, false)) : events;
    }
    this.held.add(event.midi);
    if (!this.transport.started) return this.startWith(event);
    const events = this.advance(event.timeMs);
    // a key pressed again with no note-off between (a lost one): its last note was held until now
    const unreleased = this.openHolds.get(event.midi);
    if (unreleased) events.push(...this.decideHold(unreleased, event.timeMs, false));
    const step = this.steps[this.stepIndex];
    if (!step) return events;
    const { from, to } = this.windowOf(step.index);
    // not for any step: ignored. The following clock keeps the open step's window open, so no key is too late for it,
    // and once the step before is done none is too early either (the count-in before the first step is still no note)
    const rightKey = step.noteIndices.some((i) => !this.pressed.has(i) && this.chart.notes[i]!.midi === event.midi);
    const early = event.timeMs < from && !(this.follow && step.index > 0 && rightKey); // a wrong key before the window stays no note
    if (early || (event.timeMs > to && !this.follow)) return events;

    const awaiting = step.noteIndices.filter((i) => !this.pressed.has(i));
    const match = awaiting.find((i) => this.chart.notes[i]!.midi === event.midi);
    const base = { v: JUDGE_EVENT_VERSION, timeMs: event.timeMs, stepIndex: step.index, bar: step.bar, hints: { ...this.hints } } as const;

    if (match === undefined) {
      if (step.noteIndices.some((i) => this.chart.notes[i]!.midi === event.midi)) return events; // a repeat of a note already played
      if (this.isGracePress(event.midi, event.timeMs)) return events; // played or not as the student likes (d121)
      if (this.isOrnamentPress(event.midi, event.timeMs)) return events; // an ornament is optional too (d303)
      const diagnosis = classifyWrongNote(event.midi, awaiting.map((i) => this.chart.notes[i]!.midi));
      this.wrongsInStep++;
      this.tracker.recordMistake(step.index);
      const judged: NoteJudged = { ...base, type: 'NoteJudged', verdict: 'wrong', midi: event.midi, ...diagnosis };
      this.lastJudged = judged;
      return [...events, judged];
    }

    const errorMs = event.timeMs - this.timeOf(step.index);
    const timing = timingOf(errorMs, this.windows);
    const firstTry = this.wrongsInStep === 0;
    this.pressed.add(match);
    this.pressTimes.push(event.timeMs);
    this.progress[match] = 'correct';
    this.tracker.recordCorrect(step.index, firstTry, errorMs, this.hints);
    if (this.gradeHold) {
      this.timings[match] = { ...timing, pressScore: timing.score };
      this.openHold(match, step.index, event.timeMs, timing);
    } else {
      this.timings[match] = timing;
      this.tracker.recordTiming(step.index, errorMs, timing.verdict, timing.score);
    }
    const judged: NoteJudged = {
      ...base, type: 'NoteJudged', verdict: 'correct', midi: event.midi, noteIndex: match, firstTry, intervalErrorMs: errorMs, timing,
    };
    this.lastJudged = judged;
    events.push(judged);
    if (this.pressed.size === step.noteIndices.length) {
      if (this.follow) this.followStep(step);
      events.push(...this.finishStep(step, event.timeMs));
    }
    return events;
  }

  /**
   * A key press before the start. `anyKey`: it starts the count-in and is not a note. `firstNote`: once every key of the
   * first step is down, the clock starts with that step at this press, and each of its keys is judged as pressed now (they
   * set the time, so they are on time); any other key is ignored.
   */
  private startWith(event: NoteEvent): JudgeEvent[] {
    if (this.startOn === 'anyKey') {
      this.transport.start(event.timeMs);
      return [];
    }
    const first = this.steps[0];
    if (!first) return [];
    const keys = [...new Set(first.noteIndices.map((i) => this.chart.notes[i]!.midi))];
    if (!keys.every((midi) => this.held.has(midi))) return [];
    this.transport.startAtTick(first.tick, event.timeMs);
    return keys.flatMap((midi) => this.handle({ ...event, kind: 'on', midi }));
  }

  /** A press of `midi` at `timeMs` is the grace note of the open step or a later one: at most `GRACE_EARLY_MS` before its time. */
  private isGracePress(midi: number, timeMs: number): boolean {
    for (let i = this.stepIndex; i < this.steps.length; i++) {
      const at = this.timeOf(i);
      if (at - GRACE_EARLY_MS > timeMs) return false; // this step and every later one are too far ahead
      if (timeMs <= at && this.graces[i]!.has(midi)) return true;
    }
    return false;
  }

  /**
   * A press of `midi` at `timeMs` is a note of an ornament sign (core_09.AC65, d303): a pitch the sign uses, from
   * `GRACE_EARLY_MS` before its note's time to the next step's time, on the step before the open one or the open one.
   */
  private isOrnamentPress(midi: number, timeMs: number): boolean {
    for (let i = Math.max(0, this.stepIndex - 1); i <= this.stepIndex && i < this.steps.length; i++) {
      if (!this.ornaments[i]!.has(midi)) continue;
      const end = i + 1 < this.steps.length ? this.timeOf(i + 1) : Infinity;
      if (timeMs >= this.timeOf(i) - GRACE_EARLY_MS && timeMs <= end) return true;
    }
    return false;
  }

  private openHold(noteIndex: number, stepIndex: number, pressMs: number, timing: NoteTiming): void {
    const writtenMs = this.timeOf(stepIndex);
    // the following clock goes on from an early press, so the note's length is counted from that press, not from where the
    // clock stood before it
    const startMs = this.follow ? Math.min(writtenMs, pressMs) : writtenMs;
    const valueMs = this.transport.timeOfTick(this.endTicks[noteIndex]!)! - writtenMs;
    let dueMs = startMs + fullHoldMs(valueMs, this.holdRules);
    // AX-3 provisional: a looped section's last notes count as full once held to the wrap (at most 50 ms before the next
    // lap's first window opens, never before the last window closes), so the scene has wrapped on before that lap's first
    // press; a release before then is graded against that same moment
    if (this.loop) dueMs = Math.min(dueMs, Math.max(this.windowOf(this.steps.length - 1).to, this.nextLapOpensMs() - LOOP_WRAP_SLACK_MS));
    this.openHolds.set(this.chart.notes[noteIndex]!.midi, { noteIndex, stepIndex, pressMs, dueMs: Math.max(dueMs, pressMs), timing });
    this.holdsLeft[stepIndex]!++;
  }

  getState(): PlayState {
    return playStateOf({
      stepIndex: this.stepIndex,
      steps: this.steps,
      pressed: this.pressed,
      progress: this.progress,
      held: this.held,
      lastJudged: this.lastJudged,
      timings: this.timings,
    });
  }
}
