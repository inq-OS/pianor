import { EDITOR_LENGTHS } from '../../../core/editor/model';
import { DYNAMICS, type Dynamic } from '../../../core/chart/dynamics';
import { createBitmap, type Bitmap } from './bitmap';
import type { LengthId } from './lengthArt';
import { hash2 } from './paint/noise';
import { C } from './palette';

/**
 * The piece maker's items in the band's slots (ft_1_20): each mark a scrap of parchment torn from the sheet under the
 * staff, with the sign written on it in the staff's own ink, so the student learns one picture for a sign, not two (AX-0).
 * This was picked of three materials ("B": parchment, over brass and flat honey). Original, drawn for
 * this project; music signs are the staff's identity, so no free pack's are used (`docs/assets.md`).
 *
 * Painted on the fine grid (d110), half a layout cell to the pixel: a slot shows one with `fineIcon` on its button. Only
 * the palette's own colours: the warm buff run for the skin, `groove` round its torn edge and `duskDeep`, which is the
 * staff's ink (`STAFF_INK`), for the sign.
 */
export const ITEM_SIZE = { width: 56, height: 40 } as const;

export type ItemSign =
  | `note.${LengthId}`
  | `rest.${LengthId}`
  | 'sharp'
  | 'flat'
  | 'natural'
  | 'tie'
  | 'tieTo'
  | `dynamic.${Dynamic}`
  | 'repeatStart'
  | 'repeatEnd'
  /** Both repeat signs on one scrap: the piece maker's one repeat item. */
  | 'repeat'
  /** A scrap with nothing written on it: the dynamic item while the selected note has no mark. */
  | 'blank';

const LENGTHS: readonly LengthId[] = EDITOR_LENGTHS;

/** Every sign an item can carry, in the order of the sketch picked from. */
export const ITEM_SIGNS: readonly ItemSign[] = [
  ...LENGTHS.map((l) => `note.${l}` as const),
  ...LENGTHS.map((l) => `rest.${l}` as const),
  'sharp',
  'flat',
  'natural',
  'tie',
  'tieTo',
  ...DYNAMICS.map((d) => `dynamic.${d}` as const),
  'repeatStart',
  'repeatEnd',
  'blank',
  // after the others, so their scraps keep their tears (each is torn by its place here)
  'repeat',
];

/** The skin of a scrap, dark to light: its torn rim, the grain and the pale body (the sheet's own pale pick). */
export const ITEM_SKIN = [C.buffDeep, C.buffDark, C.buff, C.buffLight, C.cream] as const;
/** The sign's ink: the staff's (`STAFF_INK`, 0x1b1b2f). */
export const ITEM_INK = C.duskDeep;

// --- shapes, sampled at the pixel's centre ------------------------------------------------------------------------------

type Shape = (x: number, y: number) => boolean;

const union = (...shapes: Shape[]): Shape => (x, y) => shapes.some((s) => s(x, y));
const minus = (a: Shape, b: Shape): Shape => (x, y) => a(x, y) && !b(x, y);
const both = (a: Shape, b: Shape): Shape => (x, y) => a(x, y) && b(x, y);

function ellipse(cx: number, cy: number, rx: number, ry: number, tilt = 0): Shape {
  const c = Math.cos(tilt), s = Math.sin(tilt);
  return (x, y) => {
    const u = (x - cx) * c + (y - cy) * s, v = -(x - cx) * s + (y - cy) * c;
    return (u / rx) ** 2 + (v / ry) ** 2 <= 1;
  };
}

function rect(x0: number, y0: number, x1: number, y1: number): Shape {
  return (x, y) => x >= x0 && x < x1 && y >= y0 && y < y1;
}

function segment(x0: number, y0: number, x1: number, y1: number, r: number): Shape {
  const dx = x1 - x0, dy = y1 - y0, length = Math.max(dx * dx + dy * dy, 1e-9);
  return (x, y) => {
    const t = Math.min(1, Math.max(0, ((x - x0) * dx + (y - y0) * dy) / length));
    return (x - x0 - t * dx) ** 2 + (y - y0 - t * dy) ** 2 <= r * r;
  };
}

