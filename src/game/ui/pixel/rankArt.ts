import { createBitmap, type Bitmap } from './bitmap';
import { C } from './palette';

/** A rank shield's width and height in art pixels (24 picked over 16 in the preview). */
export const RANK_SIZE = 24;
/** How many ranks have their own shield; a higher level shows the last one. */
export const RANK_COUNT = 20;

type Grid = { width: number; height: number; pixels: Uint8Array };
type Ramp = readonly [light: number, mid: number, dark: number];

const BRONZE: Ramp = [C.orangeLight, C.orange, C.orangeDark];
const SILVER: Ramp = [C.white, C.silver, C.silverDark];
const GOLD: Ramp = [C.goldLight, C.gold, C.goldDark];
const BLUE: Ramp = [C.blueLight, C.blue, C.blueDark];
const TEAL: Ramp = [C.teal, C.teal, C.tealDark];
const PURPLE: Ramp = [C.purpleLight, C.purple, C.purpleDark];
const RED: Ramp = [C.redLight, C.red, C.redDark];

const STAR7 = ['...G...', '..GGG..', 'GGGGGGG', '.GGgGG.', '..ggg..', '.gg.gg.', '.g...g.'];
const STAR9 = ['....G....', '....G....', '...GGG...', 'GGGGGGGGG', '.GGGgGGG.', '..ggggg..', '..ggggg..', '.gg...gg.', '.g.....g.'];
const CROWN = ['G.....G.....G', 'GG...GGG...GG', 'GGG.GGGGG.GGG', 'GGGGGGGGGGGGG', 'ggggggggggggg'];
/** The top rows of the chevrons for one, two or three of them; under a star they are thinner and lower. */
const CHEVRONS = [[8], [6, 11], [4, 9, 14]];
const CHEVRONS_UNDER_STAR = [[11], [9, 13], [9, 12, 15]];
/** The laurel's leaves on the left; the right side is the mirror. */
const LAUREL = [[1, 5], [1, 8], [1, 11], [2, 14], [3, 17], [5, 19], [7, 21]];

function set(b: Grid, x: number, y: number, c: number): void {
  if (x >= 0 && y >= 0 && x < b.width && y < b.height) b.pixels[y * b.width + x] = c;
}

/** Rows of `G` (the metal's light shade) and `g` (its mid shade); `.` leaves the pixel as it is. */
function stamp(b: Grid, x0: number, y0: number, rows: readonly string[], metal: Ramp): void {
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch !== '.') set(b, x0 + x, y0 + y, ch === 'G' ? metal[0] : metal[1]);
  }));
}

/** A shield `w` wide from row `top` to row 22, coming to a point from row 14: light rim top and left, dark rim right. */
function shield(b: Grid, w: number, [light, mid, dark]: Ramp, top = 1): void {
  const x0 = Math.floor((RANK_SIZE - w) / 2);
  for (let y = top; y <= 22; y++) {
    const inset = y < 14 ? 0 : Math.ceil(((y - 13) * (w / 2)) / 9);
    if (inset * 2 >= w) continue;
    for (let x = x0 + inset; x < x0 + w - inset; x++) set(b, x, y, y === top ? light : mid);
    set(b, x0 + inset, y, light);
    set(b, x0 + w - inset - 1, y, dark);
  }
}

function chevrons(b: Grid, tops: readonly number[], metal: Ramp, thick: 2 | 3): void {
  for (const top of tops) for (let dx = -6; dx <= 6; dx++) {
    const x = 12 + dx - (dx > 0 ? 1 : 0), y = top + Math.floor(Math.abs(dx) / 2);
    set(b, x, y, metal[0]);
    set(b, x, y + 1, thick === 3 ? metal[1] : metal[2]);
    if (thick === 3) set(b, x, y + 2, metal[2]);
  }
}

/** One big star, two side by side, or three in a triangle, round row `cy`. */
function stars(b: Grid, n: number, metal: Ramp, cy = 10): void {
  if (n === 1) stamp(b, 7, cy - 4, STAR9, metal);
  else if (n === 2) { stamp(b, 4, cy - 3, STAR7, metal); stamp(b, 13, cy - 3, STAR7, metal); }
  else { stamp(b, 8, cy - 7, STAR7, metal); stamp(b, 4, cy + 1, STAR7, metal); stamp(b, 13, cy + 1, STAR7, metal); }
}

function laurel(b: Grid): void {
  for (const [x, y] of LAUREL) for (const lx of [x!, RANK_SIZE - 1 - x!]) {
    set(b, lx, y!, C.leaf);
    set(b, lx, y! - 1, C.leafLight);
    set(b, lx + (lx < RANK_SIZE / 2 ? 1 : -1), y! - 1, C.leafDark);
  }
}

/** Ink on every empty pixel next to a coloured one. */
function outline(b: Grid): void {
  const src = Uint8Array.from(b.pixels);
  const filled = (x: number, y: number) => x >= 0 && y >= 0 && x < b.width && y < b.height && src[y * b.width + x] !== 0;
  for (let y = 0; y < b.height; y++) for (let x = 0; x < b.width; x++) {
    if (!filled(x, y) && (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1))) set(b, x, y, C.ink);
  }
}

/**
 * The shield for a player level (ft_1_09.AC1). Twenty ranks in tiers of three, after the progression of the Kenney Ranks
 * pack (CC0; used as an idea, every pixel drawn here): bronze, silver, then gold chevrons; silver, then gold stars;
 * stars in a laurel; a crowned gold crest, and the crest in a laurel. The count (1 to 3) of chevrons or stars is the step
 * inside a tier. Levels below 1 show rank 1, levels above `RANK_COUNT` the last rank.
 */
export function rankBadge(level: number): Bitmap {
  const rank = Math.min(RANK_COUNT, Math.max(1, Math.floor(level)));
  const b = createBitmap(RANK_SIZE, RANK_SIZE);
  const n = ((rank - 1) % 3) + 1;
  if (rank <= 3) { shield(b, 20, BLUE); chevrons(b, CHEVRONS[n - 1]!, BRONZE, 3); }
  else if (rank <= 6) { shield(b, 20, BLUE); chevrons(b, CHEVRONS[n - 1]!, SILVER, 3); }
  else if (rank <= 9) { shield(b, 20, TEAL); stamp(b, 9, 2, STAR7.slice(0, 6), GOLD); chevrons(b, CHEVRONS_UNDER_STAR[n - 1]!, GOLD, 2); }
  else if (rank <= 12) { shield(b, 20, PURPLE); stars(b, n, SILVER); }
  else if (rank <= 15) { shield(b, 20, PURPLE); stars(b, n, GOLD); }
  else if (rank <= 18) { shield(b, 16, RED, 2); laurel(b); stars(b, n, GOLD); }
  else {
    if (rank === 20) laurel(b);
    shield(b, rank === 20 ? 16 : 20, GOLD, 6);
    stamp(b, 5, 0, CROWN, GOLD);
    stamp(b, 7, 9, STAR9, [C.white, C.cream, C.cream]);
  }
  outline(b);
  return b;
}
