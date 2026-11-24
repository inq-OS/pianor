import { KNOLL_CLEARING, KNOLL_FIRE, KNOLL_MOON, KNOLL_PLATEAU, knollCrest, knollShore, type KnollPlan, type KnollShore } from '../../../../core/layout/knoll';
import type { SkyPhase } from '../../../../core/sky/skyPhase';
import type { World } from '../../../../core/world/world';
import { createBitmap, type Bitmap } from '../bitmap';
import { fbm, hash2, noise2 } from '../paint/noise';
import { clamp01, smoothstep as smooth } from '../paint/ease';
import { cropTogether, type Overlay } from '../pack';
import { lean, paintLooks, SkyMask, StillPart } from '../paint/motion';
import { LiveRecorder, type LiveWater } from '../paint/live';
import type { SmokeTones } from '../paint/smoke';
import { tintedCloud, type CurlSpec } from './curlCloud';
import { KERI_HOURS, scenePalette, type Hour } from './keriPalette';
import { bushAt, rose, stem } from './kit/bushes';
import { blades, blooms, clump, grassDryness, gravel, meadow, moss, swells, type ClumpDepth } from './kit/grass';
import { optionsOf, type KitBrush, type KitGround } from './kit/kit';
import { beside, lump, part, scatter } from './kit/shape';

/**
 * The picture of the grassy knoll (ft_1_19.AC9), painted as pixel art and not as a lit set: 2D pixel art with
 * soul and depth in the manner of MI2, never trying to look 3D or photorealistic (d111). Small things are flat tones; what shades off goes through
 * the whole run of its material in bands and strokes (d111). Every shape is laid on back to front: the sky
 * and its clouds, the sea with its wave strokes, the rocky shore below where the plateau cuts off, the plateau with its
 * mossy, stony ground, the fire ring by its lip, and dark things near the viewer that close the
 * corners. The hour of the day changes the colours (one palette for each hour), not the drawing. Only the shore's place
 * comes from the world model (`knollShore`); the plateau is the art direction, drawn by the painter (`knollCrest`).
 *
 * What shades off is laid with a grain, not a pattern: neighbours of a run scattered as paint and a scan scatter them
 * (MI2's backgrounds were painted and scanned: 21 to 44 percent of their pixels are lone grains, 0.7 to 1.9 percent
 * checkerboard; an art review found this picture's ordered dither 5 to 9 times MI2's highest).
 */

/** The moon's place in the night's sky. */
const MOON = KNOLL_MOON;

/**
 * Where the light is in this view (to the south-south-west) at each hour: the side it comes from (-1 left, 1 right),
 * the column where it glints on the sea, and where the low sun warms the sky (-1, 0, 1). The colours and the light's
 * strength are Keri's (`keriPalette`); only its place belongs to the view.
 */
const LIGHT: Record<SkyPhase, { side: number; glint: number; warm: number }> = {
  day: { side: 0.4, glint: 410, warm: 0 },
  dawn: { side: -1, glint: 70, warm: -1 },
  dusk: { side: 1, glint: 575, warm: 1 },
  night: { side: 0.5, glint: MOON.x, warm: 0 },
};

/** The knoll paints with Keri's shared palette alone; it has no colours of its own. */
const SHARED = scenePalette();
/** A run's named tones, for things painted flat (a blade, a pebble, a stroke). */
const R = SHARED.run;
/** The whole runs, with the colours between the named tones, for what shades off (the sky, the sea, the hill's body); d111. */
const F = SHARED.fine;


/** The greens of the grass kept short round the fire: the light end of the run. */
const LAWN = part(F.grass, R.grass[2]!, R.grass[4]!);


/** The knoll's palette at an hour: the game's own colours, then Keri's runs. */
export function knollPalette(phase: SkyPhase): readonly number[] {
  return SHARED.at(phase);
}

/** The embers at their three strengths. */
export const EMBER_LOOKS = [0, 1, 2] as const;
/**
 * The looks of the grass, the stems and the sea: one gust of wind running over the hill, shown one after the
 * other in a loop (a few-frame loop, as the painted adventure games moved their water and their grass).
 */
export const KNOLL_FRAMES = 8;
/** The wind of this view blows east, which is to the viewer's left. */
const WAY = -1;

/**
 * The sky's clouds, back to front (d111): each one stroke that rolls up into a head, no two alike, the big
 * fat ones behind the long thin ones, and small flat ones low over the sea. Each has its left edge and top in fine
 * pixels. The sky round the night's moon is left clear.
 */
export const KNOLL_CLOUDS: readonly { at: readonly [number, number]; spec: CurlSpec }[] = [
  // low over the sea, far off: flat streaks and small curls
  { at: [14, 113], spec: { length: 64, girth: 5, belly: 0.4, neck: 1, taper: 0.6, bend: 1, wave: 1, phase: 0.5 } },
  { at: [236, 116], spec: { length: 46, girth: 4, belly: 0.6, neck: 1, taper: 0.6, bend: 1, wave: 1, phase: 1.5 } },
  { at: [404, 110], spec: { length: 58, girth: 6, belly: 0.75, neck: 1, taper: 0.7, bend: 2, wave: 0.8, phase: 0.2, head: { size: 6, turns: 1.1 } } },
  { at: [548, 115], spec: { length: 84, girth: 5, belly: 0.5, neck: 1, taper: 0.5, bend: 1, wave: 1.2, phase: 0.9 } },
  // the big fat ones
  { at: [40, 27], spec: { length: 96, girth: 38, belly: 0.78, neck: 0.9, taper: 1.2, bend: 12, wave: 0.7, phase: 0, rise: 12, head: { size: 26, turns: 1.25 }, curls: [{ at: 0.58, size: 23, turns: 1.15 }, { at: 0.24, size: 14, turns: 1.1 }] } },
  { at: [452, 50], spec: { length: 80, girth: 22, belly: 0.7, neck: 0.8, taper: 1.3, bend: 5, wave: 1, phase: 0.4, head: { size: 17, turns: 1.2 }, curls: [{ at: 0.6, size: 15, turns: 1.1, forward: true }] } },
  // the long thin ones, in front of them: none sweeps up or down like a comet, and no two are mirror images; a long one that rises and falls once, a short heap with its bulk in the middle, a long one that waves with a curl breaking forward
  { at: [84, 62], spec: { length: 160, girth: 18, belly: 0.5, neck: 0.9, taper: 0.65, bend: 6, wave: 1.3, phase: 1.4, rise: 2, head: { size: 18, turns: 1.25 }, curls: [{ at: 0.55, size: 12, turns: 1.1 }] } },
  { at: [214, 26], spec: { length: 64, girth: 36, belly: 0.55, neck: 0.95, taper: 1.2, bend: 3, wave: 0.6, phase: 0.3, rise: 2, head: { size: 21, turns: 1.15 }, curls: [{ at: 0.6, size: 17, turns: 1.1 }, { at: 0.42, size: 12, turns: 1.05 }] } },
  { at: [430, 30], spec: { length: 128, girth: 20, belly: 0.55, neck: 0.9, taper: 0.9, bend: 5, wave: 2.2, phase: 0.1, rise: 0, head: { size: 21, turns: 1.25 }, curls: [{ at: 0.5, size: 12, turns: 1.1, forward: true }] } },
  // and two small ones on their own
  { at: [316, 76], spec: { length: 44, girth: 9, belly: 0.8, neck: 1, taper: 0.8, bend: 4, wave: 0.9, phase: 1.1, head: { size: 9, turns: 1.2 } } },
  { at: [596, 74], spec: { length: 24, girth: 6, belly: 0.8, neck: 1, taper: 0.8, bend: 2, wave: 0.6, phase: 0.3, head: { size: 6, turns: 1.1 } } },
];

/** The far meadow's streaks: the pale greens and the golds, without their darkest. */
const MEADOW = part(F.far, R.far[1]!, R.far[3]!), MEADOW_DRY = part(F.dry, R.dry[1]!, R.dry[3]!);


/** A wave's stroke is this many places up the sea's whole run from the water under it, and its shadow as many down. */
const WAVE = 2;
/** The knoll's strokes lie about twice as thick as the kit's sea's (`LiveWater.cover`). */
const KNOLL_STROKES = 2.2;

/**
 * The dog roses (kibuvits) that close the left side, before the ground that carries on to the left (corner
 * cover; the wild dog rose grows thick, at least 3 m high): one thicket, taller than the viewer, whose top runs from
 * the picture's left edge (row `from`, over the horizon) down to its lower edge (column `to`), heaped of `lumps` leafy lumps.
 */
const ROSES = { from: 98, to: 214, lumps: 24 } as const;
/**
 * The tree that overhangs the knoll from the left (try to fit a tree that looks like
 * the first 1991 game picture, overhanging the knoll from the left side, though it does not actually exist on Keri): a borrowing from
 * the 1991 game's night shore, not a Keri tree. A low, twisted trunk leans in from outside the picture over the roses
 * and throws its limbs out to the right over the plateau; its crown is flat tiers of leaf, lit on top and near-black
 * under, with the sky between them. Each limb runs from `a` by `b` to `c`, `r` thick at `a` and `end` of that at `c`;
 * each tier stands round (`x`, `y`), `half` wide each way and `thick` from its top to its underside.
 */
