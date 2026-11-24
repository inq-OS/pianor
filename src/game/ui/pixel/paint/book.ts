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
const RIBBON_TONES = [0x30060a, 0x5a0c12, 0x8a1a1e, 0xb8302a, 0xd85a40, 0xf09070] as const;
/** The bookmarks' silk (ft_1_12 rule 10), dark to light: the red of All is the book's own ribbon, then own, the teacher's, the characters'. */
const SILK_TONES = [
  RIBBON_TONES,
  [0x0a2008, 0x1a4214, 0x2e6a22, 0x4a9234, 0x78b850, 0xb4dc84],
  [0x1a0e2e, 0x2e1c4e, 0x48307a, 0x6a4ca0, 0x9478c4, 0xc4ace0],
  [0x062424, 0x0e4040, 0x1a6462, 0x2a8a84, 0x4cb2a8, 0x8cdccc],
] as const;
const COVER = fineRun(COVER_TONES, 4);
const BRASS = fineRun(BRASS_TONES, 4);
const PAGE = fineRun(PAGE_TONES, 3);
const SILK = SILK_TONES.map((run) => fineRun(run, 5));
const RIBBON = SILK[0]!;

/**
 * The book's colours: place 0 is never painted, then the cover, the brass, the pages, and the silk of each bookmark (the
 * first is the book's red ribbon).
 */
export const BOOK_PALETTE: readonly number[] = [0x000000, ...COVER, ...BRASS, ...PAGE, ...SILK.flat()];

/**
 * The teacher's register (WP-14, d145): the same book bound in bottle-green cloth, as an old school register is. Its
 * places are the song book's, so one painted book takes either palette.
 */
const REGISTER_COVER_TONES = [0x061208, 0x0e2814, 0x1a4222, 0x2a5c30, 0x3e7842] as const;
export const REGISTER_PALETTE: readonly number[] = [0x000000, ...fineRun(REGISTER_COVER_TONES, 4), ...BRASS, ...PAGE, ...SILK.flat()];
const SILK_FIRST = SILK.map((_, i) => 1 + COVER.length + BRASS.length + PAGE.length + SILK.slice(0, i).reduce((n, run) => n + run.length, 0));
const FIRST = { cover: 1, brass: 1 + COVER.length, page: 1 + COVER.length + BRASS.length, ribbon: SILK_FIRST[0]! } as const;
/** The book's ink (its darkest page tone) and the ink's softer edge, for what is painted on its pages. */
const INK = FIRST.page, INK_SOFT = FIRST.page + 2;

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
function pageLight(x: number, y: number, down: number, fromGutter: number, fromSide: number, up = 99): number {
  let value = 0.86 + (fbm(x / 60, y / 50, 3, 51) - 0.5) * 0.16;
  // the paper browns towards its edges, as old paper does (the 1991 and 1997 papers burn darker and warmer at the rim): two bands
  const rim = Math.min(fromSide, down, up) + Math.round(noise2(x / 16, y / 16, 53) * 4);
  if (rim < 7) value -= 0.12;
  else if (rim < 16) value -= 0.06;
  if (fromGutter < 2) value = 0.2;
  else if (fromGutter < 5) value = 0.48;
  else if (fromGutter < 12 + Math.round(noise2(0, y / 14, 52) * 3)) value = 0.7;
  if (fromSide < 4) value = Math.min(value, 0.6);
  if (down < 2) value -= 0.12;
  if (fromSide < 6 && fromSide % 2 === 1 && down > 2) value -= 0.12; // the leaves' edges at the side, a fine line each
  return value;
}

/** Each page bows up from the gutter, highest a quarter of the way out, and falls to its outer edge (0 at the gutter's fold, 1 at its height). */
function bowAt(x: number, width: number): number {
  const mid = width / 2;
  const t = Math.abs(x - mid) / (mid - BOOK_COVER);
  return t < 0.25 ? Math.sin((t / 0.25) * Math.PI / 2) : 1 - ((t - 0.25) / 0.75) ** 2 * 0.7;
}

