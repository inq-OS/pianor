/**
 * Pitch trainer by ear rules (ft_1_10). Pure: no DOM, no Phaser, no io.
 * The game sounds one note or two; the student finds them on the keys. Points come from misses per question,
 * and the ear level, stars and the current star's points all come from one total of points that never goes down.
 * The ear level table itself is content (content/trainer/ear-levels.json); this file only reads rows.
 */
import { classifyWrongNote } from '../judge/classify';
import type { WrongReason } from '../judge/types';
import { Random } from '../random';
import { MS_PER_SECOND } from '../chart';

/** One star is 100 points (ft_1_10 AC5). */
export const EAR_STAR_POINTS = 100;

/** Points for a question by its misses: 0, 1, 2, 3, 4, then 0 from 5 on (ft_1_10 AC4). */
const POINTS_BY_MISSES = [100, 50, 25, 12, 6] as const;

export function pointsForMisses(misses: number): number {
  if (!Number.isInteger(misses) || misses < 0) throw new RangeError('misses must be a whole number, 0 or more');
  return misses < POINTS_BY_MISSES.length ? POINTS_BY_MISSES[misses]! : 0;
}

/** Ear level N needs 5 + N stars. */
export function starsNeeded(level: number): number {
  return 5 + level;
}

export interface EarLevel {
  level: number;
  /** Full stars in the current level. */
  stars: number;
  /** Points towards the next star, below EAR_STAR_POINTS. */
  starPoints: number;
}

/** Level, stars and the current star's points from the total ear points (ft_1_10 AC5). */
export function earLevelOf(totalPoints: number): EarLevel {
  if (!Number.isInteger(totalPoints) || totalPoints < 0) throw new RangeError('total points must be a whole number, 0 or more');
  let level = 1;
  let rest = totalPoints;
  while (rest >= starsNeeded(level) * EAR_STAR_POINTS) {
    rest -= starsNeeded(level) * EAR_STAR_POINTS;
    level += 1;
  }
  return { level, stars: Math.floor(rest / EAR_STAR_POINTS), starPoints: rest % EAR_STAR_POINTS };
}

export type EarMode = 'single' | 'two';

/** One row of the ear levels table: the mode and the keys its questions are drawn from. */
export interface EarRow {
  mode: EarMode;
  /** MIDI keys, at least one, all distinct. Two-note questions need at least two. */
  keys: readonly number[];
}

/** Level N reads row N; a level past the table uses the last row. */
export function earRowFor(table: readonly EarRow[], level: number): EarRow {
  if (table.length === 0) throw new RangeError('the ear levels table is empty');
  if (!Number.isInteger(level) || level < 1) throw new RangeError('level must be a whole number, 1 or more');
  return table[Math.min(level, table.length) - 1]!;
}

function pickFrom(random: Random, keys: readonly number[], avoid: number | undefined): number {
  const allowed = keys.filter((k) => k !== avoid);
  return random.pick(allowed.length > 0 ? allowed : keys);
}

/**
 * The notes of question number `index` (seeded: the same seed and index give the same notes).
 * It never repeats the previous question's first note when the row has another key. Two-note questions are two different keys.
 */
export function pickQuestion(seed: string, index: number, row: EarRow, previous: readonly number[] | null): number[] {
  if (row.keys.length === 0) throw new RangeError('a row needs at least one key');
  const random = Random.derive(seed, index);
  const first = pickFrom(random, row.keys, previous?.[0]);
  if (row.mode === 'single') return [first];
  if (row.keys.length < 2) throw new RangeError('a two-note row needs at least two keys');
  const second = pickFrom(random, row.keys, first);
  return [first, second];
}

export interface EarQuestion {
  /** The notes in the order they must be played. */
  readonly notes: readonly number[];
  /** Index of the note expected next. */
  readonly index: number;
  /** Wrong presses so far, all notes together. */
  readonly misses: number;
  readonly done: boolean;
}

