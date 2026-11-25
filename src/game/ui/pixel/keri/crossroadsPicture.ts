import { CROSSROADS, crossroadsEye, crossroadsHouses, crossroadsPaths, crossroadsShore, depthOfRow, onPicture, toCrossroads, type CrossroadsHouse, type CrossroadsPath, type CrossroadsPlan, type Ground } from '../../../../core/layout/crossroads';
import type { SkyPhase } from '../../../../core/sky/skyPhase';
import type { World } from '../../../../core/world/world';
import { createBitmap, type Bitmap } from '../bitmap';
import { fbm, hash2, noise2 } from '../paint/noise';
import { clamp01, smoothstep as smooth } from '../paint/ease';
import type { Overlay } from '../pack';
import { groundLook, lean, paintLooks, SkyMask, StillPart, swing } from '../paint/motion';
import { LiveRecorder, type LiveWater } from '../paint/live';
import { tintedCloud, type CurlSpec } from './curlCloud';
import { KERI_HOURS, scenePalette, tone, type Hour } from './keriPalette';
import { optionsOf, type KitBrush } from './kit/kit';
import { boulder } from './kit/stones';
import { roseFlower, roseRun, roseTone } from './kit/bushes';
import { lamp as lampLight } from './kit/lights';
import { slabs, trail, type SlabGround, type TrailGround } from './kit/paths';
import { beside, fleck as grain, lump, scatter } from './kit/shape';

/**
 * The picture of the crossroads (d113): the concrete path's Y fork in tall grass, the green board hut with its chimney
 * up the left arm and the lighthouse at the end of the right one, the sea showing over the low island on the left. Pixel
 * art as the knoll (d111): small things flat tones, what shades off through the whole run of its material in
 * bands and strokes, back to front. The places come from the world model (`core/layout/crossroads.ts`); the houses are
 * drawn from their corners there, larger than to scale. What moves is the motion every painted place shares
 * (`paint/motion.ts`): a gust through the grass, the sea's glints; the clouds are their own pictures.
 */

/**
 * Keri's shared palette and the colours only this place has: the lighthouse's limestone (violet in its shade, cream in
 * the sun), the sauna's green boards, the roofs' tin, and the lighthouse's iron. Each run is short, for a picture holds
 * 256 colours: it names the shared materials it paints with (d123), so the night's longer runs still fit (251 at night).
 * The grass is the knoll's summer green and gold (picked over the photograph's rust).
 */
const SHARED = scenePalette({
  lime: [0x36325c, 0x5e4e74, 0x9a7a7c, 0xd0a684, 0xeedaac],
  // the sauna's and the well house's boards: mint green, as the reference photographs show them
  boards: [0x2e5644, 0x4a927e, 0x9ccec6],
  // the sauna's corrugated roof, grey under orange lichen
  roof: [0x523a2a, 0x845a3a, 0xae7e4e],
  // the lighthouse's iron, rust red in the sun (the reference photographs)
  iron: [0x481816, 0x802c20, 0xac4e32],
  // the shared materials it paints with (d123): no ash and no stem, so the night's longer runs fit in 256
}, ['grass', 'dry', 'far', 'shingle', 'stone', 'earth', 'bush', 'near', 'bloom', 'rose', 'smoke'], { sky: 4.5 });
const R = SHARED.run;
const F = SHARED.fine;

/**
 * Runs that turn their hue along their length, as the 1991 game's do: each material's shade goes violet (the
 * limestone's dark tones) and its light goes warm (cream and pale gold). Built from the palette's own runs, so no
 * colour is added: the grass, its gold, the path's concrete and the bushes.
 */
const LUSH: readonly number[] = [R.lime[0]!, R.lime[1]!, ...F.grass.slice(1), F.dry[F.dry.length - 1]!];
const GOLD: readonly number[] = [R.lime[1]!, R.earth[2]!, ...F.dry, R.lime[4]!];
const LEAF: readonly number[] = [R.lime[0]!, ...F.bush.slice(1), R.far[2]!, R.far[3]!];
/**
 * The meadow's body and its blades, as the knoll paints the same summer grass (the knoll is the model for
 * grass, bushes and foliage): the greens from the darkest to the fourth named tone, and the dry gold beside them. No violet in
 * them: the violet lies only in a swell's shade.
 */
const TURF: readonly number[] = F.grass.slice(F.grass.indexOf(R.grass[0]!), F.grass.indexOf(R.grass[3]!) + 1);
const TURF_DRY: readonly number[] = F.dry.slice(F.dry.indexOf(R.dry[0]!), F.dry.indexOf(R.dry[2]!) + 1);
/** A pixel's grain, 0 to 1, scattered and never in a pattern (the knoll's). */
const speck = (x: number, y: number): number => (hash2(x, y, 977) + hash2(x >> 1, y, 978)) / 2;

export function crossroadsPalette(phase: SkyPhase): readonly number[] {
  return SHARED.at(phase);
}

/** The picture's runs of colours, the shared ones and its own, for the art tools and the rules' test (`tools/art/pictures.ts`). */
export function crossroadsRuns(): Readonly<Record<string, readonly number[]>> {
  return F;
}

/** The looks of the grass and the sea: one gust running over the field, in a loop. */
export const CROSSROADS_FRAMES = 8;
/** The far sea's strokes lie thicker than the kit's sea's (`LiveWater.cover`). */
const CROSSROADS_STROKES = 2.5;
/** The wind of this view blows from the south-west, to the viewer's left. */
const WAY = -1;

/** The sun's (or the moon's) bearing at each hour, which lights the houses' faces and the lighthouse's side, and its glint's column on the sea. */
const SUN: Record<SkyPhase, { bearing: number; glint: number }> = {
  day: { bearing: 190, glint: 620 },
  dawn: { bearing: 70, glint: 190 },
  dusk: { bearing: 290, glint: 20 },
  night: { bearing: 160, glint: 520 },
};

/**
 * How far the land bows down at the picture's sides (fine pixels): the island is drawn as if on a ball, its horizon
 * an arch, as nothing in the 1991 game is ruler-straight (art-direction rules 21, 25). The sky goes on down to meet it.
 */
const BOW = 14;

/**
 * How much further off the sauna is drawn than it stands: it is pushed back along the viewer's line of sight to it, so it
 * stays where it is across the picture but smaller and nearer the horizon. Nearer, the sauna competed with the
 * lighthouse, so it stands slightly further away.
 */
const SAUNA_BACK = 1.35;

/** The moon's place in the night's sky. */
const MOON = { x: 522, y: 22, r: 8 } as const;

/**
 * The sky's clouds, back to front (d111): a big fat heap high on the right, as on the photograph, long thin
 * streaks low over the sea, no two alike, their heads leading left with the wind.
 */
export const CROSSROADS_CLOUDS: readonly { at: readonly [number, number]; spec: CurlSpec }[] = [
  { at: [18, 128], spec: { length: 70, girth: 5, belly: 0.4, neck: 1, taper: 0.6, bend: 1, wave: 1, phase: 0.5 } },
  { at: [470, 132], spec: { length: 52, girth: 4, belly: 0.6, neck: 1, taper: 0.6, bend: 1, wave: 1, phase: 1.5 } },
  { at: [436, 46], spec: { length: 108, girth: 40, belly: 0.62, neck: 0.9, taper: 1.2, bend: 8, wave: 0.7, phase: 0, rise: 6, head: { size: 26, turns: 1.2 }, curls: [{ at: 0.6, size: 21, turns: 1.15 }, { at: 0.3, size: 13, turns: 1.1 }] } },
  { at: [30, 58], spec: { length: 200, girth: 15, belly: 0.55, neck: 0.85, taper: 0.7, bend: 7, wave: 1.4, phase: 0.6, rise: 2, head: { size: 16, turns: 1.3 }, curls: [{ at: 0.45, size: 10, turns: 1.1 }] } },
  { at: [250, 92], spec: { length: 100, girth: 12, belly: 0.7, neck: 0.9, taper: 0.9, bend: 5, wave: 1.6, phase: 0.2, head: { size: 11, turns: 1.25 } } },
  { at: [150, 14], spec: { length: 46, girth: 10, belly: 0.75, neck: 1, taper: 0.8, bend: 3, wave: 0.9, phase: 1.1, head: { size: 9, turns: 1.2 } } },
];

/**
 * Grey boulders in the grass by the path (fine pixels: foot x, foot y, size), as the island's meadows have (docs/keri.md:
 * shingle and erratic stones). AX-3 provisional: where each lies is the painter's.
 */
const ROCKS: readonly (readonly [number, number, number])[] = [[182, 262, 15], [350, 244, 8]];

/**
 * The trodden footpaths through the dog roses (the roses are lush and wild, with few paths going
 * through them and branches arching over), on the viewer's ground in metres. AX-3 provisional: where they run is the
 * painter's; the world model has none. One leaves the stem for the knoll, one leaves the lighthouse's arm to the left.
 */
const LANES: readonly (readonly Ground[])[] = [
  [{ x: 0.5, z: 7.6 }, { x: 5.5, z: 13 }, { x: 14, z: 22 }, { x: 24, z: 36 }, { x: 31, z: 46 }],
  [{ x: 16, z: 41 }, { x: 10.5, z: 52 }, { x: 12, z: 66 }, { x: 19, z: 84 }],
];

/**
 * How the lighthouse is drawn larger than true (every scene must insist on its
 * grandness): this many times its planned height, its foot sunk this many pixels behind the roses before it, the
 * drum's half width at its foot and at its top.
 */
const TOWER = { grand: 1.18, sink: 10, r0: 34, r1: 29 } as const;

/**
 * The grassy rise north of the sauna, in fine pixels before the bow: the column of its top, how far it reaches left and
 * right of that, and how high it stands over its foot (the line drawn on our picture).
 */
const RISE = { peak: 105, left: 150, right: 190, high: 26 } as const;

/** Where the dog roses begin (metres ahead) and how far off they reach, as far as the lighthouse. */
const ROSES = { from: 7.5, to: 92 } as const;
/**
 * The meadow's swells, the knoll's: low mounds one before another toward the viewer, each a light top over the shade
 * of the ground behind it, so a light edge lies over a dark one along a curve, never in level bands. How much lighter a
 * swell's top is and how much darker the hollow behind it, in shares of the run.
 */
const SWELL = { top: 0.26, hollow: 0.3 } as const;

/** How far a ground point is from a line through `points` (metres). */
function offLine(g: Ground, points: readonly Ground[]): number {
  let best = Infinity;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!, b = points[i]!, ex = b.x - a.x, ez = b.z - a.z;
    const t = clamp01(((g.x - a.x) * ex + (g.z - a.z) * ez) / (ex * ex + ez * ez));
    best = Math.min(best, Math.hypot(g.x - a.x - ex * t, g.z - a.z - ez * t));
  }
  return best;
}

/** How far a ground point is to the right of a line through `points` walked from its first point (metres; below 0: to its left). */
function sideOf(g: Ground, points: readonly Ground[]): number {
  let best = Infinity, signed = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!, b = points[i]!, ex = b.x - a.x, ez = b.z - a.z;
    const t = clamp01(((g.x - a.x) * ex + (g.z - a.z) * ez) / (ex * ex + ez * ez));
    const d = Math.hypot(g.x - a.x - ex * t, g.z - a.z - ez * t);
    if (d < best) { best = d; signed = (ex * (g.z - a.z) - ez * (g.x - a.x)) < 0 ? d : -d; }
  }
  return signed;
}

/** How long a slab of the path is (metres); each is a little longer or shorter. */
const SLAB = 1.3;

export interface CrossroadsCloud {
  x: number;
  y: number;
  bitmap: Bitmap;
}

export interface CrossroadsPicture {
  palette: readonly number[];
  /** The whole picture in each look of the grass and the sea (`CROSSROADS_FRAMES`), the sky bare: the clouds drift over it. */
  frames: Bitmap[];
  /** In each look, what stands before the sky where the clouds go (the lighthouse, the hut's chimney): laid over the drifting clouds. */
  fore: Overlay;
  /** The clouds, back to front (`CROSSROADS_CLOUDS`). */
  clouds: CrossroadsCloud[];
  /** What moves on the sea (its strokes, the glints, the surf), lit as the game runs (`paint/live.ts`). */
  water: LiveWater;
  /** The gulls' colour, a place of the palette (`flock.ts`); the game flies them by day. */
  gull: number;
}

/** One face of a house: its corners in metres on the viewer's ground with their heights, and what it is. */
interface Face {
  kind: 'wall' | 'gable' | 'roof';
  /** A point of the face for (u, v), each 0 to 1: `v` up to the face's top edge (a gable's slopes, a roof's ridge). */
  at: (u: number, v: number) => { g: Ground; up: number };
  /** The same with `v` in shares of the wall's height, for things on a gable that must stay square (a window). */
  flat: (u: number, v: number) => { g: Ground; up: number };
  /** How the face is turned to the light, -1 away to 1 full on. */
  lit: number;
  /** How far it is, for painting far to near. */
  far: number;
  /** Its width and height in metres, for boards and windows. */
  wide: number;
  high: number;
  /** The face's side of the house: 0 to 3, the edge from corner `side` to the next. */
  side: number;
}

