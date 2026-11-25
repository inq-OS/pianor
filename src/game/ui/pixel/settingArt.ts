import type { PlaySettings } from '../../../core/judge/playSettings';
import { barNumbersToShow, type BarNumberMode } from '../../../core/layout/barNumbers';
import type { DurationMark } from '../../../core/layout/durationHelp';
import type { StaffSettings } from '../../../core/layout/staffSettings';
import { createBitmap, type Bitmap } from './bitmap';
import { C } from './palette';

/**
 * The pictures on the settings buttons: each choice drawn the way the student sees it while playing,
 * mostly a scrap of the staff paper with its notes, so a button needs no word. Original, drawn for this project; the previews
 * chosen from are in the project's art folder. Every picture is SYMBOL_WIDTH x SYMBOL_HEIGHT.
 */
export const SYMBOL_WIDTH = 34;
export const SYMBOL_HEIGHT = 22;

type Canvas = { width: number; height: number; pixels: Uint8Array };

const INK = C.ink;
const put = (b: Canvas, x: number, y: number, c: number) => {
  if (x >= 0 && y >= 0 && x < b.width && y < b.height) b.pixels[y * b.width + x] = c;
};
const hline = (b: Canvas, x0: number, x1: number, y: number, c: number = INK) => {
  for (let x = x0; x <= x1; x++) put(b, x, y, c);
};
const vline = (b: Canvas, x: number, y0: number, y1: number, c: number = INK) => {
  for (let y = y0; y <= y1; y++) put(b, x, y, c);
};
const paper = (): Canvas => {
  const b = createBitmap(SYMBOL_WIDTH, SYMBOL_HEIGHT);
  b.pixels.fill(C.cream);
  return b;
};
/** `lines` staff lines from row `top`, `gap` rows apart, from x0 to x1. */
const staff = (b: Canvas, top: number, { x0 = 1, x1 = SYMBOL_WIDTH - 2, lines = 5, gap = 3 } = {}) => {
  for (let i = 0; i < lines; i++) hline(b, x0, x1, top + gap * i);
};
/** A filled note head centred near (x, y) with its stem up on the right, as on the practice staff. */
const note = (b: Canvas, x: number, y: number, c: number = INK, stem = 7) => {
  for (const [dx, dy] of [[0, -1], [1, -1], [2, -1], [-1, 0], [0, 0], [1, 0], [2, 0], [-1, 1], [0, 1], [1, 1]] as const) put(b, x + dx, y + dy, c);
  vline(b, x + 2, y - stem, y - 1, c);
};
/** Digits 3 x 5, for the scores. */
const DIGITS: Readonly<Record<string, readonly string[]>> = {
  '0': ['###', '#.#', '#.#', '#.#', '###'], '1': ['.#.', '##.', '.#.', '.#.', '###'], '2': ['##.', '..#', '.#.', '#..', '###'],
  '3': ['##.', '..#', '.#.', '..#', '##.'], '4': ['#.#', '#.#', '###', '..#', '..#'], '5': ['###', '#..', '##.', '..#', '##.'],
  '6': ['.##', '#..', '###', '#.#', '###'], '7': ['###', '..#', '.#.', '.#.', '.#.'], '8': ['###', '#.#', '###', '#.#', '###'], '9': ['###', '#.#', '###', '..#', '##.'],
};
const digits = (b: Canvas, x: number, y: number, value: string, c: number = INK) => {
  [...value].forEach((ch, i) => DIGITS[ch]!.forEach((row, dy) => [...row].forEach((bit, dx) => { if (bit === '#') put(b, x + i * 4 + dx, y + dy, c); })));
};

/** Tempo's timing view: three notes after they were played, plain (off), in the score colours, or with their scores. */
export function scoreSymbol(view: PlaySettings['scoreView']): Bitmap {
  const b = paper();
  const top = view === 'number' ? 8 : 6;
  staff(b, top);
  // black is on time, gold mistimed, red missed: the colours of `scoreColour`
  const colours = view === 'colour' ? [INK, C.gold, C.red] : [INK, INK, INK];
  const scores = ['9', '6', '0'];
  [6, 15, 24].forEach((x, i) => {
    note(b, x, top + 9 - 3 * i, colours[i]);
    if (view === 'number') digits(b, x, 0, scores[i]!);
  });
  return b;
}

