import type { PlaySettings } from '../../../core/judge/playSettings';
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
const digits = (b: Canvas, x: number, y: number, value: string) => {
  [...value].forEach((ch, i) => DIGITS[ch]!.forEach((row, dy) => [...row].forEach((bit, dx) => { if (bit === '#') put(b, x + i * 4 + dx, y + dy, INK); })));
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
