import { CIRCLE_STEPS, type CircleLayout, type CircleRing } from '../../../core/layout/circleOfFifths';
import { createBitmap, fromAscii, type Bitmap } from './bitmap';
import { C } from './palette';

/**
 * The circle of fifths' wheel (ft_1_28) as a ship's helm (picked: sketch 1): the names' two rings on
 * paper; the ring of counts is the helm's fat wooden rim with each count on a brass plate set into it; wooden spokes
 * between the steps, a brass boss in the hub, twelve turned handles past the rim and a red bow tied on the rim at the
 * piece's key. The rim takes the counts' ring rather than adding girth round it (the elements were hard
 * to fit because of the rim's thickness). Original, drawn for this project in the manner of the 1991 game's sea
 * things (wood in three warm browns with a dark violet-brown line, brass with one speck); no free pack has a wheel that holds words.
 */

/** How far a handle reaches past the rim. */
const HANDLE = 6;
/** Room the scene leaves round the circle's edge. Less than the handles: their knobs may break past the card's torn edge, which gives the names three more pixels of radius; the bow at the piece's key reaches a little further. */
export const WHEEL_MARGIN = 3;
const REACH = HANDLE + 4;
/** A brass plate stands upright as the count's words do: its half height, its half width for one count and for two, and the wood it leaves at a step's sides; at the rim's edges a plate may cover the rim's line, as a plate nailed on would. */
const PLATE_HALF = 5.5;
const PLATE_WIDE = [7.5, 16.5];
const PLATE_SIDE = 1.6;
const PLATE_EDGE = -0.5;

export interface WheelMarks {
  /** The step and ring chosen on the circle: its cell and its count's plate are gold. */
  selected: { step: number; ring: CircleRing } | null;
  /** The step of the piece's key (rule 3): its plate polished pale, and a red bow tied on the rim beyond it. */
  marked: number | null;
}

const TAU = 2 * Math.PI;
const SECTOR = TAU / CIRCLE_STEPS;
/** The wood's own outline: a dark violet-brown, not the letters' ink. */
const LINE = C.umberDeep;