/** Space between the two staves of a two-hand piece: the grand staff with its brace, close together or far apart. */
export function staffGapSymbol(gap: 'short' | 'wide'): Bitmap {
  const b = paper();
  const middle = 11;
  const apart = gap === 'short' ? 4 : 12;
  const upper = middle - Math.floor(apart / 2) - 9;
  const lower = middle + Math.ceil(apart / 2) - 1;
  staff(b, upper, { x0: 5, gap: 2 });
  staff(b, lower, { x0: 5, gap: 2 });
  vline(b, 4, upper, lower + 8);
  for (let y = upper; y <= lower + 8; y++) put(b, 2 + (Math.abs(y - middle) < 2 ? -1 : y === upper || y === lower + 8 ? 1 : 0), y, INK);
  return b;
}

/** Lines of music on the screen: one staff, two, or a page of them (all). */
export function linesSymbol(lines: StaffSettings['lines']): Bitmap {
  const b = paper();
  const thin = { x0: 2, x1: SYMBOL_WIDTH - 3, gap: 2 };
  if (lines === 1) staff(b, 7, thin);
  else if (lines === 2) [1, 12].forEach((top) => staff(b, top, thin));
  else [0, 7, 14].forEach((top) => staff(b, top, { ...thin, lines: 4 }));
  return b;
}

/**
 * The note duration helper of one hand (ft_1_11): two small staves, the right hand above and the left hand below, each with a
 * half note and a rest. The button's hand shows its choice as in play: A a ghost head on the second beat, B the light band to
 * where the note stops, A+B both. Off is the plain notes.
 */
export function durationSymbol(mark: DurationMark, forHand: 'RH' | 'LH'): Bitmap {
  const b = paper();
  for (const [hand, top] of [['RH', 1], ['LH', 12]] as const) {
    staff(b, top, { lines: 3, gap: 4 });
    const y = top + 2; // the half note sits in the first space
    const help = hand === forHand ? mark : 'off';
    if (help === 'band' || help === 'both') for (let row = y - 1; row <= y + 1; row++) hline(b, 8, 23, row, C.blueLight);
    if (help === 'ghost' || help === 'both') for (const [dx, dy] of [[1, -1], [2, -1], [0, 0], [1, 0], [2, 0], [3, 0], [1, 1], [2, 1]] as const) put(b, 15 + dx, y + dy, C.blue);
    for (const [dx, dy] of [[1, -1], [2, -1], [0, 0], [3, 0], [1, 1], [2, 1]] as const) put(b, 4 + dx, y + dy, INK);
    vline(b, 7, hand === 'RH' ? 0 : y - 6, y - 1);
    // a quarter rest on beat 3
    for (const [dx, dy] of [[0, 0], [1, 1], [0, 2], [1, 3], [0, 4]] as const) put(b, 26 + dx, top + 1 + dy, INK);
  }
  return b;
}

/** A bar line from row `top` down a staff of `gap` 3. */
const barLine = (b: Canvas, x: number, top: number) => vline(b, x, top, top + 12);

/**
 * The bars a learning step adds (ft_1_32 rule 2): a staff with one bar of notes, or two, a bar line after the step's notes
 * and the bars still to come left empty.
 */
export function learnStepSymbol(bars: 1 | 2): Bitmap {
  const b = paper();
  const top = 5;
  staff(b, top);
  barLine(b, 1, top);
  barLine(b, SYMBOL_WIDTH - 2, top);
  barLine(b, 12, top);
  barLine(b, 22, top);
  // the step's notes: bar 1, and with two also bar 2
  note(b, 4, top + 9);
  note(b, 8, top + 6);
  if (bars === 2) {
    note(b, 15, top + 9);
    note(b, 19, top + 6);
  }
  return b;
}