type Point = readonly [number, number];
// The trunk stands 28 pixels right of where it was first painted (the tree seemed to be hidden too
// far left and should come slightly out so that the bush does not cover it), out of the roses against the sea, with the
// dry stems in front of it and Puuvaim's face (`PUUVAIM`); the crown's far reach over the plateau stays where it was,
// short of the fire's smoke.
const LIMBS: readonly { a: Point; b: Point; c: Point; r: number; end: number }[] = [
  // the trunk out of the roses: a stem bending left then right, and a thinner one wound round it
  { a: [128, 208], b: [114, 154], c: [98, 132], r: 12, end: 0.82 },
  { a: [98, 132], b: [82, 110], c: [108, 97], r: 9.8, end: 0.8 },
  { a: [142, 210], b: [140, 160], c: [112, 142], r: 7, end: 0.8 },
  { a: [112, 142], b: [90, 130], c: [96, 110], r: 5.6, end: 0.75 },
  // back over the roses to the left edge, and up into the crown
  { a: [102, 100], b: [68, 82], c: [-6, 78], r: 6.5, end: 0.45 },
  { a: [108, 98], b: [120, 70], c: [160, 62], r: 6, end: 0.4 },
  { a: [154, 82], b: [172, 62], c: [204, 56], r: 3.5, end: 0.4 },
  // the long limb out over the plateau, sagging once at its end
  { a: [106, 98], b: [174, 74], c: [244, 86], r: 8, end: 0.3 },
  { a: [242, 86], b: [254, 94], c: [266, 90], r: 2.6, end: 0.4 },
];
const TIERS: readonly { x: number; y: number; half: number; thick: number }[] = [
  { x: 122, y: 60, half: 80, thick: 36 },
  { x: 42, y: 66, half: 74, thick: 40 },
  { x: 208, y: 68, half: 58, thick: 24 },
  { x: 92, y: 90, half: 48, thick: 16 },
  { x: 170, y: 88, half: 40, thick: 14 },
  { x: -12, y: 102, half: 40, thick: 20 },
  { x: 246, y: 82, half: 30, thick: 12 },
];
/** Right of this column the land below the plateau is rocky shore, not meadow (the lower land in the right-back is actually rocky shore); it turns over `wide` pixels. */
const ROCKY = { from: 360, wide: 60 } as const;

/**
 * Logs to sit on round the fire (a few logs people sit on; later, of straight even ones with a
 * sawn end, that they looked as if made in a factory). Each is a found trunk, no two alike: from its butt `a` to
 * its tip `b` in fine pixels, bent sideways by `bend` pixels at its middle, `r` thick at the butt and `taper` of that
 * at the tip, with the stub of a branch at `stub` of its length (none when left out), and whether it lies behind the
 * fire (on the hill's top, against the sea).
 */
export interface KnollLog {
  a: readonly [number, number];
  b: readonly [number, number];
  bend: number;
  r: number;
  taper: number;
  stub?: number;
  back?: boolean;
}
export const KNOLL_LOGS: readonly KnollLog[] = [
  { a: [372, 159], b: [331, 152], bend: 3.5, r: 4.2, taper: 0.42, stub: 0.55, back: true },
  { a: [213, 174], b: [254, 189], bend: 4.5, r: 5.2, taper: 0.4, stub: 0.62 },
  { a: [333, 191], b: [377, 170], bend: 5, r: 5.8, taper: 0.5, stub: 0.3 },
  { a: [314, 192], b: [281, 197], bend: -2.5, r: 5.4, taper: 0.66 },
];

/** The colour of a log's wood: `v` from -1 on its top to 1 underneath, `grain` the streak along it, `worn` how far down its top is worn pale. */
function woodAt(v: number, grain: number, worn: number): number {
  if (v < -0.2 - 0.5 * (worn - 0.35)) return grain > 0.3 ? (grain > 0.56 ? R.shingle[3]! : R.shingle[2]!) : R.earth[3]!;
  if (v < 0.3) return grain > 0.64 ? R.earth[3]! : grain < 0.3 ? R.earth[1]! : R.earth[2]!;
  if (v < 0.7) return grain > 0.58 ? R.earth[2]! : R.earth[1]!;
  return grain > 0.7 ? R.earth[1]! : R.earth[0]!;
}

/** A log's middle line at `t` (0 its butt, 1 its tip): a bow, with a slight kink past the middle. */
export function logSpine(log: KnollLog, t: number): { x: number; y: number } {
  const [ax, ay] = log.a, [bx, by] = log.b, long = Math.hypot(bx - ax, by - ay);
  const bow = Math.sin(t * Math.PI) * log.bend + Math.sin(t * Math.PI * 2 + 0.6) * log.bend * 0.28;
  return { x: ax + (bx - ax) * t + ((by - ay) / long) * bow, y: ay + (by - ay) * t - ((bx - ax) / long) * bow };
}

/** Scuffed patches where feet rest before the logs: middle, half width, half height. */
const SCUFFS: readonly (readonly [number, number, number, number])[] = [[240, 175, 13, 4], [352, 176, 12, 4], [298, 186, 15, 3.5], [340, 162, 10, 3]];

/** Round the fire the ground is trodden bare: about this oval, in fine pixels from the fire's middle; its edge runs in and out (`clearing`). */
const TRODDEN = { dy: 3, rx: 66, ry: 15 } as const;
/** The rows of clumps follow the hill's crest, each this much lower than the last; lower on the hill they are further apart. */
const sweepRow = (k: number): number => 5 + k * 3.2 + k * k * 0.55;
/** How far a blade's top leans at (`x`, `y`) in `look`, as a share of its height: a gust runs over the hill through the looks (`paint/motion.ts`). */
const bent = (x: number, y: number, look: number): number => lean(x, y, look, KNOLL_FRAMES, WAY);

/** The dry stems that reach into the upper left corner: the foot's column at the lower edge, the seed head's place and size, its rays. */
const STEMS: readonly { foot: number; top: readonly [number, number]; size: number; rays: number }[] = [
  { foot: 46, top: [16, 130], size: 17, rays: 9 },
  { foot: 55, top: [34, 99], size: 21, rays: 11 },
  { foot: 109, top: [116, 170], size: 16, rays: 9 },
  { foot: 122, top: [140, 92], size: 19, rays: 10 },
  { foot: 128, top: [156, 136], size: 14, rays: 8 },
];

/** A cloud of the knoll's sky: its picture in the palette's colours and where it stands when nothing moves. */
export interface KnollCloud {
  x: number;
  y: number;
  bitmap: Bitmap;
}

export interface KnollPicture {
  palette: readonly number[];
  /** The whole picture in each look of the grass and the sea (`KNOLL_FRAMES`), the sky bare: the clouds drift over it. */
  frames: Bitmap[];
  /** In each look, what stands before the sky where the clouds go (the stems): laid over the drifting clouds. */
  fore: Overlay;
  /** The clouds, back to front (`KNOLL_CLOUDS`). */
  clouds: KnollCloud[];
  /** The embers and their light on the stones, a frame for each strength (`EMBER_LOOKS`). */
  embers: Overlay;
  /** The smoke's tones (`paint/smoke.ts`): its lit side, its middle, where it leaves the embers, its shaded side. */
  smoke: SmokeTones;
  /** What moves on the sea (its strokes, the glints, the surf), lit as the game runs (`paint/live.ts`). */
  water: LiveWater;
  /** The gulls' colour, a place of the palette (`flock.ts`); the game flies them by day. */
  gull: number;
}

/**
 * The clearing round the fire (`KnollPainter.clearing`) is the same at every hour and in every look, so it is worked
 * out once for each whole pixel and kept: the painter asks for it several times a pixel, in each of the looks.
 */
const CLEARINGS = new Map<number, { earth: number; short: number }>();
function clearingAt(x: number, y: number): { earth: number; short: number } {
  if (!Number.isInteger(x) || !Number.isInteger(y) || Math.abs(x) >= 1024 || Math.abs(y) >= 1024) return clearingOf(x, y);
  const key = (y + 1024) * 2048 + x + 1024;
  let found = CLEARINGS.get(key);
  if (!found) CLEARINGS.set(key, (found = clearingOf(x, y)));
  return found;
}

