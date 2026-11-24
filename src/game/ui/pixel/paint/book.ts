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
const PAGE_TONES = [0x381a0a, 0x683212, 0x985220, 0xbc7434, 0xd4924c, 0xe4ac64, 0xeec484, 0xf6daa8] as const;
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
/** The cover's leather where it is rubbed and worn: the blue gone grey and pale. */
const WORN = fineRun([0x141830, 0x262c4c, 0x3c4468, 0x585f84, 0x7a80a0] as const, 5);
const RIBBON = SILK[0]!;

/**
 * The book's colours: place 0 is never painted, then the cover, the brass, the pages, and the silk of each bookmark (the
 * first is the book's red ribbon).
 */
export const BOOK_PALETTE: readonly number[] = [0x000000, ...COVER, ...BRASS, ...PAGE, ...SILK.flat(), ...WORN];

/**
 * The teacher's register (WP-14, d145): the same book bound in bottle-green cloth, as an old school register is. Its
 * places are the song book's, so one painted book takes either palette.
 */
/** The register's worn leather, green gone grey, as many tones as the song book's so the places match. */
const REGISTER_WORN_RUN = fineRun([0x101a12, 0x22301f, 0x3a4a36, 0x56664f, 0x76866c] as const, 5);
const REGISTER_WORN = WORN.map((_, i) => REGISTER_WORN_RUN[Math.round((i * (REGISTER_WORN_RUN.length - 1)) / Math.max(1, WORN.length - 1))]!);
const REGISTER_COVER_TONES = [0x061208, 0x0e2814, 0x1a4222, 0x2a5c30, 0x3e7842] as const;
export const REGISTER_PALETTE: readonly number[] = [0x000000, ...fineRun(REGISTER_COVER_TONES, 4), ...BRASS, ...PAGE, ...SILK.flat(), ...REGISTER_WORN];
const SILK_FIRST = SILK.map((_, i) => 1 + COVER.length + BRASS.length + PAGE.length + SILK.slice(0, i).reduce((n, run) => n + run.length, 0));
const FIRST = { cover: 1, brass: 1 + COVER.length, page: 1 + COVER.length + BRASS.length, ribbon: SILK_FIRST[0]!, worn: 1 + COVER.length + BRASS.length + PAGE.length + SILK.flat().length } as const;
/** The book's ink (its darkest page tone) and the ink's softer edge, for what is painted on its pages. */
const INK = FIRST.page, INK_SOFT = FIRST.page + 2;

/** How far the cover reaches past the pages, and how deep the stack of leaves shows under them, in fine pixels. */
export const BOOK_COVER = 14;
export const BOOK_STACK = 18;

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
  let value = 0.84 + (fbm(x / 70, y / 55, 3, 51) - 0.5) * 0.24;
  // the paper browns towards its edges, as old paper does (the 1991 and 1997 papers burn darker and warmer at the rim): two bands
  const rim = Math.min(fromSide, down, up) + Math.round(noise2(x / 16, y / 16, 53) * 4);
  if (rim < 7) value -= 0.12;
  else if (rim < 16) value -= 0.06;
  if (fromGutter < 2) value = 0.2;
  else if (fromGutter < 5) value = 0.48;
  else if (fromGutter < 12 + Math.round(noise2(0, y / 14, 52) * 3)) value = 0.66;
  else if (fromGutter < 24 + Math.round(noise2(1, y / 14, 52) * 4)) value = Math.min(value, 0.76);
  if (fromSide < 6) value = Math.min(value, 0.6);
  if (down < 2) value -= 0.12;
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
  const right = width - 1 - BOOK_COVER - BOOK_FORE_EDGE;
  return { left: { x: BOOK_COVER + BOOK_FORE_EDGE, y: pageFoot(BOOK_COVER, width, height) }, right: { x: right, y: pageFoot(right, width, height) } };
}

/**
 * How far a torn parchment edge is torn in at `s` along it (fine pixels, 0 to about 6): an uneven tear with now and then
 * a deeper nick, as the old maps' edges are. `seed` gives each edge its own.
 */
function rag(seed: number, s: number): number {
  const nick = hash2(Math.floor(s / 4), 0, seed) > 0.93 ? 2 + Math.round(hash2(Math.floor(s / 4), 1, seed) * 2) : 0;
  return Math.max(0, Math.round(1.5 + (noise2(s / 7, 0, seed) - 0.5) * 4 + (noise2(s / 2, 1, seed) - 0.5) * 1.5)) + nick;
}

/** The age of the paper: a few soft brown specks (foxing), more of them towards the page's edges. */
function foxed(x: number, y: number, fromEdge: number): boolean {
  if (fromEdge > 40) return false;
  const spot = noise2(x / 3.5, y / 3.5, 71);
  return spot > 0.8 + fromEdge / 200 && fbm(x / 30, y / 30, 2, 72) > 0.5;
}

/** How deep the leaves under the top page show at each outer side (the fore-edge), in fine pixels. */
export const BOOK_FORE_EDGE = 16;

