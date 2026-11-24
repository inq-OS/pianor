import { colour, mix, tint, type Colour } from '../paint/materials';
import { hash2, noise2 } from '../paint/noise';
import type { Material } from '../paint/trace';

/**
 * Paper and books as the rooms of the 1991 game paint them: papers fat, never thin strips, and never slabs with a
 * ruler's edges, which read as stone; books more than boxes (studied in the map maker's office of Woodtick and the
 * library of Phatt, never copied). Paper there is golden in the light and soft: a
 * sheet droops where it hangs over the edge of its pile and curls up at a corner, a pile is ragged, each sheaf lying
 * its own way, and a chart is a roll as fat as an arm. A book is small and warm-coloured, two boards past a pale block
 * of pages, a rounded back, and lies crooked on the one under it. And the warden's own music: pages ruled by hand,
 * written, crossed out and written again.
 */

const PAPER = colour(0xffe296), FOXED = colour(0xe8b060), EDGE = colour(0xfff0b8), SHADE = colour(0x8a4a22), INK = colour(0x4a2a1e), RED_INK = colour(0xa8443c);

/** Paper turned from the light: it goes orange-brown, never grey. */
const TURNED = colour(0xcc8038);

/** How thick one loose sheet is, in metres: enough for its edge to be a line of its own in the picture. */
export const SHEET = 0.007;

/**
 * The writing of a page, in metres: the ruled lines' pitch, a stave's height, the room a note takes, the margin, half
 * a ruled line's thickness, a note head's half width and half height, a stem's length. Large, so that a page lying in
 * the picture's foreground, seen from above, still shows its lines one by one.
 */
const STAVE = { pitch: 0.03, tall: 4 * 0.03, note: 0.046, margin: 0.03, line: 0.006, head: [0.012, 0.017], stem: 0.08, bar: 3 } as const;

/** What is known of a page before a place on it is asked for: its paper, its staves and what was written where. */
interface Page {
  w: number; d: number; seed: number; paper: Colour; pale: Colour; dim: Colour;
  /** Which way the page grows darker: across it and along it. */
  lean: readonly [number, number];
  staves: number; gap: number; step: number; slots: number; bars: number;
  /** The stave that has a bar crossed out whatever the others have. */
  must: number;
  ring: { x: number; y: number; r: number; on: boolean };
}

/** Where a page's first note is written, from its left edge. */
const LEFT = 0.05;

function pageOf(w: number, d: number, seed: number): Page {
  const h = (a: number, k: number): number => hash2(a, seed, k);
  const room = 0.022;
  const staves = Math.max(1, Math.floor((d - 2 * STAVE.margin + room) / (STAVE.tall + room)));
  const gap = staves > 1 ? (d - 2 * STAVE.margin - staves * STAVE.tall) / (staves - 1) : 2 * STAVE.margin;
  const slots = Math.max(1, Math.floor((w - LEFT - 0.03) / STAVE.note));
  return {
    w, d, seed, paper: mix(PAPER, FOXED, 0.5 * hash2(seed, 1, 60)), pale: mix(PAPER, EDGE, 0.75), dim: colour(0xdca060),
    lean: [h(5, 92) - 0.5, h(6, 93) - 0.5],
    staves, gap, step: STAVE.tall + gap, slots, bars: Math.max(1, Math.floor(slots / STAVE.bar)),
    // every page has a stave with a bar crossed out, in its first bars, where a page half out of the picture still shows it
    must: Math.floor(h(9, 76) * staves),
    ring: { x: w * (0.25 + 0.5 * h(2, 61)), y: d * (0.3 + 0.4 * h(3, 62)), r: 0.05, on: h(4, 63) > 0.6 },
  };
}

/** Where the head of note `i` of stave `s` sits: across the page, and down the stave from its top line; some places are rests. */
function head(p: Page, s: number, i: number): { x: number; y: number; on: boolean } {
  return { x: LEFT + (i + 0.5) * STAVE.note, y: Math.floor(hash2(s * 31 + i, p.seed, 64) * 9) * STAVE.pitch / 2, on: hash2(s * 31 + i, p.seed, 65) > 0.2 };
}