/** A small ring over a note head at (x, y), as the practice staff marks a note missed again (ft_1_32 rule 6). */
const ring = (b: Canvas, x: number, y: number, c: number) => {
  for (const [dx, dy] of [[0, -2], [1, -2], [-1, -1], [2, -1], [-1, 0], [2, 0], [0, 1], [1, 1]] as const) put(b, x + dx, y + dy, c);
};

/** The rings over missed notes (ft_1_32 rule 6): two notes, one with a red ring over it, or none. */
export function markersSymbol(on: boolean): Bitmap {
  const b = paper();
  const top = 7;
  staff(b, top);
  note(b, 10, top + 9);
  note(b, 22, top + 6);
  if (on) ring(b, 23, top - 5, C.red);
  return b;
}

/** The miss a ring comes at (1 to 5): that many red crosses, the misses, then the ring over a note. */
export function markersFromSymbol(misses: number): Bitmap {
  const b = paper();
  const top = 9;
  staff(b, top, { x0: 22 });
  note(b, 26, top + 9);
  ring(b, 27, top - 5, C.red);
  for (let i = 0; i < misses; i++) {
    const x = 2 + (i % 3) * 6, y = i < 3 ? 4 : 12;
    for (let d = 0; d < 4; d++) {
      put(b, x + d, y + d, C.red);
      put(b, x + 3 - d, y + d, C.red);
    }
  }
  return b;
}

/**
 * A two-hand piece learned (ft_1_32 rule 13): the grand staff with three chords of both hands, played together; or hands
 * apart, the right hand alone, then the left hand alone, then both.
 */
export function learnHandsSymbol(apart: boolean): Bitmap {
  const b = paper();
  const upper = 1, lower = 12;
  staff(b, upper, { x0: 5, gap: 2 });
  staff(b, lower, { x0: 5, gap: 2 });
  vline(b, 4, upper, lower + 8);
  const columns: readonly ['both' | 'RH' | 'LH', number][] = apart ? [['RH', 9], ['LH', 18], ['both', 27]] : [['both', 9], ['both', 18], ['both', 27]];
  for (const [hands, x] of columns) {
    if (hands !== 'LH') note(b, x, upper + 5, INK, 4);
    if (hands !== 'RH') note(b, x, lower + 5, INK, 4);
  }
  return b;
}

/** Letters 3 x 5 for the note naming picture. */
const LETTERS: Readonly<Record<'B' | 'H', readonly string[]>> = {
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
};

/** The letter naming (ft_0_17.AC4): the note on the middle line of the treble staff, named under it as B or H, letters drawn twice as large. */
export function namingSymbol(naming: 'B' | 'H'): Bitmap {
  const b = paper();
  const top = 2;
  staff(b, top, { gap: 2 });
  note(b, 10, top + 4, INK, 5);
  LETTERS[naming].forEach((row, dy) => [...row].forEach((bit, dx) => {
    if (bit !== '#') return;
    for (const [ex, ey] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) put(b, 20 + dx * 2 + ex, 11 + dy * 2 + ey, C.blue);
  }));
  return b;
}

/** The practice staff's blue pointer, a line down the staff at x. */
const pointer = (b: Canvas, x: number, top: number) => {
  vline(b, x, top - 2, top + 14, C.blue);
  vline(b, x + 1, top - 2, top + 14, C.blue);
};

/**
 * Reopening a half-learned piece (ft_1_32.AC16): go on, the bars learned in gold and the pointer after them; or start
 * over, every note still to learn and the pointer back at the first bar.
 */
export function resumeSymbol(choice: 'continue' | 'over'): Bitmap {
  const b = paper();
  const top = 5;
  staff(b, top);
  barLine(b, 1, top);
  barLine(b, 17, top);
  barLine(b, SYMBOL_WIDTH - 2, top);
  const learned = choice === 'continue' ? C.gold : INK;
  note(b, 5, top + 9, learned);
  note(b, 11, top + 6, learned);
  note(b, 22, top + 9);
  note(b, 28, top + 6);
  pointer(b, choice === 'continue' ? 19 : 2, top);
  return b;
}