/** A stroke of width `2 r` through the points. */
function stroke(points: readonly (readonly [number, number])[], r: number): Shape {
  return union(...points.slice(1).map((b, i) => segment(points[i]![0], points[i]![1], b[0], b[1], r)));
}

function arc(cx: number, cy: number, rx: number, ry: number, from: number, to: number, r: number): Shape {
  const n = 24;
  return stroke(Array.from({ length: n + 1 }, (_, k) => [cx + rx * Math.cos(from + ((to - from) * k) / n), cy + ry * Math.sin(from + ((to - from) * k) / n)] as const), r);
}

/** Letters drawn as rows of `x`, each a square of `zoom` pixels, with their top-left at (x0, y0). */
function letters(rows: readonly string[], x0: number, y0: number, zoom = 2): Shape {
  return (x, y) => {
    const i = Math.floor((x - x0) / zoom), j = Math.floor((y - y0) / zoom);
    return x >= x0 && y >= y0 && rows[j]?.[i] === 'x';
  };
}

// --- the signs ------------------------------------------------------------------------------------------------------------

/** How far a note head leans, as on the staff. */
const TILT = -0.38;

function note(length: LengthId): Shape {
  if (length === 'whole') return minus(ellipse(28, 22, 10, 6.5), ellipse(28, 22, 4.2, 4.6, 0.9));
  const flagged = length === 'eighth' || length === 'dottedEighth' || length === 'sixteenth';
  const dotted = length === 'dottedHalf' || length === 'dottedQuarter' || length === 'dottedEighth';
  const cx = flagged || dotted ? 22 : 24;
  const hollow = length === 'half' || length === 'dottedHalf';
  const head = hollow ? minus(ellipse(cx, 30, 7.2, 5, TILT), ellipse(cx, 30, 4.2, 2, TILT - 0.2)) : ellipse(cx, 30, 7.2, 5, TILT);
  const parts = [head, rect(cx + 4.6, 4, cx + 7.4, 30)];
  if (flagged) parts.push(stroke([[cx + 7, 5], [cx + 12, 10], [cx + 14, 16], [cx + 12, 22]], 1.5));
  // a sixteenth's second flag, lower on the stem
  if (length === 'sixteenth') parts.push(stroke([[cx + 7, 12], [cx + 12, 17], [cx + 14, 23], [cx + 12, 28]], 1.5));
  if (dotted) parts.push(ellipse(cx + 14, 31, 2.4, 2.4));
  return union(...parts);
}

function rest(length: LengthId): Shape {
  switch (length) {
    case 'whole': // hangs from a line
      return union(rect(14, 15, 42, 17), rect(20, 17, 36, 24));
    case 'half': // sits on a line
      return union(rect(20, 16, 36, 23), rect(14, 23, 42, 25));
    case 'dottedHalf':
      return union(rect(16, 16, 32, 23), rect(10, 23, 38, 25), ellipse(43, 20, 2.4, 2.4));
    case 'quarter':
      return union(stroke([[24, 4], [31, 12], [24, 20], [31, 27], [27, 30]], 2.2), arc(29, 33, 4, 3.5, -1.2, -4, 1.6));
    case 'dottedQuarter':
      return union(stroke([[20, 4], [27, 12], [20, 20], [27, 27], [23, 30]], 2.2), arc(25, 33, 4, 3.5, -1.2, -4, 1.6), ellipse(38, 20, 2.4, 2.4));
    case 'eighth':
      return union(ellipse(23, 11, 3.6, 3.6), stroke([[23, 13], [30, 13], [34, 9]], 1.5), segment(34, 9, 26, 34, 1.6));
    case 'dottedEighth':
      return union(ellipse(19, 11, 3.6, 3.6), stroke([[19, 13], [26, 13], [30, 9]], 1.5), segment(30, 9, 22, 34, 1.6), ellipse(38, 20, 2.4, 2.4));
    case 'sixteenth':
      return union(
        ellipse(25, 7, 3.6, 3.6), stroke([[25, 9], [32, 9], [36, 5]], 1.5), segment(36, 5, 26, 36, 1.6),
        ellipse(21, 17, 3.6, 3.6), stroke([[21, 19], [30, 18]], 1.5),
      );
  }
}