function clearingOf(x: number, y: number): { earth: number; short: number } {
  const angle = Math.atan2((y - KNOLL_FIRE.y - TRODDEN.dy) * (TRODDEN.rx / TRODDEN.ry), x - KNOLL_FIRE.x);
  const wobble = 1 + (noise2(angle * 2.2, 1, 113) - 0.5) * 0.34;
  const lobes = 1 + 0.17 * Math.sin(2 * angle + 0.9) + 0.13 * Math.sin(3 * angle - 1.3) + 0.08 * Math.sin(5 * angle + 2.2) + (noise2(angle * 3.1, 2, 191) - 0.5) * 0.3;
  // the edge is ragged too: tongues of grass in the earth and of earth in the grass
  const ragged = 1 + (fbm(x / 11, y / 4.5, 2, 190) - 0.5) * 0.5;
  let earth = (Math.hypot((x - KNOLL_FIRE.x) / TRODDEN.rx, (y - KNOLL_FIRE.y - TRODDEN.dy) / TRODDEN.ry) / lobes) * ragged;
  if (x > 110 && x < 420 && y > 150) {
    // patchy, so grass grows back in the scuffs: bare only in places (no path: a path is the maintainer's to tell, rule 14)
    const patchy = 0.55 + 1.3 * fbm(x / 9, y / 4, 2, 192);
    for (const [cx, cy, rx, ry] of SCUFFS) earth = Math.min(earth, Math.hypot((x - cx) / rx, (y - cy) / ry) * patchy * 1.1);
  }
  return {
    earth,
    short: Math.min(earth * 0.9 + 0.2, Math.hypot((x - KNOLL_CLEARING.x) / KNOLL_CLEARING.rx, (y - KNOLL_CLEARING.y) / KNOLL_CLEARING.ry) / wobble),
  };
}


class KnollPainter {
  readonly palette: readonly number[];
  private readonly hour: Hour & (typeof LIGHT)[SkyPhase];
  private readonly w: number;
  private readonly h: number;
  private readonly hz: number;
  private readonly shore: KnollShore[];
  private readonly crest: Float32Array;
  /** The picture being painted: a palette colour for each pixel. */
  private px: Uint8Array = new Uint8Array(0);
  /** 1 where something was painted after the fire place, in any look: the embers' frames leave those pixels alone. */
  private readonly front: Uint8Array;
  /** Everything but the sky and the sea: the same in every look while the ground stands still. */
  private readonly land: StillPart;
  private marking = false;
  /** 1 where a stone or a moss cushion lies on the plateau in the look being painted: no blade grows there. */
  private bare: Uint8Array = new Uint8Array(0);
  /** Where the bare sky shows in the look being painted: the clouds drift there. */
  private readonly sky: SkyMask;
  /** How the kit's things paint into the look being painted, with its gust (`kit/`). */
  private brush!: KitBrush;
  /** What moves on the sea, recorded in the first look (`paint/live.ts`). */
  private readonly live: LiveRecorder;
  water: LiveWater | null = null;

  /** The gulls' colour (`flock.ts` flies them in the game): pale against the sky, warm in the low sun where the sky is warm. */
  gullTone(): number {
    return this.hour.warm !== 0 ? R.cloud[3]! : R.stone[1]!;
  }
  /** The plateau as the kit's grass sees it: its crest, how far down a pixel is, its light, the trodden place, what is covered. */
  private readonly ground: KitGround;

  constructor(world: World, plan: KnollPlan, phase: SkyPhase) {
    this.w = plan.fine.w;
    this.h = plan.fine.h;
    this.hz = plan.horizon;
    this.hour = { ...KERI_HOURS[phase], ...LIGHT[phase] };
    this.palette = knollPalette(phase);
    this.shore = knollShore(world);
    this.crest = Float32Array.from({ length: this.w }, (_, x) => knollCrest(x + 0.5));
    this.front = new Uint8Array(this.w * this.h);
    this.land = new StillPart(this.w * this.h);
    this.sky = new SkyMask(this.w, this.h);
    // the wind of this view blows east, to the viewer's left
    this.live = new LiveRecorder(this.w, this.h, () => this.px, this.hz, -1, R.foam, KNOLL_STROKES);
    const inside = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < this.w && y < this.h;
    this.ground = {
      width: this.w,
      height: this.h,
      edge: (x) => this.crestAt(x),
      down: (x, y) => this.down(x, y),
      row: (x, v) => this.sweep(x, v),
      light: (x, y) => this.hillTone(x, y),
      trodden: (x, y) => this.clearing(x, y).earth,
      short: (x, y) => this.clearing(x, y).short,
      free: (x, y) => !this.kept(x, y),
      bare: (x, y) => inside(x, y) && this.bare[y * this.w + x] === 1,
      cover: (x, y) => { if (inside(x, y)) this.bare[y * this.w + x] = 1; },
    };
  }

  private put(x: number, y: number, c: number): void {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.px[y * this.w + x] = c;
    this.sky.put(y * this.w + x);
    this.land.touch(y * this.w + x);
    if (this.marking) this.front[y * this.w + x] = 1;
  }

  private at(x: number, y: number): number {
    return x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : this.px[y * this.w + x]!;
  }

  /** The first row of land in a column: the shore, or the hill's crest where it stands before the shore. */
  private landTop(x: number): number {
    return Math.min(this.shore[x]!.water, this.crest[x]!);
  }

  /** The hill's crest in a column, also a little outside the picture. */
  private crestAt(x: number): number {
    return x >= 0 && x < this.w ? this.crest[Math.floor(x)]! : knollCrest(x);
  }


  // ---- the sky

  private paintSky(): void {
    const { w, hz, hour } = this;
    this.sky.sky = true;
    for (let y = 0; y <= hz; y++) for (let x = 0; x < w; x++) {
      let t = Math.pow(y / hz, 0.85);
      // the low sun warms the sky on its side, near the horizon
      if (hour.warm !== 0) t += 0.3 * clamp01(hour.warm > 0 ? (x - w * 0.3) / (w * 0.7) : (w * 0.7 - x) / (w * 0.7)) * (y / hz) ** 2 - 0.12;
      this.put(x, y, scatter(F.sky, clamp01(t), x, y, 1));
    }
    if (hour.night) this.stars();
    // the haze over the far water
    for (let x = 0; x < w; x++) if (hash2(x >> 2, 3, 14) > 0.3) this.put(x, hz - 1, R.sky[4]!);
    // the clouds are their own pictures (`clouds`), drifting over this bare sky in the game
    this.sky.sky = false;
  }

