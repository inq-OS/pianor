import { createBitmap, type Bitmap } from './bitmap';
import { fbm, hash2, noise2 } from './paint/noise';
import { C } from './palette';

/**
 * The drawn parts of the main menu (ft_1_07) that are no painted picture: the scroll of parchment the players are
 * written on, the scrap the gear's choices are written on, the outlined free line, the keyboard of the bare piano, the mark of the active player and the hung board
 * with the game's name. Not plain box buttons but the way the 1991 game would do it, on parchment.
 */

/** How far the scroll's picture reaches past its sheet, in fine pixels: its curled ends stick out, it is turned a little, and its dark shape lies under it to the lower left. */
export const SCROLL_BLEED = { left: 12, top: 8, right: 12, bottom: 12 } as const;
/** The scroll's two curled ends, in fine pixels, and how far it is turned (a rise of this share along its width). */
const CURL = { top: 10, foot: 9, turn: 0.032 } as const;

/**
 * The scroll the players are written on, after the island maps' name scrolls of the 1991 game (with
 * two of them as reference: the menu's parchment looks like the map parchment): a sheet thrown down a
 * little askew, its top rolled up with the roll's spiral showing at the left end, its foot torn at the left and curled
 * over at the right, its sides wavering with a nick here and there, pale where it bulges and darker along its right
 * and under the roll, a dark line round it, and under it its own shape in ink, to the lower left. `width` by `height`
 * are the sheet in layout cells; the picture is on the fine grid and larger by `SCROLL_BLEED` on each side. `rule` is
 * the row (in cells from the sheet's top) of a flourish drawn in red ink across it, under the pictures at its head.
 * Its colours are the buffs of the interface, the same at every hour: the names on it must read at night as by day.
 */
export function scroll(width: number, height: number, rule?: number): Bitmap {
  const W = Math.max(40, width * 2), H = Math.max(40, height * 2), B = SCROLL_BLEED;
  const out = createBitmap(W + B.left + B.right, H + B.top + B.bottom);
  const cx = B.left + W / 2, cy = B.top + H / 2, hw = W / 2, hh = H / 2;
  const sheet: Scroll = {
    hw, hh,
    put: (x, y, colour) => { if (x >= 0 && y >= 0 && x < out.width && y < out.height) out.pixels[y * out.width + x] = colour; },
    // the sheet's own across and down, from its middle: it is turned so that its top rises to the right
    at: (x, y) => ({ u: x - cx - (y - cy) * CURL.turn, v: y - cy + (x - cx) * CURL.turn }),
    // each side wavers and has a nick or two
    side: (v, right) => 1.5 + noise2(v / 15, right ? 2 : 1, 441) * 4 + (hash2(Math.round(v / 6), right ? 4 : 3, 442) > 0.9 ? 3 - Math.abs(((v % 6) + 6) % 6 - 3) : 0),
    // the foot's left is torn: ragged, a deeper bite here and there
    torn: (u) => hh - CURL.foot + 2 - noise2(u / 7, 5, 443) * 5 - (hash2(Math.round(u / 4), 6, 444) > 0.8 ? 2 : 0),
  };
  scrollBody(out, sheet);
  scrollCurls(out, sheet);
  if (rule !== undefined) flourish(sheet, cx, B.top + rule * 2, hw - 16);
  scrollEdge(out);
  return out;
}

/** The scroll being drawn: its half width and half height, a pixel's place on the turned sheet, and its sides and torn foot. */
interface Scroll {
  hw: number; hh: number;
  put: (x: number, y: number, colour: number) => void;
  at: (x: number, y: number) => { u: number; v: number };
  side: (v: number, right: boolean) => number;
  torn: (u: number) => number;
}

/** Where the foot's curl begins, across the sheet from its middle: left of it the foot is torn. */
const curlFrom = (hw: number) => -hw + 30;

