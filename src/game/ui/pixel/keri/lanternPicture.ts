import { LANTERN, LANTERN_SHAPE, lanternEye, lanternProject, lanternSight, type LanternPlan } from '../../../../core/layout/lantern';
import type { SkyPhase } from '../../../../core/sky/skyPhase';
import { insideRing, type World, type WorldPoint } from '../../../../core/world/world';
import { createBitmap, type Bitmap } from '../bitmap';
import { cropTogether, type Overlay } from '../pack';
import { clamp01, smoothstep as smooth } from '../paint/ease';
import { paintLooks, SkyMask, swing, type WindWay } from '../paint/motion';
import { LiveRecorder, type LiveWater } from '../paint/live';
import { grain } from '../paint/grain';
import { fbm, hash2, noise2 } from '../paint/noise';
import { tintedCloud, type CurlSpec } from './curlCloud';
import { KERI_HOURS, scenePalette, tone, type Hour } from './keriPalette';
import { bushAt, roseFlower, roseRun } from './kit/bushes';
import { optionsOf, type KitBrush } from './kit/kit';
import { lamp, lampLit } from './kit/lights';
import { part } from './kit/shape';
import { boulder } from './kit/stones';
import { rings, sea, type SeaGround, type SeaOptions, type SeaStand } from './kit/water';
import { fillQuad, KIT_WOOD } from './kit/wood';

/**
 * The picture of the main menu (ft_1_07): the lantern of Keri's lighthouse with the island under it, after the
 * reference photograph of it from the air at sunset (the main menu has this as its scene, the tip of the
 * lighthouse and an overview of the island). Pixel art painted back to front as the docks are (d111):
 * the bare sky (its clouds are their own pictures and drift over it), the sea of the kit, the island from the world
 * model (each pixel under the horizon asks what lies there: sea, shingle, meadow, a path), the boulders of the shore,
 * the houses where they stand, each a crooked cottage drawn larger than true, the mast, the flagpole, the jetty, the
 * dog roses near the viewer, and before it all the lantern: an iron pot of a dome on a cage of glass, its lens inside,
 * its gallery and rail, as large as the picture is high (in every scene the lighthouse is drawn grand).
 * The hour changes the colours, not the drawing; only the sun, the moon, the stars, the glints and the light in the
 * lens are drawn for an hour.
 */

/**
 * Keri's shared palette and what only this view has. The iron, the green boards and the wood are the crossroads' and
 * the kit's own; the iron is one tone longer at each end, for the lantern is the picture's largest thing. The
 * plaster and the pale blue tin are the warden's house. The lens is brass in the meadow's dry gold, the glass's frame in the
 * shingle's greys.
 */
const SHARED = scenePalette({
  iron: [0x2a0e14, 0x481816, 0x802c20, 0xac4e32, 0xd88a52],
  plaster: [0x4e4662, 0x8a7c8c, 0xc6b8ae, 0xeee4d0],
  tin: [0x4a5a74, 0x8098ac, 0xc0d2d8],
  boards: [0x2e5644, 0x4a927e, 0x9ccec6],
  wood: KIT_WOOD,
}, ['grass', 'dry', 'far', 'shingle', 'stone', 'bush', 'near', 'rose', 'bloom']);
const R = SHARED.run;
const F = SHARED.fine;

/** The meadow's greens and its dry gold, as the knoll paints the same summer grass (the knoll is the model for grass, bushes and foliage). */
const TURF = part(F.grass, R.grass[0]!, R.grass[3]!);
const TURF_DRY = part(F.dry, R.dry[0]!, R.dry[2]!);
const PEBBLE = part(F.shingle, R.shingle[0]!, R.shingle[3]!);
/** The runs the grain of scanned paint goes over: not the sky (its tones lie far apart at dusk; the room taught that grain there reads as noise), not the clouds, not the lights. */
const GRAIN_RUNS = [{ run: F.sea, dash: 3 }, F.grass, F.dry, F.shingle, F.stone, F.bush, F.iron, F.plaster, F.tin, F.boards, F.wood];

export function lanternPalette(phase: SkyPhase): readonly number[] {
  return SHARED.at(phase);
}

/** The picture's runs, for the art tools and the rules' test. */
export const lanternRuns = (): Readonly<Record<string, readonly number[]>> => F;

/** The looks of the sea and the pennant in one gust's loop. */
export const LANTERN_FRAMES = 4;
/** The wind of Keri blows mostly from the west (docs/keri.md): looking north-west, that is toward the viewer and a little to the right. */
export const LANTERN_WAY: WindWay = 1;
/** The light in the lens: how many looks its glow has. */
export const LIGHT_LOOKS = 3;

/** The moon's place in the night's sky: over the island's far end, clear of the game's name and the sheet of names, which cover the picture's left in the game. */
const MOON = { x: 262, y: 84, r: 8 } as const;
/** The plane of the water left of the island that catches the moon: full left of `from`, none right of `to` (fine pixels). */
const MOON_WATER = { from: 200, to: 310 } as const;
/** Where the sun sets on the horizon in this view (at about 302 degrees): over the open water between the island's far end and the lantern. */
const SUNSET = 286;

/**
 * Where the light is in this view (north-west) at each hour: the side it comes from (-1 left, 1 right), the column
 * where it lies on the water (off the picture when the sun is behind the viewer), and where a low sun warms the sky.
 * By day the sun stands in the south, behind the viewer and to the left; at dusk it sets ahead on the left; at dawn it
 * rises behind the viewer on the right.
 */
const LIGHT: Record<SkyPhase, { side: number; glint: number; warm: number; face: number }> = {
  day: { side: -0.45, glint: -999, warm: 0, face: 0 },
  dawn: { side: 1, glint: -999, warm: 1, face: 0 },
  // the sun is behind what faces the viewer: it is in shade, with a lit rim toward the sun
  dusk: { side: -0.8, glint: SUNSET, warm: -1, face: -0.3 },
  night: { side: -0.6, glint: MOON.x, warm: 0, face: -0.2 },
};

/**
 * The sky's clouds, back to front (d111): each one stroke that rolls up into a head leading the way the wind
 * blows, no two alike, the big fat one behind the long thin ones, flat streaks low over the sea. Each has its left
 * edge and top in fine pixels; they drift over the bare sky in the game.
 */
export const LANTERN_CLOUDS: readonly { at: readonly [number, number]; spec: CurlSpec }[] = [
  // low over the sea, far off: flat streaks
  { at: [150, 130], spec: { length: 86, girth: 6, belly: 0.4, neck: 1, taper: 0.6, bend: 2, wave: 1, phase: 0.5 } },
  { at: [300, 138], spec: { length: 56, girth: 5, belly: 0.6, neck: 1, taper: 0.6, bend: 1, wave: 1, phase: 1.5 } },
  { at: [196, 108], spec: { length: 134, girth: 15, belly: 0.5, neck: 1, taper: 0.7, bend: 3, wave: 1.4, phase: 0.2 } },
  // the big fat one behind, left of the lantern's dome, and a small curl over the island
  { at: [214, 20], spec: { length: 156, girth: 34, belly: 0.74, neck: 0.9, taper: 1.2, bend: 9, wave: 0.7, phase: 0, rise: 8, head: { size: 24, turns: 1.25 }, curls: [{ at: 0.55, size: 19, turns: 1.15 }] } },
  { at: [186, 84], spec: { length: 104, girth: 9, belly: 0.8, neck: 0.9, taper: 0.9, bend: 5, wave: 1.3, phase: 0.2, head: { size: 11, turns: 1.3 } } },
  // a long thin one in front
  { at: [330, 66], spec: { length: 140, girth: 10, belly: 0.7, neck: 0.95, taper: 0.9, bend: 6, wave: 1.2, phase: 0.45, head: { size: 11, turns: 1.2, down: true } } },
];

export interface LanternCloud {
  x: number;
  y: number;
  bitmap: Bitmap;
}

export interface LanternPicture {
  palette: readonly number[];
  /** The whole picture in each look of the sea (`LANTERN_FRAMES`), the sky bare: the clouds drift over it. */
  frames: Bitmap[];
  /** In each look, what stands before the sky where the clouds go (the lantern, the mast's top). */
  fore: Overlay;
  /** The clouds, back to front (`LANTERN_CLOUDS`). */
  clouds: LanternCloud[];
  /** The light in the lens, a frame for each flicker (`LIGHT_LOOKS`): a glint by day, a glow and its beam at dusk and night. */
  light: Overlay;
  /** What moves on the water (its strokes, the bands round the boulders, the glints), lit as the game runs (`paint/live.ts`). */
  water: LiveWater;
}

/** What lies under a pixel of the picture: nothing (the sky), the sea, the shingle or the meadow. */
const enum Kind { Sky = 0, Sea = 1, Shingle = 2, Meadow = 3 }

/**
 * How high the island stands over the sea, in metres (the island looks flat but the central
 * grassy part is at least 3 if not 4 metres higher than the waterline): the shingle rises from the water to its top,
 * and the meadow stands on a bank over it, drawn a little higher than true as the houses are drawn larger. The knoll
 * with the bonfire place rises a little more (a plateau that gradually rises).
 */
const RISE = { shingle: 1.6, meadow: 5.6, knoll: 1.3 } as const;
/** The bank between the shingle and the meadow: from this far outside the grass's edge to this far inside it, in metres. Broad enough that the viewer, who looks out over the meadow's lip from behind it, still sees its slope. */
const BANK = { foot: -11, lip: 3 } as const;
/** The grassy knoll with the bonfire place: its given place, the top right corner of cell L9 of the Keri grid. */
const KNOLL: WorldPoint = { x: -68, y: 10 };

type Ring = readonly (readonly [number, number])[];

/** How far a point is from a line of points (a ring when `closed`), in metres. */
function reach(line: Ring, x: number, y: number, closed: boolean): number {
  let best = Infinity;
  for (let i = closed ? 0 : 1, j = closed ? line.length - 1 : 0; i < line.length; j = i++) {
    const [ax, ay] = line[j]!, [bx, by] = line[i]!;
    const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy || 1;
    const t = clamp01(((x - ax) * dx + (y - ay) * dy) / l);
    best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy));
  }
  return best;
}

/** How far along a line of points the place nearest to a point lies, in metres from the line's start. */
function along(line: Ring, x: number, y: number): number {
  let best = Infinity, at = 0, run = 0;
  for (let i = 1; i < line.length; i++) {
    const [ax, ay] = line[i - 1]!, [bx, by] = line[i]!;
    const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy || 1;
    const t = clamp01(((x - ax) * dx + (y - ay) * dy) / l);
    const d = Math.hypot(x - ax - t * dx, y - ay - t * dy);
    if (d < best) { best = d; at = run + t * Math.sqrt(l); }
    run += Math.sqrt(l);
  }
  return at;
}

/**
 * The island on a grid of 2 m: at each crossing, the metres to the coast and to the grass's edge, counted up inside and
 * down outside, and no further than `FIELD_REACH` either way (nothing in the picture asks further).
 */
interface Field { x0: number; y0: number; cols: number; rows: number; coast: Float32Array; grass: Float32Array }
const CELL = 2;
const FIELD_REACH = 30;

function fieldOf(world: World): Field {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of world.coast) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  x0 -= 12; y0 -= 12;
  const cols = Math.ceil((x1 + 12 - x0) / CELL) + 1, rows = Math.ceil((y1 + 12 - y0) / CELL) + 1;
  const f: Field = { x0, y0, cols, rows, coast: ringField(world.coast, x0, y0, cols, rows), grass: ringField(world.grass, x0, y0, cols, rows) };
  return f;
}

/**
 * The signed distance to a ring on the grid: inside and outside row by row from where the ring crosses each row, the
 * distance only near the ring, segment by segment, over the crossings it can reach.
 */