/** Whether notes `i` and `i + 1` of stave `s` are joined by a beam. */
function beamed(p: Page, s: number, i: number): boolean {
  return i % 2 === 0 && i + 1 < p.slots && head(p, s, i).on && head(p, s, i + 1).on && hash2(s * 13 + i, p.seed, 70) > 0.4;
}

/** Whether the bar that holds note `i` of stave `s` was crossed out. */
function crossedOut(p: Page, s: number, i: number): boolean {
  if (i < 0 || i >= p.slots) return false;
  const bar = Math.floor(i / STAVE.bar);
  return (s === p.must || hash2(s, p.seed, 67) > 0.7) && bar === Math.floor(hash2(s, p.seed, 66) * Math.min(p.bars, 2));
}

/** A mark of the pen at a place: the ink and how dark it lies. */
type Mark = readonly [Colour, number] | null;

/** A ruled line's ink stands for "the paper there with thin ink over it": the page mixes it where it lies. */
const RULE = colour(0x000001);

/**
 * The bare paper at a place of a page, as a brush lays it and not as a printer does: three tones in soft shapes, the
 * palest where the light catches the sheet's middle, the foxed one toward a side and in its dips.
 */
function washed(p: Page, x: number, y: number): Colour {
  const n = noise2(x * 5.5 + p.seed, y * 5.5, 91) + 0.5 * (p.lean[0] * (x / p.w - 0.5) + p.lean[1] * (y / p.d - 0.5));
  return n > 0.62 ? p.pale : n < 0.36 ? p.dim : p.paper;
}

/** In a crossed-out bar: the notes written again over it in red, and the strokes that strike it out. */
function corrected(p: Page, s: number, i: number, x: number, ys: number): Mark {
  const at = head(p, s + 7, i);
  if (at.on && ((x - at.x) / (STAVE.head[0] * 1.1)) ** 2 + ((ys - at.y * 0.5 + 0.012) / STAVE.head[1]) ** 2 < 1) return [RED_INK, 1.15];
  // hatched out: short slanting strokes side by side, as a pen strikes a bar through
  const stroke = (((x - LEFT) / 0.03 - 1.4 * ys / STAVE.tall) % 1 + 1) % 1;
  return stroke < 0.3 && ys > 0.08 * STAVE.tall && ys < 0.92 * STAVE.tall ? [INK, 0.95] : null;
}

/** A note of stave `s` at a place: its head, its stem, the beam to its neighbour. */
function noted(p: Page, s: number, i: number, x: number, ys: number, fine: number): Mark {
  const n = head(p, s, i);
  if (n.on) {
    if (((x - n.x) / STAVE.head[0]) ** 2 + ((ys - n.y) / STAVE.head[1]) ** 2 < 1) return [INK, 1];
    if (Math.abs(x - n.x - STAVE.head[0] * 0.8) < Math.max(0.0032, fine * 0.5) && ys < n.y && ys > n.y - STAVE.stem) return [INK, 1];
  }
  const from = beamed(p, s, i) ? i : i > 0 && beamed(p, s, i - 1) ? i - 1 : -1;
  if (from < 0) return null;
  const a = head(p, s, from), b = head(p, s, from + 1);
  return x > a.x + STAVE.head[0] * 0.5 && x < b.x + STAVE.head[0] && Math.abs(ys - Math.min(a.y, b.y) + STAVE.stem) < 0.007 ? [INK, 1] : null;
}

/** The ruling of stave `s` at a place: a bar line, or one of its five lines, drawn by hand, so each wavers a little. */
function ruled(p: Page, s: number, i: number, x: number, ys: number, fine: number): Mark {
  const barred = Math.abs((((x - LEFT) / (STAVE.bar * STAVE.note)) % 1 + 1.5) % 1 - 0.5) < Math.max(0.012, fine * 0.5 / (STAVE.bar * STAVE.note));
  if (ys > 0 && ys < STAVE.tall && i >= 0 && barred) return [INK, 1.2];
  const line = (ys + 0.004 * (noise2(x * 5, s * 3 + p.seed, 71) - 0.5)) / STAVE.pitch;
  const on = ys > -STAVE.line && ys < STAVE.tall + STAVE.line && Math.abs(line - Math.round(line)) * STAVE.pitch < STAVE.line;
  return on ? [RULE, 1] : null;
}

