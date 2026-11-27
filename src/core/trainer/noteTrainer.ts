/**
 * Note-name trainer rules (ft_0_17). Pure: no DOM, no Phaser, no io.
 * The student names the shown note on the keyboard. A wrong press costs one life and says why (classifyWrongNote);
 * the third lost life ends the round. XP already earned is kept. Keys pressed together are one press (AC8), and a note
 * whose name was shown after a wrong press earns no XP when it is then found (AC9).
 */
import { PIECE_HIGH, PIECE_LOW, isWhiteKey } from '../chart/pitch';
import { classifyWrongNote } from '../judge/classify';
import type { WrongReason } from '../judge/types';
import { Random } from '../random';

export const NOTE_TRAINER_LIVES = 3;
/** Provisional: XP for one right name. Tune after playtests. */
export const NOTE_TRAINER_XP_PER_NOTE = 10;
/**
 * AX-3 provisional: keys pressed within this many ms of a press's first key are one press (a slipped finger, a chord):
 * right if any key is right, else one miss (ft_0_17.AC8).
 */
export const NOTE_TRAINER_CHORD_WINDOW_MS = 40;

export interface TrainerRange {
  /** Lowest MIDI key of the step, inclusive. */
  low: number;
  /** Highest MIDI key of the step, inclusive. */
  high: number;
  /** Only the white keys of the range are asked (a beginner's first steps, ft_0_17.AC10). */
  whiteKeys?: boolean;
}

/** The press being made: when its first key came, and the round before it when that key was wrong (so a right key with it can stand instead). */
interface OpenPress {
  readonly atMs: number;
  readonly before: TrainerRound | null;
}

export interface TrainerRound {
  readonly range: TrainerRange;
  readonly seed: string;
  /** How many targets have been answered right (the notes found); keys the seeded stream of the next target. */
  readonly step: number;
  /** The notes found in this round, the same as `step`: the round's result line reads it. */
  readonly found: number;
  readonly target: number;
  readonly lives: number;
  readonly xp: number;
  readonly over: boolean;
  /** The shown note's name was given away by a wrong press: finding it now earns no XP (AC9). */
  readonly named: boolean;
  /** The last press's first key, for joining keys pressed together (AC8); null when presses carry no time. */
  readonly press: OpenPress | null;
}

/** `joined`: a key pressed together with the last press, which was already judged; it changes nothing. */
export type PressVerdict = 'correct' | 'wrong' | 'over' | 'joined';

export interface PressResult {
  verdict: PressVerdict;
  /** Set on a wrong press: why the key was wrong. */
  reason?: WrongReason;
  /** Set on a wrong press: whether the key played is higher or lower than the shown note. */
  direction?: 'higher' | 'lower';
  /** The XP this press earned: a right name read without help, else 0. */
  earned: number;
  round: TrainerRound;
}

/** The keys a target is drawn from. */
function keysOf(range: TrainerRange): number[] {
  const keys: number[] = [];
  for (let k = range.low; k <= range.high; k++) if (!range.whiteKeys || isWhiteKey(k)) keys.push(k);
  return keys;
}

function checkRange(range: TrainerRange): void {
  const { low, high } = range;
  if (!Number.isInteger(low) || !Number.isInteger(high)) throw new RangeError('range must be whole MIDI keys');
  if (low < PIECE_LOW || high > PIECE_HIGH || low > high) {
    throw new RangeError(`range ${low}..${high} is outside ${PIECE_LOW}..${PIECE_HIGH}`);
  }
  if (keysOf(range).length === 0) throw new RangeError(`range ${low}..${high} has no white key`);
}

/** A seeded target from the range's keys; it never repeats `previous` when the range has another key. */
export function pickTarget(random: Random, range: TrainerRange, previous: number | null): number {
  const keys = keysOf(range);
  const at = previous === null ? -1 : keys.indexOf(previous);
  if (at < 0 || keys.length === 1) return keys[random.int(0, keys.length - 1)]!;
  const k = random.int(0, keys.length - 2);
  return keys[k >= at ? k + 1 : k]!;
}

function targetFor(range: TrainerRange, seed: string, step: number, previous: number | null): number {
  return pickTarget(Random.derive(seed, step), range, previous);
}

/** A new round with three lives, no XP and the first target. The same seed gives the same targets. */
export function createRound(range: TrainerRange, seed: string): TrainerRound {
  checkRange(range);
  return {
    range,
    seed,
    step: 0,
    found: 0,
    target: targetFor(range, seed, 0, null),
    lives: NOTE_TRAINER_LIVES,
    xp: 0,
    over: false,
    named: false,
    press: null,
  };
}

/** The shown note is found: the next one comes; XP only when its name was not given away. */
function found(round: TrainerRound, press: OpenPress | null): PressResult {
  const step = round.step + 1;
  const earned = round.named ? 0 : NOTE_TRAINER_XP_PER_NOTE;
  return {
    verdict: 'correct',
    earned,
    round: { ...round, step, found: step, target: targetFor(round.range, round.seed, step, round.target), xp: round.xp + earned, named: false, press },
  };
}

/**
 * Judge one key press against the shown note. `atMs` is the key's time (the note event's clock): a key within
 * `NOTE_TRAINER_CHORD_WINDOW_MS` of the last press's first key joins that press (AC8), so a right key in it makes the press
 * right and a second wrong key costs nothing more. Without a time every key is a press of its own. A press after the round
 * is over changes nothing.
 */
export function pressKey(round: TrainerRound, midi: number, atMs?: number): PressResult {
  const open = round.press;
  if (atMs !== undefined && open && atMs >= open.atMs && atMs - open.atMs <= NOTE_TRAINER_CHORD_WINDOW_MS) {
    // the press was wrong and this key is the right one: the press is right, as if the wrong key had not been played
    if (open.before && midi === open.before.target) return found(open.before, { atMs: open.atMs, before: null });
    return { verdict: 'joined', earned: 0, round };
  }
  if (round.over) return { verdict: 'over', earned: 0, round };
  if (midi === round.target) return found(round, atMs === undefined ? null : { atMs, before: null });
  const { reason, direction } = classifyWrongNote(midi, [round.target]);
  const lives = round.lives - 1;
  const press = atMs === undefined ? null : { atMs, before: { ...round, press: null } };
  return { verdict: 'wrong', reason, direction, earned: 0, round: { ...round, lives, over: lives === 0, named: true, press } };
}