const SHARP = union(rect(22, 4, 25, 36), rect(31, 2, 34, 34), stroke([[16, 15], [40, 9]], 2.3), stroke([[16, 27], [40, 21]], 2.3));
const FLAT = union(rect(21, 2, 24, 36), both(minus(ellipse(27, 27, 8, 7, -0.5), ellipse(25.5, 28, 4, 3.6, -0.6)), rect(21, 18, 40, 40)));
const NATURAL = union(rect(20, 4, 23, 30), rect(31, 12, 34, 38), stroke([[21, 18], [33, 14]], 2), stroke([[21, 28], [33, 24]], 2));

/** Two notes under one slur; `toNote` adds an arrow head at its right end: from this note to that one. */
function tie(toNote: boolean): Shape {
  const parts = [
    arc(28, 24, 16, 12, Math.PI + 0.25, 2 * Math.PI - 0.25, 1.8),
    arc(28, 25, 16, 10, Math.PI + 0.5, 2 * Math.PI - 0.5, 1.4),
    ellipse(11, 30, 5.6, 4, TILT),
    ellipse(45, 30, 5.6, 4, TILT),
  ];
  if (toNote) parts.push(stroke([[38, 14], [43, 20], [49, 14]], 1.5));
  return union(...parts);
}

/** The letters of a dynamic, in the slanted bold of printed music; how far each sits down and how wide it is. */
const DYNAMIC_LETTERS: Readonly<Record<'f' | 'p' | 'm', { rows: readonly string[]; drop: number; width: number }>> = {
  f: { rows: ['......xxx.', '.....xx.xx', '.....xx...', '....xx....', '....xx....', '..xxxxxxx.', '....xx....', '...xx.....', '...xx.....', '...xx.....', '..xx......', '..xx......', '..xx......', 'x.xx......', 'xxx.......'], drop: 0, width: 7 },
  p: { rows: ['..xx.xxx..', '.xxxxx.xx.', '..xxx...xx', '..xx....xx', '..xx....xx', '.xx....xx.', '.xxx..xxx.', '.xxxxxxx..', '.xx.......', 'xx........', 'xx........', 'xxxx......'], drop: 6, width: 9 },
  m: { rows: ['.xx.xx..xx..', 'xxxxxxxxxxx.', '.xx..xx..xx.', '.xx..xx..xx.', '.xx..xx..xx.', 'xx..xx..xx..', 'xx..xx..xx.x', 'xx..xx..xxx.'], drop: 6, width: 11 },
};

function dynamic(mark: Dynamic): Shape {
  const chars = [...mark] as ('f' | 'p' | 'm')[];
  let x = Math.floor((ITEM_SIZE.width - chars.reduce((sum, c) => sum + DYNAMIC_LETTERS[c].width, 0) * 2) / 2);
  const parts: Shape[] = [];
  for (const c of chars) {
    const letter = DYNAMIC_LETTERS[c];
    parts.push(letters(letter.rows, x, 6 + letter.drop));
    x += letter.width * 2;
  }
  return union(...parts);
}

/** A repeat sign: the thick and the thin bar line and two dots, the dots on the side the repeat looks back to. */
function repeat(end: boolean): Shape {
  const mirror = (shape: Shape): Shape => (end ? (x, y) => shape(ITEM_SIZE.width - x, y) : shape);
  return mirror(union(rect(16, 4, 21, 36), rect(24, 4, 26, 36), ellipse(31, 15, 2.4, 2.4), ellipse(31, 25, 2.4, 2.4)));
}

function sign(name: ItemSign): Shape {
  if (name.startsWith('note.')) return note(name.slice(5) as LengthId);
  if (name.startsWith('rest.')) return rest(name.slice(5) as LengthId);
  if (name.startsWith('dynamic.')) return dynamic(name.slice(8) as Dynamic);
  switch (name) {
    case 'sharp': return SHARP;
    case 'flat': return FLAT;
    case 'natural': return NATURAL;
    case 'tie': return tie(false);
    case 'tieTo': return tie(true);
    case 'repeatStart': return repeat(false);
    case 'repeatEnd': return repeat(true);
    case 'repeat': {
      const start = repeat(false);
      const end = repeat(true);
      return union((x, y) => start(x + 10, y), (x, y) => end(x - 10, y));
    }
    default: return () => false;
  }
}

