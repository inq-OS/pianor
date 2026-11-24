import { BOAT_KINDS, PORT, PORT_AT_LANDING, PORT_LANDING_BERTH, portWaterAt, type BoatKind, type PortPlan } from '../../../../core/layout/port';
import type { SkyPhase } from '../../../../core/sky/skyPhase';
import { blit, createBitmap, type Bitmap } from '../bitmap';
import { cropTogether, type Overlay } from '../pack';
import { clamp01, smoothstep as smooth } from '../paint/ease';
import { grain } from '../paint/grain';
import { paintLooks, SkyMask, swing, type WindWay } from '../paint/motion';
import { LiveRecorder, type LiveWater } from '../paint/live';
import { liveWaterAt } from '../liveWater';
import { GUST_MS } from '../windMotion';
import { fbm, hash2, noise2 } from '../paint/noise';
import { tintedCloud, type CurlSpec } from './curlCloud';
import { KERI_HOURS, scenePalette, tone, type Hour } from './keriPalette';
import { optionsOf, type KitBrush } from './kit/kit';
import { lamp, lampLit } from './kit/lights';
import { pebble } from './kit/stones';
import { rings, sea, type SeaGround, type SeaStand } from './kit/water';
import { KIT_WOOD } from './kit/wood';
import type { LeapTones } from '../leap';
import type { Blown } from '../sway';
import { boatStill, paintBoat, type BoatPicture, type BoatRuns, type BoatTies } from './portBoats';
import { paintWonders } from './portWonders';

/**
 * The southern port (ft_1_19; `core/layout/port.ts`): a big, heavy stone quay seen side-on from the west, nothing else in
 * view but the sea and the visitors' boats moored on its far side, painted in the 1991 game's
 * manner: blocks in flat bands with a dark seam round each, a lumpy wobbly top, a leaning lamp post at the head, an ink
 * line round every thing. The picture is one tall cut: its top is the surface stage (the near water opaque, the sea's
 * strokes moving), and from `PORT.dive` down the underwater stage, the water cut open under the surface: the quay's
 * foundation on big weedy arches, light falling in shafts, and on the sandy bed a reef rich as a warm sea's (a rich,
 * coral-like home for future underwater characters; not the Baltic as it is, on purpose).
 *
 * Laid back to front: the bare sky (its clouds are their own pictures and drift over it), the sea, the quay with its
 * props; the boats are their own pictures (`portBoats.ts`) laid at the berths in the game, and the quay is laid again
 * over them (`front`). Under the water: the column of water, the arches and the foundation, the bed, the reef, the fish.
 */

/** Keri's shared palette, the kit's wood, and the colours only this place has: the reef's and the boats' paint. */
const SHARED = scenePalette({
  wood: KIT_WOOD,
  // a fan coral and an anemone: shade to wine, light to pale salmon
  coral: [0x3a0c34, 0x781a48, 0xb8325a, 0xe8686a, 0xffc0a4],
  // a sponge, a sea star, a fish's yellow: shade to rust, light to cream
  sponge: [0x4a1c14, 0x8e4416, 0xd4801e, 0xf8bc3c, 0xfff0b0],
  // a fan of the deep, a tube sponge, an urchin: shade to ink blue, light to lilac
  violet: [0x2e1e58, 0x463482, 0x5c54b2, 0x8a9ade, 0xd0e2f6],
  // a boat's white paint: its shade blue-grey, its light warm
  hull: [0x3c4058, 0x646c84, 0x9aa2b2, 0xcfd0cc, 0xf8f4e6],
  // a boat's red, a flag, a ring buoy, the beacon's band
  red: [0x380a16, 0x741622, 0xb42c2a, 0xe0603a, 0xffae72],
}, ['dry', 'shingle', 'stone', 'bush'], { sky: 3 });
const R = SHARED.run;
const F = SHARED.fine;

/**
 * The leaf greens of the weed, shade to light. The palette's room goes to the sky's long run, so the port names no
 * grass: its greens are the bush's.
 */
const LEAF = [R.bush[2]!, tone(F.bush, 0.62, 0, 0), R.bush[3]!, R.bush[4]!] as const;

/**
 * The runs the grain of scanned paint goes over: the things' (stone, wood, the reef, paint). Not the embers' (a light
 * keeps its own) or the clouds', and not the sky's or the water's: what lies behind is smooth and what stands before
 * it has the tooth (the sky and background should be butter smooth, as in the 1991 game, while the
 * details, buildings and so on are pixel art).
 */
const GRAIN_RUNS = Object.entries(F).filter(([name]) => !['ember', 'cloud', 'sky', 'sea'].includes(name)).map(([, run]) => run);

export function portPalette(phase: SkyPhase): readonly number[] {
  return SHARED.at(phase);
}

/** The port's runs, for the art tools and the rules' test: Keri's shared runs, the wood and its own. */
export const portRuns = (): Readonly<Record<string, readonly number[]>> => SHARED.fine;

/** The looks of the sea in one gust's loop, and of the water under it (the weed's sway, the fish, the light). */
export const PORT_FRAMES = 8;
export const PORT_DEEP_FRAMES = 4;
/** Looking east, the wind of Keri (mostly from the west and south-west) blows away and to the left. */
export const PORT_WAY: WindWay = -1;
export const LAMP_LOOKS = 3;
/** The fire pan on the beacon post: half its width at the rim and how deep it is (fine pixels). */
const FIRE_PAN = { half: 14, deep: 6 } as const;

const MOON = { x: 596, y: 40, r: 8 } as const;

/**
 * Where the light is at each hour, looking east: the side it comes from (-1 left, 1 right) and the column where it lies
 * on the water. By day the sun is south, to the right; at dawn it rises ahead; at dusk it sets behind the viewer, so the
 * quay's face takes it full; at night the moon stands over the open sea past the quay's head, to the right.
 */
const LIGHT: Record<SkyPhase, { side: number; glint: number; face: number }> = {
  day: { side: 0.7, glint: 520, face: 0.45 },
  dawn: { side: 0.2, glint: 330, face: 0.3 },
  dusk: { side: -0.1, glint: -999, face: 0.72 },
  night: { side: 0.5, glint: MOON.x, face: 0.4 },
};

/** The sky's clouds, back to front (d111 point 17); each rolls up into a head the way the wind blows (left). */
export const PORT_CLOUDS: readonly { at: readonly [number, number]; spec: CurlSpec }[] = [
  { at: [404, 54], spec: { length: 66, girth: 5, belly: 0.5, neck: 1, taper: 0.55, bend: 1, wave: 1.1, phase: 0.7 } },
  { at: [30, 50], spec: { length: 58, girth: 7, belly: 0.72, neck: 1, taper: 0.7, bend: 2, wave: 0.85, phase: 0.2, head: { size: 7, turns: 1.1 } } },
  { at: [300, 4], spec: { length: 118, girth: 38, belly: 0.8, neck: 0.9, taper: 1.15, bend: 10, wave: 0.75, phase: 0.4, rise: 9, head: { size: 25, turns: 1.2 } } },
  { at: [96, 18], spec: { length: 80, girth: 19, belly: 0.7, neck: 0.85, taper: 1.2, bend: 4, wave: 1, phase: 1.1, head: { size: 14, turns: 1.15 } } },
  { at: [470, 26], spec: { length: 160, girth: 8, belly: 0.66, neck: 0.85, taper: 0.8, bend: 5, wave: 1.3, phase: 0.9, head: { size: 11, turns: 1.3 } } },
];

export interface PortCloud {
  x: number;
  y: number;
  bitmap: Bitmap;
}

export interface PortPicture {
  palette: readonly number[];
  /** The surface stage in each look of the sea, the sky bare (the clouds drift over it). */
  frames: Bitmap[];
  /** In each look, what stands before the sky where the clouds go (the lamp post). */
  fore: Overlay;
  clouds: PortCloud[];
  /** The quay again, laid over the boats at the berths behind it. */
  front: Overlay;
  /** The beacon's light at the quay's head, a frame for each flicker; empty frames by day. */
  lamp: Overlay;
  /** What moves on the water (its strokes, the bands round the piles, the glints), lit as the game runs (`paint/live.ts`). */
  water: LiveWater;
  /** The gulls' colour, a place of the palette (`flock.ts`); the game flies them by day. */
  gull: number;
  /** The jumping fish's tones and its ring's (`leap.ts`), places of the palette. */
  leap: LeapTones;
  /**
   * The underwater stage in its looks: the tall picture from `PORT.dive` down, the screen's height. Only what changes
   * in tone from look to look is in it (the water's light, the bed, the stones), so the game can blend one look into
   * the next; what changes its place is in `deepThings`.
   */
  deep: Bitmap[];
  /**
   * What changes its place from look to look down there (the fans, the anemones, the sea grass, the trailing weed, the
   * seahorse and the wonders), cut out with its contour: the game steps it whole from look to look over `deep`, since a
   * blend of two places shows the thing twice, half see-through (art review 2).
   */
  deepThings: Overlay;
  /** The kelp down there, each plant as it stands in still water: the game sways it (`sway.ts`). */
  kelp: Blown[];
  /** What swims down there, moved by the game (`swimMotion.ts`). */
  swimmers: PortSwimmers;
  /** Every boat that can lie at a berth, from the berth's point (the stern at the water). */
  boats: Record<BoatKind, BoatPicture>;
}

/** What swims under the quay, as sprites the game moves (`swimMotion.ts`); rows in the underwater stage's fine pixels. */
export interface PortSwimmers {
  /** The bright fish, each facing right, and the row its sprite's top keeps to. */
  fish: { bitmap: Bitmap; y: number }[];
  /** One small fish of the silver school, facing left, and the row the school keeps to. */
  school: Bitmap;
  schoolY: number;
  /** The jellyfish in their looks, each where its sprite hangs. */
  jellies: { frames: Bitmap[]; x: number; y: number }[];
  /** A bubble, and where they rise from (by the anchor). */
  bubble: Bitmap;
  bubbleFrom: { x: number; y: number };
}

/** The bright fish (their runs and size) and the rows of the tall picture they keep to, as they were painted. */
const PORT_FISH: readonly { body: 'sponge' | 'coral' | 'violet' | 'red'; stripe: 'sponge' | 'coral' | 'violet' | 'hull'; size: number; y: number }[] = [
  { body: 'sponge', stripe: 'violet', size: 1.3, y: PORT.water + 104 },
  { body: 'coral', stripe: 'hull', size: 1.1, y: PORT.water + 90 },
  { body: 'violet', stripe: 'sponge', size: 1, y: PORT.water + 136 },
  { body: 'sponge', stripe: 'coral', size: 0.8, y: PORT.water + 140 },
  { body: 'red', stripe: 'hull', size: 0.8, y: PORT.water + 70 },
];
/** The two jellyfish, where they hang in the tall picture. */
const PORT_JELLIES: readonly { run: 'violet' | 'coral'; x: number; y: number }[] = [
  { run: 'violet', x: 452, y: PORT.water + 44 },
  { run: 'coral', x: 110, y: PORT.water + 30 },
];

/** The quay's blocks: a course's height and a block's length, in fine pixels, above and below the water. */
const COURSE = 12;
const UNDER_COURSE = 16;
/**
 * The arches the quay stands on, no two alike: each its left and right column and how far its crown stands over the
 * water, so only their top part shows above it. The piers between stand on wide footings on the bed.
 */
export const PORT_ARCHES: readonly { l: number; r: number; up: number }[] = [{ l: 30, r: 160, up: 24 }, { l: 220, r: 346, up: 19 }, { l: 392, r: 470, up: 14 }];

/** The row of an arch's soffit at a column (its opening is below it), or null beside the arches: round headed, drawn by hand, each wobbling its own way. */
function archTop(x: number): number | null {
  for (const { l, r, up } of PORT_ARCHES) {
    if (x < l || x > r) continue;
    const cx = (l + r) / 2, half = (r - l) / 2, u = (x - cx) / half;
    const wobble = 1.6 * Math.sin(x / 9 + l) + (x - cx) * 0.02 * (l % 3 - 1);
    // a full round head: its crown over the water, its shoulders under it, so both views show the curve
    return PORT.water - up + half * 0.85 * (1 - Math.sqrt(Math.max(0, 1 - u * u))) + wobble;
  }
  return null;
}

/** Whether (x, y) is in an arch's opening: under its soffit, between its piers, whose footings step in near the bed. */
function inArch(x: number, y: number): boolean {
  const step = y > PORT.bed - 12 ? 14 : y > PORT.bed - 26 ? 7 : 0;
  const top = archTop(x);
  return top !== null && y >= top && archTop(x - step) !== null && archTop(x + step) !== null;
}

interface Course { y: number; h: number; edges: number[] }

