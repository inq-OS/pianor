import { createBitmap, type Bitmap } from '../bitmap';
import { clamp01 } from './ease';
import { fineRun } from './lab';
import { bayer, fbm, hash2, noise2 } from './noise';

/**
 * The library's card catalogue (ft_1_02c.AC7; the library organizer can also organize
 * pieces), after the card drawers of the 1991 game's library: a cabinet of reddish wood, each drawer a board with a
 * bevelled edge, a brass holder with a paper label and a metal pull; inside an open drawer the index cards, each
 * with its title written over a red rule. A drawer with no pieces yet keeps a blank front: an empty holder.
 *
 * Painted by rule on the fine grid; the words are written by the screen. Imports neither Phaser nor the DOM.
 */

const WOOD_TONES = [0x1c0806, 0x3a120c, 0x5e2214, 0x80341c, 0xa04a26, 0xbc6634, 0xd08a4c] as const;
const METAL_TONES = [0x1a1c24, 0x40444e, 0x70747e, 0xa4a8b0, 0xdadce0] as const;
const PAPER_TONES = [0x6a4424, 0x9a6c38, 0xc29454, 0xd8b06c, 0xe8c888, 0xf2dca4, 0xf8ecc4] as const;
const BRASS_TONES = [0x3a2408, 0x7a5014, 0xb8862a, 0xe8b848, 0xfff0a8] as const;
const WOOD = fineRun(WOOD_TONES, 3);
const METAL = fineRun(METAL_TONES, 4);
const PAPER = fineRun(PAPER_TONES, 3);
const BRASS = fineRun(BRASS_TONES, 4);
const RULE_RED = 0xa83020;
const RULE_BLUE = 0x8aa0c0;
const INK = 0x1a0f0a;

/** The catalogue's colours: place 0 is never painted, then wood, metal, paper and brass, then the red and blue rules and the ink. */
export const CABINET_PALETTE: readonly number[] = [0x000000, ...WOOD, ...METAL, ...PAPER, ...BRASS, RULE_RED, RULE_BLUE, INK];
const FIRST = {
  wood: 1,
  metal: 1 + WOOD.length,
  paper: 1 + WOOD.length + METAL.length,
  brass: 1 + WOOD.length + METAL.length + PAPER.length,
} as const;
const RED = FIRST.brass + BRASS.length, BLUE = RED + 1, INK_PLACE = RED + 2;

function tone(run: readonly number[], first: number, value: number, x: number, y: number): number {
  const at = clamp01(value) * (run.length - 1);
  const low = Math.floor(at);
  const threshold = 0.35 * bayer(x, y) + 0.65 * hash2(x, y, 97);
  return first + Math.min(run.length - 1, at - low > threshold ? low + 1 : low);
}

/** The cabinet's carcass behind the drawers, `width` by `height` fine pixels: dark wood, grain across, darker in the gaps. */
export function paintCabinet(width: number, height: number): Bitmap {
  const out = createBitmap(width, height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let value = 0.3 + (fbm(x / 80, y / 4, 3, 61) - 0.5) * 0.3;
    if (x < 3 || y < 3) value += 0.2;
    if (x >= width - 3 || y >= height - 3) value -= 0.2;
    if (x === 0 || y === 0 || x === width - 1 || y === height - 1) value = 0;
    out.pixels[y * width + x] = tone(WOOD, FIRST.wood, value, x, y);
  }
  return out;
}

/** Where a drawer front's paper label sits, in fine pixels from the front's top-left: the screen writes the drawer's letters there. */
export function drawerLabelBox(width: number, seed = 0): { x: number; y: number; w: number; h: number } {
  const w = Math.max(24, Math.round(width * 0.64)), h = 18;
  // each drawer's holder is set a pixel or two off the middle, its own way (the cabinet was made by hand)
  const off = Math.round((hash2(seed, 60, 77) - 0.5) * 4);
  return { x: Math.round((width - w) / 2) + off, y: 5, w, h };
}

/**
 * One drawer's front, `width` by `height` fine pixels: a board with a lit top and left edge and a dark bottom and
 * right, its grain across, a brass holder with a paper label (or empty, for a drawer with no pieces) and a metal pull
 * under it. `pulled` paints it a little lighter, as if drawn out an inch: the look under the pointer. `seed` varies the grain.
 */
