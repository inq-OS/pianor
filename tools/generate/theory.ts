import { isWhiteKey, parseNoteName, spellingToMidi, type LevelDefinition } from '../../src/core/chart/index.ts';
import type { Random } from '../../src/core/random.ts';
import type { Hand, Meter } from './model.ts';

/** No rhythm or melody satisfies the request: the generator tries other choices. Any other error is a bug and is not caught. */
export class NoFit extends Error {
  override name = 'NoFit';
}

const MIDDLE_C = 60;

/**
 * The natural notes a hand plays at a level, lowest first. `position` is the hand position the level fingers (the five
 * notes under the fingers); `register` is every natural note of the hand's side of middle C within the level's range
 * (a scale needs more than five). Without a fingering table for the hand, `position` is the register.
 */
export function handNotes(level: LevelDefinition, hand: Hand, span: 'position' | 'register'): number[] {
  const { low, high } = level.range;
  const table = level.fingerings[hand];
  if (span === 'position' && table && Object.keys(table).length > 0) {
    return Object.keys(table)
      .map((name) => spellingToMidi(parseNoteName(name)))
      .filter((m) => m >= low && m <= high)
      .sort((a, b) => a - b);
  }
  const from = hand === 'RH' ? Math.max(low, MIDDLE_C) : low;
  const to = hand === 'LH' ? Math.min(high, MIDDLE_C) : high;
  const out: number[] = [];
  for (let m = from; m <= to; m++) if (isWhiteKey(m)) out.push(m);
  return out;
}

/** Quarter notes in a bar. */
export function beatsPerBar(meter: Meter): number {
  return (meter.num * 4) / meter.den;
}

const VALUE_BEATS = { whole: 4, half: 2, quarter: 1, eighth: 0.5 } as const;

/**
 * Note lengths (in quarter notes, shortest first) the level allows and a bar of `beats` can hold. Pass `eighths: false` to
 * leave eighth notes out (they were, until the staff renderer learned to draw them; a piece the staff cannot draw is left
 * out of the game).
 */
export function allowedBeats(level: LevelDefinition, beats: number, options: { eighths?: boolean } = {}): number[] {
  return level.noteValues
    .filter((v): v is keyof typeof VALUE_BEATS => v in VALUE_BEATS) // the generators write no dotted notes and no sixteenths
    .map((v) => VALUE_BEATS[v])
    .filter((b) => b <= beats && (b !== 0.5 || options.eighths !== false))
    .sort((a, b) => a - b);
}

/** A half note starts on a strong beat and ends in its bar; in 3/4 it may also start on beat 2 and end the bar. */
function halfFits(offset: number, beats: number): boolean {
  return offset + 2 <= beats && (offset % 2 === 0 || (beats === 3 && offset === 1));
}

/** A note or a rest of some length: a bar's rhythm before pitches are chosen. */
export interface Rhythm {
  beats: number;
  rest: boolean;
}

export interface BarOptions {
  /** May quarter rests appear (never on the first beat)? */
  rests: boolean;
  /** Chance that a quarter becomes a rest when rests are allowed. Default 0.12. */
  restChance?: number;
  /** Weight of half notes against quarters (6). Default 2.5. */
  halfWeight?: number;
  /** Weight of a whole-bar note (4/4 only). Default 0.15; 0 for exercises that should have several notes in every bar. */
  wholeWeight?: number;
}

/**
 * A bar's rhythm: quarters mostly, some half notes on strong beats, eighths in pairs on a beat, and (if allowed) quarter
 * rests. The lengths always fill the bar exactly and never start a long note off the beat.
 */