/**
 * The courses of a wall of big blocks from row `from` to `to`, laid by hand: each course a little higher or lower than
 * `course`, each block its own length about `long`, so no seam lines up with the next (the 1991 game draws nothing ruled).
 */
function blockCourses(from: number, to: number, course: number, long: number, seed: number): Course[] {
  const out: Course[] = [];
  for (let y = from, row = 0; y < to; row++) {
    const h = Math.max(6, course + Math.round((hash2(row, seed, 425) - 0.5) * 5));
    const edges: number[] = [];
    for (let x = -Math.round(hash2(row, seed, 426) * long), k = 0; x < 700; k++) {
      edges.push(x);
      x += Math.round(long * (0.6 + 0.8 * hash2(row * 31 + k, seed, 427)));
    }
    out.push({ y, h, edges });
    y += h;
  }
  return out;
}

/** Where (x, y) lies in a wall of `courses`: its course and block, how far into each, and whether it is on a seam. */
function blockAt(courses: readonly Course[], x: number, y: number): { row: number; k: number; inRow: number; h: number; local: number; long: number; seam: boolean } {
  let row = courses.length - 1;
  while (row > 0 && courses[row]!.y > y) row--;
  const c = courses[row]!;
  let k = 0;
  while (k + 1 < c.edges.length && c.edges[k + 1]! <= x) k++;
  const local = x - c.edges[k]!, long = (c.edges[k + 1] ?? 700) - c.edges[k]!, inRow = y - c.y;
  // each block a little lumpy: its corners round off into the seam
  const corner = Math.min(local, long - local - 1) + Math.min(inRow, c.h - inRow - 1);
  const seam = local < 2 || inRow < 1 || corner < 2 || (corner === 2 && hash2(k, row, 422) > 0.5);
  return { row, k, inRow, h: c.h, local, long, seam };
}

/**
 * The mooring piles, dark things before the quay as the 1991 game closes a corner: a fat one in the near water on the
 * left with a rope to the quay, a thinner one off the head on the right. Each its foot's column, its top's row and its half width.
 */
const PILES: readonly { x: number; top: number; half: number; rope: boolean }[] = [
  { x: 20, top: 112, half: 14, rope: true },
  { x: 618, top: 146, half: 10, rope: false },
];
/** The ladder's column: on the pier between the first two arches. */
const LADDER = 176;
/** The iron mooring rings in the quay's face. */
const RINGS = [150, 312, 470] as const;
/**
 * The low landing at the stair's foot (the stairs went down and ended, so a small lower
 * level was added that allows reaching the waterline and smaller boats): a step of stone a little over the water, before the
 * quay's face and on round its head toward the pile. Its columns on the near side, the row of its top where it meets
 * the quay's face, how many rows further back its top reaches past the head, and how high its near face stands over
 * the water.
 */
export const PORT_LANDING = { l: 514, r: 600, top: PORT.water - 10, back: 6, face: 9 } as const;
/** The ring in the quay's face over the low landing, for a small boat's line. */
const LANDING_RING = { x: PORT_LANDING.l + 24, y: PORT_LANDING.top - 16 } as const;
/** The row where the landing's foot meets the near water at a column: lumpy, as the quay's is. */
const landingFoot = (x: number): number => PORT.water + PORT_LANDING.face + Math.round(1.2 * Math.sin(x / 11 + 0.8));
/** Whether a column is the landing's, its seaward end with it. */
const onLanding = (x: number): boolean => x >= PORT_LANDING.l && x <= PORT_LANDING.r + 8;
/**
 * Where a column's dark reflection lies on the near water: the row of the foot of what stands there (the quay, the
 * landing, the pile off the head), the row its length is measured from and how long it is; null over open water.
 */
function shadeFoot(x: number): { foot: number; from: number; long: number } | null {
  if (onLanding(x)) return { foot: landingFoot(x), from: landingFoot(x), long: 30 };
  if (x < PORT_LANDING.l) return { foot: PORT.water + footAt(x), from: PORT.water, long: 30 };
  return PILES.some((p) => !p.rope && Math.abs(x - p.x) <= p.half + 2) ? { foot: PORT.water + 1, from: PORT.water + 1, long: 16 } : null;
}
/** What stands in the near water for the water's bands to curl round: the piles, the ladder's foot and the landing (the pile off the head has its seaward end). */
const STANDS: readonly SeaStand[] = [
  ...PILES.map((p) => ({ x: p.x, y: PORT.water + 3, r: p.half, leg: true })),
  { x: LADDER + 6, y: PORT.water + 3, r: 4, leg: true },
  { x: PORT_LANDING.l + 16, y: PORT.water + PORT_LANDING.face + 3, r: 9, leg: false },
];

/** The quay's top's wobble (fine pixels), its sag between the bollards: the 1991 game draws nothing straight. */
const sag = (x: number): number => Math.round(2.6 * Math.sin(x / 61) + 1.2 * Math.sin(x / 23 + 1));
/** Where the quay's foot meets the water at a column, rows over `PORT.water` (0 or less): its stones lumpy, the water lapping up between them. */
const footAt = (x: number): number => Math.min(0, Math.round(1.6 * Math.sin(x / 71 + 0.3) - 1 + (hash2(Math.floor(x / 23), 1, 435) - 0.5) * 2));
/** How far the quay's head stands out at a row: its seaward end battered, wider at the foot. */
const batter = (y: number): number => Math.max(0, Math.round((y - PORT.deck) * 0.12));
/** How far the face's courses wave off level at a column: the blocks were laid by eye, and settled. */
const settle = (x: number): number => Math.round(sag(x) * 0.6 + 2 * Math.sin(x / 97 + 0.4));

class PortPainter {
  readonly palette: readonly number[];
  readonly sky: SkyMask;
  private readonly hour: Hour & (typeof LIGHT)[SkyPhase];
  private readonly w: number;
  private readonly h: number;
  /** The tall picture's row at the canvas's first row. */
  private top = 0;
  /** No paint above this row of the tall picture: under the water, nothing reaches over the surface. */
  private floor = 0;
  private px: Uint8Array = new Uint8Array(0);
  private owner: Uint16Array = new Uint16Array(0);
  private thing = 0;
  private things = 0;
  /** The things that make the quay: laid again over the boats. */
  private quay = new Set<number>();
  private building = false;
  private readonly darkest = new Map<number, number>();
  private readonly lit = new Map<number, number>();
  /** Whether the kelp is painted (only for cutting it out, `kelps`), and the things it is made of. */
  private withKelp = false;
  private kelpThings: number[] = [];
  /** Whether what changes its place from look to look under the water is painted (`moving`), and the things it is made of. */
  private withMovers = true;
  private movers = new Set<number>();
  /** What moves on the water, recorded in the surface's first look (`paint/live.ts`). */
  private readonly live: LiveRecorder;
  liveWater: LiveWater | null = null;

  /** The gulls' colour (`flock.ts` flies them in the game): pale against the sky, warm in the low sun where the sky is warm. */
  gullTone(): number {
    return R.stone[1]!;
  }

  /**
   * The jumping fish's tones (`leap.ts` draws it in the game): a grey back over a silver side, a ring in the water's own
   * pale tone (white only for the fleck where it breaks the water).
   */
  leapTones(): LeapTones {
    return { back: F.stone[5]!, belly: F.hull[10]!, ring: F.sea[8]!, foam: R.foam };
  }

  constructor(private readonly plan: PortPlan, phase: SkyPhase) {
    this.w = plan.fine.w;
    this.h = plan.fine.h;
    this.hour = { ...KERI_HOURS[phase], ...LIGHT[phase] };
    this.palette = portPalette(phase);
    this.sky = new SkyMask(this.w, this.h);
    this.live = new LiveRecorder(this.w, this.h, () => this.px, PORT.horizon, PORT_WAY, R.foam);
    for (const run of Object.values(F)) for (const c of run) if (!this.darkest.has(c)) {
      this.darkest.set(c, run[0]!);
      this.lit.set(c, run[Math.max(0, run.length - 2)]!);
    }
  }

  private canvas(top: number): Bitmap {
    const bitmap = createBitmap(this.w, this.h);
    this.px = bitmap.pixels;
    this.owner = new Uint16Array(this.w * this.h);
    this.things = 0;
    this.quay = new Set();
    this.movers = new Set();
    this.top = top;
    this.floor = 0;
    return bitmap;
  }

  /** Paints one thing: what it paints is its own, so its outline can be found. */
  private as(draw: () => void): void {
    const was = this.thing;
    this.thing = ++this.things;
    if (this.building) this.quay.add(this.thing);
    draw();
    this.thing = was;
  }

  /**
   * Paints what changes its place from one look to the next under the water (all that `draw` paints), unless this
   * painting leaves such things out (`deep`).
   */
  private moving(draw: () => void): void {
    if (!this.withMovers) return;
    const from = this.things + 1;
    draw();
    for (let thing = from; thing <= this.things; thing++) this.movers.add(thing);
  }

  /** A pixel at column `x` and row `y` of the tall picture. */
  private put(x: number, y: number, c: number): void {
    x = Math.round(x); y = Math.round(y);
    if (y < this.floor) return;
    y -= this.top;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.px[y * this.w + x] = c;
    this.owner[y * this.w + x] = this.thing;
    if (this.top === 0) this.sky.put(y * this.w + x);
  }

  /** The tall picture's rows this canvas shows, clipped to `from`..`to`. */
  private rows(from: number, to: number): [number, number] {
    return [Math.max(from, this.top), Math.min(to, this.top + this.h)];
  }

  /** The ink line of the 1991 game: a thing's edge over what was painted before it takes the darkest tone of its own colour. */
  private outline(fromRow = 0): void {
    const { w, h, px, owner } = this;
    const edge: number[] = [], rim: number[] = [];
    const moonlit = this.hour.night;
    for (let y = Math.max(1, fromRow - this.top); y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x, a = owner[i]!;
      if (a === 0) continue;
      for (const [d, o] of [[-w, w], [1, -1], [-1, 1], [w, -w]] as const) {
        const b = owner[i + d]!;
        if (b < a && owner[i + o] === a) { (moonlit && (d === -w || d === 1) ? rim : edge).push(i); break; }
      }
    }
    for (const i of edge) px[i] = this.darkest.get(px[i]!) ?? px[i]!;
    for (const i of rim) px[i] = this.lit.get(px[i]!) ?? px[i]!;
  }

  private brush(look: number, looks: number): KitBrush {
    return {
      put: (x, y, c) => this.put(x, y + this.top, c), run: R, fine: F, hour: this.hour, side: this.hour.side,
      sway: (phase) => swing(look, looks, phase), beat: look / looks,
      // the surface's water moves as the game runs (`paint/live.ts`)
      ...(this.top === 0 ? { live: this.live } : {}),
      under: (x, y) => {
        const px = Math.round(x), py = Math.round(y);
        if (px < 0 || py < 0 || px >= this.w || py >= this.h) return undefined;
        const i = py * this.w + px;
        return { colour: this.px[i]!, thing: this.owner[i] !== 0 };
      },
    };
  }

  cloud(spec: CurlSpec): Bitmap {
    return tintedCloud(spec, false, R.cloud);
  }

  // ---- the sky and the sea

  private paintSky(): void {
    const { w, hour } = this;
    const hz = PORT.horizon;
    this.sky.sky = true;
    for (let x = 0; x < w; x++) for (let y = 0; y <= hz; y++) {
      let t = Math.min(1, Math.pow(y / hz, 0.85));
      // at dawn the sky warms ahead, round where the sun comes up
      if (this.hour.glint > 0 && hour.sky[4] !== KERI_HOURS.day.sky[4]) t += 0.25 * Math.exp(-(((x - hour.glint) / 200) ** 2)) * (y / hz) ** 2 - 0.08;
      this.put(x, y, tone(F.sky, clamp01(t), x, y));
    }
    if (hour.night) this.stars();
    this.sky.sky = false;
    for (let x = 0; x < w; x++) this.put(x, hz - 1, R.sky[4]!);
  }

  private stars(): void {
    const { w } = this;
    for (let gy = 0; gy < PORT.horizon - 8; gy += 8) for (let gx = 0; gx < w; gx += 9) {
      const pick = hash2(gx, gy, 31);
      if (pick > 0.42) continue;
      const x = gx + Math.floor(hash2(gx, gy, 32) * 9), y = gy + Math.floor(hash2(gx, gy, 33) * 8);
      this.put(x, y, pick < 0.14 ? R.star[0]! : R.star[1]!);
    }
    for (let dy = -MOON.r - 9; dy <= MOON.r + 9; dy++) for (let dx = -MOON.r - 9; dx <= MOON.r + 9; dx++) {
      const far = Math.hypot(dx, dy), x = MOON.x + dx, y = MOON.y + dy;
      if (far <= MOON.r) this.put(x, y, Math.hypot(dx + 3, dy + 3) < MOON.r * 0.55 || hash2(x >> 1, y >> 1, 34) > 0.86 ? R.moon[1]! : R.moon[0]!);
      else if (far < MOON.r + 3.5 + 1.5 * hash2(Math.round(Math.atan2(dy, dx) * 6), 1, 35)) this.put(x, y, R.sky[4]!);
    }
  }