/** The row of a page's foot at column `x` of a book `width` by `height`: it sinks a little into the gutter. */
function pageFoot(x: number, width: number, height: number): number {
  const mid = width / 2;
  const t = Math.abs(x - mid) / (mid - BOOK_COVER);
  return height - 1 - BOOK_COVER - BOOK_STACK - Math.round(t < 0.1 ? (0.1 - t) * 30 : 0) + Math.round((1 - bowAt(x, width)) * 2);
}

/**
 * Where a page's bottom outer corner is in a book `width` by `height` (fine pixels from the book's top left): the right
 * page's, and the left page's mirrored. The page's turned-up corner (`paintPageTurn`) is laid with its corner there.
 */
export function pageCorners(width: number, height: number): { left: { x: number; y: number }; right: { x: number; y: number } } {
  const right = width - 1 - BOOK_COVER;
  return { left: { x: BOOK_COVER, y: pageFoot(BOOK_COVER, width, height) }, right: { x: right, y: pageFoot(right, width, height) } };
}

/** The age of the paper: a few soft brown specks (foxing), more of them towards the page's edges. */
function foxed(x: number, y: number, fromEdge: number): boolean {
  if (fromEdge > 40) return false;
  const spot = noise2(x / 3.5, y / 3.5, 71);
  return spot > 0.8 + fromEdge / 200 && fbm(x / 30, y / 30, 2, 72) > 0.5;
}

/** A gilt line stamped in the cloth: a tone of brass, lit on its upper left edge. */
function gilt(x: number, y: number, lit: boolean): number {
  return tone(BRASS, FIRST.brass, lit ? 0.8 : 0.55, x, y);
}

/** The open book's brass corners: a triangle on each, lit from the upper left, a rivet in each. */
function brassCorners(put: (x: number, y: number, place: number) => void, width: number, height: number): void {
  const corner = Math.max(14, Math.round(Math.min(width, height) * 0.08));
  for (const [cx, cy, sx, sy] of [[0, 0, 1, 1], [width - 1, 0, -1, 1], [0, height - 1, 1, -1], [width - 1, height - 1, -1, -1]] as const) {
    for (let j = 0; j < corner; j++) for (let i = 0; i < corner - j; i++) {
      const x = cx + sx * i, y = cy + sy * j;
      const edge = i + j >= corner - 2;
      const bevel = i + j === corner - 3;
      put(x, y, edge ? FIRST.brass : tone(BRASS, FIRST.brass, (bevel ? 0.95 : 0.75) - (i + j) / (corner * 3) - (sx < 0 || sy < 0 ? 0.15 : 0), x, y));
    }
    const rx = cx + sx * Math.round(corner * 0.28), ry = cy + sy * Math.round(corner * 0.28);
    for (const [dx, dy, v] of [[0, 0, 0.2], [1, 0, 0.35], [0, 1, 0.35], [-1, 0, 0.9], [0, -1, 0.9]] as const) put(rx + dx, ry + dy, tone(BRASS, FIRST.brass, v, rx + dx, ry + dy));
  }
}