// --- the scrap of parchment -----------------------------------------------------------------------------------------------

/** The scrap's straight sides before they are torn; a torn edge eats up to `TEAR - 1` pixels more. */
const SCRAP = { left: 3, top: 1, right: 53, bottom: 39 } as const;
const TEAR = 2;
/** Skin kept clear all round a sign, inside the deepest tear: no sign is cut by the edge or written on its dark rim. */
const MARGIN = 2;
/** How many of the body's pixels are a grain darker. */
const GRAIN = 0.12;

/** The sign moved to the scrap's middle, and made smaller if it would come nearer its edge than `MARGIN`. */
function fitted(shape: Shape): Shape {
  const { width: w, height: h } = ITEM_SIZE;
  let x0: number = w, y0: number = h, x1 = 0, y1 = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (shape(x + 0.5, y + 0.5)) [x0, y0, x1, y1] = [Math.min(x0, x), Math.min(y0, y), Math.max(x1, x + 1), Math.max(y1, y + 1)];
  if (x1 <= x0) return shape;
  const inner = { left: SCRAP.left + TEAR - 1 + MARGIN, top: SCRAP.top + TEAR - 1 + MARGIN, right: SCRAP.right - TEAR + 1 - MARGIN, bottom: SCRAP.bottom - TEAR + 1 - MARGIN };
  const k = Math.min(1, (inner.right - inner.left) / (x1 - x0), (inner.bottom - inner.top) / (y1 - y0));
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, tx = (inner.left + inner.right) / 2, ty = (inner.top + inner.bottom) / 2;
  return (x, y) => shape(cx + (x - tx) / k, cy + (y - ty) / k);
}

/** Paint one item: the scrap, torn its own way (`seed`), with the sign in ink on it and a groove round its edge. */
function paintItem(sign: Shape, seed: number): Bitmap {
  const { width: w, height: h } = ITEM_SIZE;
  const shape = fitted(sign);
  const bitmap = createBitmap(w, h);
  const torn = (t: number, side: number) => Math.floor(hash2(t, side, seed) * TEAR);
  const onScrap = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < w && y < h &&
    x >= SCRAP.left + torn(y, 0) && x < SCRAP.right - torn(y, 1) && y >= SCRAP.top + torn(x, 2) && y < SCRAP.bottom - torn(x, 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!onScrap(x, y)) {
        // the groove: a dark line round the scrap, outside it
        if (onScrap(x - 1, y) || onScrap(x + 1, y) || onScrap(x, y - 1) || onScrap(x, y + 1)) bitmap.pixels[i] = C.groove;
        continue;
      }
      if (shape(x + 0.5, y + 0.5)) {
        bitmap.pixels[i] = ITEM_INK;
        continue;
      }
      // darker towards the torn rim, and a loose grain over the body
      const d = Math.min(x + 0.5 - SCRAP.left, SCRAP.right - x - 0.5, y + 0.5 - SCRAP.top, SCRAP.bottom - y - 0.5);
      const tone = ITEM_SKIN.length - 1 - (d < 2.5 ? 1 : 0) - (d < 1.2 ? 1 : 0) - (hash2(x, y, seed + 50) < GRAIN ? 1 : 0);
      bitmap.pixels[i] = ITEM_SKIN[tone]!;
    }
  }
  return bitmap;
}

const painted = new Map<ItemSign, Bitmap>();

/** The picture of an item, `ITEM_SIZE`, on the fine grid. The same for every call. */
export function itemPicture(name: ItemSign): Bitmap {
  let bitmap = painted.get(name);
  if (!bitmap) {
    bitmap = paintItem(sign(name), ITEM_SIGNS.indexOf(name) + 1);
    painted.set(name, bitmap);
  }
  return bitmap;
}