/** What the pen left at (`x`, `y`) of a page, from its far left corner; nothing where the paper is bare. */
function written(p: Page, x: number, y: number, fine: number): Mark {
  const s = Math.min(p.staves - 1, Math.max(0, Math.floor((y - STAVE.margin + p.gap / 2) / p.step)));
  const ys = y - STAVE.margin - s * p.step, i = Math.floor((x - LEFT) / STAVE.note);
  if (x <= 0.03 || x >= p.w - 0.025) return null;
  const crossed = crossedOut(p, s, i);
  const fix = crossed ? corrected(p, s, i, x, ys) : null;
  if (fix || ys < -0.014 || ys > STAVE.tall + 0.014) return fix;
  // a whole stave struck through with one wavy line
  if (hash2(s, p.seed, 69) > 0.7 && Math.abs(ys - STAVE.tall / 2 - 0.022 * Math.sin(x * 40 + s)) < 0.0075) return [INK, 1];
  const note = i >= 0 && i < p.slots && !crossed ? noted(p, s, i, x, ys, fine) : null;
  return note ?? ruled(p, s, i, x, ys, fine);
}

/**
 * What the pen left at a place of the page `manuscript(w, d, seed)` paints, measured from its middle: a ruled line, a
 * note or a stroke in dark ink, the red ink of a correction, or nothing.
 */
export function penAt(w: number, d: number, seed: number, u: number, v: number, fine = 0.004, large = 1): 'rule' | 'ink' | 'red' | null {
  const mark = written(pageOf(w / large, d / large, seed), (u + w / 2) / large, (v + d / 2) / large, fine / large);
  return !mark ? null : mark[0] === RULE ? 'rule' : mark[0] === RED_INK ? 'red' : 'ink';
}

/**
 * A page of music written by hand, `w` wide and `d` deep, from its middle (`u` across, `v` along its depth): staves
 * ruled a little unevenly, note heads with stems and a beam here and there, bar lines, a bar scribbled out and written
 * again over it in red ink, now and then a stave struck through with a wavy line or the ring a mug left.
 * `glow` is the light of its own a page keeps, so that the writing is read. `large` writes everything that many times
 * larger: a page that lies far from the eye is written in a hand as big as a fist, or its five lines run into one band
 * (the 1991 rooms never paint fine print).
 */
export function manuscript(w: number, d: number, seed: number, glow = 0, large = 1): Material {
  const p = pageOf(w / large, d / large, seed);
  return (d2) => {
    const x = (d2.u + w / 2) / large, y = (d2.v + d / 2) / large;
    d2.emit = glow;
    // where the sheet falls away over an edge it turns from the light: a tone darker, and darker again
    const turned = d2.ny > 0.93 ? 0 : d2.ny > 0.7 ? 0.6 : 0.85;
    // (what hangs down is not read: the pen's marks are left out there, or they run down the fold like spilt ink)
    const mark = turned === 0 ? written(p, x, y, d2.fine / large) : null;
    if (mark) return tint(d2, mark[0] === RULE ? mix(mix(washed(p, x, y), TURNED, turned), INK, 0.45) : mark[0], mark[1]);
    const ring = p.ring.on && Math.abs(Math.hypot(x - p.ring.x, y - p.ring.y) - p.ring.r) < 0.007 ? 0.8 : 1;
    tint(d2, mix(washed(p, x, y), TURNED, turned), ring);
  };
}

/**
 * A sheaf of sheets `h` thick as one piece of a pile: on top a page of music, on its sides the sheets' edges, thin
 * lines of every tone of the paper that waver along the pile, with a dark gap here and there where a sheet lies back.
 */