/** The open book, `width` by `height` fine pixels, the cover's outer edge on the picture's edge. Every pixel inside the cover is painted. */
export function paintBook(width: number, height: number): Bitmap {
  const out = createBitmap(width, height);
  const put = (x: number, y: number, place: number) => { if (x >= 0 && y >= 0 && x < width && y < height) out.pixels[y * width + x] = place; };
  const mid = width / 2;
  // the cover: blue cloth, grained, a darker rim, and a gilt line stamped round it where the pages leave it showing
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const rim = Math.min(x, y, width - 1 - x, height - 1 - y);
    let value = 0.55 + (fbm(x / 40, y / 40, 2, 31) - 0.5) * 0.3;
    if (rim < 2) value -= 0.35;
    else if (y >= height - 6) value -= 0.25;
    else if (rim === 2 && (x === 2 || y === 2)) value += 0.25;
    put(x, y, rim === 4 ? gilt(x, y, x === 4 || y === 4) : tone(COVER, FIRST.cover, value, x, y));
  }
  brassCorners(put, width, height);
  // the pages: from the cover's inner edge, dipping to the gutter, curling up a little at their outer edges
  const left = BOOK_COVER, right = width - 1 - BOOK_COVER, bottom = height - 1 - BOOK_COVER;
  const topOf = (x: number) => BOOK_COVER + 4 - Math.round(bowAt(x, width) * 10);
  const curl = Math.max(10, Math.round(width * 0.03));
  for (let x = left; x <= right; x++) {
    const top = topOf(x), foot = pageFoot(x, width, height);
    const fromGutter = Math.abs(x - mid), fromSide = Math.min(x - left, right - x);
    // the stack of leaves under the page: fine light and dark lines, the lower ones in the shade of the page over them
    for (let y = foot + 1; y <= bottom; y++) put(x, y, (y - foot) % 2 === 0 ? FIRST.page + 2 : FIRST.page + PAGE.length - (y - foot < 3 ? 4 : 3));
    for (let y = top; y <= foot; y++) {
      const fromEdge = Math.min(fromSide, y - top, foot - y);
      const value = pageLight(x, y, y - top, fromGutter, fromSide, foot - y) - (fromGutter > 14 && foxed(x, y, fromEdge) ? 0.1 : 0);
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
  // the headbands at the spine's top and foot: a little roll of red and gold silk where the leaves are sewn
  for (const [y0, dir] of [[topOf(mid) - 3, 1], [pageFoot(mid, width, height) + 1, -1]] as const) {
    for (let k = 0; k < 3; k++) for (let x = Math.round(mid) - 5; x <= Math.round(mid) + 5; x++) {
      const y = y0 + (dir > 0 ? k : k + 1);
      const stripe = (x + k) % 3 === 0;
      put(x, y, stripe ? tone(BRASS, FIRST.brass, 0.7 - k * 0.15, x, y) : tone(RIBBON, FIRST.ribbon, 0.6 - k * 0.2, x, y));
    }
  }
  paintBookRibbon(put, width, height);
  return out;
}

/**
 * The red ribbon: it comes out of the gutter low on the right page, lies across the page's foot with a twist in it, and
 * hangs over the book's foot, its end cut in a V.
 */
function paintBookRibbon(put: (x: number, y: number, place: number) => void, width: number, height: number): void {
  const mid = width / 2, rw = 7;
  const from = pageFoot(Math.round(mid) + 3, width, height) - 26;
  const end = height + 2;
  const twist = from + Math.round((end - from) * 0.45);
  for (let y = from; y < end; y++) {
    const t = (y - from) / (end - from);
    // it leaves the gutter and drifts outwards as it falls, more and more
    const cx = mid + 3 + rw / 2 + t * t * width * 0.07;
    // through the twist it narrows to an edge and shows its duller back
    const d = Math.abs(y - twist);
    const half = d < 4 ? 1 + d * 0.6 : rw / 2;
    const back = y > twist;
    for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
      const tail = y - (end - 7);
      if (tail > 0 && Math.abs(x - cx) < tail * 0.8) continue;
      const across = (x - (cx - half)) / (2 * half + 0.01);
      const sheen = !back && across > 0.2 && across < 0.45 ? 0.2 : 0;
      const edge = across > 0.85 ? -0.3 : 0;
      put(x, y, tone(RIBBON, FIRST.ribbon, (back ? 0.42 : 0.62) + sheen + edge - (d < 4 ? 0.15 : 0), x, y));
    }
  }
}