  /** The sea from the horizon to the picture's foot (`water/sea` of the kit): deep water everywhere, no shore. */
  private paintSea(look: number): void {
    sea.paint(this.brush(look, PORT_FRAMES), this.seaGround([]), optionsOf(sea, undefined, { band: 24, way: PORT_WAY }), 0);
    this.calm();
    this.live.settle();
    this.glints();
  }

  /**
   * Takes the ordered dither out of the open water (the kit's sea mixes two neighbours of its run in a chessboard where
   * a band shades into the next; with no grain over it that shows as a pattern, and what lies behind
   * is smooth): a chessboard of two tones becomes short level dashes of the one or the other, and a lone dot of one tone
   * in the other goes.
   */
  private calm(): void {
    const { w, h } = this;
    const place = new Map(F.sea.map((c, k) => [c, k]));
    const was = this.px.slice();
    const at = (x: number, y: number): number | undefined => (x < 0 || y < 0 || x >= w || y >= h ? undefined : place.get(was[y * w + x]!));
    for (let y = PORT.horizon + 1; y < h; y++) for (let x = 0; x < w; x++) {
      const k = at(x, y);
      if (k === undefined) continue;
      const beside = [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)];
      const j = beside.find((n) => n !== undefined && Math.abs(n - k) === 1);
      if (j === undefined || beside.filter((n) => n === j).length < 3) continue;
      const own = [at(x - 1, y - 1), at(x + 1, y - 1), at(x - 1, y + 1), at(x + 1, y + 1)].filter((n) => n === k).length;
      // a chessboard: both its tones stay, in dashes four long that do not stack into columns; a lone dot takes the tone round it
      const dash = (x + Math.floor(hash2(y, 3, 391) * 4)) >> 2;
      const to = own >= 3 ? (hash2(dash, y, 392) > 0.5 ? Math.max(j, k) : Math.min(j, k)) : j;
      this.px[y * w + x] = F.sea[to]!;
    }
  }

  /** The sea as the kit sees it: deep water from the horizon to the picture's foot, no shore; `stands` what stands in it. */
  private seaGround(stands: readonly SeaStand[]): SeaGround {
    return {
      width: this.w,
      height: this.h,
      horizon: PORT.horizon,
      glint: this.hour.glint,
      stands,
      place: (x, y) => {
        if (y <= PORT.horizon) return null;
        const z = portWaterAt(y);
        return { shore: 40 + z, gx: ((x - this.w / 2) * z) / PORT.lens, gz: z };
      },
      moon: (x, y) => {
        const depth = y - PORT.horizon, wobble = 10 * (fbm(x / 30, depth / 5, 2, 315) - 0.5);
        // under the moon, the open sea past the quay's head: one broad pale plane, its edges ragged with the swell
        return smooth(MOON.x - 90, MOON.x - 40, x + wobble * 2) * smooth(MOON.x + 90, MOON.x + 40, x - wobble * 2) * smooth(3, 10, depth + wobble);
      },
    };
  }

  /** Level dashes of light where the sun or the moon lies on the water, each flashing on its own beat as the game runs (`paint/live.ts`). */
  private glints(): void {
    const { hour } = this;
    if (hour.glint < 0) return;
    for (let gy = PORT.horizon + 2; gy < PORT.far; gy++) for (let gx = Math.max(0, hour.glint - 90); gx < Math.min(this.w, hour.glint + 90); gx++) {
      const near = Math.exp(-(((gx - hour.glint) / (14 + (gy - PORT.horizon) * 1.6)) ** 2));
      // a level dash of light now and then, longer nearer
      if ((gy - PORT.horizon) % 3 === 0 && hash2(gx >> 2, gy, 357) > 1 - (hour.night ? 0.32 : 0.16) * near) {
        this.live.glint(gx, gy, hour.night ? R.moon[0]! : R.foam, hash2(gx >> 2, gy, 363));
      }
    }
  }

  /** The quay's dark reflection on the near water, broken into level dashes that slide with the loop. */
  private reflection(look: number): void {
    const [from, to] = this.rows(PORT.water - 3, PORT.water + PORT_LANDING.face + 32);
    const dark = F.sea.slice(0, 3);
    for (let y = from; y < to; y++) {
      for (let x = 0; x < this.w; x++) {
        const at = shadeFoot(x);
        if (!at) continue;
        const down = (y - at.from) / at.long;
        if (down > 1 || y <= at.foot) continue;
        const shift = Math.round(3 * Math.sin(look * Math.PI / 4 + y * 0.7));
        // solid under the foot, then broken into level dashes as it comes nearer
        const keep = down < 0.15 || (hash2((x + shift) >> 2, y, 371) > down * 1.1 - 0.1 && fbm((x + shift) / 9, y / 2, 2, 372) > 0.28 + down * 0.35);
        if (keep) this.put(x, y, tone(dark, 0.15 + down * 0.7, x, y));
      }
    }
    // a foam line along the foot of the quay's face and the landing's, where the water laps on the stones
    for (let x = 0; x < PORT_LANDING.r + 9; x++) if (hash2(x >> 1, look, 373) > 0.35) this.put(x, shadeFoot(x)!.foot + 1, R.foam);
  }

  /**
   * The water nearest the viewer: a dark band along the picture's foot, its upper edge ragged with the swell, so the
   * picture is closed below as the 1991 game closes its rooms; and bubbles coming up from below, something down there.
   */
  private nearWater(look: number): void {
    const [a, b] = this.rows(PORT.water + 24, this.h);
    for (let y = a; y < b; y++) for (let x = 0; x < this.w; x++) {
      const edge = this.h - 34 + 6 * (fbm(x / 23 + look * 0.15, 1, 2, 381) - 0.5) * 2;
      if (y < edge) continue;
      const stroke = hash2((x + look * 2) >> 3, y, 382) > (y < edge + 3 ? 0.55 : 0.9);
      this.put(x, y, stroke ? R.sea[2]! : tone(F.sea, clamp01(0.16 - (y - edge) / 120), x, y));
    }
    // bubbles rising from below in two places, one gap in each look, so the loop does not jump
    const gap = 14, n = 3;
    for (const bx of [236, 432]) for (let k = 0; k < n; k++) {
      const y = this.h - 4 - ((k * gap + look * (gap * n / PORT_FRAMES)) % (gap * n)), x = bx + Math.round(1.5 * Math.sin(y / 5 + bx));
      if (y < PORT.water + 8) continue;
      this.put(x, y, R.foam); this.put(x + 1, y, R.sea[4]!); this.put(x, y + 1, R.sea[4]!); this.put(x - 1, y, R.sea[3]!);
    }
  }

  // ---- the quay

  /** The tone of a block of the face: lit by the hour (`face`), a little each its own, darker toward the water. */
  private blockTone(seed: number, low: number): number {
    return clamp01(this.hour.face + 0.22 * (hash2(seed, 7, 401) - 0.5) - 0.18 * low);
  }

  /**
   * The quay: a lumpy top of big slabs (the eye stands a little over it), a heavy coping, a face of big blocks in flat
   * bands with a dark seam round each, green slime and barnacles over the water line; the bollards, rings, a rusty
   * ladder, old tyres hung as fenders; at the head a stair down to a low landing by the water and a leaning beacon post
   * with its fire pan.
   */
  private quayAbove(look: number): void {
    this.building = true;
    const head = PORT.head;
    // the top of the quay: big slabs going away from us, pale where the sky lights them
    this.as(() => {
      const [from, to] = this.rows(PORT.far - 2, PORT.deck + 1);
      for (let y = from; y < to; y++) for (let x = 0; x < head + 2; x++) {
        const edge = PORT.far + sag(x) * 0.5;
        if (y < edge) continue;
        const across = (y - edge) / (PORT.deck - edge);
        // the slabs: seams across, staggered, fanning a little toward us
        const slab = Math.floor((x + across * (x - 320) * 0.06) / 34);
        const seamX = Math.abs(((x + across * (x - 320) * 0.06) % 34)) < 1.2;
        const seamY = Math.abs(across - 0.5) < 0.06 && hash2(slab, 1, 411) > 0.3;
        const t = 0.62 + 0.18 * (hash2(slab, 2, 412) - 0.5) - (y - edge < 1.5 ? 0.3 : 0) + 0.1 * fbm(x / 14, y / 3, 2, 413);
        this.put(x, y, seamX || seamY ? R.stone[1]! : tone(F.shingle, clamp01(t), x, y, 0.15));
      }
    });
    // the parapet along the far edge: a low wall of dressed blocks, the boats behind it on the far side
    this.as(() => this.parapet());
    // the coping: a course of long dressed slabs along the near edge, its underside in shade
    this.as(() => {
      const [from, to] = this.rows(PORT.deck - 2, PORT.deck + 10);
      for (let y = from; y < to; y++) for (let x = 0; x < head + 4; x++) {
        const t0 = PORT.deck + sag(x);
        if (y < t0 - 1) continue;
        const k = Math.floor((x + 9) / 52), local = (x + 9) % 52;
        const seam = local < 2;
        const t = y < t0 + 1 ? 0.9 : y > t0 + 7 ? 0.12 : this.blockTone(k + 90, 0) + 0.12;
        this.put(x, y, seam ? R.stone[0]! : tone(F.stone, clamp01(t), x, y, 0.1));
      }
    });
    this.faceBlocks(PORT.deck + 10, PORT.water + 1, COURSE, 46);
    this.as(() => this.archMouths(look));
    // the head: the quay's end, its seaward face catching the light, a stair cut down into the water
    this.as(() => {
      const [from, to] = this.rows(PORT.deck - 1, PORT.water + 1);
      for (let y = from; y < to; y++) for (let x = head + batter(y); x < head + 12 + batter(y); x++) {
        const t0 = PORT.deck + sag(head);
        if (y < t0 + (x - head - batter(y)) * 0.3 || y > PORT.water + footAt(x)) continue;
        const course = Math.floor((y - PORT.deck) / COURSE);
        this.put(x, y, (y - PORT.deck) % COURSE === 0 ? R.stone[1]! : tone(F.stone, clamp01(0.55 + this.hour.side * 0.25 - course * 0.03), x, y, 0.1));
      }
    });
    this.as(() => this.stair(head - 64));
    this.slime(PORT.water - 12, PORT.water + 1);
    this.landing();
    for (const x of [92, 238, 384]) this.as(() => this.bollard(x));
    for (const x of RINGS) this.as(() => this.ring(x, PORT.deck + 22));
    for (const x of [208, 369]) this.as(() => this.tyre(x, look));
    this.as(() => this.ladder(LADDER, PORT.water + 2));
    this.as(() => this.crates(452));
    this.as(() => this.ropeCoil(330));
    this.as(() => this.lampPost());
    // the mooring pile stands before the quay and the boats behind it, so it is laid again over them too
    for (const p of PILES) this.as(() => this.pile(look, false, p));
    this.building = false;
  }

  /**
   * The parapet: a low wall along the quay's far edge from the land to near the head, its top rounded and lit, its
   * face toward us in the hour's light, a seam between its long blocks; its end at the head rounded off.
   */
  private parapet(): void {
    const end = PORT.head - 44, high = 9;
    const [a, b] = this.rows(PORT.far - high - 2, PORT.far + 2);
    for (let y = a; y < b; y++) for (let x = 0; x <= end; x++) {
      const k = Math.floor((x + 13) / 41), local = (x + 13) % 41;
      // each block its own height, its top corners rounded off
      const lump = Math.round((hash2(k, 1, 431) - 0.5) * 4) + (local < 2 || local > 38 ? 1 : 0);
      const foot = PORT.far + 1 + Math.round(sag(x) * 0.5), top = foot - high + lump + (x > end - 4 ? Math.round((x - end + 4) ** 2 / 3) : 0);
      if (y < top || y > foot) continue;
      if (local < 1 || y === foot) { this.put(x, y, R.stone[0]!); continue; }
      const t = y < top + 2 ? 0.92 : y < top + 3 ? 0.75 : this.blockTone(k + 200, (y - top) / high * 0.6) + (local < 3 ? 0.08 : 0);
      this.put(x, y, tone(F.stone, clamp01(t), x, y, 0.1));
    }
  }

  /** The face's blocks from row `from` to `to`: courses about `course` high, blocks about `long` long, laid by hand. */
  private faceBlocks(from: number, to: number, course: number, long: number): void {
    const [a, b] = this.rows(from, to);
    const courses = blockCourses(from, to, course, long, 3);
    const run = F.stone;
    this.as(() => {
      for (let y = a; y < b; y++) {
        const low = (y - from) / Math.max(1, to - from);
        for (let x = 0; x < PORT.head + batter(y) + 1; x++) {
          if (y > PORT.water + footAt(x) || inArch(x, y)) continue;
          const top = archTop(x);
          if (top !== null && y > top - 9) {
            // the arch's ring: wedge stones set on end round the opening, a step lighter, a seam between each
            const arch = PORT_ARCHES.find((a) => x >= a.l && x <= a.r)!;
            const wedge = Math.floor(((x - arch.l) + (y - top) * (x < (arch.l + arch.r) / 2 ? 0.5 : -0.5)) / 11);
            const next = Math.floor(((x + 1 - arch.l) + (y - top) * (x < (arch.l + arch.r) / 2 ? 0.5 : -0.5)) / 11);
            const key = Math.abs(x - (arch.l + arch.r) / 2) < 7;
            if (y < top - 7 || (wedge !== next && !key)) { this.put(x, y, run[0]!); continue; }
            this.put(x, y, tone(run, clamp01(this.blockTone(wedge + arch.l, low) + (key ? 0.2 : 0.1) + (y > top - 2 ? -0.25 : 0)), x, y, 0.12));
            continue;
          }
          const at = blockAt(courses, x, y - settle(x));
          if (at.seam) { this.put(x, y, run[0]!); continue; }
          let t = this.blockTone(at.k * 31 + at.row, low);
          // lit on its top and the light's side, shaded under and on the other
          if (at.inRow <= 1) t += 0.22;
          else if (at.inRow >= at.h - 2) t -= 0.18;
          if (at.local >= at.long - 3) t -= 0.14 * this.hour.side;
          if (at.local <= 3) t += 0.1 * this.hour.side;
          // a crack now and then
          if (hash2(at.k, at.row, 423) > 0.84 && Math.abs(at.local - at.long * 0.5 - (at.inRow - at.h / 2) * 0.8) < 0.7) { this.put(x, y, run[0]!); continue; }
          this.put(x, y, tone(run, clamp01(t), x, y, 0.12));
        }
      }
    });
  }

  /**
   * The arches' tops over the water: the dark under the quay, its soffit in shade, and low down the far side's light
   * lying on the water in a few level dashes that slide with the loop.
   */
  private archMouths(look: number): void {
    const dark = F.sea.slice(0, 2);
    for (const { l, r } of PORT_ARCHES) for (let x = l; x <= r; x++) {
      const top = archTop(x)!;
      const [a, b] = this.rows(Math.ceil(top), PORT.water + 1);
      for (let y = a; y < b; y++) {
        if (!inArch(x, y)) continue;
        const down = (y - top) / Math.max(1, PORT.water - top);
        const far = y > PORT.water - 4 && hash2((x + look * 2) >> 2, y, 441) > 0.55;
        this.put(x, y, y - top < 3 ? R.ink : far ? R.sea[3]! : down < 0.45 ? R.sea[0]! : tone(dark, 0.9 * (down - 0.45), x, y));
      }
    }
  }

  /** Green slime and barnacles from the water up a hand's breadth, and below the water. */
  private slime(from: number, to: number): void {
    this.as(() => {
      const [a, b] = this.rows(from, to);
      for (let y = a; y < b; y++) for (let x = 0; x < PORT.head + 12 + batter(y); x++) {
        const end = to + footAt(x);
        if (y > end || inArch(x, y)) continue;
        const up = (end - y) / (to - from);
        // in streaks that run down the stones from the line the tide leaves, darkest at the water
        const reach = 0.2 + 0.8 * fbm(x / 2.5, 1, 2, 431) ** 1.5;
        if (up > reach) continue;
        // wet, dark and slick: weed's darkest green in runs down the stone, never a lawn (art review 2)
        const c = up < 0.4 ? R.bush[0]! : hash2(x >> 1, y >> 2, 433) > 0.7 ? R.bush[1]! : R.stone[1]!;
        this.put(x, y, c);
      }
    });
  }

  /** A stair cut down the face near the head, from the top to the landing. */
  private stair(x0: number): void {
    const steps = 9, tread = 6, rise = (PORT.water - PORT.deck) / steps;
    for (let s = 0; s < steps + 2; s++) {
      const left = x0 + s * tread, y0 = PORT.deck + 6 + s * rise;
      if (y0 > PORT_LANDING.top - 2) break;
      const [a, b] = this.rows(Math.round(y0), PORT.water + 1);
      for (let y = a; y < b; y++) for (let x = left; x < left + tread + 1; x++) {
        if (x > PORT.head + 2) continue;
        const onTop = y - y0 < 2;
        this.put(x, y, onTop ? R.stone[4]! : y - y0 < 4 ? R.stone[2]! : tone(F.stone, 0.25, x, y));
      }
    }
  }

  /**
   * The low landing at the stair's foot: wet slabs a little over the water, wrapping the quay's head; one course of
   * long blocks for its near face, dark with weed at the water; a stub of a bollard at its seaward corner and a ring in
   * the quay's face over it, for a small boat's line.
   */
  private landing(): void {
    const { l, r, top, back, face } = PORT_LANDING;
    const corner = PORT.head + 12 + batter(top);
    const far = (x: number): number => (x < corner ? top : top - back) + Math.round(0.8 * Math.sin(x / 13));
    const near = (x: number): number => PORT.water - 1 + Math.round(0.7 * Math.sin(x / 17 + 2));
    this.as(() => {
      for (let x = l; x <= r; x++) {
        const [a, b] = this.rows(far(x), near(x) + 1);
        for (let y = a; y < b; y++) {
          const across = (y - far(x)) / Math.max(1, near(x) - far(x));
          const along = x + across * 5, slab = Math.floor(along / 21);
          const seam = along % 21 < 1.2 || (Math.abs(across - 0.55) < 0.08 && hash2(slab, 3, 461) > 0.45);
          // wet, so darker than the quay's top; in the wall's shade along the far edge, its near edge worn pale
          const t = 0.48 + 0.16 * (hash2(slab, 2, 462) - 0.5) - (y - far(x) < 2 && x < corner ? 0.28 : 0) + (y >= near(x) - 1 ? 0.24 : 0);
          this.put(x, y, seam ? R.stone[1]! : tone(F.shingle, clamp01(t), x, y, 0.15));
        }
      }
    });
    this.as(() => {
      for (let x = l; x <= r + 8; x++) {
        const end = x > r;
        const y0 = (end ? near(r) + Math.round((x - r) * 0.3) : near(x)) + 1, foot = landingFoot(x);
        const [a, b] = this.rows(y0, foot + 1);
        for (let y = a; y < b; y++) {
          const low = (y - y0) / face;
          const seam = !end && (x + 7) % 27 < 1.5;
          // its seaward end catches the light as the quay's head does
          const t = end ? 0.5 + this.hour.side * 0.25 - low * 0.2 : this.blockTone(Math.floor((x + 7) / 27) + 140, low * 0.6);
          const weed = y >= foot - 2 && hash2(x >> 1, y, 463) > (y >= foot - 1 ? 0.25 : 0.6);
          this.put(x, y, seam ? R.stone[0]! : weed ? R.bush[0]! : tone(F.stone, clamp01(t), x, y, 0.1));
        }
      }
    });
    this.as(() => {
      const bx = r - 12, foot = near(bx) - 3;
      for (let up = 0; up <= 7; up++) {
        const half = up > 5 ? 3 : 2;
        for (let dx = -half; dx <= half; dx++) {
          this.put(bx + dx, foot - up, up === 5 ? R.stone[0]! : up > 5 ? R.stone[4]! : tone(F.stone.slice(0, 5), clamp01(0.45 + (dx / half) * this.hour.side * 0.45), bx + dx, foot - up));
        }
      }
    });
    this.as(() => this.ring(LANDING_RING.x, LANDING_RING.y));
  }

  private bollard(x: number): void {
    const foot = PORT.deck + sag(x) + 1, lean = (hash2(x, 1, 433) - 0.5) * 0.3;
    const [a, b] = this.rows(foot - 16, foot + 1);
    for (let y = a; y < b; y++) {
      const up = foot - y;
      const cx = x + Math.round(up * lean);
      const half = up > 12 ? 7 : up > 10 ? 5 : 4;
      for (let dx = -half; dx <= half; dx++) {
        const u = dx / half;
        const t = up > 14 ? 0.8 : clamp01(0.45 + u * this.hour.side * 0.45);
        this.put(cx + dx, y, up === 13 ? R.stone[0]! : tone(F.stone.slice(0, 5), t, cx + dx, y));
      }
    }
  }

  private ring(x: number, y: number): void {
    for (let a = 0; a < 36; a++) {
      const t = (a / 36) * Math.PI * 2;
      this.put(x + Math.cos(t) * 5, y + 3 + Math.sin(t) * 5, a < 18 ? R.sponge[1]! : R.sponge[0]!);
    }
    this.put(x, y - 2, R.stone[0]!); this.put(x, y - 3, R.stone[0]!);
  }

  /** An old tyre hung on a rope over the face. */
  private tyre(x: number, look: number): void {
    const cy = PORT.water - 24, sway = Math.round(swing(look, PORT_FRAMES, x / 50) * 0.6);
    for (let y = PORT.deck + 2; y < cy - 9; y++) this.put(x + sway * ((y - PORT.deck) / 40), y, R.dry[1]!);
    for (let dy = -10; dy <= 10; dy++) for (let dx = -9; dx <= 9; dx++) {
      const d = Math.hypot(dx / 9, dy / 10);
      if (d > 1 || d < 0.45) continue;
      this.put(x + dx + sway, cy + dy, d > 0.9 || d < 0.52 ? R.ink : dx + dy < -6 ? R.stone[1]! : R.stone[0]!);
    }
  }

  /** A rusty iron ladder down the face, on into the water. */
  private ladder(x: number, bottom: number, from = PORT.deck - 8): void {
    const [a, b] = this.rows(from, bottom);
    for (let y = a; y < b; y++) {
      for (const side of [0, 12]) this.put(x + side, y, y < PORT.deck ? R.sponge[2]! : R.sponge[1]!);
      if ((y - PORT.deck) % 7 === 0) for (let k = 1; k < 12; k++) this.put(x + k, y, R.sponge[1]!);
    }
  }

  /** A stack of crates, a barrel and a lobster pot at the quay's landward end, on the left. */
  private crates(x: number): void {
    const foot = PORT.deck + 1;
    // knocked together and stacked by hand: each leans its own way, its top not level, its boards each a tone
    const box = (left: number, bottom: number, wide: number, high: number, seed: number) => {
      const skew = (hash2(seed, 1, 442) - 0.5) * 0.24, tilt = (hash2(seed, 2, 443) - 0.5) * 0.16;
      const [a, b] = this.rows(bottom - high - 3, bottom);
      for (let y = a; y < b; y++) for (let k = 0; k < wide; k++) {
        const top = bottom - high + Math.round(k * tilt), x = left + k + Math.round((bottom - y) * skew);
        if (y < top) continue;
        const edge = k < 2 || k >= wide - 2 || y < top + 2;
        const board = Math.floor((y - top) / 6), seam = (y - top) % 6 === 0;
        const t = 0.5 + 0.22 * (hash2(seed, board, 441) - 0.5) + (k < 4 ? 0.12 * this.hour.side : 0) - (k > wide - 5 ? 0.1 * this.hour.side : 0);
        this.put(x, y, edge ? tone(F.wood, y < top + 2 ? 0.75 : 0.35, x, y) : seam ? R.wood[1]! : tone(F.wood, clamp01(t), x, y, 0.15));
      }
    };
    box(x, foot, 30, 22, 1);
    box(x + 26, foot, 24, 16, 2);
    box(x + 5, foot - 22, 22, 15, 3);
    // the barrel
    const [a, b] = this.rows(foot - 24, foot);
    for (let y = a; y < b; y++) {
      // a fat belly between narrow ends, staves in flat bands round it
      const up = (foot - y) / 24, half = 7 + 4.5 * Math.sin(up * Math.PI), bx = x + 64 + Math.round(up * 3);
      for (let dx = -Math.round(half); dx <= half; dx++) {
        const hoop = Math.abs(up - 0.2) < 0.05 || Math.abs(up - 0.8) < 0.05;
        const stave = Math.abs(dx) > 1 && Math.round((dx / half) * 3.5) !== Math.round(((dx + 1) / half) * 3.5);
        this.put(bx + dx, y, hoop ? R.stone[0]! : stave ? R.wood[1]! : tone(F.wood, clamp01(0.5 + (dx / half) * this.hour.side * 0.35), bx + dx, y));
      }
    }
  }

  /** A coil of rope: turns laid one on another, each a ring seen from a little above, its twist in dashes, its end trailing off. */
  private ropeCoil(x: number): void {
    const cy = PORT.deck - 1;
    for (let k = 0; k < 4; k++) {
      const rx = 13 - k * 1.5, ry = 3.2, y0 = cy - k * 2;
      for (let a = 0; a < 90; a++) {
        const t = (a / 90) * Math.PI * 2, px = x + Math.cos(t) * rx, py = y0 + Math.sin(t) * ry;
        const front = Math.sin(t) > 0;
        this.put(px, py, front ? (a % 4 < 2 ? R.dry[2]! : R.dry[1]!) : R.dry[0]!);
        if (front) this.put(px, py - 1, a % 4 === 0 ? R.dry[3]! : R.dry[2]!);
      }
    }
    for (let i = 0; i < 16; i++) { this.put(x + 13 + i, cy + 1 + Math.round(Math.sin(i / 3)), R.dry[1]!); this.put(x + 13 + i, cy + Math.round(Math.sin(i / 3)), R.dry[2]!); }
  }

  /**
   * The beacon at the quay's head: a stout post leaning a little, banded red, and on its top a wide iron fire pan on
   * three short struts, rusty, a heap of split logs in it. By day it is cold (charred ends, grey ash); at dusk and night
   * it burns, and its flames are the beacon's light (`fireLooks`).
   */
  private lampPost(): void {
    const { lamp: pan } = this.plan;
    const foot = PORT.deck + sag(pan.x) + 1, px = pan.x, top = pan.y + FIRE_PAN.deep + 2;
    for (let y = top; y < foot; y++) {
      const lean = Math.round((foot - y) * 0.04);
      const half = y > foot - 8 ? 6 : 4;
      for (let k = -half; k <= half; k++) {
        const band = Math.floor((foot - y) / 12) % 2 === 0;
        const u = k / half;
        this.put(px + k - lean, y, y > foot - 8 ? tone(F.stone, clamp01(0.5 + u * this.hour.side * 0.3), px + k, y) : band && y > top + 6 ? tone(F.red, clamp01(0.55 + u * this.hour.side * 0.3), px + k, y) : tone(F.hull, clamp01(0.62 + u * this.hour.side * 0.3), px + k, y));
      }
    }
    const cx = panMiddle(pan);
    // three short iron struts from the post's top out to the pan's belly
    for (let k = 0; k <= 3; k++) for (const dx of [-1, 0, 1]) this.put(cx + dx * (2 + k * 2), top - k + 1, R.stone[0]!);
    // the pan: a wide shallow bowl of black iron, its rim lit on top and on the light's side, rust down its belly
    const { half, deep } = FIRE_PAN;
    for (let y = pan.y; y <= pan.y + deep; y++) {
      const d = (y - pan.y) / deep, w = Math.round(half - d * d * (half - 4));
      for (let k = -w; k <= w; k++) {
        const u = k / w, edge = Math.abs(k) === w || y === pan.y + deep;
        const rust = !edge && hash2(k >> 1, y, 471) > 0.72;
        this.put(cx + k, y, edge ? R.ink : y === pan.y ? (u * this.hour.side > 0.2 ? R.stone[3]! : R.stone[2]!) : rust ? R.sponge[1]! : tone(F.stone.slice(0, 3), clamp01(0.4 + u * this.hour.side * 0.4 - d * 0.2), cx + k, y));
      }
    }
    // the logs heaped in it, split ends up, charred dark at their tips; grey ash between them
    const logs: readonly (readonly [number, number, number])[] = [[-9, -2, -3], [-4, -6, 1], [1, -7, 5], [5, -4, 9], [-1, -3, 3]];
    for (const [x0, rise, x1] of logs) {
      const n = Math.max(1, Math.abs(x1 - x0));
      for (let i = 0; i <= n; i++) {
        const x = cx + x0 + ((x1 - x0) * i) / n, y = pan.y - 1 + Math.round((rise * Math.sin((Math.PI * i) / n)) / 2) - (i === 0 || i === n ? 0 : 1);
        const tip = i === 0 || i === n;
        this.put(x, y, tip ? R.wood[0]! : R.wood[2]!);
        this.put(x, y + 1, tip ? R.ink : R.wood[1]!);
      }
    }
    for (let k = -half + 2; k <= half - 2; k++) if (hash2(k, 2, 472) > 0.55) this.put(cx + k, pan.y, R.stone[3]!);
  }

  /**
   * The mooring pile: a fat old log leaning a little, its cut top pale, an iron band and a rope round it, weed and
   * barnacles at the water; above the water on top, and under the water, in the sea's blues, down to the bed (`under`).
   */
  private pile(look: number, under: boolean, { x: foot, top, half, rope }: (typeof PILES)[number]): void {
    const lean = 0.06, bottom = under ? PORT.bed + 8 : PORT.water + 2;
    const [a, b] = this.rows(under ? PORT.water + 1 : top - 4, bottom);
    for (let y = a; y < b; y++) {
      const cx = foot + (under ? 0 : Math.round((bottom - y) * lean));
      for (let dx = -half; dx <= half; dx++) {
        const u = dx / half, x = cx + dx;
        if (under) {
          // seen through the water: the sea's dark blues, weed and shells on it
          const weed = hash2(x >> 1, y >> 2, 461) > 0.8;
          this.put(x, y, weed ? R.bush[1]! : tone(F.sea, clamp01(0.12 + (u + 1) * 0.12 - (y - PORT.water) / 900), x, y, 0.2));
          continue;
        }
        // the cut top, an ellipse lit pale; the round side in flat bands; the iron band; the wet foot
        const cap = y < top + 3 && (dx / half) ** 2 + ((y - top) / 3) ** 2 <= 1.2;
        if (y < top - 1 || (y < top + 1 && Math.abs(u) > 0.8)) continue;
        if (cap) { this.put(x, y, Math.abs(u) < 0.5 && y > top - 1 ? R.wood[R.wood.length - 1]! : R.wood[3]!); continue; }
        const band = Math.abs(y - (top + 14)) < 2 || Math.abs(y - (top + 50)) < 2;
        const wet = y > PORT.water - 14;
        // near and against the light it is dark, as the 1991 game's foreground things are
        const t = 0.08 + 0.34 * clamp01((u * this.hour.side + 1) / 2) + (Math.abs(u) > 0.85 ? -0.08 : 0) + (Math.abs(((x + y * 0.2) % 7) - 3) < 0.6 ? -0.06 : 0);
        this.put(x, y, band ? (dx % 3 === 0 ? R.sponge[2]! : R.stone[1]!) : wet ? tone([R.bush[0]!, R.stone[1]!, R.bush[1]!], t, x, y) : tone(F.wood, clamp01(t), x, y, 0.15));
      }
    }
    if (under || !rope) return;
    // the rope: a turn round the pile, and away up over to the quay's top, sagging
    for (let dx = -half - 1; dx <= half + 1; dx++) { this.put(foot + dx + 2, top + 24 + (dx & 1), R.dry[2]!); this.put(foot + dx + 2, top + 25, R.dry[1]!); }
    const end = { x: 92, y: PORT.deck - 14 };
    for (let i = 0; i <= 60; i++) {
      const u = i / 60, sway = 0;
      const x = foot + half + 2 + (end.x - foot - half - 2) * u, y = top + 24 + (end.y - top - 24) * u + (10 + sway) * Math.sin(Math.PI * u);
      this.put(x, y, R.dry[2]!); this.put(x, y + 1, R.dry[1]!);
    }
  }

  // ---- under the water

  /** The column of water: light under the surface, deeper toward the bed, in flat bands with wobbly edges, and shafts of light. */
  private water(look: number): void {
    const [a, b] = this.rows(PORT.water, PORT.bed + 40);
    const run = F.sea;
    const sway = swing(look, PORT_DEEP_FRAMES, 0.2) * 4;
    for (let y = a; y < b; y++) for (let x = 0; x < this.w; x++) {
      const depth = (y - PORT.water) / (PORT.bed - PORT.water);
      const wobble = 0.08 * (fbm(x / 40, y / 12, 2, 501) - 0.5);
      // five flat bands, the lightest just under the surface; never so dark that what stands far off cannot show darker
      let t = 0.2 + 0.62 * Math.round((1 - depth * 1.1 + wobble) * 4) / 4;
      // shafts of light slanting down from the surface (from the sun's side), swaying a little with the loop
      const slant = x + (y - PORT.water) * 0.5 * (this.hour.side >= 0 ? 1 : -1) - sway;
      if (Math.sin(slant / 27) > 0.88 && fbm(slant / 40, 3, 2, 502) > 0.4 && depth < 0.85) t += 0.14;
      this.put(x, y, tone(run, clamp01(t), x, y));
    }
    // the surface from below: a bright broken line, the light's net under it
    for (let x = 0; x < this.w; x++) {
      this.put(x, PORT.water + 1, hash2(x >> 1, look, 503) > 0.3 ? R.foam : R.sea[4]!);
      for (let y = PORT.water + 2; y < PORT.water + 16; y++) {
        const n = noise2(x / 9 + look * 0.4, y / 2.4, 504);
        if (Math.abs(n - 0.5) < 0.04 && hash2(x, y, 505) > 0.3) this.put(x, y, R.foam);
      }
    }
    // far off, past the quay: a reef's dark line on the bed, and a few fish
    for (let x = 0; x < this.w; x++) {
      const hgt = 6 + Math.round(16 * fbm(x / 13, 1, 2, 512) * (0.6 + 0.4 * Math.sin(x / 37)));
      for (let y = PORT.bed - hgt; y < PORT.bed + 8; y++) this.put(x, y, R.sea[1]!);
    }
    for (let k = 0; k < 9; k++) {
      const fx = 40 + ((k * 71) % 580) + Math.round(swing(look, PORT_DEEP_FRAMES, k / 9) * 3), fy = PORT.water + 60 + ((k * 37) % 90);
      for (let d = 0; d < 6; d++) this.put(fx + d, fy, R.sea[1]!);
      this.put(fx + 6, fy - 1, R.sea[1]!); this.put(fx + 6, fy + 1, R.sea[1]!); this.put(fx + 1, fy - 1, R.sea[1]!);
    }
  }

  /**
   * The quay's foundation under the water: big blocks seen through the water, so in the sea's blues (deeper, darker),
   * standing on piers over round arches, the open water showing through; weed trailing from it, barnacles and mussels.
   */
  private foundation(look: number): void {
    const [a, b] = this.rows(PORT.water + 1, PORT.bed + 6);
    const courses = blockCourses(PORT.water + 1, PORT.bed + 6, UNDER_COURSE, 58, 7);
    const run = F.sea;
    this.as(() => {
      for (let y = a; y < b; y++) for (let x = 0; x < PORT.head + 12 + batter(y) + Math.round(2 * Math.sin(y / 13)); x++) {
        if (inArch(x, y)) continue;
        const at = blockAt(courses, x, y - settle(x));
        const deep = (y - PORT.water) / (PORT.bed - PORT.water);
        if (at.seam) { this.put(x, y, run[0]!); continue; }
        // darker than the open water in the arches, so the piers stand before it as the 1991 game's rocks do
        let t = 0.26 - deep * 0.16 + 0.1 * (hash2(at.k, at.row, 424) - 0.5);
        if (at.inRow <= 1) t += 0.12;
        else if (at.inRow >= at.h - 2) t -= 0.08;
        // the arch's ring: its voussoirs a step lighter round the opening
        if (inArch(x, y + 6) || inArch(x - 5, y) || inArch(x + 5, y)) t += 0.07;
        this.put(x, y, tone(run, clamp01(t), x, y, 0.15));
      }
    });
    // weed trailing from the stones, swaying
    this.moving(() => this.as(() => {
      for (let x = 4; x < PORT.head + 8; x += 6) {
        if (hash2(x, 1, 521) > 0.6) continue;
        const long = 12 + Math.round(hash2(x, 2, 522) * 30);
        const y0 = PORT.water + 3 + Math.round(hash2(x, 3, 523) * 18);
        if (inArch(x, y0)) continue;
        for (let k = 0; k < long; k++) {
          const wx = x + Math.round(swing(look, PORT_DEEP_FRAMES, x / 40 + k / 18) * k * 0.12);
          if (inArch(wx, y0 + k) && k > long * 0.6) break;
          this.put(wx, y0 + k, k % 5 === 0 ? LEAF[2] : R.bush[2]!);
          if (k < long * 0.5) this.put(wx + 1, y0 + k, R.bush[1]!);
        }
      }
    }));
    // barnacles and mussels on the stones under the water line
    this.as(() => {
      const [c, d] = this.rows(PORT.water + 2, PORT.water + 26);
      for (let y = c; y < d; y++) for (let x = 0; x < PORT.head + 10; x++) {
        if (inArch(x, y)) continue;
        const h = hash2(x, y, 531);
        if (h > 0.994) this.put(x, y, R.shingle[3]!);
        else if (h < 0.012) { this.put(x, y, R.violet[0]!); this.put(x + 1, y, R.violet[1]!); }
      }
    });
  }

  /**
   * The landing's footing under the water: two stout legs and a low round opening between them, in the sea's blues as
   * the quay's foundation is, a step lighter because it stands nearer.
   */
  private landingFooting(): void {
    const { l, r } = PORT_LANDING;
    const [a, b] = this.rows(PORT.water + 1, PORT.bed + 6);
    const courses = blockCourses(PORT.water + 1, PORT.bed + 6, UNDER_COURSE, 44, 11);
    const cx = (l + r) / 2 + 4, half = (r - l) / 2 - 16;
    const open = (x: number, y: number): boolean => {
      const u = (x - cx) / half, step = y > PORT.bed - 14 ? 6 : 0;
      if (Math.abs(x - cx) >= half - step) return false;
      return y >= PORT.water + 22 + half * 0.9 * (1 - Math.sqrt(1 - u * u)) + 1.4 * Math.sin(x / 7);
    };
    this.as(() => {
      for (let y = a; y < b; y++) for (let x = l + Math.round(2 * Math.sin(y / 11)); x < r + 8 + batter(y) * 0.25; x++) {
        if (open(x, y)) continue;
        const at = blockAt(courses, x, y);
        const deep = (y - PORT.water) / (PORT.bed - PORT.water);
        if (at.seam) { this.put(x, y, F.sea[0]!); continue; }
        let t = 0.36 - deep * 0.16 + 0.1 * (hash2(at.k, at.row, 471) - 0.5);
        if (at.inRow <= 1) t += 0.12;
        else if (at.inRow >= at.h - 2) t -= 0.08;
        if (open(x, y + 6) || open(x - 5, y) || open(x + 5, y)) t += 0.07;
        this.put(x, y, tone(F.sea, clamp01(t), x, y, 0.15));
      }
    });
  }

  /** The bed: sand in ripples, pebbles, two cobbles half sunk. */
  private bed(look: number): void {
    const top = (x: number) => PORT.bed + Math.round(3 * Math.sin(x / 57) + 3 * fbm(x / 30, 1, 2, 541));
    this.as(() => {
      const [a, b] = this.rows(PORT.bed - 10, PORT.bed + 60);
      for (let y = a; y < b; y++) for (let x = 0; x < this.w; x++) {
        const t0 = top(x);
        if (y < t0) continue;
        const down = (y - t0) / 32;
        const ripple = Math.sin((x + (y - t0) * 2.5) / 6 + noise2(x / 40, y / 8, 542) * 3) > 0.72;
        // the light falls in pools on the open sand where visitors stand; toward the sides and the reef the sand is in the water's shade
        const pool = Math.max(...this.plan.under.map((p) => Math.exp(-(((x - p.x) / 120) ** 2))));
        const t = 0.32 + 0.45 * pool - down * 0.3 + 0.08 * (hash2(x >> 1, y, 543) - 0.5);
        this.put(x, y, y === t0 ? (pool > 0.5 ? R.dry[3]! : R.dry[2]!) : ripple ? R.dry[pool > 0.6 ? 1 : 0]! : tone(F.dry, clamp01(t), x, y, 0.2));
      }
    });
    const b = this.brush(look, PORT_DEEP_FRAMES);
    const shift = (y: number) => y - this.top;
    for (const [x, y, r, seed] of [[150, 398, 4, 1], [226, 402, 3, 2], [366, 394, 5, 3], [492, 400, 4, 4], [612, 396, 3, 5], [30, 404, 3, 6]] as const) {
      this.as(() => pebble.paint(b, x, shift(y), optionsOf(pebble, 'grey', { r }), seed));
    }
    // two big cobbles half sunk in the sand (`stones/pebble`, its cobble: the boulder of the kit wants the shore's runs)
    for (const [x, r, seed] of [[204, 11, 7], [424, 9, 8]] as const) {
      this.as(() => pebble.paint(b, x, shift(PORT.bed + 12), optionsOf(pebble, 'cobble', { r }), seed));
    }
  }

  /** A mound of old coral rock the reef grows on: lumpy, its top lit, pocked with holes. Returns its top's row at a column. */
  private mound(l: number, r: number, high: number, run: readonly number[], seed: number): (x: number) => number {
    const top = (x: number) => {
      const u = (x - l) / (r - l);
      return PORT.bed + 4 - Math.round(high * Math.sin(Math.PI * clamp01(u)) ** 0.6 * (0.75 + 0.5 * fbm(x / 17, 1, 2, seed)));
    };
    this.as(() => {
      for (let x = l; x <= r; x++) {
        const t0 = top(x);
        for (let y = t0; y < PORT.bed + 10; y++) {
          const hole = noise2(x / 5, y / 4, seed + 1) < -0.55;
          const lump = fbm(x / 8, y / 6, 2, seed + 2);
          this.put(x, y, y < t0 + 2 ? run[3]! : hole ? run[0]! : tone(run, clamp01(0.18 + lump * 0.3 - (y - t0) / 90), x, y, 0.2));
        }
      }
      // barnacles all over the rock, the 1991 reef's: pale rings with a dark mouth
      for (let k = 0; k < (r - l) / 7; k++) {
        const bx = l + 4 + Math.floor(hash2(k, seed, 3) * (r - l - 8)), by = top(bx) + 3 + Math.floor(hash2(k, seed, 4) * 14);
        const rr = 1.5 + hash2(k, seed, 5) * 1.6;
        for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
          const d = Math.hypot(dx, dy * 1.2);
          if (d <= rr + 0.6) this.put(bx + dx, by + dy, d < rr - 0.8 ? run[0]! : dy < 0 ? R.shingle[3]! : R.shingle[1]!);
        }
      }
    });
    return top;
  }

  /** A sea fan: a lattice spread like a hand, on a short stem. */
  private fan(x: number, foot: number, tall: number, run: readonly number[], look: number): void {
    this.as(() => {
      const bend = swing(look, PORT_DEEP_FRAMES, x / 61) * 2;
      for (let y = foot - tall; y <= foot; y++) for (let dx = -tall; dx <= tall; dx++) {
        const up = (foot - y) / tall, u = dx / (tall * 0.8);
        const inFan = u * u + (up - 0.58) ** 2 * 2.6 < 0.82 && up > 0.12;
        if (!inFan) continue;
        // a net grown, not ruled: its ribs fork and wander, its cross-links come and go
        const wob = 0.12 * (noise2(dx / 6, y / 6, x + 591) - 0.5) * 2;
        const along = Math.atan2(dx, (foot - y) + 2) + wob, across = Math.hypot(dx, foot - y) + 3 * (noise2(dx / 9, y / 4, x + 592) - 0.5);
        const ribs = 7 + 5 * up;
        const rib = Math.abs((along * ribs + 50) % 1 - 0.5) > 0.38, hoop = Math.abs((across / 6) % 1) < 0.16 && hash2(Math.floor(along * ribs), Math.floor(across / 6), x + 593) > 0.35;
        if (!(rib || hoop)) continue;
        this.put(x + dx + Math.round(bend * up), y, tone(run, clamp01(0.45 + up * 0.35 + (dx > 0 ? 0.1 : 0)), x + dx, y));
      }
      for (let y = foot - Math.round(tall * 0.15); y <= foot; y++) { this.put(x - 1, y, run[1]!); this.put(x, y, run[1]!); this.put(x + 1, y, run[2]!); }
    });
  }

  /** A branching coral: a few stout branches, each forking, the tips pale. */
  private branches(x: number, foot: number, tall: number, run: readonly number[]): void {
    this.as(() => {
      const grow = (bx: number, by: number, a: number, long: number, thick: number, depth: number): void => {
        const ex = bx + Math.sin(a) * long, ey = by - Math.cos(a) * long;
        const n = Math.ceil(long);
        for (let i = 0; i <= n; i++) {
          const px = bx + ((ex - bx) * i) / n, py = by + ((ey - by) * i) / n;
          for (let k = -thick; k <= thick; k++) this.put(px + k, py, tone(run, clamp01(0.4 + (k > 0 ? 0.25 : 0) + (i / n) * 0.2 + depth * 0.1), px, py));
        }
        this.put(ex, ey, run[run.length - 1]!); this.put(ex + 1, ey, run[run.length - 1]!);
        if (depth < 3) for (const turn of [-0.45, 0.4]) grow(ex, ey, a + turn + 0.1 * (hash2(Math.round(bx), depth, 551) - 0.5), long * 0.64, Math.max(1, thick - 1), depth + 1);
      };
      grow(x, foot, -0.25, tall * 0.4, 3, 0);
      grow(x + 4, foot, 0.3, tall * 0.36, 3, 0);
    });
  }

  /** Tube sponges standing in a clump, their mouths dark. */
  private tubes(x: number, foot: number, n: number, run: readonly number[]): void {
    for (let k = 0; k < n; k++) this.as(() => {
      // each bends its own way and swells toward its flared lip
      const tall = 18 + ((k * 11 + x) % 24), left = x + k * 8, bend = (k % 2 ? 1 : -1) * (2 + (k * 7 + x) % 5);
      for (let y = foot - tall; y <= foot; y++) {
        const up = (foot - y) / tall, wide = Math.round(5 + up * 2 + (up > 0.9 ? 2 : 0)), off = Math.round(bend * up * up) - (wide >> 1);
        for (let dx = 0; dx < wide; dx++) {
          const mouth = y < foot - tall + 3 && dx > 0 && dx < wide - 1;
          this.put(left + 3 + off + dx, y, mouth ? run[0]! : tone(run, clamp01(0.4 + (dx >= wide / 2 ? 0.3 : 0) + (dx === wide - 1 ? -0.25 : 0)), left + dx, y));
        }
      }
    });
  }

  /** A brain coral: a round mound with a maze of grooves. */
  private brain(x: number, foot: number, r: number, run: readonly number[]): void {
    this.as(() => {
      for (let dy = -r; dy <= 2; dy++) for (let dx = -r; dx <= r; dx++) {
        if ((dx / r) ** 2 + ((dy + 1) / r) ** 2 > 1) continue;
        const groove = Math.abs(noise2((x + dx) / 3.2, (foot + dy) / 3.2, 561) - 0.5) < 0.07;
        this.put(x + dx, foot + dy, groove ? run[1]! : tone(run, clamp01(0.55 - dy / r * 0.25 + (dx > 0 ? 0.1 : -0.05)), x + dx, foot + dy));
      }
    });
  }

  /** An anemone: a short stalk and tentacles that sway with the loop. */
  private anemone(x: number, foot: number, run: readonly number[], look: number, size = 1): void {
    this.as(() => {
      for (let y = foot - 6 * size; y <= foot; y++) for (let dx = -3 * size; dx <= 3 * size; dx++) this.put(x + dx, y, tone(run, 0.35 + (dx > 0 ? 0.2 : 0), x + dx, y));
      for (let k = 0; k < 11; k++) {
        const a = -1.3 + (k * 2.6) / 10 + swing(look, PORT_DEEP_FRAMES, x / 37 + k / 11) * 0.2;
        for (let i = 0; i < 11 * size; i++) for (const w of [0, 1]) this.put(x + Math.sin(a) * i + w, foot - 6 * size - Math.cos(a) * i * 1.1, i > 8 * size ? run[run.length - 1]! : run[3]!);
      }
    });
  }

  /**
   * Kelp: a long blade from the bed toward the light, its float bladders. Not painted into the looks: the game sways it
   * as it runs (`sway.ts`, a `weed`), so it is painted once as it stands in still water and cut out (`kelps`).
   */
  private kelp(x: number, foot: number, tall: number): void {
    if (!this.withKelp) return;
    this.as(() => {
      this.kelpThings.push(this.thing);
      for (let i = 0; i < tall; i++) {
        const sway = 4 * Math.sin(i / 11 + x);
        const cx = x + sway, y = foot - i;
        const wide = i < 6 ? 1 : 2 + Math.round(1.2 * Math.sin(i / 7 + x) ** 2);
        for (let k = -wide; k <= wide; k++) this.put(cx + k, y, k === wide ? LEAF[2] : k === -wide ? R.bush[0]! : LEAF[0]);
        // a blade now on one side, now on the other, each its own length and droop
        if (i > 8 && hash2(Math.floor(i / 9), x, 597) > 0.45 && i % 9 === 4) {
          const s = hash2(i, x, 598) > 0.5 ? 1 : -1, long = 6 + Math.floor(hash2(i, x, 599) * 9), droop = 0.3 + hash2(i, x, 600) * 0.5;
          for (let k = 0; k < long; k++) {
            this.put(cx + s * (wide + 1 + k), y - Math.round(k * droop), k > long - 3 ? LEAF[2] : LEAF[1]);
            this.put(cx + s * (wide + 1 + k), y + 1 - Math.round(k * droop), R.bush[1]!);
          }
        }
        if (i % 13 === 2 && i > 10) for (const [dx, dy] of [[0, 0], [1, 0], [0, -1], [1, -1]] as const) this.put(cx + wide + 1 + dx, y + dy, R.sponge[2]!);
      }
    });
  }

  /** Sea grass in a tuft. */
  private seaGrass(x: number, foot: number, look: number): void {
    this.as(() => {
      for (let k = 0; k < 7; k++) {
        const tall = 10 + ((k * 5 + x) % 11), bend = (k - 3) * 0.32 + swing(look, PORT_DEEP_FRAMES, x / 29) * 0.4;
        for (let i = 0; i < tall; i++) this.put(x + k * 2 + bend * i * 0.4, foot - i, i > tall - 3 ? LEAF[3] : LEAF[1]);
      }
    });
  }

  private starfish(x: number, y: number): void {
    this.as(() => {
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
        for (let i = 0; i < 8; i++) for (const w of [-1, 0, 1]) {
          if (Math.abs(w) > (8 - i) / 3) continue;
          this.put(x + Math.cos(a) * i - Math.sin(a) * w, y + Math.sin(a) * i * 0.6 + Math.cos(a) * w, i < 2 ? R.red[4]! : R.red[3]!);
        }
      }
    });
  }

  private crab(x: number, y: number, look: number): void {
    this.as(() => {
      const step = look % 2;
      for (let dy = -5; dy <= 0; dy++) for (let dx = -7; dx <= 7; dx++) if ((dx / 7) ** 2 + ((dy + 2.5) / 3.5) ** 2 <= 1) this.put(x + dx, y + dy, dy < -3 ? R.red[3]! : R.red[2]!);
      for (const s of [-1, 1]) {
        for (let k = 0; k < 3; k++) this.put(x + s * (6 + k * 2), y + 1 + ((k + step) % 2), R.red[1]!);
        this.put(x + s * 9, y - 6, R.red[3]!); this.put(x + s * 10, y - 7, R.red[3]!); this.put(x + s * 8, y - 7, R.red[2]!); this.put(x + s * 10, y - 8, R.red[4]!);
      }
      this.put(x - 2, y - 7, R.ink); this.put(x + 2, y - 7, R.ink);
      this.put(x - 2, y - 6, R.red[1]!); this.put(x + 2, y - 6, R.red[1]!);
    });
  }

  /** An urchin: a dark ball of spines. */
  private urchin(x: number, y: number): void {
    this.as(() => {
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        for (let i = 0; i < 7; i++) this.put(x + Math.cos(a) * i, y - 3 + Math.sin(a) * i * 0.8, R.violet[i < 3 ? 1 : 0]!);
      }
    });
  }

  /** An old anchor half sunk in the sand with its chain, the 1991 game's kind of quirk. */
  private anchor(x: number, foot: number): void {
    this.as(() => {
      const iron = (px: number, py: number, t: number) => this.put(px, py, tone(F.stone.slice(0, 5), t, px, py));
      for (let i = 0; i < 40; i++) { const px = x + i * 0.35, py = foot - i; for (let k = -1; k <= 1; k++) iron(px + k, py, 0.4 + k * 0.2); }
      for (let k = -14; k <= 14; k++) { const py = foot - 30 + Math.round(Math.abs(k) * 0.1); iron(x + 10 + k * 1.4, py, 0.55); iron(x + 10 + k * 1.4, py + 1, 0.3); }
      for (let a = 0; a < 30; a++) { const t = Math.PI * (a / 29); iron(x - 2 + Math.cos(t) * 16, foot - 3 + Math.sin(t) * 6, 0.45); iron(x - 2 + Math.cos(t) * 16, foot - 2 + Math.sin(t) * 6, 0.25); }
      for (let a = 0; a < 24; a++) { const t = (a / 24) * Math.PI * 2; iron(x + 14 + Math.cos(t) * 4, foot - 42 + Math.sin(t) * 4, 0.5); }
      for (let i = 0; i < 26; i++) { const px = x + 18 + i * 2.2, py = foot - 42 + i * 1.6 + Math.sin(i) * 1.5; iron(px, py, i % 2 ? 0.55 : 0.3); }
      // its rust and weed
      for (let i = 0; i < 18; i++) this.put(x + hash2(i, 1, 571) * 30 - 8, foot - hash2(i, 2, 572) * 34, i % 3 ? R.sponge[1]! : R.bush[2]!);
    });
  }

  /** A jellyfish: a pale bell with a frilled rim and long trailing threads, swaying in the look (the game bobs it). */
  private jelly(x: number, y: number, run: readonly number[], look: number): void {
    for (let dy = -9; dy <= 0; dy++) for (let dx = -11; dx <= 11; dx++) {
      if ((dx / 11) ** 2 + (dy / 9) ** 2 > 1) continue;
      this.put(x + dx, y + dy, dy > -2 ? run[2]! : (dx + dy) < -8 ? run[4]! : run[3]!);
    }
    for (let k = 0; k < 6; k++) {
      const sx = x - 9 + k * 3.6;
      for (let i = 1; i < 16 + (k % 3) * 5; i++) this.put(sx + Math.round(2 * Math.sin(i / 4 + k + look * Math.PI / 2)), y + i, i % 4 === 0 ? run[4]! : run[2]!);
    }
  }

  /** A seahorse by the kelp, curled tail and snout. */
  private seahorse(x: number, y: number, look: number): void {
    const cy = y + Math.round(swing(look, PORT_DEEP_FRAMES, 0.6) * 2);
    this.as(() => {
      const body: [number, number][] = [[0, -10], [2, -8], [3, -5], [3, -2], [2, 1], [0, 3], [-1, 6], [0, 9], [2, 10], [3, 8], [2, 7]];
      for (const [dx, dy] of body) for (const w of [-1, 0, 1]) this.put(x + dx + w, cy + dy, w < 0 ? R.sponge[2]! : R.sponge[3]!);
      for (let k = 1; k <= 5; k++) this.put(x - 1 - k, cy - 10 + Math.floor(k / 3), R.sponge[2]!);
      this.put(x + 1, cy - 12, R.sponge[4]!); this.put(x, cy - 11, R.sponge[3]!);
      for (const dy of [-6, -3, 0]) this.put(x + 5, cy + dy, R.sponge[4]!);
      this.put(x - 1, cy - 9, R.ink);
    });
  }

  /** A bright fish on its own, facing `way` (1 right): a fat striped body, a fanned tail, a fin on its back, an eye. */
  private brightFish(x: number, y: number, body: readonly number[], stripe: readonly number[], way: number, size: number): void {
    const L = 10 * size, H = 5.5 * size;
    for (let dy = -Math.ceil(H); dy <= Math.ceil(H); dy++) for (let dx = -L; dx <= L; dx++) {
      if ((dx / L) ** 2 + (dy / H) ** 2 > 1) continue;
      const band = Math.abs(dx - 2 * way * size) < 2 * size || Math.abs(dx + 4 * way * size) < 1.5 * size;
      this.put(x + dx, y + dy, band ? stripe[stripe.length - 1]! : tone(body, dy < -1 ? 0.8 : 0.5, x + dx, y + dy));
    }
    for (let k = 0; k < 6 * size; k++) for (let j = -k; j <= k; j++) this.put(x - way * (L + k), y + j * 0.9, body[2]!);
    for (let k = 0; k < 4 * size; k++) this.put(x - way * k, y - H - k * 0.5 + 1, body[2]!);
    this.put(x + way * 6 * size, y - 1, R.ink); this.put(x + way * 6 * size, y - 2, R.ink);
  }

  /** One small silver fish of the school, facing left: its tail forked on the right. */
  private schoolFish(x: number, y: number): void {
    for (let d = 0; d < 6; d++) this.put(x + d, y, d < 2 ? R.hull[3]! : R.hull[4]!);
    this.put(x + 6, y - 1, R.hull[2]!); this.put(x + 6, y + 1, R.hull[2]!); this.put(x + 1, y - 1, R.hull[2]!);
  }

  /** One thing painted on its own, with its ink line, cut to its box: a sprite the game moves (`swimMotion.ts`). */
  private sprite(draw: () => void): Overlay {
    const bitmap = this.canvas(PORT.dive);
    this.as(draw);
    this.outline();
    return cropTogether([bitmap]);
  }

  /**
   * What swims in the water under the quay, each its own sprite (the fish reset their position and
   * so on, and should behave like the clouds do): the bright fish facing right, a small fish of the school, the jellyfish in
   * their looks (the threads sway), a bubble. The game swims them on courses of their own (`swimMotion.ts`).
   */
  swimmers(): PortSwimmers {
    // each painted round one middle point; where that point lies in its sprite places the sprite on its row
    const middle = { x: 200, y: PORT.water + 90 };
    const top = (o: Overlay, row: number) => row - (middle.y - PORT.dive - o.y);
    const fish = PORT_FISH.map((f) => {
      const o = this.sprite(() => this.brightFish(middle.x, middle.y, F[f.body], F[f.stripe], 1, f.size));
      return { bitmap: o.frames[0]!, y: top(o, f.y - PORT.dive) };
    });
    const one = this.sprite(() => this.schoolFish(middle.x, middle.y));
    const jellies = PORT_JELLIES.map((j) => {
      const o = cropTogether(Array.from({ length: PORT_DEEP_FRAMES }, (_, look) => {
        const bitmap = this.canvas(PORT.dive);
        this.as(() => this.jelly(middle.x, middle.y, F[j.run], look));
        this.outline();
        return bitmap;
      }));
      return { frames: o.frames, x: j.x - (middle.x - o.x), y: top(o, j.y - PORT.dive) };
    });
    const bubble = this.sprite(() => { this.put(middle.x, middle.y, R.sea[4]!); this.put(middle.x + 1, middle.y - 1, R.foam); this.put(middle.x - 1, middle.y, R.sea[4]!); }).frames[0]!;
    return { fish, school: one.frames[0]!, schoolY: top(one, PORT.water + 54 - PORT.dive), jellies, bubble, bubbleFrom: { x: 520, y: PORT.bed - 34 - PORT.dive } };
  }

  /**
   * The reef in front of the foundation: mounds of old coral rock with fans, branches, sponges, brains and anemones on
   * them, kelp reaching for the light, fish, two jellyfish and a seahorse; open sand between, where visitors stand.
   */
  private reef(look: number): void {
    const left = this.mound(-8, 116, 34, F.violet, 581);
    const middle = this.mound(206, 428, 30, F.coral, 583);
    const right = this.mound(528, 650, 40, F.violet, 585);
    this.kelp(18, PORT.bed + 6, 164);
    this.kelp(286, middle(286) + 2, 150);
    this.kelp(598, right(598) + 2, 158);
    this.moving(() => this.fan(66, left(66) + 2, 62, F.coral, look));
    this.tubes(104, left(106) + 4, 2, F.sponge);
    this.brain(26, left(26) + 4, 13, F.dry);
    this.branches(270, middle(270) + 3, 62, F.sponge);
    this.brain(290, middle(290) + 5, 18, F.dry);
    this.moving(() => this.anemone(358, middle(358) + 3, F.coral, look, 1.4));
    this.moving(() => this.fan(376, middle(376) + 2, 50, F.violet, look));
    this.urchin(432, PORT.bed + 14);
    this.moving(() => this.fan(574, right(574) + 2, 76, F.sponge, look));
    this.branches(628, right(628) + 3, 58, F.coral);
    this.moving(() => this.anemone(556, right(556) + 4, F.sponge, look));
    this.anchor(500, PORT.bed + 10);
    this.moving(() => this.seaGrass(124, PORT.bed + 8, look));
    this.moving(() => this.seaGrass(186, PORT.bed + 10, look));
    this.moving(() => this.seaGrass(436, PORT.bed + 9, look));
    this.starfish(178, PORT.bed + 22);
    this.moving(() => this.seahorse(326, PORT.water + 96, look));
  }

  // ---- the pictures

  /** The surface stage in one look: the canvas from the tall picture's top. */
  private surface(look: number): Bitmap {
    const bitmap = this.canvas(0);
    this.live.on = look === 0;
    this.paintSky();
    this.paintSea(look);
    // the pale bands the water curls in round what stands in it (`water/rings`, the Phatt dock's), then the quay's dark
    // reflection over them, so the heavy quay stands in dark water and does not float on the lightest
    rings.paint(this.brush(look, PORT_FRAMES), this.seaGround(STANDS), optionsOf(rings, undefined, { band: 24, way: PORT_WAY }), 0);
    this.reflection(look);
    this.nearWater(look);
    this.quayAbove(look);
    if (look === 0) this.liveWater = this.live.seal(bitmap);
    this.live.on = false;
    grain(this.px, this.w, GRAIN_RUNS, { seed: 600 });
    this.outline();
    return bitmap;
  }

  /**
   * The underwater stage in one look: the canvas from `PORT.dive` down, the water cut open under the quay's face. Above
   * the water it is the surface's first look as it stands (`still`, already grained and outlined), so the two stages meet.
   */
  private under(look: number, still: Bitmap): Bitmap {
    const bitmap = this.canvas(PORT.dive);
    const keep = (PORT.water - PORT.dive) * this.w;
    this.px.set(still.pixels.subarray(PORT.dive * this.w, PORT.dive * this.w + keep));
    this.floor = PORT.water;
    this.water(look);
    this.foundation(look);
    this.landingFooting();
    for (const p of PILES) this.as(() => this.pile(look, true, p));
    this.slime(PORT.water, PORT.water + 3);
    this.as(() => this.ladder(LADDER, PORT.water + 20, PORT.water));
    this.bed(look);
    this.reef(look);
    // what no real sea has: the chest, the invented corals and beings (`portWonders.ts`)
    this.moving(() => paintWonders({
      put: (x, y, c) => this.put(x, y, c), thing: (draw) => this.as(draw), fine: F, ink: R.ink, foam: R.foam,
      look, looks: PORT_DEEP_FRAMES, sway: (phase) => swing(look, PORT_DEEP_FRAMES, phase), lit: lampLit(this.brush(look, PORT_DEEP_FRAMES)),
    }));
    grain(this.px, this.w, GRAIN_RUNS, { seed: 601, keep: (i) => i < keep });
    this.outline(PORT.water);
    return bitmap;
  }

  frames(band: number): { frames: Bitmap[]; fore: Overlay; front: Overlay } {
    let front: Overlay | null = null;
    const looks = paintLooks(PORT_FRAMES, this.sky, Math.min(band, PORT.horizon + 1), (look) => {
      const bitmap = this.surface(look);
      if (look === 0) {
        // the quay as painted, for laying over the boats behind it
        const cut = createBitmap(this.w, this.h);
        for (let i = 0; i < Math.min(cut.pixels.length, this.w * (PORT.water + 1)); i++) if (this.quay.has(this.owner[i]!)) cut.pixels[i] = bitmap.pixels[i]!;
        // the ink line round the quay is painted on the sea and sky behind it: keep it with the quay
        for (let i = this.w; i < Math.min(cut.pixels.length, this.w * (PORT.water + 1)); i++) if (!cut.pixels[i] && cut.pixels[i + this.w] && bitmap.pixels[i] === this.darkest.get(bitmap.pixels[i]!)) cut.pixels[i] = bitmap.pixels[i]!;
        front = cropTogether([cut]);
      }
      return bitmap;
    });
    return { ...looks, front: front! };
  }

  /**
   * The deep view's looks, each painted twice: once without what changes its place (`deep`, which the game blends), and
   * once whole, to cut those things out of it by their numbers (`deepThings`, which the game steps).
   */
  deep(still: Bitmap): { deep: Bitmap[]; deepThings: Overlay } {
    const deep: Bitmap[] = [], cuts: Bitmap[] = [];
    for (let look = 0; look < PORT_DEEP_FRAMES; look++) {
      this.withMovers = false;
      deep.push(this.under(look, still));
      this.withMovers = true;
      const whole = this.under(look, still);
      const cut = createBitmap(this.w, this.h);
      for (let i = 0; i < cut.pixels.length; i++) if (this.movers.has(this.owner[i]!)) cut.pixels[i] = whole.pixels[i]!;
      cuts.push(cut);
    }
    return { deep, deepThings: cropTogether(cuts) };
  }

  /**
   * The kelp of the deep view, each plant cut out of a painting of the view with it in (so it has its contour and gives
   * way to what stands before its foot): the game sways them (`sway.ts`). Places in the deep view's pixels.
   */
  kelps(still: Bitmap): Blown[] {
    this.withKelp = true;
    this.kelpThings = [];
    const whole = this.under(0, still);
    this.withKelp = false;
    const { w, h, owner } = this;
    return this.kelpThings.flatMap((thing) => {
      let l = w, r = -1, t = h, b = -1;
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (owner[y * w + x] !== thing) continue;
        l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); b = Math.max(b, y);
      }
      if (r < 0) return [];
      const bitmap = createBitmap(r - l + 1, b - t + 1);
      for (let y = t; y <= b; y++) for (let x = l; x <= r; x++) if (owner[y * w + x] === thing) bitmap.pixels[(y - t) * bitmap.width + x - l] = whole.pixels[y * w + x]!;
      return [{ kind: 'weed' as const, x: l, y: t, bitmap }];
    });
  }

  /** The beacon's light: its fire in the pan and the glow round it at dusk and night, flickering; nothing by day. */
  lamp(base: Bitmap): Overlay {
    const { w, h, plan } = this;
    return cropTogether(Array.from({ length: LAMP_LOOKS }, (_, look) => {
      const bitmap = createBitmap(w, h);
      const brush: KitBrush = {
        ...this.brush(look, LAMP_LOOKS),
        put: (x, y, c) => {
          const px = Math.round(x), py = Math.round(y);
          if (px >= 0 && py >= 0 && px < w && py < h) bitmap.pixels[py * w + px] = c;
        },
        under: (x, y) => {
          const px = Math.round(x), py = Math.round(y);
          if (px < 0 || py < 0 || px >= w || py >= h) return undefined;
          const c = base.pixels[py * w + px]!;
          // the far sea behind the beacon takes its halo as the sky does: the fire burns before it, not over it
          if (py < PORT.deck && F.sea.includes(c)) return { colour: F.sky[0]!, thing: false };
          return { colour: c, thing: !F.sky.includes(c) && !F.sea.includes(c) };
        },
      };
      if (!lampLit(brush)) {
        bitmap.pixels[0] = R.ink;
        return bitmap;
      }
      const flameY = plan.lamp.y - 10;
      lamp.paint(brush, panMiddle(plan.lamp), flameY, optionsOf(lamp, undefined, { reach: 34 + look * 2, water: PORT.water + 2 - flameY, lantern: false }), look);
      fire(brush.put, plan.lamp, look);
      return bitmap;
    }));
  }

  /** The runs a boat is painted from, its lamp lit at dusk and night. */
  boatRuns(): BoatRuns {
    const lit = lampLit(this.brush(0, PORT_FRAMES)) ? R.ember[4]! : null;
    return { ink: R.ink, hull: F.hull, red: F.red, wood: F.wood, stone: F.stone, shingle: F.shingle, sponge: F.sponge, dry: F.dry, sea: F.sea, tar: F.wood, lit };
  }
}

