import { createBitmap, type Bitmap } from '../bitmap';
import { clamp01 } from './ease';
import { fineRun } from './lab';
import { fbm, hash2, noise2 } from './noise';

/**
 * The open book the song list is written in (it should resemble a book, as the open book in the second or third game of the series), after the big open book of the 1997 game: a blue cloth cover with brass corners
 * reaching past the pages, two pages of old paper that dip into a dark gutter in the middle and curl up a little at
 * their outer edges, the stack of leaves showing as fine lines under them, and a red ribbon hanging from the gutter over the right page.
 *
 * Painted by rule on the fine grid for any size. The pages stay pale and quiet where the list is written. Imports
 * neither Phaser nor the DOM.
 */

const COVER_TONES = [0x080a24, 0x141a4a, 0x1f2a72, 0x2c3c94, 0x4054b0] as const;
const BRASS_TONES = [0x3a2408, 0x7a5014, 0xb8862a, 0xe8b848, 0xfff0a8] as const;
const PAGE_TONES = [0x3a2414, 0x6a4424, 0x9a6c38, 0xc29454, 0xd8b06c, 0xe8c888, 0xf2dca4, 0xf8ecc4] as const;
const RIBBON_TONES = [0x30060a, 0x5a0c12, 0x8a1a1e, 0xb8302a, 0xd85a40] as const;
const COVER = fineRun(COVER_TONES, 4);
const BRASS = fineRun(BRASS_TONES, 4);
const PAGE = fineRun(PAGE_TONES, 3);
const RIBBON = fineRun(RIBBON_TONES, 4);

/** The book's colours: place 0 is never painted, then the cover, the brass, the pages and the ribbon. */
export const BOOK_PALETTE: readonly number[] = [0x000000, ...COVER, ...BRASS, ...PAGE, ...RIBBON];

/**
 * The teacher's register (WP-14, d145): the same book bound in bottle-green cloth, as an old school register is. Its
 * places are the song book's, so one painted book takes either palette.
 */
const REGISTER_COVER_TONES = [0x061208, 0x0e2814, 0x1a4222, 0x2a5c30, 0x3e7842] as const;
export const REGISTER_PALETTE: readonly number[] = [0x000000, ...fineRun(REGISTER_COVER_TONES, 4), ...BRASS, ...PAGE, ...RIBBON];
const FIRST = { cover: 1, brass: 1 + COVER.length, page: 1 + COVER.length + BRASS.length, ribbon: 1 + COVER.length + BRASS.length + PAGE.length } as const;

/** How far the cover reaches past the pages, and how deep the stack of leaves shows under them, in fine pixels. */
export const BOOK_COVER = 8;
export const BOOK_STACK = 7;

/**
 * The place in `run` for `value` (0 to 1): the nearest tone laid flat, as paint lays it, with a grain of lone specks a tone
 * darker or lighter (the art review: an ordered dither read as a checkerboard on the paper, MI2's paper is grained).
 */
function tone(run: readonly number[], first: number, value: number, x: number, y: number): number {
  const at = Math.round(clamp01(value) * (run.length - 1));
  const grain = hash2(x, y, 99);
  const speck = grain < GRAIN ? -1 : grain > 1 - GRAIN / 2 ? 1 : 0;
  return first + Math.max(0, Math.min(run.length - 1, at + speck));
}

/** The share of pixels that are a speck a tone darker; half as many are a tone lighter. */
const GRAIN = 0.1;

/** The page's light in flat bands, as paint lays it: the fold dark, a shaded band beside it, the page, a band at its edge. */
function pageLight(x: number, y: number, down: number, fromGutter: number, fromSide: number): number {
  let value = 0.86 + (fbm(x / 60, y / 50, 3, 51) - 0.5) * 0.1;
  if (fromGutter < 2) value = 0.2;
  else if (fromGutter < 5) value = 0.48;
  else if (fromGutter < 12 + Math.round(noise2(0, y / 14, 52) * 3)) value = 0.7;
  if (fromSide < 4) value = Math.min(value, 0.6);
  if (down < 2) value -= 0.12;
  if (fromSide < 6 && fromSide % 2 === 1 && down > 2) value -= 0.12; // the leaves' edges at the side, a fine line each
  return value;
}