class CrossroadsPainter {
  readonly palette: readonly number[];
  private readonly hour: Hour;
  private readonly w: number;
  private readonly h: number;
  private readonly hz: number;
  /** The row where the island begins in each column, under the far shore's water. */
  private readonly land: number[];
  private readonly paths: CrossroadsPath[];
  private readonly houses: CrossroadsHouse[];
  private readonly tower: Ground;
  /** The knoll, on the viewer's ground: further right, past the lighthouse's arm. */
  private readonly knollAt: Ground;
  /** The light on the viewer's ground: a unit vector toward the sun, `x` right and `z` ahead. */
  private readonly sun: { x: number; z: number };
  private readonly glint: number;
  private readonly sky: SkyMask;
  private px: Uint8Array = new Uint8Array(0);
  /** How far each column bows down (`BOW`). */
  private readonly bows: Int16Array;
  /** While a thing is drawn: the pixels it covers, for its dark line round it (`outlined`). */
  private rec: Set<number> | null = null;
  /** While a crooked thing is drawn: it leans this many pixels for each row over `foot` (the sauna). */
  private shear = { foot: 0, k: 0 };
  /** While the things nearest the viewer are drawn: they stand before the bowed land, not on it. */
  private unbowed = false;
  /** 1 where the path's slabs are, 2 in a joint, so no grass grows out of them (except in a joint); 3 well inside a slab, where no blade reaches over it. */
  private slab: Uint8Array;
  /** The dog roses' height (metres) on the ground under each column of the row the grass has reached; 0 where there are none. */
  private roseH: Float32Array = new Float32Array(0);
  /** The lit lamps of the night, each the pixels its panes were painted on and how far its light reaches (`glow`). */
  private lamps: { at: number[]; reach: number }[] = [];
  /** Everything but the sky and the sea: the same in every look while the ground stands still. */
  private readonly still: StillPart;
  /** What moves on the sea, recorded in the first look (`paint/live.ts`). */
  private readonly live: LiveRecorder;
  water: LiveWater | null = null;

  /** The gulls' colour (`flock.ts` flies them in the game): pale against the sky, warm in the low sun where the sky is warm. */
  gullTone(): number {
    return R.stone[1]!;
  }
  /** The pixels of the lamp being painted, while it is (`lamp`). */
  private lampAt: number[] | null = null;
  /** The top of the thicket each column painted last, to shade only where a nearer heap rises over a farther one (`roseRow`). */
  private roseTop: Float32Array = new Float32Array(0);
  /** The swells' top edges in each column, top to bottom (`swellEdges`). */
  private readonly edges: { y: number; strong: number }[][];
  /** The heap `heaps` last found highest: where on it the point is (its centre to its rim, 0 to 1, and which way). */
  private readonly heap = { x: 0, z: 0, d: 1 };
  /** The tracks to the lighthouse and to the sauna, from the fork: which side of them the roses stand on. */
  private readonly lightTrack: readonly Ground[];
  private readonly hutTrack: readonly Ground[];

  constructor(world: World, plan: CrossroadsPlan, phase: SkyPhase) {
    this.w = plan.fine.w;
    this.h = plan.fine.h;
    this.hz = plan.horizon;
    this.hour = KERI_HOURS[phase];
    this.palette = crossroadsPalette(phase);
    // the island's south-east end is higher (docs/keri.md): toward the lighthouse its far edge rises to the horizon and hides the sea
    this.land = crossroadsShore(world).map((y, x) => Math.max(this.hz + 1, y - (y - this.hz - 1) * smooth(215, 360, x)));
    this.paths = crossroadsPaths(world);
    const track = (id: string): readonly Ground[] => this.paths.find((p) => p.id === id)?.points ?? [{ x: 0, z: 0 }, { x: 0, z: 1 }];
    this.lightTrack = track('lighthouse');
    this.hutTrack = track('hut');
    // the sauna is drawn further off than it stands, so it does not vie with the lighthouse
    this.houses = crossroadsHouses(world).map((h) => {
      if (h.id !== 'hut-middle') return h;
      const mx = h.corners.reduce((a, c) => a + c.x, 0) / 4, mz = h.corners.reduce((a, c) => a + c.z, 0) / 4;
      return { ...h, corners: h.corners.map((c) => ({ x: c.x + mx * (SAUNA_BACK - 1), z: c.z + mz * (SAUNA_BACK - 1) })) };
    });
    const eye = crossroadsEye(world);
    this.tower = toCrossroads(eye, world.places.lighthouse);
    const knoll = (world.scenes ?? []).find((s) => s.id === 'knoll');
    if (!knoll) throw new Error('the world model has no scene "knoll"');
    this.knollAt = toCrossroads(eye, knoll);
    const a = ((SUN[phase].bearing - CROSSROADS.heading) * Math.PI) / 180;
    this.sun = { x: Math.sin(a), z: Math.cos(a) };
    this.glint = SUN[phase].glint;
    this.sky = new SkyMask(this.w, this.h);
    this.slab = new Uint8Array(this.w * this.h);
    this.still = new StillPart(this.w * this.h);
    // the wind of this view blows from the south-west, to the viewer's left
    this.live = new LiveRecorder(this.w, this.h, () => this.px, this.hz, -1, R.foam, CROSSROADS_STROKES);
    this.bows = Int16Array.from({ length: this.w }, (_, x) => Math.round(BOW * ((x - this.w / 2) / (this.w / 2)) ** 2));
    this.edges = this.swellEdges();
  }