/** Paints the southern port as planned, for one hour of the sky. */
export function paintPort(plan: PortPlan, phase: SkyPhase): PortPicture {
  const p = new PortPainter(plan, phase);
  const clouds = PORT_CLOUDS.map(({ at, spec }) => ({ x: at[0], y: at[1], bitmap: p.cloud(spec) }));
  const { frames, fore, front } = p.frames(Math.max(...clouds.map((c) => c.y + c.bitmap.height)));
  return { palette: p.palette, frames, fore, clouds, front, lamp: p.lamp(frames[0]!), water: p.liveWater!, ...p.deep(frames[0]!), kelp: p.kelps(frames[0]!), swimmers: p.swimmers(), boats: boatsOf(p), gull: p.gullTone(), leap: p.leapTones() };
}

/** The column the fire pan's middle stands on: the post's top, which leans a little toward the sea. */
function panMiddle(pan: { x: number; y: number }): number {
  const foot = PORT.deck + sag(pan.x) + 1, top = pan.y + FIRE_PAN.deep + 2;
  return pan.x - Math.round((foot - top) * 0.04);
}

/**
 * The fire burning in the beacon's pan, one of its flickering looks: a bed of glowing coals along the rim and tongues of
 * flame over it, white-yellow at the heart, orange, red at their tips, a little taller and leaning a different way in
 * each look, and a few sparks flying up. Its own light: no hour changes it.
 */