/** The open book, `width` by `height` fine pixels, the cover's outer edge on the picture's edge. Every pixel inside the cover is painted. */
export function paintBook(width: number, height: number): Bitmap {
  const out = createBitmap(width, height);
  const put = (x: number, y: number, place: number) => { if (x >= 0 && y >= 0 && x < width && y < height) out.pixels[y * width + x] = place; };
  const mid = width / 2;
  // the cover: blue cloth, grained, a darker rim
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const rim = Math.min(x, y, width - 1 - x, height - 1 - y);
    let value = 0.55 + (fbm(x / 40, y / 40, 2, 31) - 0.5) * 0.3;
    if (rim < 2) value -= 0.35;
    else if (y >= height - 6) value -= 0.25;
    put(x, y, tone(COVER, FIRST.cover, value, x, y));
  }
  // the brass corners: a triangle on each, lit from the upper left
  const corner = Math.max(14, Math.round(Math.min(width, height) * 0.08));
  for (const [cx, cy, sx, sy] of [[0, 0, 1, 1], [width - 1, 0, -1, 1], [0, height - 1, 1, -1], [width - 1, height - 1, -1, -1]] as const) {
    for (let j = 0; j < corner; j++) for (let i = 0; i < corner - j; i++) {
      const x = cx + sx * i, y = cy + sy * j;
      const edge = i + j >= corner - 2;
      put(x, y, edge ? FIRST.brass : tone(BRASS, FIRST.brass, 0.75 - (i + j) / (corner * 3) - (sx < 0 || sy < 0 ? 0.15 : 0), x, y));
    }
  }
  // the pages: from the cover's inner edge, dipping to the gutter, curling up a little at their outer edges
  const left = BOOK_COVER, right = width - 1 - BOOK_COVER, bottom = height - 1 - BOOK_COVER;
  // each page bows up from the gutter, highest a quarter of the way out, and falls to its outer edge, where it curls
  const bow = (x: number) => {
    const t = Math.abs(x - mid) / (mid - BOOK_COVER);
    return t < 0.25 ? Math.sin((t / 0.25) * Math.PI / 2) : 1 - ((t - 0.25) / 0.75) ** 2 * 0.7;
  };
  const topOf = (x: number) => BOOK_COVER + 4 - Math.round(bow(x) * 10);
  const footOf = (x: number) => {
    const t = Math.abs(x - mid) / (mid - BOOK_COVER);
    return bottom - BOOK_STACK - Math.round(t < 0.1 ? (0.1 - t) * 30 : 0) + Math.round((1 - bow(x)) * 2);
  };
  const curl = Math.max(10, Math.round(width * 0.03));
  for (let x = left; x <= right; x++) {
    const top = topOf(x), foot = footOf(x);
    const fromGutter = Math.abs(x - mid), fromSide = Math.min(x - left, right - x);
    // the stack of leaves under the page: fine light and dark lines
    for (let y = foot + 1; y <= bottom; y++) put(x, y, (y - foot) % 2 === 0 ? FIRST.page + 2 : FIRST.page + PAGE.length - 3);
    for (let y = top; y <= foot; y++) {
      const value = pageLight(x, y, y - top, fromGutter, fromSide);
      put(x, y, tone(PAGE, FIRST.page, value, x, y));
    }
    put(x, top, FIRST.page + 2);
    if (Math.abs(x - mid) < 0.6) for (let y = top; y <= foot; y++) put(x, y, FIRST.page);
    // the outer top corners curl over: a small triangle of the page's paler back with a dark crease
    if (fromSide < curl) for (let k = 0; k < curl - fromSide; k++) {
      const y = top + k;
      put(x, y, k === curl - fromSide - 1 ? FIRST.page + 1 : tone(PAGE, FIRST.page, 0.95, x, y));
    }
  }
  // the red ribbon, hanging out of the gutter at the foot, its end cut in a V
  const rx = Math.round(width * 0.56), rw = 7;
  for (let y = footOf(rx) - 30; y < height; y++) for (let x = rx; x < rx + rw; x++) {
    const tail = y - (height - 6);
    if (tail > 0 && Math.abs(x - rx - (rw - 1) / 2) < tail * 0.8) continue;
    put(x, y, tone(RIBBON, FIRST.ribbon, 0.7 - (x - rx) / (rw * 1.6) - (x === rx + rw - 1 ? 0.3 : 0), x, y));
  }
  return out;
}