/**
 * A page's bottom outer corner turned up to turn the page (ft_1_12 rule 10), `size` fine pixels on a side, the page's
 * corner at the picture's bottom right (`flipX` it for the left page). At rest only a small dog-ear; `lifted` (under the
 * pointer) the corner rolls up far over the page, its back paler, the page under it showing where it was, and it lays a
 * soft shade on the page.
 */
export function paintPageTurn(size: number, lifted: boolean): Bitmap {
  const out = createBitmap(size, size);
  const put = (x: number, y: number, place: number) => { if (x >= 0 && y >= 0 && x < size && y < size) out.pixels[y * size + x] = place; };
  // u and v count in from the page's right edge and its foot
  const at = (u: number, v: number) => ({ x: size - 1 - u, y: size - 1 - v });
  const fold = Math.round(size * (lifted ? 0.74 : 0.46));
  // the rolled flap: the cut-off corner turned over the fold. Rolling, not creased, it reaches less far over the page than
  // the corner it was (`roll`), and its tip is rounded off
  const roll = lifted ? 0.62 : 0.85;
  const onFlap = (u: number, v: number) => {
    const d = u + v - fold;
    if (d < 0) return false;
    const back = ((1 + 1 / roll) * d) / 2;
    const gu = u - back, gv = v - back;
    return gu >= 0 && gv >= 0 && !(lifted && gu + gv < 1.5 && d > 4);
  };
  // the soft shade the flap lays on the page beside its edges
  for (let v = 0; v < size; v++) for (let u = 0; u < size; u++) {
    if (onFlap(u, v) || u + v < fold) continue;
    const near = [1, 2].some((k) => onFlap(u - k, v - k) || onFlap(u - k, v) || onFlap(u, v - k));
    if (near && lifted) { const p = at(u, v); put(p.x, p.y, tone(PAGE, FIRST.page, 0.66, p.x, p.y)); }
  }
  // where the corner was: the next leaf, in the shade of the one lifting off it, with the leaves' edges at its side and foot
  for (let v = 0; v < size; v++) for (let u = 0; u + v < fold; u++) {
    const p = at(u, v);
    const value = u + v >= fold - 2 ? 0.42 : (u < 3 && u % 2 === 1) || (v < 3 && v % 2 === 1) ? 0.5 : 0.64;
    put(p.x, p.y, tone(PAGE, FIRST.page, value, p.x, p.y));
  }
  for (let v = 0; v < size; v++) for (let u = 0; u < size; u++) {
    if (!onFlap(u, v)) continue;
    const p = at(u, v);
    const edge = !onFlap(u + 1, v) || !onFlap(u, v + 1);
    const fromFold = u + v - fold;
    // the roll: a shade where the paper turns, a lit band on the roll, then the back of the page, fading to the tip
    const value = fromFold < 2 ? 0.6 : fromFold < (lifted ? 6 : 4) ? 1 : 0.93 - (fromFold / (fold * 2)) * 0.2;
    put(p.x, p.y, edge ? INK_SOFT : tone(PAGE, FIRST.page, value, p.x, p.y));
  }
  return out;
}