function fire(put: (x: number, y: number, c: number) => void, pan: { x: number; y: number }, look: number): void {
  const cx = panMiddle(pan);
  const half = FIRE_PAN.half - 2;
  for (let k = -half; k <= half; k++) put(cx + k, pan.y, hash2(k, look, 481) > 0.4 ? R.ember[4]! : R.ember[3]!);
  for (let k = -half; k <= half; k++) {
    const u = k / half, sway = Math.sin(look * 2.1 + k / 3) * 1.2;
    const tall = Math.round((15 - 10 * u * u) * (0.7 + 0.45 * hash2(k >> 1, look, 482)));
    for (let up = 1; up <= tall; up++) {
      const f = up / tall, x = Math.round(cx + k + sway * f * f);
      if (f > 0.75 && hash2(k, up + look * 7, 483) > 0.6) continue; // ragged tips
      put(x, pan.y - up, f < 0.3 && Math.abs(u) < 0.5 ? R.ember[5]! : f < 0.55 ? R.ember[4]! : f < 0.8 ? R.ember[3]! : R.ember[2]!);
    }
  }
  for (let k = 0; k < 4; k++) {
    const x = cx + Math.round((hash2(k, look, 484) - 0.5) * 18), y = pan.y - 18 - Math.round(hash2(k, look, 485) * 12);
    put(x, y, k % 2 ? R.ember[4]! : R.ember[3]!);
  }
}