/** The sheet between its two curls: flat patches, pale where it bulges, a step darker along its right side and under the roll, a crease or two, a few specks. */
function scrollBody(out: Bitmap, { hw, hh, put, at, side, torn }: Scroll): void {
  for (let y = 0; y < out.height; y++) for (let x = 0; x < out.width; x++) {
    const { u, v } = at(x, y);
    if (v < -hh + CURL.top - 1 || u < -hw + side(v, false) || u > hw - side(v, true)) continue;
    if (v > (u < curlFrom(hw) ? torn(u) : hh - CURL.foot + 1)) continue;
    const bulge = fbm(u / 44 + 3, v / 36, 2, 445) + (noise2(u / 5, v / 7, 446) - 0.5) * 0.05;
    const shade = hw - u < 7 + noise2(v / 11, 7, 447) * 6 || v < -hh + CURL.top + 2 + noise2(u / 9, 8, 448) * 2 || v > hh - CURL.foot - 3 - noise2(u / 8, 9, 449) * 3;
    const crease = Math.abs(v - (hh * 0.2 + u * 0.12 + noise2(u / 13, 10, 450) * 3)) < 0.6 && hash2(Math.round(u / 3), 11, 451) > 0.3;
    const speck = hash2(x, y, 452) > 0.992;
    put(x, y, shade || crease || speck ? C.buffDark : bulge > 0.47 ? C.buffLight : C.buff);
  }
}

/**
 * The scroll's two ends. The top is rolled up toward the viewer: a round bar lit from above, a dark line under it,
 * its spiral showing where it sticks out on the left. The foot curls over on the right, showing the sheet's darker
 * back, its spiral at the right end.
 */
function scrollCurls(out: Bitmap, { hw, hh, put, at }: Scroll): void {
  const bar = (t: number, back: boolean) => (back
    ? (t < 0.14 ? C.umberDark : t < 0.36 ? C.buffDeep : t < 0.7 ? C.buffDark : t < 0.9 ? C.buffDeep : C.umberDark)
    : (t < 0.12 ? C.umber : t < 0.4 ? C.buffLight : t < 0.7 ? C.buff : t < 0.9 ? C.buffDark : C.umberDark));
  // a roll's end, seen into it: a ring, the turns inside as a darker hook
  const spiral = (du: number, dv: number, r: number): number => {
    const far = Math.hypot(du / 0.62, dv) / r;
    if (far > 1) return 0;
    if (far > 0.78) return C.umberDark;
    const turn = Math.atan2(dv, du);
    return Math.abs(far - (0.28 + ((turn + Math.PI) / (Math.PI * 2)) * 0.34)) < 0.11 ? C.umber : far < 0.2 ? C.umberDark : C.buffDark;
  };
  for (let y = 0; y < out.height; y++) for (let x = 0; x < out.width; x++) {
    const { u, v } = at(x, y);
    const top = (v + hh) / CURL.top, foot = (v - (hh - CURL.foot)) / CURL.foot;
    if (top >= 0 && top < 1 && u > -hw - 5 && u < hw + 1 - Math.abs(top - 0.5) * 3) put(x, y, bar(top, false));
    if (foot >= 0 && foot < 1 && u > curlFrom(hw) + Math.abs(foot - 0.5) * 4 && u < hw + 6) put(x, y, bar(foot, true));
    const head = spiral(u + hw + 5, v + hh - CURL.top / 2, CURL.top / 2 + 1), tail = spiral(u - hw - 6, v - hh + CURL.foot / 2, CURL.foot / 2 + 1);
    if (head) put(x, y, head);
    if (tail) put(x, y, tail);
  }
}