  /** Puts a colour at a place of the plan: leant by `shear`, then bowed down by its column (except the sky, which is painted bowed). */
  private put(x: number, y: number, c: number): void {
    if (this.shear.k !== 0 && y < this.shear.foot) x += (this.shear.foot - y) * this.shear.k;
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || x >= this.w) return;
    if (!this.sky.sky && !this.unbowed) y += this.bows[x]!;
    if (y < 0 || y >= this.h) return;
    const i = y * this.w + x;
    this.px[i] = c;
    this.sky.put(i);
    this.still.touch(i);
    this.rec?.add(i);
    this.lampAt?.push(i);
  }

  /**
   * Whether the lamps burn at this hour: at night only. The kit's lights burn at dusk too (`lampLit`), but here at dusk
   * the low sun lights the sauna's gable, and the lamp's warmth on those lit boards reads as a blot round the window.
   */
  private get lampsBurn(): boolean {
    return this.hour.night;
  }

  /** Paints a lamp's panes and keeps where they are, so `glow` can light round them when the lamps burn. */
  private lamp(reach: number, draw: () => void): void {
    if (!this.lampsBurn) return draw();
    const at: number[] = [];
    this.lampAt = at;
    draw();
    this.lampAt = null;
    this.lamps.push({ at, reach });
  }

  /**
   * The lamps' light at night: the kit's lamp (`lights/lamp`, the docks' after Woodtick: the docks are the
   * model for light and heat, checked against the atlas), laid round each lamp's panes on the finished
   * picture. Over the bare sky a round halo in two flat steps; on a thing, warmth only where its tone sits in the upper
   * part of its own run, falling off fast. It does not flicker: these lamps burn behind glass. The light goes out and
   * down: a thing above the panes (the lantern's dome, the gable over the window) is not handed to it, the sky is.
   */
  private glow(): void {
    const { w, h, px } = this;
    const sky = new Set<number>(F.sky);
    for (const [n, { at, reach }] of this.lamps.entries()) {
      if (at.length === 0) continue;
      const own = new Set(at);
      const lx = at.reduce((a, i) => a + (i % w), 0) / at.length, ly = at.reduce((a, i) => a + Math.floor(i / w), 0) / at.length;
      const top = Math.min(...at.map((i) => Math.floor(i / w)));
      // on the finished picture, its pixels as they stand: no bow, no lean
      const brush: KitBrush = {
        ...this.brush(),
        put: (x, y, c) => {
          const bx = Math.round(x), by = Math.round(y);
          if (bx >= 0 && by >= 0 && bx < w && by < h) px[by * w + bx] = c;
        },
        under: (x, y) => {
          const bx = Math.round(x), by = Math.round(y);
          if (bx < 0 || by < 0 || bx >= w || by >= h) return undefined;
          const i = by * w + bx, colour = px[i]!, bare = sky.has(colour);
          return !bare && (by < top || own.has(i)) ? undefined : { colour, thing: !bare };
        },
      };
      lampLight.paint(brush, lx, ly - 3, optionsOf(lampLight, undefined, { reach, water: 0, lantern: false }), n);
    }
  }

  /**
   * Draws a thing and then a dark line round it, on its own edge pixels: the big shapes of the 1991 game are drawn
   * round with a dark colour of their own (a small thing outdoors is not: rule 25).
   */
  private outlined(draw: () => void, ink: number): void {
    const rec = new Set<number>();
    this.rec = rec;
    draw();
    this.rec = null;
    const { w, h } = this;
    const edge: number[] = [];
    for (const i of rec) {
      const x = i % w, y = (i - x) / w;
      if (x === 0 || x === w - 1 || y === 0 || y === h - 1) continue;
      if (!rec.has(i - 1) || !rec.has(i + 1) || !rec.has(i - w) || !rec.has(i + w)) edge.push(i);
    }
    for (const i of edge) this.px[i] = ink;
  }

  private landAt(x: number): number {
    return this.land[Math.max(0, Math.min(this.w - 1, Math.round(x)))]!;
  }

  /** A curved stroke from `a` by `b` to `c`, `wide(t)` pixels wide, in the colour `ink(t)`; returns its end. */
  private stroke(a: readonly [number, number], b: readonly [number, number], c: readonly [number, number], wide: (t: number) => number, ink: (t: number) => number): { x: number; y: number } {
    const steps = Math.max(2, Math.ceil((Math.abs(c[0] - a[0]) + Math.abs(c[1] - a[1]) + Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1])) * 1.2));
    let x = a[0], y = a[1];
    for (let k = 0; k <= steps; k++) {
      const t = k / steps, u = 1 - t;
      x = u * u * a[0] + 2 * u * t * b[0] + t * t * c[0];
      y = u * u * a[1] + 2 * u * t * b[1] + t * t * c[1];
      const n = wide(t), colour = ink(t);
      for (let s = 0; s < n; s++) this.put(x + s - (n >> 1), y, colour);
    }
    return { x: Math.round(x), y: Math.round(y) };
  }

  // ---- the sky and the sea

  private paintSky(): void {
    const { w, hz, hour } = this;
    this.sky.sky = true;
    const warm = hour.night ? 0 : SUN[hour === KERI_HOURS.dawn ? 'dawn' : hour === KERI_HOURS.dusk ? 'dusk' : 'day'].glint;
    for (let x = 0; x < w; x++) for (let y = 0; y <= hz + this.bows[x]!; y++) {
      let t = Math.pow(Math.min(1, y / hz), 0.85);
      // the low sun warms the sky on its side, near the horizon
      if (hour === KERI_HOURS.dawn || hour === KERI_HOURS.dusk) t += 0.3 * Math.exp(-(((x - warm) / 260) ** 2)) * (y / hz) ** 2 - 0.1;
      // at dusk the sun sets behind the viewer: the sky ahead stays cooler and violet low down
      if (hour === KERI_HOURS.dusk) t -= 0.18 * (1 - Math.exp(-(((x - warm) / 200) ** 2))) * (y / hz) ** 2;
      // a smooth sky, as on the harbour: a long run of small steps, one tone to a row, no dither and no grain (rule 12)
      this.put(x, y, tone(F.sky, clamp01(t), x, y));
    }
    if (hour.night) this.stars();
    for (let x = 0; x < w; x++) if (hash2(x >> 2, 3, 14) > 0.3) this.put(x, hz - 1 + this.bows[x]!, R.sky[4]!);
    this.sky.sky = false;
  }

  private stars(): void {
    const { w, hz } = this;
    for (let gy = 0; gy < hz - 8; gy += 8) for (let gx = 0; gx < w; gx += 9) {
      const pick = hash2(gx, gy, 21);
      if (pick > 0.42) continue;
      const x = gx + Math.floor(hash2(gx, gy, 22) * 9), y = gy + Math.floor(hash2(gx, gy, 23) * 8);
      this.put(x, y, pick < 0.14 ? R.star[0]! : R.star[1]!);
    }
    for (let dy = -MOON.r - 9; dy <= MOON.r + 9; dy++) for (let dx = -MOON.r - 9; dx <= MOON.r + 9; dx++) {
      const far = Math.hypot(dx, dy), x = MOON.x + dx, y = MOON.y + dy;
      if (far <= MOON.r) this.put(x, y, Math.hypot(dx + 3, dy + 3) < MOON.r * 0.55 || hash2(x >> 1, y >> 1, 24) > 0.86 ? R.moon[1]! : R.moon[0]!);
      else if (far < MOON.r + 3 || (far < MOON.r + 9 && hash2(Math.floor(x / 3), y, 25) < 0.8 * (1 - (far - MOON.r) / 9))) this.put(x, y, R.sky[4]!);
    }
  }

  cloud(spec: CurlSpec): Bitmap {
    return tintedCloud(spec, true, R.cloud);
  }

  /**
   * The sea over the low island, from the horizon down to the far shore; its strokes, the glints and the line of surf
   * are lit as the game runs (`paint/live.ts`).
   */
  private paintSea(): void {
    const { w, hz } = this;
    for (let x = 0; x < w; x++) for (let y = hz; y <= this.land[x]!; y++) {
      const depth = y - hz;
      const t = 0.22 + 0.45 * clamp01(depth / 22) + 0.12 * Math.exp(-(((x - this.glint) / (40 + depth * 3)) ** 2));
      this.put(x, y, tone(F.sea, clamp01(t), x, y, 0.5));
    }
    let y = hz + 2;
    for (let row = 0; y < hz + 24; row++) {
      const depth = y - hz;
      for (let px = 0; px < w; px++) if (y < this.land[px]! - 1) this.live.stroke(px, y, R.sea[3]!);
      y += Math.max(2, Math.round(1.6 + depth * 0.12));
    }
    // glints where the light lies on the water, each on its own beat
    for (let gy = hz + 1; gy < hz + 24; gy++) for (let gx = Math.max(0, this.glint - 90); gx < Math.min(w, this.glint + 90); gx++) {
      if (gy >= this.land[gx]! - 1) continue;
      const near = Math.exp(-(((gx - this.glint) / (12 + (gy - hz) * 2)) ** 2));
      if (hash2(gx, gy, 57) > 1 - 0.25 * near) this.live.glint(gx, gy, this.hour.night ? R.moon[0]! : R.foam, hash2(gx, gy, 63));
    }
    // the surf on the far shore
    for (let x = 0; x < w; x++) {
      const edge = Math.round(this.land[x]!);
      if (edge - hz >= 3) this.live.surf(x, edge - 1);
    }
  }

  // ---- the island

  /** How light the field is at a pixel (0 dark, 1 light): the swells in it, light on their tops, darker toward the viewer. */
  private field(x: number, y: number): number {
    // clumps: broad light and dark masses, as a painter lays them, not a fine noise
    const clump = Math.round((fbm(x / 34, y / 9, 2, 8) - 0.5) * 4) / 4;
    // the value plan: the lit middle distance between a darker near field and a darker left side (a stage's wings)
    const plan = 0.46 * smooth(this.hz + 40, this.h, y) + 0.2 * (1 - smooth(0, 260, x)) * smooth(this.hz + 20, this.h, y);
    const { lift, shade } = this.relief(x, y);
    return clamp01(0.6 + lift - shade - plan + (fbm(x / 60, y / 12, 2, 6) - 0.5) * 0.24 + clump * 0.35);
  }

  /** The swells of the meadow, as the knoll lays them: a few in each band toward the viewer, small far off and broad near. */
  private swellEdges(): { y: number; strong: number }[][] {
    const swells: { x: number; half: number; v: number; rise: number; seed: number }[] = [];
    for (let k = 0, v = 12; v < this.h; k++, v += 12 + k * 6) {
      let x = -140 * hash2(k, 1, 151);
      for (let n = 0; x < this.w + 80; n++) {
        const half = (64 + k * 24) * (0.7 + 0.6 * hash2(k, n, 152));
        if (hash2(k, n, 153) < 0.82) swells.push({ x: x + half, half, v: v + (hash2(k, n, 154) - 0.5) * (7 + k * 3), rise: (2.5 + k * 1.4) * (0.7 + 0.6 * hash2(k, n, 155)), seed: k * 31 + n });
        x += half * (1.3 + 0.9 * hash2(k, n, 156));
      }
    }
    return Array.from({ length: this.w }, (_, x) => swells.flatMap((s) => {
      const u = (x - s.x) / s.half;
      if (Math.abs(u) >= 1) return [];
      const y = this.land[x]! + s.v - s.rise * (1 - u * u) + (noise2(x / 13, s.seed * 0.37, 157) - 0.5) * 2.4;
      return [{ y, strong: Math.min(1, (1 - u * u) * 1.8) }];
    }).sort((a, b) => a.y - b.y));
  }

  /** What the swells do to the light at a pixel: lighter just under a swell's top edge (`lift`), darker just above the next one's (`shade`). */
  private relief(x: number, y: number): { lift: number; shade: number } {
    const edges = this.edges[Math.max(0, Math.min(this.w - 1, Math.round(x)))]!;
    let above: { y: number; strong: number } | undefined, below: { y: number; strong: number } | undefined;
    for (const e of edges) {
      if (e.y <= y) above = e;
      else { below = e; break; }
    }
    const reach = 3 + (y - this.landAt(x)) * 0.07;
    return {
      lift: above ? above.strong * SWELL.top * Math.exp(-(y - above.y) / (reach * 1.8)) : 0,
      shade: below ? below.strong * SWELL.hollow * Math.exp(-(below.y - y) / reach) : 0,
    };
  }

  /** The grass's run for a pixel: the summer's green, with gold in patches. */
  private grassRun(x: number, y: number, pick: number): readonly number[] {
    const patch = fbm(x / 110 + 4, y / 26, 2, 7);
    return pick < 0.15 + 0.6 * smooth(0.5, 0.7, patch) ? GOLD : LUSH;
  }

  /** The meadow's run for a pixel, the knoll's: its green, with its dry gold in the same patches as `grassRun`. */
  private turfRun(x: number, y: number, pick: number): readonly number[] {
    return this.grassRun(x, y, pick) === GOLD ? TURF_DRY : TURF;
  }

  /** The ground's body under the blades: the far shore's shingle, the far meadow pale in streaks, then the field's run. */
  private paintGround(): void {
    const { w, h } = this;
    for (let x = 0; x < w; x++) for (let y = Math.floor(this.land[x]!) + 1; y < h; y++) {
      const z = depthOfRow(y);
      const from = y - this.land[x]!;
      if (from < 2 && this.land[x]! - this.hz > 3) {
        this.put(x, y, hash2(x >> 1, y, 91) > 0.5 ? R.shingle[2]! : R.shingle[1]!);
        continue;
      }
      if (z > 70) {
        // far off the field is streaks of pale colour, level with the horizon
        const streak = fbm(x / 26, y / 2.2, 2, 92);
        this.put(x, y, tone(this.grassRun(x, y, hash2(x >> 3, y, 93)) === GOLD ? F.dry : F.far, clamp01(0.45 + (streak - 0.5) * 0.8), x, y, 0));
        continue;
      }
      // the field's body as the knoll's: its tone with the swells in it and a scattered grain, the blades go over it
      // (`mark`); violet only deep in a swell's shade, with a ragged rim, so it follows the swell's curve
      const run = this.turfRun(x, y, hash2(x >> 2, y >> 1, 94));
      const t = this.field(x, y);
      let c = run[Math.max(0, Math.min(run.length - 1, Math.round(t * (run.length - 1) + (speck(x, y) - 0.5) * 1.8)))]!;
      if (run === TURF && t < 0.4 && this.relief(x, y).shade + (hash2(x, y, 98) - 0.5) * 0.1 > 0.17) c = R.lime[1]!;
      this.put(x, y, c);
    }
  }

  /** A bush on the far land: leafy lumps heaped on a foot, flat patches of leaf, dark below. */
  private bush(cx: number, foot: number, r: number, seed: number): void {
    // no two alike: two to five lumps, some leaning, some flat-topped as if cropped by the wind, some ragged
    const n = 2 + Math.floor(hash2(seed, 1, 351) * 4), lean = (hash2(seed, 2, 352) - 0.5) * 1.2, flat = hash2(seed, 3, 353) > 0.6;
    const wide = 0.7 + hash2(seed, 4, 354) * 0.8, ragged = hash2(seed, 5, 355) > 0.5 ? 1.6 : 0.82;
    const lumps = Array.from({ length: n }, (_, i) => {
      const u = n === 1 ? 0 : i / (n - 1) - 0.5, up = 1 - Math.abs(u) * 1.2 + (hash2(seed, i, 356) - 0.5) * 0.5;
      return { x: cx + u * r * 1.7 * wide + lean * r * up * 0.6, y: foot - r * (0.55 + 0.45 * up), r: r * (0.55 + 0.4 * hash2(seed, i, 357)) * (0.7 + 0.3 * up) };
    });
    const side = this.sun.x, cut = foot - r * (1.3 + 0.3 * hash2(seed, 6, 358));
    for (let y = Math.floor(foot - r * 2.3); y <= foot; y++) for (let x = Math.floor(cx - r * 2.4); x <= cx + r * 2.4; x++) {
      if (flat && y < cut) continue;
      let best = -1, of = lumps[0]!;
      for (const [i, l] of lumps.entries()) {
        const v = lump(x, y, l.x, l.y, l.r, l.r * ragged * (ragged > 1 ? 0.5 : 1), seed + i);
        if (v > best) { best = v; of = l; }
      }
      if (best < 0) continue;
      // lit from above and the sun's side in three or four bands, leaf clusters breaking their borders
      const t = 0.52 - ((y - of.y) / of.r) * 0.42 + ((x - of.x) / of.r) * side * 0.3 + (fbm(x / 3, y / 2.4, 2, seed + 81) - 0.5) * 0.45;
      this.put(x, y, tone(LEAF, clamp01(Math.round((t - smooth(foot - r * 0.5, foot, y) * 0.3) * 4) / 4), x, y, 0));
    }
  }

  /** The far bushes the photograph shows by the lighthouse and along the island's far side. */
  private farBushes(): void {
    const t = onPicture(this.tower);
    for (const [dx, r, s] of [[-62, 5, 1], [-44, 7, 2], [40, 6, 3], [60, 4, 4], [-150, 4, 8], [-104, 5, 9]] as const) {
      const x = t.x + dx, foot = Math.max(this.landAt(x) + 3, t.y + 1);
      this.bush(x, foot, r, 300 + s * 7);
    }
  }

  /**
   * The knoll, further to the right: a low grassy rise with its bonfire place, from the world
   * model's scene. Drawn higher than to scale so it reads, one shoulder steeper than the other, its grass in bands
   * that follow its round, a light rim against the sky.
   */
  private knoll(at: Ground): void {
    const foot = onPicture(at);
    // low and long, its top to the right, where it runs on out of the picture; the roses hide its foot
    const half = (CROSSROADS.lens * 26) / at.z, high = (CROSSROADS.lens * 4.4) / at.z, peak = 0.3;
    const side = this.sun.x;
    const top = (x: number): number => {
      const t = (x - foot.x) / half, q = t < peak ? (t - peak) / (1 + peak) : (t - peak) / (1 - peak);
      return Math.abs(q) >= 1 ? Infinity : foot.y - high * (1 - q * q) ** 0.75;
    };
    for (let x = Math.floor(foot.x - half); x <= foot.x + half; x++) {
      const y0 = top(x);
      if (!Number.isFinite(y0)) continue;
      for (let y = Math.floor(y0); y <= foot.y + 2; y++) {
        const d = (y - y0) / high, slope = (top(x + 2) - top(x - 2)) / 4;
        // bands along its round: lit on top and on the sun's shoulder, darker down its flanks
        const t = 0.62 - d * 0.3 - slope * side * 0.6 + (fbm(x / 18, d * 4, 2, 321) - 0.5) * 0.2;
        // gold grass along its crest, the green below
        const run = d < 0.18 + 0.1 * noise2(x / 12, 0, 322) ? GOLD : LUSH;
        this.put(x, y, y < y0 + 1 && !this.hour.night ? beside(F.far, 0.8, 0) : tone(run, clamp01(Math.round(t * 4) / 4), x, y, 0));
      }
    }
    for (const [dx, r, s] of [[0.05, 4, 11], [0.55, 5, 12]] as const) {
      const x = foot.x + dx * half;
      this.bush(x, top(x) + r * 1.5, r, 300 + s * 7);
    }
  }

  /**
   * How high the dog roses (kibuvits) stand on a ground point (metres), 0 where there are none. Between the viewer and
   * the lighthouse the land is a thicket of them, cut only by the paths, the footpaths, the
   * houses and the lighthouse's foot, with a glade here and there; its edges round down where it is cut.
   */
  private roseAt(gx: number, gz: number): number {
    if (gz < ROSES.from - 1 || gz > ROSES.to) return 0;
    const g = { x: gx, z: gz };
    // before the lighthouse's foot the roses close over the path's end and hide the sunk foot (`TOWER`)
    const apron = gz > 28 && Math.abs(gx / gz - this.tower.x / this.tower.z) < (TOWER.r0 + 10) / CROSSROADS.lens;
    // room: how far the point is inside the thicket from its nearest edge (metres)
    // its near edge is ragged, and at the sides it comes closer to the viewer
    let room = gz - (ROSES.from + 6 * noise2(gx / 3.5, 0, 401) - 3.5 * smooth(2, 7, Math.abs(gx))) + 0.5;
    if (!apron) for (const p of this.paths) room = Math.min(room, offLine(g, p.points) - p.wide / 2 - 0.3 - 0.7 * noise2(gx / 3, gz / 3, 402));
    for (const lane of LANES) room = Math.min(room, offLine(g, lane) - 0.75 - 0.4 * noise2(gx / 2, gz / 2, 403));
    for (const house of this.houses) {
      const mx = house.corners.reduce((a, c) => a + c.x, 0) / 4, mz = house.corners.reduce((a, c) => a + c.z, 0) / 4;
      room = Math.min(room, Math.hypot(gx - mx, gz - mz) - Math.hypot(house.corners[0]!.x - mx, house.corners[0]!.z - mz) - 1.6);
    }
    // the thicket's own swells, and a grassy glade here and there; left of the sauna's arm it thins to a meadow with
    // bushes in it (the reference photographs)
    // left of the sauna's arm is the grassy rise: open grass, no roses
    const left = this.leftOfHut(g);
    room = Math.min(room, (0.5 - left) * 6);
    const mass = fbm(gx / 9, gz / 12, 2, 404);
    if (!apron) room = Math.min(room, (mass - 0.28) * 14);
    if (room <= 0) return 0;
    // right of the lighthouse's track the roses stand high, at least 3 m: a hedge along it
    const right = sideOf(g, this.lightTrack) * smooth(18, 6, Math.abs(gz - 22));
    // and from the sauna to the lighthouse, between the two arms, they stand high too (the bushes from the
    // sauna to the lighthouse are drawn higher)
    const between = smooth(0.5, 3, sideOf(g, this.hutTrack)) * smooth(0.5, 3, -sideOf(g, this.lightTrack)) * smooth(10, 16, gz);
    const tall = 1 + 1.3 * smooth(0.6, 3, right) * (1 - smooth(10, 16, right)) + 0.9 * between;
    const hgt = (Math.min(3.6, this.heaps(gx, gz) * tall) + (fbm(gx / 1.2, gz / 1.5, 2, 405) - 0.5) * 0.25) * Math.sqrt(smooth(0, 1.6, room));
    // before the lighthouse they stand just high enough to hide its sunk foot, so the drum shows tall
    if (apron) return Math.max(0.9, Math.min(1.15, hgt));
    // and nearer, in front of the drum, never so high that they hide more than its foot ("its grandness")
    const before = Math.abs(gx / gz - this.tower.x / this.tower.z) < (TOWER.r0 + 6) / CROSSROADS.lens;
    return before ? Math.min(hgt, CROSSROADS.eye + gz / 100) : hgt;
  }

  /** The row of the sauna's nearest corner, where it stands on the rise. */
  private saunaFoot(): number {
    const sauna = this.houses.find((h) => h.id === 'hut-middle');
    return sauna ? Math.max(...sauna.corners.map((c) => onPicture(c).y)) : this.hz + 10;
  }

  /** How far left of the sauna's arm a ground point lies, 0 on it or right of it to 1 a few metres off. */
  private leftOfHut(g: Ground): number {
    return smooth(1, 5, -sideOf(g, this.hutTrack));
  }

  /** The thicket's heaps: a round bush in each cell of a 3.4 m grid, most below the eye, some higher; the highest wins. */
  private heaps(gx: number, gz: number): number {
    const cell = 4.8, i0 = Math.floor(gx / cell), j0 = Math.floor(gz / cell);
    let best = 0.35;
    this.heap.x = 0; this.heap.z = 0; this.heap.d = 1;
    for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 1; j <= j0 + 1; j++) {
      const cx = (i + hash2(i, j, 420)) * cell, cz = (j + hash2(i, j, 421)) * cell;
      const r = cell * (0.55 + 0.45 * hash2(i, j, 422)), d = Math.hypot(gx - cx, (gz - cz) * 0.9) / r;
      if (d >= 1) continue;
      const tall = 0.7 + 0.8 * hash2(i, j, 423) + (hash2(i, j, 424) > 0.8 ? 0.8 : 0);
      const up = tall * Math.sqrt(1 - d * d);
      if (up > best) { best = up; this.heap.x = (gx - cx) / r; this.heap.z = ((gz - cz) * 0.9) / r; this.heap.d = d; }
    }
    return best;
  }

  /**
   * One row of the dog roses: on each column, the thicket on the ground under that row from its top down to its foot,
   * painted far to near with the grass so a nearer heap stands over a farther one. Its leaves are the knoll's thicket's
   * (the knoll is the model for grass, bushes and foliage): its dark greens in a broken grain of light and dark
   * leaf, finer far off, the heap lit on top and on the sun's side and dark low down; pink flowers and a red hip lie on
   * the lit tops.
   */
  private roseRow(y: number): void {
    const { w } = this;
    // a column with no thicket in the last row starts afresh: the next heap's top rises over the grass behind it
    for (let x = 0; x < w; x++) if (this.roseH[x] === 0) this.roseTop[x] = Infinity;
    this.roseH.fill(0);
    const z = depthOfRow(y), lens = CROSSROADS.lens;
    if (z < ROSES.from - 1 || z > ROSES.to) return;
    // the kit's dog rose (bushes/rose): its leaves' run and grain, its flowers; the thicket's shape is this place's own
    const run = roseRun(this.brush());
    for (let x = 0; x < w; x++) {
      const gx = ((x - w / 2) * z) / lens;
      const hgt = this.roseAt(gx, z);
      this.roseH[x] = hgt;
      if (hgt <= 0) continue;
      // the light on the heap it belongs to: round, lit on its top and on the sun's side, dark down in the dips
      const { x: nx, z: nz, d } = this.heap;
      const lit = clamp01(0.3 + (nx * this.sun.x + nz * this.sun.z) * 0.5 + (1 - d * d) * 0.55 + (hgt - 1) * 0.1);
      // the lumps of its top and the grain of its leaves: bigger nearer
      const cell = Math.max(3, Math.min(8, Math.round(2 + 60 / z)));
      const grainAt = Math.max(1.6, Math.min(4.2, 1.2 + 28 / z));
      // its top is lumpy with leaf clusters, never a smooth hill's line
      const top = y - (lens * hgt) / z - cell * 1.1 * noise2(x / (cell * 1.3), z * 0.8, 445);
      // only where it rises over what was painted behind it: on a heap's near slope each row's top sinks below the last
      // one's, and a shade there would lay a dark line per row
      if (top < this.roseTop[x]! - 0.5) this.shadeBehind(x, Math.floor(top), Math.max(1, Math.round(24 / z)), run);
      this.roseTop[x] = top;
      for (let py = Math.floor(top); py <= y; py++) {
        const off = py - top;
        // lit by how its skin slopes, dark only low down at its foot, under the leaves; the leaves break that light up in
        // light and dark patches, fixed on the picture so a row does not streak against the next
        const t = roseTone(0.1 + lit * 0.8 - (y - py < 3 ? 0.3 : 0), x, py, [grainAt, grainAt * 0.74]);
        this.put(x, py, scatter(run, t, x, py));
        // the flowers come in drifts, as a rose blooms on its sunny side
        const drift = smooth(0.5, 0.7, fbm(x / 16, py / 7, 2, 409));
        if (off < 2.5 && t > 0.45 && hash2(x, py, 407) < (0.004 + 0.05 * drift) * (0.6 + smooth(40, 12, z))) this.rose(x, py, z, hash2(x, py, 408));
      }
    }
  }

  /** A heap's shade on the heaps behind it: the few thicket pixels just over its top go two tones darker. */
  private shadeBehind(x: number, top: number, deep: number, run: readonly number[]): void {
    const y0 = top + this.bows[x]!;
    for (let k = 1; k <= deep; k++) {
      const y = y0 - k;
      if (y < 0) return;
      const i = y * this.w + x, at = run.indexOf(this.px[i]!);
      if (at < 0) return;
      this.px[i] = run[Math.max(0, at - 2)]!;
    }
  }

  /**
   * A dog rose's flower (or now and then its red hip) on a thicket `z` metres off: the kit's flower near (bushes/rose's
   * `roseFlower`), and further off, where its five petals would be a blur, one pixel of pink or of red.
   */
  private rose(x: number, y: number, z: number, pick: number): void {
    const hip = pick < 0.2;
    if (hip ? z >= 25 : z > 38) { this.put(x, y, hip ? R.rose[1]! : pick > 0.6 ? R.rose[3]! : R.rose[2]!); return; }
    roseFlower(this.brush(), x, y, hip, z < 20);
  }

  /**
   * The dog roses' long canes that arch out of the thicket over the paths and the footpaths (branches
   * arch over): from inside the thicket's edge up over its top and down over the path, thin, dark red, a few
   * leaves along them and a flower or a hip at the tip. Each is put in when the grass reaches its foot.
   */
  private caneSpots(): { foot: number; draw: (look: number) => void }[] {
    const out: { foot: number; draw: (look: number) => void }[] = [];
    const lines = [...this.paths.map((p) => ({ points: p.points, half: p.wide / 2 })), ...LANES.map((points) => ({ points, half: 0.3 }))];
    for (const [k, line] of lines.entries()) for (let i = 1; i < line.points.length; i++) {
      const a = line.points[i - 1]!, b = line.points[i]!, long = Math.hypot(b.x - a.x, b.z - a.z);
      const ax = (b.z - a.z) / long, az = -(b.x - a.x) / long;
      for (let s = hash2(k, i, 410) * 3; s < long; s += 2.4 + 3 * hash2(k, Math.round(s * 10) + i * 97, 411)) {
        const seed = k * 1000 + i * 100 + Math.round(s * 10);
        const sideOf = hash2(seed, 1, 412) > 0.5 ? 1 : -1;
        const cx = a.x + ((b.x - a.x) * s) / long, cz = a.z + ((b.z - a.z) * s) / long;
        const footAt = { x: cx + ax * sideOf * (line.half + 1.3), z: cz + az * sideOf * (line.half + 1.3) };
        const hgt = this.roseAt(footAt.x, footAt.z);
        if (hgt < 0.6 || footAt.z < ROSES.from || footAt.z > 70) continue;
        // most reach over the path's edge, some right across it
        const reach = line.half * (0.5 + 1.4 * hash2(seed, 2, 413));
        const tipAt = { x: cx + ax * sideOf * (line.half - reach), z: cz + az * sideOf * (line.half - reach) + (hash2(seed, 3, 414) - 0.5) * 0.8 };
        const midAt = { x: (footAt.x + tipAt.x) / 2, z: (footAt.z + tipAt.z) / 2 };
        out.push({
          foot: onPicture(footAt).y + 1,
          draw: (look) => this.cane(onPicture(footAt, hgt * 0.8), onPicture(midAt, hgt + 0.7 + 0.6 * hash2(seed, 4, 415)), onPicture(tipAt, hgt * (0.35 + 0.3 * hash2(seed, 5, 416))), footAt.z, seed, look),
        });
      }
    }
    return out;
  }

  private cane(a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }, z: number, seed: number, look: number): void {
    const sway = swing(groundLook(look), CROSSROADS_FRAMES, seed * 0.07) * (z < 20 ? 1 : 0.5);
    const wide = z < 22 ? 2 : 1;
    // the cane: red-brown out of the thicket, green toward its tip
    const end = this.stroke([a.x, a.y], [b.x, b.y - 2], [c.x + sway, c.y], (t) => (t < 0.5 ? wide : 1), (t) => (t < 0.35 ? R.bloom[3]! : R.near[2]!));
    // leaves along it: little clusters of the rose's green on either side, lit on top
    const n = z < 20 ? 6 : 4, big = z < 20 ? 2 : 1;
    for (let i = 1; i <= n; i++) {
      const t = 0.2 + (0.75 * i) / n, u = 1 - t;
      const x = u * u * a.x + 2 * u * t * b.x + t * t * (c.x + sway), y = u * u * a.y + 2 * u * t * (b.y - 2) + t * t * c.y;
      const up = i % 2 === 0 ? -1 : 1;
      for (let d = 0; d <= big; d++) { this.put(x + up * (1 + d), y - 1, R.bush[3]!); this.put(x + up * (1 + d), y, R.bush[2]!); }
    }
    this.rose(end.x, end.y + 1, z, hash2(seed, 6, 417));
  }

  /**
   * The trodden footpaths through the roses: the kit's trail (`paths/trail`, the Booty hut's sand) on the lanes this
   * picture lays (`LANES`): for each pixel the lane nearest it, how far off its middle line and on which side, and how
   * far it runs on beyond.
   */
  private paintLanes(): void {
    const { w } = this;
    const ground: TrailGround = {
      ...this.laidGround(),
      place: (x, y) => {
        const z = depthOfRow(y);
        if (y < this.hz + 2 || z > 90 || y < this.landAt(x) + 2) return null;
        const g = { x: ((x - w / 2) * z) / CROSSROADS.lens, z };
        const near = LANES.reduce((best, lane) => (offLine(g, lane) < offLine(g, best) ? lane : best), LANES[0]!);
        return { off: offLine(g, near), side: sideOf(g, near) > 0 ? 1 : -1, toEnd: near[near.length - 1]!.z - z, gx: g.x, gz: g.z };
      },
    };
    trail.paint(this.brush(), ground, optionsOf(trail, 'footpath'), 0);
  }

  /** The slab map as a path's ground (`kit/paths.ts`): what a path laid where, in the picture's unbent pixels. */
  private laidGround(): Pick<SlabGround, 'width' | 'height' | 'laid' | 'lay'> {
    const { w, h } = this;
    return { width: w, height: h, laid: (x, y) => this.slab[y * w + x]!, lay: (x, y, what) => { this.slab[y * w + x] = what; } };
  }

  /**
   * The grassy rise north of the sauna (all of the area to the left (north) next to the sauna is
   * very much like another grassy knoll; its crest is drawn on our picture): from the left edge it swells up
   * behind the sauna's shoulder and comes down past it to the land; the sauna stands on its flank. Its grass lies in
   * bands along its round, gold along the crest, a light rim against the sky, and tall tufts stand up off the crest in
   * the wind. AX-3 provisional: its height is the painter's, from the drawn line; the world model has no rise there.
   */
  private northRise(foot: number, look: number): void {
    const { peak, left, right, high } = RISE;
    const top = (x: number): number => {
      const q = x < peak ? (x - peak) / left : (x - peak) / right;
      return Math.abs(q) >= 1 ? Infinity : foot - high * (1 - q * q) ** 0.8;
    };
    const side = this.sun.x;
    for (let x = Math.floor(peak - left); x <= peak + right; x++) {
      const y0 = top(x);
      if (!Number.isFinite(y0)) continue;
      const slope = (top(x + 2) - top(x - 2)) / 4;
      // it comes down over the near shore, so no sea shows under it
      const bottom = Math.max(foot + 2, this.landAt(x) + 3);
      for (let y = Math.floor(y0); y <= bottom; y++) {
        const d = (y - y0) / high;
        // flat ribbons along its round, as the 1991 game paints a grassy hill
        const ribbon = fbm(x / 30 - d * 6, d * 14, 2, 451) - 0.5;
        const t = 0.66 - d * 0.32 - slope * side * 0.5 + ribbon * 0.3;
        const run = d < 0.2 + 0.08 * noise2(x / 14, 0, 452) ? GOLD : LUSH;
        this.put(x, y, y < y0 + 1 && !this.hour.night ? beside(F.far, 0.8, 0) : grain(run, tone(run, clamp01(Math.round(t * 5) / 5), x, y, 0), x, y, 0.12));
      }
    }
    // tall grass standing up off the crest against the sky, bent by the gust
    for (let x = Math.floor(peak - left) + 4; x < peak + right - 10; x += 3 + Math.floor(hash2(x, 1, 453) * 5)) {
      const y0 = top(x);
      if (!Number.isFinite(y0) || hash2(x, 2, 454) > 0.35) continue;
      this.tuft(x, Math.round(y0) + 3, 0, 0.6, hash2(x, 3, 455) > 0.5 ? GOLD : LUSH, look);
    }
  }

  /**
   * The small well house right beside the viewer (the reference photograph shows it right next to and behind the camera):
   * the corner of its board wall and the eave of its tin roof at the picture's right edge, dark against the lit field,
   * a wing of the stage (rule 21). Its feet are in the near grass.
   */
  private wellHouse(): void {
    const { w, h } = this;
    const corner = (y: number): number => w - 34 + (h - y) * 0.04 + Math.sin(y / 30) * 1.2;
    /** The eave's edge: from over the corner up and out of the picture, a little wavy as old tin is. */
    const eave = (x: number): number => 98 - (x - (w - 50)) * 0.75 + Math.sin(x / 7) * 0.7;
    this.outlined(() => {
      // the wall: upright boards in the house's shade, each a little different, the corner post lit on its edge
      for (let y = 0; y < h; y++) for (let x = Math.floor(corner(y)); x < w; x++) {
        if (y < eave(x) + 4) continue;
        const from = x - corner(y), board = Math.floor(from / 7), seam = from % 7 < 1;
        const post = from < 3;
        const t = post ? (from < 1 ? 0.7 : 0.5) : 0.16 + 0.22 * hash2(board, 1, 331) + (fbm(x / 4, y / 22, 2, 332) - 0.5) * 0.18 + (from % 7 > 5 ? 0.12 : 0);
        this.put(x, y, seam ? R.near[0]! : tone(F.boards, clamp01(t), x, y, 0));
      }
      // a rail nailed across the boards
      for (let x = Math.floor(corner(190)) + 2; x < w; x++) for (const [dy, c] of [[0, R.earth[3]!], [1, R.earth[2]!], [2, R.earth[2]!], [3, R.earth[0]!]] as const) this.put(x, 190 + dy + (x - w) * 0.05, c);
      this.bucket(corner(158) - 2, 158);
      // the roof's corner over it: the tin's underside in shade, its edge caught by the light, ribs running up the slope
      for (let x = w - 56; x < w; x++) {
        const e = eave(x), thick = 7 + (x - (w - 56)) * 0.12;
        for (let y = Math.max(0, Math.floor(e - thick)); y < e + 4; y++) {
          const c = y > e ? R.near[0]! : y > e - 2 ? R.roof[2]! : (x + Math.round(y * 0.6)) % 5 === 0 ? R.roof[0]! : tone(F.roof, 0.45 + (y - e + thick) * 0.03, x, y, 0);
          this.put(x, y, c);
        }
      }
    }, R.near[0]!);
  }

  // ---- the path

  /** A point of a path's middle line `s` metres from its start, and its direction there. */
  private along(path: CrossroadsPath, s: number): { g: Ground; dir: { x: number; z: number } } | null {
    let left = s;
    for (let i = 1; i < path.points.length; i++) {
      const a = path.points[i - 1]!, b = path.points[i]!;
      const long = Math.hypot(b.x - a.x, b.z - a.z);
      if (left <= long) {
        const t = left / long;
        return { g: { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }, dir: { x: (b.x - a.x) / long, z: (b.z - a.z) / long } };
      }
      left -= long;
    }
    return null;
  }

  /** How long a path is (metres): up to the lighthouse's foot at most. */
  private lengthOf(path: CrossroadsPath): number {
    let long = 0;
    for (let i = 1; i < path.points.length; i++) {
      const a = path.points[i - 1]!, b = path.points[i]!;
      if (a.z > this.tower.z - 4) break;
      long += Math.hypot(b.x - a.x, b.z - a.z);
    }
    return long;
  }

  /**
   * The paths' slabs, far to near: concrete a metre wide, pale and worn on top, cracked, a joint every slab's length
   * with grass in it, the edges broken and grown over. Each slab sits a little askew of the next.
   */
  private paintPaths(): void {
    const { w, h } = this;
    const steps: { path: CrossroadsPath; s: number; long: number }[] = [];
    for (const [k, path] of this.paths.entries()) {
      const long = this.lengthOf(path);
      for (let s = 0; s < long; s += 0.012) steps.push({ path, s: s + k * 1e-4, long });
    }
    // the stem from the viewer's feet to the fork wanders a little, as a path laid by hand does; its ends stay put
    const bent = (step: { path: CrossroadsPath; s: number; long: number }) => {
      const at = this.along(step.path, step.s);
      if (at && step.path.id === 'stem') at.g.x += 0.32 * Math.sin(step.s * 0.75 + 0.8) * Math.sin(Math.PI * Math.min(1, step.s / step.long));
      return at;
    };
    // far to near, so a near slab stands over a far one at the fork
    const places = steps.map((step) => ({ ...step, at: bent(step)! })).filter((p) => p.at && p.at.g.z > 0.4).sort((p, q) => q.at.g.z - p.at.g.z);
    const sections = places.map(({ path, s, at }) => {
      const half = path.wide / 2, across = { x: at.dir.z, z: -at.dir.x };
      return {
        left: onPicture({ x: at.g.x - across.x * half, z: at.g.z - across.z * half }),
        right: onPicture({ x: at.g.x + across.x * half, z: at.g.z + across.z * half }),
        along: s, wide: path.wide, perM: CROSSROADS.lens / at.g.z, path: path.id.length,
      };
    });
    const ground: SlabGround = { ...this.laidGround(), sections, open: (x, y) => x >= 0 && x < w && y >= 0 && y < h && y >= this.landAt(x) };
    slabs.paint(this.brush(), ground, optionsOf(slabs, 'worn', { long: SLAB }), 0);
  }

  /** Marks the slabs' pixels well inside a slab: a blade from the grass before it reaches over its edge and no further. */
  private inside(): void {
    const { w, h } = this;
    const on = (x: number, y: number): boolean => x >= 0 && x < w && this.slab[y * w + x]! > 0;
    const reach = (y: number): number => Math.round(1 + 4 * smooth(this.hz, h, y));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const k = reach(y);
      if (this.slab[y * w + x] === 1 && on(x - k, y) && on(x + k, y)) this.slab[y * w + x] = 3;
    }
  }

  // ---- the houses

  /** The faces of a house that the viewer sees, far to near: its walls, its gables and its roof, drawn `houseScale` larger than to scale round its middle. */
  private faces(house: CrossroadsHouse): Face[] {
    const s = house.id === 'hut-middle' ? CROSSROADS.hutScale : 1;
    const mid = { x: house.corners.reduce((a, c) => a + c.x, 0) / 4, z: house.corners.reduce((a, c) => a + c.z, 0) / 4 };
    const c = house.corners.map((p) => ({ x: mid.x + (p.x - mid.x) * s, z: mid.z + (p.z - mid.z) * s }));
    const b = house.building;
    // the sauna is drawn as the 1991 game draws a hut: taller than it is, under a steep, heavy roof that reaches far out
    const quirk = house.id === 'hut-middle' ? { tall: 1.3, steep: 1.6, out: 0.75 } : { tall: 1, steep: 1, out: 0.3 };
    const wall = (b.walls === 'boards' || b.walls === 'green' ? 2.3 : 2.8) * s * quirk.tall, ridge = wall + (b.shape === 'flat' ? 0.15 : b.short * 0.45 * s * quirk.steep);
    const out: Face[] = [];
    const eye = { x: 0, z: 0 };
    const shade = (nx: number, nz: number): number => nx * this.sun.x + nz * this.sun.z;
    // the long sides are 0 to 1 and 2 to 3 (`buildingCorners`); the short ones are the gables
    for (let i = 0; i < 4; i++) {
      const p = c[i]!, q = c[(i + 1) % 4]!;
      const ex = q.x - p.x, ez = q.z - p.z, long = Math.hypot(ex, ez);
      // the outward normal
      let nx = ez / long, nz = -ex / long;
      const toMid = (mid.x - p.x) * nx + (mid.z - p.z) * nz;
      if (toMid > 0) { nx = -nx; nz = -nz; }
      const mx = (p.x + q.x) / 2, mz = (p.z + q.z) / 2;
      if ((eye.x - mx) * nx + (eye.z - mz) * nz <= 0) continue;
      const gable = i % 2 === 1 && b.shape !== 'flat';
      const top = gable ? (u: number) => wall + (ridge - wall) * (1 - Math.abs(2 * u - 1)) : () => wall;
      out.push({
        kind: gable ? 'gable' : 'wall', side: i, lit: shade(nx, nz), far: Math.hypot(mx, mz), wide: long, high: gable ? ridge : wall,
        at: (u, v) => ({ g: { x: p.x + ex * u, z: p.z + ez * u }, up: v * top(u) }),
        flat: (u, v) => ({ g: { x: p.x + ex * u, z: p.z + ez * u }, up: v * wall }),
      });
    }
    if (b.shape !== 'flat') {
      // the roof: two planes from the eaves of the long sides up to the ridge, each overhanging a little
      const ridgeA = { x: (c[0]!.x + c[3]!.x) / 2, z: (c[0]!.z + c[3]!.z) / 2 }, ridgeB = { x: (c[1]!.x + c[2]!.x) / 2, z: (c[1]!.z + c[2]!.z) / 2 };
      const along = { x: ridgeB.x - ridgeA.x, z: ridgeB.z - ridgeA.z }, al = Math.hypot(along.x, along.z);
      const over = (quirk.out + 0.05) * s / al;
      for (const [e0, e1] of [[c[0]!, c[1]!], [c[3]!, c[2]!]] as const) {
        const em = { x: (e0.x + e1.x) / 2, z: (e0.z + e1.z) / 2 }, rm = { x: (ridgeA.x + ridgeB.x) / 2, z: (ridgeA.z + ridgeB.z) / 2 };
        const run = Math.hypot(em.x - rm.x, em.z - rm.z), rise = ridge - wall;
        // its normal leans out over the eave and up
        const nx = ((em.x - rm.x) / run) * rise, nz = ((em.z - rm.z) / run) * rise, ny = run;
        const nl = Math.hypot(nx, ny, nz);
        const seen = (0 - em.x) * nx + (CROSSROADS.eye - wall) * ny + (0 - em.z) * nz;
        if (seen <= 0) continue;
        out.push({
          kind: 'roof', side: 9, flat: () => ({ g: { x: 0, z: 1 }, up: 0 }), lit: (nx * this.sun.x + nz * this.sun.z) / nl * 0.8 + 0.35, far: Math.hypot(em.x, em.z) + 0.01, wide: al, high: Math.hypot(run, rise),
          at: (u, v) => {
            const uu = -over + u * (1 + 2 * over);
            const eave = { x: e0.x + (e1.x - e0.x) * uu + ((em.x - rm.x) / run) * quirk.out * s * (1 - v), z: e0.z + (e1.z - e0.z) * uu + ((em.z - rm.z) / run) * quirk.out * s * (1 - v) };
            const top = { x: ridgeA.x + along.x * uu, z: ridgeA.z + along.z * uu };
            // the ridge sags in its middle, an old roof's
            return { g: { x: eave.x + (top.x - eave.x) * v, z: eave.z + (top.z - eave.z) * v }, up: wall - quirk.out * 0.8 * s * (1 - v) + rise * v + Math.sin(u * Math.PI) * -0.3 * s * v };
          },
        });
      }
    }
    return out.sort((p, q) => q.far - p.far);
  }

  /** The colour of a house's face at (u, v): boards, plaster or a roof, in flat tones by how the face is turned to the light. */
  private faceColour(house: CrossroadsHouse, face: Face, u: number, v: number, x: number, y: number): number {
    const b = house.building;
    const light = clamp01(0.5 + face.lit * 0.38);
    if (face.kind === 'roof') {
      const runs = b.roof === 'red' ? F.iron : b.roof === 'blue' ? F.sea : F.roof;
      // seams of the tin from eave to ridge, the eave's edge pale
      const seam = Math.floor(u * face.wide * 2.2) !== Math.floor((u + 0.004) * face.wide * 2.2);
      return v < 0.06 ? beside(runs, light, 1) : seam ? beside(runs, light, -1) : tone(runs, clamp01(light + (fbm(u * 6, v * 3, 2, 140) - 0.5) * 0.25), x, y, 0);
    }
    const plank = Math.floor(u * face.wide * 6);
    if (house.id === 'hut-middle') return this.saunaBoards(face, u, v, x, y, light);
    if (b.walls === 'green' || b.walls === 'boards') {
      const run = b.walls === 'green' ? F.boards : F.earth;
      const seam = Math.floor(u * face.wide * 6) !== Math.floor((u + 0.006) * face.wide * 6);
      // under the eaves the wall is in the roof's shade
      const eaves = face.kind === 'wall' && v > 0.86 ? -0.3 : 0;
      return seam ? beside(run, light, -2) : tone(run, clamp01(light + eaves + (hash2(plank, face.side, 141) - 0.5) * 0.22 - v * 0.05), x, y, 0);
    }
    const run = b.walls === 'yellow' ? F.dry : F.shingle;
    return tone(run, clamp01(light + (fbm(u * 5, v * 4, 2, 142) - 0.5) * 0.2 + (face.kind === 'wall' && v > 0.85 ? -0.25 : 0)), x, y, 0);
  }

  /**
   * The sauna's walls in a kinder light than the real, weathered hut has (it looks flimsy in
   * real life, so it is rendered in better light than it actually has): level mint-green clapboards, fresh, a
   * shadow line under each, red-brown corner boards, as on the reference photograph.
   */
  private saunaBoards(face: Face, u: number, v: number, x: number, y: number, light: number): number {
    const lit = clamp01(light + 0.14);
    if (u < 0.035 || u > 0.965) return beside(F.iron, lit, 0);
    const up = v * face.high * 5;
    // under the eaves the wall is in the roof's shade
    const eaves = face.kind === 'wall' && v > 0.86 ? -0.28 : 0;
    if (up - Math.floor(up) < 0.16) return beside(F.boards, clamp01(lit + eaves), -2);
    return tone(F.boards, clamp01(Math.round((lit + eaves + (hash2(Math.floor(up), face.side, 141) - 0.5) * 0.12) * 4) / 4), x, y, 0);
  }

  /**
   * A house from its corners in the world model: its faces far to near, each filled point by point, then what is on it,
   * and a dark line round it. The sauna, the nearest, leans: an old board hut gone crooked (rule 25).
   */
  private house(house: CrossroadsHouse): void {
    const near = house.id === 'hut-middle';
    // it leans a little, as a hut in the 1991 game does, but it stands firm: not the flimsy hut it is
    if (near) this.shear = { foot: Math.max(...house.corners.map((c) => onPicture(c).y)), k: -0.06 };
    this.outlined(() => this.houseFaces(house), near ? R.near[0]! : R.roof[0]!);
    this.shear = { foot: 0, k: 0 };
  }

  private houseFaces(house: CrossroadsHouse): void {
    for (const face of this.faces(house)) {
      const a = onPicture(face.at(0, 0).g), b = onPicture(face.at(1, 1).g, face.at(1, 1).up);
      const n = Math.ceil(Math.max(8, Math.hypot(b.x - a.x, b.y - a.y)) * 1.8);
      const m = Math.ceil(Math.max(6, (CROSSROADS.lens * face.high) / Math.max(1, face.at(0.5, 0).g.z)) * 1.8);
      for (let i = 0; i <= n; i++) for (let j = 0; j <= m; j++) {
        const u = i / n, v = j / m;
        const p = face.at(u, v);
        if (p.g.z < 0.5) continue;
        const s = onPicture(p.g, p.up);
        // the wall's lines bend a little, as nothing in these pictures is ruler-straight
        const bend = Math.sin(v * Math.PI) * (noise2(face.side * 3.1, u * 2, 143) - 0.5) * 1.2;
        this.put(s.x + bend, s.y, this.faceColour(house, face, u, v, Math.round(s.x), Math.round(s.y)));
      }
      if (house.id === 'hut-middle') this.hutDetails(face);
    }
    if (house.building.chimney) this.chimney(house);
  }

  /** A point on a face in the picture. */
  private onFace(face: Face, u: number, v: number, flat = false): { x: number; y: number } {
    const p = flat ? face.flat(u, v) : face.at(u, v);
    return onPicture(p.g, p.up);
  }

  /** Fills the part of a face from (u0, v0) to (u1, v1) with `colour(u, v)`. */
  private patch(face: Face, u0: number, v0: number, u1: number, v1: number, colour: (u: number, v: number) => number): void {
    const a = this.onFace(face, u0, v0, true), b = this.onFace(face, u1, v1, true);
    const n = Math.ceil(Math.abs(b.x - a.x) * 2) + 2, m = Math.ceil(Math.abs(b.y - a.y) * 2) + 2;
    for (let i = 0; i <= n; i++) for (let j = 0; j <= m; j++) {
      const u = i / n, v = j / m;
      const s = this.onFace(face, u0 + (u1 - u0) * u, v0 + (v1 - v0) * v, true);
      this.put(s.x, s.y, colour(u, v));
    }
  }

  /**
   * What is on the green hut (the reference photograph): a window in the gable toward the viewer, a door with a white
   * sign beside it on the long side, the porch's dark mouth at its far end. KERI-TODO: what the sign shows.
   */
  private hutDetails(face: Face): void {
    // at night a lamp burns inside: the panes glow warm (someone is in the sauna)
    const pane = (v: number): number => (this.lampsBurn ? (v > 0.5 ? R.ember[4]! : R.ember[3]!) : v > 0.5 ? R.sky[3]! : R.sea[1]!);
    const glass = (u: number, v: number): number => (u < 0.12 || u > 0.88 || v < 0.1 || v > 0.9 || Math.abs(u - 0.5) < 0.08 || Math.abs(v - 0.5) < 0.07 ? (this.lampsBurn ? R.earth[1]! : R.bloom[0]!) : pane(v));
    if (face.kind === 'gable') this.lamp(30, () => this.patch(face, 0.34, 0.4, 0.66, 0.9, glass));
    if (face.kind === 'wall' && face.lit > -2) {
      // the door, dark wood, and the sign beside it
      this.patch(face, 0.42, 0, 0.58, 0.78, (u, v) => (u < 0.08 || u > 0.92 || v > 0.94 ? R.roof[2]! : v > 0.45 && v < 0.5 ? R.roof[0]! : R.roof[1]!));
      this.patch(face, 0.16, 0.34, 0.33, 0.68, (u, v) => (u < 0.06 || u > 0.94 || v < 0.06 || v > 0.94 ? R.stone[2]! : hash2(Math.round(u * 9), Math.round(v * 7), 144) > 0.7 ? R.stone[3]! : R.bloom[0]!));
      // the porch: its open front in shade, a post at its corner
      this.patch(face, 0.8, 0, 0.98, 0.84, (u, v) => (u > 0.86 ? R.iron[1]! : v < 0.4 ? beside(F.boards, 0.6, 0) : R.near[0]!));
    }
  }

  /** The brick chimney on the ridge, tall and crooked, bent the other way to the hut's lean, a wider cap on top. */
  private chimney(house: CrossroadsHouse): void {
    const roof = this.faces(house).find((f) => f.kind === 'roof');
    if (!roof) return;
    const base = this.onFace(roof, 0.36, 1);
    const tall = Math.max(8, Math.round(((CROSSROADS.lens * 1.1) / roof.at(0.36, 1).g.z) * CROSSROADS.hutScale * 0.85)), wide = Math.max(4, Math.round(tall * 0.42));
    for (let k = 0; k < tall; k++) {
      const cap = k > tall - 3;
      const bent = Math.sin((k / tall) * Math.PI * 0.8) * 2.2 + k * 0.1;
      for (let i = cap ? -1 : 0; i < wide + (cap ? 1 : 0); i++) {
        const x = base.x - wide / 2 + i + bent, y = base.y + 2 - k;
        const lit = (i / wide - 0.5) * this.sun.x > 0;
        this.put(x, y, cap ? (k === tall - 1 ? R.stone[2]! : R.stone[1]!) : (k + (i >> 1)) % 3 === 0 ? R.bloom[3]! : lit ? R.iron[2]! : R.bloom[2]!);
      }
    }
  }

  // ---- the lighthouse

  /**
   * Keri lighthouse, as the reference photographs show it: a fat limestone drum, hardly narrower at the top
   * than at its foot, with a rim and a railing round its flat top; on it a tall rust-red iron column, flared at its foot
   * like a trumpet's bell, a bell and a plate hung on it, a gallery on brackets near its top, then the lantern with its
   * own railing, a round dome and a ball. In every scene the lighthouse is drawn grand (a rule): it is
   * drawn larger than true, its foot sunk behind the dog roses before it, the lightning rod running off the picture's
   * top. The light lies in a few bands whose border curves round the drum, with a dark line round the whole.
   */
  private lighthouse(): void {
    const at = onPicture(this.tower);
    const T = CROSSROADS.towerTall * TOWER.grand, cx0 = at.x, footY = at.y + TOWER.sink;
    const drumTop = footY - T * 0.54, r0 = TOWER.r0, r1 = TOWER.r1;
    const side = this.sun.x, front = -this.sun.z;
    /** Its middle at a row: it leans two pixels over its height, bent a little on the way. */
    const mid = (y: number): number => cx0 + ((footY - y) / T) * 2 + Math.sin(((footY - y) / T) * Math.PI) * 1;
    /** The light across its round, in four bands with wobbly borders: no smooth falloff (rule 12). */
    const lightAt = (u: number, x = 0, y = 0): number => clamp01(Math.round((0.48 + u * side * 0.5 + front * 0.14 + (noise2(x / 3, y / 5, 154) - 0.5) * 0.16) * 4) / 4);
    const HOOPS = [0.66, 0.84];
    this.outlined(() => {
      for (let y = Math.round(drumTop); y <= footY + 1; y++) {
        const s = (y - drumTop) / (footY - drumTop);
        // nearly upright, a little wider at the foot, a slight belly
        const r = r1 + (r0 - r1) * s + Math.sin(s * Math.PI) * 1.5;
        for (let x = Math.floor(mid(y) - r); x <= Math.ceil(mid(y) + r); x++) {
          const u = (x - mid(y)) / r;
          if (Math.abs(u) > 1) continue;
          // the bands bow down in the middle: the viewer looks up at the drum
          const bow = -(1 - u * u) * 3;
          const band = (y + bow - drumTop) / (footY - drumTop);
          if (HOOPS.some((b) => Math.abs(band - b) < 0.014)) { this.put(x, y, u * side > 0.15 ? R.iron[1]! : R.iron[0]!); continue; }
          // stone in big blocks: a darker seam every five rows, the blocks staggered, weathered streaks down the wall
          const row = Math.floor((y + bow) / 5);
          const course = Math.floor(y + bow) % 5 === 0 || (Math.floor(x + (row % 2) * 3) % 7 === 0 && hash2(Math.floor(x / 7), row, 153) > 0.4);
          // the border of light and shade curves round the drum
          const t = lightAt(u + 0.18 * Math.sin(s * Math.PI) * side - 0.08 * side, x, y) - (fbm(x / 3, y / 14, 2, 152) > 0.72 ? 0.14 : 0) - (course ? 0.1 : 0);
          this.put(x, y, tone(F.lime, clamp01(t), x, y, 0));
        }
      }
      // the rim round the flat top: a course standing out, its underside in shade
      for (let k = -2; k <= 1; k++) {
        const y = Math.round(drumTop) + k, r = r1 + 2.5;
        for (let x = Math.floor(mid(y) - r); x <= Math.ceil(mid(y) + r); x++) {
          const u = (x - mid(y)) / r;
          this.put(x, y, k === 1 ? R.lime[0]! : k === 0 ? R.lime[1]! : u * side > 0 ? R.lime[4]! : R.lime[2]!);
        }
      }
      // a small window high on the drum, near its middle as on the photographs, its sill lit
      const wy = Math.round(drumTop + 12), wx = mid(wy) + r1 * 0.12 * Math.sign(side || 1);
      for (let y = wy; y < wy + 8; y++) for (const k of [0, 1, 2]) this.put(wx + k, y, y === wy + 4 && k === 1 ? R.lime[1]! : R.ink);
      for (const k of [-1, 0, 1, 2, 3]) this.put(wx + k, wy + 8, R.lime[4]!);
      this.ironTop(mid, drumTop, r1, T, (u) => lightAt(u));
    }, R.lime[0]!);
  }

  /** The railing round a flat top at row `y`, `r` pixels out from the middle: a top rail and posts, in iron. */
  private railing(mid: (y: number) => number, y: number, r: number, tall: number): void {
    for (let x = Math.floor(mid(y) - r); x <= mid(y) + r; x++) {
      this.put(x, y - tall, R.ink);
      if (Math.round(x - mid(y)) % 4 === 0) for (let k = 1; k < tall; k++) this.put(x, y - k, R.ink);
    }
  }

  /**
   * The iron column on the drum: flared at its foot, a bell and a plate hung on it, its gallery on brackets near the
   * top, the lantern with its railing, the dome and the ball.
   */
  private ironTop(mid: (y: number) => number, drumTop: number, r1: number, T: number, lightAt: (u: number) => number): void {
    const side = this.sun.x;
    this.railing(mid, Math.round(drumTop) - 3, r1 + 1.5, 5);
    const galleryAt = drumTop - T * 0.24;
    const iron = (x: number, y: number, u: number): void => {
      const seam = Math.abs(Math.abs(u) - 0.45) < 0.08;
      this.put(x, y, seam ? R.iron[0]! : tone(F.iron, lightAt(u), x, y, 0));
    };
    // the column, a little narrower upward, its foot flared out over the drum's top
    for (let y = Math.round(galleryAt); y < drumTop - 1; y++) {
      const up = (drumTop - y) / (drumTop - galleryAt);
      const ir = 8 - up * 1.5 + 7 * Math.max(0, 1 - (drumTop - y) / 10) ** 2;
      for (let x = Math.floor(mid(y) - ir); x <= Math.ceil(mid(y) + ir); x++) {
        const u = (x - mid(y)) / ir;
        if (Math.abs(u) <= 1) iron(x, y, u);
      }
    }
    // a small window in the column
    for (let y = Math.round(galleryAt + T * 0.08); y < galleryAt + T * 0.08 + 5; y++) for (const k of [-1, 0]) this.put(mid(y) + k, y, R.ink);
    this.bellAndPlate(mid, drumTop);
    // the gallery: a heavy floor wider than the column on iron brackets, its rail
    const gy = Math.round(galleryAt), gr = 14;
    for (let x = Math.floor(mid(gy) - gr); x <= mid(gy) + gr; x++) {
      const u = (x - mid(gy)) / gr;
      this.put(x, gy, u * side > 0 ? R.iron[2]! : R.iron[1]!); this.put(x, gy + 1, R.iron[1]!); this.put(x, gy + 2, R.ink);
    }
    for (const sgn of [-1, 1]) for (const reach of [0.55, 0.95]) for (let k = 0; k <= 7; k++) this.put(mid(gy) + sgn * (7 + (gr * reach - 7) * (1 - k / 7)), gy + 2 + k, R.ink);
    this.railing(mid, gy - 1, gr, 5);
    // a short neck of iron, then the lantern on its own little floor and railing
    for (let y = gy - 7; y < gy - 1; y++) for (let x = Math.floor(mid(y) - 5.5); x <= mid(y) + 5.5; x++) iron(x, y, (x - mid(y)) / 5.5);
    this.lantern(mid, gy - 7);
  }

  /** The bell hung on the column's left above its flare, and the plate on its right (the reference photographs). */
  private bellAndPlate(mid: (y: number) => number, drumTop: number): void {
    const side = this.sun.x;
    // the bell, hung on the column's left above the flare, and the plate on its right (the photographs)
    const by = Math.round(drumTop - 18), bx = mid(by) - 13;
    // its arm out from the column
    for (let x = bx; x <= mid(by) - 6; x++) this.put(x, by - 2, R.ink);
    this.put(bx, by - 1, R.ink);
    for (let k = 0; k < 6; k++) for (let i = -1 - (k >> 1); i <= 1 + (k >> 1); i++) this.put(bx + i, by + k, k === 5 ? R.ink : i * side > 0 ? R.dry[1]! : R.dry[0]!);
    const px = Math.round(mid(by) + 10);
    for (let y = by - 8; y < by + 6; y++) for (let i = 0; i < 4; i++) this.put(px + i, y, i === 0 || i === 3 || (y - by) % 3 === 0 ? R.ink : R.stone[3]!);
    for (const y of [by - 6, by + 3]) for (let x = Math.round(mid(y) + 6); x < px; x++) this.put(x, y, R.ink);
  }

  /** The lantern on its little floor at row `lb`, its railing, the dome round as a pot lid, its ball and the lightning rod. */
  private lantern(mid: (y: number) => number, lb: number): void {
    const side = this.sun.x;
    for (let x = Math.floor(mid(lb) - 10); x <= mid(lb) + 10; x++) { this.put(x, lb, R.iron[1]!); this.put(x, lb + 1, R.ink); }
    const lr = 7, lTop = lb - 12;
    this.lamp(56, () => {
      for (let y = lTop; y < lb; y++) for (let x = Math.floor(mid(y) - lr); x <= mid(y) + lr; x++) {
        const u = (x - mid(y)) / lr;
        const frame = Math.abs(u) > 0.86 || Math.round(x - mid(y)) % 4 === 0 || y === lTop;
        this.put(x, y, frame ? R.ink : this.lampsBurn ? (Math.abs(u) < 0.45 ? R.moon[0]! : R.ember[4]!) : u * side > 0 ? R.sky[4]! : R.sky[2]!);
      }
    });
    this.railing(mid, lb - 1, 10, 5);
    // the dome, round as a pot lid, its ball and the lightning rod
    for (let k = 0; k < 7; k++) {
      const half = (lr + 1.5) * Math.sqrt(1 - (k / 7) ** 2);
      for (let x = Math.floor(mid(lTop) - half); x <= mid(lTop) + half; x++) {
        const u = (x - mid(lTop)) / (lr + 1.5);
        this.put(x, lTop - 1 - k, u * side > 0.15 ? R.iron[2]! : u * side > -0.3 ? R.iron[1]! : R.iron[0]!);
      }
    }
    const top = mid(lTop);
    for (const [dx, dy] of [[0, -8], [1, -8], [0, -9], [1, -9]] as const) this.put(top + dx, lTop + dy, dx > 0 ? R.iron[2]! : R.iron[1]!);
    for (let k = 10; k < 16; k++) this.put(top, lTop - k, R.ink);
  }

  // ---- the grass

  /**
   * The grass, row by row from far to near, so each row stands before the one behind: fine blades in the middle
   * distance, broad tufts near the viewer, a few tones up or down the run from the ground it grows on, bent by the gust
   * of the look. Things
   * that stand on the ground (the houses, the lighthouse, the far bushes) are put in when the rows reach their feet, so
   * the grass before them hides their feet. Nothing grows out of a slab but in its joints.
   */
  private grass(look: number): void {
    const { w, h } = this;
    const stand: { foot: number; draw: () => void }[] = [
      ...this.houses.map((house) => ({ foot: Math.max(...house.corners.map((c) => onPicture(c).y)), draw: () => this.house(house) })),
      { foot: onPicture(this.tower).y, draw: () => this.lighthouse() },
      { foot: onPicture(this.tower).y + 1.5, draw: () => this.farBushes() },
      { foot: onPicture(this.knollAt).y, draw: () => this.knoll(this.knollAt) },
      { foot: this.saunaFoot() - 0.5, draw: () => this.northRise(this.saunaFoot() + 1, look) },
      ...this.caneSpots().map(({ foot, draw }) => ({ foot, draw: () => draw(look) })),
    ].sort((a, b) => a.foot - b.foot);
    let next = 0;
    this.roseH = new Float32Array(w);
    this.roseTop = new Float32Array(w).fill(Infinity);
    for (let y = this.hz + 1; y < h + 18; y++) {
      while (next < stand.length && stand[next]!.foot <= y) stand[next++]!.draw();
      if (y < h) this.roseRow(y);
      else this.roseH.fill(0);
      const z = depthOfRow(Math.min(y, h - 1));
      if (z > 60) continue;
      for (let x = -4; x < w + 4; x++) {
        // nothing grows out of a rose thicket's foot: it is under the leaves
        if (y < this.landAt(x) + 3 || this.roseH[Math.max(0, Math.min(w - 1, x))]! > 0) continue;
        if (y < h && hash2(x, y, 471) < 0.62) this.mark(x, y);
        // over the blades, longer grass in tufts, sparser toward the viewer where each is bigger
        const near = smooth(this.hz, h, y);
        if (hash2(x, y, 161) > (this.byPath(Math.max(0, Math.min(w - 1, x)), Math.min(h - 1, y), 10) ? 0.3 : 0.07) - near * 0.02) continue;
        const yy = Math.min(h - 1, y), xx = Math.max(0, Math.min(w - 1, x));
        const on = y < h ? this.slab[yy * w + xx]! : 0;
        if (on === 1 || on === 3 || (on === 2 && hash2(x, y, 162) > 0.3)) continue;
        const ground = this.field(xx, yy);
        const run = this.grassRun(x, y, hash2(x, y, 163));
        // near the viewer the grass is laid in broad brush strokes, a tuft here and there, not a blade on every pixel
        if (near > 0.42) {
          // a tuft may lean over a slab's edge, but not hide the path: none grows where the path runs just above its foot
          if (hash2(x, y, 170) < (this.byPath(xx, yy, 18) ? 0.1 : 0.045) && ![0, 8, 16, 24].some((up) => yy - up > this.hz && this.byPath(xx, yy - up, 4 + (up >> 2)))) this.tuft(x, y, near, ground, run, look);
          continue;
        }
        this.blades(x, y, on, near, ground, run, look);
      }
      if (y < h) this.meadowRow(y);
    }
    while (next < stand.length) stand[next++]!.draw();
  }

  /**
   * The meadow's flowers on one row, in drifts as the reference photographs show them left of the path: white heads and
   * rust-red ones in their own patches, held up a little on their stalks over the grass; none on the roses or the slabs.
   */
  private meadowRow(y: number): void {
    const { w } = this;
    const z = depthOfRow(y);
    if (z < 3 || z > 45) return;
    const near = smooth(this.hz, this.h, y), lift = Math.round(2 + near * 14), big = near > 0.45 ? 2 : 1;
    for (let x = 0; x < w; x++) {
      if (this.roseH[x]! > 0 || this.slab[y * w + x]! > 0) continue;
      const gx = ((x - w / 2) * z) / CROSSROADS.lens;
      const drift = smooth(0.5, 0.62, fbm(gx / 4, z / 3, 2, 440)) * (0.4 + 0.6 * this.leftOfHut({ x: gx, z }));
      if (drift <= 0 || hash2(x, y, 441) > 0.16 * drift) continue;
      const red = fbm(gx / 3 + 9, z / 2.5, 2, 442) > 0.55;
      const fy = y - Math.round(lift * (0.5 + hash2(x, y, 443)));
      for (let i = 0; i < big; i++) for (let j = 0; j < big; j++) this.put(x + i, fy + j, red ? (j > 0 ? R.bloom[3]! : R.bloom[2]!) : j > 0 ? R.smoke[1]! : R.bloom[0]!);
    }
  }

  /**
   * One short blade of the meadow, as the knoll lays its grass: one to a few pixels, longer toward the viewer, a few
   * places up or down the run from the ground it stands on and lighter at its tip; none on a slab, none over one.
   */
  private mark(x: number, y: number): void {
    const { w } = this;
    if (x < 0 || x >= w || this.slab[y * w + x]! > 0) return;
    const run = this.turfRun(x, y, hash2(x >> 2, y >> 1, 94));
    const ground = this.field(x, y);
    const long = (1.6 + (y - this.landAt(x)) * 0.036) * (0.45 + 1.1 * hash2(x, y, 472));
    const places = Math.round((hash2(x, y, 473) + hash2(x, y, 474) - 1) * 2.6);
    const lean = WAY * (0.18 + 0.3 * noise2(x / 60, y / 30, 475));
    for (let i = 0; i <= long; i++) {
      const bx = x + Math.round(lean * i), by = y - i;
      if (by < 0 || bx < 0 || bx >= w || this.slab[by * w + bx] === 3) return;
      const up = i > long * 0.62 ? 1 : i < long * 0.22 && long > 3 ? -1 : 0;
      this.put(bx, by, beside(run, ground, places + up));
    }
  }

  /** The blades of the middle distance from one foot: most short, some long, bent by the gust; none grows over a slab. */
  private blades(x: number, y: number, on: number, near: number, ground: number, run: readonly number[], look: number): void {
    const { w, h } = this;
    // most short, some long: the photograph's grass stands high, and highest near the viewer
    const long = (on === 2 ? 0.6 : 1) * (1.2 + near * 26) * (0.35 + 1.3 * hash2(x, y, 164) ** 1.7);
    const places = Math.round((hash2(x, y, 165) + hash2(x, y, 166) - 1) * 1.8);
    const bend = lean(x, y, look, CROSSROADS_FRAMES, WAY, 0.2, 0.35) * (0.6 + 0.8 * noise2(x / 40, y / 25, 167));
    let cut = false;
    // a few blades fanning out from one foot, dark at the foot and light at the tips
    const fan = near > 0.25 ? [-1, 0, 1] : [0];
    const spread = 1 + near * 5 * hash2(x, y, 169);
    for (const f of fan) {
      const tall = long * (f === 0 ? 1 : 0.7);
      for (let i = 0; i <= tall && !cut; i++) {
        const up = i > tall * 0.6 ? 2 : i > tall * 0.3 ? 0 : -2;
        const curve = bend * i * (i / Math.max(1, tall)) + f * spread * (i / Math.max(1, tall));
        const bx = Math.round(x + curve), by = y - i;
        if (by >= 0 && by < h && bx >= 0 && bx < w && this.slab[by * w + bx] === 3) { cut = true; break; }
        const c = beside(run, clamp01(ground * 0.95), places + up);
        this.put(bx, by, c);
      }
    }
    if (cut) return;
    // a feathery seed head on a few of the tallest
    if (long > 12 && hash2(x, y, 168) > 0.93) {
      const tx = x + bend * long, ty = y - long;
      for (const [dx, dy] of [[0, 0], [0, -1], [-1, 0], [1, -1], [0, -2]] as const) this.put(tx + dx, ty + dy, beside(F.dry, 0.8, dy));
    }
  }

  /**
   * The dark foliage nearest the viewer that frames the stage at its lower corners, as in the 1991 game's day scenes:
   * heaps of leaf lumps in the near run's dark greens, lit only along their tops, swaying a little with the gust.
   * They are bushes, which the island has many of; none is in the world model.
   */
  private nearFoliage(look: number): void {
    const sway = swing(groundLook(look), CROSSROADS_FRAMES) * 1.5 * WAY;
    for (const [cx, cy, r, seed] of [[-14, this.h + 12, 96, 1], [118, this.h + 30, 46, 2], [this.w - 18, this.h + 16, 72, 3]] as const) {
      const lumps = Array.from({ length: 7 }, (_, i) => {
        const a = Math.PI * (0.15 + 0.7 * (i / 6)) + (hash2(seed, i, 341) - 0.5) * 0.4;
        const d = r * (0.45 + 0.35 * hash2(seed, i, 342));
        return { x: cx - Math.cos(a) * d * 1.3, y: cy - Math.sin(a) * d, r: r * (0.32 + 0.2 * hash2(seed, i, 343)) };
      });
      for (let y = Math.floor(cy - r * 1.6); y < this.h; y++) for (let x = Math.floor(cx - r * 2); x <= cx + r * 2; x++) {
        let best = -1, of = lumps[0]!;
        for (const [i, l] of lumps.entries()) {
          const lx = l.x + sway * (1 - (y - (cy - r * 1.6)) / (r * 1.6));
          const v = lump(x, y, lx, l.y, l.r, l.r * 0.85, seed * 10 + i + 600);
          if (v > best) { best = v; of = l; }
        }
        if (best < 0) continue;
        // lit only on the top of each lump, the rest in the near run's dark greens, in three bands
        const t = 0.3 - ((y - of.y) / of.r) * 0.5 + (fbm(x / 4, y / 3, 2, seed + 344) - 0.5) * 0.3;
        this.put(x, y, beside([R.near[0]!, R.near[1]!, R.near[1]!, R.near[2]!, R.bush[2]!], clamp01(Math.round(t * 4) / 4), 0));
      }
      // big pointed leaves standing out of the heap's top, each with a lit upper edge and a dark rib
      for (const [i, l] of lumps.entries()) for (let k = 0; k < 3; k++) {
        const a = -Math.PI / 2 + (hash2(seed * 9 + i, k, 345) - 0.5) * 2.2;
        const long = l.r * (0.55 + 0.4 * hash2(seed * 9 + i, k, 346)), wide = long * 0.28;
        const bx = l.x + Math.cos(a) * l.r * 0.75 + sway * 0.6, by = l.y + Math.sin(a) * l.r * 0.75;
        this.leaf(bx, by, a, long, wide);
      }
    }
  }

  /**
   * A wooden bucket hung on a nail at the well house's corner, a little askew: staves in the earth run, two iron bands,
   * its rope handle up to the nail. AX-3 provisional: a well house's bucket, a prop the maintainer has not named.
   */
  private bucket(nx: number, ny: number): void {
    const top = ny + 6, tall = 15, cx = nx - 1;
    for (let k = 0; k < 6; k++) { this.put(cx - 5 + k * 0.9, ny + k, R.dry[1]!); this.put(cx + 5 - k * 0.9, ny + k, R.dry[1]!); }
    this.put(nx, ny, R.ink); this.put(nx, ny - 1, R.ink);
    for (let j = 0; j < tall; j++) {
      const half = 7 - j * 0.12, lean = j * 0.12;
      for (let i = -half; i <= half; i++) {
        const u = i / half, band = j === 2 || j === tall - 3;
        const stave = Math.round(i + 20) % 3 === 0;
        const t = 0.55 + u * this.sun.x * 0.35;
        this.put(cx + i + lean, top + j, band ? (u * this.sun.x > 0.2 ? R.iron[2]! : R.iron[0]!) : stave ? R.earth[0]! : tone(F.earth, clamp01(Math.round(t * 3) / 3), 0, 0, 0));
      }
    }
    for (let i = -7; i <= 7; i++) this.put(cx + i, top, i % 2 === 0 ? R.earth[0]! : R.ink);
  }

  /** The boulders, laid over the grass with a few tufts before their feet so they sit in it, not on it. */
  private rocks(look: number): void {
    for (const [i, [x, y, r]] of ROCKS.entries()) {
      this.rock(x, y, r, 500 + i * 7);
      const near = smooth(this.hz, this.h, y);
      for (const dx of [-r * 1.4, r * 0.2, r * 1.5]) {
        const fx = Math.round(x + dx), fy = Math.round(y + 3 + hash2(i, fx, 176) * 2);
        this.tuft(fx, fy, near * 0.3, this.field(Math.max(0, Math.min(this.w - 1, fx)), Math.min(this.h - 1, fy)), LUSH, look);
      }
    }
  }

  /**
   * A boulder of the painter's kit (`stones/boulder`, the docks' stone, d124; the docks are the model for
   * stones), placed by its foot. A big one is drawn round in the stone's darkest tone, as this
   * picture draws its big shapes; a small one is not (rule 25).
   */
  private rock(cx: number, foot: number, r: number, seed: number): void {
    const o = optionsOf(boulder, r >= 12 ? 'middle' : 'small', { wide: r * 1.35, high: r * 1.25 });
    const draw = (): void => boulder.paint(this.brush(), cx, foot, o, seed);
    if (r >= 12) this.outlined(draw, F.stone[0]!);
    else draw();
  }

  /** The kit's brush on this picture: it paints through `put`, so the bow, the lean and an outline's record apply as to anything painted here. */
  private brush(): KitBrush {
    return { put: (x, y, c) => this.put(x, y, c), run: SHARED.run, fine: SHARED.fine, hour: this.hour, side: Math.max(-1, Math.min(1, this.sun.x * 1.5)) };
  }

  /** One leaf from its foot along `a`: a pointed blade, dark below its rib, lit along its upper edge. */
  private leaf(x0: number, y0: number, a: number, long: number, wide: number): void {
    const ux = Math.cos(a), uy = Math.sin(a), vx = -uy, vy = ux;
    for (let i = 0; i <= long; i += 0.5) {
      const t = i / long, half = wide * Math.sin(Math.PI * t ** 0.8) * (1 - t * 0.2);
      for (let j = -half; j <= half; j += 0.5) {
        const x = x0 + ux * i + vx * j, y = y0 + uy * i + vy * j;
        const upper = j * vy < 0;
        const rim = Math.abs(j) > half - 1;
        this.put(x, y, Math.abs(j) < 0.6 ? R.near[0]! : rim && upper ? R.bush[3]! : upper ? R.near[2]! : R.near[1]!);
      }
    }
  }

  /** Whether a slab of the path is within `r` pixels of a place, on its row. */
  private byPath(x: number, y: number, r: number): boolean {
    for (let k = Math.max(0, x - r); k <= Math.min(this.w - 1, x + r); k++) if (this.slab[y * this.w + k]! > 0) return true;
    return false;
  }

  /** A tuft of the near grass: a few broad strokes fanning out from one foot, dark at the foot and light at the tips, bent by the gust. */
  private tuft(x: number, y: number, near: number, ground: number, run: readonly number[], look: number): void {
    const tall = (10 + near * 30) * (0.45 + 0.8 * hash2(x, y, 171));
    const blades = 3 + Math.floor(hash2(x, y, 172) * 3);
    const bend = lean(x, y, look, CROSSROADS_FRAMES, WAY, 0.2, 0.35);
    const t0 = clamp01(ground * 0.95);
    // the tuft's foot is the grass's darkest green, never the violet the flat ground's shade goes to
    if (run === LUSH) run = LUSH.slice(2);
    // a few tufts carry meadow flowers at their tips: white, yellow, the dog rose's pink
    const flower = hash2(x, y, 174) > 0.93 ? [R.bloom[0]!, R.bloom[1]!, R.rose[3]!][Math.floor(hash2(x, y, 175) * 3)]! : -1;
    for (let b = 0; b < blades; b++) {
      const u = b / (blades - 1) - 0.5, high = tall * (0.6 + 0.4 * hash2(x + b, y, 173));
      const tip: [number, number] = [x + u * (5 + near * 9) + bend * high, y - high];
      const end = this.stroke([x + u * 2, y + 1], [x + u * 3 + bend * high * 0.3, y - high * 0.55], tip, (t) => (t < 0.4 ? 3 : t < 0.75 ? 2 : 1), (t) => beside(run, t0, Math.round(-3 + t * 5)));
      if (flower >= 0 && b % 2 === 0) for (const [dx, dy] of [[0, 0], [1, 0], [0, -1], [1, -1], [-1, 0], [-1, -1], [0, 1], [1, 1], [2, 0], [0, -2]] as const) this.put(end.x + dx, end.y + dy, dx === 0 && dy === 0 ? R.bloom[1]! : flower);
    }
  }

  /**
   * Tall dark tufts nearest the viewer at the lower corners, their feet out of sight: the wings of the stage (rule 21),
   * dark against the lit field as things near the viewer are, bent by the gust, a few with seed heads.
   */
  private wings(look: number): void {
    const { w, h } = this;
    const run = [R.near[0]!, R.near[1]!, R.near[2]!, R.grass[1]!, R.grass[2]!];
    for (let n = 0; n < 40; n++) {
      const right = n % 2 === 1;
      const reach = hash2(n, 1, 171) ** 1.4 * 150;
      const x = right ? w + 4 - reach : -4 + reach;
      const tall = (26 + hash2(n, 2, 172) * 60) * (1 - reach / 190);
      const blades = 5 + Math.floor(hash2(n, 3, 173) * 4);
      for (let b = 0; b < blades; b++) {
        const u = b / blades - 0.5, high = tall * (0.55 + 0.45 * hash2(n, b, 174));
        const bend = lean(x, h - high, look, CROSSROADS_FRAMES, WAY, 0.16, 0.3);
        const tip: [number, number] = [x + u * 22 + bend * high, h - high];
        const end = this.stroke([x + u * 8, h + 6], [x + u * 13, h - high * 0.5], tip, (t) => (t < 0.45 ? 3 : t < 0.8 ? 2 : 1), (t) => run[Math.min(run.length - 1, Math.floor(t * run.length))]!);
        if (hash2(n, b, 175) > 0.8) for (const [dx, dy] of [[0, 0], [0, -1], [-1, -1], [1, -2], [0, -2], [0, -3]] as const) this.put(end.x + dx, end.y + dy, dy < -1 ? R.dry[1]! : R.dry[0]!);
      }
    }
  }

  // ---- the picture

  private painted(look: number): Bitmap {
    const bitmap = createBitmap(this.w, this.h);
    this.px = bitmap.pixels;
    this.slab = new Uint8Array(this.w * this.h);
    // the lamps' panes are found while the land is painted: laid again, it keeps those of the first look
    if (!this.still.laid) this.lamps = [];
    this.live.on = look === 0;
    this.paintSky();
    this.paintSea();
    // the land stands still over the moving sea: painted in the first look, laid again in the others (`StillPart`)
    this.still.paint(() => [this.px, this.sky.marked], () => {
      this.paintGround();
      this.paintLanes();
      this.paintPaths();
      this.inside();
      this.grass(look);
      this.rocks(look);
      this.wings(look);
      this.wellHouse();
      this.unbowed = true;
      this.nearFoliage(look);
      this.unbowed = false;
    });
    this.glow();
    if (look === 0) this.water = this.live.seal(bitmap);
    this.live.on = false;
    return bitmap;
  }

  looks(): { frames: Bitmap[]; fore: Overlay } {
    // the clouds keep above the land's far edge
    return paintLooks(CROSSROADS_FRAMES, this.sky, this.hz + 4, (look) => this.painted(look));
  }
}

/** Paints the crossroads of `world` as planned, for one hour of the sky. */
export function paintCrossroads(world: World, plan: CrossroadsPlan, phase: SkyPhase): CrossroadsPicture {
  const p = new CrossroadsPainter(world, plan, phase);
  const { frames, fore } = p.looks();
  const clouds = CROSSROADS_CLOUDS.map(({ at, spec }) => ({ x: at[0], y: at[1], bitmap: p.cloud(spec) }));
  return { palette: p.palette, frames, fore, clouds, water: p.water!, gull: p.gullTone() };
}