export function sheaf(w: number, d: number, h: number, seed: number, glow = 0, large = 1): Material {
  const page = manuscript(w, d, seed, glow, large);
  return (d2) => {
    if (d2.face === 3) return page(d2);
    d2.emit = glow;
    if (d2.face === 2) return tint(d2, SHADE, 0.7);
    // a leaf line is never thinner than a pixel and a half of the picture, or the pile's side would be grit
    const at = (h / 2 - d2.v) / Math.max(0.0055, 1.5 * d2.fine) + 0.9 * noise2(d2.u * 7, seed, 77), n = Math.floor(at), tone = hash2(n, seed, 73);
    // leaf on leaf: pale, foxed and brown lines, and a dark gap where a sheet lies back
    // (a tone down from the page on top: the side of a pile stands in its own shade, and so stands off a sunlit floor)
    if (tone > 0.72) return tint(d2, SHADE, 0.62);
    tint(d2, tone > 0.42 ? mix(FOXED, SHADE, 0.6) : tone > 0.14 ? mix(FOXED, SHADE, 0.25) : FOXED, 0.86 + 0.1 * hash2(n, seed, 72));
  };
}

/** A loose sheet (`Bent`): a page of music on top, its under side in its own shade, its cut edges pale. */
export function looseSheet(w: number, d: number, seed: number, glow = 0, large = 1): Material {
  const page = manuscript(w, d, seed, glow, large);
  return (d2) => {
    if (d2.face === 3) return page(d2);
    d2.emit = glow;
    tint(d2, d2.face === 2 ? FOXED : EDGE, d2.face === 2 ? 0.6 : 0.95);
  };
}

/**
 * The outline of a sheet or a sheaf `w` by `d` (`Bent`'s `edge`): how far inside its rectangle the paper ends near a
 * place. No edge of old paper is a ruler's: it wavers by `rough` metres, and one corner in three is torn or folded off.
 */
export function worn(w: number, d: number, seed: number, rough = 0.012): (lx: number, lz: number) => number {
  const torn = hash2(seed, 3, 94) > 0.66, sx = hash2(seed, 4, 95) > 0.5 ? 1 : -1, sz = hash2(seed, 5, 96) > 0.5 ? 1 : -1;
  const cut = 0.035 + 0.035 * hash2(seed, 6, 97);
  return (lx, lz) => {
    const waver = rough * (0.15 + 0.85 * noise2(lx * 13 + seed, lz * 13, 98));
    if (!torn) return waver;
    // the torn corner: a slanting cut across it
    const left = (w / 2 - sx * lx) + (d / 2 - sz * lz);
    return left < cut ? 1 : waver;
  };
}

/**
 * How a sheaf `w` by `d` lies (`Bent`'s `lift`): it sags toward its edges by `sag` metres, as a pile of soft paper
 * does and a block of stone does not, and buckles a little all over.
 */
export function sagging(w: number, d: number, sag: number, seed: number): (lx: number, lz: number) => number {
  return (lx, lz) => {
    const q = Math.max(Math.abs(lx) / (w / 2), Math.abs(lz) / (d / 2));
    return -sag * q ** 3 + 0.004 * (noise2(lx * 6 + seed, lz * 6, 99) - 0.5);
  };
}

/**
 * How a loose sheet lies: which side of it hangs out over the edge of what it lies on and how far, how high the corner
 * that curls up stands (which corner: its signs along the sheet's width and depth), and, for a sheet that lies down the
 * side of a slumped pile, the slope it follows: from `from` along its width it falls `fall` metres over `run` metres.
 */
export interface Hang { side: 'near' | 'left' | 'right' | 'none'; out: number; curl: number; corner: readonly [number, number]; slope?: { from: number; run: number; fall: number } }

/**
 * The height of a sheet `w` by `d` above where it lies, at a place measured from its middle: level on its pile, falling
 * ever faster where it hangs out past the pile's edge, following a slumped pile's side down, rising toward the corner
 * that curls, and nowhere quite flat.
 */