/** A flourish in red ink across the sheet, as under the names on the 1991 game's map scrolls: one stroke, fatter in its middle, a small curl at each end. */
function flourish({ put }: Scroll, cx: number, y: number, half: number): void {
  for (let k = -half; k <= half; k++) {
    const t = k / half, wave = Math.round(Math.sin(t * Math.PI * 1.5) * 1.6 - t * cx * CURL.turn * 0.5);
    put(cx + k, y + wave, C.redDark);
    if (Math.abs(t) < 0.55) put(cx + k, y + wave + 1, C.redDark);
  }
  for (const side of [-1, 1]) for (let a = 0; a < 5.2; a += 0.2) {
    const r = 3.4 - a * 0.5;
    put(Math.round(cx + side * (half + 1 - r * Math.sin(a) * 0.9)), Math.round(y + (side < 0 ? -1.6 : 1.6) * 1 - side * (r * Math.cos(a) - 3.4) - side * half * CURL.turn), C.redDark);
  }
}

/** The dark line round the scroll, and its own shape in ink under it, to the lower left: it lies on the picture as the maps' scrolls lie on their sea. */
function scrollEdge(out: Bitmap): void {
  const { width: w, height: h, pixels } = out;
  const filled = pixels.map((p) => (p !== 0 ? 1 : 0));
  const on = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && filled[y * w + x] === 1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (on(x, y)) { if (!on(x - 1, y) || !on(x + 1, y) || !on(x, y - 1) || !on(x, y + 1)) pixels[y * w + x] = C.umberDark; }
    else if (on(x + 5, y - 5) || on(x + 4, y - 5) || on(x + 5, y - 4)) pixels[y * w + x] = C.ink;
  }
}

/**
 * A scrap of the same parchment, `width` by `height` layout cells on the fine grid, torn at its top and its foot, one
 * corner turned up: the gear's choices are written on it.
 */
export function parchment(width: number, height: number): Bitmap {
  const W = Math.max(8, width * 2), H = Math.max(8, height * 2);
  const sheet = createBitmap(W, H);
  const page: Page = {
    W, H,
    put: (x, y, colour) => { if (x >= 0 && y >= 0 && x < W && y < H) sheet.pixels[y * W + x] = colour; },
    // the scrap's edges waver, its top and foot are torn
    left: (y) => 2 + Math.round(noise2(y / 17, 1, 441) * 6),
    right: (y) => W - 3 - Math.round(noise2(y / 14, 2, 442) * 5),
    foot: (x) => H - 2 - Math.round(noise2(x / 9, 3, 443) * 5) - (hash2(x >> 2, 4, 444) > 0.8 ? 2 : 0),
    head: (x) => 1 + Math.round(noise2(x / 8, 7, 452) * 4),
    // the corner turned up at the foot on the right: what lies under the fold line is gone
    fold: (x, y) => x + y - (W + H - 22),
  };
  pageBody(page);
  pageCorner(page);
  return sheet;
}

/** The scrap being drawn: its size in fine pixels, its edges at each row and column, and how far a pixel lies past the turned corner's fold. */
interface Page {
  W: number; H: number;
  put: (x: number, y: number, colour: number) => void;
  left: (y: number) => number;
  right: (y: number) => number;
  foot: (x: number) => number;
  head: (x: number) => number;
  fold: (x: number, y: number) => number;
}

/** The parchment itself: broad flat patches, pale where the sheet bulges, a stain here and there, darker toward the edges, a line of brown round it. */
function pageBody({ H, put, left, right, foot, head, fold }: Page): void {
  for (let y = 0; y < H; y++) for (let x = left(y); x <= right(y); x++) {
    if (y > foot(x) || y < head(x) || fold(x, y) > 0) continue;
    const torn = y - 1 < Math.max(head(x), head(x + 1), head(x - 1));
    const edge = torn || x === left(y) || x === right(y) || y + 1 > Math.min(foot(x), foot(x + 1), foot(x - 1)) || fold(x, y) === 0;
    const near = Math.min(x - left(y), right(y) - x, foot(x) - y);
    // pale where the sheet bulges; stained along its edges and in a spot or two, not all over
    const bulge = fbm(x / 38, y / 30, 2, 445) + (noise2(x / 5, y / 7, 446) - 0.5) * 0.06;
    const stain = fbm(x / 22, y / 18, 2, 453) + (near < 9 ? (9 - near) * 0.035 : 0);
    const speck = hash2(x, y, 447) > 0.99;
    const paper = speck || stain > 0.72 ? C.buffDark : bulge > 0.5 ? C.buffLight : C.buff;
    put(x, y, !edge ? paper : hash2(x >> 1, y >> 1, 448) > 0.25 ? C.umber : C.buffDeep);
  }
}