/** The page number's numerals, in the book's old type: a thick stem, hairline joins, bracketed serifs ('#' ink, '+' its soft edge). */
const FOLIO_DIGITS: Readonly<Record<string, readonly string[]>> = {
  '0': ['...+###+..', '..##+.+##.', '.##+...+##', '.##.....##', '###.....##', '###.....##', '###.....##', '###.....##', '###.....##', '###.....##', '.##.....##', '.##+...+##', '..##+.+##.', '...+###+..'],
  '1': ['....+##...', '..+####...', '.#+.###...', '....###...', '....###...', '....###...', '....###...', '....###...', '....###...', '....###...', '....###...', '....###...', '..+#####+.', '..#######.'],
  '2': ['..+####+..', '.##+..+##.', '.###...###', '.###...###', '..#+...###', '.......##+', '......+##.', '.....+#+..', '....+#+...', '...+#+....', '..+#+....#', '.+#+....+#', '.#########', '##########'],
  '3': ['..+####+..', '.##+..+##.', '.###...###', '..#+...###', '.......##+', '.....+##+.', '...####...', '.....+##+.', '.......###', '.......###', '..#+...###', '.###...###', '.##+..+##.', '..+####+..'],
  '4': ['......##..', '.....###..', '....+###..', '....#+##..', '...+#.##..', '..+#..##..', '..#+..##..', '.+#...##..', '+#+...##..', '##########', '......##..', '......##..', '....+####+', '....######'],
  '5': ['.+#######.', '.########.', '.##.......', '.##.......', '.##.+##+..', '.####++##.', '.##+...###', '.......###', '.......###', '..#+...###', '.###...###', '.###...##+', '.+##+.+##.', '...+###+..'],
  '6': ['....+###+.', '...##+..#.', '..##+.....', '.+##......', '.##.......', '.##+###+..', '###++.+##.', '###....###', '###....###', '###....###', '.##....###', '.##+...##+', '..##+.+##.', '...+###+..'],
  '7': ['##########', '#########+', '#+.....+#.', '.......#+.', '......+#..', '......##..', '.....+#+..', '.....##...', '....+##...', '....###...', '....###...', '....###...', '....###...', '....+#+...'],
  '8': ['..+####+..', '.##+..+##.', '.##....##.', '.##+...##.', '..###+##+.', '...+###+..', '..+#+###..', '.##+..+##.', '###....###', '###....###', '###....###', '###....###', '.##+..+##.', '..+####+..'],
  '9': ['..+###+...', '.##+.+##..', '###....##.', '###....###', '###....###', '###....###', '.##+.++###', '..+###+###', '.......##.', '.......##.', '......+##.', '.....+##..', '..#.+##...', '..+###+...'],
};
const FOLIO_W = 10, FOLIO_H = 14, FOLIO_GAP = 2;

/**
 * A page's number at its foot (ft_1_12.AC12) as an old book prints it: the numerals in the book's ink, a fine swash either
 * side that thickens towards the number and ends in a curl, and a small diamond between swash and number. Fine pixels,
 * in the book's palette.
 */
export function paintFolio(n: number): Bitmap {
  const digits = String(Math.max(0, Math.floor(n)));
  const numberW = digits.length * FOLIO_W + (digits.length - 1) * FOLIO_GAP;
  const swash = 26, gap = 3;
  const width = 2 * (swash + gap) + numberW, height = FOLIO_H;
  const out = createBitmap(width, height);
  const put = (x: number, y: number, place: number) => { if (x >= 0 && y >= 0 && x < width && y < height) out.pixels[y * width + x] = place; };
  [...digits].forEach((d, i) => FOLIO_DIGITS[d]!.forEach((row, y) => [...row].forEach((c, x) => {
    if (c !== '.') put(swash + gap + i * (FOLIO_W + FOLIO_GAP) + x, y, c === '#' ? INK : INK_SOFT);
  })));
  // each swash: a wave from a curl at its outer end to a diamond by the number, a hairline swelling to two pixels in its middle
  const mid = Math.round(height / 2);
  for (const side of [-1, 1] as const) {
    const at = (s: number) => (side < 0 ? s : width - 1 - s);
    for (let s = 5; s < swash - 4; s++) {
      const t = (s - 5) / (swash - 9);
      const y = mid + Math.round(Math.sin(t * Math.PI * 1.5 + Math.PI) * 1.6);
      put(at(s), y, INK);
      if (t > 0.3 && t < 0.8) put(at(s), y + 1, INK_SOFT);
    }
    // the curl at the outer end: a little ring opening towards the wave
    for (const [dx, dy] of [[2, -2], [1, -2], [0, -1], [0, 0], [0, 1], [1, 2], [2, 2], [3, 1], [3, 0], [4, 1]] as const) put(at(dx + 1), mid + 1 + dy - 2, INK);
    // the diamond by the number
    const dx = swash - 2;
    for (const [ox, oy] of [[0, -2], [-1, -1], [0, -1], [1, -1], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [-1, 1], [0, 1], [1, 1], [0, 2]] as const) put(at(dx + ox), mid + oy, Math.abs(ox) + Math.abs(oy) === 2 ? INK_SOFT : INK);
  }
  return out;
}