/**
 * One column of the open book's pages, from the page's top to the cover's inner edge: the top page in warm, mottled old
 * paper, its edges torn and curled up into a lit lip over a dark rim; under it the thick block of leaves showing at the
 * foot and at the outer side, fine curved lines that round the corner between them (the maintainer's open-book picture).
 */
function paintPageColumn(put: Put, x: number, width: number, height: number, top: number, bottom: number): void {
  const mid = width / 2, left = BOOK_COVER, right = width - 1 - BOOK_COVER;
  const fromGutter = Math.abs(x - mid), fromCover = Math.min(x - left, right - x);
  const out = Math.max(0, BOOK_FORE_EDGE - fromCover); // how far out past the top page's side this column is
  const fromSide = fromCover - BOOK_FORE_EDGE;
  const foot = pageFoot(x, width, height);
  const outerSeed = x < mid ? 113 : 114;
  const chip = Math.max(0, 7 - fromSide);
  const pageTop = top + rag(111, x) + chip, pageEnd = foot - rag(112, x);
  for (let y = top; y <= bottom; y++) {
    const below = Math.max(0, y - foot);
    // the block of leaves: lines round the top page's foot and side, a curved fan of edges in tans and browns
    if (out > 0 || below > 0) {
      if (out > 0 && y < top + 3 + Math.round(out * 0.6)) continue; // the leaves stand a little lower than the top page
      const depth = Math.hypot(out, below) + (noise2(x / 18, y / 18, 125) - 0.5) * 2.4;
      const k = Math.floor(depth / 2.2);
      const line = depth - k * 2.2 < 0.8;
      let value = line ? 0.36 : 0.64 + (noise2(k * 3.1, (out > 0 ? y : x) / 40, 126) - 0.5) * 0.14;
      value -= Math.min(0.2, Math.hypot(out, below) / 90); // the block browns outwards
      if (depth < 2.5) value = Math.min(value, 0.42); // the top page's shade on the leaves under it
      if (out > 0 && out >= BOOK_FORE_EDGE - 1) value = 0.3;
      put(x, y, tone(PAGE, FIRST.page, value, x, y));
      continue;
    }
    const side = fromGutter < 20 ? 0 : rag(outerSeed, y);
    const edge = Math.min(y - pageTop, pageEnd - y, fromGutter < 20 ? 99 : fromSide - side);
    if (edge < 0) {
      // past the tear: the leaf under it, its own edge a line, browned
      put(x, y, tone(PAGE, FIRST.page, (x + y) % 3 === 0 ? 0.4 : 0.58, x, y));
      continue;
    }
    const fromEdge = Math.min(fromSide, y - top, foot - y);
    let value = pageLight(x, y, y - top, fromGutter, fromSide, foot - y) - (fromGutter > 14 && foxed(x, y, fromEdge) ? 0.1 : 0);
    // the paper darkens softly towards its outer edges and the foot, warm and deep, as an old page does
    value -= Math.max(0, 1 - Math.min(fromSide, foot - y, (y - top) * 1.5) / 70) * 0.18;
    // the edge curls up: a dark rim, a lit lip, then the shade under the lip
    if (edge < 1) value = 0.22;
    else if (edge < 3) value = 0.9;
    else if (edge < 5 + Math.round(noise2(x / 11, y / 11, 123) * 3)) value = Math.min(value, 0.5);
    else if (edge < 10 + Math.round(noise2(x / 13, y / 13, 124) * 6)) value -= 0.08;
    put(x, y, Math.abs(x - mid) < 0.6 ? FIRST.page : tone(PAGE, FIRST.page, value, x, y));
  }
}

/** The open book's brass corners: the closed book's heavy scalloped plates, one on each corner. */
function brassCorners(put: Put, width: number, height: number): void {
  const size = Math.max(22, Math.round(Math.min(width, height) * 0.1));
  for (const [cx, cy, sx, sy] of [[0, 0, 1, 1], [width - 1, 0, -1, 1], [0, height - 1, 1, -1], [width - 1, height - 1, -1, -1]] as const) heavyCorner(put, cx, cy, sx, sy, size);
}