export function composeBar(random: Random, beats: number, allowed: readonly number[], options: BarOptions): Rhythm[] {
  const out: Rhythm[] = [];
  const has = (d: number) => allowed.includes(d);
  let at = 0;
  while (at < beats) {
    const choices: [string, number][] = [];
    if (has(1)) choices.push(['quarter', 6]);
    if (has(2) && halfFits(at, beats)) choices.push(['half', options.halfWeight ?? 2.5]);
    if (has(4) && at === 0 && beats === 4 && (options.wholeWeight ?? 0.15) > 0) choices.push(['whole', options.wholeWeight ?? 0.15]);
    if (has(0.5) && at % 1 === 0 && at + 1 <= beats) choices.push(['eighths', 1.6]);
    if (choices.length === 0) throw new NoFit(`no note length fits at beat ${at + 1} of a ${beats}-beat bar`);
    const pick = random.weighted(choices);
    if (pick === 'quarter') {
      const rest = options.rests && at > 0 && out.length > 0 && !out.at(-1)!.rest && random.chance(options.restChance ?? 0.12);
      out.push({ beats: 1, rest });
      at += 1;
    } else if (pick === 'half') {
      out.push({ beats: 2, rest: false });
      at += 2;
    } else if (pick === 'whole') {
      out.push({ beats: 4, rest: false });
      at += 4;
    } else {
      out.push({ beats: 0.5, rest: false }, { beats: 0.5, rest: false });
      at += 1;
    }
  }
  return out;
}

/** The last bar of a piece: one long note when the bar can hold one, otherwise quarters and a final half note. */
export function composeCadence(_random: Random, beats: number, allowed: readonly number[]): Rhythm[] {
  if (allowed.includes(beats)) return [{ beats, rest: false }];
  const out: Rhythm[] = [];
  let left = beats;
  const long = Math.max(...allowed.filter((d) => d <= left && d >= 2), 1);
  while (left > long) {
    out.push({ beats: 1, rest: false });
    left -= 1;
  }
  out.push({ beats: left, rest: false });
  return out;
}

export interface WalkOptions {
  /** Notes available: indexes 0 to size - 1, in diatonic order. */
  size: number;
  /** Notes to produce. */
  count: number;
  /** Largest move in diatonic steps (1 step, 2 third, 4 fifth). */
  maxLeap: number;
  /** Index of the last note. */
  end: number;
  /** Index of the first note; random among those that can still reach `end` when not given. */
  start?: number;
  /** The note played just before: the first note must be within `maxLeap` of it. */
  from?: number;
  /** Weight of playing the same note again (a step weighs 6). Default 1; 0 means never. */
  repeat?: number;
  /** `runs` keeps going in one direction, `skips` prefers thirds when allowed, `random` has no preference. */
  style?: 'random' | 'runs' | 'skips';
}

const MOVE_WEIGHT = [0, 6, 2.5, 0.8, 0.5];

/**
 * A melody as indexes into a note set: a seeded random walk that moves by at most `maxLeap`, never plays one note three
 * times in a row, and always arrives on `end` as its last note (it only takes moves from which `end` can still be reached).
 */