export function sheetLift(w: number, d: number, hang: Hang): (lx: number, lz: number) => number {
  const hw = w / 2, hd = d / 2, slope = hang.slope;
  return (lx, lz) => {
    const past = hang.side === 'near' ? lz - (hd - hang.out) : hang.side === 'left' ? -lx - (hw - hang.out) : hang.side === 'right' ? lx - (hw - hang.out) : 0;
    const droop = past > 0 ? -4.5 * past * past - 0.15 * past : 0;
    const down = slope ? -slope.fall * Math.min(1, Math.max(0, (lx - slope.from) / slope.run)) ** 2 : 0;
    const q = Math.max(0, hang.corner[0] * lx / hw + hang.corner[1] * lz / hd - 1.25);
    return droop + down + hang.curl * (q / 0.75) ** 2 + 0.003 * (noise2(lx * 7, lz * 7, 100) - 0.5);
  };
}

/** The colours of a book as the library paints them: warm browns, ochre, olive and a dull red, never a pure colour. */
export const COVERS: readonly Colour[] = [0x9a4a26, 0x6e6a34, 0xb8782e, 0x7a3426, 0x8a5a36, 0x4e5a3e].map((c) => colour(c));

/** A board of a book `w` long and `d` deep: cloth with a frame pressed into it and now and then a pale label; its edges darker. */
export function bookBoard(w: number, d: number, cover: Colour, seed: number): Material {
  const label = hash2(seed, 2, 74) > 0.55;
  return (d2) => {
    if (d2.face !== 3) return tint(d2, cover, d2.face === 2 ? 0.5 : 0.8);
    const edge = Math.min(w / 2 - Math.abs(d2.u), d / 2 - Math.abs(d2.v));
    if (label && Math.abs(d2.u) < w * 0.2 && Math.abs(d2.v + d * 0.1) < d * 0.12) return tint(d2, EDGE, 0.95);
    tint(d2, cover, (edge < 0.03 && edge > 0.02 ? 1.3 : 1) * (0.92 + 0.16 * noise2(d2.u * 14, d2.v * 14, seed)));
  };
}

/** The block of a book's pages between its boards: pale, with a few of its leaves seen as lines. */
export function bookPages(seed: number): Material {
  return (d2) => {
    const leaf = Math.floor(d2.v / 0.011 + 0.6 * noise2(d2.u * 9, seed, 78));
    tint(d2, mix(PAPER, FOXED, 0.7 * hash2(leaf, seed, 79)), 0.92 + 0.14 * (leaf & 1));
  };
}

/** The rounded back of a book `len` long (a rod along it): the cloth, with three raised bands lighter than it. */
export function bookBack(len: number, cover: Colour): Material {
  return (d2) => {
    if (d2.face !== 0) return tint(d2, cover, 0.6);
    const along = Math.abs(((d2.v / len) * 3) % 1 - 0.5);
    tint(d2, cover, along < 0.085 ? 1.45 : 1.05);
  };
}

/** A sheet rolled up, `r` thick and `len` long: the fat tube of its paper with the sheet's edge along it and a ribbon round it, and at each end the coil round a dark middle. */
export function paperRoll(r: number, len: number, seed: number, glow = 0): Material {
  const paper = mix(PAPER, FOXED, 0.5 + 0.3 * hash2(seed, 1, 75)), shade = mix(FOXED, SHADE, 0.5);
  return (d2) => {
    d2.emit = glow;
    if (d2.face !== 0) {
      // the end: the sheet wound three times round a dark middle
      const q = Math.hypot(d2.u, d2.v) / r, turn = Math.atan2(d2.v, d2.u) / 6.283 + 0.5;
      if (q < 0.2) return tint(d2, INK, 1.1);
      return tint(d2, q > 0.86 ? paper : (q * 3 + turn) % 1 < 0.38 ? SHADE : PAPER, 1);
    }
    if (Math.abs(d2.v - len * 0.42) < 0.014) return tint(d2, RED_INK, 1.1);
    // the tube: lit along its top, in shade along its under side, the sheet's edge a dark line along it
    const round = d2.ny > 0.45 ? paper : d2.ny > -0.2 ? mix(paper, shade, 0.55) : shade;
    tint(d2, round, Math.abs(d2.u - r * 1.1) < Math.max(0.004, d2.fine * 0.6) ? 0.62 : 1);
  };
}