/** The turned corner: the sheet's back, darker, a dark line along the fold. */
function pageCorner({ W, H, put, right, foot, fold }: Page): void {
  for (let y = H - 22; y < H; y++) for (let x = W - 22; x < W; x++) {
    const d = fold(x, y);
    const turned = d > 0 && d < 9 && x <= right(y) - 5 + d && y <= foot(x) - 5 + d && x + y < W + H - 13;
    if (turned) put(x - d - 1, y - d - 1, d === 1 ? C.umber : d > 6 ? C.buffDeep : C.buffDark);
  }
}

/**
 * The next free line (the next empty slot is the outline of a button with a plus): a place not
 * yet written, only marked out in a broken line of ink, with a plus in its middle. Its last row is left clear.
 */
export function addPlate(width: number, height: number): Bitmap {
  const plate = createBitmap(width, height);
  const w = width, h = height - 1;
  const put = (x: number, y: number, colour: number) => { plate.pixels[y * width + x] = colour; };
  const dash = (i: number) => i % 5 < 3;
  for (let x = 1; x < w - 1; x++) if (dash(x)) { put(x, 0, C.umberDark); put(x, h - 1, C.umberDark); }
  for (let y = 1; y < h - 1; y++) if (dash(y + 1)) { put(0, y, C.umberDark); put(w - 1, y, C.umberDark); }
  const cx = w >> 1, cy = h >> 1, arm = Math.max(2, Math.min(3, (h >> 1) - 3));
  for (let k = -arm; k <= arm; k++) { put(cx + k, cy, C.featherStreak); put(cx, cy + k, C.featherStreak); }
  return plate;
}

/**
 * The keyboard of the bare piano (a button with a picture of a keyboard): `keys` white keys
 * from a C, the black keys in their twos and threes. White and ink: on the sheet its lines take the ink's colour.
 */
export function keyboardPicture(keys = 7, height = 10): Bitmap {
  const KEY = 5;
  const picture = createBitmap(keys * (KEY + 1) + 1, height);
  const { width } = picture;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) picture.pixels[y * width + x] = y === 0 || y === height - 1 || x % (KEY + 1) === 0 ? C.ink : C.white;
  // a black key sits on the line after every white key but E and B
  for (let k = 0; k < keys - 1; k++) {
    if (k % 7 === 2 || k % 7 === 6) continue;
    const x = (k + 1) * (KEY + 1);
    for (let y = 1; y < Math.round(height * 0.6); y++) for (let dx = -1; dx <= 1; dx++) picture.pixels[y * width + x + dx] = C.ink;
  }
  return picture;
}

/** A picture as one flat shape of ink (every pixel of it `C.ink`), for a written line to draw in its ink's colour: the gear on the sheet. */
export function inked(picture: Bitmap): Bitmap {
  const out = createBitmap(picture.width, picture.height);
  picture.pixels.forEach((index, i) => { if (index !== 0) out.pixels[i] = C.ink; });
  return out;
}

/**
 * The board the game's name is written on, hung on two ropes from the picture's top (`drop` rows of rope over a board
 * of `width` by `height`): a plank of the band's wood, a dark line round it, a nail under each rope.
 */