/**
 * A bookmark's ribbon (ft_1_12 rule 10), `width` by `height` fine pixels, in silk `mark` (0 All, 1 own, 2 the teacher's,
 * 3 the characters'): woven edges, a sheen along it, a soft wave, its outer (left) end cut in a swallowtail and its inner
 * end slipping under the next leaf. The open one is the brighter; a closed one lies a little dimmer, in the page's light.
 */
export function paintBookmark(mark: number, width: number, height: number, open: boolean): Bitmap {
  const run = SILK[mark] ?? RIBBON, first = SILK_FIRST[mark] ?? FIRST.ribbon;
  const out = createBitmap(width, height);
  const put = (x: number, y: number, place: number) => { if (x >= 0 && y >= 0 && x < width && y < height) out.pixels[y * width + x] = place; };
  const notch = Math.round(height * 0.32);
  for (let x = 0; x < width; x++) {
    const wave = Math.round(Math.sin(x / 9 + mark) * 0.8);
    const top = 1 + wave, foot = height - 2 + wave;
    for (let y = top; y <= foot; y++) {
      const across = (y - top) / (foot - top);
      // the swallowtail: a V cut into the outer end
      if (x < notch - Math.round(Math.abs(across - 0.5) * 2 * notch)) continue;
      const fromEnd = width - 1 - x;
      // the inner end slides under the next leaf: a shade where it goes
      let value = (open ? 0.62 : 0.5) + (across > 0.16 && across < 0.36 ? 0.24 : 0) - (across > 0.8 ? 0.18 : 0);
      if (y === top || y === foot) value = open ? 0.28 : 0.2;
      if (fromEnd < 2) value = 0.15;
      else if (fromEnd < 4) value -= 0.2;
      // the weave: a faint fleck along the threads
      if (hash2(x, y, 81 + mark) > 0.9) value -= 0.1;
      put(x, y, tone(run, first, value, x, y));
    }
  }
  return out;
}

type Put = (x: number, y: number, place: number) => void;

/** How far the closed book's leaves show under its cover at the fore-edge and the foot, and how far its ribbons hang below it, in fine pixels. */
export const COVER_EDGE = 5;
export const COVER_TAILS = 22;

/**
 * The song book closed (ft_1_07: a new player's name is written on its cover), `width` by `height` fine pixels: the same
 * blue cloth and brass corners as the open book, a rounded spine with raised bands down its left side, a gilt frame
 * stamped round the board with a small flower at each corner, the leaves showing under the board at the fore-edge and the
 * foot, and the four bookmarks hanging out at the foot. `label` (fine pixels from the top left) is a blank name plate: a
 * brass frame round a slip of the book's palest paper, which the name is written on.
 */
export function paintCover(width: number, height: number, label: { x: number; y: number; w: number; h: number }): Bitmap {
  const out = createBitmap(width, height);
  const put = (x: number, y: number, place: number) => { if (x >= 0 && y >= 0 && x < width && y < height) out.pixels[y * width + x] = place; };
  const boardW = width - COVER_EDGE, boardH = height - COVER_TAILS - COVER_EDGE;
  const spine = Math.max(16, Math.round(width * 0.07));
  coverLeaves(put, width, boardW, boardH);
  coverBoard(put, boardW, boardH, spine);
  coverFrame(put, boardW, boardH, spine);
  namePlate(put, label);
  return out;
}