  private stars(): void {
    const { w, hz } = this;
    for (let gy = 0; gy < hz - 8; gy += 8) for (let gx = 0; gx < w; gx += 9) {
      const pick = hash2(gx, gy, 21);
      if (pick > 0.42) continue;
      const x = gx + Math.floor(hash2(gx, gy, 22) * 9), y = gy + Math.floor(hash2(gx, gy, 23) * 8);
      this.put(x, y, pick < 0.14 ? R.star[0]! : R.star[1]!);
      if (pick < 0.035) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) this.put(x + dx, y + dy, R.star[1]!);
    }
    // the moon: a pale disc with a shaded side, a few grains of light round it
    for (let dy = -MOON.r - 9; dy <= MOON.r + 9; dy++) for (let dx = -MOON.r - 9; dx <= MOON.r + 9; dx++) {
      const far = Math.hypot(dx, dy), x = MOON.x + dx, y = MOON.y + dy;
      if (far <= MOON.r) this.put(x, y, Math.hypot(dx + 4, dy + 3) < MOON.r * 0.55 || hash2(x >> 1, y >> 1, 24) > 0.86 ? R.moon[1]! : R.moon[0]!);
      else if (far < MOON.r + 5 && hash2(x, y, 25) < 0.5 * (1 - (far - MOON.r) / 5)) this.put(x, y, R.sky[4]!);
    }
  }

  /** A cloud (`curlCloud`) in the hour's colours. The wind of this view blows to the left, so the cloud's head leads there. */
  cloud(spec: CurlSpec): Bitmap {
    return tintedCloud(spec, true, R.cloud);
  }

  // ---- the sea

  /** The sea's tone at a pixel: dark under the horizon, paler toward the viewer and palest in the shallows. */
  private seaTone(x: number, y: number): number {
    const depth = y - this.hz;
    if (depth <= 1) return 0;
    let t = 0.2 + 0.5 * clamp01(depth / 50);
    const water = this.shore[x]!.water;
    if (water <= this.crest[x]!) t += 0.3 * smooth(7, 0, water - y);
    // the light's road on the water: paler under the sun or the moon
    t += 0.14 * Math.exp(-(((x - this.hour.glint) / (30 + depth * 1.6)) ** 2));
    return clamp01(t);
  }

  private paintSea(): void {
    const { w, hz } = this;
    const end = (x: number): number => Math.ceil(this.landTop(x)) + 1;
    for (let x = 0; x < w; x++) for (let y = hz; y <= end(x); y++) this.put(x, y, scatter(F.sea, this.seaTone(x, y), x, y, 1.5));
    // wave strokes: short and close under the horizon, longer and further apart toward the viewer, each a lighter line
    // with a darker one under it near the viewer; the game lights them as it runs (`paint/live.ts`)
    let y = hz + 3;
    for (let row = 0; y < hz + 64; row++) {
      const depth = y - hz;
      for (let px = 0; px < w; px++) {
        if (y >= end(px) - 1) continue;
        const base = this.seaTone(px, y);
        this.live.stroke(px, y, beside(F.sea, base, WAVE), 0, depth > 10 && y + 1 < end(px) - 1 ? beside(F.sea, base, -WAVE) : 0);
      }
      y += Math.max(2, Math.round(1.6 + depth * 0.085));
    }
    this.seaLights(end);
  }

  /** What lies on the water: the light's glints, a ship far out, and the surf along the shore. */
  private seaLights(end: (x: number) => number): void {
    const { w, hz, hour } = this;
    // glints where the light lies on the water, each flashing on its own beat as the game runs
    for (let gy = hz + 2; gy < hz + 40; gy++) for (let gx = Math.max(0, hour.glint - 110); gx < Math.min(w, hour.glint + 110); gx++) {
      if (gy >= end(gx) - 2) continue;
      const near = Math.exp(-(((gx - hour.glint) / (14 + (gy - hz) * 1.5)) ** 2));
      if (hash2(gx, gy, 57) > 1 - 0.22 * near) {
        const glint = hour.night ? R.moon[0]! : hour.warm !== 0 ? R.cloud[0]! : R.foam, beat = hash2(gx, gy, 63);
        this.live.glint(gx, gy, glint, beat);
        if (hash2(gx, gy, 58) > 0.5) this.live.glint(gx + 1, gy, glint, beat);
      }
    }
    // a ship far out, on the horizon (as on the reference photograph of the knoll's sea)
    for (let k = 0; k < 8; k++) this.put(168 + k, hz - 1, R.sea[0]!);
    for (let k = 0; k < 3; k++) this.put(173 + k, hz - 2, R.sea[1]!);
    this.put(169, hz - 2, R.sea[1]!);
    // the surf where the shore shows: a white line at the water's edge and a broken one further out, as the game runs
    for (let x = 0; x < w; x++) {
      const water = this.shore[x]!.water;
      if (water <= this.crest[x]! + 1) this.live.surf(x, Math.round(water));
    }
  }

  // ---- the shore beyond the knoll

  /** A stone: a lump lit from above and from the light's side, with a dark line under it. */
  private stone(cx: number, cy: number, rx: number, ry: number, seed: number, run: readonly number[] = R.stone, line = true): void {
    const side = this.hour.side;
    for (let y = Math.floor(cy - ry * 1.4); y <= Math.ceil(cy + ry * 1.4); y++) for (let x = Math.floor(cx - rx * 1.4); x <= Math.ceil(cx + rx * 1.4); x++) {
      const v = lump(x, y, cx, cy, rx, ry, seed);
      if (v < 0) continue;
      const nx = (x - cx) / rx, ny = (y - cy) / ry;
      if (line && v < 1.3 / Math.min(rx, ry) && (ny > -0.1 || rx > 12)) { this.put(x, y, R.ink); continue; }
      const t = 0.56 - ny * 0.42 + nx * side * 0.26 + (fbm(x / 5 + seed, y / 4, 2, seed + 71) - 0.5) * 0.5;
      // a large stone shades off through its whole run; a small one is a few flat tones
      this.put(x, y, rx > 9 && run === R.stone ? scatter(F.stone, clamp01(t), x, y, 1) : scatter(run, clamp01(t), x, y, 0));
    }
  }


  /** How rocky the land behind the hill is at a pixel (0 meadow, 1 stone): the right-back is rocky shore, with a ragged border to the meadow. */
  private rocky(x: number, y: number): number {
    return smooth(ROCKY.from, ROCKY.from + ROCKY.wide, x + (fbm(x / 40, y / 6, 2, 106) - 0.5) * 90);
  }

  /** The rocky shore's ground at a pixel: flat slabs and shingle in level streaks, a dark seam here and there, a little grass between. */
  private slab(x: number, y: number): number {
    const streak = fbm(x / 14, y / 1.8, 2, 107), seam = fbm(x / 7, y / 2.6, 2, 108);
    // pebbles of a size, packed: light grains on a darker bed, darker still in the bank's shade
    const dim = this.shaded(x, y);
    if (seam < 0.2) return R.shingle[0]!;
    return scatter(F.shingle, clamp01(smooth(0.2, 0.8, streak) * 0.6 - dim * 0.55 + (hash2(x >> 1, y, 109) > 0.6 ? 0.15 : 0)), x, y, 2);
  }

  /** The rocky shore's stones, far to near: small by the water, boulders toward the hill, heaped without order. */
  private shoreStones(): void {
    const { w } = this;
    for (let gy = this.hz + 26; gy < this.h; gy += 4) for (let gx = ROCKY.from - 20; gx < w + 10; gx += 10) {
      const x = gx + Math.floor(hash2(gx, gy, 143) * 10), y = gy + Math.floor(hash2(gx, gy, 144) * 4);
      const column = Math.max(0, Math.min(w - 1, x));
      const water = this.shore[column]!.water;
      if (y < water + 3 || y > this.crest[column]! + 4 || hash2(gx, gy, 145) < 0.42 || this.rocky(x, y) < 0.5) continue;
      const rx = (1.8 + (y - water) * 0.11) * (0.6 + 1.1 * hash2(gx, gy, 146) ** 2);
      this.pebble(x, y, rx, rx * (0.5 + 0.25 * hash2(gx, gy, 147)), gx * 13 + gy, this.shaded(x, y));
    }
  }

  /**
   * A stone of the shore in three flat bands, as a painter lays it (an art review found smooth lumps like
   * cauliflower): a hard light top, its body, a dark underside, and its shade on the shingle; darker all through
   * where the bank shades the shore (`dim` 0 to 1).
   */
  private pebble(cx: number, cy: number, rx: number, ry: number, seed: number, dim: number): void {
    const side = this.hour.side, d = 1 + Math.round(dim * 1.6);
    const band = (k: number): number => R.stone[Math.max(0, Math.min(R.stone.length - 1, k - d))]!;
    for (let y = Math.floor(cy - ry * 1.4); y <= Math.ceil(cy + ry * 1.5); y++) for (let x = Math.floor(cx - rx * 1.4); x <= Math.ceil(cx + rx * 1.4); x++) {
      const v = lump(x, y, cx, cy, rx, ry, seed);
      if (v < 0) {
        if (y > cy && lump(x - side, y - 1.2, cx, cy, rx, ry, seed) >= 0) this.put(x, y, R.shingle[0]!);
        continue;
      }
      const ny = (y - cy) / ry, nx = (x - cx) / rx;
      const lit = -ny * 0.8 + nx * side * 0.5 + (hash2(x, y, seed + 72) - 0.5) * 0.35;
      this.put(x, y, lit > 0.32 ? band(3 + (lit > 0.75 ? 1 : 0)) : lit > -0.35 ? band(2) : ny > 0.5 ? band(0) : band(1));
    }
  }

  /** How much the bank shades the shore at a pixel (0 open, 1 deep under the bank). */
  private shaded(x: number, y: number): number {
    const { shoulder } = KNOLL_PLATEAU;
    if (x <= shoulder.x) return 0;
    const under = this.crest[Math.max(0, Math.min(this.w - 1, x))]! - y;
    return smooth(4 + (y - 160) * 0.25, 0, under) * smooth(shoulder.x, shoulder.x + 30, x);
  }

  private paintShore(): void {
    const { w } = this;
    for (let x = 0; x < w; x++) {
      const water = this.shore[x]!.water, crest = this.crest[x]!;
      if (water > crest) continue;
      const from = Math.round(water) + 1, pebbles = from + 4 + Math.round(noise2(x / 17, 2, 90) * 3);
      for (let y = from; y <= Math.ceil(crest) + 1; y++) {
        if (y < pebbles) {
          const pick = hash2(x >> 1, y, 91);
          this.put(x, y, y === from ? R.shingle[pick > 0.5 ? 0 : 1]! : pick < 0.24 ? R.shingle[1]! : pick > 0.84 ? R.shingle[3]! : R.shingle[2]!);
        } else if (this.rocky(x, y) > 0.5) this.put(x, y, this.slab(x, y));
        else {
          // the meadow behind the hill: pale and dry with the distance, in level streaks
          const streak = fbm(x / 26, y / 2.2, 2, 92), dry = fbm(x / 60, y / 9, 2, 93);
          // each streak one flat tone, of the many between the run's second and its lightest
          const run = dry > 0.56 ? MEADOW_DRY : MEADOW;
          this.put(x, y, y === pebbles && hash2(x, y, 94) > 0.4 ? R.far[0]! : scatter(run, smooth(0.28, 0.72, streak), x, y, 0));
        }
      }
    }
    // boulders along the water's edge and a few out in the water, each in a ring of foam
    for (let gx = 6; gx < w; gx += 21) {
      const x = gx + Math.floor(hash2(gx, 1, 95) * 18);
      if (x >= w) continue;
      const water = this.shore[x]!.water;
      if (water > this.crest[x]! - 3) continue;
      const pick = hash2(gx, 2, 96), rx = 2.5 + hash2(gx, 3, 97) * 5;
      if (pick < 0.3) continue;
      if (pick > 0.74) {
        const y = Math.round(water) - 4 - Math.floor(hash2(gx, 4, 98) * 9);
        for (let dx = -Math.ceil(rx) - 1; dx <= Math.ceil(rx) + 1; dx++) if (hash2(x + dx, y, 99) > 0.3) this.put(x + dx, y + Math.round(rx * 0.55), R.foam);
        this.stone(x, y, rx, rx * 0.6, gx, R.stone, false);
      } else this.stone(x, Math.round(water) + 2, rx, rx * 0.62, gx, R.stone, rx > 4.5);
    }
    this.shoreStones();
    // small pale clumps on the far meadow
    for (let gy = this.hz + 30; gy < this.h; gy += 5) for (let gx = 0; gx < w; gx += 9) {
      const x = gx + Math.floor(hash2(gx, gy, 103) * 9), y = gy + Math.floor(hash2(gx, gy, 104) * 5);
      if (x >= w || y < this.shore[x]!.water + 8 || y > this.crest[x]! - 1 || hash2(gx, gy, 105) < 0.55 || this.rocky(x, y) > 0.5) continue;
      this.clump(x, y, 3 + hash2(gx, gy, 106) * 5, fbm(x / 60, y / 9, 2, 93) > 0.5, 0, gx * 31 + gy);
    }
    // the bush on the lip on the left (the reference photograph of the knoll's sea)
    const foot = (x: number): number => Math.min(this.crestAt(x) - 2, this.shore[Math.max(0, Math.min(w - 1, Math.round(x)))]!.water + 13);
    bushAt(this.brush, [{ x: 84, y: foot(84) - 9, r: 15 }, { x: 104, y: foot(104) - 16, r: 17 }, { x: 127, y: foot(127) - 9, r: 14 }, { x: 143, y: foot(143) - 5, r: 9 }], R.bush, 101, foot(104) + 3);
  }

  /**
   * Where the plateau cuts off on the right, its grass simply ends over the shingle: no bank is drawn (a ledge
   * drawn as a brown strip looked awkward and need not be explicit). The edge is ragged with tufts reaching out over the stones, a stone sits in it here and there, and the
   * shingle just beyond lies in a little shade.
   */
  private bank(look: number): void {
    const { shoulder } = KNOLL_PLATEAU;
    for (let x = shoulder.x + 1; x < this.w; x++) {
      const crest = this.crest[x]!, near = Math.max(0, crest - shoulder.y);
      // a little shade on the shingle along the edge, thinning outward
      const shade = 1 + Math.round(near * 0.04 + 2 * hash2(x, 5, 214));
      for (let k = 1; k <= shade; k++) if (hash2(x, k, 214) > 0.2 + 0.6 * (k / shade)) this.put(x, Math.floor(crest) - k, k === 1 ? R.shingle[0]! : R.shingle[1]!);
      // tufts of the plateau's grass over the edge, longer toward the viewer, bending with the wind
      if (hash2(x, 3, 216) > 0.4) {
        const tall = 1 + Math.floor(hash2(x, 4, 216) * (2.5 + near * 0.05)), bend = bent(x, crest, look);
        for (let k = 0; k < tall; k++) this.put(x + Math.round(bend * k * 0.8), Math.floor(crest) - k, k === tall - 1 ? R.grass[3]! : k > tall / 2 ? R.grass[2]! : R.grass[1]!);
      }
    }
    // a few stones half out of the turf along the edge
    for (let gx = shoulder.x + 6; gx < this.w - 6; gx += 17) {
      if (hash2(gx, 1, 217) < 0.45) continue;
      const x = gx + Math.floor(hash2(gx, 2, 217) * 12), near = Math.max(0, this.crest[x]! - shoulder.y);
      const rx = 2 + near * 0.03 + hash2(gx, 3, 217) * 3;
      this.pebble(x, Math.floor(this.crest[x]!) - 1, rx, rx * 0.6, gx, 0);
    }
  }

  /**
   * The plateau's lip against the sea (you could literally sit on the edge and hang your feet over the
   * edge): its turf edge in a broken dark line, tufts standing up over it, earth showing where a sod has slipped.
   */
  private lip(look: number): void {
    const { shoulder } = KNOLL_PLATEAU;
    for (let x = 0; x < shoulder.x + 2; x++) {
      const y = Math.round(this.crest[x]!);
      if (this.at(x, y + 1) === 0) continue;
      if (hash2(x, 1, 260) > 0.25) this.put(x, y, R.near[0]!);
      if (hash2(x >> 2, 2, 261) > 0.86) { this.put(x, y + 1, R.earth[0]!); this.put(x, y, R.earth[1]!); }
      if (hash2(x, 3, 262) > 0.62) {
        const tall = 1 + Math.floor(hash2(x, 4, 262) * 4), bend = bent(x, y, look);
        for (let k = 1; k <= tall; k++) this.put(x + Math.round(bend * k * 0.9), y - k, k === tall ? R.grass[4]! : k > 1 ? R.grass[2]! : R.grass[1]!);
      }
    }
  }

  // ---- the hill

  /** How far down the hill a pixel is, in the rows the clumps keep (0 on the crest). */
  private down(x: number, y: number): number {
    return (y - this.crestAt(x)) / (1 + 0.1 * ((x - KNOLL_PLATEAU.top.x) / 320) ** 2);
  }

  /** The row a sweep `v` rows down the hill has in a column. */
  private sweep(x: number, v: number): number {
    return this.crestAt(x) + v * (1 + 0.1 * ((x - KNOLL_PLATEAU.top.x) / 320) ** 2);
  }

  /** Whether a clump at a place on the hill is dry: more of them gold where the hill's grass is. */
  private dry(x: number, y: number, seed: number): boolean {
    return hash2(seed, 3, 168) < 0.08 + 0.8 * grassDryness(this.brush, this.ground, x, y, this.hillTone(x, y));
  }

  /** How light the hill's body is at a pixel (0 dark, 1 light): light along its crest and on the light's side, dark toward the viewer. */
  private hillTone(x: number, y: number): number {
    const v = this.down(x, y);
    const aside = (x - KNOLL_PLATEAU.top.x) / this.w;
    return clamp01(0.86 - v / 150 - Math.abs(aside) * 0.3 + aside * this.hour.side * 0.22 + (fbm(x / 70, y / 34, 2, 112) - 0.5) * 0.3);
  }

  /**
   * 0 on the bare earth by the fire, up to 1 at the edge of the short grass round it, above 1 outside. The trodden
   * ground is no circle (the circle around the bonfire should not be a perfect circle, with some
   * trampled ground): its edge runs in and out in lobes, and the ground is scuffed before the logs.
   */
  private clearing(x: number, y: number): { earth: number; short: number } {
    return clearingAt(x, y);
  }







  /**
   * The hill: bare earth by the fire, and everywhere else grass that is all blades. Under the blades the body's tones
   * (dark toward the viewer, the swells' light tops and dark hollows); over it one short blade beside the other, each a
   * few places up or down the run from the ground it stands on, longer toward the viewer and shortest round the fire.
   */
  private paintHill(): void {
    const g = this.ground, b = this.brush;
    swells.paint(b, g, optionsOf(swells), 0);
    this.flags();
    gravel.paint(b, g, optionsOf(gravel), 0);
    moss.paint(b, g, optionsOf(moss), 0);
    blades.paint(b, g, optionsOf(blades), 0);
    blooms.paint(b, g, optionsOf(blooms), 0);
  }


  /** Whether a place on the plateau must stay clear for the fire place. */
  private kept(x: number, y: number): boolean {
    return this.clearing(x, y).earth < 1.25;
  }

  /**
   * The stones of the plateau's ground (the ground there is quite rocky but still feels very
   * comfy due to moss and low growing meadow plants): flat slabs sunk in the turf, more of them toward the lip and the
   * cut, pale on top, dark at their front edge and in a line of shade under it, moss on some.
   */
  private flags(): void {
    const { w, h } = this, side = this.hour.side;
    for (let gy = 0; gy < h; gy += 5) for (let gx = -6; gx < w; gx += 11) {
      const x = gx + Math.floor(hash2(gx, gy, 220) * 11), cx = Math.max(0, Math.min(w - 1, x));
      const v = gy - this.crest[cx]!;
      if (v < 3) continue;
      const y = gy + Math.floor(hash2(gx, gy, 221) * 5);
      const lip = Math.exp(-v / 26), cut = smooth(KNOLL_PLATEAU.shoulder.x - 160, KNOLL_PLATEAU.shoulder.x + 40, x);
      if (hash2(gx, gy, 222) > (0.06 + 0.34 * lip + 0.16 * cut) * 1.8 * smooth(0.38, 0.62, fbm(x / 38, y / 13, 2, 229)) || this.kept(x, y)) continue;
      const big = hash2(gx, gy, 223);
      const rx = (1.6 + v * 0.075) * (0.55 + 1.2 * big * big), ry = rx * (0.38 + 0.18 * hash2(gx, gy, 224));
      const seed = gx * 17 + gy;
      for (let py = Math.floor(y - ry * 1.4); py <= Math.ceil(y + ry * 1.6); py++) for (let px = Math.floor(x - rx * 1.4); px <= Math.ceil(x + rx * 1.4); px++) {
        const e = lump(px, py, x, y, rx, ry, seed);
        // its shade on the turf just under its front edge
        if (e < 0 && py > y && lump(px, py - 1.5, x, y, rx, ry, seed) >= 0) this.put(px, py, R.near[0]!);
        if (e < 0) continue;
        const nx = (px - x) / rx, ny = (py - y) / ry;
        let c = ny > 0.45 && e < 0.45 ? (hash2(px, py, 225) > 0.4 ? R.stone[0]! : R.stone[1]!) : scatter(F.stone, clamp01(0.66 - ny * 0.3 + nx * side * 0.2), px, py, 1.2);
        if (ny < 0.2 && fbm(px / 4, py / 2, 2, seed + 226) > 0.64) c = hash2(px, py, 227) > 0.5 ? R.grass[4]! : R.far[2]!;
        this.put(px, py, c);
        if (py >= 0 && py < h && px >= 0 && px < w) this.bare[py * w + px] = 1;
      }
    }
    // a few stones sit right on the lip, dark before the sea, and more where the plateau breaks off over the shore
    for (let gx = 8; gx < this.w - 14; gx += gx > KNOLL_PLATEAU.shoulder.x ? 13 : 23) {
      if (hash2(gx, 1, 228) < (gx > KNOLL_PLATEAU.shoulder.x ? 0.3 : 0.55)) continue;
      const x = gx + Math.floor(hash2(gx, 2, 228) * 14), y = Math.ceil(this.crest[x]!) + 1;
      if (this.kept(x, y + 6)) continue;
      this.stone(x, y - 1, 2.2 + hash2(gx, 3, 228) * 3, 1.6 + hash2(gx, 4, 228) * 1.4, gx, R.stone, false);
    }
  }





  /** A clump of the kit's grass with its foot at (`x`, `y`), `tall` pixels high (`kit/grass.ts`). */
  private clump(x: number, y: number, tall: number, dry: boolean, depth: ClumpDepth, seed: number): void {
    clump.paint(this.brush, x, y, { tall, dry, depth }, seed);
  }

  /** The hill's clumps in the rows `from` to `to` (far to near): small by the crest, large and dark toward the viewer. */
  private clumps(from: number, to: number): void {
    const { w, h } = this;
    for (let k = from; k < to; k++) {
      const v = sweepRow(k) + 1;
      const size = 5 + v * 0.3;
      let x = -size * hash2(k, 2, 131);
      for (let n = 0; x < w + size; n++) {
        const px = Math.round(x), py = Math.round(this.sweep(px, v) + (hash2(k, n, 132) - 0.5) * size * 0.5);
        x += size * (0.7 + 1.5 * hash2(k, n, 133));
        if (py - size * 1.4 > h || hash2(k, n, 134) < 0.24 + 0.3 * (1 - meadow(v))) continue;
        const place = this.clearing(px, py);
        const seed = k * 7919 + n * 131;
        if (place.earth < 1.12) continue;
        if (place.short < 1) {
          // short grass round the fire, where feet have kept it down
          if (hash2(k, n, 135) < 0.55) this.clump(px, py, 3 + hash2(k, n, 136) * 3, this.dry(px, py, seed), 1, seed);
          continue;
        }
        // of every height from just over the grass to a tall tuft: many low ones, few tall
        const tall = size * (0.38 + 1.4 * hash2(k, n, 137) ** 2.4) * (0.55 + 0.45 * smooth(1, 1.5, place.short)) * (0.5 + 0.5 * meadow(v));
        this.clump(px, py, tall, this.dry(px, py, seed), py > h - 22 ? 2 : 1, seed);
      }
    }
    if (to < 99) return;
    // the clumps that stand between the viewer and the picture's lower edge: dark, their feet out of sight
    for (let x = 96 + 14 * hash2(1, 1, 138), n = 0; x < w - 40; n++) {
      this.clump(Math.round(x), h + 6 + Math.round(hash2(n, 2, 139) * 10), 34 + hash2(n, 3, 140) * 30, hash2(n, 4, 141) > 0.72, 2, 9000 + n);
      x += 12 + hash2(n, 5, 142) * 26;
    }
  }

  // ---- the fire place

  /** The ring's stones, far to near: each its middle, size and seed. */
  private ringStones(): { far: boolean; x: number; y: number; rx: number; ry: number; seed: number }[] {
    return Array.from({ length: 13 }, (_, k) => {
      const a = (k / 13) * Math.PI * 2 + (hash2(k, 1, 151) - 0.5) * 0.25;
      const far = Math.sin(a) < 0;
      const rx = (5.4 + 3.6 * hash2(k, 2, 152)) * (far ? 0.86 : 1);
      // laid by hand: no stone quite on the round, one or two rolled out of it
      const out = (0.9 + 0.22 * hash2(k, 4, 153)) * (k === 4 || k === 10 ? 1.32 : 1);
      return { far, a, x: KNOLL_FIRE.x + Math.cos(a) * KNOLL_FIRE.rx * out, y: KNOLL_FIRE.y + Math.sin(a) * KNOLL_FIRE.ry * out, rx, ry: rx * (0.62 + 0.24 * hash2(k, 3, 153)), seed: 160 + k };
    }).sort((p, q) => p.y - q.y);
  }

  /**
   * A log to sit on: a crooked trunk half sunk in the ground, thick at its butt and thin at its tip, its top worn
   * pale in a broken streak, its underside dark; the butt is a dark hollow with a pale rim, not a sawn face. No line
   * round it: light and shade make its shape. Its shade lies on the ground on the side away from the fire, and a few
   * blades of the grass stand before it.
   */
  private log(log: KnollLog): void {
    const long = Math.hypot(log.b[0] - log.a[0], log.b[1] - log.a[1]);
    const seed = Math.round(log.a[0] * 7 + log.a[1]);
    const steps = Math.ceil(long * 2);
    const spine = Array.from({ length: steps + 1 }, (_, k) => {
      const t = k / steps, at = logSpine(log, t);
      // thinner toward the tip, with swellings where branches were
      const knot = log.stub === undefined ? 0 : 0.3 * Math.exp(-(((t - log.stub) / 0.07) ** 2));
      return { ...at, t, thick: log.r * (1 - (1 - log.taper) * t ** 0.8) * (0.88 + 0.26 * noise2(t * 5, seed, 194) + knot) };
    });
    const away = Math.sign((log.a[0] + log.b[0]) / 2 - KNOLL_FIRE.x) || 1;
    const x0 = Math.floor(Math.min(...spine.map((p) => p.x)) - log.r - 5), x1 = Math.ceil(Math.max(...spine.map((p) => p.x)) + log.r + 5);
    const y0 = Math.floor(Math.min(...spine.map((p) => p.y)) - log.r - 3), y1 = Math.ceil(Math.max(...spine.map((p) => p.y)) + log.r + 5);
    const nearest = (x: number, y: number): { d: number; p: (typeof spine)[number] } => {
      let d = Infinity, p = spine[0]!;
      for (const q of spine) {
        const far = Math.hypot(x - q.x, y - q.y);
        if (far < d) { d = far; p = q; }
      }
      return { d, p };
    };
    // its shade first, on the ground under it and to the side away from the fire
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const { d, p } = nearest(x - away * 2.5, y - 2);
      if (d > p.thick + 0.8 || y < p.y || hash2(x, y, 195) > 0.86) continue;
      this.put(x, y, this.clearing(x, y).earth < 1 ? R.earth[0]! : R.near[1]!);
    }
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const { d, p } = nearest(x, y);
      if (d > p.thick) continue;
      const v = (y - p.y) / p.thick, along = p.t * long;
      // the grain runs along the trunk, in long streaks
      const grain = fbm(along / 7, v * 2.6 + seed, 2, 196), worn = fbm(along / 11 + 3, seed, 2, 200);
      this.put(x, y, woodAt(v, grain, worn));
    }
    this.logEnds(log, spine[0]!, seed);
  }

  /** A log's branch stub, its hollow butt and the grass before it. */
  private logEnds(log: KnollLog, butt: { x: number; y: number; thick: number }, seed: number): void {
    const long = Math.hypot(log.b[0] - log.a[0], log.b[1] - log.a[1]);
    // the stub of a branch: a short crooked peg, pale on its top
    if (log.stub !== undefined) {
      const at = logSpine(log, log.stub), lean = hash2(seed, 1, 201) > 0.5 ? 1 : -1, tall = 3 + Math.round(log.r * 0.5);
      for (let i = 0; i <= tall; i++) {
        const x = at.x + lean * i * 0.6, y = at.y - log.r * 0.7 - i;
        this.put(x, y, i === tall ? R.shingle[2]! : R.earth[2]!);
        this.put(x + 1, y, i === tall ? R.shingle[3]! : R.earth[1]!);
      }
    }
    // the butt: broken and hollow, a dark mouth with a pale rim
    const toward = Math.sign(log.a[0] - log.b[0]) || 1;
    for (let dy = -Math.ceil(butt.thick); dy <= Math.ceil(butt.thick); dy++) for (let dx = -Math.ceil(butt.thick * 0.7); dx <= Math.ceil(butt.thick * 0.7); dx++) {
      const e = Math.hypot(dx / (butt.thick * 0.62), dy / (butt.thick * 0.95)) * (1 + (hash2(seed + dx, dy, 202) - 0.5) * 0.3);
      if (e > 1) continue;
      this.put(butt.x + dx + toward, butt.y + dy, e > 0.66 ? (dy < butt.thick * 0.3 ? R.shingle[2]! : R.earth[2]!) : e < 0.4 ? R.ink : R.earth[0]!);
    }
    // grass before it, so it lies in the ground and not on it
    for (let k = 0; k < long * 0.6; k++) {
      const t = hash2(seed, k, 197), p = logSpine(log, t), x = Math.round(p.x), y = Math.round(p.y + log.r * (1 - (1 - log.taper) * t ** 0.8) + 1);
      if (this.clearing(x, y).earth < 1) continue;
      const tall = 1 + Math.floor(hash2(seed, k, 198) * 3.6), c = LAWN[Math.floor(hash2(seed, k, 199) * LAWN.length)]!;
      for (let i = 0; i <= tall; i++) this.put(x - (i > 1 ? 1 : 0), y - i, c);
    }
  }

  private paintFire(): void {
    const fire = KNOLL_FIRE;
    const draw = (s: ReturnType<KnollPainter['ringStones']>[number]): void => {
      // its shadow on the earth, then the stone
      for (let dx = -Math.ceil(s.rx); dx <= Math.ceil(s.rx) + 2; dx++) if (this.at(Math.round(s.x + dx), Math.round(s.y + 1)) !== 0 && s.y + 1 > this.crestAt(s.x + dx)) this.put(s.x + dx, s.y + 1, R.earth[0]!);
      this.stone(s.x, s.y - s.ry * 0.7, s.rx, s.ry, s.seed);
    };
    const stones = this.ringStones();
    stones.filter((s) => s.far).forEach(draw);
    // the ash bed
    const ashX = fire.rx * 0.74, ashY = fire.ry * 0.8;
    for (let dy = -Math.ceil(ashY) - 1; dy <= Math.ceil(ashY) + 1; dy++) for (let dx = -Math.ceil(ashX) - 2; dx <= Math.ceil(ashX) + 2; dx++) {
      const x = fire.x + dx, y = fire.y + dy;
      const v = lump(x, y, fire.x, fire.y, ashX, ashY, 154);
      if (v < 0) continue;
      const fleck = hash2(x >> 1, y, 155);
      this.put(x, y, v < 0.16 ? R.ash[0]! : fleck > 0.9 ? R.ash[3]! : fleck > 0.62 ? R.ash[2]! : R.ash[1]!);
    }
    // three charred logs across it: black, with grey ash along their tops
    for (const [x0, y0, x1, y1] of [[-0.58, -0.3, 0.42, 0.42], [-0.26, 0.6, 0.58, -0.5], [-0.54, 0.5, 0.14, -0.6]] as const) {
      const a = { x: fire.x + x0 * ashX, y: fire.y + y0 * ashY - 2 }, b = { x: fire.x + x1 * ashX, y: fire.y + y1 * ashY - 2 };
      const steps = Math.ceil(Math.abs(b.x - a.x) + Math.abs(b.y - a.y));
      for (let k = 0; k <= steps; k++) {
        const t = k / steps, x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
        this.put(x, y - 2, hash2(k >> 1, Math.round(x0 * 10), 156) > 0.45 ? R.ash[2]! : R.ash[1]!);
        this.put(x, y - 1, R.ash[0]!); this.put(x, y, R.ash[0]!); this.put(x, y + 1, R.ink);
      }
    }
    for (const e of this.emberDabs()) this.put(e.x, e.y, emberAt(e.heat, 0));
    stones.filter((s) => !s.far).forEach(draw);
  }

  /** The embers' pixels between the logs, each with its own heat (0 to 1). */
  private emberDabs(): { x: number; y: number; heat: number }[] {
    const out: { x: number; y: number; heat: number }[] = [];
    for (let k = 0; k < 16; k++) {
      const a = hash2(k, 1, 161) * Math.PI * 2, r = 0.56 * Math.sqrt(hash2(k, 2, 162));
      const x = Math.round(KNOLL_FIRE.x + Math.cos(a) * r * KNOLL_FIRE.rx), y = Math.round(KNOLL_FIRE.y - 1 + Math.sin(a) * r * KNOLL_FIRE.ry);
      const heat = hash2(k, 3, 163);
      out.push({ x, y, heat }, { x: x + 1, y, heat });
      if (heat > 0.35) out.push({ x, y: y - 1, heat: heat * 0.8 }, { x: x + 1, y: y - 1, heat: heat * 0.7 });
      if (heat > 0.7) out.push({ x: x + 2, y, heat: heat * 0.6 }, { x: x - 1, y, heat: heat * 0.6 });
    }
    return out;
  }

  // ---- what stands nearest the viewer



  // ---- the pictures

  /** The overhanging tree (`LIMBS`, `TIERS`): its limbs first, then its crown's tiers over them, the high ones first. */
  private tree(): void {
    LIMBS.forEach((limb, n) => this.limb(limb, n));
    [...TIERS].sort((a, b) => a.y - b.y).forEach((tier, n) => this.tier(tier, n));
  }

  /**
   * A limb as round wood twisted along its length: lit along its top (or the light's side where it stands up), dark
   * under, an ink line on its underside, and grooves in the bark that wind round it.
   */
  private limb(limb: (typeof LIMBS)[number], n: number): void {
    const bark = [R.ink, R.earth[0]!, R.earth[1]!, R.earth[2]!, R.earth[3]!, R.stone[2]!];
    const [a, b, c] = [limb.a, limb.b, limb.c];
    const steps = Math.ceil((Math.hypot(b[0] - a[0], b[1] - a[1]) + Math.hypot(c[0] - b[0], c[1] - b[1])) * 1.6);
    const light = [this.hour.side * 0.6, -1], lightLong = Math.hypot(light[0]!, light[1]!);
    let s = 0, px = a[0], py = a[1];
    for (let k = 0; k <= steps; k++) {
      const t = k / steps, u = 1 - t;
      const x = u * u * a[0] + 2 * u * t * b[0] + t * t * c[0], y = u * u * a[1] + 2 * u * t * b[1] + t * t * c[1];
      s += Math.hypot(x - px, y - py); px = x; py = y;
      let tx = 2 * u * (b[0] - a[0]) + 2 * t * (c[0] - b[0]), ty = 2 * u * (b[1] - a[1]) + 2 * t * (c[1] - b[1]);
      const long = Math.hypot(tx, ty) || 1;
      tx /= long; ty /= long;
      // the side that faces the light
      let nx = -ty, ny = tx;
      if (nx * light[0]! + ny * light[1]! < 0) { nx = -nx; ny = -ny; }
      // the trunk's stems are knobbly along their edges too (rule 3: an art review found the bend's
      // shaded edge standing plumb as a ruler once the dry stems no longer hid it)
      const knobs = n < 4 ? (fbm(s / 3, n, 2, 233) - 0.5) * limb.r * 1.1 : 0;
      const r = limb.r * (1 - (1 - limb.end) * t) + (fbm(s / 14, n, 1, 231) - 0.5) * limb.r * 0.25 + knobs;
      if (r < 1) { this.put(x, y, bark[1]!); continue; }
      for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++) for (let dx = -Math.ceil(r); dx <= Math.ceil(r); dx++) {
        const along = dx * tx + dy * ty, across = (dx * nx + dy * ny) / r;
        if (Math.abs(along) > 0.8 || Math.abs(across) > 1) continue;
        const gx = Math.round(x + dx), gy = Math.round(y + dy);
        // grooves that wind round the limb as it goes
        const groove = fbm(s / 8 + across * 1.4, across * 2.2 + s * 0.05, 2, 232 + n);
        let tone = 0.36 + 0.36 * across * (lightLong > 0 ? 1 : 0) + (groove - 0.5) * 0.9;
        if (across < -0.8) tone = 0;
        else if (across > 0.85 && groove > 0.5) tone = 0.95;
        this.put(gx, gy, scatter(bark, clamp01(tone), gx, gy, 0.8));
      }
    }
  }

  /**
   * A tier of the crown: a flat cushion of leaf, its top heaped in small lumps that each catch the light, its underside
   * near-black with tufts hanging from it, and the sky showing through it here and there.
   */
  private tier(tier: (typeof TIERS)[number], n: number): void {
    const leaf = [R.near[0]!, R.near[1]!, R.near[2]!, R.bush[1]!, R.bush[2]!, R.bush[3]!, R.bush[4]!];
    const side = this.hour.side, seed = 240 + n * 7;
    for (let x = Math.floor(tier.x - tier.half); x <= Math.ceil(tier.x + tier.half); x++) {
      const dx = (x - tier.x) / tier.half;
      const body = Math.pow(Math.max(0, 1 - dx * dx), 0.55);
      if (body <= 0) continue;
      // the top heaped in lumps of leaf, with single leaves standing up from it; the underside in hanging tufts
      const heap = 6 * fbm(x / 9 + n * 5, n, 2, seed) + (hash2(x, n, seed + 6) > 0.8 ? 1 + 2 * hash2(x, 1, seed + 6) : 0);
      const top = tier.y - tier.thick * 0.55 * body - heap * body;
      const fringe = 7 * Math.max(0, fbm(x / 4.5, n, 2, seed + 1) - 0.42) + (hash2(x, n, seed + 2) > 0.85 ? 1 + 2 * hash2(x, n, seed + 3) : 0);
      const base = tier.y + tier.thick * 0.45 * body * (0.7 + 0.6 * fbm(x / 13, n, 2, seed + 10)), under = base + fringe * body;
      for (let y = Math.floor(top); y <= Math.ceil(under); y++) {
        // how far down the tier: past 1 in the tufts that hang under it, which are its darkest
        const v = (y - top) / Math.max(1, base - top);
        // the sky through the crown, here and there
        if (v > 0.25 && v < 0.85 && fbm(x / 9, y / 5, 2, seed + 4) < 0.17) continue;
        // lumps of leaf scattered over it, each lit on its top and dark at its foot
        const inner = this.leafLump(x, y, seed);
        const tone = 0.74 - v * 1.0 + inner * 0.3 * (1 - smooth(0.7, 1, v)) + dx * side * 0.12 + (fbm(x / 3, y / 2, 2, seed + 5) - 0.5) * 0.35;
        this.put(x, y, scatter(leaf, clamp01(tone), x, y, 1.2));
      }
    }
  }

  /** Where a pixel lies in the nearest lump of leaf of a crown: 1 at its lit top, -1 at its dark foot. */
  private leafLump(x: number, y: number, seed: number): number {
    const cw = 11, ch = 7;
    const gx = Math.floor(x / cw), gy = Math.floor(y / ch);
    let best = Infinity, ny = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const cx = (gx + i + 0.2 + 0.6 * hash2(gx + i, gy + j, seed + 7)) * cw, cy = (gy + j + 0.2 + 0.6 * hash2(gx + i, gy + j, seed + 8)) * ch;
      const rx = cw * (0.6 + 0.4 * hash2(gx + i, gy + j, seed + 9)), ry = ch * 0.7;
      const far = Math.hypot((x - cx) / rx, (y - cy) / ry);
      if (far < best) { best = far; ny = (y - cy) / ry; }
    }
    return clamp01(1 - best) - ny * 0.8;
  }

  /** The whole picture in one look of the grass and the sea; `sky` is left marking where the bare sky shows in it. */
  private painted(look: number): Bitmap {
    const bitmap = createBitmap(this.w, this.h);
    this.px = bitmap.pixels;
    this.bare = new Uint8Array(this.w * this.h);
    this.marking = false;
    this.brush = { put: (x, y, c) => this.put(x, y, c), run: R, fine: F, hour: this.hour, side: this.hour.side, lean: (x, y) => bent(x, y, look) };
    this.live.on = look === 0;
    this.paintSky();
    this.paintSea();
    // the land stands still over the moving sea: painted in the first look, laid again in the others (`StillPart`)
    this.land.paint(() => [this.px, this.sky.marked, this.front], () => {
      this.paintShore();
      this.paintHill();
      // the clumps along the crest, the fire place before them, then the hill's clumps down to the viewer
      this.clumps(0, 3);
      for (const log of KNOLL_LOGS) if (log.back) this.log(log);
      this.paintFire();
      for (const log of KNOLL_LOGS) if (!log.back) this.log(log);
      this.lip(look);
      this.bank(look);
      this.marking = true;
      this.clumps(3, 11);
      this.clumps(11, 99);
      this.tree();
      rose.paint(this.brush, ROSES.to / 2, this.h, optionsOf(rose, 'corner', { wide: ROSES.to, high: this.h - ROSES.from, lumps: ROSES.lumps }), 0);
      STEMS.forEach((s, n) => stem.paint(this.brush, s.foot, this.h + 6, { reach: s.top[0] - s.foot, high: this.h + 6 - s.top[1], size: s.size, rays: s.rays }, n));
      this.marking = false;
    });
    if (look === 0) this.water = this.live.seal(bitmap);
    this.live.on = false;
    return bitmap;
  }

  /**
   * Every look, and in each what stands before the sky in the rows the clouds reach (`band`): the game lays that over
   * the drifting clouds, so they pass behind the stems.
   */
  frames(band: number): { frames: Bitmap[]; fore: Overlay } {
    return paintLooks(KNOLL_FRAMES, this.sky, Math.min(band, this.hz + 1), (look) => this.painted(look));
  }

  /**
   * The embers at each strength, and their light on the ash and the stones round them (stronger as the hour is darker).
   * Only pixels that nothing stands before. Call after `frames`.
   */
  embers(): Overlay {
    const { w, h, hour } = this;
    // a warm pool round the fire, over the trodden ground, the ring and the logs (an art review found that at night the fire lit nothing)
    const box = { x: KNOLL_FIRE.x, y: KNOLL_FIRE.y, rx: KNOLL_FIRE.rx + 70, ry: KNOLL_FIRE.ry + 30 };
    const still = this.px;
    // where each colour sits in its own run (0 dark to 1 light), so the warm light keeps the grain of what it falls on;
    // by day, dawn and dusk only the earth and the ash take it, or the ring's stones turn to gold lumps
    const place = new Map<number, number>();
    for (const run of hour.night ? [F.stone, F.shingle, F.dry, F.earth, F.ash] : [F.earth, F.ash]) run.forEach((c, k) => place.set(c, k / (run.length - 1)));
    const strength = hour.night ? 1 : hour.glow * 1.4;
    return cropTogether(EMBER_LOOKS.map((gain) => {
      const bitmap = createBitmap(w, h);
      const set = (x: number, y: number, c: number): void => {
        if (x >= 0 && y >= 0 && x < w && y < h && !this.front[y * w + x]) bitmap.pixels[y * w + x] = c;
      };
      // the light as the docks' lantern lays it (after Woodtick, mi2-bg-0-007 and 0-014): it lands on what is lit
      // already and falls off fast, while seams, shade and the ink keep the hour's colour; no dither
      for (let dy = -box.ry - 8; dy <= box.ry + 2; dy++) for (let dx = -box.rx; dx <= box.rx; dx++) {
        const x = box.x + dx, y = box.y + dy;
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const lightness = place.get(still[y * w + x]!);
        if (lightness === undefined || lightness < 0.3) continue;
        const ragged = 0.06 * hash2(Math.round(Math.atan2(dy, dx) * 6), gain, 207);
        const far = Math.hypot(dx / box.rx, (dy + 3) / (box.ry + 5)) + ragged;
        if (far >= 1) continue;
        // the lit faces take it, the shaded sides of a stone barely: lightness counts twice
        const k = Math.round(lightness ** 2 * (1 - far) ** 1.2 * 7 * strength * (0.85 + 0.15 * gain));
        if (k >= 2) set(x, y, R.ember[Math.min(4, k - 1)]!);
      }
      for (const e of this.emberDabs()) set(e.x, e.y, emberAt(e.heat, gain + 1));
      return bitmap;
    }));
  }

}

/** The smoke's tones, the same places of the palette at every hour (`paint/smoke.ts`). */
export const KNOLL_SMOKE: SmokeTones = { light: R.smoke[2]!, mid: R.smoke[1]!, root: R.smoke[0]!, shade: R.smoke[0]! };

/** An ember's colour for its own heat (0 to 1) and the fire's strength (0 the picture's own dim embers, 1 to 3 the glowing looks). */
function emberAt(heat: number, strength: number): number {
  return R.ember[Math.max(0, Math.min(R.ember.length - 1, Math.round(heat * 2.4 + strength * 0.9)))]!;
}

/** Paints the knoll of `world` as planned, for one hour of the sky. */
export function paintKnoll(world: World, plan: KnollPlan, phase: SkyPhase): KnollPicture {
  const p = new KnollPainter(world, plan, phase);
  const clouds = KNOLL_CLOUDS.map(({ at, spec }) => ({ x: at[0], y: at[1], bitmap: p.cloud(spec) }));
  const { frames, fore } = p.frames(Math.max(...clouds.map((c) => c.y + c.bitmap.height)));
  return { palette: p.palette, frames, fore, clouds, embers: p.embers(), smoke: KNOLL_SMOKE, water: p.water!, gull: p.gullTone() };
}