/**
 * One piece of a stack of music, its middle on the floor plan, turned by `turn` degrees: a sheaf of sheets or a book
 * from `y0` to `y1`, or a loose sheet that lies at `y0` and hangs as `hang` says.
 */
/** The stacks' pages lie far from the eye: they are written this many times larger than a page under it. */
export const LARGE_HAND = 1.5;

export interface PaperPiece { stack: number; kind: 'book' | 'sheaf' | 'sheet'; x: number; z: number; w: number; d: number; y0: number; y1: number; turn: number; seed: number; hang?: Hang }

/**
 * A stack of the warden's music: where the middle of its foot stands, how it is turned (its long side to the viewer),
 * the size of its sheets, how high its pile is, how many loose sheets lie on top. A pile with `low` has slumped: from
 * that height up each sheaf is shorter than the one under it, their ends a stair that falls along the pile's width
 * from `top` to `low`, and its loose sheets lie down that stair.
 */
interface Stack { x: number; z: number; turn: number; w: number; d: number; top: number; low?: number; sheets: number }

/**
 * The stacks on the floor by the door, where the firewood lay, their tops as the reference outline draws them: a tall
 * one in the corner, a slumped one against it that falls toward it, a low one to their left. They stand far enough
 * into the room for their sides to be seen: a pile of paper is known by its side, leaf on leaf (the map maker's pile).
 */
const STACKS: readonly Stack[] = [
  { x: 1.633, z: 3.927, turn: -49, w: 0.5, d: 0.36, top: 0.42, sheets: 3 },
  { x: 1.357, z: 3.772, turn: -32.7, w: 0.4, d: 0.34, top: 0.44, low: 0.2, sheets: 3 },
  { x: 1.004, z: 3.583, turn: -20, w: 0.5, d: 0.34, top: 0.23, sheets: 2 },
];

/** Below this height a stack is one plain pile: the picture's lower edge cuts it there or little above. */
const FOOT = 0.1;

const SIDES = ['near', 'left', 'right'] as const;

/** How much of a slumped pile's width its stair takes. */
const STAIR = 0.7;

/**
 * The stacks of music, from the floor up: a plain foot, then thin sheaves, each turned and pushed its own way so that
 * the pile's sides are ragged, with a book or a stray sheet between them that hangs out of the pile and droops; on top
 * loose sheets, turned further, the first hanging over the pile's near edge, a corner of each curled up. Every piece
 * lies on the one under it.
 */
