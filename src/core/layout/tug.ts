import { BAND_ROWS } from './band';
import type { Point } from './talk';

/**
 * The tug's board (ft_1_21.AC7, WP-10, the painter's part CT-P6; take B of sketch 1): while a tug plays, the
 * band's cells give way to a dark board, as they do for a talk's choices, and across it runs a rope between two round
 * tokens, the student's on the left and the character's on the right. A red rag tied on the rope marks the standing. It
 * moves as in a real tug of war: a won exchange pulls it one place toward the student's end, a lost one toward the
 * character's. Chalk marks on the board under the rope show every place it can stand, the middle and both ends marked
 * apart, so a student sees how far there is to go. Pure: the view only draws it. Layout cells, from the band's top-left.
 *
 * AX-3 provisional (ft_1_21, d129): the sizes are the painter's first fit for a 320-wide band; the students's try-out
 * (ft_1_21.AC11) may move them, and these tests move with them.
 */
export const TUG = {
  /** The tokens' radius, and how far their middles stand in from the board's ends. */
  tokenRadius: 10,
  tokenIn: 34,
  /** The tokens' middles, and the rope's top at its ends, from the band's top. */
  tokenY: 24,
  ropeY: 22,
  /** The rope's thickness and how far it sags in the middle. */
  ropeThick: 4,
  sag: 4,
  /** The rope reaches this far under each token (it is tied behind it). */
  ropeUnder: 4,
  /** The first and last places stand this far in from the rope's ends. */
  placeIn: 16,
  /** The chalk marks' top and length (the middle's and the ends' are longer). */
  chalkY: 40,
  chalk: 3,
  chalkLong: 6,
  /** The note that bobs over the token whose turn it is: its foot this far over the token's top. */
  noteOver: 3,
} as const;

export interface TugBoard {
  /** The tokens' middles. */
  readonly student: Point;
  readonly character: Point;
  /** The rope's ends (x) and its top at the ends (y); it sags `TUG.sag` at its middle. */
  readonly rope: { readonly x0: number; readonly x1: number; readonly y: number };
  /** Each place the rag can stand, the student's end first: `2 * steps + 1` of them, the middle one the start. */
  readonly places: readonly number[];
}

/** The board for a band `width` cells wide and a tug of `steps` steps each way. */
export function tugBoard(width: number, steps: number): TugBoard {
  if (!Number.isInteger(steps) || steps < 1) throw new RangeError(`a tug has at least one step, not ${steps}`);
  const student = { x: TUG.tokenIn, y: TUG.tokenY };
  const character = { x: width - TUG.tokenIn, y: TUG.tokenY };
  const x0 = student.x + TUG.tokenRadius - TUG.ropeUnder;
  const x1 = character.x - TUG.tokenRadius + TUG.ropeUnder;
  const first = x0 + TUG.placeIn, last = x1 - TUG.placeIn;
  const count = 2 * steps + 1;
  const places = Array.from({ length: count }, (_, i) => Math.round(first + ((last - first) * i) / (count - 1)));
  if (BAND_ROWS < TUG.chalkY + TUG.chalkLong) throw new RangeError('the chalk runs off the band');
  return { student, character, rope: { x0, x1, y: TUG.ropeY }, places };
}

/** The rope's top at `x`: a gentle sag, deepest in the middle. */
export function ropeTop(board: TugBoard, x: number): number {
  const { x0, x1, y } = board.rope;
  const t = (2 * (x - x0)) / (x1 - x0) - 1;
  return Math.round(y + TUG.sag * (1 - t * t));
}

/**
 * Where the rag stands for `standing` (`tug.ts`: plus toward the student's win). The student's wins pull it toward their
 * own end, as a rope's rag goes to the side that pulls harder.
 */
export function ragPlace(board: TugBoard, standing: number): Point {
  const steps = (board.places.length - 1) / 2;
  if (!Number.isInteger(standing) || Math.abs(standing) > steps) throw new RangeError(`standing ${standing} of ${steps} steps`);
  const x = board.places[steps - standing]!;
  return { x, y: ropeTop(board, x) };
}

/** Which kind of chalk mark a place gets: the middle (where it starts), an end (where it is decided) or a step. */
export function chalkOf(board: TugBoard, index: number): 'middle' | 'end' | 'step' {
  const last = board.places.length - 1;
  if (index === last / 2) return 'middle';
  return index === 0 || index === last ? 'end' : 'step';
}

/**
 * The notes that rise from a player while they play (the character while its phrase sounds): `count` notes, each rising
 * `rise` cells over `periodMs`, swaying a little and drifting `drift` cells sideways (toward the open middle of the
 * screen: plus to the right), one after another, so one is always on its way up. Offsets from the place they rise from,
 * at `ms`; `shown` is false for a note between two rises. Pure, so motion can be held still (the view gives a fixed `ms`
 * when motion is off).
 */
export function risingNotes(ms: number, drift = 0, count = 3, periodMs = 1500, rise = 18): { dx: number; dy: number; shown: boolean }[] {
  return Array.from({ length: count }, (_, i) => {
    const t = (((ms / periodMs + i / count) % 1) + 1) % 1;
    return { dx: Math.round(Math.sin(t * Math.PI * 2 + i * 2) * 2 + drift * t), dy: -Math.round(t * rise), shown: t < 0.85 };
  });
}

/** The note over the token whose turn it is bobs one cell up and down. */
export function turnNoteBob(ms: number, periodMs = 800): number {
  return Math.floor(((ms % periodMs) + periodMs) % periodMs / (periodMs / 2)) === 0 ? 0 : -1;
}