export function nameBoard(width: number, height: number, drop: number): Bitmap {
  const board = createBitmap(width, height + drop);
  const put = (x: number, y: number, colour: number) => { board.pixels[y * width + x] = colour; };
  for (const x of [7, width - 8]) {
    for (let y = 0; y < drop + 3; y++) put(x + (y % 4 === 3 ? 1 : 0), y, y % 2 === 0 ? C.honeyDark : C.groove);
  }
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const edge = x === 0 || y === 0 || x === width - 1 || y === height - 1;
    const corner = (x === 0 || x === width - 1) && (y === 0 || y === height - 1);
    if (corner) continue;
    put(x, drop + y, edge ? C.groove : y === 1 || x === 1 ? C.panelLight : C.panel);
  }
  for (const x of [7, width - 8]) { put(x, drop + 3, C.honey); put(x + 1, drop + 3, C.honeyDark); }
  return board;
}

/**
 * The mark beside the active player's name: the lantern's light as a small star, so a student sees at a glance which
 * line is theirs (an art review). White: the scene tints it to red ink.
 */
export function activeMark(): Bitmap {
  const rows = ['...w...', '...w...', '..www..', 'wwwwwww', '..www..', '...w...', '...w...'];
  const mark = createBitmap(7, rows.length);
  rows.forEach((row, y) => [...row].forEach((bit, x) => { if (bit === 'w') mark.pixels[y * 7 + x] = C.white; }));
  return mark;
}

/**
 * The academic hat at the scroll's head, between the keyboard and the gear (ft_1_26.AC1, WP-14, d145; picked
 * painted): a mortarboard seen a little from above, its board lit from the upper left, the cap under
 * it, and a gold tassel hanging from the button over its right edge. 16 by 13 cells, in the game's colours.
 */
export const HAT = { w: 16, h: 13 } as const;
export function hatPicture(): Bitmap {
  const { w, h } = HAT;
  const hat = createBitmap(w, h);
  const put = (x: number, y: number, colour: number) => { if (x >= 0 && y >= 0 && x < w && y < h) hat.pixels[y * w + x] = colour; };
  // the cap: a short, squat drum under the board, its left side catching the light, an ink band at its foot
  for (let y = 4; y < 8; y++) for (let x = 4; x < 12; x++) put(x, y, x === 4 || x === 11 || y === 7 ? C.ink : x === 5 ? C.duskDark : C.duskDeep);
  // the board: a flat square turned toward us and seen from a little above, so a wide, flat diamond; lit from the upper
  // left, paler than the cap under it (the art review: a dark board over a tall drum read as a top hat), its rim in ink
  const rows = [[6, 9], [3, 12], [0, 15], [1, 14], [4, 11], [7, 8]] as const satisfies readonly (readonly [number, number])[];
  rows.forEach(([from, to]: readonly [number, number], y) => {
    for (let x = from; x <= to; x++) {
      // the rim: the board's ends, and its near edges, where the row in front of it no longer reaches
      const next = rows[y + 1];
      const rim = x === from || x === to || y === 0 || next === undefined || (y >= 2 && (x < next[0] || x > next[1]));
      put(x, y, rim ? C.ink : x < 8 || y < 3 ? C.duskLight : C.dusk);
    }
  });
  // a sheen where the light falls on the board's far left edge
  for (const [x, y] of [[4, 1], [5, 1], [2, 2], [3, 2]] as const) put(x, y, C.silver);
  // the button at the board's middle and the cord to its right corner, then the tassel down past the cap
  put(7, 2, C.goldLight);
  put(8, 2, C.gold);
  for (let x = 9; x <= 14; x++) put(x, 2, C.gold);
  for (let y = 3; y < 9; y++) put(14, y, y === 3 ? C.gold : C.goldDark);
  for (let y = 9; y < 13; y++) for (let x = 13; x <= 15; x++) put(x, y, x === 13 ? C.goldDark : y === 12 ? C.goldDark : C.gold);
  return hat;
}