/** The visitors' boats as `paintPort` paints them for the hour, without painting the port round them. */
export function portBoats(plan: PortPlan, phase: SkyPhase): Record<BoatKind, BoatPicture> {
  return boatsOf(new PortPainter(plan, phase));
}

function boatsOf(p: PortPainter): Record<BoatKind, BoatPicture> {
  const runs = p.boatRuns();
  return Object.fromEntries(BOAT_KINDS.map((kind) => [kind, paintBoat(kind, runs, kind === PORT_AT_LANDING ? LANDING_TIES : undefined)])) as Record<BoatKind, BoatPicture>;
}

/** The boat at the landing ties its stern back to an iron ring in the quay's face and its bow to the ring over the landing. */
const LANDING_TIES: BoatTies = {
  stern: { x: RINGS[1] - PORT_LANDING_BERTH.x, y: PORT.deck + 22 - PORT_LANDING_BERTH.water },
  bow: { x: LANDING_RING.x - PORT_LANDING_BERTH.x, y: LANDING_RING.y - PORT_LANDING_BERTH.water },
};

/** Where each moored boat's picture goes: at its berth, the berth's point being the boat's stern at the water. */
export function portMoorings(plan: PortPlan, moored: readonly BoatKind[]): { kind: BoatKind; x: number; y: number }[] {
  return moored.slice(0, plan.berths.length).map((kind, i) => ({ kind, x: plan.berths[i]!.x, y: plan.berths[i]!.water }));
}