/** The closed book's leaves under the board, the back board under them, and the four ribbons hanging out of the foot. */
function coverLeaves(put: Put, width: number, boardW: number, boardH: number): void {
  // the leaves under the board, and the back board under them
  for (let y = 6; y < boardH + COVER_EDGE; y++) for (let x = 6; x < width; x++) {
    const back = x >= width - 2 || y >= boardH + COVER_EDGE - 2;
    put(x, y, back ? tone(COVER, FIRST.cover, 0.2, x, y) : (x + y) % 2 === 0 && (x > boardW ? x % 2 === 0 : y % 2 === 0) ? FIRST.page + 3 : FIRST.page + PAGE.length - 3);
  }
  // the four ribbons hang out of the foot, between the leaves
  const tails = [0.58, 0.64, 0.7, 0.76];
  tails.forEach((at, m) => {
    const rx = Math.round(width * at), rw = 7, run = SILK[m]!, first = SILK_FIRST[m]!;
    const end = boardH + COVER_EDGE + COVER_TAILS - 4 - (m % 2) * 5;
    for (let y = boardH - 2; y < end; y++) for (let x = rx; x < rx + rw; x++) {
      const tail = y - (end - 6);
      if (tail > 0 && Math.abs(x - rx - (rw - 1) / 2) < tail * 0.8) continue;
      const across = (x - rx) / rw;
      put(x, y, tone(run, first, 0.6 + (across > 0.15 && across < 0.4 ? 0.2 : 0) - (across > 0.8 ? 0.25 : 0), x, y));
    }
  });
}

/** The closed book's board: blue cloth with a darker rim, the rounded spine with its raised bands, brass on the outer corners. */
function coverBoard(put: Put, boardW: number, boardH: number, spine: number): void {
  // the board: blue cloth with a darker rim, lit along its top
  for (let y = 0; y < boardH; y++) for (let x = 0; x < boardW; x++) {
    const rim = Math.min(x, y, boardW - 1 - x, boardH - 1 - y);
    let value = 0.55 + (fbm(x / 40, y / 40, 2, 33) - 0.5) * 0.3;
    if (rim < 2) value -= 0.35;
    else if (y < 4) value += 0.12;
    // the spine: a rounded back, dark at its outer edge, a lit band, then into the hinge's groove
    if (x < spine) value = x < 3 ? 0.18 : x < spine * 0.45 ? 0.72 - (x / spine) * 0.2 : 0.5 - ((x - spine * 0.45) / spine) * 0.3;
    else if (x < spine + 3) value = x === spine + 1 ? 0.1 : 0.28;
    put(x, y, tone(COVER, FIRST.cover, value, x, y));
  }
  // the spine's raised bands, each lit on top with a gilt line on it
  for (let k = 1; k <= 5; k++) {
    const by = Math.round((boardH * k) / 6);
    for (let x = 3; x < spine; x++) {
      put(x, by - 2, tone(COVER, FIRST.cover, 0.85, x, by - 2));
      put(x, by - 1, gilt(x, by - 1, true));
      put(x, by, tone(COVER, FIRST.cover, 0.6, x, by));
      put(x, by + 1, tone(COVER, FIRST.cover, 0.15, x, by + 1));
    }
  }
  // the brass corners on the board's outer corners (the spine side has none)
  const corner = Math.max(14, Math.round(Math.min(boardW, boardH) * 0.09));
  for (const [cx, cy, sx, sy] of [[boardW - 1, 0, -1, 1], [boardW - 1, boardH - 1, -1, -1]] as const) {
    for (let j = 0; j < corner; j++) for (let i = 0; i < corner - j; i++) {
      const x = cx + sx * i, y = cy + sy * j;
      const edge = i + j >= corner - 2;
      put(x, y, edge ? FIRST.brass : tone(BRASS, FIRST.brass, (i + j === corner - 3 ? 0.95 : 0.75) - (i + j) / (corner * 3) - (sy < 0 ? 0.15 : 0), x, y));
    }
  }
}