export function walkTo(random: Random, options: WalkOptions): number[] {
  const { size, count, maxLeap, end } = options;
  const repeat = options.repeat ?? 1;
  const style = options.style ?? 'random';
  if (count < 1) throw new Error('a walk needs at least one note');
  if (end < 0 || end >= size) throw new Error(`the last note ${end} is outside the ${size} notes`);

  const moves: number[] = [];
  for (let d = -maxLeap; d <= maxLeap; d++) if (d !== 0 || repeat > 0) moves.push(d);
  // reach[r][p][again]: can `end` be reached from note p in exactly r more moves, where `again` says the last move was a
  // repeat (so another repeat would play the note three times)?
  const legal = (d: number, again: boolean) => !(d === 0 && again);
  const reach: boolean[][][] = [Array.from({ length: size }, (_, p) => [p === end, p === end])];
  for (let r = 1; r < count; r++) {
    reach.push(
      Array.from({ length: size }, (_, p) =>
        [false, true].map((again) => moves.some((d) => legal(d, again) && reach[r - 1]![p + d]?.[d === 0 ? 1 : 0] === true)),
      ),
    );
  }
  const canFinish = (p: number, remaining: number, again: boolean) => reach[remaining]?.[p]?.[again ? 1 : 0] === true;

  let first: number;
  if (options.start !== undefined) {
    if (!canFinish(options.start, count - 1, false)) throw new NoFit(`cannot reach note ${end} from note ${options.start} in ${count} notes`);
    first = options.start;
  } else {
    const starts = Array.from({ length: size }, (_, p) => p).filter((p) => canFinish(p, count - 1, false) && (options.from === undefined || moves.includes(p - options.from)));
    if (starts.length === 0) throw new NoFit(`cannot reach note ${end} in ${count} notes${options.from === undefined ? '' : ` from note ${options.from}`}`);
    first = random.pick(starts);
  }

  const walk = [first];
  let again = false;
  while (walk.length < count) {
    const here = walk.at(-1)!;
    const before = walk.at(-2);
    const remaining = count - walk.length;
    const lastMove = before === undefined ? 0 : here - before;
    const weigh = (d: number): number => {
      if (!legal(d, again) || !canFinish(here + d, remaining - 1, d === 0)) return 0;
      let w = d === 0 ? repeat : (MOVE_WEIGHT[Math.min(4, Math.abs(d))] ?? 0.3);
      if (style === 'runs' && d !== 0 && lastMove !== 0) w *= Math.sign(d) === Math.sign(lastMove) ? 4 : 0.3;
      if (style === 'skips' && Math.abs(d) === 2) w *= 4;
      return w;
    };
    const move = random.weighted(moves.map((d) => [d, weigh(d)] as const));
    walk.push(here + move);
    again = move === 0;
  }
  return walk;
}

/** The same notes moved by `by` steps, or null when one would leave the `size` notes. */
export function shiftDegrees(degrees: readonly number[], by: number, size: number): number[] | null {
  const moved = degrees.map((d) => d + by);
  return moved.every((d) => d >= 0 && d < size) ? moved : null;
}

export interface FitOptions {
  /** Notes to give a length. */
  notes: number;
  beats: number;
  bars: number;
  allowed: readonly number[];
  /** Notes that should be long (the top of a scale, the last note). */
  long: readonly number[];
}

const FIT_LIMIT = 40_000;

/**
 * Lengths for a fixed number of notes that fill exactly `bars` bars, without crossing a bar line and with long notes on
 * strong beats: quarters mostly, longer where asked. Throws when there is no way to fit them.
 */
export function fitRhythm(random: Random, options: FitOptions): number[] {
  const { notes, beats, bars, long } = options;
  const allowed = options.allowed.filter((d) => d >= 1);
  const total = bars * beats;
  const shortest = Math.min(...allowed);
  const longest = Math.max(...allowed);
  const out: number[] = [];
  let tries = 0;

  const place = (i: number, used: number): boolean => {
    if (++tries > FIT_LIMIT) return false;
    if (i === notes) return used === total;
    const left = notes - i - 1;
    const offset = used % beats;
    const candidates = allowed.filter((d) => {
      if (offset + d > beats) return false;
      if (d === 2 && !halfFits(offset, beats)) return false;
      if (d === 4 && offset !== 0) return false;
      const rest = total - used - d;
      return rest >= left * shortest && rest <= left * longest;
    });
    const wantLong = long.includes(i);
    const ordered: number[] = [];
    const pool = candidates.map((d) => [d, wantLong ? d * d : d === 1 ? 6 : d === 2 ? 1.5 : 0.7] as const);
    for (let k = pool.length; k > 0; k--) {
      const live = pool.filter(([d]) => !ordered.includes(d));
      ordered.push(random.weighted(live));
    }
    for (const d of ordered) {
      out[i] = d;
      if (place(i + 1, used + d)) return true;
    }
    return false;
  };

  if (!place(0, 0)) throw new NoFit(`${notes} notes do not fit ${bars} bars of ${beats} beats with these note lengths`);
  return out;
}
