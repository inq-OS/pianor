/**
 * Judge types and domain events. Pure: no DOM, no io, no UI.
 * Events are versioned (`v`); see `JUDGE_EVENT_VERSION`. Progression, battle, achievements and dashboards
 * listen to these events and never reach into judge internals (docs/futureproofing.md 1.3).
 */

/**
 * 2 (d093, core_01 slice f): in Tempo mode a note's timing also grades its hold, and bar, phrase and piece results wait for
 * the holds of their notes. Events of version 1 (older replays and fixtures) are still read: their fields are the same.
 */
export const JUDGE_EVENT_VERSION = 2;

/** Every judge event version a consumer may meet. */
export type JudgeEventVersion = 1 | typeof JUDGE_EVENT_VERSION;

/** One key event from any source: real keyboard, mock, virtual player, replay. Never a Web MIDI object. */
export interface NoteEvent {
  kind: 'on' | 'off';
  midi: number;
  /** 0 to 127. A note-on with velocity 0 is a note-off, whatever `kind` says. */
  velocity: number;
  /** Milliseconds on the song/audio clock. Only used to track rhythm; Wait mode never fails a note on timing. */
  timeMs: number;
  /** Where the event came from, e.g. "keyboard", "mock", "replay". */
  source: string;
}

export interface Hints {
  noteNames: boolean;
  fingers: boolean;
}

/** Why a wrong key was wrong. Drives gentle feedback for a student. */
export type WrongReason = 'wrong-octave' | 'neighbour-key' | 'wrong-letter';

/** How well a note was timed (Tempo mode). The error is the press against where the note falls on the clock, in ms. */
export type TimingVerdict = 'on-time' | 'early' | 'late';

export interface NoteTiming {
  /** Positive is late, negative is early. */
  errorMs: number;
  verdict: TimingVerdict;
  /**
   * 0 to 100: 100 for a press within the perfect window, falling to 0 at the edge of the playing window. With hold grading
   * (d093) it is the press score times the hold factor once the hold is known, and the press score until then.
   */
  score: number;
  /** With hold grading: the score of the press alone. */
  pressScore?: number;
  /** With hold grading, once known: 0 to 100, how much of the full hold the key was held (100 is full). */
  hold?: number;
}

/** Timing of a bar, phrase or piece in Tempo mode. Missed notes count as a score of 0. */
export interface TimingStats {
  /** Notes pressed in time (on time, early or late). */
  played: number;
  onTime: number;
  early: number;
  late: number;
  missed: number;
  /** Mean absolute error of the notes that were played, or null when none was. */
  meanAbsErrorMs: number | null;
  /** Mean score over every note of the step set, missed ones as 0: 0 to 100. */
  score: number;
  /** With hold grading (d093): the played notes held in full and those let go too early. */
  holds?: { full: number; short: number };
}

export interface PlayStats {
  /** Notes the player had to play. */
  notes: number;
  /** Notes played right with no wrong key before them in their step. */
  firstTryCorrect: number;
  /** Wrong key presses. Mashing counts here but never lowers accuracy below the first-try count. */
  mistakes: number;
  /** firstTryCorrect / notes, or 1 when there are no notes. */
  accuracy: number;
  /** Mean absolute rhythm error in ms between consecutive steps, or null. Tracked, never punished. */
  rhythmErrorMs: number | null;
  /** Correct notes played while each hint was switched on. Hints cost reward, never below zero. */
  hints: { noteNames: number; fingers: number };
  /**
   * Notes in steps where the right and left hand play at once, and how many of those steps were played together:
   * all keys pressed within the together window and no wrong key first. MIDI cannot tell which hand pressed a key,
   * so "together" means "pressed at nearly the same time". Feeds the two-hands bonus.
   */
  bothHands: { notes: number; together: number };
  /** Only in Tempo mode. */
  timing?: TimingStats;
}

export interface BarResult extends PlayStats {
  bar: number;
}

export interface PhraseResult extends PlayStats {
  name: string;
  startBar: number;
  endBar: number;
}

export interface PieceResult extends PlayStats {
  chartId: string;
  contentVersion: number;
}

interface EventBase {
  v: JudgeEventVersion;
  timeMs: number;
}

export interface CorrectNoteJudged extends EventBase {
  type: 'NoteJudged';
  verdict: 'correct';
  midi: number;
  /** Index into `chart.notes` of the note that was matched. */
  noteIndex: number;
  stepIndex: number;
  bar: number;
  firstTry: boolean;
  /** Rhythm error of this step's onset against the previous step's, in ms (positive = late). Null for the first step and chord extras. */
  intervalErrorMs: number | null;
  /** Only in Tempo mode (there `intervalErrorMs` is the same error against the clock). */
  timing?: NoteTiming;
  hints: Hints;
}

export interface WrongNoteJudged extends EventBase {
  type: 'NoteJudged';
  verdict: 'wrong';
  midi: number;
  /** The awaited note this press was closest to. */
  expectedMidi: number;
  reason: WrongReason;
  /** Where the played key is relative to the expected one. */
  direction: 'higher' | 'lower';
  stepIndex: number;
  bar: number;
  hints: Hints;
}

export type NoteJudged = CorrectNoteJudged | WrongNoteJudged;

export interface BarCompleted extends EventBase {
  type: 'BarCompleted';
  result: BarResult;
}

export interface PhraseCompleted extends EventBase {
  type: 'PhraseCompleted';
  result: PhraseResult;
}

export interface PieceCompleted extends EventBase {
  type: 'PieceCompleted';
  result: PieceResult;
}

/**
 * Tempo mode only: a note whose time ran out with no press. Its own event type, not a third `NoteJudged` verdict, so
 * consumers that read `NoteJudged` keep working unchanged (they ignore events they do not know).
 */
export interface NoteMissed extends EventBase {
  type: 'NoteMissed';
  midi: number;
  noteIndex: number;
  stepIndex: number;
  bar: number;
  hints: Hints;
}

export type JudgeEvent = NoteJudged | NoteMissed | BarCompleted | PhraseCompleted | PieceCompleted;

export type NoteProgress = 'pending' | 'correct' | 'missed';

/** Everything a view may read. Views never decide correctness. */
export interface PlayState {
  done: boolean;
  /** Current step (a note or a chord), or `stepCount` when done. */
  stepIndex: number;
  stepCount: number;
  /** Chart note indices still awaited in the current step. */
  awaiting: readonly number[];
  /** Per chart note index. Notes outside the played tracks stay pending. */
  noteProgress: readonly NoteProgress[];
  /** Keys currently held down, as far as the judge has seen. */
  heldKeys: readonly number[];
  lastJudged: NoteJudged | null;
  /** Tempo mode: per chart note, how it was timed (null when not played or missed). Absent in Wait mode. */
  timings?: readonly (NoteTiming | null)[];
}

/**
 * A play mode decides when a performance is right and turns key events into domain events.
 * Wait is the first implementation; Tempo, Free play and Echo can follow without touching consumers.
 */
export interface PlayMode {
  readonly id: string;
  handle(event: NoteEvent): JudgeEvent[];
  /**
   * Let time pass: `nowMs` is the clock now. Modes that run on the clock (Tempo) close the notes whose time is over and
   * return the events; Wait has nothing to do. The scene calls it every frame.
   */
  advance?(nowMs: number): JudgeEvent[];
  setHints?(hints: Hints): void;
  getState(): PlayState;
}