/** The gilt frame stamped on the board: two fillets, a small flower in each of the inner frame's corners. */
function coverFrame(put: Put, boardW: number, boardH: number, spine: number): void {
  // the gilt frame: two fillets round the board, a small flower in each of the inner frame's corners
  const frame = (inset: number, lit: boolean) => {
    const x0 = spine + 3 + inset, y0 = inset, x1 = boardW - 1 - inset, y1 = boardH - 1 - inset;
    for (let x = x0; x <= x1; x++) { put(x, y0, gilt(x, y0, lit)); put(x, y1, gilt(x, y1, false)); }
    for (let y = y0; y <= y1; y++) { put(x0, y, gilt(x0, y, lit)); put(x1, y, gilt(x1, y, false)); }
    return { x0, y0, x1, y1 };
  };
  frame(8, true);
  const inner = frame(12, true);
  for (const [cx, cy] of [[inner.x0, inner.y0], [inner.x1, inner.y0], [inner.x0, inner.y1], [inner.x1, inner.y1]] as const) {
    const sx = cx === inner.x0 ? 1 : -1, sy = cy === inner.y0 ? 1 : -1;
    // four petals round a dot, set just inside the corner
    const fx = cx + sx * 6, fy = cy + sy * 6;
    for (const [dx, dy] of [[0, 0], [0, -2], [0, 2], [-2, 0], [2, 0], [0, -3], [0, 3], [-3, 0], [3, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]] as const) put(fx + dx, fy + dy, gilt(fx + dx, fy + dy, dx + dy < 0));
  }
}

/** The blank name plate: a brass frame, lit on its top and left, round a slip of pale paper ruled in ink inside its edge. */
function namePlate(put: Put, label: { x: number; y: number; w: number; h: number }): void {
  // the name plate: a brass frame, lit on its top and left, round a slip of pale paper with a ruled ink line inside its edge
  const { x: lx, y: ly, w: lw, h: lh } = label;
  const rimW = 4;
  for (let y = ly - rimW; y < ly + lh + rimW; y++) for (let x = lx - rimW; x < lx + lw + rimW; x++) {
    const inside = x >= lx && x < lx + lw && y >= ly && y < ly + lh;
    if (inside) {
      const ruled = (x === lx + 3 || x === lx + lw - 4) && y >= ly + 3 && y <= ly + lh - 4 || (y === ly + 3 || y === ly + lh - 4) && x >= lx + 3 && x <= lx + lw - 4;
      const shade = y < ly + 2 || x < lx + 2 ? 0.8 : 0.95;
      put(x, y, ruled ? INK_SOFT : tone(PAGE, FIRST.page, shade, x, y));
      continue;
    }
    const out = Math.min(x - (lx - rimW), y - (ly - rimW), lx + lw + rimW - 1 - x, ly + lh + rimW - 1 - y);
    const topLeft = y < ly && x < lx + lw + rimW - 1 - (y - (ly - rimW)) || x < lx && y < ly + lh + rimW - 1 - (x - (lx - rimW));
    const value = out === 0 ? 0.1 : out === rimW - 1 ? (topLeft ? 0.35 : 0.95) : topLeft ? 0.85 : 0.45;
    put(x, y, tone(BRASS, FIRST.brass, value, x, y));
  }
  // a rivet at each end of the plate
  for (const rx of [lx - rimW - 4, lx + lw + rimW + 3]) {
    const ry = ly + Math.round(lh / 2);
    for (const [dx, dy, v] of [[0, 0, 0.6], [-1, 0, 0.9], [0, -1, 0.9], [1, 0, 0.3], [0, 1, 0.3]] as const) put(rx + dx, ry + dy, tone(BRASS, FIRST.brass, v, rx + dx, ry + dy));
  }
}