/**
 * The surface stage laid as the game shows it standing still (reduced motion, the art tools, the first frame of a
 * dive): the first look, the clouds where they are painted, what stands before them, the moored boats, the quay over
 * them, the beacon's light in its middle look.
 */
/** The view under the water as it stands in one of its looks, what steps laid over what blends (without the kelp and the swimmers the game moves). */
export function portDeepStill(picture: PortPicture, look = 0): Bitmap {
  const base = picture.deep[look]!;
  const out = createBitmap(base.width, base.height);
  out.pixels.set(base.pixels);
  const things = picture.deepThings.frames[look];
  if (things) blit(out, things, picture.deepThings.x, picture.deepThings.y);
  return out;
}

export function portStill(picture: PortPicture, plan: PortPlan, moored: readonly BoatKind[], atLanding: BoatKind | null = PORT_AT_LANDING): Bitmap {
  const base = picture.frames[0]!;
  const out = createBitmap(base.width, base.height);
  out.pixels.set(base.pixels);
  for (const c of picture.clouds) blit(out, c.bitmap, c.x, c.y);
  const lay = (o: Overlay, frame: number, dx = 0, dy = 0) => { const b = o.frames[frame]; if (b) blit(out, b, o.x + dx, o.y + dy); };
  lay(picture.fore, 0);
  // the water as it stands at the first moment of live water (`liveWater.ts`)
  const water = liveWaterAt(picture.water, 0, GUST_MS[1]!);
  blit(out, water.bitmap, water.x, water.y);
  for (const m of portMoorings(plan, moored)) { const boat = picture.boats[m.kind]; blit(out, boatStill(boat), boat.x + m.x, boat.y + m.y); }
  lay(picture.front, 0);
  if (atLanding) { const boat = picture.boats[atLanding]; blit(out, boatStill(boat), boat.x + PORT_LANDING_BERTH.x, boat.y + PORT_LANDING_BERTH.water); }
  lay(picture.lamp, Math.min(1, picture.lamp.frames.length - 1));
  return out;
}
