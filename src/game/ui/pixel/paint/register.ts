import { createBitmap, type Bitmap } from '../bitmap';
import { C } from '../palette';
import { hash2 } from './noise';

/**
 * What is ruled and inked in the teacher's register (WP-14, d145): the faint blue-grey lines of an old register's
 * ruling, its red margin, the red ring round the chosen player's name and the coloured dot of a piece's status, all
 * drawn by hand on the fine grid. Pure: imports neither Phaser nor the DOM.
 */

/** The ruling's own colours: place 0 is never painted, then the blue-grey rule and the red margin. */
export const RULING_PALETTE: readonly number[] = [0x000000, 0x8c9aa8, 0xb04a3a];
const RULE = 1, MARGIN = 2;

export interface Ruling {
  /** The rows ruled across both pages, each a y in fine pixels. */
  readonly rows: readonly number[];
  /** Where the rows start and end, and the gutter they leave bare. */
  readonly from: number;
  readonly to: number;
  readonly gutter: readonly [number, number];
  /** The red margin's x, if any, and the column rules' x; both run from `top` to `bottom`. */
  readonly margin: number | null;
  readonly columns: readonly number[];
  readonly top: number;
  readonly bottom: number;
}

/** How near the gutter, in fine pixels, a ruled row starts to sink with the page as it bows down into the fold, and how far it sinks. */
const DIP = { reach: 20, depth: 3 } as const;

/** How far a row sinks at `x`, the gutter running from `g0` to `g1`: nothing a hand's width away, the most at the fold's edge. */
function dip(x: number, g0: number, g1: number): number {
  const d = x < g0 ? g0 - x : x - g1;
  return d >= DIP.reach ? 0 : Math.round(DIP.depth * ((DIP.reach - d) / DIP.reach) ** 2);
}

/**
 * The ruling over a page `width` by `height` fine pixels: drawn with a pen that skips here and there, as ink on old paper
 * does, the rows sinking with the pages where they bow down into the gutter.
 */
export function paintRuling(width: number, height: number, ruling: Ruling): Bitmap {
  const out = createBitmap(width, height);
  const put = (x: number, y: number, place: number, seed: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height || hash2(x, y, seed) < 0.12) return;
    out.pixels[y * width + x] = place;
  };
  const [g0, g1] = ruling.gutter;
  for (const y of ruling.rows) for (let x = ruling.from; x <= ruling.to; x++) if (x < g0 || x > g1) put(x, y + dip(x, g0, g1), RULE, 7);
  for (const x of ruling.columns) for (let y = ruling.top; y <= ruling.bottom; y++) put(x, y, RULE, 8);
  if (ruling.margin !== null) for (let y = ruling.top; y <= ruling.bottom; y++) put(ruling.margin, y, MARGIN, 9);
  return out;
}

/**
 * A ring of red ink round a word `width` by `height` fine pixels, drawn in one stroke that runs on past its start, as a
 * teacher rings a name. The picture is larger by `RING_PAD` on each side.
 */
export const RING_PAD = 5;
export function inkRing(width: number, height: number): Bitmap {
  const w = width + 2 * RING_PAD, h = height + 2 * RING_PAD;
  const out = createBitmap(w, h);
  const cx = (w - 1) / 2, cy = (h - 1) / 2, rx = w / 2 - 1.5, ry = h / 2 - 1.5;
  const steps = Math.ceil((rx + ry) * 8);
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2.15 + 2.4;
    // the stroke wobbles a little and ends a hair outside where it began
    const k = 1 + Math.sin(t * 3) * 0.035 + (i / steps) * 0.04;
    const x = Math.round(cx + Math.cos(t) * rx * k), y = Math.round(cy + Math.sin(t) * ry * k);
    for (const [dx, dy] of [[0, 0], [1, 0]] as const) {
      const px = x + dx, py = y + dy;
      if (px >= 0 && py >= 0 && px < w && py < h) out.pixels[py * w + px] = C.redDark;
    }
  }
  return out;
}

/**
 * A box to write in, `width` by `height` fine pixels, drawn by hand in ink: its corners left open, its top and right side
 * bowed out a pixel along their middles. Red while it is the box being written in, as the ink buttons are under the pointer.
 */
export function inkField(width: number, height: number, active: boolean): Bitmap {
  const out = createBitmap(width, height);
  const ink = active ? C.redDark : C.ink;
  const middle = (at: number, length: number) => at > length / 3 && at < (length * 2) / 3;
  for (let x = 2; x < width - 2; x++) {
    out.pixels[(middle(x, width) ? 0 : 1) * width + x] = ink;
    out.pixels[(height - 1) * width + x] = ink;
  }
  for (let y = 2; y < height - 2; y++) {
    out.pixels[y * width] = ink;
    out.pixels[y * width + (middle(y, height) ? width - 1 : width - 2)] = ink;
  }
  return out;
}

/** A dot of `colour` with a rim of ink, `size` fine pixels across: a piece's status in the register (d139), or its medal. */
export function inkDot(colour: number, size = 11): Bitmap {
  const out = createBitmap(size, size);
  const c = (size - 1) / 2, r = size / 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const d = Math.hypot(x - c, y - c);
    if (d > r - 0.2) continue;
    out.pixels[y * size + x] = d > r - 1.4 ? C.ink : colour;
  }
  return out;
}