/** The open book, `width` by `height` fine pixels, the cover's outer edge on the picture's edge. Every pixel inside the cover is painted. */
export function paintBook(width: number, height: number): Bitmap {
  const out = createBitmap(width, height);
  const put = (x: number, y: number, place: number) => { if (x >= 0 && y >= 0 && x < width && y < height) out.pixels[y * width + x] = place; };
  const mid = width / 2;
  // the cover: heavy worn leather, its edge bevelled, a gilt fillet and a vine of small leaves tooled round the rim
  tomeLeather(put, { x: 0, y: 0, w: width, h: height });
  const gilt = new Gilt();
  for (const inset of [3, BOOK_COVER - 3]) {
    gilt.line(inset, inset, width - 1 - inset, inset);
    gilt.line(inset, inset, inset, height - 1 - inset);
    gilt.line(width - 1 - inset, inset, width - 1 - inset, height - 1 - inset);
    gilt.line(inset, height - 1 - inset, width - 1 - inset, height - 1 - inset);
  }
  const vineAt = BOOK_COVER / 2;
  gilt.vine((t) => ({ x: vineAt, y: 24 + t * (height - 48) }), height - 48, 20, 31, 0.6);
  gilt.vine((t) => ({ x: width - 1 - vineAt, y: 24 + t * (height - 48) }), height - 48, 20, 32, 0.6);
  gilt.vine((t) => ({ x: 24 + t * (width - 48), y: height - 1 - vineAt }), width - 48, 20, 33, 0.6);
  gilt.lay(put);
  brassCorners(put, width, height);
  // the pages: from the cover's inner edge, dipping to the gutter, curling up a little at their outer edges
  const left = BOOK_COVER, right = width - 1 - BOOK_COVER, bottom = height - 1 - BOOK_COVER;
  const topOf = (x: number) => BOOK_COVER + 4 - Math.round(bowAt(x, width) * 10);
  for (let x = left; x <= right; x++) paintPageColumn(put, x, width, height, topOf(x), bottom);
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
  // from under the headband it lies down the gutter, and only near the foot leaves it
  const head = BOOK_COVER + 4;
  const from = pageFoot(Math.round(mid) + 3, width, height) - 26;
  const end = height + 2;
  const twist = from + Math.round((end - from) * 0.45);
  for (let y = head; y < end; y++) {
    const t = Math.max(0, (y - from) / (end - from));
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

/** How far a page's turned corner reaches in along the page's edges, in fine pixels: at rest a dog-ear, under the pointer a hand lifting it. */
export const PAGE_TURN = { rest: 16, lifted: 64 } as const;

/**
 * A page's bottom outer corner turned up to turn the page (ft_1_12 rule 10), `size` fine pixels on a side, the page's
 * corner at the picture's bottom right (`flipX` it for the left page). At rest only a small dog-ear; `lifted` (under the
 * pointer) the corner rolls up far over the page, its back paler, the page under it showing where it was, and it lays a
 * soft shade on the page.
 */
export function paintPageTurn(size: number, lifted: boolean, rest = PAGE_TURN.rest, up = PAGE_TURN.lifted): Bitmap {
  const out = createBitmap(size, size);
  const put = (x: number, y: number, place: number) => { if (x >= 0 && y >= 0 && x < size && y < size) out.pixels[y * size + x] = place; };
  // u and v count in from the page's right edge and its foot
  const at = (u: number, v: number) => ({ x: size - 1 - u, y: size - 1 - v });
  const fold = Math.min(size - 2, lifted ? up : rest);
  // the rolled flap: the cut-off corner turned over the fold. Rolling, not creased, it reaches less far over the page than
  // the corner it was (`roll`), and its tip is rounded off
  const roll = lifted ? 0.62 : 0.85;
  // the fold is a soft crease, not a ruled line, and the flap's edges are the page's torn parchment edge turned over
  const crease = (u: number, v: number) => Math.round((noise2((u - v) / 9, 0, 115) - 0.5) * 3);
  const onFlap = (u: number, v: number) => {
    const d = u + v - fold + crease(u, v);
    if (d < 0) return false;
    const back = ((1 + 1 / roll) * d) / 2;
    const gu = u - back, gv = v - back;
    return gu >= rag(116, gv) * 0.6 && gv >= rag(117, gu) * 0.6 && !(lifted && gu + gv < 1.5 && d > 4);
  };
  const flapEdge = (u: number, v: number) => Math.min(...[1, 2, 3].map((k) => (onFlap(u + k, v) && onFlap(u, v + k) && onFlap(u - k, v) && onFlap(u, v - k) ? 99 : k)));
  // the soft shade the flap lays on the page beside its edges
  for (let v = 0; v < size; v++) for (let u = 0; u < size; u++) {
    if (onFlap(u, v) || u + v + crease(u, v) < fold) continue;
    const near = [1, 2].some((k) => onFlap(u - k, v - k) || onFlap(u - k, v) || onFlap(u, v - k));
    if (near && lifted) { const p = at(u, v); put(p.x, p.y, tone(PAGE, FIRST.page, 0.66, p.x, p.y)); }
  }
  // where the corner was: the next leaf, in the shade of the one lifting off it, with the leaves' edges at its side and foot
  for (let v = 0; v < size; v++) for (let u = 0; u + v + crease(u, v) < fold; u++) {
    const p = at(u, v);
    // the next leaf: its own torn edge at the page's side and foot, browned, and the shade under the lifted corner
    const torn = u < rag(118, v) || v < rag(119, u);
    const value = u + v + crease(u, v) >= fold - 2 ? 0.5 : torn ? ((u + v) % 3 === 0 ? 0.4 : 0.55) : 0.64;
    put(p.x, p.y, tone(PAGE, FIRST.page, value, p.x, p.y));
  }
  for (let v = 0; v < size; v++) for (let u = 0; u < size; u++) {
    if (!onFlap(u, v)) continue;
    const p = at(u, v);
    const fromFold = u + v - fold + crease(u, v);
    const rim = fromFold < 2 ? 99 : flapEdge(u, v);
    // the roll: a shade where the paper turns, a lit band on the roll, then the back of the page, fading to the tip, its
    // torn rim browned and burnt dark at the very edge as the front's is
    let value = fromFold < 2 ? 0.6 : fromFold < (lifted ? 6 : 4) ? 1 : 0.93 - (fromFold / fold) * 0.3;
    if (rim <= 1) value = 0.22;
    else if (rim <= 3) value = Math.min(value, 0.58);
    put(p.x, p.y, tone(PAGE, FIRST.page, value, p.x, p.y));
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
  // each swash: one pen stroke, a hairline at its ends swelling to three pixels in its middle, an S that ends in a curl at
  // its outer end and turns down in a smaller curl by the number
  const mid = Math.round(height / 2);
  for (const side of [-1, 1] as const) {
    const at = (s: number) => (side < 0 ? s : width - 1 - s);
    for (let s = 6; s <= swash - 3; s++) {
      const t = (s - 6) / (swash - 9);
      const y = mid + Math.sin(t * Math.PI * 2) * 2.2;
      const thick = Math.sin(t * Math.PI) * 2.6;
      for (let k = -thick / 2; k <= thick / 2; k += 0.5) put(at(s), Math.round(y + k), Math.abs(k) > thick / 2 - 0.6 && thick > 1 ? INK_SOFT : INK);
    }
    // the curl at the outer end, rolling up from the stroke's start
    for (let a = 0; a < Math.PI * 1.7; a += 0.2) put(at(Math.round(4 + Math.cos(a + Math.PI / 2) * 2.6)), Math.round(mid - 2.6 + Math.sin(a + Math.PI / 2) * 2.6), INK);
    // the small curl by the number, turning down
    for (let a = 0; a < Math.PI * 1.4; a += 0.25) put(at(Math.round(swash - 1 + Math.cos(a - Math.PI / 2) * 1.6)), Math.round(mid + 1.6 + Math.sin(a - Math.PI / 2) * 1.6), INK);
  }
  return out;
}

/**
 * A bookmark's ribbon (ft_1_12 rule 10), `width` by `height` fine pixels, in silk `mark` (0 All, 1 own, 2 the teacher's,
 * 3 the characters'): it comes out from between the leaves at its outer (left) end, a shade where it leaves them, with
 * woven edges, a sheen along it and a soft wave, and its inner end lies on the page split like a lizard's tongue: two
 * prongs that part as they go and taper to points turning outwards. The open one is the brighter; a closed one lies a little dimmer.
 */
export function paintBookmark(mark: number, width: number, height: number, open: boolean): Bitmap {
  const run = SILK[mark] ?? RIBBON, first = SILK_FIRST[mark] ?? FIRST.ribbon;
  const out = createBitmap(width, height);
  const put = (x: number, y: number, place: number) => { if (x >= 0 && y >= 0 && x < width && y < height) out.pixels[y * width + x] = place; };
  const forkFrom = width - Math.round(width * (open ? 0.4 : 0.5));
  for (let x = 0; x < width; x++) {
    const wave = Math.round(Math.sin(x / 9 + mark) * 0.8);
    const top = 1 + wave, foot = height - 2 + wave;
    const t = x < forkFrom ? -1 : (x - forkFrom) / (width - 1 - forkFrom);
    for (let y = top; y <= foot; y++) {
      const across = (y - top) / (foot - top);
      let edge = y === top || y === foot;
      let lit = across > 0.16 && across < 0.36;
      if (t >= 0) {
        // the fork: two prongs either side of the middle, parting as they go and tapering to a point that turns outwards
        const half = 0.03 + 0.24 * (1 - t) ** 0.8;
        const centre = across < 0.5 ? 0.26 - 0.16 * t * t : 0.74 + 0.16 * t * t;
        const d = across - centre;
        if (Math.abs(d) > half) continue;
        edge ||= Math.abs(d) > half - 1.2 / (foot - top);
        lit = d < -half * 0.2 && d > -half * 0.7;
      }
      let value = (open ? 0.62 : 0.5) + (lit ? 0.24 : 0) - (across > 0.8 && t < 0 ? 0.18 : 0);
      if (edge) value = open ? 0.28 : 0.2;
      // where it comes out from between the leaves
      if (x < 2) value = 0.15;
      else if (x < 4) value -= 0.2;
      // the weave: a faint fleck along the threads
      if (hash2(x, y, 81 + mark) > 0.9) value -= 0.1;
      put(x, y, tone(run, first, value, x, y));
    }
  }
  return out;
}

type Put = (x: number, y: number, place: number) => void;
type Box = { x: number; y: number; w: number; h: number };

/** The closed book's measures, in fine pixels: its rounded spine, the fore-edge's depth (the leaves and both boards seen from the side), the board's bevel. */
export const TOME = { spine: 44, foreEdge: 26, bevel: 4 } as const;

/**
 * The song book closed (ft_1_07: a new player's name is written on its cover), `width` by `height` fine pixels, too big
 * for the picture: its foot runs off the picture's bottom. A massive old book: thick boards in heavy blue leather, grained,
 * creased and rubbed pale at its edges and corners; a rounded spine with raised bands; the deep block of its leaves at
 * the fore-edge; heavy brass corners and two brass clasps; and a cover tooled in gilt, partly rubbed away, with growing
 * things: a vine with leaves round a double frame, a leafy fan in each corner, and a cartouche of curling stems over and
 * under the name plate. `label` (fine pixels from the top left) is the blank brass name plate, a slip of pale paper in it.
 */
export function paintCover(width: number, height: number, label: Box): Bitmap {
  const out = createBitmap(width, height);
  const put: Put = (x, y, place) => { if (x >= 0 && y >= 0 && x < width && y < height) out.pixels[y * width + x] = place; };
  const board = { x: TOME.spine, y: 0, w: width - TOME.spine - TOME.foreEdge, h: height + 60 };
  tomeForeEdge(put, width, height, board);
  tomeLeather(put, board);
  tomeSpine(put, height);
  const gilt = new Gilt();
  tomeTooling(gilt, board, label);
  gilt.lay(put);
  heavyCorner(put, board.x + board.w - 1, board.y, -1, 1, 58);
  for (const at of [0.26, 0.74]) tomeClasp(put, width, board, Math.round(height * at));
  tomePlate(put, label);
  return out;
}

/** The leaves seen from the fore-edge: many fine uneven lines, browned, the back board under them and the front board's thickness over them. */
function tomeForeEdge(put: Put, width: number, height: number, board: Box): void {
  const x0 = board.x + board.w;
  for (let y = 0; y < height; y++) for (let x = x0; x < width; x++) {
    const d = x - x0;
    // the front board's thickness, lit on top; the leaves; the back board
    if (d < TOME.bevel + 2) { put(x, y, tone(COVER, FIRST.cover, d < 2 ? 0.45 : 0.25, x, y)); continue; }
    if (d >= TOME.foreEdge - 5) { put(x, y, tone(COVER, FIRST.cover, d === TOME.foreEdge - 5 ? 0.1 : 0.22, x, y)); continue; }
    // the leaves are rounded out a little (a book's fore-edge is concave) and browned at the edges, a few stand proud
    const wave = Math.round(Math.sin(y / 40 + d * 0.3) * 1.2 + (noise2(d / 3, y / 60, 91) - 0.5) * 2);
    const leaf = (d + wave) % 2 === 0;
    const shade = d < TOME.bevel + 5 ? 0.14 : 0;
    put(x, y, tone(PAGE, FIRST.page, (leaf ? 0.6 : 0.78) - shade, x, y));
  }
}

/** The front board: heavy leather, grained and pored, a bevel round it, creases here and there, rubbed pale near its edges and corners. */
function tomeLeather(put: Put, board: Box): void {
  const { x: bx, y: by, w, h } = board;
  for (let y = by; y < by + h; y++) for (let x = bx; x < bx + w; x++) {
    const rim = Math.min(x - bx, y - by, bx + w - 1 - x);
    const corner = Math.hypot(Math.min(x - bx, bx + w - 1 - x), y - by);
    const rub = (rim < 16 ? (16 - rim) / 16 : 0) * 0.6 + (corner < 50 ? (50 - corner) / 50 : 0) + (fbm(x / 22, y / 22, 3, 93) - 0.5) * 1.2;
    const value = 0.3 + (fbm(x / 70, y / 70, 3, 94) - 0.5) * 0.55 + (fbm(x / 5, y / 5, 2, 95) - 0.5) * 0.12 - (hash2(x, y, 96) > 0.93 ? 0.12 : 0);
    let place = rub > 0.6 ? tone(WORN, FIRST.worn, 0.22 + value * 0.45, x, y) : tone(COVER, FIRST.cover, value, x, y);
    // the bevel: the board's edge rounded over, lit above and to the left
    if (rim < 2) place = tone(COVER, FIRST.cover, 0.08, x, y);
    else if (rim < TOME.bevel) place = y - by === rim || x - bx === rim ? tone(WORN, FIRST.worn, 0.85, x, y) : tone(COVER, FIRST.cover, 0.2, x, y);
    put(x, y, place);
  }
  // creases: long soft bends in the leather following the board, each a slightly darker band with a paler lip
  for (let k = 0; k < Math.round(w / 90); k++) {
    const x0 = bx + Math.round(hash2(k, 1, 97) * w), y0 = by + Math.round(hash2(k, 2, 97) * Math.min(h, 400));
    const len = 30 + Math.round(hash2(k, 3, 97) * 60), across = hash2(k, 4, 97) > 0.5;
    for (let i = 0; i < len; i++) {
      const bend = Math.round(Math.sin(i / len * Math.PI) * 4 + (noise2(k, i / 12, 98) - 0.5) * 3);
      const x = across ? x0 + i : x0 + bend, y = across ? y0 + bend : y0 + i;
      put(x, y, tone(COVER, FIRST.cover, 0.2, x, y));
      put(across ? x : x - 1, across ? y - 1 : y, tone(COVER, FIRST.cover, 0.55, x, y));
    }
  }
}

/** The rounded spine: dark at its outer edge, a lit band along its round, raised bands across it each lit on top and tooled in gilt, the leather wrinkled into the hinge. */
function tomeSpine(put: Put, height: number): void {
  const s = TOME.spine;
  for (let y = 0; y < height; y++) for (let x = 0; x < s; x++) {
    const round = x / s;
    let value = round < 0.08 ? 0.12 : round < 0.4 ? 0.62 - Math.abs(round - 0.25) * 0.8 : 0.48 - (round - 0.4) * 0.55;
    value += (fbm(x / 5, y / 5, 2, 99) - 0.5) * 0.12;
    // the hinge: a deep groove with the leather wrinkled across it
    if (x >= s - 6) value = x >= s - 3 ? 0.06 + (Math.sin(y / 3 + noise2(0, y / 9, 100) * 3) > 0.6 ? 0.25 : 0) : 0.3;
    put(x, y, tone(COVER, FIRST.cover, value, x, y));
  }
  for (let k = 0; k < 6; k++) {
    const by = 40 + k * 70;
    for (let x = 4; x < s - 6; x++) for (let d = -4; d <= 4; d++) {
      const v = d < -2 ? 0.85 : d < 0 ? 0.65 : d < 3 ? 0.4 : 0.15;
      put(x, by + d, tone(COVER, FIRST.cover, v - Math.abs(x - s * 0.3) / s * 0.3, x, by + d));
    }
    for (let x = 6; x < s - 8; x++) for (const d of [-7, 7]) if (fbm(x / 3, by + d, 1, 101) < 0.72) put(x, by + d, tone(BRASS, FIRST.brass, d < 0 ? 0.8 : 0.6, x, by + d));
  }
}

/**
 * Gilt tooling, laid in two passes: every point is gathered first, then each is pressed into the leather (a dark line
 * under and to the right of it where no gilt is) and then gilded, except where the gold has rubbed off and only the
 * pressed line is left.
 */
class Gilt {
  private readonly points = new Map<number, boolean>();

  /** A point of gilt; `lit` where it catches the light from the upper left. */
  dot(x: number, y: number, lit = false): void {
    const key = Math.round(y) * 4096 + Math.round(x);
    this.points.set(key, (this.points.get(key) ?? false) || lit);
  }

  /** A line of gilt `thick` pixels wide from (x0, y0) to (x1, y1). */
  line(x0: number, y0: number, x1: number, y1: number, thick = 1): void {
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.5));
    for (let i = 0; i <= steps; i++) {
      const x = x0 + ((x1 - x0) * i) / steps, y = y0 + ((y1 - y0) * i) / steps;
      for (let t = 0; t < thick; t++) this.dot(x + t, y, t === 0);
    }
  }

  /** A leaf from (x, y) pointing along `angle`: an almond `len` long and `wide` across, a vein down it left ungilded. */
  leaf(x: number, y: number, angle: number, len: number, wide: number): void {
    const ux = Math.cos(angle), uy = Math.sin(angle);
    for (let t = 0; t <= len; t += 0.5) {
      const half = Math.sin((t / len) * Math.PI) ** 0.8 * wide / 2;
      for (let u = -half; u <= half; u += 0.5) {
        if (Math.abs(u) < 0.5 && t > 1 && t < len - 1.5) continue;
        this.dot(x + ux * t - uy * u, y + uy * t + ux * u, u < 0);
      }
    }
  }

  /** A curl: a spiral of `turns` from radius `r` inwards, turning `dir` (1 or -1). */
  curl(x: number, y: number, r: number, start: number, dir: number, turns = 1.4): void {
    for (let a = 0; a < turns * Math.PI * 2; a += 0.08) {
      const rr = r * (1 - a / (turns * Math.PI * 2 + 1));
      this.dot(x + Math.cos(start + dir * a) * rr, y + Math.sin(start + dir * a) * rr, a < 1.5);
    }
  }

  /**
   * A vine along the path `at(t)` (t from 0 to 1, `length` pixels long): a stem two pixels thick, a leaf every `every`
   * pixels on alternate sides, and now and then a tendril curling off. `seed` keeps one vine from being another's copy.
   */
  vine(at: (t: number) => { x: number; y: number }, length: number, every: number, seed: number, size = 1): void {
    const steps = Math.ceil(length * 1.5);
    let side = 1;
    for (let i = 0; i <= steps; i++) {
      const p = at(i / steps), q = at(Math.min(1, (i + 1) / steps));
      this.dot(p.x, p.y, true);
      if (size >= 1) this.dot(p.x + 1, p.y + 1);
      const run = (i / steps) * length;
      if (Math.floor(run / every) !== Math.floor(((i - 1) / steps) * length / every) && i > 0 && i < steps) {
        const dir = Math.atan2(q.y - p.y, q.x - p.x);
        const twist = (hash2(i, seed, 102) - 0.5) * 0.4;
        this.leaf(p.x, p.y, dir + side * (0.9 + twist), Math.round((7 + hash2(i, seed, 103) * 3) * size), Math.max(2, Math.round(4 * size)));
        if (hash2(i, seed, 104) > 0.6 && size >= 1) this.curl(p.x - side * Math.sin(dir) * 5, p.y + side * Math.cos(dir) * 5, 3.5, dir, -side, 1.1);
        side = -side;
      }
    }
  }

  /** Press and gild every point. */
  lay(put: Put): void {
    for (const key of this.points.keys()) {
      const x = key % 4096, y = Math.floor(key / 4096);
      if (!this.points.has(key + 4097)) put(x + 1, y + 1, FIRST.cover);
    }
    for (const [key, lit] of this.points) {
      const x = key % 4096, y = Math.floor(key / 4096);
      // the gold rubbed off in patches, the pressed line left
      if (fbm(x / 14, y / 14, 2, 105) > 0.76) { put(x, y, tone(COVER, FIRST.cover, 0.15, x, y)); continue; }
      put(x, y, tone(BRASS, FIRST.brass, lit ? 0.85 : 0.6, x, y));
    }
  }
}

/** The cover's tooling: a double frame with a vine between its fillets, a leafy fan in each corner, a cartouche of curling stems over and under the plate. */
function tomeTooling(gilt: Gilt, board: Box, label: Box): void {
  const x0 = board.x + 16, x1 = board.x + board.w - 17, y0 = 16, y1 = board.h - 17;
  for (const inset of [0, 3, 26, 29]) {
    gilt.line(x0 + inset, y0 + inset, x1 - inset, y0 + inset);
    gilt.line(x0 + inset, y0 + inset, x0 + inset, y1 - inset);
    gilt.line(x1 - inset, y0 + inset, x1 - inset, y1 - inset);
  }
  // the vine between the two frames, along the top and down both sides
  const mid = 14.5;
  gilt.vine((t) => ({ x: x0 + mid + 12 + t * (x1 - x0 - 2 * mid - 24), y: y0 + mid + Math.sin(t * 40) * 2.5 }), x1 - x0, 16, 1);
  for (const [x, seed] of [[x0 + mid, 2], [x1 - mid, 3]] as const) gilt.vine((t) => ({ x: x + Math.sin(t * 30) * 2.5, y: y0 + mid + 12 + t * (y1 - y0 - mid) }), y1 - y0, 16, seed);
  // a rosette in each top corner of the vine
  for (const x of [x0 + mid, x1 - mid]) {
    for (let k = 0; k < 6; k++) gilt.leaf(x, y0 + mid, (k * Math.PI) / 3, 7, 4);
  }
  // a leafy fan inside each top corner of the inner frame
  for (const [cx, sx] of [[x0 + 32, 1], [x1 - 32, -1]] as const) {
    const cy = y0 + 32;
    for (let k = 0; k < 5; k++) gilt.leaf(cx, cy, Math.atan2(1, sx) - sx * (k - 2) * 0.36, 16 + (k === 2 ? 8 : k % 2 === 0 ? 0 : 4), 5);
    gilt.curl(cx + sx * 30, cy + 6, 6, sx > 0 ? Math.PI : 0, sx, 1.3);
    gilt.curl(cx + sx * 6, cy + 30, 6, -Math.PI / 2, -sx, 1.3);
  }
  // the cartouche: over the plate two stems rise from its middle, part and curl, with leaves; a bud stands between them
  const cx = label.x + label.w / 2, top = label.y - 10;
  for (const sx of [-1, 1]) {
    gilt.vine((t) => ({ x: cx + sx * (4 + t * 120), y: top - Math.sin(t * Math.PI) * 26 - t * 4 }), 130, 14, 10 + sx);
    gilt.curl(cx + sx * 128, top - 10, 7, sx > 0 ? Math.PI / 2 : Math.PI / 2, -sx, 1.5);
    gilt.vine((t) => ({ x: cx + sx * (4 + t * 100), y: label.y + label.h + 12 + Math.sin(t * Math.PI) * 18 }), 110, 14, 20 + sx);
    gilt.curl(cx + sx * 106, label.y + label.h + 18, 6, -Math.PI / 2, sx, 1.5);
  }
  for (let k = -2; k <= 2; k++) gilt.leaf(cx, top - 6, -Math.PI / 2 + k * 0.35, k === 0 ? 22 : 14, 7);
  for (let k = -1; k <= 1; k++) gilt.leaf(cx, label.y + label.h + 10, Math.PI / 2 + k * 0.45, k === 0 ? 16 : 11, 6);
}

/**
 * A heavy brass corner at (cx, cy), reaching `size` along both edges towards (sx, sy): a plate with a scalloped edge, a
 * raised boss and rivets, its brass dulled where it is worn.
 */
function heavyCorner(put: Put, cx: number, cy: number, sx: number, sy: number, size: number): void {
  const k = size / 58;
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const d = i + j;
    const edge = size - 4 * k + Math.round(Math.sin(Math.atan2(j, i) * 6) * 4 * k);
    if (d > edge) continue;
    const x = cx + sx * i, y = cy + sy * j;
    const rim = d > edge - 2;
    const bx = i - 16 * k, by = j - 16 * k, boss = Math.hypot(bx, by);
    // lit from the upper left: the boss's lit side is the one towards the light, whichever corner this is
    const towardLight = bx * sx + by * sy < 0;
    let value = 0.72 - d / (size * 3) - (sx < 0 || sy < 0 ? 0.1 : 0) + (fbm(x / 6, y / 6, 2, 106) - 0.5) * 0.25;
    if (boss < 7 * k + 1) value = boss < 3 * k ? 0.98 : towardLight ? 0.92 : 0.4;
    put(x, y, rim ? FIRST.brass : tone(BRASS, FIRST.brass, value, x, y));
  }
  for (const [i, j] of [[40, 6], [6, 40], [30, 30]] as const) rivet(put, cx + sx * Math.round(i * k), cy + sy * Math.round(j * k));
}