function ringField(ring: Ring, x0: number, y0: number, cols: number, rows: number): Float32Array {
  const out = new Float32Array(cols * rows).fill(FIELD_REACH);
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, ay] = ring[j]!, [bx, by] = ring[i]!;
    const c0 = Math.max(0, Math.floor((Math.min(ax, bx) - FIELD_REACH - x0) / CELL)), c1 = Math.min(cols - 1, Math.ceil((Math.max(ax, bx) + FIELD_REACH - x0) / CELL));
    const r0 = Math.max(0, Math.floor((Math.min(ay, by) - FIELD_REACH - y0) / CELL)), r1 = Math.min(rows - 1, Math.ceil((Math.max(ay, by) + FIELD_REACH - y0) / CELL));
    const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy || 1;
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const px = x0 + c * CELL - ax, py = y0 + r * CELL - ay, t = clamp01((px * dx + py * dy) / l);
      const d = Math.hypot(px - t * dx, py - t * dy), k = r * cols + c;
      if (d < out[k]!) out[k] = d;
    }
  }
  // the sign: a crossing is inside where an odd number of the ring's edges lie left of it on its row
  for (let r = 0; r < rows; r++) {
    const y = y0 + r * CELL, cuts: number[] = [];
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i]!, [xj, yj] = ring[j]!;
      if (yi > y !== yj > y) cuts.push(((xj - xi) * (y - yi)) / (yj - yi) + xi);
    }
    cuts.sort((p, q) => p - q);
    for (let c = 0, n = 0; c < cols; c++) {
      const x = x0 + c * CELL;
      while (n < cuts.length && cuts[n]! <= x) n++;
      if (n % 2 === 0) out[r * cols + c] = -out[r * cols + c]!;
    }
  }
  return out;
}

/** A value of the field at a point, between its crossings; outside the grid, the grid's nearest edge. */
function fieldAt(f: Field, of: Float32Array, x: number, y: number): number {
  const u = Math.max(0, Math.min(f.cols - 1.001, (x - f.x0) / CELL)), v = Math.max(0, Math.min(f.rows - 1.001, (y - f.y0) / CELL));
  const c = Math.floor(u), r = Math.floor(v), a = u - c, b = v - r, i = r * f.cols + c;
  return (of[i]! * (1 - a) + of[i + 1]! * a) * (1 - b) + (of[i + f.cols]! * (1 - a) + of[i + f.cols + 1]! * a) * b;
}

/** How high the ground stands over the sea at a point, in metres. */
function riseAt(f: Field, x: number, y: number): number {
  const coast = fieldAt(f, f.coast, x, y);
  if (coast <= 0) return 0;
  const knoll = RISE.knoll * smooth(17, 5, Math.hypot(x - KNOLL.x, y - KNOLL.y));
  return RISE.shingle * smooth(0, 12, coast) + (RISE.meadow - RISE.shingle + knoll) * smooth(BANK.foot, BANK.lip, fieldAt(f, f.grass, x, y));
}

/** The ground under every pixel, asked of the world model once: what lies there, where it is and how high, how far it is from the water's edge and from a path. */
interface Ground {
  field: Field;
  kind: Uint8Array;
  gx: Float32Array;
  gy: Float32Array;
  /** Metres ahead of the eye: where this jumps from a row to the one over it, the land ends in a crest and what is seen over it lies behind and lower. */
  far: Float32Array;
  /** Metres to the coast, on either side of it. */
  shore: Float32Array;
  /** Metres to the grass's edge, counted up inside: the bank lies between `BANK.foot` and `BANK.lip`. */
  edge: Float32Array;
  /** Metres to the nearest track's middle and how far along that track, and metres to the nearest footpath's middle. */
  track: Float32Array;
  slab: Float32Array;
  foot: Float32Array;
}

/**
 * The concrete tracks as the picture paints them: the world model's, and the short way from the track's end to the
 * terrace before the house's door, which the reference photograph shows.
 */
function tracksOf(world: World): Ring[] {
  const terrace = (world.landmarks ?? []).find((l) => l.id === 'terrace');
  return world.paths.filter((p) => p.kind === 'track').map((p) => (p.id === 'track-to-lighthouse' && terrace
    ? [[terrace.x + 5, terrace.y + 1.5], [terrace.x + 9.5, terrace.y - 0.5], ...p.points]
    : p.points));
}

const GROUNDS = new WeakMap<World, Ground>();

/** The ground of the picture for a world; the same at every hour, so it is asked once. */
function groundOf(world: World, plan: LanternPlan): Ground {
  const known = GROUNDS.get(world);
  if (known) return known;
  const { w, h } = plan.fine, n = w * h;
  const big = () => new Float32Array(n).fill(999);
  const field = fieldOf(world);
  const g: Ground = { field, kind: new Uint8Array(n), gx: new Float32Array(n), gy: new Float32Array(n), far: big(), shore: big(), edge: new Float32Array(n).fill(-999), track: big(), slab: new Float32Array(n), foot: big() };
  const eye = lanternEye(world);
  const tracks = tracksOf(world), footpaths = world.paths.filter((p) => p.kind === 'footpath');
  const top = RISE.meadow + RISE.knoll + 0.2;
  for (let y = plan.horizon + 1; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    // the line of sight: straight, so two of its points give them all
    const from = lanternSight(eye, x, y, 0), step = lanternSight(eye, x, y, 1);
    const sx = step.x - from.x, sy = step.y - from.y, fall = from.up - step.up;
    const sea = from.up / fall;
    // the shore's line wavers a little, more far off, so the island's edge is lumpy and no traced line (rule 3)
    const wob = Math.min(7, sea / 34);
    const ox = from.x + (noise2(x / 23, y / 9, 311) - 0.5) * wob, oy = from.y + (noise2(x / 19, y / 11, 312) - 0.5) * wob;
    // further off than the island reaches there is only sea: no need to ask
    let far = sea;
    if ((from.up - top) / fall < 470) {
      // out from the eye until the line goes under the ground, then halved down to the place
      let near = Math.max(0, (from.up - top) / fall);
      const stride = (sea - near) / 40, across = Math.hypot(sx, sy);
      while (near < sea) {
        // over the sea the line may stride as far as the coast is: it cannot meet the land sooner
        const out = -fieldAt(field, field.coast, ox + sx * near, oy + sy * near);
        const t = Math.min(sea, near + Math.max(stride, out > 1 ? (out - 0.5) / across : 0));
        if (from.up - t * fall <= riseAt(field, ox + sx * t, oy + sy * t)) { far = t; break; }
        near = t;
      }
      for (let k = 0; k < 7; k++) {
        const t = (near + far) / 2;
        if (from.up - t * fall <= riseAt(field, ox + sx * t, oy + sy * t)) far = t; else near = t;
      }
    }
    const q = { x: ox + sx * far, y: oy + sy * far };
    g.gx[i] = q.x; g.gy[i] = q.y; g.far[i] = far;
    if (sea > 470 && far === sea) { g.kind[i] = Kind.Sea; continue; }
    // the field knows the way to the coast well enough, and nothing in the picture asks further than it reaches; right
    // at the water's edge the coast itself is asked
    const coast = fieldAt(field, field.coast, q.x, q.y);
    const land = coast > 0.6 || (coast > -0.6 && insideRing(world.coast, q));
    g.shore[i] = Math.abs(coast) > 0.6 ? Math.abs(coast) : reach(world.coast, q.x, q.y, true);
    if (!land) { g.kind[i] = Kind.Sea; continue; }
    g.edge[i] = fieldAt(field, field.grass, q.x, q.y);
    // the meadow's edge is ragged with blade tips: each pixel asks a little off its place
    const j = { x: q.x + (hash2(x, y, 313) - 0.5) * 1.6, y: q.y + (hash2(x, y, 314) - 0.5) * 1.6 };
    g.kind[i] = insideRing(world.grass, j) ? Kind.Meadow : Kind.Shingle;
    for (const t of tracks) {
      const d = reach(t, q.x, q.y, false);
      if (d < g.track[i]!) { g.track[i] = d; g.slab[i] = d < 3 ? along(t, q.x, q.y) + t.length * 37 : 0; }
    }
    for (const t of footpaths) g.foot[i] = Math.min(g.foot[i]!, reach(t.points, q.x, q.y, false));
  }
  GROUNDS.set(world, g);
  return g;
}

/** A point on the picture. */
interface Pt { x: number; y: number }

/** A ground point on the picture and the fine pixels a metre takes there. */
interface Seat extends Pt { s: number }

/** A gable on the picture: the wall's feet and tops, the peak, the roof's edges over the walls. */
interface Gable { footL: Pt; footR: Pt; topL: Pt; topR: Pt; peak: Pt; overL: Pt; overR: Pt }

/** A house seen along its ridge (`shack`), in metres as drawn. */
interface Shack {
  /** The middle of the gable's foot toward the viewer, and of the far gable's. */
  near: Seat;
  far: Seat;
  /** The gable's width, the wall's height, the roof's rise over it, how far the roof hangs over the walls. */
  wide: number;
  wall: number;
  rise: number;
  eave: number;
  /** How far the top leans (pixels for each pixel up), how far the peak stands off the middle (a share of the half width), how many pixels the ridge sags. */
  lean: number;
  skew: number;
  sag: number;
  walls: readonly number[];
  /** Boards as planks, or plaster with bare stone. */
  boards: boolean;
  roof: readonly number[];
  /** Sheets or strokes along the roof, and the colour of the rust or lichen streaked down a few (-1 for none). */
  sheets: number;
  streak: number;
  /** Windows on the gable: where across it (-1 to 1), how high up the wall (a share; over 1 is the attic), its panes' width and height in pixels. */
  windows: readonly (readonly [number, number, number, number])[];
  /** A door on the gable: where across it, or null. */
  door: number | null;
  /** Chimneys on the ridge: how far along it (0 the viewer's end), width and height in pixels, lean. */
  chimneys: readonly (readonly [number, number, number, number])[];
  lit: boolean;
  seed: number;
}

/** How far the well house is drawn off its place in the world model, in metres east and north: nearer the viewer and to the left, clear of the house. */
const WELL_SHIFT = { x: 10.1, y: -9.8 } as const;

class LanternPainter {
  readonly palette: readonly number[];
  readonly sky: SkyMask;
  private readonly hour: Hour & (typeof LIGHT)[SkyPhase];
  private readonly w: number;
  private readonly h: number;
  private readonly hz: number;
  private readonly eye: WorldPoint;
  private readonly ground: Ground;
  private px: Uint8Array = new Uint8Array(0);
  /** Which thing painted each pixel (0 the sky, the sea and the bare ground): the ink outlines go where things meet. */
  private owner: Uint16Array = new Uint16Array(0);
  private thing = 0;
  /** The runs lit air lifts a colour along. */
  private readonly liftRuns: readonly (readonly number[])[] = [F.iron, F.stone, F.shingle, F.grass, F.dry, F.bush, F.plaster, F.tin, F.boards, F.wood, F.far, F.near];
  /** The beam's pale blues, dark to light: the sea's lighter half and then the shingle's, paler than any the night's sea has. */
  private readonly beamRun: readonly number[] = [...F.sea.slice(5), ...F.shingle.slice(4, 8)];
  /** The first thing of the lantern: what is numbered from here on is the lantern's own iron and glass. */
  private cage = 0;
  private things = 0;
  private stands: SeaStand[] = [];
  /** What moves on the water, recorded in the first look (`paint/live.ts`). */
  private readonly live: LiveRecorder;
  water: LiveWater | null = null;
  private readonly darkest = new Map<number, number>();
  private readonly lit = new Map<number, number>();

  constructor(private readonly world: World, private readonly plan: LanternPlan, phase: SkyPhase) {
    this.w = plan.fine.w;
    this.h = plan.fine.h;
    this.hz = plan.horizon;
    this.hour = { ...KERI_HOURS[phase], ...LIGHT[phase] };
    this.palette = lanternPalette(phase);
    this.eye = lanternEye(world);
    this.ground = groundOf(world, plan);
    this.sky = new SkyMask(this.w, this.h);
    this.live = new LiveRecorder(this.w, this.h, () => this.px, this.hz, LANTERN_WAY, R.foam);
    for (const run of Object.values(F)) for (const c of run) if (!this.darkest.has(c)) {
      this.darkest.set(c, run[0]!);
      this.lit.set(c, run[Math.max(0, run.length - 2)]!);
    }
  }

