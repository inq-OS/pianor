/**
 * Note-name trainer rules (ft_0_17). Pure: no DOM, no Phaser, no io.
 * The student names the shown note on the keyboard. A wrong press costs one life and says why (classifyWrongNote);
 * the third lost life ends the round. XP already earned is kept.
 */
import { PIECE_HIGH, PIECE_LOW } from '../chart/pitch';
import { classifyWrongNote } from '../judge/classify';
import type { WrongReason } from '../judge/types';
import { Random } from '../random';

export const NOTE_TRAINER_LIVES = 3;
/** Provisional: XP for one right name. Tune after playtests. */
export const NOTE_TRAINER_XP_PER_NOTE = 10;

export interface TrainerRange {
  /** Lowest MIDI key of the step, inclusive. */
  low: number;
  /** Highest MIDI key of the step, inclusive. */
  high: number;
}

export interface TrainerRound {
  readonly range: TrainerRange;
  readonly seed: string;
  /** How many targets have been answered right; keys the seeded stream of the next target. */
  readonly step: number;
  readonly target: number;
  readonly lives: number;
  readonly xp: number;
  readonly over: boolean;
}

export type PressVerdict = 'correct' | 'wrong' | 'over';

export interface PressResult {
  verdict: PressVerdict;
  /** Set on a wrong press: why the key was wrong. */
  reason?: WrongReason;
  /** Set on a wrong press: whether the key played is higher or lower than the shown note. */
  direction?: 'higher' | 'lower';
  round: TrainerRound;
}

function checkRange(range: TrainerRange): void {
  const { low, high } = range;
  if (!Number.isInteger(low) || !Number.isInteger(high)) throw new RangeError('range must be whole MIDI keys');
  if (low < PIECE_LOW || high > PIECE_HIGH || low > high) {
    throw new RangeError(`range ${low}..${high} is outside ${PIECE_LOW}..${PIECE_HIGH}`);
  }
}

/** A seeded target from the range; it never repeats `previous` when the range has another key. */
export function pickTarget(random: Random, range: TrainerRange, previous: number | null): number {
  const { low, high } = range;
  if (previous === null || previous < low || previous > high || low === high) return random.int(low, high);
  const k = random.int(low, high - 1);
  return k >= previous ? k + 1 : k;
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
    target: targetFor(range, seed, 0, null),
    lives: NOTE_TRAINER_LIVES,
    xp: 0,
    over: false,
  };
}

/** Judge one key press against the shown note. A press after the round is over changes nothing. */
export function pressKey(round: TrainerRound, midi: number): PressResult {
  if (round.over) return { verdict: 'over', round };
  if (midi === round.target) {
    const step = round.step + 1;
    return {
      verdict: 'correct',
      round: {
        ...round,
        step,
        target: targetFor(round.range, round.seed, step, round.target),
        xp: round.xp + NOTE_TRAINER_XP_PER_NOTE,
      },
    };
  }
  const { reason, direction } = classifyWrongNote(midi, [round.target]);
  const lives = round.lives - 1;
  return { verdict: 'wrong', reason, direction, round: { ...round, lives, over: lives === 0 } };
}