/** A brass rivet: a dome lit on its upper left. */
function rivet(put: Put, x: number, y: number): void {
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    if (dx * dx + dy * dy > 5) continue;
    put(x + dx, y + dy, tone(BRASS, FIRST.brass, dx + dy < -1 ? 0.98 : dx + dy > 1 ? 0.2 : 0.6, x + dx, y + dy));
  }
}

/** A clasp at `y`: a strap of dark leather from the back board over the fore-edge onto the cover, ending in a pointed brass catch with two rivets. */
function tomeClasp(put: Put, width: number, board: Box, y: number): void {
  const h = 26, catchW = 54, x1 = board.x + board.w - catchW;
  for (let yy = y - h / 2; yy < y + h / 2; yy++) for (let x = board.x + board.w - 8; x < width; x++) {
    const d = yy - (y - h / 2);
    put(x, yy, tone(COVER, FIRST.cover, d < 2 ? 0.4 : d > h - 3 ? 0.08 : 0.22 + (fbm(x / 4, yy / 4, 2, 107) - 0.5) * 0.15, x, yy));
  }
  for (let yy = y - h / 2 - 2; yy < y + h / 2 + 2; yy++) for (let x = x1; x < board.x + board.w + 6; x++) {
    const across = Math.abs(yy - y) / (h / 2 + 2);
    // the catch's end points onto the cover, its sides curved like a leaf
    if (x - x1 < across * across * 22) continue;
    const edge = x - x1 < across * across * 22 + 1.5 || Math.abs(yy - y) >= h / 2 + 1;
    const value = edge ? 0.1 : yy < y - 3 ? 0.85 : yy > y + 4 ? 0.42 : 0.66;
    put(x, yy, tone(BRASS, FIRST.brass, value + (fbm(x / 5, yy / 5, 2, 108) - 0.5) * 0.2, x, yy));
  }
  rivet(put, x1 + 20, y);
  rivet(put, x1 + 40, y);
}