export function musicStacks(): PaperPiece[] {
  const pieces: PaperPiece[] = [];
  STACKS.forEach((stack, n) => {
    const t = stack.turn * Math.PI / 180, sin = Math.sin(t), cos = Math.cos(t);
    const low = stack.low ?? stack.top;
    let y = 0, i = 0;
    // a piece `out` metres toward a side of the pile: along the pile's own width and depth, said along the room's x and z
    const toward = (side: Hang['side'], out: number): readonly [number, number] => side === 'near' ? [out * sin, out * cos] : side === 'left' ? [-out * cos, out * sin] : side === 'right' ? [out * cos, -out * sin] : [0, 0];
    /** How much of the pile's width a piece at height `at` has: all of it, less up a slumped pile's stair. */
    const share = (at: number): number => at <= low ? 1 : 1 - STAIR * Math.min(1, (at - low) / (stack.top - low));
    const lay = (kind: PaperPiece['kind'], thick: number, wide: number, spread: number, hang?: Hang): void => {
      const h = (k: number): number => hash2(i, n, k);
      const part = share(y), small = kind === 'book' ? Math.min(part, 0.72) : part;
      // a sheet that hangs lies that far out of the pile, so that what droops has nothing under it; a shorter piece lies at the pile's left end
      const [ox, oz] = hang ? toward(hang.side, hang.out) : [0, 0];
      const [sx, sz] = hang?.slope ? [0, 0] : toward('left', stack.w * (1 - small) / 2);
      pieces.push({
        stack: n, kind, y0: y, y1: y + thick, seed: n * 32 + i, ...(hang ? { hang } : {}),
        x: stack.x + (h(80) - 0.5) * wide + ox + sx, z: stack.z + (h(81) - 0.5) * wide + oz + sz,
        w: stack.w * (hang?.slope ? 1 : small) * (0.92 + 0.14 * h(82)), d: stack.d * (kind === 'book' ? 0.72 : 1) * (0.92 + 0.14 * h(83)),
        turn: stack.turn + (h(84) - 0.5) * spread,
      });
      y += thick;
      i++;
    };
    lay('sheaf', FOOT, 0, 0);
    while (y < stack.top - 0.012) {
      const k = i, room = stack.top - y, stair = y >= low;
      if (k % 5 === 3 && room > 0.09) lay('book', 0.04 + 0.02 * hash2(k, n, 85), 0.04, 22);
      else if (k % 3 === 2 && !stair) lay('sheet', SHEET, 0.02, 12, { side: SIDES[Math.floor(hash2(k, n, 87) * 3)]!, out: 0.07 + 0.06 * hash2(k, n, 88), curl: 0, corner: [1, 1] });
      else lay('sheaf', Math.min(room, (stair ? 0.016 : 0.018) + (stair ? 0.014 : 0.03) * hash2(k, n, 86)), stair ? 0.02 : 0.06, stair ? 10 : 20);
    }
    const run = STAIR * stack.w, fall = stack.top - low;
    for (let s = 0; s < stack.sheets; s++) {
      const k = i, curl = 0.02 + 0.03 * hash2(k, n, 89), corner = [hash2(k, n, 90) > 0.5 ? 1 : -1, s === 0 ? -1 : 1] as const;
      // a slumped pile's sheets lie down its stair, just clear of the steps' corners
      // (each turned its own way and a different length, so that their ends do not line up; the last curls at its upper corner)
      if (fall > 0) lay('sheet', SHEET, 0.03, 34, { side: 'none', out: 0, curl: s === stack.sheets - 1 ? 0.05 : curl, corner: [-1, s === stack.sheets - 1 ? -1 : corner[1]], slope: { from: stack.w / 2 - run + 0.025, run, fall } });
      // on a level pile the first hangs out over its near edge; those on it lie turned every way
      else lay('sheet', SHEET, 0.03, s === 0 ? 40 : 56, { side: s === 0 ? 'near' : 'none', out: s === 0 ? 0.07 + 0.03 * hash2(k, n, 88) : 0, curl, corner });
    }
  });
  return pieces;
}

/** How many stacks of music stand by the door. */
export const MUSIC_STACKS = STACKS.length;

/** A roll of music that lies on top of stack `on`: its two ends and how thick it is. */
export interface MusicRoll { on: number; a: readonly [number, number, number]; b: readonly [number, number, number]; r: number; seed: number }

/**
 * The fat roll on the tall stack, as the map maker's charts lie rolled: across the back of the pile, its nearer end
 * turned a little to the viewer so that its coil is seen.
 */
export function musicRolls(): MusicRoll[] {
  const s = STACKS[0]!, r = 0.046, len = 0.4;
  const y = s.top + s.sheets * SHEET + r - 0.004;
  const t = (s.turn + 50) * Math.PI / 180, ax = Math.cos(t), az = -Math.sin(t);
  // its middle: toward the right and the back of the pile
  const back = -0.04, right = 0.12, ts = s.turn * Math.PI / 180;
  const mx = s.x + right * Math.cos(ts) + back * Math.sin(ts), mz = s.z - right * Math.sin(ts) + back * Math.cos(ts);
  return [{ on: 0, a: [mx - ax * len / 2, y, mz - az * len / 2], b: [mx + ax * len / 2, y + 0.01, mz + az * len / 2], r, seed: 5 }];
}