  private as(draw: () => void): void {
    const was = this.thing;
    this.thing = ++this.things;
    draw();
    this.thing = was;
  }

  /** The ink line of the 1991 game: where a thing lies over what was painted before it, its edge pixel takes the darkest tone of its own colour; at night the moon catches its top and its left edge. */
  private outline(): void {
    const { w, h, px, owner } = this;
    const edge: number[] = [], rim: number[] = [];
    const moonlit = this.hour.night;
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x, a = owner[i]!;
      if (a === 0) continue;
      for (const [d, o] of [[-w, w], [1, -1], [-1, 1], [w, -w]] as const) {
        const b = owner[i + d]!;
        if (b < a && owner[i + o] === a) { (moonlit && (d === -w || d === -1) ? rim : edge).push(i); break; }
      }
    }
    for (const i of edge) px[i] = this.darkest.get(px[i]!) ?? px[i]!;
    for (const i of rim) px[i] = this.lit.get(px[i]!) ?? px[i]!;
  }

  private put(x: number, y: number, c: number): void {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.px[y * this.w + x] = c;
    this.owner[y * this.w + x] = this.thing;
    this.sky.put(y * this.w + x);
  }

  private at(x: number, y: number): number {
    x = Math.round(x); y = Math.round(y);
    return x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : this.px[y * this.w + x]!;
  }

  private kind(x: number, y: number): Kind {
    x = Math.round(x); y = Math.round(y);
    return x < 0 || y < 0 || x >= this.w || y >= this.h ? Kind.Sky : (this.ground.kind[y * this.w + x] as Kind);
  }

  /** Where a point of the world lands, `up` metres over the ground it stands on. */
  private project(p: WorldPoint, up = 0): Pt & { far: number } {
    return lanternProject(this.eye, p, up + riseAt(this.ground.field, p.x, p.y));
  }

  cloud(spec: CurlSpec): Bitmap {
    return tintedCloud(spec, false, R.cloud);
  }

  private brush(look: number): KitBrush {
    return {
      put: (x, y, c) => this.put(x, y, c), run: R, fine: F, hour: this.hour, side: this.hour.side,
      sway: (phase) => swing(look, LANTERN_FRAMES, phase), beat: look / LANTERN_FRAMES, live: this.live,
      under: (x, y) => {
        const px = Math.round(x), py = Math.round(y);
        if (px < 0 || py < 0 || px >= this.w || py >= this.h) return undefined;
        const i = py * this.w + px;
        return { colour: this.px[i]!, thing: this.owner[i] !== 0 || this.ground.kind[i] !== Kind.Sea };
      },
    };
  }

  // ---- the sky

  private paintSky(): void {
    const { w, hz, hour } = this;
    this.sky.sky = true;
    for (let x = 0; x < w; x++) for (let y = 0; y <= hz; y++) {
      let t = Math.min(1, Math.pow(y / hz, 0.85));
      // a low sun warms the sky's foot on its side, in the same bands
      if (hour.warm !== 0) t += 0.3 * clamp01(hour.warm > 0 ? (x - w * 0.3) / (w * 0.7) : 1 - Math.abs(x - SUNSET) / (w * 0.62)) * (y / hz) ** 2 - 0.12;
      // long level strokes of the brush, a place or two along the run
      t += (fbm(x / 90, y / 4, 2, 301) - 0.5) * 0.1;
      this.put(x, y, tone(F.sky, clamp01(t), x, y, 0.25));
    }
    if (hour.night) this.stars();
    if (hour.warm < 0) this.sun();
    this.sky.sky = false;
    // the haze over the far water
    for (let x = 0; x < w; x++) this.put(x, hz - 1, R.sky[4]!);
  }

  /** The setting sun, half sunk in the sea: a flat disc with one ragged ring of the sky's palest tone. */
  private sun(): void {
    const { hz } = this;
    for (let dy = -14; dy <= 0; dy++) for (let dx = -14; dx <= 14; dx++) {
      const far = Math.hypot(dx, dy * 1.1);
      if (far <= 8) this.put(SUNSET + dx, hz - 1 + dy, R.moon[0]!);
      else if (far < 10.5 + 1.5 * hash2(Math.round(Math.atan2(dy, dx) * 6), 1, 302)) this.put(SUNSET + dx, hz - 1 + dy, R.sky[4]!);
    }
  }

  private stars(): void {
    const { w, hz } = this;
    for (let gy = 0; gy < hz - 8; gy += 8) for (let gx = 0; gx < w; gx += 9) {
      const pick = hash2(gx, gy, 321);
      if (pick > 0.42) continue;
      const x = gx + Math.floor(hash2(gx, gy, 322) * 9), y = gy + Math.floor(hash2(gx, gy, 323) * 8);
      this.put(x, y, pick < 0.14 ? R.star[0]! : R.star[1]!);
      if (pick < 0.035) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) this.put(x + dx, y + dy, R.star[1]!);
    }
    for (let dy = -MOON.r - 9; dy <= MOON.r + 9; dy++) for (let dx = -MOON.r - 9; dx <= MOON.r + 9; dx++) {
      const far = Math.hypot(dx, dy), x = MOON.x + dx, y = MOON.y + dy;
      if (far <= MOON.r) this.put(x, y, Math.hypot(dx - 3, dy + 3) < MOON.r * 0.55 || hash2(x >> 1, y >> 1, 324) > 0.86 ? R.moon[1]! : R.moon[0]!);
      else if (far < MOON.r + 3.5 + 1.5 * hash2(Math.round(Math.atan2(dy, dx) * 6), 1, 325)) this.put(x, y, R.sky[4]!);
    }
  }

  // ---- the sea

  /** The sea's ground for the kit's water: the shallows are drawn five times as broad as true, a pale band round the island that reads from up here. */
  private seaGround(): SeaGround {
    const { w, h, hz, ground } = this;
    return {
      width: w,
      height: h,
      horizon: hz,
      glint: this.hour.glint,
      stands: this.stands,
      place: (x, y) => {
        const i = Math.round(y) * w + Math.round(x);
        return ground.kind[i] === Kind.Sea ? { shore: ground.shore[i]! / 5, gx: ground.gx[i]! / 5, gz: ground.gy[i]! / 5 } : null;
      },
      // at night one broad plane of the far water catches the moon, in two flat bands
      moon: (x, y) => {
        const depth = y - hz, wobble = 10 * (fbm(x / 30, depth / 5, 2, 331) - 0.5);
        // strongest under the moon, and never gone: the far water right of the lantern keeps a paler band too
        return Math.max(0.6, smooth(MOON_WATER.to, MOON_WATER.from, x + wobble * 2)) * smooth(8, 20, depth + wobble) * smooth(84, 56, depth + wobble);
      },
    };
  }

  private seaOptions(): SeaOptions {
    return optionsOf(sea, undefined, { band: 26, way: LANTERN_WAY });
  }

  /** Glints where the sun or the moon lies on the water, each flashing on its own beat as the game runs (`paint/live.ts`). */
  private seaLights(): void {
    const { w, hz, hour } = this;
    if (hour.glint < 0) return;
    for (let gy = hz + 2; gy < hz + 70; gy++) for (let gx = Math.max(0, hour.glint - 110); gx < Math.min(w, hour.glint + 110); gx++) {
      if (this.kind(gx, gy) !== Kind.Sea || this.owner[gy * w + gx] !== 0) continue;
      const near = Math.exp(-(((gx - hour.glint) / (10 + (gy - hz) * 0.9)) ** 2));
      if (hash2(gx, gy, 341) > 1 - 0.3 * near) {
        const glint = hour.night ? R.moon[0]! : R.cloud[0]!, beat = hash2(gx, gy, 342);
        this.live.glint(gx, gy, glint, beat);
        if (hash2(gx, gy, 343) > 0.4) this.live.glint(gx + 1, gy, glint, beat);
      }
    }
  }

  // ---- the island's ground

  /**
   * The shingle, the bank, the meadow and the paths, pixel by pixel from the world model. The meadow stands on a bank
   * over the shingle: where the land ends in a crest against what lies lower behind it, the turf's lip catches the light.
   */
  private paintLand(): void {
    const { w, h, hz, ground, hour } = this;
    // the side the light comes from, as a step on the ground (metres east and north): swells are lit on that side
    const turn = ((LANTERN.heading + 90 * Math.sign(hour.side || -1)) * Math.PI) / 180;
    const toLight = { x: Math.sin(turn) * 5, y: Math.cos(turn) * 5 };
    const swell = (x: number, y: number) => fbm(x / 24, y / 24, 3, 351);
    for (let y = hz + 1; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, kind = ground.kind[i] as Kind;
      if (kind !== Kind.Shingle && kind !== Kind.Meadow) continue;
      const gx = ground.gx[i]!, gy = ground.gy[i]!, shore = ground.shore[i]!, edge = ground.edge[i]!;
      const track = ground.track[i]!;
      // the concrete track, worn: slab after slab (the paths' note), a little wider than true so it reads from up here
      if (kind === Kind.Meadow && track < 1.3 + (noise2(gx / 1.6, gy / 1.6, 359) - 0.5) * 0.7) { this.put(x, y, this.slabTone(x, y, track, ground.slab[i]!)); continue; }
      if (edge > BANK.foot && edge < BANK.lip + (noise2(gx / 2.1, gy / 2.1, 365) - 0.5) * 0.9) { this.put(x, y, this.bankTone(x, y, gx, gy, smooth(BANK.foot, BANK.lip, edge), toLight)); continue; }
      if (kind === Kind.Shingle) {
        if (shore < 1.4) { this.put(x, y, hash2(x, y, 352) > 0.5 ? R.shingle[0]! : R.stone[1]!); continue; }
        // the wrack line the sea left: dark dried weed in a broken line
        if (shore > 3 && shore < 5.2 + noise2(gx / 6, gy / 6, 353) && fbm(gx / 2.2, gy / 2.2, 2, 354) > 0.58 && hash2(x, y, 355) > 0.3) { this.put(x, y, hash2(x >> 1, y, 356) > 0.5 ? R.wood[0]! : R.wood[1]!); continue; }
        // pale stones in flat bands that follow the shore, a darker dash here and there
        const band = fbm(gx / 13, gy / 13, 2, 357);
        // dry and pale high on the beach, a step darker down toward the water: the beach slopes
        const t = Math.round((0.1 + 0.5 * smooth(0.2, 0.8, band) + 0.3 * smooth(4, 26, shore)) * 4) / 4;
        this.put(x, y, hash2(x >> 1, y, 358) > 0.9 ? R.stone[2]! : tone(PEBBLE, t, x, y, 0.25));
        continue;
      }
      if (ground.foot[i]! < 0.55 && hash2(x, y, 360) > 0.25) { this.put(x, y, hash2(x, y >> 1, 361) > 0.5 ? R.dry[1]! : R.shingle[2]!); continue; }
      // the meadow: swells of light and dark, lit on the light's side, in flat steps; dry gold where the ground is thin
      const lift = swell(gx, gy), slope = lift - swell(gx - toLight.x, gy - toLight.y);
      // and the ground's own rises (the knoll) are lit on that side too
      const relief = riseAt(ground.field, gx, gy) - riseAt(ground.field, gx - toLight.x * 0.8, gy - toLight.y * 0.8);
      const light = clamp01(0.5 + slope * 4.5 + (lift - 0.5) * 0.5 - relief * 0.7);
      // the lip over the bank catches the light
      const step = edge < BANK.lip + 1.6 ? 1 : Math.round(light * 4) / 4;
      const dry = fbm(gx / 31, gy / 31, 3, 362) + (edge < BANK.lip + 4 ? 0.1 : 0);
      // broken marks: a pixel now and then a step off its band
      const mark = (hash2(x, y, 363) > 0.72 ? 0.16 : 0) - (hash2(x >> 1, y, 364) > 0.8 ? 0.16 : 0);
      if (dry > 0.6) this.put(x, y, tone(TURF_DRY, clamp01(0.15 + step * 0.75 + mark), x, y, 0));
      else this.put(x, y, tone(TURF, clamp01(0.12 + step * 0.72 + mark), x, y, 0));
    }
    this.crests();
  }

  /**
   * A slab of the concrete track: each its own length and its own pale tone, a dark joint between two, its shade side
   * and its worn edges a tone darker, a tuft in a joint now and then (the paths' note: stones, never one even band).
   */
  private slabTone(x: number, y: number, off: number, run: number): number {
    const u = run / 3.3 + (noise2(run / 6, 1, 366) - 0.5) * 0.9, k = Math.floor(u), f = u - k;
    if (f < 0.13) return hash2(k, 2, 367) > 0.6 ? R.grass[1]! : R.stone[1]!;
    const pale = hash2(k, 3, 367), worn = off > 0.9 || f > 0.9 ? 1 : 0;
    const crack = hash2(k, 4, 367) > 0.7 && Math.abs(f - 0.5 - (off - 0.6) * 0.3) < 0.05;
    if (crack) return R.stone[2]!;
    return [R.stone[3]!, R.shingle[2]!, R.shingle[3]!, R.stone[4]!][Math.max(0, Math.min(3, (pale > 0.66 ? 3 : pale > 0.25 ? 2 : 1) - worn - (hash2(x >> 1, y, 368) > 0.88 ? 1 : 0)))]!;
  }

  /**
   * The bank the meadow stands on (`t` 0 at its foot on the shingle, 1 at its lip), as the reference photograph shows it
   * on the island's left: a dark slope of low scrub and rough grass, earth and stones showing through, pebbles and
   * tufts at its foot; lighter where it faces the light.
   */
  private bankTone(x: number, y: number, gx: number, gy: number, t: number, toLight: WorldPoint): number {
    const f = this.ground.field;
    // which way the bank faces: down the grass's own slope
    const dx = fieldAt(f, f.grass, gx - 1.5, gy) - fieldAt(f, f.grass, gx + 1.5, gy), dy = fieldAt(f, f.grass, gx, gy - 1.5) - fieldAt(f, f.grass, gx, gy + 1.5);
    const lit = (dx * toLight.x + dy * toLight.y) / (Math.hypot(dx, dy) * Math.hypot(toLight.x, toLight.y) || 1) > -0.1;
    const u = t + (noise2(gx / 1.8, gy / 1.8, 369) - 0.5) * 0.24;
    const blot = fbm(gx / 2.8, gy / 2.8, 2, 372);
    // its foot: the shingle's darker stones, tufts among them
    if (u < 0.22) return blot < 0.36 ? R.grass[1]! : blot > 0.56 ? R.stone[2]! : hash2(x >> 1, y, 371) > 0.5 ? R.shingle[0]! : R.stone[1]!;
    if (blot > 0.68) return lit ? R.stone[3]! : R.stone[2]!;
    if (blot > 0.58 && u < 0.7) return lit ? R.dry[0]! : R.wood[1]!;
    // under the lip rough grass a step darker than the meadow; lower down low scrub, dark, a lit leaf here and there
    if (u > 0.72 || blot < 0.3) return lit ? R.grass[u > 0.86 ? 3 : 2]! : R.grass[1]!;
    return lit && hash2(x, y, 370) > 0.86 ? R.bush[3]! : hash2(x >> 1, y >> 1, 373) > 0.55 ? R.bush[2]! : R.bush[1]!;
  }

  /** Where the land ends against what lies further off and lower (the bank's far side is hidden): the lip of the turf in its light, a blade standing over it here and there. */
  private crests(): void {
    const { w, h, hz, ground } = this;
    for (let y = hz + 2; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (ground.kind[i] === Kind.Sea || ground.edge[i]! < BANK.foot + 2) continue;
      const far = ground.far[i]!;
      if (ground.far[i - w]! - far < 3 + far * 0.035) continue;
      // the 1991 game's contour: a dark line where the land stops, the lit lip under it, a blade over it here and there
      this.put(x, y, R.near[1]!);
      this.put(x, y + 1, hash2(x, y, 374) > 0.3 ? R.grass[4]! : R.dry[2]!);
      if (hash2(x, y, 376) > 0.7) this.put(x, y - 1, R.grass[hash2(x, y, 377) > 0.5 ? 1 : 2]!);
    }
  }

  // ---- the stones of the shore

  /**
   * The boulders of Keri's shore (the reference photographs: the shallows and the shingle strewn with them, a bundle of
   * big ones by the helicopter pad), each where the coast is, drawn larger than true. Placed by a fixed scatter along
   * the coast: where exactly each one lies is not known.
   */
  private rocks(): { p: WorldPoint; r: number; wet: boolean; seed: number }[] {
    const out: { p: WorldPoint; r: number; wet: boolean; seed: number }[] = [];
    const { coast, grass } = this.world;
    for (let k = 0; k < 260; k++) {
      const [cx, cy] = coast[Math.floor(hash2(k, 1, 371) * coast.length)]!;
      const p = { x: cx + (hash2(k, 2, 371) - 0.5) * 38, y: cy + (hash2(k, 3, 371) - 0.5) * 38 };
      if (insideRing(grass, p)) continue;
      out.push({ p, r: 0.8 + hash2(k, 4, 371) ** 3 * 3.4, wet: !insideRing(coast, p), seed: k });
    }
    // the bundle of big boulders by the helicopter pad
    for (let k = 0; k < 5; k++) out.push({ p: { x: -250 + (hash2(k, 5, 372) - 0.5) * 16, y: 100 + (hash2(k, 6, 372) - 0.5) * 12 }, r: 2.6 + hash2(k, 7, 372) * 1.6, wet: false, seed: 900 + k });
    return out;
  }

  private placeRocks(look: number, rocks: readonly { p: WorldPoint; r: number; wet: boolean; seed: number }[]): void {
    const brush = this.brush(look);
    const laid = rocks.map((r) => ({ ...r, at: this.project(r.p) })).filter((r) => r.at.far > 40 && r.at.y < this.h + 4 && r.at.x > -20 && r.at.x < this.w + 20).sort((a, b) => b.at.far - a.at.far);
    for (const r of laid) {
      const wide = (LANTERN.lens * r.r * 1.5) / r.at.far, high = wide * 0.85;
      this.as(() => {
        if (wide >= 5) boulder.paint(brush, r.at.x, Math.round(r.at.y), optionsOf(boulder, undefined, { wide, high, wet: r.wet, dark: 0 }), r.seed);
        else this.pebbleRock(r.at.x, Math.round(r.at.y), Math.max(1.2, wide), r.wet, r.seed);
      });
    }
  }

  /** A far boulder, too small for its lumps to show: one flat lump of three tones, pale on top and toward the light, dark under. */
  private pebbleRock(cx: number, foot: number, wide: number, wet: boolean, seed: number): void {
    const high = Math.max(1, wide * 0.8);
    for (let y = -Math.ceil(high); y <= 0; y++) for (let x = -Math.ceil(wide * 1.3); x <= Math.ceil(wide * 1.3); x++) {
      if ((x / (wide * 1.3)) ** 2 + ((y + high * 0.2) / high) ** 2 > 1 + 0.2 * (hash2(x + seed, y, 373) - 0.5)) continue;
      const top = y < -high * 0.45, lit = x * this.hour.side > 0;
      this.put(cx + x, foot + y, y === 0 ? (wet ? R.near[1]! : R.stone[0]!) : top && lit ? R.stone[3]! : top || lit ? R.stone[2]! : R.stone[1]!);
    }
  }

  /** The boulders standing in the water, as the picture shows them: the sea's pale bands curl round them. */
  private standing(rocks: readonly { p: WorldPoint; r: number; wet: boolean }[]): SeaStand[] {
    const out: SeaStand[] = [];
    for (const r of rocks) {
      if (!r.wet) continue;
      const at = this.project(r.p), wide = (LANTERN.lens * r.r * 1.5) / at.far;
      if (at.far > 40 && wide >= 4 && at.x > -20 && at.x < this.w + 20 && at.y < this.h) out.push({ x: at.x, y: at.y, r: wide, leg: false });
    }
    return out;
  }

  // ---- the houses

  private quad(pts: readonly Pt[], colour: (x: number, y: number) => number): void {
    fillQuad((x, y, c) => this.put(x, y, c), pts, this.w, this.h, colour);
  }

  private line(a: Pt, b: Pt, c: number): void {
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y)));
    for (let i = 0; i <= n; i++) this.put(a.x + ((b.x - a.x) * i) / n, a.y + ((b.y - a.y) * i) / n, c);
  }

  /** A ground point on the picture, and how many fine pixels a metre is there. */
  private seat(p: WorldPoint): Seat {
    const at = this.project(p);
    return { x: at.x, y: at.y, s: LANTERN.lens / at.far };
  }

  /** The two gables of a house of the world model on the picture: the one toward the viewer stays where it stands, and the house is drawn `grand` times as long behind it (so a fat house never steps on what stands before it). */
  private ends(id: string, grand: number): { near: Seat; far: Seat } {
    const b = this.world.buildings.find((h) => h.id === id)!;
    const a = (b.angle * Math.PI) / 180, ux = Math.cos(a), uy = Math.sin(a);
    const toward = (this.eye.x - b.x) * ux + (this.eye.y - b.y) * uy > 0 ? 1 : -1;
    const near = { x: b.x + (ux * toward * b.long) / 2, y: b.y + (uy * toward * b.long) / 2 };
    return { near: this.seat(near), far: this.seat({ x: near.x - ux * toward * b.long * grand, y: near.y - uy * toward * b.long * grand }) };
  }

  /** A gable of a shack on the picture: the wall's two feet, its two tops under the eaves, the peak, and the roof's two edges hanging over the walls. Nothing plumb: the wall is broader at its foot, the top leans, each point a hair off. */
  private gable(o: Shack, e: Seat, k: number): Gable {
    const off = (i: number) => (hash2(i, k, o.seed) - 0.5) * 1.3;
    const half = (o.wide / 2) * e.s, wall = o.wall * e.s, rise = o.rise * e.s, over = o.eave * e.s;
    const lean = (up: number) => o.lean * up;
    const pt = (x: number, up: number, i: number): Pt => ({ x: e.x + x + lean(up) + off(i), y: e.y - up + off(i + 7) * 0.5 });
    const drop = (over * rise) / half;
    return {
      footL: pt(-half * 1.07, 0, 1), footR: pt(half * 1.07, 0, 2), topL: pt(-half, wall, 3), topR: pt(half, wall, 4),
      peak: pt(half * o.skew, wall + rise, 5), overL: pt(-half - over, wall - drop, 6), overR: pt(half + over, wall - drop, 8),
    };
  }

  /** A wall's colour: plaster in flat bands (shade under the eaves, a dark foot, bare stone where it fell off) or boards as planks, each its own tone. */
  private wallTone(o: Shack, light: number, top: Pt, foot: Pt): (x: number, y: number) => number {
    return (x, y) => {
      const down = clamp01((y - top.y) / Math.max(1, foot.y - top.y)) + (noise2(x / 3, y / 5, o.seed + 2) - 0.5) * 0.2;
      if (o.boards) {
        const plank = Math.floor((x + (y > (top.y + foot.y) / 2 ? 1 : 0)) / 3);
        if ((Math.round(x) + 300) % 3 === 0 && hash2(plank, Math.round(y / 5), o.seed + 3) > 0.25) return o.walls[0]!;
        return tone(o.walls, clamp01(Math.round((light + (down < 0.16 ? -0.3 : 0) + (hash2(plank, 1, o.seed + 4) - 0.5) * 0.36) * 4) / 4), x, y, 0);
      }
      if (down > 0.86) return R.stone[hash2(Math.round(x / 3), Math.round(y / 2), o.seed + 5) > 0.5 ? 1 : 2]!;
      if (noise2(x / 6, y / 5, o.seed + 6) > 0.72) return R.stone[hash2(Math.round(x / 2), Math.round(y / 2), o.seed + 7) > 0.5 ? 3 : 2]!;
      const band = down < 0.18 ? -0.32 : 0;
      return tone(o.walls, clamp01(Math.round((light + band + (noise2(x / 7, y / 4, o.seed) - 0.5) * 0.2) * 3) / 3), x, y, 0);
    };
  }

  /** A roof plane's colour between its ridge (`from` to `to`) and its eave (`down` from the ridge's start): sheets or strokes down the slope, each its own tone, a pale ridge, a dark eave. */
  private roofTone(o: Shack, light: number, from: Pt, to: Pt, down: Pt): (x: number, y: number) => number {
    const rx = to.x - from.x, ry = to.y - from.y, sx = down.x - from.x, sy = down.y - from.y, det = rx * sy - ry * sx || 1;
    return (x, y) => {
      const px = x - from.x, py = y - from.y;
      const u = ((px * sy - py * sx) / det) * o.sheets, v = (rx * py - ry * px) / det;
      const sheet = Math.floor(u + (noise2(v * 3, 1, o.seed + 8) - 0.5) * 0.25);
      if (v > 0.9) return o.roof[0]!;
      if (u - Math.floor(u) < 0.16 && hash2(sheet, Math.round(v * 5), o.seed + 9) > 0.2) return o.roof[Math.max(0, Math.round((light - 0.3) * (o.roof.length - 1)))]!;
      // a sheet a tone off its neighbours; rust or lichen in a streak down a few
      if (o.streak >= 0 && hash2(sheet, 2, o.seed + 10) > 0.6 && v > 0.25 + hash2(sheet, 3, o.seed + 10) * 0.5) return o.streak;
      return tone(o.roof, clamp01(Math.round((light + (hash2(sheet, 4, o.seed + 11) - 0.5) * 0.34 + (v < 0.14 ? 0.2 : 0)) * 4) / 4), x, y, 0);
    };
  }

  /** A window: dark panes in a pale frame with a bar across; its panes burn when the house is lit. */
  private window(cx: number, top: number, wide: number, high: number, lit: boolean): void {
    for (let y = -1; y <= high; y++) for (let x = -1; x <= wide; x++) {
      const frame = y < 0 || y === high || x < 0 || x === wide || (wide > 3 && x === Math.floor(wide / 2)) || (high > 4 && y === Math.floor(high / 2));
      this.put(cx - wide / 2 + x, top + y, frame ? R.plaster[3]! : lit ? (y < high / 2 ? R.ember[4]! : R.ember[3]!) : hash2(x, y, 381) > 0.8 ? R.sea[1]! : R.stone[0]!);
    }
    for (let x = -2; x <= wide + 1; x++) this.put(cx - wide / 2 + x, top + high + 1, R.plaster[1]!);
  }

  /** A chimney on a ridge: fat, of brick, leaning its own way, a dark cap broader than its neck. */
  private chimney(at: Pt, wide: number, tall: number, lean: number): void {
    const sun = this.hour.side;
    for (let dy = 0; dy <= tall; dy++) for (let dx = 0; dx < wide; dx++) {
      const x = at.x - wide / 2 + dx + lean * dy, y = at.y + 1 - dy;
      this.put(x, y, dy % 3 === 2 && hash2(dx, dy, 382) > 0.3 ? R.iron[1]! : (dx - (wide - 1) / 2) * sun > 0 ? R.iron[3]! : R.iron[2]!);
    }
    for (let dx = -1; dx <= wide; dx++) { this.put(at.x - wide / 2 + dx + lean * tall, at.y - tall, R.stone[1]!); this.put(at.x - wide / 2 + dx + lean * tall, at.y - tall - 1, dx * sun > 0 ? R.stone[3]! : R.stone[2]!); }
  }

  /**
   * A house as the 1991 game would draw it from up here (the buildings did not look like that game's,
   * just bland boxes with no character): seen along its ridge, its gable toward the viewer broader at the foot
   * and leaning, a roof too big for it that hangs over the walls and sags, sheets or strokes each in its own tone, fat
   * crooked chimneys, framed windows that burn at dusk, a door, and every part its own thing with an ink edge.
   */
  private shack(o: Shack): void {
    const n = this.gable(o, o.near, 1), f = this.gable(o, o.far, 2);
    const sun = this.hour.side, face = this.hour.face;
    const mid = (a: Pt, b: Pt, t = 0.5, sag = 0): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t + sag });
    const ridge = (t: number): Pt => mid(n.peak, f.peak, t, o.sag * Math.sin(Math.PI * t));
    // the long walls: one of them shows beside the gable, whichever the viewer is off to
    this.as(() => {
      this.quad([n.footL, n.topL, f.topL, f.footL], this.wallTone(o, clamp01(0.4 - sun * 0.2 + face), f.topL, n.footL));
      this.quad([n.footR, n.topR, f.topR, f.footR], this.wallTone(o, clamp01(0.4 + sun * 0.2 + face), f.topR, n.footR));
    });
    // the roof's two planes, each in two parts about the sagging ridge
    const half = ridge(0.5);
    for (const [side, nOver, fOver] of [[-1, n.overL, f.overL], [1, n.overR, f.overR]] as const) this.as(() => {
      const light = clamp01(0.52 + side * (sun || -0.4) * 0.5 + face * 0.5);
      const eave = mid(nOver, fOver, 0.5, o.sag * 0.6), paint = this.roofTone(o, light, n.peak, f.peak, nOver);
      this.quad([nOver, n.peak, half, eave], paint); this.quad([eave, half, f.peak, fOver], paint);
    });
    this.line(n.peak, half, o.roof[o.roof.length - 1]!); this.line(half, f.peak, o.roof[o.roof.length - 1]!);
    for (const [t, wide, tall, lean] of o.chimneys) this.as(() => this.chimney(ridge(t), wide, tall, lean));
    // the gable toward the viewer, the roof's edge over it as a fat board
    this.as(() => {
      const paint = this.wallTone(o, clamp01(0.7 + face), n.peak, n.footL);
      this.quad([n.footL, n.footR, n.topR, n.topL], paint); this.quad([n.topL, n.topR, n.peak, n.peak], paint);
      const high = n.footL.y - n.topL.y, lit = o.lit && lampLit(this.brush(0));
      for (const [across, up, w, h] of o.windows) this.window(mid(n.footL, n.footR, 0.5 + across / 2).x + o.lean * up * high, n.footL.y - up * high - h, w, h, lit);
      if (o.door !== null) {
        const dx = mid(n.footL, n.footR, 0.5 + o.door / 2).x, tall = Math.round(high * 0.62);
        for (let y = 0; y <= tall; y++) for (let x = -2; x <= 2; x++) this.put(dx + x, n.footL.y - y, y === tall || Math.abs(x) === 2 ? R.wood[1]! : x === 1 && y === Math.round(tall / 2) ? R.wood[5]! : R.wood[y % 3 === 0 ? 2 : 3]!);
      }
    });
    this.as(() => {
      for (const [from, d] of [[n.overL, 0], [n.overR, 0], [n.overL, 1], [n.overR, 1]] as const) this.line({ x: from.x, y: from.y + d }, { x: n.peak.x, y: n.peak.y + d }, d ? o.roof[0]! : o.roof[o.roof.length - 1]!);
      // the peak's board sticks out over the ridge's end
      for (let k = 0; k < 3; k++) this.put(n.peak.x + (k - 1) * (o.skew > 0 ? -1 : 1), n.peak.y - k, o.roof[0]!);
    });
  }

  private houses(look: number): void {
    this.as(() => this.powerStation());
    this.as(() => this.mast());
    this.shack({
      ...this.ends('warden-house', 1.25), wide: 15.6, wall: 7, rise: 7.6, eave: 1.3, lean: -0.05, skew: 0.06, sag: 3,
      walls: F.plaster, boards: false, roof: F.tin, sheets: 9, streak: R.iron[3]!,
      windows: [[-0.44, 0.34, 5, 6], [0.42, 0.3, 5, 6], [0.02, 1.14, 3, 4]], door: null,
      chimneys: [[0.22, 5, 9, 0.16], [0.66, 4, 7, -0.2]], lit: true, seed: 499,
    });
    this.terrace();
    this.as(() => this.flagpole(look));
    this.wellHouse();
    this.sauna();
  }

  /** The power station behind the warden's house (the grey flat building is the power station): a low grey block with a flat roof, kept quiet, its look from near not known (`KERI-TODO` in the scene's notes). */
  private powerStation(): void {
    const { near, far } = this.ends('north-shed', 1.2);
    const half = 3.6 * near.s, high = 3.4 * near.s, back = 3.6 * far.s;
    const top = (e: Seat, side: number, w: number): Pt => ({ x: e.x + side * w, y: e.y - high * (e.s / near.s) });
    this.quad([{ x: near.x - half, y: near.y }, { x: near.x + half, y: near.y }, top(near, 1, half), top(near, -1, half)], (x, y) => tone(part(F.stone, R.stone[1]!, R.stone[3]!), clamp01(0.5 + this.hour.face + (noise2(x / 5, y / 3, 383) - 0.5) * 0.4), x, y, 0));
    this.quad([top(near, -1, half), top(near, 1, half), top(far, 1, back), top(far, -1, back)], (x, y) => (hash2(x >> 1, y, 384) > 0.85 ? R.stone[2]! : R.shingle[1]!));
  }

  /**
   * The terrace before the warden's house's door (the terrace with red benches is right in
   * front of the warden's house main door; the terrace had been missing): a deck of pale planks on the grass beside
   * the house, red benches and a table on it, drawn larger than true.
   */
  private terrace(): void {
    const at = (this.world.landmarks ?? []).find((l) => l.id === 'terrace')!;
    const c = this.seat({ x: at.x - 1.5, y: at.y + 4.5 }), s = c.s * 1.35;
    this.as(() => {
      const deck = [{ x: c.x - 4.2 * s, y: c.y + 1.1 * s }, { x: c.x + 3.4 * s, y: c.y + 1.4 * s }, { x: c.x + 4 * s, y: c.y - 1 * s }, { x: c.x - 3.2 * s, y: c.y - 1.3 * s }];
      // weathered planks: pale straw, a dark gap between two
      this.quad(deck, (x, y) => ((Math.round(x + y * 0.4) + 400) % 4 === 0 ? R.wood[2]! : hash2(x >> 2, y, 385) > 0.7 ? R.dry[2]! : R.dry[3]!));
      for (let x = deck[0]!.x; x <= deck[1]!.x; x++) this.put(x, deck[0]!.y + ((deck[1]!.y - deck[0]!.y) * (x - deck[0]!.x)) / (deck[1]!.x - deck[0]!.x) + 1, R.wood[1]!);
    });
    // two benches along a table, a third across its end: red boards on dark legs
    const bench = (x: number, y: number, long: number, tilt: number) => this.as(() => {
      for (let k = 0; k < long; k++) { this.put(x + k, y + k * tilt, R.rose[1]!); this.put(x + k, y + 1 + k * tilt, R.iron[2]!); }
      this.put(x, y + 2, R.wood[0]!); this.put(x + long - 1, y + 2 + (long - 1) * tilt, R.wood[0]!);
    });
    bench(c.x - 3.2 * s, c.y - 0.7 * s, Math.round(2.6 * s), 0.08);
    bench(c.x - 3.0 * s, c.y + 0.3 * s, Math.round(2.6 * s), 0.05);
    bench(c.x + 0.8 * s, c.y - 0.5 * s, Math.round(2.2 * s), -0.06);
    this.as(() => { for (let k = 0; k < Math.round(2.2 * s); k++) for (let d = 0; d < 2; d++) this.put(c.x - 2.9 * s + k, c.y - 0.2 * s + d + k * 0.06, d ? R.wood[2]! : R.plaster[3]!); });
  }

  /**
   * The well house (the reference photograph: it was oversized and covered the warden's
   * house, and should be lower and to the left, out of the way): a small shed of blue-green boards under a wooden roof
   * too big for it, a door, blue barrels at its foot. It stands left of the track before the fork; it is
   * drawn a few metres nearer the viewer and further left than the world model has it, so the fat house behind it
   * stays whole.
   */
  private wellHouse(): void {
    const b = this.world.buildings.find((h) => h.id === 'hut-west')!;
    const near = this.seat({ x: b.x + WELL_SHIFT.x, y: b.y + WELL_SHIFT.y }), far = this.seat({ x: b.x + WELL_SHIFT.x - 4.4, y: b.y + WELL_SHIFT.y + 2.1 });
    this.shack({
      near, far, wide: 4.1, wall: 2.7, rise: 2.5, eave: 0.7, lean: 0.09, skew: -0.2, sag: 1.2,
      walls: F.boards, boards: true, roof: part(F.wood, R.wood[1]!, R.wood[4]!), sheets: 7, streak: -1,
      windows: [], door: 0.1, chimneys: [], lit: false, seed: 517,
    });
    // the barrels at its foot: two, blue, one a hair taller
    this.as(() => {
      for (const [dx, tall] of [[0.62, 4], [0.86, 3]] as const) for (let y = 0; y < tall; y++) for (let x = 0; x < 3; x++) this.put(near.x + dx * 4.1 * near.s + x, near.y + 1 - y, y === tall - 1 ? R.sea[4]! : x === 0 ? R.sea[1]! : y === 1 ? R.sea[1]! : R.sea[2]!);
    });
  }

  /**
   * The sauna (mint-green boards, red-brown posts and porch, an orange-lichened corrugated
   * roof, drawn nicer than real): from up here mostly its roof, with the brick chimney, a window and the porch at
   * its side.
   */
  private sauna(): void {
    const ends = this.ends('hut-middle', 1.9);
    this.shack({
      ...ends, wide: 6.6, wall: 3.5, rise: 3.6, eave: 1, lean: -0.07, skew: 0.14, sag: 2,
      walls: F.boards, boards: true, roof: part(F.wood, R.wood[2]!, R.wood[5]!), sheets: 8, streak: R.dry[2]!,
      windows: [[0.3, 0.32, 4, 4]], door: null, chimneys: [[0.45, 4, 7, 0.14]], lit: true, seed: 533,
    });
    // the porch at its left: a lean-to roof on two red-brown posts
    const { near } = ends, s = near.s;
    this.as(() => {
      const x0 = near.x - 3.6 * s - 3.4 * s, x1 = near.x - 3.5 * s, top = near.y - 2.9 * s;
      this.quad([{ x: x0 - 1, y: top + 0.9 * s }, { x: x1 + 1, y: top + 0.5 * s }, { x: x1 + 1, y: top - 0.5 * s }, { x: x0 + 2, y: top - 0.1 * s }], (x, y) => ((Math.round(x) + 300) % 3 === 0 ? R.wood[1]! : hash2(x >> 1, y, 386) > 0.6 ? R.wood[3]! : R.wood[2]!));
      for (const px of [x0 + 1, x1 - 1]) for (let y = top + 0.8 * s; y <= near.y + 1; y++) { this.put(px, y, R.wood[2]!); this.put(px + 1, y, R.wood[1]!); }
    });
  }

  /** The lattice mast at the north-west gable of the warden's house, the weather station on its top: two legs that close upward, crossed braces. */
  private mast(): void {
    const at = (this.world.landmarks ?? []).find((l) => l.id === 'mast')!;
    const foot = this.project(at), top = this.project(at, 27);
    const n = Math.round(foot.y - top.y);
    for (let i = 0; i <= n; i++) {
      const t = i / n, y = foot.y - i, half = 4.6 * (1 - t) + 1, x = foot.x + (top.x - foot.x) * t + Math.sin(t * 3) * 0.8;
      this.put(x - half, y, R.iron[0]!); this.put(x + half, y, R.iron[1]!);
      const z = (i % 6) / 6;
      if (half > 1) { this.put(x - half + 2 * half * z, y, R.iron[1]!); if (i % 6 === 0) for (let k = -half; k <= half; k++) this.put(x + k, y, R.iron[0]!); }
    }
    // the weather station: a small box and its vane
    for (let dy = -3; dy <= -1; dy++) for (let dx = -2; dx <= 2; dx++) this.put(top.x + dx + 1, top.y + dy, dx > 0 ? R.shingle[2]! : R.shingle[1]!);
    for (let k = 4; k < 9; k++) this.put(top.x + 1, top.y - k, R.iron[0]!);
    this.put(top.x + 2, top.y - 8, R.iron[0]!); this.put(top.x + 3, top.y - 8, R.iron[0]!);
  }

  /** The flagpole between the house and the sauna: a tall white pole, its long blue, black and white pennant flying with the wind. */
  private flagpole(look: number): void {
    const foot = this.project({ x: -85, y: 55 }), top = this.project({ x: -85, y: 55 }, 12);
    this.line(foot, top, R.plaster[3]!);
    const wave = swing(look, LANTERN_FRAMES, 0.3);
    for (let i = 0; i < 12; i++) for (let k = 0; k < 2; k++) {
      const y = top.y + 1 + k + Math.round(Math.sin(i / 2.4 + wave * 1.5) * 1.3 + i * 0.12);
      this.put(top.x + 1 + i * LANTERN_WAY, y, [R.sea[3]!, R.ink, R.plaster[3]!][Math.floor(i / 4) % 3]!);
    }
  }

  /** The north jetty (the docks' scene, seen from far): a plank walk on legs out to its big boulder. */
  private jetty(look: number): void {
    const root = this.project({ x: -103, y: 84 }), end = this.project({ x: -101, y: 99 });
    const brush = this.brush(look);
    this.as(() => {
      const n = Math.ceil(Math.hypot(end.x - root.x, end.y - root.y));
      for (let i = 0; i <= n; i++) {
        const x = root.x + ((end.x - root.x) * i) / n, y = root.y + ((end.y - root.y) * i) / n - 3;
        // pale planks, a dark edge under them, a leg at each third
        for (let k = -2; k <= 2; k++) this.put(x + k, y, i % 4 === 3 ? R.wood[3]! : R.wood[5] ?? R.wood[4]!);
        for (let k = -2; k <= 2; k++) this.put(x + k, y + 1, R.wood[1]!);
        if (i > 0 && i % Math.max(3, Math.round(n / 3)) === 0) for (let d = 2; d <= 3; d++) this.put(x, y + d, R.wood[0]!);
      }
    });
    this.as(() => boulder.paint(brush, end.x + 2, Math.round(end.y) + 1, optionsOf(boulder, undefined, { wide: 7, high: 6, wet: true, dark: 0 }), 77));
    this.stands.push({ x: end.x + 2, y: end.y + 1, r: 7, leg: false });
  }

  // ---- the knoll's bonfire place

  /**
   * The bonfire place on the grassy knoll (on the grassy knoll the bonfire can be seen in the
   * bottom left of the supplied image), as the knoll's own picture has it and larger than true, as the 1991
   * maps draw their places: trodden earth, a ring of stones round the embers, logs to sit on, a thin thread of smoke
   * that leans with the wind. At dusk and night the embers burn and warm what lies round them.
   */
  private bonfire(look: number): void {
    const c = this.seat(KNOLL), s = c.s * 1.5, lit = lampLit(this.brush(0));
    this.as(() => {
      for (let dy = -Math.ceil(1.1 * s); dy <= 1.1 * s; dy++) for (let dx = -Math.ceil(2.4 * s); dx <= 2.4 * s; dx++) {
        const d = (dx / (2.3 * s)) ** 2 + (dy / (0.95 * s)) ** 2 + (noise2(dx / 4, dy / 3, 387) - 0.5) * 0.6;
        if (d < 1) this.put(c.x + dx, c.y + dy, d > 0.7 && hash2(dx, dy, 388) > 0.5 ? R.grass[2]! : d < 0.3 ? (hash2(dx >> 1, dy, 389) > 0.5 ? R.stone[2]! : R.stone[1]!) : hash2(dx >> 1, dy >> 1, 390) > 0.55 ? R.wood[1]! : R.dry[0]!);
      }
    });
    const log = (x0: number, y0: number, x1: number, y1: number) => this.as(() => {
      const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0));
      for (let i = 0; i <= n; i++) {
        const x = c.x + (x0 + ((x1 - x0) * i) / n) * s, y = c.y + (y0 + ((y1 - y0) * i) / n) * s;
        const end = i === 0 || i === n;
        this.put(x, y - 1, end ? R.wood[5]! : R.wood[4]!); this.put(x, y, end ? R.wood[4]! : hash2(i, 1, 391) > 0.7 ? R.wood[2]! : R.wood[3]!); this.put(x, y + 1, R.wood[1]!);
      }
    });
    log(-0.9, -1.25, 1.1, -1.2);
    // the stones round the embers, the far ones first
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + 0.3, far = Math.sin(a) < 0;
      if (far) this.as(() => this.pebbleRock(c.x + Math.cos(a) * 0.95 * s, Math.round(c.y + Math.sin(a) * 0.42 * s), 1.6 + hash2(k, 2, 392), false, 60 + k));
    }
    // the embers: grey ash with a spark by day, a hot heart when they burn
    this.as(() => {
      for (let dy = -2; dy <= 1; dy++) for (let dx = -3; dx <= 3; dx++) {
        if ((dx / 3.4) ** 2 + (dy / 2) ** 2 > 1) continue;
        const heart = Math.abs(dx) < 2 && dy > -2 && dy < 1;
        this.put(c.x + dx, c.y + dy, lit ? (heart ? R.ember[5]! : hash2(dx, dy, 393) > 0.4 ? R.ember[3]! : R.ember[2]!) : heart && hash2(dx, dy, 394) > 0.5 ? R.ember[2]! : hash2(dx, dy, 395) > 0.5 ? R.stone[3]! : R.ember[0]!);
      }
    });
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + 0.3;
      if (Math.sin(a) >= 0) this.as(() => this.pebbleRock(c.x + Math.cos(a) * 0.95 * s, Math.round(c.y + Math.sin(a) * 0.42 * s), 1.6 + hash2(k, 2, 392), false, 60 + k));
    }
    log(-2.6, 0.15, -1.2, 1.15);
    log(1.3, 1.2, 2.7, 0.2);
    if (lit) lamp.paint(this.brush(look), c.x, c.y - 4, optionsOf(lamp, undefined, { reach: 30, water: 0, lantern: false }), 5);
    // the smoke: one thin broken thread, leaning with the wind, its bends moving up it with the loop
    this.as(() => {
      for (let k = 3; k < 34; k++) {
        if (hash2(k, look, 396) > 0.78) continue;
        const x = c.x + LANTERN_WAY * (k * k) / 90 + Math.sin(k / 4.5 - (look / LANTERN_FRAMES) * Math.PI * 2) * (0.6 + k / 22);
        this.put(x, c.y - k, k > 22 ? R.cloud[3]! : k > 9 ? R.cloud[2]! : R.cloud[1]!);
      }
    });
  }

  // ---- the dog roses near the viewer

  /**
   * The wild dog rose between the fork and the lighthouse (thick, at least 3 m high): heaps of
   * leaf low in the picture, cut by the track. Where the meadow's own noise says so, between 55 and 115 m ahead.
   */
  private roses(look: number): void {
    const brush = this.brush(look), run = roseRun(brush);
    const heaps: { at: Pt & { far: number }; r: number; seed: number }[] = [];
    for (let k = 0; k < 150; k++) {
      const p = { x: -112 + hash2(k, 1, 391) * 100, y: -8 + hash2(k, 2, 391) * 78 };
      if (!insideRing(this.world.grass, p)) continue;
      if (fbm(p.x / 16, p.y / 16, 2, 392) < 0.5) continue;
      if (this.world.paths.some((t) => reach(t.points, p.x, p.y, false) < (t.kind === 'track' ? 5 : 2.5))) continue;
      if (this.world.buildings.some((b) => Math.hypot(b.x - p.x, b.y - p.y) < 17) || Math.hypot(p.x - KNOLL.x, p.y - KNOLL.y) < 15) continue;
      const at = this.project(p);
      // the thicket stands right of the track near the viewer; further off and left of the track only a heap here and there
      const thick = at.far < 76 && at.x > this.project({ x: -53, y: 17.7 }).x;
      if (at.far < 50 || at.far > 112 || (!thick && hash2(k, 5, 391) > 0.3)) continue;
      heaps.push({ at, r: (LANTERN.lens * (thick ? 2 + hash2(k, 3, 391) * 1.6 : 1.4 + hash2(k, 3, 391))) / at.far, seed: k });
    }
    heaps.sort((a, b) => b.at.far - a.at.far);
    for (const hp of heaps) this.as(() => {
      const { at, r, seed } = hp;
      bushAt(brush, [{ x: at.x - r * 0.7, y: at.y - r * 0.55, r: r * 0.8 }, { x: at.x + r * 0.2, y: at.y - r * 0.9, r }, { x: at.x + r * 1.0, y: at.y - r * 0.5, r: r * 0.7 }], run, 400 + seed, Math.round(at.y));
      for (let f = 0; f < Math.round(r / 2.5); f++) {
        const fx = at.x + (hash2(seed, f, 393) - 0.4) * r * 2, fy = at.y - r * (0.5 + hash2(seed, f, 394) * 0.9);
        if (this.owner[Math.round(fy) * this.w + Math.round(fx)] === this.thing) roseFlower(brush, Math.round(fx), Math.round(fy), hash2(seed, f, 395) > 0.7, r > 12);
      }
    });
  }

  // ---- the lantern

  /** The light across a round body of the lantern at `u` (-1 its left flank, 1 its right): in flat bands with ragged borders, never a smooth falloff (rule 12). */
  private round(u: number, x: number, y: number, base = 0.5): number {
    const side = this.hour.side;
    const rim = u * side > 0.72 ? 0.3 : 0;
    const t = base + this.hour.face * 0.8 + u * side * 0.42 + rim * (this.hour.face < 0 ? 1.6 : 0) + (noise2(x / 5, y / 9, 401) - 0.5) * 0.14;
    return clamp01(Math.round(t * 4) / 4);
  }

  /**
   * The lantern, after the reference photograph: the iron column's flared head, the gallery as a thick plate seen a
   * little from above with its rail of three hoops, a low iron wall, the cage of glass with the lens on its red drum,
   * a fat cornice with teeth, the dome in gores round as a pot lid, the vent's ball with its cap and the rod. It leans
   * a hair and its uprights fan out toward the top (rule 3).
   */
  private lantern(): void {
    this.cage = this.things + 1;
    const s = LANTERN_SHAPE, k = s.ring, fy = s.floor, { h } = this;
    const { glass, top } = this.plan.lantern;
    const lean = (y: number) => s.x + (fy - y) * s.lean + Math.sin((fy - y) / 34) * 1.6;
    const iron = (u: number, x: number, y: number, base = 0.5) => tone(F.iron, this.round(u, x, y, base), x, y, 0);
    const dark = R.iron[0]!;
    const glassR = s.glassWide * k, corniceTop = glass.top - s.cornice * k, domeR = s.domeWide * k, domeH = s.dome * k;
    const rails = [s.rail * k, s.rail * k * 0.5];
    const hoop = (up: number, front: boolean) => {
      for (let a = 0; a <= 180; a += 0.5) {
        const x = Math.cos((a * Math.PI) / 180) * k * (1 + up / (k * 14));
        const y = fy - up + Math.sin((a * Math.PI) / 180) * k * s.flat * (front ? 1 : -1) + Math.sin(a / 19 + up) * 1.3 + (x / k) * 1.5;
        this.put(lean(fy - up) + x, y, dark); this.put(lean(fy - up) + x, y + 1, front && x * this.hour.side > k * 0.2 ? R.iron[3]! : dark);
        if (front) this.put(lean(fy - up) + x, y + 2, dark);
      }
    };
    const posts = (front: boolean) => {
      for (let i = 0, a = front ? 7 : 16; a < 176; i++, a += (front ? 17 : 21) + (hash2(i, front ? 1 : 2, 403) - 0.5) * 9) {
        const x = Math.cos((a * Math.PI) / 180) * k, yb = fy + Math.sin((a * Math.PI) / 180) * k * s.flat * (front ? 1 : -1) + (x / k) * 1.5;
        const tilt = (hash2(i, front ? 3 : 4, 404) - 0.5) * 0.09 + (x / k) * 0.04, tall = rails[0]! + 3 + hash2(i, 5, 405) * 2;
        for (let y = yb - tall; y < yb; y++) {
          const px = lean(y) + x + (yb - y) * tilt;
          this.put(px, y, dark);
          if (front) { this.put(px + 1, y, dark); if (x * this.hour.side > 0) this.put(px + 1 + Math.sign(this.hour.side), y, R.iron[3]!); }
        }
        // a knob on each post
        if (front) for (let dy = -2; dy <= 0; dy++) for (let dx = -1; dx <= 2; dx++) if (dy > -2 || (dx > -1 && dx < 2)) this.put(lean(yb - tall) + x + tall * tilt + dx, yb - tall + dy, dark);
      }
    };
    this.as(() => {
      // the column under the gallery: a trumpet's bell, rivets in rows
      for (let y = Math.round(fy); y < h; y++) {
        const d = (y - fy) / (0.6 * k), half = k * (0.5 + 0.34 * Math.exp(-d * 2.2));
        for (let x = -Math.ceil(half); x <= half; x++) this.put(lean(y) + x, y, iron(x / half, x, y, 0.4));
        if (Math.round(y - fy) % 9 === 7) for (let x = -half + 4; x < half - 3; x += 8) this.put(lean(y) + x, y, dark);
      }
      // the rail's far half and its posts, behind the glass
      for (const up of rails) hoop(up, false);
      posts(false);
      // the gallery's floor: a thick plate, its top seen a little from above, its edge dark
      for (let y = -k * s.flat; y <= k * s.flat + 6; y++) for (let x = -k; x <= k; x++) {
        const onTop = (x / k) ** 2 + (y / (k * s.flat)) ** 2 <= 1;
        const rim = !onTop && y > 0 && (x / k) ** 2 + ((y - 6) / (k * s.flat)) ** 2 <= 1;
        if (onTop) this.put(lean(fy) + x, fy + y, tone(F.iron, clamp01(Math.round((0.6 + (x / k) * this.hour.side * 0.3 + (hash2(x >> 2, y, 402) - 0.5) * 0.2) * 4) / 4), x, y, 0));
        else if (rim) this.put(lean(fy) + x, fy + y, y > 4 ? dark : R.iron[1]!);
      }
      // the low iron wall under the glass
      for (let y = glass.bottom; y <= fy + 2; y++) for (let x = -Math.ceil(glassR); x <= glassR; x++) this.put(lean(y) + x, y, y === glass.bottom ? dark : iron(x / glassR, x, y, 0.44 + (noise2(x / 2.5, y / 30, 407) > 0.66 ? -0.2 : 0) + (x * this.hour.side < -glassR * 0.35 ? -0.16 : 0)));
    });
    this.as(() => this.panes(lean, glassR));
    this.as(() => {
      // the cornice: a fat ring, a row of teeth under it
      const cr = s.corniceWide * k;
      for (let y = Math.round(corniceTop); y < glass.top + 2; y++) {
        const t = (y - corniceTop) / (s.cornice * k), half = cr * (1 - 0.1 * t * t);
        for (let x = -Math.ceil(half); x <= half; x++) this.put(lean(y) + x, y, t < 0.14 ? R.iron[3]! : iron(x / half, x, y, 0.34));
      }
      for (let x = -cr + 5; x < cr - 5; x += 11) for (let y = 0; y < 4; y++) for (let wd = 0; wd < 4; wd++) this.put(lean(glass.top) + x + wd, glass.top + 2 + y, dark);
      // the dome: gores between bowed seams, lit in bands, a hair lopsided
      for (let y = -Math.ceil(domeH); y <= 0; y++) {
        const half = domeR * Math.sqrt(Math.max(0, 1 - (y / domeH) ** 2)) * (1 + 0.04 * Math.sin((y / domeH) * 3));
        for (let x = -Math.ceil(half); x <= half; x++) {
          const u = x / (half || 1);
          const seam = Math.abs(Math.sin(Math.asin(Math.max(-1, Math.min(1, u))) * 4 + 0.3)) < 0.06;
          this.put(lean(corniceTop + y) + x + 1, corniceTop + y, seam ? dark : iron(u, x, y, 0.42 - (y / domeH) * 0.1));
        }
      }
      // the vent: a neck, a ball, a peaked cap, the rod
      const neck = corniceTop - domeH, ball = s.ball * k;
      for (let y = -Math.round(ball); y <= 0; y++) {
        const t = -y / ball;
        const half = t < 0.3 ? 0.1 * k : t < 0.7 ? 0.14 * k : 0.17 * k * (1 - (t - 0.7) / 0.3) + 1;
        for (let x = -Math.ceil(half); x <= half; x++) this.put(lean(neck + y) + x + 1, neck + y, iron(x / half, x, y, 0.42));
      }
      for (let y = top - 2; y < neck - ball; y++) this.put(lean(y) + 1, y, dark);
    });
    // the rail's near half and its posts, over everything
    this.as(() => {
      for (const up of rails) hoop(up, true);
      posts(true);
    });
  }

  /**
   * The lens in the glass: a brass beehive of glass rings, fat in the middle and closing to its top and foot, a bull's
   * eye in its belt, three brass ribs down it; it stands on a red iron drum.
   */
  private lens(lean: (y: number) => number, glassR: number): void {
    const { glass } = this.plan.lantern, { hour } = this;
    const high = glass.bottom - glass.top;
    const { light } = this.plan, lensH = high * 0.31, lensW = glassR * 0.34;
    const lensY = light.y + lensH * 0.2;
    const lit = lampLit(this.brush(0));
    for (let y = -Math.ceil(lensH); y <= lensH; y++) {
      const v = y / lensH, half = lensW * (1 - Math.abs(v) ** 2.6) ** 0.55 + (Math.abs(v) < 0.2 ? 1 : 0);
      const ring = Math.floor((y + lensH) / 3), seam = (y + Math.ceil(lensH)) % 3 === 0, belt = Math.abs(v) < 0.2;
      for (let x = -Math.ceil(half); x <= half; x++) {
        const u = x / Math.max(1, half), rim = Math.abs(x) > half - 1.2, rib = !belt && (Math.abs(Math.abs(u) - 0.52) < 0.07 || Math.abs(u) < 0.05);
        // the bull's eye: a round glass in the belt's middle
        const eye = Math.hypot(x, y * 1.1) / (lensH * 0.24);
        let c: number;
        if (eye < 0.5) c = lit ? R.ember[5]! : R.plaster[3]!;
        else if (eye < 1) c = lit ? R.ember[4]! : R.dry[R.dry.length - 1]!;
        else if (eye < 1.25) c = lit ? R.ember[3]! : R.dry[0]!;
        // the burning lamp shows through the rings round the eye: two round steps, each ring's seam and the ribs a step darker
        else if (lit && eye < 3.1 && !rim) c = R.ember[(eye < 2.1 ? 3 : 2) - (rib || seam ? 1 : 0)]!;
        else if (rim || rib || (seam && !belt)) c = R.dry[0]!;
        else c = tone(F.dry, clamp01(0.62 + u * hour.side * 0.34 + (ring % 2 === 0 ? 0.12 : -0.08)), x, y, 0);
        this.put(lean(lensY) + x, lensY + y, c);
      }
    }
    for (let y = Math.round(lensY + lensH); y < glass.bottom; y++) for (let x = -Math.ceil(lensW * 1.3); x <= lensW * 1.3; x++) this.put(lean(y) + x, y, Math.abs(x) > lensW * 1.3 - 1.2 ? R.iron[0]! : tone(F.iron, this.round(x / (lensW * 1.3), x, y, 0.55), x, y, 0));
  }

  /**
   * The cage of glass: the sky and the sea show through it a tone darker, pale slants of shine lie on the panes, the
   * brass lens stands on its red drum inside, and over them the frame: uprights that fan out toward the top, a bar
   * across the middle.
   */
  private panes(lean: (y: number) => number, glassR: number): void {
    const { glass } = this.plan.lantern, { hour } = this;
    const high = glass.bottom - glass.top;
    const sky = F.sky, seaRun = F.sea;
    for (let y = glass.top; y < glass.bottom; y++) for (let x = -Math.ceil(glassR); x <= glassR; x++) {
      const sx = Math.round(lean(y) + x), c = this.at(sx, y);
      const skyAt = sky.indexOf(c), seaAt = seaRun.indexOf(c);
      // what is behind the glass, two places darker along its own run; a thing behind it goes to the sea's shade
      // (the setting sun shines through as it is)
      let out = c === R.moon[0] ? c : skyAt >= 0 ? sky[Math.max(0, skyAt - 2)]! : seaAt >= 0 ? seaRun[Math.max(0, seaAt - 2)]! : seaRun[Math.min(seaRun.length - 1, 3)]!;
      // a pane's shine: slanted pale strokes, broken
      const slant = (x + (y - glass.top) * 0.5) / (glassR * 0.5);
      if (!hour.night && Math.abs(slant - Math.round(slant)) < 0.06 && noise2(x / 9, y / 14, 411) > 0.55) out = sky[Math.min(sky.length - 1, Math.max(skyAt, Math.round(sky.length * 0.55)) + 3)]!;
      this.put(sx, y, out);
    }
    this.lens(lean, glassR);
    // the frame
    [-90, -66, -37, -11, 19, 42, 65, 90].forEach((a, i) => {
      const x = Math.sin((a * Math.PI) / 180) * glassR, fan = Math.sin((a * Math.PI) / 180) * 4.5, bow = (hash2(i, 7, 406) - 0.5) * 3;
      const wide = Math.abs(a) < 45 ? 5 : Math.abs(a) < 80 ? 4 : 3;
      for (let y = glass.top; y < glass.bottom; y++) {
        const t = (y - glass.top) / high, at = lean(y) + x - fan * (1 - t) + Math.sin(t * Math.PI) * bow - wide / 2;
        for (let wd = 0; wd < wide; wd++) this.put(at + wd, y, wd === 0 || wd === wide - 1 ? R.stone[0]! : wd === (hour.side < 0 ? 1 : wide - 2) ? R.shingle[2]! : R.stone[2]!);
      }
    });
    for (let x = -Math.ceil(glassR); x <= glassR; x++) {
      const sag = (1 - (x / glassR) ** 2) * 2.5, y = glass.top + high * 0.42 + sag;
      this.put(lean(y) + x, y, R.shingle[2]!); this.put(lean(y) + x, y + 1, R.stone[1]!);
    }
  }

  // ---- the pictures

  private painted(look: number): Bitmap {
    const bitmap = createBitmap(this.w, this.h);
    this.px = bitmap.pixels;
    this.owner = new Uint16Array(this.w * this.h);
    this.things = 0;
    this.live.on = look === 0;
    const rocks = this.rocks();
    this.stands = this.standing(rocks);
    this.paintSky();
    // the sea of the kit (after the Phatt dock), its bands curling round the boulders, the light on it
    sea.paint(this.brush(look), this.seaGround(), this.seaOptions(), 0);
    this.paintLand();
    this.jetty(look);
    rings.paint(this.brush(look), this.seaGround(), this.seaOptions(), 0);
    this.seaLights();
    this.placeRocks(look, rocks);
    this.houses(look);
    this.bonfire(look);
    this.roses(look);
    // the live water is held to what shows before the grain; the lantern laid after it hides what lies under it
    const seen = this.px.slice();
    grain(this.px, this.w, GRAIN_RUNS, { seed: 420, strength: 0.2 });
    const grained = this.px.slice();
    this.lantern();
    this.outline();
    if (look === 0) this.water = this.live.seal({ width: this.w, height: this.h, pixels: seen }, (i) => this.px[i] !== grained[i]);
    this.live.on = false;
    return bitmap;
  }

  frames(band: number): { frames: Bitmap[]; fore: Overlay } {
    return paintLooks(LANTERN_FRAMES, this.sky, Math.min(band, this.hz + 1), (look) => this.painted(look));
  }

  /** A colour `places` lighter along its own run, as lit air over it shows it. -1 for a colour of no run (a light, the ink, the open sea and sky). */
  private lifted(c: number, places: number): number {
    for (const run of this.liftRuns) {
      const at = run.indexOf(c);
      if (at >= 0) return run[Math.min(run.length - 1, at + places)]!;
    }
    return -1;
  }

  /** A colour of the lantern's cage in the lamp's warm light: its iron goes to the embers' dark reds and its pale bars to their oranges, a step hotter near the lamp. -1 for any other colour. */
  private warmed(c: number, near: boolean): number {
    const iron = F.iron.indexOf(c);
    if (iron >= 0) return F.ember[Math.round((iron / (F.iron.length - 1)) * 3) + (near ? 3 : 1)]!;
    for (const run of [F.stone, F.shingle]) {
      const at = run.indexOf(c);
      if (at >= 0) return F.ember[near ? 4 + Math.round((at / (run.length - 1)) * 4) : 2 + Math.round((at / (run.length - 1)) * 3)]!;
    }
    return -1;
  }

  /**
   * The beam: one flat wedge of lit air from the lens out over the island to the left, near the eye's level, palest
   * where it leaves the lamp and thinning out over the sea. The open sea and sky under it (and what shows through the
   * glass) take the beam's own flat steps, a core and an edge; a thing in it goes lighter along its own run. Its two
   * edges are clean lines, so it reads as a beam and never as haze on the water.
   */
  private beam(put: (x: number, y: number, c: number) => void, look: number): void {
    const { w, h } = this, { x: lx, y: ly } = this.plan.light, run = this.beamRun;
    for (let x = 0; x < lx - 3; x++) {
      const d = (lx - x) / lx, mid = ly - 1 - d * 30, half = 3 + d * 21 + look;
      for (let y = Math.round(mid - half); y <= mid + half; y++) {
        if (y < 0 || y >= h) continue;
        const edge = Math.abs(y - mid) / half, core = edge < 0.45;
        const under = this.px[y * w + x]!, sky = F.sky.includes(under);
        // each step of the beam ends raggedly, as a brush would leave it
        const strength = 1 - d * 0.7 + (hash2(x >> 2, y >> 1, 433) - 0.5) * 0.07;
        const c = sky || F.sea.includes(under)
          ? run[Math.max(0, Math.round(strength * (core ? run.length - 1 : run.length - 3)))]!
          : this.lifted(under, (core ? 3 : 2) + (d < 0.3 ? 2 : d < 0.55 ? 1 : 0));
        if (c >= 0) put(x, y, c);
      }
    }
  }

  /**
   * The lamp lights its own cage: the bars, the cornice's underside and the rail round it go warm in two flat rings,
   * and a third ring beyond them lighter along its own colours. Only the lantern's own things: a boulder in the
   * shallows behind it stays in the night.
   */
  private glow(bitmap: Bitmap, put: (x: number, y: number, c: number) => void, look: number): void {
    const { w, h } = this, { x: lx, y: ly } = this.plan.light;
    // the rings are measured in the lantern's own size: the near one reaches the bars beside the lens, the far one the cornice and the rail
    const k = this.plan.lantern.ring / 100, reach = 96 * k;
    for (let dy = -Math.ceil(reach / 0.85); dy <= reach / 0.85; dy++) for (let dx = -Math.ceil(reach); dx <= reach; dx++) {
      const far = (Math.hypot(dx, dy * 0.85) + (hash2((lx + dx) >> 1, (ly + dy) >> 1, 432) - 0.5) * 5 - look) / k;
      const x = lx + dx, y = ly + dy;
      if (far > 94 || x < 0 || y < 0 || x >= w || y >= h || this.owner[y * w + x]! < this.cage) continue;
      const base = this.px[y * w + x]!, beamed = bitmap.pixels[y * w + x]!;
      // the beam's lit air behind the glass stays the beam's: only the cage's own iron and bars go warm
      if (beamed !== 0 && (F.sea.includes(base) || F.sky.includes(base))) continue;
      const under = beamed || base;
      const c = far < 66 ? this.warmed(under, far < 36) : this.lifted(under, 2);
      if (c >= 0) put(x, y, c);
    }
  }

  /**
   * The light in the lens. By day the sun's glint on the brass: a small star. At dusk and night the lamp burns: a hot
   * core with long thin rays, the kit's warm light on the lantern's iron round it, and its beam, one flat pale wedge
   * out over the island to the left. A frame for each flicker.
   */
  light(): Overlay {
    const { w, h, plan, hour } = this;
    const burns = lampLit(this.brush(0));
    const { x: lx, y: ly } = plan.light;
    return cropTogether(Array.from({ length: LIGHT_LOOKS }, (_, look) => {
      const bitmap = createBitmap(w, h);
      const put = (x: number, y: number, c: number) => {
        const px = Math.round(x), py = Math.round(y);
        if (px >= 0 && py >= 0 && px < w && py < h) bitmap.pixels[py * w + px] = c;
      };
      if (burns) {
        if (hour.night) this.beam(put, look);
        this.glow(bitmap, put, look);
        const brush: KitBrush = {
          ...this.brush(look), put,
          under: (x, y) => {
            const px = Math.round(x), py = Math.round(y);
            if (px < 0 || py < 0 || px >= w || py >= h) return undefined;
            const i = py * w + px;
            return { colour: this.px[i]!, thing: this.owner[i] !== 0 };
          },
        };
        lamp.paint(brush, lx, ly - 3, optionsOf(lamp, undefined, { reach: 58 + look * 3, water: 0, lantern: false }), look);
      }
      // the core and its rays
      const long = burns ? 22 + look * 3 : 9 + look;
      for (let r = 0; r <= long; r++) for (const [dx, dy, share] of [[1, 0, 1], [-1, 0, 1], [0, 1, 0.6], [0, -1, 0.6], [0.72, 0.5, 0.4], [-0.72, 0.5, 0.4], [0.72, -0.5, 0.4], [-0.72, -0.5, 0.4]] as const) {
        if (r > long * share) continue;
        put(lx + dx * r, ly + dy * r, r < 4 ? R.ember[5]! : r < long * share * 0.5 ? R.ember[4]! : R.ember[3]!);
      }
      const core = burns ? 5 : 2;
      for (let y = -core; y <= core; y++) for (let x = -core - 1; x <= core + 1; x++) if ((x / (core + 1)) ** 2 + (y / core) ** 2 <= 1) put(lx + x, ly + y, R.ember[5]!);
      return bitmap;
    }));
  }
}

/** Paints the lantern over the island of `world` as planned, for one hour of the sky. */
export function paintLantern(world: World, plan: LanternPlan, phase: SkyPhase): LanternPicture {
  const p = new LanternPainter(world, plan, phase);
  const clouds = LANTERN_CLOUDS.map(({ at, spec }) => ({ x: at[0], y: at[1], bitmap: p.cloud(spec) }));
  const { frames, fore } = p.frames(Math.max(...clouds.map((c) => c.y + c.bitmap.height)));
  return { palette: p.palette, frames, fore, clouds, light: p.light(), water: p.water! };
}