/** The blank name plate: a heavy brass frame bevelled and lit on its top and left, a rivet in each corner, round a slip of pale paper ruled in ink inside its edge. */
function tomePlate(put: Put, label: Box): void {
  const { x: lx, y: ly, w: lw, h: lh } = label;
  const rimW = 7;
  for (let y = ly - rimW; y < ly + lh + rimW; y++) for (let x = lx - rimW; x < lx + lw + rimW; x++) {
    if (x >= lx && x < lx + lw && y >= ly && y < ly + lh) {
      const ruled = ((x === lx + 3 || x === lx + lw - 4) && y >= ly + 3 && y <= ly + lh - 4) || ((y === ly + 3 || y === ly + lh - 4) && x >= lx + 3 && x <= lx + lw - 4);
      put(x, y, ruled ? INK_SOFT : tone(PAGE, FIRST.page, y < ly + 3 || x < lx + 3 ? 0.78 : 0.95, x, y));
      continue;
    }
    const out = Math.min(x - (lx - rimW), y - (ly - rimW), lx + lw + rimW - 1 - x, ly + lh + rimW - 1 - y);
    const upperLeft = (y < ly && x - (lx - rimW) <= lx + lw + rimW - 1 - x + (ly - y)) || (x < lx && y - (ly - rimW) <= ly + lh + rimW - 1 - y + (lx - x));
    const value = out === 0 ? 0.08 : out === rimW - 1 ? (upperLeft ? 0.3 : 0.95) : out < 3 ? (upperLeft ? 0.95 : 0.35) : 0.68;
    put(x, y, tone(BRASS, FIRST.brass, value + (fbm(x / 6, y / 6, 2, 109) - 0.5) * 0.18, x, y));
  }
  for (const [x, y] of [[lx - 4, ly - 4], [lx + lw + 3, ly - 4], [lx - 4, ly + lh + 3], [lx + lw + 3, ly + lh + 3]] as const) rivet(put, x, y);
}