export function paintDrawerFront(width: number, height: number, labelled: boolean, pulled = false, seed = 0): Bitmap {
  const out = createBitmap(width, height);
  const put = (x: number, y: number, place: number) => { if (x >= 0 && y >= 0 && x < width && y < height) out.pixels[y * width + x] = place; };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let value = (pulled ? 0.62 : 0.52) + (fbm(x / 40 + seed, y / 5, 2, 70 + seed) - 0.5) * 0.3;
    if (Math.abs(noise2(x / 30 + seed, y / 2, 71 + seed) - 0.5) < 0.03) value -= 0.2;
    if (y < 3 || x < 3) value += 0.22;
    if (y >= height - 4 || x >= width - 4) value -= 0.32;
    if (x === 0 || y === 0 || x === width - 1 || y === height - 1) value = 0.02;
    put(x, y, tone(WOOD, FIRST.wood, value, x, y));
  }
  wearFront(width, height, seed, put);
  const wear = (k: number) => hash2(seed, k, 77);
  // the label holder: a brass frame, the paper in it askew by a pixel, or nothing but its dark back; set a pixel off its middle
  const box = drawerLabelBox(width, seed);
  for (let y = box.y - 2; y < box.y + box.h + 2; y++) for (let x = box.x - 2; x < box.x + box.w + 2; x++) {
    const rim = x < box.x || y < box.y || x >= box.x + box.w || y >= box.y + box.h;
    if (rim) put(x, y, tone(BRASS, FIRST.brass, 0.7 - (x - box.x + y - box.y) / (box.w + box.h) * 0.6, x, y));
    else if (!labelled) put(x, y, tone(WOOD, FIRST.wood, 0.12, x, y));
    else {
      // the paper slipped a little in its holder: a sliver of the dark back shows along one side
      const slip = wear(61) > 0.5 ? x - box.x : box.x + box.w - 1 - x;
      if (slip < 1 + Math.round(((y - box.y) / box.h) * 2)) { put(x, y, tone(WOOD, FIRST.wood, 0.12, x, y)); continue; }
      const d = Math.min(x - box.x, y - box.y, box.x + box.w - 1 - x, box.y + box.h - 1 - y);
      put(x, y, tone(PAPER, FIRST.paper, (d < 1 ? 0.45 : 0.82) + (fbm(x / 6, y / 6, 2, 80 + seed) - 0.5) * 0.25, x, y));
    }
  }
  // the pull: a brass cup under the label, a half moon open at the top that a finger hooks into, dark inside, lit on its rim
  const cx = box.x + box.w / 2, cupY = box.y + box.h + 4, r = Math.max(5, Math.round(width * 0.11));
  for (let y = 0; y <= r; y++) for (let x = -r; x <= r; x++) {
    const d = Math.sqrt(x * x + (y * 1.6) ** 2);
    if (d > r) continue;
    const px = Math.round(cx + x), py = cupY + y;
    put(px, py, d > r - 2 ? tone(BRASS, FIRST.brass, 0.75 - (x + y) / (r * 4), px, py) : tone(WOOD, FIRST.wood, 0.04, px, py));
  }
  for (let x = -r - 1; x <= r + 1; x++) put(Math.round(cx + x), cupY, tone(BRASS, FIRST.brass, 0.9, x, cupY));
  return out;
}

/** A drawer front's own wear (`seed`): a scuff or two across the grain, a crack running in from an edge, a chipped corner. */
function wearFront(width: number, height: number, seed: number, put: (x: number, y: number, place: number) => void): void {
  const wear = (k: number) => hash2(seed, k, 77);
  for (let n = 0; n < 2 + Math.floor(wear(0) * 3); n++) {
    const sx = Math.round(wear(1 + n) * (width - 16)) + 6, sy = Math.round(wear(10 + n) * (height - 10)) + 4, len = 4 + Math.round(wear(20 + n) * 8);
    for (let k = 0; k < len; k++) put(sx + k, sy + Math.round(k * (wear(30 + n) - 0.5) * 0.4), tone(WOOD, FIRST.wood, 0.7, sx + k, sy));
  }
  if (wear(40) > 0.4) {
    const cy = Math.round(height * (0.3 + wear(41) * 0.5)), fromLeft = wear(42) > 0.5;
    for (let k = 0; k < 6 + Math.round(wear(43) * 10); k++) put(fromLeft ? 3 + k : width - 4 - k, cy + Math.round(Math.sin(k * 0.9 + seed) * 0.8), tone(WOOD, FIRST.wood, 0.05, k, cy));
  }
  if (wear(50) > 0.5) for (let k = 0; k < 4; k++) for (let j = 0; j < 4 - k; j++) put(wear(51) > 0.5 ? k : width - 1 - k, j, 0);
}

/**
 * An index card in an open drawer, `width` by `height` fine pixels: pale card, a red rule under its header and faint
 * blue lines below, a darker edge. `on` cards are pale and stand up; an `off` card is a step darker, pushed back.
 */
export function paintIndexCard(width: number, height: number, on: boolean, seed = 0): Bitmap {
  const out = createBitmap(width, height);
  const rule = Math.round(height * 0.62);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const edge = Math.min(x, y, width - 1 - x, height - 1 - y);
    let place: number;
    if (edge < 1) place = INK_PLACE;
    else if (y === rule || y === rule + 1) place = RED;
    else if (y > rule + 1 && (y - rule) % 6 === 0 && x > 4 && x < width - 5) place = BLUE;
    else place = tone(PAPER, FIRST.paper, (on ? 0.86 : 0.58) + (fbm(x / 30 + seed, y / 14, 2, 90 + seed) - 0.5) * 0.14 - (edge < 3 ? 0.12 : 0), x, y);
    out.pixels[y * width + x] = place;
  }
  return out;
}

/** The inside of an open drawer seen from above, `width` by `height` fine pixels: its dark floor and its lit side boards. */
export function paintDrawerInside(width: number, height: number): Bitmap {
  const out = createBitmap(width, height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const side = Math.min(x, width - 1 - x);
    let value = 0.16 + (fbm(x / 50, y / 6, 2, 95) - 0.5) * 0.12;
    if (side < 8) value = 0.55 - side * 0.03 + (fbm(x / 4, y / 30, 2, 96) - 0.5) * 0.2;
    if (y >= height - 10) value = 0.5 + (fbm(x / 40, y / 4, 2, 97) - 0.5) * 0.2 - (y >= height - 3 ? 0.3 : 0);
    if (x === 0 || x === width - 1 || y === height - 1) value = 0;
    out.pixels[y * width + x] = tone(WOOD, FIRST.wood, value, x, y);
  }
  return out;
}