/** A finger number at (x, y) on a cream patch, so the staff lines do not run through it. */
const finger = (b: Canvas, x: number, y: number, digit: string) => {
  for (let dy = -1; dy <= 5; dy++) hline(b, x - 1, x + 3, y + dy, C.cream);
  digits(b, x, y, digit, C.blue);
};

/**
 * Finger numbers on the staff: two chords of two notes, each finger beside its head and level with it, as on the practice
 * staff; none, the top note's finger only, or every note's.
 */
export function fingersSymbol(shown: 'off' | 'top' | 'all'): Bitmap {
  const b = paper();
  staff(b, 4);
  const chords: readonly [number, number, number, string, string][] = [[5, 16, 10, '1', '5'], [20, 13, 7, '1', '3']];
  for (const [x, low, high, lowFinger, highFinger] of chords) {
    note(b, x, low, INK, low - high + 7);
    note(b, x, high);
    if (shown !== 'off') finger(b, x + 5, high - 2, highFinger);
    if (shown === 'all') finger(b, x + 5, low - 2, lowFinger);
  }
  return b;
}

/** Bar numbers: five bars of a staff, and over a bar's start the numbers the setting shows (none, 1, 1 to 5, 1 3 5, 1 5). */
export function barNumbersSymbol(mode: BarNumberMode): Bitmap {
  const b = paper();
  const top = 10, width = 6, bars = 5;
  staff(b, top, { x0: 1, x1: 1 + width * bars, gap: 2 });
  for (let i = 0; i <= bars; i++) vline(b, 1 + width * i, top, top + 8);
  for (const { index, number } of barNumbersToShow(mode, bars)) digits(b, 2 + width * index, 3, String(number), C.blue);
  return b;
}

/**
 * The live tempo of a learning run (ft_1_32 rule 18): the practice screen's top bar over a scrap of staff, with the tempo
 * written small at its right end when on, empty when off.
 */
export function liveTempoSymbol(on: boolean): Bitmap {
  const b = paper();
  for (let y = 0; y < 8; y++) hline(b, 0, SYMBOL_WIDTH - 1, y, C.panel);
  if (on) digits(b, 24, 1, '90', C.cream);
  staff(b, 10, { gap: 3, lines: 4 });
  note(b, 8, 16);
  note(b, 20, 13);
  return b;
}

/** A red cross over a box from (x0, y0), `size` wide: the thing under it is off. */
const struck = (b: Canvas, x0: number, y0: number, size: number) => {
  for (let d = 0; d < size; d++) {
    put(b, x0 + d, y0 + d, C.red);
    put(b, x0 + size - 1 - d, y0 + d, C.red);
  }
};

/**
 * Where the beat lane runs (core_13 rule 2): a grand staff with the row of dots above it or between its staves, a beat dot
 * bigger every few, the one the wave is on lifted; off, the row between the staves struck out in red.
 */
export function beatLaneSymbol(place: 'above' | 'between' | 'off'): Bitmap {
  const b = paper();
  const thin = { x0: 2, x1: SYMBOL_WIDTH - 3, gap: 2, lines: 4 };
  staff(b, 4, thin);
  staff(b, 15, thin);
  // the dots as in play: grey, a beat dot bigger and darker, the one under the wave lifted; off, the row struck out
  const y = place === 'above' ? 1 : 12;
  for (let x = 3; x <= SYMBOL_WIDTH - 4; x += 2) {
    const beat = (x - 3) % 8 === 0;
    const wave = place !== 'off' && x === 19;
    const colour = beat || wave ? INK : C.dim;
    const top = y - (wave ? 1 : 0);
    put(b, x, top, colour);
    if (beat || wave) {
      put(b, x + 1, top, colour);
      put(b, x, top + 1, colour);
      put(b, x + 1, top + 1, colour);
    }
  }
  if (place === 'off') for (let x = 1; x <= SYMBOL_WIDTH - 2; x++) put(b, x, y + (x % 4 < 2 ? 0 : 1), C.red);
  return b;
}