export function startQuestion(notes: readonly number[]): EarQuestion {
  if (notes.length === 0) throw new RangeError('a question needs at least one note');
  return { notes, index: 0, misses: 0, done: false };
}

export type EarVerdict = 'next' | 'done' | 'miss' | 'closed';

export interface EarPressResult {
  verdict: EarVerdict;
  /** Set on a miss: why the key was wrong (classifyWrongNote). */
  reason?: WrongReason;
  /** Set on a miss: whether the key played is higher or lower than the expected note. */
  direction?: 'higher' | 'lower';
  question: EarQuestion;
}

/** Judge one key press against the expected note. A press after the question is done changes nothing. */
export function pressEar(question: EarQuestion, midi: number): EarPressResult {
  if (question.done) return { verdict: 'closed', question };
  const expected = question.notes[question.index]!;
  if (midi !== expected) {
    const { reason, direction } = classifyWrongNote(midi, [expected]);
    return { verdict: 'miss', reason, direction, question: { ...question, misses: question.misses + 1 } };
  }
  const index = question.index + 1;
  const done = index === question.notes.length;
  return { verdict: done ? 'done' : 'next', question: { ...question, index, done } };
}

/** How long a question takes to repeat: twice its sounding time (sound plus an equal wait), in ms. */
export function repeatAfterMs(seconds: number): number {
  if (!Number.isInteger(seconds) || seconds < 1 || seconds > 3) throw new RangeError('duration must be whole seconds, 1 to 3');
  return seconds * 2 * MS_PER_SECOND;
}

export interface RepeatInput {
  /** Injected clock, ms. */
  now: number;
  /** End of the last sound or the last key press, ms, on the same clock. */
  lastActivityMs: number;
  seconds: number;
  repeatOn: boolean;
}

/** Repeat is due when it is on and nothing happened for repeatAfterMs. */
export function isRepeatDue(input: RepeatInput): boolean {
  if (!input.repeatOn) return false;
  return input.now - input.lastActivityMs >= repeatAfterMs(input.seconds);
}

/** Stars shown after every round (ft_1_10 AC10): all lit on the first try. */
export const EAR_ROUND_STARS = 5;

/** Lit stars for a round: 5 minus the misses, never below 0. Each miss dims one star. */
export function roundStars(misses: number): number {
  if (!Number.isInteger(misses) || misses < 0) throw new RangeError('misses must be a whole number, 0 or more');
  return Math.max(0, EAR_ROUND_STARS - misses);
}

/**
 * How long the answer stays before a key may continue, ms (ft_1_10 AC11). A key pressed twice by accident must not skip the
 * answer, which ties the sound to its name and its note (AC7, AX-0).
 * AX-3 provisional: how long the answer stays at least; chose half a second because it is the shortest that survives a double press.
 */
export const EAR_ANSWER_MIN_MS = 500;

/**
 * After a key continues, the next question sounds this much later, ms (ft_1_10 AC11). Keys pressed before it sounds are not
 * answers, so the key that continued never counts as a miss, and its own sound has faded before the question plays (AX-0).
 * AX-3 provisional: the pause before the next question; chose half a second, the same as the answer's minimum.
 */
export const EAR_NEXT_PAUSE_MS = 500;

export interface EarKeyState {
  /** The question is found and its answer shows. */
  done: boolean;
  /** When the question was found, ms; null while it is open. */
  doneAtMs: number | null;
  /** When the open question starts to sound, ms; keys before it are ignored. */
  soundsAtMs: number;
}

export type EarKeyAction = 'answer' | 'continue' | 'ignore';

/** What one key press does (ft_1_10 AC11): it answers an open question, continues after a found one, or is ignored. */
export function earKeyAction(state: EarKeyState, now: number): EarKeyAction {
  if (state.done) return now - (state.doneAtMs ?? now) >= EAR_ANSWER_MIN_MS ? 'continue' : 'ignore';
  return now < state.soundsAtMs ? 'ignore' : 'answer';
}