/** A fixed hash of two integers, 0..1: the wood's grain. */
function hash(a: number, b: number): number {
  let h = (a * 374761393 + b * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** A pixel's place against a radial line at `theta` (clockwise from up): `off` across it (signed), `along` it from the middle. */
function across(dx: number, dy: number, theta: number): { off: number; along: number } {
  return { off: dx * Math.cos(theta) + dy * Math.sin(theta), along: dx * Math.sin(theta) - dy * Math.cos(theta) };
}

/** How much a surface whose outward normal points at `angle` faces the light from the upper left: 1 full on, -1 away. */
function facing(angle: number): number {
  return Math.SQRT1_2 * (Math.cos(angle) - Math.sin(angle));
}

/** The helm's wood for a lit value -1..1: shade, mid, lit. A warm brown, lighter than the walnut of the panels it lies on. */
function wood(lit: number): number {
  return lit > 0.35 ? C.brownLight : lit < -0.35 ? C.brownDark : C.brown;
}

interface Pixel {
  readonly dx: number;
  readonly dy: number;
  readonly r: number;
  readonly angle: number;
  /** The step the pixel is on, and the nearest spoke (a boundary between two steps) with the pixel's place against it. */
  readonly step: number;
  readonly spoke: number;
  readonly off: number;
  readonly along: number;
}

function pixelAt(dx: number, dy: number): Pixel {
  const angle = (Math.atan2(dx, -dy) + TAU) % TAU;
  const spoke = (Math.round(angle / SECTOR - 0.5) + 0.5) * SECTOR;
  return { dx, dy, r: Math.hypot(dx, dy), angle, step: Math.round(angle / SECTOR) % CIRCLE_STEPS, spoke, ...across(dx, dy, spoke) };
}

function isChosen(marks: WheelMarks, step: number, ring: CircleRing | 'count'): boolean {
  // the count belongs to both keys of a step: a chosen minor lights its plate as a chosen major does
  return marks.selected !== null && marks.selected.step === step && (ring === 'count' || marks.selected.ring === ring);
}

/** The red bow tied on the rim at the piece's key, drawn upright whatever the step: two loops, a knot, two short tails. */
const BOW = fromAscii(
  ['kkk...kkk', 'krrk.krrk', 'kRrrkrrRk', 'kRRkRkRRk', 'kkk.k.kkk', '...kRk...', '..kRkRk..', '..kk.kk..'],
  { k: C.redDark, r: C.redLight, R: C.red },
);

/**
 * The wheel, in art pixels. The picture is square with the circle's middle at its middle: its top left is at
 * (`cx` - edge - `REACH` - 1, `cy` - the same) of the layout, `REACH` past the edge for the handles and the bow.
 */
export function paintWheel(layout: CircleLayout, marks: WheelMarks): Bitmap {
  const { edge, major } = layout.radii;
  const half = Math.ceil(edge) + REACH + 1;
  const size = half * 2 + 1;
  const b = createBitmap(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const p = pixelAt(x - half, y - half);
      const outer = wobbleAt(p.angle, edge);
      b.pixels[y * size + x] = p.r > outer + 0.5 ? handle(p, outer) : p.r > major - 0.5 ? rim(p, layout, outer, marks) : inside(p, layout, marks);
    }
  }
  if (marks.marked !== null) tieBow(b, half, edge, marks.marked);
  return b;
}

/** A turned handle on each spoke past the rim: a neck, a bulb, a neck and a knob. */
function handle(p: Pixel, outer: number): number {
  // each handle turned by hand: its bulb, knob and length a little different from the next
  const which = Math.round(p.spoke / SECTOR - 0.5);
  const bulb = 2.2 + hash(which, 1) * 0.6;
  const knob = 1.8 + hash(which, 2) * 0.5;
  const length = HANDLE - 0.5 + hash(which, 3) * 1.2;
  const t = p.along - outer;
  if (t <= 0 || t > length + 0.5) return C.clear;
  const width = t < 1.3 ? 1.3 : t < 3.6 ? bulb : t < 4.3 ? 1.3 : knob;
  const off = Math.abs(p.off);
  if (off > width + 0.6) return C.clear;
  if (off > width - 0.4 || t > length - 0.1) return LINE;
  // the side of the handle facing the upper left is lit, with a lit streak down the bulb
  const lit = facing(p.spoke + ((Math.sign(p.off) || 1) * Math.PI) / 2);
  if (t >= 1.3 && t < 3.6 && lit > 0 && off > 0.6 && off < 1.6) return C.brownLight;
  return wood(lit * 0.9);
}

/** The rim's outer edge at `angle`, a little off true as a hand-made wheel is (less than a pixel either way). */
function wobbleAt(angle: number, edge: number): number {
  return edge + 0.5 * Math.sin(angle * 3 + 1) + 0.35 * Math.sin(angle * 7 + 2);
}

/**
 * The rim: the counts' ring in wood, a dark brown line at both its edges, lit on its upper left; a brass plate set in it
 * at each step for the count and a brass stud where each spoke meets it.
 */
function rim(p: Pixel, layout: CircleLayout, outer: number, marks: WheelMarks): number {
  const { major, edge } = layout.radii;
  if (p.r > outer - 0.5 || p.r < major + 0.5) return LINE;
  const middle = (major + edge) / 2;
  const step = layout.steps[p.step]!;
  const sx = step.signAt.x - layout.cx;
  const sy = step.signAt.y - layout.cy;
  const halfWidth = PLATE_WIDE[Math.min(step.signs.length, 2) - 1] ?? PLATE_WIDE[0]!;
  // the plate's distance inside each of its bounds: its own sides and top and bottom, the step's sides, the rim's edges
  // a plate with two counts (the bottom) is wider than its step and covers the studs beside it
  const sides = step.signs.length > 1 ? Infinity : Math.abs(p.off) - PLATE_SIDE;
  const inset = Math.min(halfWidth - Math.abs(p.dx - sx), PLATE_HALF - Math.abs(p.dy - sy), sides, p.r - major - PLATE_EDGE, edge - PLATE_EDGE - p.r);
  if (inset > -0.5) return plate(p, sx, sy, inset, marks);
  // a stud on each spoke, in the rim's middle
  const stud = Math.hypot(p.off, p.along - middle);
  if (stud < 1.1) return stud < 0.5 ? C.goldLight : C.gold;
  if (stud < 1.8) return C.goldDark;
  const lit = facing(p.angle);
  // the rim's outer part catches the light on the upper left; the inner part is in its own shade on the lower right
  let colour = p.r > middle ? wood(lit + 0.25) : wood(-lit - 0.15);
  // grain: a few long streaks along the rim, a shade darker
  if (hash(Math.round(p.angle * 20), Math.round(p.r)) > 0.88) colour = colour === C.brownLight ? C.brown : C.brownDark;
  return colour;
}

/** A brass plate, upright: a dark line round it, its top and left edges lit, its bottom and right in shade; pale at the piece's key, gold when chosen. */
function plate(p: Pixel, sx: number, sy: number, inset: number, marks: WheelMarks): number {
  if (inset < 0.5) return LINE;
  const chosen = isChosen(marks, p.step, 'count');
  const piece = marks.marked === p.step;
  const [lit, face, shade] = chosen ? [C.goldLight, C.gold, C.goldDark] : piece ? [C.white, C.cream, C.buffLight] : [C.buffLight, C.buff, C.buffDark];
  if (inset < 1.5) return p.dy - sy > 1 || p.dx - sx > 2 ? shade : lit;
  return face;
}

/** Stamp the bow upright on the rim's outer edge at the piece's key. */
function tieBow(b: Bitmap & { pixels: Uint8Array }, half: number, edge: number, step: number): void {
  const angle = step * SECTOR;
  const left = half + Math.round(Math.sin(angle) * (edge + 2)) - Math.floor(BOW.width / 2);
  const top = half - Math.round(Math.cos(angle) * (edge + 2)) - 3;
  for (let y = 0; y < BOW.height; y++) {
    for (let x = 0; x < BOW.width; x++) {
      const v = BOW.pixels[y * BOW.width + x]!;
      const tx = left + x;
      const ty = top + y;
      if (v && tx >= 0 && ty >= 0 && tx < b.width && ty < b.height) b.pixels[ty * b.width + tx] = v;
    }
  }
}

/** Inside the rim: the names' paper rings, the spokes across them, the brass boss in the hub. */
function inside(p: Pixel, layout: CircleLayout, marks: WheelMarks): number {
  const { hub, minor, major } = layout.radii;
  if (p.r < hub + 0.5) return boss(p, hub);
  // a spoke: two pixels of wood, the half facing the upper left lit, the other in shade (no line: the paper needs the room)
  if (p.along > 0 && Math.abs(p.off) < 1) return facing(p.spoke + (Math.sign(p.off) * Math.PI) / 2) > 0 ? C.brownLight : C.brown;
  if (Math.abs(p.r - minor) < 0.5) return C.ink;
  const ring: CircleRing = p.r < minor ? 'minor' : 'major';
  if (isChosen(marks, p.step, ring)) return cellEdge(p, ring, layout) ? C.goldDark : C.gold;
  // the paper a tone darker where it meets the rim and the boss, as a sheet under wood is
  if (p.r > major - 2 || p.r < hub + 2) return C.buff;
  return ring === 'minor' ? C.buffLight : C.cream;
}

/** Whether a pixel of a cell lies within two pixels of its edge (the chosen cell's darker rim). */
function cellEdge(p: Pixel, ring: CircleRing, layout: CircleLayout): boolean {
  const { hub, minor, major } = layout.radii;
  const [inner, outer] = ring === 'minor' ? [hub, minor] : [minor, major];
  return p.r - inner < 2 || outer - p.r < 2 || Math.abs(p.off) < 2.6;
}

/** The brass boss: a disc lit at its upper left with one white speck, a darker ring and a rivet on each spoke. */
function boss(p: Pixel, hub: number): number {
  if (p.r > hub - 0.5) return LINE;
  if (Math.hypot(p.off, p.along - hub * 0.75) < 0.8) return C.goldDark;
  if (Math.abs(p.r - hub * 0.5) < 0.5) return C.goldDark;
  if (Math.hypot(p.dx + hub * 0.3, p.dy + hub * 0.3) < 1) return C.white;
  const light = Math.hypot(p.dx + hub * 0.35, p.dy + hub * 0.35) / (hub * 1.4);
  return light < 0.4 ? C.goldLight : light < 0.8 ? C.gold : C.goldDark;
}