/** The click at the student's pace in learning (core_13 rule 6): a loudspeaker with sound waves going out; off, struck through with no waves. */
export function paceClickSymbol(on: boolean): Bitmap {
  const b = paper();
  // the loudspeaker: a small box and its cone
  for (let y = 9; y <= 13; y++) hline(b, 8, 10, y);
  for (let x = 11; x <= 15; x++) vline(b, x, 11 - (x - 10), 11 + (x - 10));
  if (on) {
    for (const r of [3, 6, 9]) for (let y = -r; y <= r; y++) put(b, 17 + r - Math.round(Math.abs(y) / 2), 11 + y, C.blue);
  } else struck(b, 6, 3, 17);
  return b;
}

/** A kind of dot of a tuned beat lane (core_13 rule 10): the dotted line, the click's beats, the top staff's notes, the bottom staff's. */
export type LaneDotPart = 'ghost' | 'beat' | 'top' | 'bottom';

/**
 * How strong one kind of a lane's dots is drawn (core_13 rule 10): a row of the lane with that kind marked, full in ink,
 * faint in grey, or struck out in red when hidden. A note's kind has a scrap of its staff above (top) or below (bottom)
 * the row, with the note over its dot.
 */
export function laneDotsSymbol(part: LaneDotPart, strength: number): Bitmap {
  const b = paper();
  const y = 11;
  const colour = strength >= 1 ? INK : strength > 0 ? C.lock : C.dim;
  const square = (x: number, top: number, c: number) => {
    put(b, x, top, c);
    put(b, x + 1, top, c);
    put(b, x, top + 1, c);
    put(b, x + 1, top + 1, c);
  };
  if (part === 'top') staff(b, 1, { x0: 2, x1: SYMBOL_WIDTH - 3, gap: 2, lines: 3 });
  if (part === 'bottom') staff(b, 17, { x0: 2, x1: SYMBOL_WIDTH - 3, gap: 2, lines: 3 });
  for (let x = 3; x <= SYMBOL_WIDTH - 4; x += 2) {
    const beat = (x - 3) % 8 === 0;
    if (part === 'ghost') put(b, x, y, beat ? C.dim : colour);
    else if (part === 'beat') {
      if (beat) square(x, y, colour);
      else put(b, x, y, C.dim);
    }
    else put(b, x, y, C.dim);
  }
  if (part === 'top' || part === 'bottom') {
    for (const x of [8, 22]) {
      square(x, y, colour);
      // the note the dot stands for, on its staff
      const head = part === 'top' ? 5 : 17;
      for (const [dx, dy] of [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]] as const) put(b, x - 1 + dx, head + dy, INK);
    }
  }
  if (strength <= 0) for (let x = 1; x <= SYMBOL_WIDTH - 2; x++) put(b, x, y + (x % 4 < 2 ? -1 : 0), C.red);
  return b;
}

/**
 * The wave of a tuned lane (core_13 rule 10): the lane with its crest lifting the dots, `height` 0 to 2 (low to high) or,
 * for `reach`, the crest narrow to wide at a middle height.
 */
export function laneWaveSymbol(part: 'height' | 'reach', level: 0 | 1 | 2): Bitmap {
  const b = paper();
  const base = 16;
  const crest = 17;
  const high = part === 'height' ? [3, 7, 11][level]! : 7;
  const half = part === 'reach' ? [3, 7, 12][level]! : 6;
  for (let x = 2; x <= SYMBOL_WIDTH - 3; x += 2) {
    const d = Math.abs(x - crest) / half;
    const lift = d >= 1 ? 0 : Math.round(high * (1 - d * d));
    put(b, x, base - lift, lift > 0 ? INK : C.dim);
    if (lift > 0) put(b, x + 1, base - lift, INK);
  }
  return b;
}
