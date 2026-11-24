import { beyondCut, LANDMARK, LIGHTHOUSE_DRAWN, LIGHTHOUSE_METRES, type KeriMapPlan } from '../../../../core/layout/keriMap';
import { longSide } from '../../../../core/layout/keriMapShape';
import type { Rect } from '../../../../core/layout/rect';
import type { SkyPhase } from '../../../../core/sky/skyPhase';
import { buildingCorners, insideRing, type World, type WorldPoint } from '../../../../core/world/world';
import { createBitmap, type Bitmap } from '../bitmap';
import { fineRun } from '../paint/lab';
import { colour, mix, type Colour } from '../paint/materials';
import { grain } from '../paint/grain';
import { fbm, hash2, noise2 } from '../paint/noise';
import { clamp01 } from '../paint/ease';
import { Reducer } from '../paint/reduce';
import { C, PALETTE } from '../palette';
import { tintedCloud, type CurlSpec } from './curlCloud';
import type { MapBeam } from './beam';
import { MAX_STEP } from './keriPalette';
import { lump } from './kit/shape';

/**
 * The map of Keri as a painted picture (ft_1_18.AC2, d111), in the manner of the island maps of the painted adventure
 * games: the island seen at a slant in its sea, with shallows and a surf line round it, a stone shore with a low bank, the
 * grass painted in many greens, the paths as thin light lines, small houses and a strong lighthouse standing up, drifting
 * clouds, the island's name in painted letters and a compass rose. Everything that stands on the ground comes from the
 * world model (`content/world/keri.json`, d108); nothing of the island is placed by hand. Bushes, flowers and boulders are
 * scattered by noise where the model has meadow, shingle and shallows: they are texture, not places. Painted in full colour for each hour of the sky, then brought down to
 * the map's palette with dither.
 */

/** The runs of colours the map adds to the game's palette, each dark to light; the sea's first, which the sea alone is painted from. */
const SEA_RUNS = {
  seaDay: [0x0f2f7a, 0x16409a, 0x1d52b6, 0x2866cc, 0x3a7edc, 0x559ae8, 0x7ab6f0, 0xa6d2f6, 0xd2ebfb, 0xf2fbff],
  /** The sea at night: the brightest thing of a night map, as on the 1991 maps. */
  seaNight: [0x060c26, 0x0a143a, 0x0e1e52, 0x14296c, 0x1a3686, 0x234b9f, 0x2b5cb0, 0x3a74c4, 0x5a92d6],
  /** The sea at dawn and dusk. */
  seaTwilight: [0x161438, 0x1e1a48, 0x2a2458, 0x383068, 0x45306e, 0x54407e, 0x644084, 0x7a5a94, 0x8a5290, 0x9a6a9c, 0xb06a8c, 0xc088a0, 0xd08a84, 0xe8aa82, 0xf6cc98, 0xfde8c0],
} as const satisfies Record<string, readonly number[]>;
const LAND_RUNS = {
  /** The meadow: dark and olive, lit in few strokes (the 1991 maps' land by day is a dark olive). */
  grass: [0x0c2616, 0x12361a, 0x1c4a20, 0x285e26, 0x38762e, 0x4e8e38, 0x6aa646, 0x8cbc58, 0xaed06c, 0xcadc86],
  stone: [0x1e1c24, 0x2e2c34, 0x424048, 0x5a5860, 0x76747a, 0x949290, 0xb2aea6, 0xcec8ba, 0xe6e0d0, 0xf6f2e6],
  /** Parchment, paths and roofs. */
  parchment: [0x4a2e1a, 0x6e4826, 0x946638, 0xb88a50, 0xcda06a, 0xd6ae72, 0xe0bd84, 0xecd09a, 0xf2dcae, 0xf8e8c0],
  /** The lighthouse's iron. */
  iron: [0x3a0e12, 0x62161a, 0x8e2220, 0xb8322a, 0xdc5038, 0xf08060],
  /** Stone, plaster and tin in the moon's light: blue, as the rocks of the 1991 night map are, never grey or brown. */
  moon: [0x0a1220, 0x101c30, 0x182a44, 0x223c5c, 0x305274, 0x44708e, 0x5c8ea6, 0x86b4c4],
} as const satisfies Record<string, readonly number[]>;
/** Sand seen through a day's clear water, from the deeper edge to where it nearly breaks the surface (the reference photograph from the air). */
const SHOAL_DAY = [0x2a78b4, 0x3a94ac, 0x5eae9e, 0x92c298, 0xc2d29c] as const;
/** Handfuls of colours apart, not runs: grass at night and in warm light, lamp and beam, painted tin roofs, a yellow wall, the dry meadow. */
const LOOSE: readonly number[] = [
  0x0a1c26, 0x10283a, 0x183a4a, 0x5a6a34, 0x8a8a3c, 0xb8a44a,
  0xffd24a, 0xfff0a0, 0xfffbe0,
  0x4a6684, 0x6a8aa8, 0x92b0c8, 0xe0b050, 0xd8c46a,
  ...SHOAL_DAY,
];
/**
 * Each run made long (`fineRun`): no step of lightness between two neighbours is over `MAX_STEP`, so the sea and the
 * land shade off between near tones (docs/art-direction.md rule 19).
 */
const long = (runs: Record<string, readonly number[]>): (readonly [string, number[]])[] => Object.entries(runs).map(([name, run]) => [name, fineRun(run, MAX_STEP)] as const);
const LONG_SEA = long(SEA_RUNS), LONG_LAND = long(LAND_RUNS);
const SEA_SHADES: readonly number[] = LONG_SEA.flatMap(([, run]) => run);
/** The shades the map adds to the game's palette: the sea's runs, the land's runs, the loose colours. */
const SHADES: readonly number[] = [...SEA_SHADES, ...LONG_LAND.flatMap(([, run]) => run), ...LOOSE];

/** The places of the map's runs in its palette, each dark to light: what the art rules are measured on (tools/art/pictureRules.test.ts). */
export function mapRuns(): Record<string, number[]> {
  let at = PALETTE.length;
  return Object.fromEntries([...LONG_SEA, ...LONG_LAND].map(([name, run]) => [name, run.map(() => at++)]));
}

export function mapPalette(): readonly number[] {
  return [...PALETTE, ...SHADES];
}

/** The light of an hour: where it comes from on the screen, its colour, and the sea's colours from deep to foam. */
interface Hour {
  /** The way to the light on the screen (x right, y down), a unit vector. */
  to: readonly [number, number];
  light: Colour;
  /** How dark a shadow is (0 none), and how far a metre of height throws it, in pixels. */
  shade: number;
  reach: number;
  sea: readonly [Colour, Colour, Colour, Colour];
  /** Where the low sun colours the sea: the side of the picture (-1 left, 1 right, 0 nowhere) and the colour. */
  glow: { side: number; tint: Colour };
  cloud: readonly [Colour, Colour];
  /** True when the lamp turns and the windows are lit. */
  lit: boolean;
  /** Sand under the water in its own colours, edge to back; without them it is painted from the sea's paler tones. */
  shoal?: readonly Colour[];
}

/** The run of sea shades each hour paints its water from. */
const SEA_OF: Record<SkyPhase, string> = { day: 'seaDay', dawn: 'seaTwilight', dusk: 'seaTwilight', night: 'seaNight' };

const unit = (x: number, y: number): readonly [number, number] => [x / Math.hypot(x, y), y / Math.hypot(x, y)];

const HOURS: Record<SkyPhase, Hour> = {
  day: {
    to: unit(-0.7, -0.7), light: [1, 1, 1], shade: 0.34, reach: 0.7,
    sea: [colour(0x16409a), colour(0x2866cc), colour(0x559ae8), colour(0xf2fbff)],
    glow: { side: 0, tint: [1, 1, 1] }, cloud: [colour(0xffffff), colour(0xa6c0e0)], lit: false,
    shoal: SHOAL_DAY.map(colour),
  },
  dawn: {
    to: unit(1, -0.25), light: [0.8, 0.7, 0.76], shade: 0.4, reach: 1.9,
    sea: [colour(0x383068), colour(0x644084), colour(0xc088a0), colour(0xfde8c0)],
    glow: { side: 1, tint: colour(0xf6b08a) }, cloud: [colour(0xffe0d0), colour(0xb08aa8)], lit: true,
  },
  dusk: {
    to: unit(-1, -0.2), light: [0.84, 0.7, 0.62], shade: 0.46, reach: 2.2,
    sea: [colour(0x2a2458), colour(0x54407e), colour(0xb06a8c), colour(0xfde8c0)],
    glow: { side: -1, tint: colour(0xf6a060) }, cloud: [colour(0xf6cc98), colour(0x8a5290)], lit: true,
  },
  night: {
    to: unit(-0.45, -0.9), light: [0.3, 0.38, 0.62], shade: 0.3, reach: 0.8,
    sea: [colour(0x0a143a), colour(0x1a3686), colour(0x2b5cb0), colour(0x5a92d6)],
    glow: { side: 0, tint: [1, 1, 1] }, cloud: [colour(0x5a92d6), colour(0x1a3686)], lit: true,
  },
};

const INK = colour(0x14101a);
const MEADOW = [colour(0x285e26), colour(0x38762e), colour(0x6aa646), colour(0xaed06c)] as const;
/** The runs as colours, dark to light: the ground is laid in their flat tones. */
const GRASS: readonly Colour[] = LAND_RUNS.grass.map(colour);
const ROCK: readonly Colour[] = LAND_RUNS.stone.map(colour);
const EARTH: readonly Colour[] = LAND_RUNS.parchment.map(colour);
/** The dry meadow of late summer, dark to light. */
const DRIED = [colour(0x5a6a34), colour(0x8a8a3c), colour(0xb8a44a), colour(0xd8c46a)] as const;
/** The colour of a run `k` places up from its darkest. */
const tone = (run: readonly Colour[], k: number): Colour => run[Math.max(0, Math.min(run.length - 1, Math.round(k)))]!;
const DRY = [colour(0xb8a44a), colour(0xd8c46a)] as const;
const BUSH = [colour(0x0c2616), colour(0x1c4a20), colour(0x4e8e38), colour(0x8cbc58)] as const;
/** Seaweed thrown up along the shore. */
const WRACK = colour(0x5a6a34);
const FLOWERS = [colour(0xf6f2e6), colour(0xffd24a), colour(0xf08060)] as const;
const STONE = [colour(0x76747a), colour(0xb2aea6), colour(0xcec8ba), colour(0xf6f2e6)] as const;
const BOULDER = [colour(0x424048), colour(0x949290), colour(0xe6e0d0)] as const;
const BANK = [colour(0x2e2c34), colour(0x5a5860)] as const;
const PATH = colour(0xf8e8c0);
const PARCHMENT = [colour(0x946638), colour(0xd6ae72), colour(0xf8e8c0)] as const;
const IRON = [colour(0x62161a), colour(0xb8322a), colour(0xf08060)] as const;
const LAMP = colour(0xfff0a0);
const GLASS = colour(0x1e1c24);
const DOOR = colour(0x4a2e1a);
const BRICK = colour(0xb8322a);
/** A fire place: cold ash, a glowing ember and its bright heart. */
const EMBER = [colour(0x5a5860), colour(0xf08060), colour(0xffd24a)] as const;
const RAIL = [colour(0x4a2e1a), colour(0x946638)] as const;
type Building = World['buildings'][number];
const WALLS: Record<NonNullable<Building['walls']>, Colour> = { plaster: colour(0xf6f2e6), yellow: colour(0xe0b050), boards: colour(0x946638), green: colour(0x4e8e38) };
/** A roof's shade and its lit side. */
const ROOFS: Record<NonNullable<Building['roof']>, readonly [Colour, Colour]> = {
  tin: [colour(0x76747a), colour(0xcec8ba)], blue: [colour(0x4a6684), colour(0x92b0c8)], red: [colour(0x8e2220), colour(0xdc5038)],
  dark: [colour(0x2e2c34), colour(0x5a5860)], boards: [colour(0x6e4826), colour(0xb88a50)],
};
/** The lighthouse's limestone foot. */
const LIME = [colour(0xcec8ba), colour(0xe6e0d0)] as const;
/**
 * A house on the map is a crooked cottage (the houses had been bland boxes with no
 * character; the picked sketch: same sizes, with character). Its walls are louder than on the
 * photographs, and a hut's green is a sea green, so that the hut stands off the meadow.
 */
const COTTAGE_WALLS: Record<NonNullable<Building['walls']>, Colour> = { plaster: colour(0xfaf4e2), yellow: colour(0xf0c050), boards: colour(0xa87440), green: colour(0x3a7a6a) };
/**
 * A cottage's roof in three flat tones: its shade, its lit face, the glint along its ridge. A large house's tin is painted
 * pale blue (the warden's house on the photograph of its gable); `bare` is a hut's tin, weathered.
 */
const COTTAGE_ROOFS: Record<NonNullable<Building['roof']> | 'bare', readonly [Colour, Colour, Colour]> = {
  tin: [colour(0x4a6684), colour(0x92b0c8), colour(0xd2ebfb)], blue: [colour(0x2a4a84), colour(0x4a7ab8), colour(0x92b0c8)], red: [colour(0x8e2220), colour(0xdc5038), colour(0xf6a060)],
  dark: [colour(0x2e2c34), colour(0x5a5860), colour(0x949290)], boards: [colour(0x4a2e1a), colour(0x946638), colour(0xd6ae72)], bare: [colour(0x5e4a44), colour(0xa08678), colour(0xdcc8b0)],
};
/** What plaster and limestone turn toward in their own shade. */
const SHADE_VIOLET = colour(0x54407e);
/** Window shutters, one colour to a house. */
const SHUTTERS = [colour(0xb04030), colour(0x2f7f86), colour(0x8a5a2a)] as const;
const RUST = colour(0xc0622a);
const MOSS = colour(0x5a8a3a);
/** A window's glass by day, the sea's dark blue in it, and the pale paint of a sill. */
const PANE = colour(0x1c2a58);
const PALE_PAINT = colour(0xfffbe0);
/** How high a gable stands over its eaves, as a share of its width, and how much of its length a house seen end on shows of its roof. */
const GABLE_RISE = 0.44;
const ROOF_RUN = 0.6;

/** A cottage as it is painted: where its front wall's foot is and how wide, how high its wall and roof, how it leans and sags, what it is made of. */
interface Cottage {
  readonly x: number; readonly y: number; readonly w: number; readonly wall: number; readonly roofH: number;
  /** How the foot of the front wall climbs or falls along it, in pixels a pixel. */
  readonly slope: number;
  /** How far the top of the wall stands to the side of its foot, and how far the ridge sags in its middle. */
  readonly lean: number; readonly sag: number;
  readonly roof: readonly [Colour, Colour, Colour]; readonly walls: Colour; readonly boards: boolean; readonly patch: Colour;
  /** `ribs`: painted tin with standing seams; `flecks`: tiles or boards; `none`: tarred. */
  readonly seams: 'ribs' | 'flecks' | 'none';
  readonly windows: number; readonly chimneys: readonly number[]; readonly hip: boolean; readonly seed: number; readonly glow: boolean;
  readonly plinth?: Colour | undefined; readonly bay?: boolean;
}
/** What a cottage seen from its long side is measured by, worked out once: heights in rows over the wall's foot, `u` along the wall from its middle. */
interface SideFrame {
  readonly half: number; readonly eaveV: number; readonly eaveRows: number; readonly over: number; readonly inset: number;
  readonly slots: number; readonly doorAt: number; readonly paneTall: number; readonly doorTall: number;
  readonly bayReach: number; readonly bayHigh: number;
  readonly patches: readonly { u: number; row: number }[];
  ridgeV(u: number): number;
  slotU(n: number): number;
}

/** What a pixel shows: the outline pass draws a dark line where two things meet. */
const enum Kind { Sea, Stone, Grass, Bank }

/** How far the bank of the shore reaches down the screen: the island has a thickness, as the islands of the 1991 maps have. */
const BANK_ROWS = 7;
/** Houses are drawn taller still than `LANDMARK`, and their ground plan larger than to scale, as on an illustrated map: a place of interest is far larger than to scale (d125). */
const HOUSE_SCALE = 3.1;
const HOUSE_PLAN = 2.1;
/**
 * The warden's house is drawn this share of its length, so that it does not compete with its surroundings (a
 * window's width off each end).
 */
const WARDEN_LONG = 0.8;
/** The meadow reaches this many pixels further into the shingle than the orthophoto has it: the island is green first (d125). */
const MEADOW_GROWS = 7;
/** How often the paint's grain moves a pixel a place up or down its run. */
const GRAIN = 0.2;
/** How high a roof's ridge stands over its eaves, as a share of the house's drawn width. */
const ROOF_PITCH = 0.42;
/** And the lighthouse, the island's mark, far taller than its true height; the mast less so. */
const TOWER_SCALE = LIGHTHOUSE_DRAWN;
/**
 * The lighthouse's parts as shares of its height, read off the reference photographs: the stone foot's
 * half width, where the stone ends, where the iron tower flares, the upper gallery, the lantern's glass, the dome;
 * the hoops round the stone, and the lamp.
 */
const TOWER = { foot: 0.2, stone: 0.54, flare: 0.74, upper: 0.8, glass: 0.875, dome: 0.948, hoops: [0.035, 0.085, 0.14, 0.2, 0.265], lamp: 0.91 } as const;
const MAST_SCALE = 3.6;
/** AX-3 provisional: the lattice mast's height is not measured (`KERI-TODO`); on the drone photographs it is lower than the lighthouse. */
const MAST_METRES = 20;
/** How near the pavement's end a way's first point has to lie to start there, and how far the southern stone quay runs out past the land, its square head included, in fine pixels (much larger and heavier). */
const HOUSE_REACH = 30;
const PIER_LONG = 34;
/** No ordered dither: a tone's border is broken by the grain (`GRAIN`), as scanned paint is. */
const DITHER = 0;


/** The distance in pixels from every pixel where `inside` is 0 to the nearest where it is 1 (0 there): two sweeps with whole and diagonal steps. */
function distances(inside: Uint8Array, w: number, h: number): Float32Array {
  const d = new Float32Array(w * h);
  const FAR = 1e6;
  for (let i = 0; i < d.length; i++) d[i] = inside[i] ? 0 : FAR;
  const pass = (x: number, y: number, dx: number, dy: number, cost: number): void => {
    const xx = x + dx, yy = y + dy;
    if (xx < 0 || yy < 0 || xx >= w || yy >= h) return;
    const v = d[yy * w + xx]! + cost;
    if (v < d[y * w + x]!) d[y * w + x] = v;
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { pass(x, y, -1, 0, 1); pass(x, y, 0, -1, 1); pass(x, y, -1, -1, 1.414); pass(x, y, 1, -1, 1.414); }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) { pass(x, y, 1, 0, 1); pass(x, y, 0, 1, 1); pass(x, y, 1, 1, 1.414); pass(x, y, -1, 1, 1.414); }
  return d;
}

/** A ring with its corners cut twice over (Chaikin): the traced coast's steps become a shore's curves. */
function rounded(ring: World['coast']): [number, number][] {
  let out = ring.map(([x, y]) => [x, y] as [number, number]);
  for (let pass = 0; pass < 2; pass++) {
    out = out.flatMap((p, i) => {
      const q = out[(i + 1) % out.length]!;
      return [[p[0] * 0.75 + q[0] * 0.25, p[1] * 0.75 + q[1] * 0.25], [p[0] * 0.25 + q[0] * 0.75, p[1] * 0.25 + q[1] * 0.75]] as [number, number][];
    });
  }
  return out;
}

/** The pixels whose middle lies inside the polygon (even-odd rule), 1 for each: row by row, between the crossings of its edges. */
function covered(points: readonly Pt[], w: number, h: number): Uint8Array {
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const at = y + 0.5;
    const crossings: number[] = [];
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const p = points[i]!, q = points[j]!;
      if (p.y > at !== q.y > at) crossings.push(p.x + ((at - p.y) * (q.x - p.x)) / (q.y - p.y));
    }
    crossings.sort((a, b) => a - b);
    for (let k = 0; k + 1 < crossings.length; k += 2) {
      for (let x = Math.max(0, Math.ceil(crossings[k]! - 0.5)); x <= Math.min(w - 1, Math.floor(crossings[k + 1]! - 0.5)); x++) mask[y * w + x] = 1;
    }
  }
  return mask;
}

/** Leaves only the largest connected area of 1s in `mask`. */
function keepLargest(mask: Uint8Array, w: number, h: number): void {
  const label = new Int32Array(w * h);
  let best = 0, bestSize = 0, labels = 0;
  const stack: number[] = [];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || label[start]) continue;
    labels++;
    let size = 0;
    stack.push(start);
    label[start] = labels;
    while (stack.length) {
      const i = stack.pop()!;
      size++;
      const x = i % w;
      for (const j of [x > 0 ? i - 1 : -1, x + 1 < w ? i + 1 : -1, i - w, i + w]) {
        if (j < 0 || j >= mask.length || !mask[j] || label[j]) continue;
        label[j] = labels;
        stack.push(j);
      }
    }
    if (size > bestSize) { bestSize = size; best = labels; }
  }
  for (let i = 0; i < mask.length; i++) if (label[i] !== best) mask[i] = 0;
}

type Pt = { x: number; y: number };

/** Calls `put` for every pixel inside the polygon. */
function fill(points: readonly Pt[], w: number, h: number, put: (x: number, y: number) => void): void {
  const ys = points.map((p) => p.y), xs = points.map((p) => p.x);
  const ring = points.map((p) => [p.x, p.y] as const);
  for (let y = Math.max(0, Math.floor(Math.min(...ys))); y <= Math.min(h - 1, Math.ceil(Math.max(...ys))); y++) {
    for (let x = Math.max(0, Math.floor(Math.min(...xs))); x <= Math.min(w - 1, Math.ceil(Math.max(...xs))); x++) {
      if (insideRing(ring, { x: x + 0.5, y: y + 0.5 })) put(x, y);
    }
  }
}

/** The picture being painted: a colour for each pixel, and which thing each pixel belongs to (0 for the ground and the sea). */
class Canvas {
  readonly rgb: Float32Array;
  readonly thing: Uint16Array;
  private things = 0;

  constructor(readonly w: number, readonly h: number) {
    this.rgb = new Float32Array(w * h * 3);
    this.thing = new Uint16Array(w * h);
  }

  private readonly unlined = new Set<number>();

  /** A new thing's number: its pixels get a dark line where they meet anything else. */
  next(): number {
    return ++this.things;
  }

  /** A thing with no dark line of its own: a bush, a boulder, a chimney, the painted name (which draws its own). */
  soft(): number {
    const n = this.next();
    this.unlined.add(n);
    return n;
  }

  put(x: number, y: number, c: Colour, thing = -1): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = y * this.w + x;
    this.rgb[i * 3] = c[0]; this.rgb[i * 3 + 1] = c[1]; this.rgb[i * 3 + 2] = c[2];
    if (thing >= 0) this.thing[i] = thing;
  }

  /** Darkens (below 1) or lights a pixel. */
  scale(x: number, y: number, k: number): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 3;
    this.rgb[i] = this.rgb[i]! * k; this.rgb[i + 1] = this.rgb[i + 1]! * k; this.rgb[i + 2] = this.rgb[i + 2]! * k;
  }

  poly(points: readonly Pt[], c: Colour, thing: number): void {
    fill(points, this.w, this.h, (x, y) => this.put(x, y, c, thing));
  }

  /** The dark line round every thing: on the thing's own pixels where the neighbour is something else. */
  outline(): void {
    const { w, h, thing } = this;
    const edge = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, own = thing[i]!;
      if (own === 0 || this.unlined.has(own)) continue;
      if ((x > 0 && thing[i - 1] !== own) || (x + 1 < w && thing[i + 1] !== own) || (y > 0 && thing[i - w] !== own) || (y + 1 < h && thing[i + w] !== own)) edge[i] = 1;
    }
    edge.forEach((on, i) => { if (on) this.put(i % w, Math.floor(i / w), INK); });
  }
}

/**
 * The strokes of the island's name "Keri", as a broad pen draws them: each a run of points (x, y, half the pen's width) in
 * units of the capital's height, y down from the capital's top. The name of a place is the same in every language, so it
 * is painted, not set from a string (d111).
 */
const NAME_STROKES: readonly (readonly (readonly [number, number, number])[])[] = [
  // K: the stem, its foot, the arm, and the leg that runs on under the other letters as a swash
  [[0.02, 0.05, 0.03], [0.1, -0.01, 0.045], [0.17, 0.04, 0.065], [0.16, 0.35, 0.08], [0.16, 0.7, 0.08], [0.17, 1.0, 0.07]],
  [[0.03, 1.01, 0.03], [0.32, 1.01, 0.03]],
  [[0.74, 0.0, 0.065], [0.66, 0.06, 0.05], [0.5, 0.24, 0.04], [0.33, 0.44, 0.035], [0.2, 0.56, 0.035]],
  [[0.27, 0.48, 0.04], [0.42, 0.68, 0.07], [0.6, 0.93, 0.08], [0.86, 1.1, 0.06], [1.3, 1.18, 0.04], [1.9, 1.17, 0.03], [2.35, 1.1, 0.025], [2.52, 0.98, 0.035]],
  // e
  [[0.98, 0.72, 0.03], [1.2, 0.7, 0.035], [1.35, 0.62, 0.04], [1.3, 0.47, 0.05], [1.16, 0.41, 0.055], [1.02, 0.52, 0.07], [0.96, 0.72, 0.08], [1.03, 0.92, 0.07], [1.19, 1.0, 0.055], [1.35, 0.95, 0.04], [1.43, 0.86, 0.025]],
  // r: the stem, its foot, the shoulder
  [[1.52, 0.5, 0.03], [1.6, 0.44, 0.05], [1.62, 0.7, 0.075], [1.62, 1.0, 0.07]],
  [[1.5, 1.01, 0.028], [1.76, 1.01, 0.028]],
  [[1.63, 0.62, 0.03], [1.73, 0.48, 0.045], [1.85, 0.42, 0.06], [1.95, 0.48, 0.065]],
  // i
  [[2.04, 0.5, 0.03], [2.12, 0.44, 0.05], [2.14, 0.7, 0.075], [2.15, 0.9, 0.07], [2.22, 1.0, 0.05], [2.34, 0.97, 0.025]],
];
/** Which stroke is the swash, where the i's star stands, and the room the name takes, in the same units. */
const NAME_SWASH = 3;
const NAME_STAR = [2.2, 0.15] as const;
const NAME_SIZE = { w: 2.95, h: 1.55 } as const;
/** The letters' gold from the top to the foot, its shaded rim, and the line round the letters. */
const NAME_GOLD = [colour(0xfffbe0), colour(0xffd24a), colour(0xe0b050), colour(0x946638), colour(0x4a2e1a)] as const;

/** A run of points made smooth: a curve through them all (Catmull-Rom), eight steps between each two. */
function smoothRun(points: readonly (readonly [number, number, number])[]): [number, number, number][] {
  const out: [number, number, number][] = [];
  const at = (i: number) => points[Math.max(0, Math.min(points.length - 1, i))]!;
  for (let i = 0; i < points.length - 1; i++) {
    const [a, b, c, d] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    for (let s = 0; s < 8; s++) {
      const t = s / 8;
      const curve = (k: 0 | 1 | 2): number => 0.5 * (2 * b[k] + (c[k] - a[k]) * t + (2 * a[k] - 5 * b[k] + 4 * c[k] - d[k]) * t * t + (3 * b[k] - a[k] - 3 * c[k] + d[k]) * t * t * t);
      out.push([curve(0), curve(1), Math.max(0.01, curve(2))]);
    }
  }
  const last = points[points.length - 1]!;
  out.push([last[0], last[1], last[2]]);
  return out;
}

const lit = (c: Colour, light: Colour, k = 1): Colour => [c[0] * light[0] * k, c[1] * light[1] * k, c[2] * light[2] * k];

class MapPainter {
  private readonly w: number;
  private readonly h: number;
  private readonly hour: Hour;
  private readonly kind: Uint8Array;
  /** For a sea pixel the distance to land, for a land pixel the distance to the sea, and to the edge of the grass. */
  private readonly toLand: Float32Array;
  private readonly toSea: Float32Array;
  private readonly toStone: Float32Array;
  private readonly toGrass: Float32Array;
  /** For a pixel of the bank's face, how many rows it lies under the land's edge. */
  private readonly bankDepth: Uint8Array;
  /** The island's middle and the way its long side runs, in map metres: the meadow's strokes lie along it. */
  private readonly side: { x: number; y: number; ux: number; uy: number };
  private readonly land: Canvas;
  private readonly reducer: Reducer;
  /** The sea takes only the sea's own shades: a grey of the stones in the water would read as dirt. */
  private readonly seaReducer: Reducer;
  readonly palette = mapPalette();

  constructor(private readonly world: World, private readonly plan: KeriMapPlan, phase: SkyPhase) {
    this.w = plan.fine.w;
    this.h = plan.fine.h;
    this.hour = HOURS[phase];
    const { w, h } = this;
    const { view } = plan;
    this.kind = new Uint8Array(w * h);
    this.bankDepth = new Uint8Array(w * h);
    const long = longSide(world);
    this.side = { x: long.x, y: long.y, ux: Math.cos(long.angle), uy: Math.sin(long.angle) };
    const isLand = new Uint8Array(w * h), isSea = new Uint8Array(w * h), notGrass = new Uint8Array(w * h);
    const coast = covered(rounded(world.coast).map(([x, y]) => view.toScreen({ x, y })), w, h);
    const grass = covered(rounded(world.grass).map(([x, y]) => view.toScreen({ x, y })), w, h);
    // the sand strip's root is no land on the map: what the coast has beyond the cut lies under water
    for (let i = 0; i < w * h; i++) {
      if (!coast[i] || beyondCut(plan.sand, i % w, Math.floor(i / w))) continue;
      isLand[i] = 1;
      this.kind[i] = grass[i] ? Kind.Grass : Kind.Stone;
    }
    // a strip of land one pixel thin (a crack in the traced coast, pressed flat by the slant) is sea, and so is a speck cut off by that
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (isLand[i] && ((!isLand[i - w] && !isLand[i + w]) || (!isLand[i - 1] && !isLand[i + 1]))) isLand[i] = 0;
    }
    keepLargest(isLand, w, h);
    isLand.forEach((on, i) => { if (!on) this.kind[i] = Kind.Sea; });
    // the bank: the shore's side, seen under the land's southern edges
    for (let y = h - 1; y >= 0; y--) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (isLand[i]) continue;
      for (let k = 1; k <= BANK_ROWS && y - k >= 0; k++) if (isLand[i - k * w]) { this.kind[i] = Kind.Bank; this.bankDepth[i] = k; break; }
    }
    this.kind.forEach((k, i) => { isSea[i] = k === Kind.Sea ? 1 : 0; });
    for (let i = 0; i < isLand.length; i++) if (this.kind[i] === Kind.Bank) isLand[i] = 1;
    this.toLand = distances(isLand, w, h);
    this.toSea = distances(isSea, w, h);
    // the meadow grows out over the shingle, further here and less there, and never down to the water
    const fromGrass = distances(Uint8Array.from(this.kind, (k) => (k === Kind.Grass ? 1 : 0)), w, h);
    for (let i = 0; i < this.kind.length; i++) {
      if (this.kind[i] !== Kind.Stone) continue;
      const x = i % w, y = Math.floor(i / w);
      if (fromGrass[i]! < MEADOW_GROWS + 6 * (noise2(x / 14, y / 9, 17) - 0.5) && this.toSea[i]! > 8 + 5 * noise2(x / 11, y / 7, 18)) this.kind[i] = Kind.Grass;
    }
    this.kind.forEach((k, i) => { notGrass[i] = k === Kind.Grass ? 0 : 1; });
    this.toStone = distances(notGrass, w, h);
    this.toGrass = distances(notGrass.map((v) => 1 - v), w, h);
    // the map's own shades only: the game's bright button colours would speckle a painting
    // the land takes no violet of the twilight sea: stone in the moon's light is blue, never purple
    const twilight = new Set<number>(LONG_SEA.find(([name]) => name === 'seaTwilight')![1]);
    this.reducer = new Reducer(this.palette, [C.ink, C.white, ...SHADES.map((c, i) => (twilight.has(c) ? -1 : PALETTE.length + i)).filter((i) => i >= 0)]);
    // the sea takes the shades of its own hour only: a dawn sea with patches of the day's blue is two pictures in one
    const own = new Set<number>(LONG_SEA.find(([name]) => name === SEA_OF[phase])![1]);
    this.seaReducer = new Reducer(this.palette, [C.white, ...SEA_SHADES.map((c, i) => (own.has(c) ? PALETTE.length + i : -1)).filter((i) => i >= 0)]);
    this.land = this.paintLand();
  }

  /**
   * The meadow's swells at a pixel: broad strokes that lie along the island's long side, as the brush lays the land on
   * the 1991 maps. Above 0.72 a rise, below it a hollow.
   */
  private swell(x: number, y: number): number {
    const { side } = this;
    const p = this.plan.view.toWorld(x, y);
    const along = (p.x - side.x) * side.ux + (p.y - side.y) * side.uy, across = -(p.x - side.x) * side.uy + (p.y - side.y) * side.ux;
    return fbm(along / 112, across / 36, 3, 21) + 0.45 * fbm(along / 34, across / 14, 2, 22);
  }

  /** How much a swell's flank at a pixel faces the hour's light (above 0) or lies in its shade. */
  private flank(x: number, y: number): number {
    const [lx, ly] = this.hour.to;
    return (this.swell(x + lx * 5, y + ly * 5) - this.swell(x - lx * 5, y - ly * 5)) * 9;
  }

  /**
   * The ground at a pixel, laid in the flat tones of its run (the paint's grain breaks their borders afterwards): the
   * bank's face in upright slabs, the shingle in bands along the shore, the meadow dark, its swells lit on the hour's
   * side in few strokes.
   */
  private ground(x: number, y: number): Colour {
    const i = y * this.w + x;
    const kind = this.kind[i]!;
    const { light } = this.hour;
    if (kind === Kind.Bank) {
      // slabs of unlike widths, every one its own tone, earth among the stone; darker down the face, a pale lip on top
      const slab = Math.floor((x + 3 * noise2(x / 9, 0, 2)) / (5 + 3 * hash2(Math.floor(x / 11), 0, 3)));
      const depth = this.bankDepth[i]!;
      const k = 4.4 - (depth - 1) * (3.2 / BANK_ROWS) + (hash2(slab, 1, 8) - 0.5) * 2.2;
      if (depth === 1) return lit(tone(ROCK, 6), light);
      return lit(hash2(slab, 2, 9) > 0.62 ? tone(EARTH, k * 0.45) : tone(ROCK, k), light);
    }
    if (kind === Kind.Stone) {
      const d = this.toSea[i]!;
      // grass creeps out onto the shingle from the meadow's edge, thinner with every step
      const out = this.toGrass[i]!;
      if (out < 5 && hash2(x >> 1, y, 14) > 0.35 + out * 0.13) return lit(hash2(x, y, 15) > 0.5 ? tone(GRASS, 3) : DRIED[1], light);
      // a broken line of seaweed where the last high water left it
      const wavy = d + (fbm(x / 12, y / 9, 2, 19) - 0.5) * 3;
      if (wavy > 3.6 && wavy < 4.8 && noise2(x / 6, y / 5, 20) > 0.42) return lit(WRACK, light, 0.8);
      // wet and dark at the water, pale up the shore, greyer toward the turf; broad bands lie along the shore
      const w = d + 3 * (noise2(x / 12, y / 8, 13) - 0.5);
      let k = w < 2 ? 3 : w < 5 ? 5 : w < 14 ? 7 : 6;
      if (noise2(x / 34, y / 12, 11) > 0.62) k -= 1;
      if (noise2(x / 21, y / 9, 12) > 0.7) k -= 1;
      return lit(tone(ROCK, k), light);
    }
    const flank = this.flank(x, y), swell = this.swell(x, y);
    let k = 2.7 + flank * 2.6 + (swell - 0.72) * 2.4;
    // the turf's edge: lit where it faces the light, dark where it ends over the stones on the near side
    const rim = this.toStone[i]!;
    if (rim < 5) k += (this.kind[Math.min(this.h - 1, y + 6) * this.w + x] === Kind.Grass ? 1.2 : -1.5) * (1 - rim / 5);
    // dry gold where the ground is thin, only on the flanks the light reaches
    const p = this.plan.view.toWorld(x, y);
    const dryness = fbm(((p.x - this.side.x) * this.side.ux + (p.y - this.side.y) * this.side.uy) / 64 + 3, (-(p.x - this.side.x) * this.side.uy + (p.y - this.side.y) * this.side.ux) / 15, 2, 51);
    if (dryness > 0.64 && flank > -0.15 && rim > 2) return lit(tone(DRIED, (dryness - 0.64) * 16 + flank), light);
    // a flower here and there, away from the meadow's edge
    if (hash2(x, y, 27) > 0.9965 && rim >= 3) return lit(FLOWERS[Math.floor(hash2(x, y, 28) * 3)]!, light);
    return lit(tone(GRASS, Math.max(1, Math.min(7, k))), light);
  }

  /** Stones on the shingle, far larger than to scale: a pale top, a dark foot, no two alike. */
  private pebbles(c: Canvas): void {
    const { w, h, hour } = this;
    for (let gy = 0; gy < h; gy += 5) for (let gx = 0; gx < w; gx += 6) {
      if (hash2(gx, gy, 61) < 0.68) continue;
      const x = gx + Math.floor(hash2(gx, gy, 62) * 5), y = gy + Math.floor(hash2(gx, gy, 63) * 4);
      if (x < 2 || y < 2 || x >= w - 5 || y >= h - 3 || this.toGrass[y * w + x]! < 4) continue;
      const wide = 2 + Math.floor(hash2(gx, gy, 64) * 3.2);
      for (let k = 0; k < wide; k++) {
        if (this.kind[y * w + x + k] !== Kind.Stone || this.kind[(y + 1) * w + x + k] !== Kind.Stone) continue;
        c.put(x + k, y, lit(tone(ROCK, hour.to[0] < 0 === k < wide / 2 ? 8 : 7), hour.light));
        c.put(x + k, y + 1, lit(tone(ROCK, k === (hour.to[0] < 0 ? 0 : wide - 1) ? 5 : 2), hour.light));
      }
    }
  }

  /** The land with everything that stands on it; the sea's pixels are left for `sea`. */
  private paintLand(): Canvas {
    const { w, h, world, plan } = this;
    const c = new Canvas(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (this.kind[y * w + x] !== Kind.Sea) c.put(x, y, this.ground(x, y));
    // a dark line under the bank, and the coast's own soft edge
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (this.kind[i] === Kind.Sea) continue;
      if (this.toSea[i]! <= 1) c.scale(x, y, this.kind[i] === Kind.Bank ? 0.35 : 0.62);
    }
    this.pebbles(c);
    for (const m of world.landmarks ?? []) if (m.kind === 'helipad') this.helipad(c, m); else if (m.kind === 'terrace') this.terrace(c, m);
    this.paths(c);
    this.bushes(c);
    this.rocks(c);
    const standing = [
      ...world.buildings.map((b) => ({ y: b.y, draw: () => this.building(c, b) })),
      ...(world.landmarks ?? []).filter((m) => m.kind === 'mast' || m.kind === 'memorial').map((m) => ({ y: m.y, draw: () => (m.kind === 'mast' ? this.mast(c, m) : this.memorial(c, m)) })),
      ...(world.scenes ?? []).map((s) => ({ y: s.y, draw: () => (this.SCENE_MARKS[s.id] ?? this.SCENE_MARKS.knoll!)(c, s) })),
      { y: world.places.lighthouse.y, draw: () => this.lighthouse(c) },
    ];
    // from the north to the south: what stands nearer the viewer covers what stands behind it
    for (const s of standing.sort((a, b) => b.y - a.y)) s.draw();
    this.title(c, plan.title);
    this.compass(c, plan.compass);
    c.outline();
    return c;
  }

  /** Every pixel of a way through `pts`, in order: half a pixel a step, so a slanted line has no gaps. */
  private walk(pts: readonly Pt[], step: (x: number, y: number, walked: number) => void): void {
    let walked = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]!, b = pts[i]!;
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      for (let s = 0; s < length; s += 0.5) {
        walked += 0.5;
        step(Math.round(a.x + ((b.x - a.x) * s) / length), Math.round(a.y + ((b.y - a.y) * s) / length), walked);
      }
    }
  }

  /** Where a paved way lies in the picture: bushes keep off it, so no way is cut in two. */
  private readonly pavedAt = new Set<number>();

  /**
   * The paved ways: pale lines on the ground, two pixels wide. Only what is paved is drawn (the
   * rule: no unpaved tracks). The boat slip in the north is two rails on sleepers; the southern
   * dock is its own picture.
   */
  private paths(c: Canvas): void {
    const { view } = this.plan;
    const { w } = this;
    const colourOf = lit(PATH, this.hour.light);
    const rails = c.soft();
    const ends = this.pavementEnds().map((p) => view.toScreen(p));
    for (const path of this.world.paths) {
      if (path.kind === 'footpath') continue;
      const pts = path.points.map(([x, y]) => view.toScreen({ x, y }));
      // a way that starts under the warden's house as it is drawn starts at the nearer end of the pavement before
      // its face (the paths in front of the house and the crossroads were disconnected)
      const from = ends.map((e) => ({ e, far: Math.hypot(e.x - pts[0]!.x, e.y - pts[0]!.y) })).sort((p, q) => p.far - q.far)[0];
      if (path.kind === 'track' && from && from.far < HOUSE_REACH) pts[0] = from.e;
      if (path.id === 'slipway') { this.southDock(c, pts); continue; }
      if (path.kind === 'slipway') {
        this.walk(pts, (x, y, walked) => {
          const sleeper = Math.floor(walked) % 3 === 0;
          for (const dx of sleeper ? [-1, 0, 1, 2] : [0, 1]) c.put(x + dx, y, lit(RAIL[sleeper ? 0 : 1], this.hour.light), rails);
        });
        continue;
      }
      this.walk(pts, (x, y) => {
        const kind = this.kind[y * w + x];
        if (kind !== Kind.Grass && kind !== Kind.Stone) return;
        for (const dx of [0, 1]) { c.put(x + dx, y, colourOf); this.pavedAt.add(y * w + x + dx); }
      });
    }
  }

  /**
   * The southern dock, where most visitors land (the southern docks were missing and the road
   * leading there went straight into the water instead of the dock; then: most visitors arrive at the southern
   * docks, a wider stone dock, the pier much larger and heavier): the road runs down to the shore, and from the last land
   * under it a quay of big dressed stones goes on into the water: a low parapet along its west side throwing its shadow
   * on the deck, the shaded east face, a wider square head with its dark front face over the water, a red and white
   * beacon post on the head, and two small boats moored along its east side.
   */
  private southDock(c: Canvas, pts: readonly Pt[]): void {
    const { hour, w, h } = this;
    const thing = c.soft();
    const paint = (x: number, y: number, k: number): void => c.put(x, y, lit(tone(ROCK, k), hour.light), thing);
    const road = lit(PATH, hour.light);
    let last = { x: Math.round(pts[0]!.x), y: Math.round(pts[0]!.y) };
    this.walk(pts, (x, y) => {
      if (this.kind[y * w + x] === Kind.Sea) return;
      for (const dx of [0, 1]) { c.put(x + dx, y, road); this.pavedAt.add(y * w + x + dx); }
      last = { x, y };
    });
    const a = pts[pts.length - 2]!, b = pts[pts.length - 1]!;
    const slant = (b.x - a.x) / (b.y - a.y || 1);
    const mid = (y: number): number => Math.round(last.x + slant * (y - last.y));
    const ripple = mix(hour.sea[3], hour.sea[1], 0.3);
    const foam = (x: number, y: number): void => { if (this.kind[y * w + x] === Kind.Sea && c.thing[y * w + x] === 0) c.put(x, y, ripple, thing); };
    // the rows: the quay from just above the last land, its head the last HEAD rows, then the head's front face
    const HEAD = 9, FACE = 3;
    const top = last.y - 3, end = Math.min(last.y + PIER_LONG, h - FACE - 4), headTop = end - HEAD + 1;
    // a block's tone on the deck: its own shade of the lit stone, its upper left corner catching the light
    const deck = (x: number, y: number, x0: number): void => {
      const row = y - top, course = Math.floor(row / 4), across = x - x0;
      if (row % 4 === 3) { paint(x, y, 5); return; }
      const joints = course % 2 === 0 ? [3, 8, 13] : [1, 6, 11, 16];
      if (joints.includes(across)) { paint(x, y, 5); return; }
      const block = joints.filter((j) => j < across).length;
      const shade = hash2(course, block, 61) > 0.6 ? 6 : 7;
      paint(x, y, row % 4 === 0 && (across === 0 || joints.includes(across - 1)) ? 8 : shade);
    };
    // the body: west edge, parapet, its shadow, the deck, the shaded east face and its edge
    for (let y = top; y < headTop; y++) {
      const x = mid(y);
      paint(x - 5, y, 1);
      paint(x - 4, y, (y - top) % 5 === 4 ? 6 : 8);
      paint(x - 3, y, 4);
      for (let dx = -2; dx <= 4; dx++) deck(x + dx, y, x - 2);
      paint(x + 5, y, 3);
      paint(x + 6, y, 1);
      if (hash2(y, 0, 63) > 0.6) foam(x + 7, y);
      if (hash2(y, 1, 63) > 0.7) foam(x - 6, y);
    }
    // the head: wider and square, the parapet turning along its back and down its west side
    for (let y = headTop; y <= end; y++) {
      const x = mid(y), first = y === headTop;
      paint(x - 10, y, 1);
      paint(x - 9, y, (y - headTop) % 5 === 4 ? 6 : 8);
      for (let dx = -8; dx <= 9; dx++) {
        if (first && dx <= -4) paint(x + dx, y, 8);
        else if (y === headTop + 1 && dx <= -4) paint(x + dx, y, 4);
        else if (dx === -8) paint(x + dx, y, 4);
        else deck(x + dx, y, x - 7);
      }
      paint(x + 10, y, 3);
      paint(x + 11, y, 1);
      if (hash2(y, 2, 63) > 0.5) foam(x + 12, y);
      if (hash2(y, 3, 63) > 0.5) foam(x - 11, y);
    }
    // the parapet's back where the body meets the head
    for (let dx = -10; dx <= -4; dx++) paint(mid(headTop - 1) + dx, headTop - 1, 1);
    // the head's front: the lit lip, the dark face in big blocks, the water at its foot
    for (let dx = -10; dx <= 11; dx++) {
      const x = mid(end) + dx;
      for (let r = 1; r <= FACE; r++) paint(x, end + r, (dx + (r === 2 ? 3 : 0) + 30) % 6 === 0 ? 1 : dx > 9 ? 2 : 3);
      paint(x, end + FACE + 1, 1);
      if (hash2(dx, 4, 63) > 0.35) foam(x, end + FACE + 2);
    }
    // the beacon on the head's seaward east corner: a post in red and white bands, lit on the left, its light red at night
    const bx = mid(end) + 7, by = end - 2;
    const bands = [IRON[1], LIME[1], IRON[1], LIME[1], IRON[1]];
    bands.forEach((band, k) => {
      const dark = band === IRON[1] ? IRON[0] : tone(ROCK, 5);
      c.put(bx, by - k, lit(band, hour.light), thing);
      c.put(bx + 1, by - k, lit(dark, hour.light), thing);
    });
    c.put(bx, by + 1, lit(tone(ROCK, 1), hour.light), thing);
    c.put(bx + 1, by + 1, lit(tone(ROCK, 1), hour.light), thing);
    c.put(bx, by - bands.length, hour.lit ? IRON[2] : lit(IRON[0], hour.light), thing);
    c.put(bx + 1, by - bands.length, hour.lit ? IRON[2] : lit(IRON[0], hour.light), thing);
    // two boats moored along the east side, bow to the land, each with its own dark line: a white one and a red one
    const BOAT = [
      '..k..',
      '.khk.',
      'khirk',
      'khirk',
      'khtrk',
      'khirk',
      'khhrk',
      '.kkk.',
    ];
    const boat = (x: number, y: number, hull: readonly [Colour, Colour]): void => {
      const of: Record<string, Colour> = { k: tone(ROCK, 1), h: hull[0], r: hull[1], i: RAIL[1], t: PARCHMENT[1] };
      BOAT.forEach((line, r) => [...line].forEach((ch, dx) => { if (ch !== '.') c.put(x + dx, y + r, lit(of[ch]!, hour.light), thing); }));
      foam(x + 5, y + 4); foam(x + 1, y + BOAT.length); foam(x + 3, y + BOAT.length);
    };
    boat(mid(top + 7) + 8, top + 7, [LIME[1], tone(ROCK, 5)]);
    boat(mid(top + 17) + 8, top + 17, [IRON[1], IRON[0]]);
  }

  /** The shadow a standing thing throws: its foot's outline pushed away from the light by its height. */
  private shadow(c: Canvas, foot: readonly Pt[], metres: number): void {
    const { hour } = this;
    const far = metres * LANDMARK * this.plan.view.scale * hour.reach;
    const dx = -hour.to[0] * far, dy = -hour.to[1] * far * this.plan.view.tilt;
    const seen = new Set<number>();
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy)));
    for (let s = 0; s <= steps; s++) {
      const moved = foot.map((p) => ({ x: p.x + (dx * s) / steps, y: p.y + (dy * s) / steps }));
      fill(moved, this.w, this.h, (x, y) => {
        const i = y * this.w + x;
        if (seen.has(i) || this.kind[i] === Kind.Sea) return;
        seen.add(i);
        c.scale(x, y, 1 - hour.shade);
      });
    }
  }

  /**
   * A clump of bushes: a heap of round lumps, each dark below and lit in two flat tones on the hour's side, with a
   * short shadow on the ground. `bloom` scatters flowers of that colour over its lit side.
   */
  private clump(c: Canvas, thing: number, cx: number, cy: number, r: number, seed: number, bloom?: Colour): void {
    const { w, h, hour } = this;
    const [lx, ly] = hour.to;
    const n = r > 5 ? 4 : r > 3 ? 3 : 2;
    const lumps = Array.from({ length: n }, (_, k) => ({ x: cx + ((k + 0.5) / n - 0.5) * r * 2.2 + (hash2(seed, k, 81) - 0.5) * r * 0.5, y: cy - hash2(seed, k, 82) * r * 0.5, r: r * (0.55 + 0.35 * hash2(seed, k, 83)) }));
    for (let y = Math.floor(cy - r * 1.8); y <= cy + r; y++) for (let x = Math.floor(cx - r * 2.6); x <= cx + r * 2.6; x++) {
      if (x < 0 || y < 0 || x >= w || y >= h || this.kind[y * w + x] === Kind.Sea) continue;
      let best = -1, at = lumps[0]!;
      for (const l of lumps) { const v = lump(x, y, l.x, l.y, l.r, l.r * 0.72, seed); if (v > best) { best = v; at = l; } }
      if (best < 0) {
        // the shadow, away from the light
        if (c.thing[y * w + x] === 0 && lumps.some((l) => lump(x + lx * 2.5, y + ly * 1.5 - 1, l.x, l.y, l.r, l.r * 0.72, seed) >= 0)) c.scale(x, y, 0.6);
        continue;
      }
      const t = ((x - at.x) * lx + (y - at.y) * ly * 1.5) / at.r + (hash2(x >> 1, y, 86) - 0.5) * 0.3;
      let colourOf = t > 0.42 ? BUSH[3] : t > 0 ? BUSH[2] : t > -0.5 ? BUSH[1] : BUSH[0];
      if (best < 0.14 && y > at.y) colourOf = BUSH[0];
      if (bloom && t > -0.2 && hash2(x, y, seed + 87) > 0.9) colourOf = bloom;
      c.put(x, y, lit(colourOf, hour.light), thing);
    }
  }

  /** Whether a paved way crosses a box of the picture. */
  private pavedIn(x0: number, y0: number, x1: number, y1: number): boolean {
    for (let y = Math.floor(y0); y <= y1; y++) for (let x = Math.floor(x0); x <= x1; x++) if (this.pavedAt.has(y * this.w + x)) return true;
    return false;
  }

  /**
   * Bushes on the meadow: few and large, in clumps where the ground holds them; and the wild dog rose between the
   * crossroads and the lighthouse, at least 3 m high and thick, by eye about (-45, 25).
   */
  private bushes(c: Canvas): void {
    const { w, h } = this;
    const thing = c.soft();
    // the small places a bush would hide: the well and the memorial
    const open = [...this.world.buildings.filter((b) => b.id === 'hut-west').map((b) => ({ ...this.plan.view.toScreen(b), r: 9 })), ...(this.world.landmarks ?? []).filter((m) => m.kind === 'memorial').map((m) => ({ ...this.plan.view.toScreen(m), r: 15 }))];
    for (let gy = 0; gy < h; gy += 13) for (let gx = 0; gx < w; gx += 17) {
      const x = gx + Math.floor(hash2(gx, gy, 81) * 17), y = gy + Math.floor(hash2(gx, gy, 82) * 13);
      if (x < 12 || y < 12 || x >= w - 12 || y >= h - 12) continue;
      if (this.kind[y * w + x] !== Kind.Grass || this.toStone[y * w + x]! < 7) continue;
      if (fbm(x / 60, y / 36, 2, 83) < 0.52 || hash2(gx, gy, 84) < 0.45) continue;
      const r = 3 + hash2(gx, gy, 85) * 3.2;
      if (this.pavedIn(x - r * 2.6 - 1, y - r * 1.8 - 1, x + r * 2.6 + 1, y + r + 1) || open.some((o) => Math.hypot(x - o.x, y - 4 - o.y) < o.r + r * 2)) continue;
      this.clump(c, thing, x, y, r, gx * 7 + gy);
    }
    const rose = this.plan.at({ x: -45, y: 25 });
    this.clump(c, thing, Math.round(rose.x) - 6, Math.round(rose.y) + 1, 6, 901, colour(0xf08060));
    this.clump(c, thing, Math.round(rose.x) + 7, Math.round(rose.y) - 1, 7.5, 902, colour(0xf08060));
  }

  /**
   * A sea rock or a boulder, far larger than to scale: a heap of round lumps lit in flat bands
   * with a hard shade side and a dark seam where two lumps meet, as the kit's boulder of the scenes is
   * (`kit/stones.ts`); in the water a pale ring of ripples round its foot and a broken darker one further out.
   */
  private rock(c: Canvas, thing: number, cx: number, foot: number, wide: number, high: number, seed: number, flat = false): void {
    const { w, h } = this;
    const inWater = this.kind[Math.min(h - 1, foot) * w + cx] === Kind.Sea;
    if (inWater) this.ripples(c, thing, cx, foot, wide, seed);
    // no two rocks alike: its stone darker or paler, weed on some tops, and its build one of several
    const look = { tint: (hash2(seed, 7, 243) - 0.5) * 1.8, weed: hash2(seed, 8, 244) > 0.78, inWater, flat };
    const build = flat ? 0 : wide > 18 ? 4 : wide > 9 ? 3 : Math.floor(hash2(seed, 9, 245) * 3);
    // each part: how far to the side (in widths), how many rows nearer the viewer, its width and its height (in the rock's)
    const builds: readonly (readonly (readonly [number, number, number, number])[])[] = [
      [[0, 0, 1, 1]],
      [[0, 0, 0.62, 1.7], [0.8, 1, 0.4, 0.45]],
      [[0, 0, 1.3, 0.42], [-0.5, -1, 0.5, 0.7]],
      [[-0.8, -2, 0.55, 0.62], [0.75, -1, 0.5, 0.8], [0, 0, 0.75, 1], [-1.15, 2, 0.3, 0.25]],
      [[-0.78, -3, 0.5, 0.6], [0.7, -2, 0.48, 0.78], [-0.2, 0, 0.6, 1], [0.34, 2, 0.42, 0.52], [-1.2, 3, 0.24, 0.2], [1.22, 4, 0.2, 0.16], [0.9, 6, 0.14, 0.1]],
    ];
    builds[build]!.forEach(([side, near, part, tall], n) => this.slab(c, thing, Math.round(cx + side * wide), foot + near, wide * part, high * tall, seed * 7 + n, look));
  }

  /**
   * One slab of stone as the 1991 game's shores have them (the marks on its beach): no round lump
   * but a wedge that leans, its top a pale slanted plane, its faces two flat darker tones on either side of an edge
   * that runs down from the peak. Its foot is ragged and rises at both ends, dark and wet where it meets the water;
   * a `flat` slab has a level top that something can stand on.
   */
  private slab(c: Canvas, thing: number, cx: number, foot: number, wide: number, high: number, seed: number, look: { tint: number; weed: boolean; inWater: boolean; flat: boolean }): void {
    const { hour } = this;
    const lean = hash2(seed, 1, 251) > 0.5 ? 1 : -1, light = hour.to[0] < 0 ? -1 : 1;
    const peak = { x: cx + lean * wide * (look.flat ? 0.6 : 0.25 + 0.4 * hash2(seed, 2, 252)), y: foot - high };
    const low = { x: cx - lean * wide * (look.flat ? 0.7 : 0.85 + 0.2 * hash2(seed, 3, 253)), y: foot - high * (look.flat ? 0.96 : 0.3 + 0.3 * hash2(seed, 4, 254)) };
    const steep = { x: cx + lean * wide * (0.95 + 0.15 * hash2(seed, 5, 255)), y: foot - high * (0.35 + 0.25 * hash2(seed, 6, 256)) };
    // the foot from the steep side back to the low one: a broken line that lifts at its ends
    const under: Pt[] = [];
    const steps = Math.max(2, Math.round(wide / 1.5));
    for (let n = 0; n <= steps; n++) {
      const u = 1 - (2 * n) / steps;
      under.push({ x: cx + lean * wide * u * 0.95, y: foot - Math.abs(u) ** 3 * Math.min(2.5, high * 0.3) - (n % 2) * hash2(seed, n, 257) * 1.4 });
    }
    /** The row of the slab's top edge over a column. */
    const top = (x: number): number => {
      const [a, b] = (x - peak.x) * lean < 0 ? [low, peak] : [peak, steep];
      const t = Math.abs(b.x - a.x) < 0.01 ? 0 : clamp01((x - a.x) / (b.x - a.x));
      return a.y + (b.y - a.y) * t;
    };
    // a level top shows more of itself: there is room on it to stand
    const plane = Math.max(1.5, high * (look.flat ? 0.5 : 0.24));
    fill([low, peak, steep, ...under], this.w, this.h, (x, y) => {
      const below = y - top(x), edge = peak.x - lean * wide * 0.15 + (y - peak.y) * lean * 0.18;
      const onTop = below < plane;
      let k: number;
      if (look.inWater && foot - y < 1 + hash2(x, seed, 258) * 1.6) k = 1;
      else if (onTop) k = ((x - peak.x) * lean < 0 ? (below < 1 ? 8 : 6) : 4.4) + look.tint;
      else if (Math.abs(x - edge) < 0.7) k = 1.2;
      else k = ((x - edge) * light > 0 ? 3.6 : 2) + (look.flat ? 1 : look.tint * 0.6);
      const stone = onTop && look.weed && k > 1 && hash2(x >> 1, y, seed) > 0.3 ? tone(GRASS, below < 1 ? 6 : 4) : tone(ROCK, Math.max(0.6, k));
      // the moon lays a pale light on a rock's top, as on the rocks of the 1991 night map
      c.put(x, y, lit(stone, hour.light, hour.light[0] < 0.5 && k >= 6 ? 1.6 : 1), thing);
    });
  }

  /**
   * Round a rock's foot in the water, as on the 1991 maps: no ring but a few short arcs of unlike length at unlike
   * distances, pale near the stone and darker further out, most of them before it; and its dark broken reflection.
   */
  private ripples(c: Canvas, thing: number, cx: number, foot: number, wide: number, seed: number): void {
    const { w, h } = this;
    const [deep, mid, , foam] = this.hour.sea;
    const free = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h && this.kind[y * w + x] === Kind.Sea && c.thing[y * w + x] === 0;
    for (let x = Math.round(cx - wide); x <= cx + wide; x++) for (const dy of [1, 2]) {
      if (hash2(x >> 1, dy, seed + 259) > 0.62 - dy * 0.14 && free(x, foot + dy)) c.put(x, foot + dy, mix(deep, mid, 0.3), thing);
    }
    const arcs = 3 + Math.floor(hash2(seed, 1, 260) * 4);
    for (let n = 0; n < arcs; n++) {
      const reach = 1.15 + 1.25 * hash2(seed, n, 261), long = 24 + 80 * hash2(seed, n, 262);
      // most arcs lie before the rock (90 degrees is toward the viewer)
      const from = 90 + (hash2(seed, n, 263) - 0.5) * (n % 3 === 0 ? 330 : 170) - long / 2;
      const pale = reach < 1.7 ? hash2(seed, n, 264) > 0.25 : hash2(seed, n, 264) > 0.7;
      for (let a = from; a < from + long; a += 1.5) {
        const r = wide * reach * (1 + 0.07 * Math.sin(a / 14 + seed));
        const x = Math.round(cx + Math.cos((a * Math.PI) / 180) * r), y = Math.round(foot + 1 + Math.sin((a * Math.PI) / 180) * r * 0.36);
        if (free(x, y)) c.put(x, y, pale ? mix(foam, mid, 0.3) : lit(mid, [1, 1, 1], 0.84), thing);
      }
    }
  }

  /**
   * One absurdly big stack of rock, as the 1991 map has off its north-west shore: out in the sea off the island's
   * western third.
   */
  private giantRock(put: (x: number, y: number, wide: number, high: number, seed: number) => void, free: (x: number, y: number, r: number) => boolean, placed: readonly { x: number; y: number; r: number }[]): void {
    const { w, plan } = this;
    for (let k = 0; k < 400; k++) {
      const x = Math.round(plan.island.x + plan.island.w * (0.02 + 0.3 * hash2(k, 1, 207))), y = Math.round(plan.middle.y + 30 + hash2(k, 2, 208) * 170);
      const d = this.toLand[y * w + x]!;
      if (this.kind[y * w + x] !== Kind.Sea || d < 40 || d > 78 || !free(x, y, 30)) continue;
      if (placed.some((q) => Math.hypot(q.x - x, q.y - y) < q.r + 36)) continue;
      put(x, y, 29, 36, 500 + k);
      return;
    }
  }

  /**
   * Rocks in the sea round the island, as round the real one, a dozen and large, none where the name, the compass, the
   * jetty or a slipway lies; the bundle of big boulders off the southern shore in the west that the reference marks
   * (cell E5); and boulders on the shingle by the water.
   */
  private rocks(c: Canvas): void {
    const { w, h, plan } = this;
    const thing = c.soft();
    const keepOut: { x: number; y: number; r: number }[] = [
      ...(this.world.scenes ?? []).filter((s) => s.id === 'docks').map((s) => ({ ...plan.view.toScreen(s), r: 64 })),
      ...this.world.paths.filter((p) => p.kind === 'slipway').map((p) => ({ ...plan.view.toScreen({ x: p.points[p.points.length - 1]![0], y: p.points[p.points.length - 1]![1] }), r: 34 })),
      { ...this.lamp(), r: 30 },
    ];
    const boxes = [plan.title, plan.compass];
    const free = (x: number, y: number, r: number): boolean => keepOut.every((k) => Math.hypot(k.x - x, k.y - y) > k.r + r) && boxes.every((b) => x + r < b.x - 6 || x - r > b.x + b.w + 6 || y < b.y - 6 || y - r * 2 > b.y + b.h + 6);
    const placed: { x: number; y: number; r: number }[] = [];
    const put = (x: number, y: number, wide: number, high: number, seed: number): void => {
      this.rock(c, thing, x, y, wide, high, seed);
      placed.push({ x, y, r: wide });
    };
    // the bundle of big boulders: three, close together
    const bundle = plan.at({ x: -250, y: 100 });
    let by = Math.round(bundle.y);
    const bx = Math.round(bundle.x);
    while (by < h - 30 && (this.kind[by * w + bx] !== Kind.Sea || this.toLand[by * w + bx]! < 12)) by++;
    put(bx - 12, by + 4, 9, 10, 411);
    put(bx + 5, by, 12, 15, 412);
    put(bx + 21, by + 7, 7, 7, 413);
    this.giantRock(put, free, placed);
    // the sea is not evenly rocky (the orthophoto, and the reference marks): the north-west end is thick with
    // boulders all round, the north shore has a fair number, the south and the east few. They lie in clumps, big and
    // small together, some out of the shallows right by the shore
    for (let k = 0; k < 2600 && placed.length < 34; k++) {
      const x = Math.round(plan.middle.x + 14 + hash2(k, 1, 201) * (plan.middle.w - 28)), y = Math.round(plan.middle.y + 20 + hash2(k, 2, 202) * (plan.middle.h - 30));
      if (this.kind[y * w + x] !== Kind.Sea) continue;
      const p = plan.view.toWorld(x, y), side = this.side;
      const along = (p.x - side.x) * side.ux + (p.y - side.y) * side.uy, across = -(p.x - side.x) * side.uy + (p.y - side.y) * side.ux;
      const west = along < -75, north = !west && across > 0;
      if (hash2(k, 5, 205) > (west ? 1 : north ? 0.34 : 0.1)) continue;
      const big = hash2(k, 3, 203);
      const wide = big > 0.8 ? 10 + 5 * hash2(k, 6, 206) : 4.5 + 5 * big, high = wide * (0.8 + 0.6 * hash2(k, 4, 204));
      const d = this.toLand[y * w + x]!;
      if (d < wide * 0.7 + 4 || d > (west ? 46 : 34) + wide || !free(x, y, wide)) continue;
      if (placed.some((q) => Math.hypot(q.x - x, (q.y - y) * 1.6) < (q.r + wide) * (west ? 1.05 : 1.9))) continue;
      put(x, y, wide, high, 300 + k);
    }
    // on the shingle by the water: smaller, where the shore has a point
    for (let gy = 0; gy < h; gy += 9) for (let gx = 0; gx < w; gx += 11) {
      const x = gx + Math.floor(hash2(gx, gy, 91) * 11), y = gy + Math.floor(hash2(gx, gy, 92) * 9);
      if (x < 8 || y < 8 || x >= w - 8 || y >= h - 8 || this.kind[y * w + x] !== Kind.Stone) continue;
      if (this.toSea[y * w + x]! > 9 || this.toSea[y * w + x]! < 3 || fbm(x / 34, y / 22, 2, 95) < 0.5 || hash2(gx, gy, 93) < 0.55) continue;
      this.rock(c, thing, x, y, 2.5 + hash2(gx, gy, 94) * 2.5, 2.5 + hash2(gx, gy, 96) * 2.5, gx * 3 + gy);
    }
  }

  /** How each scene's place is painted on the map (ft_1_19.AC2), by the scene's id; a scene without its own mark gets the knoll's fire place. */
  private readonly SCENE_MARKS: Record<string, (c: Canvas, at: WorldPoint) => void> = {
    knoll: (c, at) => this.firePlace(c, at),
    docks: (c, at) => this.jettyPlace(c, at),
    crossroads: (c, at) => this.crossroadsMark(c, at),
    // the harbour's mark is its stone quay itself (`southDock`): nothing more is laid over it
    port: () => undefined,
    // the terrace is on the map already, a landmark before the house (`terrace`): nothing more is laid over it
    terrace: () => undefined,
    // the square is the ground between the houses the map already draws at the lighthouse: nothing more is laid over it
    square: () => undefined,
  };

  /**
   * The docks' place on the map (ft_1_19.AC2), far larger than to scale: the big rock off the north shore with two
   * small ones at its foot; the walk on dark legs that goes on from the boat slip's end out to a landing at the rock's
   * left foot; and sitting on the rock, without legs, the thatched lookout picked for the docks.
   * Where pass 2 had them (of pass 3: the dockhouse had moved east and some extra stuff had been added).
   */
  private jettyPlace(c: Canvas, at: WorldPoint): void {
    const { hour, w, h } = this;
    const { view } = this.plan;
    const thing = c.soft();
    const p = view.toScreen(at);
    const px = Math.round(p.x);
    // where the walk leaves the shingle: straight toward the viewer from the place
    let shore = Math.round(p.y);
    while (shore < h - 2 && this.kind[shore * w + px] === Kind.Sea) shore++;
    // the rock stands off the shore, north of where the walk leaves it
    const bx = px + 7, by = Math.min(Math.round(p.y) + 2, shore - 16);
    const boards = (way: readonly (readonly [number, number])[], wide: number): void => {
      for (let n = 1; n < way.length; n++) {
        const a = way[n - 1]!, b = way[n]!, long = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])));
        for (let k = 0; k <= long; k++) {
          const x = Math.round(a[0] + ((b[0] - a[0]) * k) / long), y = Math.round(a[1] + ((b[1] - a[1]) * k) / long);
          // a leg and its foot in the water every few boards
          if (k % 4 === 0 && b[1] === a[1] && y + 3 < h && this.kind[(y + 3) * w + x] === Kind.Sea) { c.put(x, y + 2, lit(BANK[0], hour.light), thing); c.put(x, y + 3, lit(BANK[0], hour.light), thing); c.put(x + 1, y + 4, mix(hour.sea[3], hour.sea[1], 0.3), thing); }
          // pale planks laid across the walk, a seam between every few; a walk that runs away from the viewer shows
          // its dark side along one edge, one that runs across shows it under its front
          const away = Math.abs(b[1] - a[1]) > Math.abs(b[0] - a[0]);
          for (let dx = 0; dx < wide; dx++) c.put(x + dx, y, lit(k % 4 === 3 ? RAIL[1] : PARCHMENT[1], hour.light), thing);
          if (away) c.put(x + wide, y, lit(RAIL[0], hour.light), thing);
          else for (let dx = 0; dx < wide; dx++) c.put(x + dx, y + 1, lit(RAIL[0], hour.light), thing);
        }
      }
    };
    // the walk: out from the shingle to the rock's left foot, where its landing lies
    boards([[px - 3, shore + 1], [px - 5, shore - 7], [bx - 15, by - 1]], 3);
    for (let row = 0; row < 4; row++) boards([[bx - 23, by - 3 + row], [bx - 12, by - 3 + row]], 1);
    // no flat-footed stone dropped in the sea: a low slab with an uneven foot, two small ones by it
    this.rock(c, thing, bx + 14, by - 4, 5, 4.5, 772);
    this.rock(c, thing, bx, by, 15, 10, 777, true);
    this.rock(c, thing, bx + 11, by + 3, 4.5, 3.5, 773);
    // the lookout sits on the rock's top: a floor, three posts with a rail, a thatch with a tuft on its top
    const tx = bx, ty = by - 4;
    const line = (x0: number, y0: number, x1: number, y1: number, colourOf: Colour): void => {
      const long = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
      for (let k = 0; k <= long; k++) c.put(Math.round(x0 + ((x1 - x0) * k) / long), Math.round(y0 + ((y1 - y0) * k) / long), colourOf, thing);
    };
    const dark = lit(RAIL[0], hour.light), wood = lit(RAIL[1], hour.light);
    for (let dx = -6; dx <= 6; dx++) { c.put(tx + dx, ty - 6, lit(PARCHMENT[1], hour.light), thing); c.put(tx + dx, ty - 5, dark, thing); }
    for (const s of [-5, 0, 5]) line(tx + s, ty - 6, tx + s, ty - 12, wood);
    for (let dx = -5; dx <= 5; dx++) c.put(tx + dx, ty - 9, wood, thing);
    const eaves = ty - 12, top = ty - 20;
    for (let y = top; y <= eaves; y++) {
      const half = Math.round(((y - top) / (eaves - top)) * 8 + 1 + (y === eaves ? 1 : 0));
      for (let dx = -half; dx <= half; dx++) {
        const lightSide = dx * hour.to[0] > 0 || Math.abs(dx) < 2;
        // the straw in two flat tones, a dark line under the eaves
        c.put(tx + dx, y, y === eaves ? lit(tone(EARTH, 0), hour.light) : lit(lightSide ? ((dx + y) % 3 === 0 ? DRIED[2] : DRIED[3]) : tone(EARTH, (dx + y) % 3 === 0 ? 1 : 2), hour.light), thing);
      }
    }
    c.put(tx, top - 1, dark, thing); c.put(tx + 1, top - 2, dark, thing);
  }

  /**
   * The crossroads' place on the map (ft_1_19.AC2): the path's fork drawn wider as pale slabs, a tuft of rust grass in
   * each of its three angles, so the Y reads at the size of a button.
   */
  private crossroadsMark(c: Canvas, at: WorldPoint): void {
    const { view } = this.plan;
    const fork = view.toScreen(at);
    const thing = c.soft();
    const arms = (this.world.paths ?? []).filter((p) => p.id === 'track-to-lighthouse' || p.id === 'track-to-north-house');
    // each arm out of the fork for a few metres, and the stem back toward the warden's house
    for (const path of arms) for (let i = 1; i < path.points.length; i++) {
      const a = view.toScreen({ x: path.points[i - 1]![0], y: path.points[i - 1]![1] }), b = view.toScreen({ x: path.points[i]![0], y: path.points[i]![1] });
      const long = Math.hypot(b.x - a.x, b.y - a.y);
      for (let s = 0; s <= long; s += 0.4) {
        const x = a.x + ((b.x - a.x) * s) / long, y = a.y + ((b.y - a.y) * s) / long;
        if (Math.hypot(x - fork.x, y - fork.y) > 15) continue;
        const joint = Math.floor(s * 1.4) % 3 === 0;
        // a dark edge under each slab, so the pale Y reads on the green
        for (const [dx, dy] of [[-1, 2], [0, 2], [1, 2], [2, 2]] as const) c.put(Math.round(x) + dx, Math.round(y) + dy, lit(BANK[1], this.hour.light), thing);
        for (const [dx, dy] of [[-1, 0], [0, 0], [1, 0], [0, 1], [1, 1], [-1, 1]] as const) c.put(Math.round(x) + dx, Math.round(y) + dy, lit(joint ? STONE[1] : STONE[3], this.hour.light), thing);
      }
    }
    for (const [dx, dy] of [[-5, -5], [5, -6], [0, 6]] as const) for (const [tx, ty] of [[0, 0], [0, -1], [1, -1], [-1, 0], [0, -2], [1, 0]] as const) c.put(Math.round(fork.x) + dx + tx, Math.round(fork.y) + dy + ty, lit(ty < 0 ? DRY[1] : DRY[0], this.hour.light), thing);
  }

  /**
   * A scene's place on the map (ft_1_19.AC2): a ring of stones on trodden ground with embers in it, and a thin thread of
   * smoke that the wind bends to the east. The embers glow by their own light at every hour.
   */
  private firePlace(c: Canvas, at: WorldPoint): void {
    const { hour } = this;
    const foot = this.plan.view.toScreen(at);
    const x = Math.round(foot.x), y = Math.round(foot.y);
    const thing = c.soft();
    // the knoll: a rise with a level top (a plateau, as the reference photographs show it), never a round ball:
    // its rim runs in and out, its top is lit in flat tones from the hour's side, and on the near side it drops
    const RX = 21, RY = 9, DROP = 4;
    const onTop = (px: number, py: number): boolean => {
      const angle = Math.atan2(py - y, px - x);
      const rim = 1 + 0.26 * Math.sin(angle * 2 + 0.8) + 0.15 * Math.sin(angle * 5 + 2) + 0.14 * (noise2(px / 7, py / 5, 97) - 0.5);
      return Math.hypot((px - x) / RX, (py - y) / RY) < rim && this.kind[py * this.w + px] === Kind.Grass;
    };
    for (let py = y - RY * 2; py <= y + RY * 2 + DROP; py++) for (let px = x - RX * 2; px <= x + RX * 2; px++) {
      if (px < 1 || py < DROP + 1 || px >= this.w - 1 || py >= this.h - 1) continue;
      if (!onTop(px, py)) {
        for (let d = 1; d <= DROP; d++) if (onTop(px, py - d) && this.kind[py * this.w + px] !== Kind.Sea) { c.put(px, py, lit(hash2(px >> 2, 0, 9) > 0.5 ? tone(EARTH, 3 - d) : tone(ROCK, 5 - d), hour.light), thing); break; }
        continue;
      }
      const toward = ((px - x) / RX) * hour.to[0] + ((py - y) / RY) * hour.to[1] * 0.7 + 0.4 * (noise2(px / 10, py / 4, 96) - 0.5);
      let k = toward > 0.55 ? 6 : toward > 0.1 ? 5 : toward > -0.4 ? 4 : 3;
      if (!onTop(px, py - 1) || !onTop(px + Math.sign(hour.to[0]), py)) k = 7;
      c.put(px, py, lit(tone(GRASS, k), hour.light), thing);
    }
    // at night the fire lights the ground round it: three flat rings of warm earth, the nearest the brightest
    if (hour.light[0] < 0.5) for (let py = y - RY - 2; py <= y + RY + 2; py++) for (let px = x - RX; px <= x + RX; px++) {
      if (px < 0 || py < 0 || px >= this.w || py >= this.h || !onTop(px, py)) continue;
      const far = Math.hypot((px - x) / 17, (py - y) / 7.5) + 0.2 * (noise2(px / 5, py / 4, 99) - 0.5);
      if (far < 1) c.put(px, py, tone(EARTH, far < 0.4 ? 4 : far < 0.72 ? 2 : 1), thing);
    }
    this.knollTree(c, thing, x - RX - 1, y + 1);
    this.fireRing(c, thing, x, y);
  }

  /**
   * The tree that hangs over the knoll from its left: a big low tree with a twisted trunk. No such tree stands on
   * Keri; it stands on the knoll's picture and on the map (the list of departures).
   */
  private knollTree(c: Canvas, thing: number, x: number, y: number): void {
    const { hour } = this;
    // the trunk: it twists as it rises and leans in over the plateau
    let tx = x;
    for (let k = 0; k <= 12; k++) {
      tx = x + Math.round(1.6 * Math.sin(k / 2.2) + (k > 5 ? (k - 5) * 0.9 : 0));
      c.put(tx, y - k, lit(RAIL[0], hour.light), thing);
      c.put(tx + 1, y - k, lit(k % 4 === 1 ? RAIL[0] : RAIL[1], hour.light), thing);
      if (k < 3) c.put(tx - 1, y - k, lit(RAIL[0], hour.light), thing);
    }
    // a bough out over the fire, and the crown in three heaps, the largest over the knoll
    for (let k = 0; k < 7; k++) c.put(tx + k, y - 12 + Math.round(k / 3), lit(RAIL[0], hour.light), thing);
    this.clump(c, thing, tx - 5, y - 15, 5, 931);
    this.clump(c, thing, tx + 3, y - 19, 6.5, 932);
    this.clump(c, thing, tx + 11, y - 14, 5.5, 933);
  }

  /** The fire itself on its knoll: a ring of pale stones with embers in it and a thread of smoke. */
  private fireRing(c: Canvas, thing: number, x: number, y: number): void {
    const { hour } = this;
    // a dark bed, so that the ring reads on any ground, and the ring of pale stones lit from the hour's side
    for (let dy = -3; dy <= 3; dy++) for (let dx = -7; dx <= 7; dx++) if ((dx * dx) / 49 + (dy * dy) / 9 <= 1) c.put(x + dx, y + dy, lit(BANK[0], hour.light), thing);
    const ring: readonly (readonly [number, number])[] = [[-6, 0], [-5, -1], [-4, -2], [-2, -2], [0, -3], [2, -2], [4, -2], [5, -1], [6, 0], [5, 1], [4, 2], [2, 2], [0, 2], [-2, 2], [-4, 2], [-5, 1]];
    for (const [dx, dy] of ring) {
      const stone = lit(dx * hour.to[0] + dy * hour.to[1] > 0 ? STONE[1] : STONE[3], hour.light);
      c.put(x + dx, y + dy, stone, thing);
      if (dy !== 0) c.put(x + dx + (dx < 0 ? 1 : -1), y + dy, stone, thing);
    }
    // the embers glow by their own light at every hour
    for (const [dx, dy, heart] of [[-2, 0, 0], [-1, 0, 1], [0, 0, 1], [1, 0, 1], [2, 0, 0], [0, -1, 0], [1, -1, 1], [-1, 1, 0], [1, 1, 0]] as const) c.put(x + dx, y + dy, EMBER[heart ? 2 : 1], thing);
    // the smoke: small pale puffs that grow and break up as they rise, bent to the east by the wind
    const pale = hour.light[0] < 0.5 ? 1.7 : 1;
    for (let k = 0; k < 5; k++) {
      const cx = x + k * 1.7 + Math.sin(k * 0.9) * 1.6, cy = y - 5 - k * 3.2;
      const size = 0.8 + k * 0.22;
      for (let dy = -Math.ceil(size); dy <= Math.ceil(size); dy++) for (let dx = -Math.ceil(size); dx <= Math.ceil(size); dx++) {
        if (dx * dx + dy * dy > size * size + 0.4) continue;
        const px = Math.round(cx + dx), py = Math.round(cy + dy);
        if (hash2(px, py, 62) < (k - 1) / 6) continue;
        c.put(px, py, lit(dy > 0 || dx < 0 ? STONE[2] : STONE[3], hour.light, pale), thing);
      }
    }
  }

  /** The lattice mast: a thin banded line with two stays. */
  private mast(c: Canvas, at: WorldPoint): void {
    const { view } = this.plan;
    const { hour } = this;
    const foot = view.toScreen(at);
    const tall = Math.round(MAST_METRES * MAST_SCALE * view.scale * Math.sqrt(1 - view.tilt * view.tilt));
    const thing = c.soft();
    const x = Math.round(foot.x), y = Math.round(foot.y);
    const rust = [lit(RAIL[0], hour.light), lit(RAIL[1], hour.light), lit(PARCHMENT[1], hour.light)] as const;
    // the stays, dotted, from two thirds up down to the ground on both sides
    for (const side of [-1, 1]) for (let k = 0; k < tall * 0.66; k += 2) c.put(Math.round(x + side * (tall * 0.66 - k) * 0.42), y - k, lit(BOULDER[0], hour.light), thing);
    // the tower: rust-brown steel, square, wide at its foot and narrowing to its top; a brace across it every few rows
    // and no trusses; its side toward the light is the paler
    const lightLeft = hour.to[0] < 0;
    for (let k = 0; k <= tall; k++) {
      const half = Math.max(0, Math.round(2.6 * (1 - k / tall) ** 0.8));
      const brace = k % 5 === 4 || k === 0;
      for (let dx = -half; dx <= half; dx++) {
        const edge = Math.abs(dx) === half;
        if (!edge && !brace && half > 1 && (dx + k) % 3 !== 0) continue;
        c.put(x + dx, y - k, edge ? (dx < 0 === lightLeft || half === 0 ? rust[2] : rust[0]) : brace ? rust[0] : rust[1], thing);
      }
    }
    // the weather station on its top: a cross arm with its cups and a small box
    for (const dx of [-3, -2, -1, 1, 2, 3]) c.put(x + dx, y - tall, lit(BOULDER[0], hour.light), thing);
    for (const dx of [-3, 3]) c.put(x + dx, y - tall - 1, lit(STONE[3], hour.light), thing);
    c.put(x + 1, y - tall + 3, lit(STONE[3], hour.light), thing); c.put(x + 2, y - tall + 3, lit(STONE[3], hour.light), thing);
    c.put(x, y - tall - 1, hour.lit ? IRON[2] : lit(IRON[0], hour.light), thing);
  }

  /**
   * The Kaleva memorial between the sauna and the lighthouse (the memorial was still missing; the
   * spot is the circle marked on the map): shore stones heaped round three dark plaques on the low base of an old building,
   * a pyramid of poles over the heap with a cross of boards hung in it, and a flagpole with the flag beside it.
   * Larger than to scale, as every place of the map.
   */
  private memorial(c: Canvas, at: WorldPoint): void {
    const { hour } = this;
    const foot = this.plan.view.toScreen(at);
    const x = Math.round(foot.x), y = Math.round(foot.y);
    const thing = c.soft();
    const line = (x0: number, y0: number, x1: number, y1: number, colourOf: Colour): void => {
      const long = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
      for (let k = 0; k <= long; k++) c.put(Math.round(x0 + ((x1 - x0) * k) / long), Math.round(y0 + ((y1 - y0) * k) / long), colourOf, thing);
    };
    // the old base: a low rim of pale stone in the grass, broken here and there
    for (let dx = -11; dx <= 11; dx++) for (const dy of [-4, 3]) if (hash2(dx, dy, 61) > 0.3) c.put(x + dx + (dy < 0 ? 1 : 0), y + dy, lit(STONE[1], hour.light), thing);
    for (let dy = -3; dy <= 2; dy++) for (const dx of [-11, 11]) if (hash2(dx, dy, 62) > 0.3) c.put(x + dx, y + dy, lit(STONE[1], hour.light), thing);
    // the pole at the back of the pyramid first, then the heap before it
    const apex = { x: x + 1, y: y - 21 };
    const pale = lit(STONE[2], hour.light), shade = lit(STONE[0], hour.light);
    line(apex.x, apex.y, x + 2, y - 4, shade);
    // the heap: round shore stones, pale, no two alike, a dark seam under each
    for (let dy = -5; dy <= 1; dy++) {
      const reach = Math.round(7.5 * Math.sqrt(1 - ((dy + 1.5) / 4.6) ** 2));
      for (let dx = -reach; dx <= reach; dx++) {
        const stone = hash2((dx + 40) >> 1, dy, 63);
        const seam = (dx + dy * 3 + 60) % 5 === 0 && dy > -5;
        c.put(x + dx, y + dy, lit(seam ? BOULDER[0] : dy === 1 ? STONE[0] : stone > 0.66 ? STONE[3] : stone > 0.3 ? STONE[2] : PARCHMENT[1], hour.light, dx * hour.to[0] > 2 ? 1.05 : 0.95), thing);
      }
    }
    // the three plaques, dark with a pale line of writing
    for (const [dx, dy] of [[-6, -1], [-1, 0], [4, -1]] as const) {
      for (let v = 0; v < 2; v++) for (let u = 0; u < 3; u++) c.put(x + dx + u, y + dy - v, lit(GLASS, hour.light, 1.3), thing);
      c.put(x + dx + 1, y + dy - 1, lit(STONE[1], hour.light), thing);
    }
    // the pyramid's two front poles and the cross hung in it
    line(apex.x, apex.y, x - 10, y + 2, pale);
    line(apex.x, apex.y, x + 12, y + 2, pale);
    const wood = lit(RAIL[0], hour.light);
    line(apex.x, y - 17, apex.x, y - 8, wood);
    line(apex.x - 4, y - 12, apex.x + 5, y - 14, wood);
    line(apex.x - 4, y - 13, apex.x + 5, y - 13, lit(RAIL[1], hour.light));
    // the flagpole beside it, the flag flying the way the wind bends the smoke
    const fx = x - 15;
    line(fx, y + 2, fx, y - 22, lit(STONE[3], hour.light));
    for (let u = 1; u <= 5; u++) {
      const sag = u > 3 ? 1 : 0;
      c.put(fx + u, y - 22 + sag, lit(colour(0x2a78b4), hour.light), thing);
      c.put(fx + u, y - 21 + sag, lit(INK, hour.light, 1), thing);
      c.put(fx + u, y - 20 + sag, lit(STONE[3], hour.light), thing);
    }
  }

  /** A patch of the ground with four corners, in map metres, on the screen. */
  private patch(corners: readonly WorldPoint[], put: (x: number, y: number) => void): void {
    const { view } = this.plan;
    fill(corners.map((p) => view.toScreen(p)), this.w, this.h, put);
  }

  /** The long side of the warden's house on the map, as a unit vector, and the way from it to the sea before its door. */
  private houseSides(): { along: readonly [number, number]; seaward: readonly [number, number] } {
    const house = this.world.buildings.find((b) => b.id === 'warden-house');
    const a = ((house?.angle ?? 0) * Math.PI) / 180;
    const along = [Math.cos(a), Math.sin(a)] as const;
    // of the two ways across the house, the one that goes south, toward the viewer and the nearer shore
    const seaward = (along[0] > 0 ? [along[1], -along[0]] : [-along[1], along[0]]) as readonly [number, number];
    return { along, seaward };
  }

  /**
   * The ground plan a house is drawn with, in map metres: about twice the measured one. A hut is a place of interest
   * too (the sauna): drawn larger still, or it would be a dot; a small flat-roofed shed is only a shed (the
   * one on the east shore: much smaller than it looked); the warden's house is drawn shorter.
   */
  private drawnPlan(b: Building): Building {
    const plan = b.long < 7 ? (b.shape === 'flat' ? HOUSE_PLAN * 0.8 : HOUSE_PLAN * 1.5) : HOUSE_PLAN;
    return { ...b, long: b.long * plan * (b.id === 'warden-house' ? WARDEN_LONG : 1), short: b.short * plan };
  }

  /**
   * The ground before the face of the warden's house as it is drawn: a point `a` metres along the face from its
   * middle and `s` metres out from the wall, and how far the pavement runs each way. Without the house, round `at`.
   */
  private houseFront(at: WorldPoint = { x: 0, y: 0 }): { face(a: number, s: number): WorldPoint; paved: number; middle: WorldPoint } {
    const { along, seaward } = this.houseSides();
    const found = this.world.buildings.find((b) => b.id === 'warden-house');
    const house = found ? this.drawnPlan(found) : { ...at, short: 0, long: 20 };
    const face = (a: number, s: number): WorldPoint => ({ x: house.x + along[0] * a + seaward[0] * (house.short / 2 + s), y: house.y + along[1] * a + seaward[1] * (house.short / 2 + s) });
    return { face, paved: house.long / 2 + 5, middle: house };
  }

  /** The two ends of the pavement before the house's face, in map metres; none without the house. */
  private pavementEnds(): WorldPoint[] {
    if (!this.world.buildings.some((b) => b.id === 'warden-house')) return [];
    const { face, paved } = this.houseFront();
    return [face(-paved, 4), face(paved, 4)];
  }

  /**
   * The terrace before the main door of the warden's house (the box marked on the orthophoto): a wooden
   * deck with a rail and red benches, drawn larger than to scale. Nothing leads from it to the water (the
   * rule: no path or stair from the terrace to the waterfront).
   */
  private terrace(c: Canvas, at: WorldPoint): void {
    const { hour, w } = this;
    const { view } = this.plan;
    const thing = c.soft();
    const { along } = this.houseSides();
    const LONG = 30, DEEP = 15;
    // it lies before the house as the house is drawn: as far along the wall as measured, and out on the shingle, clear
    // of the pavement that runs along the house's face
    const { face, paved, middle } = this.houseFront(at);
    const GAP = 13;
    const beside = (at.x - middle.x) * along[0] + (at.y - middle.y) * along[1];
    this.patch([face(-paved, 1.5), face(paved, 1.5), face(paved, 6.5), face(-paved, 6.5)], (x, y) => { c.put(x, y, lit((x * 2 + y) % 7 === 0 ? STONE[2] : PATH, hour.light), thing); this.pavedAt.add(y * w + x); });
    this.patch([face(beside - 2.5, 6.5), face(beside + 2.5, 6.5), face(beside + 2.5, GAP), face(beside - 2.5, GAP)], (x, y) => c.put(x, y, lit(PATH, hour.light), thing));
    const point = (a: number, s: number): WorldPoint => face(beside + a, GAP + DEEP / 2 + s);
    // the deck: planks along the house, a dark front edge and a rail on posts
    this.patch([point(-LONG / 2, -DEEP / 2), point(LONG / 2, -DEEP / 2), point(LONG / 2, DEEP / 2), point(-LONG / 2, DEEP / 2)], (x, y) => c.put(x, y, lit((x + y * 2) % 5 === 0 ? RAIL[1] : PARCHMENT[1], hour.light), thing));
    for (let a = -LONG / 2; a <= LONG / 2; a += 0.4) {
      const front = view.toScreen(point(a, DEEP / 2)), x = Math.round(front.x), y = Math.round(front.y);
      c.put(x, y + 1, lit(RAIL[0], hour.light), thing);
      if (Math.abs(a) > 3) { c.put(x, y - 2, lit(RAIL[1], hour.light), thing); if (Math.round(a * 2.5) % 9 === 0) c.put(x, y - 1, lit(RAIL[0], hour.light), thing); }
    }
    // the red benches, one on each side of the door
    for (const a of [-LONG * 0.28, LONG * 0.28]) {
      const bench = view.toScreen(point(a, -DEEP * 0.1)), x = Math.round(bench.x), y = Math.round(bench.y);
      for (let dx = -2; dx <= 2; dx++) { c.put(x + dx, y, lit(IRON[1], hour.light), thing); c.put(x + dx, y - 1, lit(IRON[2], hour.light), thing); }
      c.put(x - 2, y + 1, lit(IRON[0], hour.light), thing); c.put(x + 2, y + 1, lit(IRON[0], hour.light), thing);
    }
  }

  /**
   * The helicopter pad in the west (the square marked on the orthophoto): a square of pale concrete laid
   * in slabs, larger than to scale, with a darker edge toward the viewer.
   */
  private helipad(c: Canvas, at: WorldPoint): void {
    const { hour } = this;
    const { view } = this.plan;
    const thing = c.soft();
    const { along, seaward } = this.houseSides();
    const HALF = 13;
    const point = (a: number, s: number): WorldPoint => ({ x: at.x + along[0] * a + seaward[0] * s, y: at.y + along[1] * a + seaward[1] * s });
    const mid = view.toScreen(at);
    this.patch([point(-HALF, -HALF), point(HALF, -HALF), point(HALF, HALF), point(-HALF, HALF)], (x, y) => {
      const seam = Math.round(x - mid.x + (y - mid.y) * 0.5) % 6 === 0 || Math.round(y - mid.y) % 4 === 0;
      c.put(x, y, lit(seam ? STONE[1] : STONE[2], hour.light), thing);
    });
    for (let a = -HALF; a <= HALF; a += 0.4) { const front = view.toScreen(point(a, HALF)); c.put(Math.round(front.x), Math.round(front.y) + 1, lit(STONE[0], hour.light), thing); }
    // the ring painted in its middle
    for (let k = 0; k < 40; k++) { const t = (k / 40) * Math.PI * 2; c.put(Math.round(mid.x + Math.cos(t) * 5), Math.round(mid.y + Math.sin(t) * 2.4), lit(STONE[3], hour.light), thing); }
  }

  /**
   * A house as the map shows it: a crooked cottage in the colours the photographs show, louder; the warden's house with
   * three chimneys, the gable over its main door, its terrace before it and lamplight in its windows from dusk to dawn.
   * The well house is the well, and the flat shed on the shore stays a box.
   */
  private building(c: Canvas, b: Building): void {
    if (b.id === 'hut-west') { this.well(c, b); return; }
    const drawn = this.drawnPlan(b);
    if (b.id === 'hut-middle') this.saunaSmoke(c, drawn);
    if (b.shape === 'flat') { this.body(c, drawn, 1.5, { windows: false, door: 'long', chimneys: [], glow: false }); return; }
    this.cottage(c, b, drawn);
  }

  /**
   * A cottage, turned to the viewer by the side of the house that faces south: a house lying east to west shows its long
   * wall under its roof, a house lying north to south its gable with the roof running back from it. Not each house's
   * portrait but the general picture of one: a big roof, a pale wall, a dark window or two.
   */
  private cottage(c: Canvas, b: Building, drawn: Building): void {
    const { view } = this.plan;
    const small = b.long < 7, warden = b.id === 'warden-house', plain = small || b.walls === 'boards';
    let a = ((b.angle % 180) + 180) % 180;
    if (a > 90) a -= 180;
    const at = view.toScreen(b), rad = (a * Math.PI) / 180;
    const wall = Math.max(4, Math.round((warden ? 3.2 : small ? 2.2 : 2.7) * HOUSE_SCALE * 0.95));
    const look = this.cottageLook(b, small);
    if (Math.abs(a) <= 40) {
      const w = Math.round(drawn.long * view.scale * Math.cos(rad)), depth = drawn.short * view.scale * view.tilt;
      this.sideCottage(c, {
        ...look, x: at.x, y: Math.round(at.y + depth / 2), w, wall, roofH: Math.max(4, Math.round(wall * (small ? 1.3 : 1.1))), slope: -Math.tan(rad) * view.tilt,
        windows: plain ? (small ? 1 : 0) : Math.max(2, Math.floor(w / (warden ? 9 : 8)) & ~1),
        chimneys: warden ? [0.14, 0.5, 0.86] : b.chimney || !plain ? [0.3] : [], plinth: warden ? BRICK : undefined, bay: warden,
      });
      return;
    }
    const turn = (b.angle * Math.PI) / 180, run = drawn.long * view.scale * ROOF_RUN;
    const back = { x: Math.cos(turn) * run * (Math.sin(turn) < 0 ? -1 : 1), y: -Math.abs(Math.sin(turn)) * run * view.tilt };
    const w = drawn.short * view.scale;
    this.endCottage(c, {
      ...look, x: Math.round(at.x - back.x / 2), y: Math.round(at.y - back.y / 2), w: Math.max(7, Math.round(w)), wall: wall + 1, roofH: Math.max(4, Math.round(w * GABLE_RISE)), slope: 0,
      windows: small ? 0 : 1, chimneys: b.chimney ? [0.5] : [],
    }, back);
  }

  /** What a cottage is made of and how crooked it stands: no two alike, each by its own name. */
  private cottageLook(b: Building, small: boolean): Pick<Cottage, 'lean' | 'sag' | 'roof' | 'walls' | 'boards' | 'patch' | 'seams' | 'hip' | 'seed' | 'glow'> {
    const seed = [...b.id].reduce((n, ch) => n + ch.charCodeAt(0), 0);
    const roof = b.roof ?? 'tin';
    return {
      lean: seed % 3 === 0 ? -1 : seed % 3 === 1 ? 1 : 2, sag: 1 + (seed % 2), seed,
      roof: COTTAGE_ROOFS[roof === 'tin' && small ? 'bare' : roof], walls: COTTAGE_WALLS[b.walls ?? 'plaster'], boards: b.walls === 'boards' || b.walls === 'green',
      patch: roof === 'boards' ? MOSS : roof === 'red' ? COTTAGE_ROOFS.red[0] : RUST,
      seams: roof === 'dark' ? 'none' : roof === 'red' || roof === 'boards' ? 'flecks' : 'ribs',
      hip: b.shape === 'hip', glow: b.id === 'warden-house',
    };
  }

  /** The shade a cottage throws on the ground at its foot, away from the light: three rows, darkening what lies there. */
  private cottageShade(c: Canvas, x0: number, x1: number, footAt: (x: number) => number): void {
    const { hour, w, h } = this;
    const dx = hour.to[0] < 0 ? 3 : -3;
    const seen = new Set<number>();
    for (let x = Math.round(x0); x <= x1; x++) for (let v = 0; v < 3; v++) {
      const px = Math.round(x + dx + (dx > 0 ? v : -v) * 0.6), py = Math.round(footAt(x)) + 1 + v;
      const i = py * w + px;
      if (px < 0 || py < 0 || px >= w || py >= h || seen.has(i) || this.kind[i] === Kind.Sea) continue;
      seen.add(i);
      c.scale(px, py, 1 - hour.shade * 0.95);
    }
  }

  /**
   * A cottage seen from its long side: a leaning wall with shuttered windows and a door, under a big roof that hangs
   * over it and sags along its ridge. Each pixel is asked what part of the house lies there (`u` along the wall, `v`
   * rows over its foot), the lean a shift of whole rows, so that a crooked wall has no gaps.
   */
  private sideCottage(c: Canvas, o: Cottage): void {
    const { hour } = this;
    const f = this.sideFrame(o);
    const ox = Math.round(o.x), oy = Math.round(o.y);
    const footAt = (u: number): number => Math.round(o.y + o.slope * u);
    const shift = (rows: number): number => Math.round((o.lean * rows) / Math.max(1, o.wall));
    this.cottageShade(c, o.x - f.half, o.x + f.half + 3, (x) => footAt(x - o.x));
    const thing = c.next();
    const maxV = o.wall + o.roofH + 1, reach = f.half + f.over + Math.abs(o.lean) * 3 + 2;
    const low = Math.max(footAt(-reach), footAt(reach)), high = Math.min(footAt(-reach), footAt(reach)) - maxV;
    for (let x = ox - reach; x <= ox + reach; x++) for (let y = high; y <= low; y++) {
      const u = x - ox - shift(oy - y), v = footAt(u) - y;
      if (v < 0 || v > maxV) continue;
      const tone = this.bayTone(o, f, u, v) ?? (v >= f.eaveV ? this.roofTone(o, f, u, v) : this.wallTone(o, f, u, v));
      if (tone) c.put(x, y, tone, thing);
    }
    // chimneys, each a little crooked, under a dark cap
    for (const [n, t] of o.chimneys.entries()) {
      const u = Math.round((t - 0.5) * o.w * 0.7), y = footAt(u) - f.ridgeV(u) + 1, x = ox + u + shift(oy - y), tilt = (n + o.seed) % 2 === 0 ? 1 : 0;
      for (let k = 0; k < 5; k++) for (const dx of [0, 1]) c.put(x + dx + (k > 2 ? tilt : 0), y - k, lit(BRICK, hour.light, dx ? 0.75 : 1), thing);
      for (const dx of [-1, 0, 1, 2]) c.put(x + dx + tilt, y - 5, lit(BANK[0], hour.light), thing);
    }
  }

  private sideFrame(o: Cottage): SideFrame {
    const slots = o.windows + 1, eaveRows = o.wall >= 8 ? 2 : 1;
    return {
      half: Math.floor(o.w / 2), eaveV: o.wall - 1, eaveRows, over: 2 + (o.w > 30 ? 1 : 0), inset: o.roofH * (o.hip ? 0.95 : 0.35),
      slots, doorAt: Math.floor(slots / 2), paneTall: Math.min(4, Math.max(2, o.wall - 6)), doorTall: Math.max(3, o.wall - 2 - eaveRows),
      bayReach: Math.max(4, Math.round(o.w * 0.12)), bayHigh: Math.max(4, Math.round(o.roofH * 0.6)),
      patches: [0.22, 0.71].map((t, n) => ({ u: Math.round((t - 0.5) * o.w + ((o.seed >> n) % 5) - 2), row: 2 + ((o.seed >> (n + 1)) % 2) })),
      ridgeV: (u) => Math.round(o.wall + o.roofH - o.sag * (1 - ((2 * u) / o.w) ** 2)),
      slotU: (n) => Math.round(((n + 0.5) / slots - 0.5) * (o.w - 3)),
    };
  }

  /**
   * The gable over the main door of the warden's house (the reference photograph, the fourth picture): the
   * wall goes up into a low, wide gable in the middle of the long side, a red half-round window in it. Nothing where
   * the house has none or the pixel is beside it.
   */
  private bayTone(o: Cottage, f: SideFrame, u: number, v: number): Colour | undefined {
    const { hour } = this;
    if (!o.bay || v < f.eaveV || v > f.eaveV + f.bayHigh) return undefined;
    const reach = Math.round(f.bayReach * (1 - (v - f.eaveV) / (f.bayHigh + 1))), d = Math.abs(u - 0.5);
    if (d > reach + 1.5) return undefined;
    if ((v === f.eaveV + 1 && u >= -1 && u <= 2) || (v === f.eaveV + 2 && u >= 0 && u <= 1)) return lit(IRON[1], hour.light);
    return d > reach + 0.5 || v === f.eaveV + f.bayHigh ? lit(o.roof[0], hour.light) : lit(o.walls, hour.light);
  }

  /** The roof of a cottage seen from its side: narrower toward its sagging ridge, in three flat bands with a glint along the ridge, a patch or two, a dark line at the eaves. */
  private roofTone(o: Cottage, f: SideFrame, u: number, v: number): Colour | undefined {
    const top = f.ridgeV(u);
    if (v > top) return undefined;
    const span = Math.max(1, top - f.eaveV), row = top - v;
    if (Math.abs(u) > f.half + f.over - f.inset * (1 - row / span)) return undefined;
    const wobble = hash2((u + 400) >> 2, 3, o.seed) > 0.5 ? 1 : 0;
    let tone = row + wobble > span * 0.62 ? mix(o.roof[1], o.roof[0], 0.5) : o.roof[1];
    if (o.seams === 'ribs' && (u + 400) % 5 === 0 && row >= 2) tone = mix(tone, o.roof[0], 0.45);
    if (o.w > 14 && f.patches.some((q) => u >= q.u && u < q.u + 3 && row >= q.row && row < q.row + 2)) tone = mix(o.roof[1], o.patch, 0.7);
    if (row === 0 || (row === 1 && span >= 8 && !wobble)) tone = o.roof[2];
    if (v === f.eaveV) tone = mix(o.roof[0], INK, 0.35);
    return lit(tone, this.hour.light);
  }

  /** The long wall of a cottage: what is in it, or the wall itself, stained toward its foot, in violet shade under the eaves and at the end away from the light. */
  private wallTone(o: Cottage, f: SideFrame, u: number, v: number): Colour | undefined {
    const { hour } = this;
    if (Math.abs(u) > f.half) return undefined;
    const opening = this.openingTone(o, f, u, v);
    if (opening) return opening;
    if (v === 0 && o.plinth) return lit(o.plinth, hour.light);
    const away = (hour.to[0] < 0 ? 1 : -1) * u > f.half - Math.max(2, Math.round(o.w * 0.14));
    const base = away || v >= f.eaveV - f.eaveRows ? lit(mix(o.walls, SHADE_VIOLET, 0.45), hour.light, 0.9) : lit(o.walls, hour.light);
    let k = v < 2 && hash2((Math.round(o.x) + u) >> 1, v, o.seed) > 0.6 ? 0.86 : 1;
    if (o.boards && (u + o.seed + 300) % 3 === 0) k *= 0.78;
    return [base[0] * k, base[1] * k, base[2] * k];
  }

  /** A window (a dark pane between coloured shutters over a pale sill; lamplight in it where the house is lived in) or the door on its step, if one is at this place of the wall. */
  private openingTone(o: Cottage, f: SideFrame, u: number, v: number): Colour | undefined {
    const { hour } = this;
    const SILL = 2;
    const pane = o.glow && hour.lit ? LAMP : lit(PANE, hour.light, 1.2);
    for (let n = 0; n < f.slots; n++) {
      const d = u - f.slotU(n);
      if (n === f.doorAt) {
        if (v === 0 && Math.abs(d) <= 2) return lit(STONE[2], hour.light);
        if (v >= 1 && v <= f.doorTall && Math.abs(d) <= 1) return lit(DOOR, hour.light, d === 1 ? 0.75 : 1);
      } else if (o.wall < 7) {
        if (d === 0 && (v === 2 || v === 3)) return pane;
      } else if (v === SILL && d >= -1 && d <= 2) return lit(PALE_PAINT, hour.light);
      else if (v > SILL && v <= SILL + f.paneTall && d >= -1 && d <= 2) {
        if (d === 0 || d === 1) return pane;
        if (o.wall >= 8) return lit(SHUTTERS[o.seed % SHUTTERS.length]!, hour.light);
      }
    }
    return undefined;
  }

  /**
   * A cottage seen from its gable end: the gable wall with its door, the long wall that turns to the viewer under its
   * eave, and the roof running back from the gable by `back` pixels, both its slopes seen from above, its ridge sagging.
   * A hipped roof comes down over the gable.
   */
  private endCottage(c: Canvas, o: Cottage, back: Pt): void {
    const { hour, w, h } = this;
    const lightLeft = hour.to[0] < 0, half = o.w / 2;
    this.cottageShade(c, o.x - half, o.x + half + 2, () => o.y);
    const thing = c.next();
    const eaveL: Pt = { x: o.x - half - 1 + o.lean, y: o.y - o.wall }, eaveR: Pt = { x: o.x + half + 1 + o.lean, y: o.y - o.wall };
    const peak: Pt = { x: o.x + o.lean + (o.seed % 2 ? 1 : -1), y: o.y - o.wall - o.roofH };
    const sagged = (p: Pt, k: number): Pt => ({ x: p.x + back.x * k, y: p.y + back.y * k + (k > 0 && k < 1 ? o.sag : 0) });
    // the slopes, in two lengths: the ridge sags half way back
    const slope = (eave: Pt, inLight: boolean): void => {
      for (const [k0, k1] of [[0, 0.5], [0.5, 1]] as const) fill([sagged(eave, k0), sagged(peak, k0), sagged(peak, k1), sagged(eave, k1)], w, h, (x, y) => {
        const fleck = o.seams !== 'none' && hash2(x >> 1, y, o.seed + 5) > 0.82;
        c.put(x, y, lit(fleck ? o.roof[0] : inLight ? o.roof[1] : mix(o.roof[0], o.roof[1], 0.35), hour.light), thing);
      });
    };
    if (back.x < 0) { slope(eaveL, lightLeft); slope(eaveR, !lightLeft); } else { slope(eaveR, !lightLeft); slope(eaveL, lightLeft); }
    // the long wall that turns to the viewer, under its eave
    const sx = back.x < 0 ? o.x - half : o.x + half;
    const side = (back.x < 0) === lightLeft ? lit(o.walls, hour.light, 0.9) : lit(mix(o.walls, SHADE_VIOLET, 0.5), hour.light, 0.85);
    fill([{ x: sx, y: o.y }, { x: sx + o.lean, y: o.y - o.wall }, { x: sx + o.lean + back.x, y: o.y - o.wall + back.y }, { x: sx + back.x, y: o.y + back.y }], w, h, (x, y) => c.put(x, y, side, thing));
    // the gable wall, boards if it is a shed, stained toward its foot
    const wall = lit(o.walls, hour.light, 0.96);
    fill([{ x: o.x - half, y: o.y }, { x: o.x + half, y: o.y }, { x: o.x + half + o.lean, y: o.y - o.wall }, { x: peak.x, y: peak.y + 1 }, { x: o.x - half + o.lean, y: o.y - o.wall }], w, h, (x, y) => {
      const k = (o.boards && (x + o.seed) % 2 === 0 ? 0.8 : 1) * (y > o.y - 3 && hash2(x >> 1, y, o.seed) > 0.62 ? 0.86 : 1);
      c.put(x, y, [wall[0] * k, wall[1] * k, wall[2] * k], thing);
    });
    if (o.hip) fill([{ x: eaveL.x + 1, y: eaveL.y }, { x: eaveR.x - 1, y: eaveR.y }, { x: peak.x, y: peak.y + 1 }], w, h, (x, y) => c.put(x, y, lit(mix(o.roof[1], o.roof[2], (y - peak.y) % 3 === 0 ? 0.5 : 0.25), hour.light), thing));
    // the roof's edge over the gable, and the glint along the ridge
    for (const eave of [eaveL, eaveR]) {
      const long = Math.max(1, Math.ceil(Math.hypot(peak.x - eave.x, peak.y - eave.y)));
      for (let k = 0; k <= long; k++) c.put(Math.round(eave.x + ((peak.x - eave.x) * k) / long), Math.round(eave.y + ((peak.y - eave.y) * k) / long), lit(mix(o.roof[0], INK, 0.3), hour.light), thing);
    }
    for (let k = 0; k <= 10; k++) c.put(Math.round(peak.x + (back.x * k) / 10), Math.round(peak.y + (back.y * k) / 10 + (k > 2 && k < 8 ? o.sag : 0)), lit(o.roof[2], hour.light), thing);
    // the door, a small window in the gable, a chimney on the ridge
    for (let v = 1; v <= Math.max(3, o.wall - 2); v++) for (const dx of [0, 1]) c.put(Math.round(o.x) + dx, o.y - v, lit(DOOR, hour.light, 0.8), thing);
    if (o.windows > 0) {
      const wy = Math.round(o.y - o.wall - o.roofH * 0.35);
      c.put(Math.round(peak.x), wy, o.glow && hour.lit ? LAMP : lit(GLASS, hour.light, 1.5), thing);
      c.put(Math.round(peak.x) + 1, wy, lit(PALE_PAINT, hour.light), thing);
    }
    for (const [n, t] of o.chimneys.entries()) {
      const x = Math.round(peak.x + back.x * t), y = Math.round(peak.y + back.y * t) + 1;
      for (let v = 0; v < 4; v++) c.put(x + (v > 2 && n % 2 === 0 ? 1 : 0), y - v, lit(BRICK, hour.light), thing);
    }
  }

  /**
   * The well (turn the well house into an actual well): a ring of pale stone with dark water in
   * it, two posts and a small roof over a windlass, a bucket on its rope. The world model's well house marks the spot.
   */
  private well(c: Canvas, at: WorldPoint): void {
    const { hour } = this;
    const foot = this.plan.view.toScreen(at);
    const x = Math.round(foot.x), y = Math.round(foot.y);
    const thing = c.soft();
    for (let dy = -3; dy <= 3; dy++) for (let dx = -5; dx <= 5; dx++) {
      const ring = (dx / 5) ** 2 + ((dy + 1) / 2.4) ** 2, wall = (dx / 5) ** 2 + ((dy - 1) / 2.4) ** 2;
      if (ring <= 1) c.put(x + dx, y + dy, lit(ring > 0.5 ? (dx * hour.to[0] > 0 ? STONE[3] : STONE[2]) : BANK[0], hour.light), thing);
      else if (wall <= 1) c.put(x + dx, y + dy, lit((x + dx) % 3 === 0 ? STONE[0] : STONE[1], hour.light), thing);
    }
    for (const dx of [-5, 5]) for (let k = 0; k < 9; k++) c.put(x + dx, y - k, lit(RAIL[dx * hour.to[0] > 0 ? 1 : 0], hour.light), thing);
    for (let dx = -4; dx <= 4; dx++) c.put(x + dx, y - 6, lit(RAIL[0], hour.light), thing);
    for (let row = 0; row < 4; row++) for (let dx = -7 + row; dx <= 7 - row; dx++) c.put(x + dx, y - 9 - row, lit(row === 0 ? RAIL[0] : dx * hour.to[0] > 0 ? PARCHMENT[1] : RAIL[1], hour.light), thing);
    c.put(x + 1, y - 5, lit(BOULDER[0], hour.light), thing); c.put(x + 1, y - 4, lit(BOULDER[0], hour.light), thing);
    c.put(x + 1, y - 3, lit(RAIL[1], hour.light), thing); c.put(x + 2, y - 3, lit(RAIL[1], hour.light), thing);
  }

  /** The sauna is heated: a thin thread of smoke from its chimney, bent to the east by the wind as the fire place's is. */
  private saunaSmoke(c: Canvas, b: Building): void {
    const { hour } = this;
    const top = this.plan.view.toScreen(b, 2.2 * HOUSE_SCALE + b.short * ROOF_PITCH);
    const thing = c.soft();
    const pale = hour.light[0] < 0.5 ? 1.7 : 1;
    for (let k = 0; k < 20; k++) {
      const x = Math.round(top.x + 1 + 2.2 * Math.sin(k / 2.6) + k * 0.45), y = Math.round(top.y - 5 - k);
      if (k > 12 && k % 3 === 0) continue;
      c.put(x, y, lit(STONE[k % 5 < 3 ? 3 : 2], hour.light, pale), thing);
      if (k > 6 && k % 2 === 0) c.put(x + 1, y, lit(STONE[2], hour.light, pale), thing);
    }
  }

  /** One body of a house, its ground plan as drawn: its shadow, its walls with what is in them, its roof. The eaves' height in metres before `HOUSE_SCALE`. */
  private body(c: Canvas, b: Building, eaveMetres: number, has: { windows: boolean; door: 'long' | 'end' | 'none'; chimneys: readonly number[]; glow: boolean }): void {
    const { view } = this.plan;
    const { hour } = this;
    const eave = eaveMetres * HOUSE_SCALE, ridge = eave + (b.shape === 'flat' ? 0 : b.short * ROOF_PITCH);
    const corners = buildingCorners(b);
    const foot = corners.map((p) => view.toScreen(p));
    const top = corners.map((p) => view.toScreen(p, eave));
    const centre = view.toScreen(b);
    this.shadow(c, foot, (eave + ridge) / 2 / LANDMARK);
    const thing = c.next();
    const wall = WALLS[b.walls ?? 'plaster'];
    const boards = b.walls === 'boards' || b.walls === 'green';
    const high = foot[0]!.y - top[0]!.y;
    const sides = [0, 1, 2, 3].map((i) => ({ a: i, e: (i + 1) % 4 })).sort((p, q) => foot[p.a]!.y + foot[p.e]!.y - foot[q.a]!.y - foot[q.e]!.y);
    for (const { a, e } of sides) {
      const A = foot[a]!, E = foot[e]!;
      const side = this.turned(centre, A, E);
      const k = 0.8 + 0.2 * clamp01(side.light + 0.3);
      fill([A, E, top[e]!, top[a]!], this.w, this.h, (x, y) => c.put(x, y, lit(wall, hour.light, k * (boards && x % 2 === 0 ? 0.84 : 1)), thing));
      if (side.viewer <= 0.2) continue;
      // the corners go 0, 1, 2, 3 round the house: the sides 0-1 and 2-3 are the long ones
      const long = a % 2 === 0;
      const length = Math.hypot(E.x - A.x, E.y - A.y);
      const doored = (has.door === 'long' && long) || (has.door === 'end' && !long);
      // a side with a door has an odd number of places, so the door stands in its middle
      const places = has.windows ? Math.floor(length / 7) : 0, windows = doored && places > 1 && places % 2 === 0 ? places - 1 : places;
      const door = doored ? Math.floor(windows / 2) : -1;
      const slots = Math.max(windows, door >= 0 ? 1 : 0);
      for (let n = 0; n < slots; n++) {
        const t = (n + 0.5) / slots;
        const x = Math.round(A.x + (E.x - A.x) * t), y = A.y + (E.y - A.y) * t;
        if (n === door) {
          for (let v = 1; v <= Math.max(3, Math.round(high * 0.62)); v++) for (const dx of [0, 1]) c.put(x + dx, Math.round(y - v), lit(DOOR, hour.light), thing);
          continue;
        }
        const pane = has.glow && hour.lit ? LAMP : lit(GLASS, hour.light, 1.6);
        const sill = Math.round(y - high * 0.38), tall = Math.max(2, Math.round(high * 0.32));
        for (let v = 0; v < tall; v++) for (const dx of [0, 1]) c.put(x + dx, sill - v, pane, thing);
      }
    }
    this.roof(c, b, { top, high, centre, ridge, wall, thing }, has.chimneys);
  }

  /** How much a side between two corners of a house faces the light (-1 to 1) and the viewer (above 0: turned toward the viewer). */
  private turned(centre: Pt, p: Pt, q: Pt): { light: number; viewer: number } {
    const { hour } = this;
    const nx = q.y - p.y, ny = -(q.x - p.x), n = Math.hypot(nx, ny) || 1;
    const out = nx * ((p.x + q.x) / 2 - centre.x) + ny * ((p.y + q.y) / 2 - centre.y) >= 0 ? 1 : -1;
    return { light: ((nx * hour.to[0] + ny * hour.to[1]) / n) * out, viewer: (ny / n) * out };
  }

  /** A house's roof over its walls' tops: flat, ridged with a gable at each end, or hipped; then its chimneys. */
  private roof(c: Canvas, b: Building, shell: { top: Pt[]; high: number; centre: Pt; ridge: number; wall: Colour; thing: number }, chimneys: readonly number[]): void {
    const { view } = this.plan;
    const { hour } = this;
    const { top, high, centre, ridge, wall, thing } = shell;
    const roof = ROOFS[b.roof ?? 'tin'];
    const shape = b.shape ?? 'gable';
    const over = c.next();
    if (shape === 'flat') {
      c.poly(top, lit(roof[1], hour.light, 0.9), over);
      return;
    }
    // the ridge runs along the long side; a hipped roof's ridge is shorter by half the house's width at each end
    const a = (b.angle * Math.PI) / 180, ux = Math.cos(a), uy = Math.sin(a);
    const half = b.long / 2 - (shape === 'hip' ? Math.min(b.long / 2 - 0.5, b.short / 2) : 0);
    const ends = [-1, 1].map((s) => view.toScreen({ x: b.x + s * half * ux, y: b.y + s * half * uy }, ridge)) as [Pt, Pt];
    const rx = ends[1].x - ends[0].x, ry = ends[1].y - ends[0].y, rl = Math.hypot(rx, ry) || 1;
    // sheets of tin show their seams, boards their gaps
    const seams = b.roof === 'dark' ? 0 : b.roof === 'boards' ? 2 : 3;
    const slope = (points: Pt[], light: number): void => fill(points, this.w, this.h, (x, y) => {
      const along = Math.round(((x - ends[0].x) * rx + (y - ends[0].y) * ry) / rl);
      const seam = seams > 0 && ((along % seams) + seams) % seams === 0;
      c.put(x, y, lit(mix(roof[0], roof[1], clamp01(0.5 + light * 0.7)), hour.light, seam ? 0.86 : 1), over);
    });
    // the long sides lie along corners 0-1 and 3-2, the ends at corners 0, 3 and 1, 2
    const faces = [
      { base: [top[0]!, top[1]!] as const, points: [top[0]!, top[1]!, ends[1], ends[0]], end: false },
      { base: [top[3]!, top[2]!] as const, points: [top[3]!, top[2]!, ends[1], ends[0]], end: false },
      { base: [top[0]!, top[3]!] as const, points: [top[0]!, top[3]!, ends[0]], end: true },
      { base: [top[1]!, top[2]!] as const, points: [top[1]!, top[2]!, ends[1]], end: true },
    ].sort((p, q) => p.base[0].y + p.base[1].y - q.base[0].y - q.base[1].y);
    for (const face of faces) {
      const side = this.turned(centre, { x: face.base[0].x, y: face.base[0].y + high }, { x: face.base[1].x, y: face.base[1].y + high });
      if (face.end && shape === 'gable') c.poly(face.points, lit(wall, hour.light, 0.82 + 0.14 * clamp01(side.light + 0.3)), thing);
      else slope(face.points, side.light);
    }
    // the ridge's cap catches the light
    for (let t = 0; t <= rl; t += 0.5) c.put(Math.round(ends[0].x + (rx * t) / rl), Math.round(ends[0].y + (ry * t) / rl), lit(roof[1], hour.light, 1.12), over);
    const stack = chimneys.length ? c.soft() : 0;
    for (const t of chimneys) {
      const x = Math.round(ends[0].x + rx * t), y = Math.round(ends[0].y + ry * t);
      for (let v = 0; v < 4; v++) for (const dx of [0, 1]) c.put(x + dx, y - v, lit(BRICK, hour.light, v === 3 ? 0.55 : dx ? 0.8 : 1), stack);
    }
  }

  /** Where the lighthouse's lamp is in the picture. */
  lamp(): Pt {
    const p = this.plan.view.toScreen(this.world.places.lighthouse, LIGHTHOUSE_METRES * TOWER_SCALE * TOWER.lamp);
    return { x: Math.round(p.x), y: Math.round(p.y) };
  }

  /**
   * The lighthouse's stone foot at a share `up` of the tower's height and `t` across it (-1 at its left edge to 1): the
   * light lies round it in flat bands and its shade turns violet; its courses show as short broken lines, rust has run
   * down under the iron hoops and the foot is green with damp (the lighthouse too had lacked
   * character). It stands straight.
   */
  private limestone(up: number, t: number, tall: number): Colour {
    const { hour } = this;
    const px = up * tall, course = Math.floor(px / 4);
    const a = t * (hour.to[0] < 0 ? -1 : 1) + (hash2(Math.floor(px / 3), 1, 5) - 0.5) * 0.1;
    const band = a > 0.8 ? 0.9 : a > 0.3 ? 1.12 : a > -0.2 ? 1 : a > -0.58 ? 0.78 : 0.58;
    const violet = a > -0.2 ? 0 : a > -0.58 ? 0.25 : 0.5;
    if (TOWER.hoops.some((v) => Math.abs(up - v) < 0.007)) return lit(mix(RAIL[0], SHADE_VIOLET, violet), hour.light, band);
    let base = mix(LIME[0], LIME[1], noise2(up * 40, t * 4, 3));
    const slot = Math.floor((t + 1) * 6 + course * 0.5), column = Math.floor((t + 1) * 9);
    if (px % 4 < 1 && hash2(course, slot, 9) > 0.45) base = mix(base, STONE[0], 0.4);
    else if (hash2(course, slot, 13) > 0.86) base = mix(base, STONE[1], 0.45);
    const under = TOWER.hoops.findIndex((v) => up < v - 0.007 && up > v - 0.007 - 0.045 * hash2(column, Math.round(v * 100), 11));
    if (under >= 0 && hash2(column, under, 17) > 0.68) base = mix(base, RUST, 0.34);
    if (up < 0.03 && hash2(Math.floor((t + 1) * 12), Math.floor(px), 19) > 0.4) base = mix(base, MOSS, 0.4);
    return lit(mix(base, SHADE_VIOLET, violet), hour.light, band);
  }

  /**
   * Keri lighthouse after the reference photographs (the proportions between the fat base and the steel
   * tower had been off): the fat round foot of pale limestone, more than half the height, hooped with iron in its lower
   * half, one small window; a gallery with a rail on its top; the slim rust-red iron tower that flares out under the
   * upper gallery; the lantern on a drum with a rail of its own; a rusty dome with a capped vent. A stack of round
   * parts seen at the map's slant, so every band bends like the foot's rim.
   */
  private lighthouse(c: Canvas): void {
    const { view } = this.plan;
    const { hour } = this;
    const at = view.toScreen(this.world.places.lighthouse);
    const tall = LIGHTHOUSE_METRES * TOWER_SCALE * view.scale * Math.sqrt(1 - view.tilt * view.tilt);
    const cx = Math.round(at.x), foot = Math.round(at.y);
    const R = tall * TOWER.foot;
    this.shadow(c, Array.from({ length: 10 }, (_, i) => ({ x: cx + Math.cos((i * Math.PI) / 5) * R, y: foot + Math.sin((i * Math.PI) / 5) * R * view.tilt })), LIGHTHOUSE_METRES * 0.8);
    const thing = c.next();
    const round = (base: Colour, t: number, k = 1): Colour => lit(base, hour.light, k * (0.72 + 0.42 * clamp01(0.5 + t * hour.to[0] * 0.9) + (Math.abs(t - hour.to[0] * 0.45) < 0.16 ? 0.16 : 0)));
    type Part = { id: string; r: number; paint: (t: number) => Colour };
    const iron = (up: number): Part => {
      // the tower, slim, flaring out on its brackets under the upper gallery
      if (up < TOWER.flare) return { id: 'tower', r: R * 0.25, paint: (t) => round(Math.abs(up - 0.655) < 0.007 ? IRON[0] : IRON[1], t) };
      if (up < TOWER.upper) return { id: 'tower', r: R * (0.25 + (0.2 * (up - TOWER.flare)) / (TOWER.upper - TOWER.flare)), paint: (t) => round(Math.round(t * 5) % 2 === 0 ? IRON[0] : IRON[1], t, 0.92) };
      if (up < TOWER.upper + 0.016) return { id: 'upper', r: R * 0.5, paint: (t) => round(colour(0x424048), t) };
      if (up < TOWER.glass - 0.014) return { id: 'drum', r: R * 0.31, paint: (t) => round(IRON[1], t) };
      return { id: 'round', r: R * 0.41, paint: (t) => round(colour(0x424048), t) };
    };
    /** The part at a share of the height: its half width and its colour across (t from -1 at the left edge to 1). */
    const part = (up: number): Part | null => {
      if (up < TOWER.stone) {
        // the stone foot, narrowing a little; hoops in its lower half and one small window
        const pane = (t: number): boolean => Math.abs(up - 0.37) < 0.022 && Math.abs(t - 0.34) < 0.075;
        return { id: 'stone', r: R * (1 - (up / TOWER.stone) * 0.2), paint: (t) => (pane(t) ? lit(GLASS, hour.light, 1.4) : this.limestone(up, t, tall)) };
      }
      if (up < TOWER.stone + 0.022) return { id: 'gallery', r: R * 0.86, paint: (t) => round(STONE[0], t, 0.85) };
      if (up < TOWER.glass) return iron(up);
      if (up < TOWER.dome) return { id: 'glass', r: R * 0.28, paint: (t) => (Math.abs(t) > 0.74 || Math.abs(t) < 0.1 ? round(IRON[0], t) : hour.lit ? LAMP : lit(colour(0xd2ebfb), hour.light, 1 - Math.abs(t + 0.2) * 0.3)) };
      // the dome's eaves; the dome itself is painted on them
      if (up < TOWER.dome + 0.012) return { id: 'eaves', r: R * 0.35, paint: (t) => round(IRON[0], t, 0.9) };
      return null;
    };
    // the floors seen from above: the gallery on the stone, the upper gallery and the lantern's own, each a flat
    // round plate; what stands on it is painted over it
    const floor = (up: number, r: number, plate: Colour): void => {
      const my = foot - up * tall;
      for (let y = Math.floor(my - r * view.tilt); y <= my + r * view.tilt; y++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        if (((x + 0.5 - cx) / r) ** 2 + ((y + 0.5 - my) / (r * view.tilt)) ** 2 <= 1) c.put(x, y, lit(plate, hour.light, (x + y) % 5 === 0 ? 0.9 : 1), thing);
      }
    };
    const paintParts = (from: number, to: number): void => {
      for (let y = Math.round(foot - from * tall + R * view.tilt); y > foot - to * tall; y--) {
        for (let x = Math.floor(cx - R * 1.1); x <= cx + R * 1.1; x++) {
          // a round part's rim sags in the middle: the height of a pixel is measured from that curve, which depends
          // on the part's width: a pixel is a part's when the height that part's own rim gives lies in that part
          const dx = x + 0.5 - cx;
          const share = (r: number): number => (foot + r * view.tilt * Math.sqrt(Math.max(0, 1 - (dx / r) ** 2)) - y) / tall;
          let up = (foot - y) / tall, p = part(Math.max(0, up)), found = false;
          for (let n = 0; n < 4 && p && !found; n++) {
            up = share(Math.max(p.r, 1));
            const q = up < 0 ? null : part(up);
            found = q?.id === p.id;
            p = q;
          }
          if (!found || !p || up < from || up >= to || Math.abs(dx) > p.r) continue;
          c.put(x, y, p.paint(dx / p.r), thing);
        }
      }
    };
    // from the ground up, each floor before what stands on it; under the gallery's rim its shade
    floor(TOWER.stone, R * 0.86, BANK[1]);
    paintParts(0, TOWER.stone + 0.022);
    floor(TOWER.stone + 0.022, R * 0.86, STONE[1]);
    paintParts(TOWER.stone + 0.022, TOWER.upper + 0.016);
    floor(TOWER.upper + 0.016, R * 0.5, colour(0x5a5860));
    paintParts(TOWER.upper + 0.016, TOWER.glass);
    floor(TOWER.glass, R * 0.41, colour(0x5a5860));
    paintParts(TOWER.glass, TOWER.dome + 0.012);
    // the dome, round, rusty, on its eaves, and the capped vent on it
    const eaves = foot - (TOWER.dome + 0.012) * tall, wide = R * 0.33, top = Math.round(foot - tall);
    for (let x = Math.floor(cx - wide); x <= cx + wide; x++) {
      const dx = x + 0.5 - cx, bow = Math.sqrt(Math.max(0, 1 - (dx / wide) ** 2));
      for (let y = Math.round(eaves - (eaves - top) * bow); y <= eaves + wide * view.tilt * bow - 1; y++) c.put(x, y, round(IRON[0], dx / wide, y < eaves - (eaves - top) * bow * 0.5 ? 1.25 : 1.05), thing);
    }
    for (let v = 0; v < 4; v++) c.put(cx, top - v, lit(IRON[0], hour.light, 0.8), thing);
    for (const dx of [-1, 0, 1]) c.put(cx + dx, top - 4, lit(IRON[0], hour.light, 0.8), thing);
    // the rails: the front half of each ring, a top rail on thin posts, before whatever stands behind it
    const rail = (up: number, r: number, high: number): void => {
      for (let dx = -Math.round(r); dx <= Math.round(r); dx++) {
        const y = Math.round(foot + r * view.tilt * Math.sqrt(Math.max(0, 1 - (dx / r) ** 2)) - up * tall);
        c.put(cx + dx, y - high, lit(BANK[0], hour.light), thing);
        if ((dx + 60) % 3 === 0) for (let v = 1; v < high; v++) c.put(cx + dx, y - v, lit(BANK[1], hour.light), thing);
      }
    };
    rail(TOWER.stone + 0.022, R * 0.84, 3);
    rail(TOWER.upper + 0.016, R * 0.48, 2);
  }

  /**
   * The island's name, painted: letters drawn with a broad pen (thick down, thin across), gold from pale at the top to deep
   * at the foot with a lit and a shaded rim, a dark line round them and a shadow on the sea. The K's leg runs on under the
   * other letters as a swash where leaves and flowers grow, and the i's dot is a star: the lighthouse's lamp.
   */
  private title(c: Canvas, r: Rect): void {
    const { w } = this;
    const thing = c.soft();
    const unit = Math.min(r.w / NAME_SIZE.w, r.h / NAME_SIZE.h);
    const ox = r.x + (r.w - NAME_SIZE.w * unit) / 2 + unit * 0.1, oy = r.y + (r.h - NAME_SIZE.h * unit) / 2 + unit * 0.2;
    // a letter leans to the right: its top is further right than its foot
    const place = (x: number, y: number): Pt => ({ x: ox + (x + (1 - y) * 0.14) * unit, y: oy + y * unit });
    const runs = NAME_STROKES.map((stroke) => smoothRun(stroke).map(([x, y, half]) => ({ ...place(x, y), half: half * unit })));
    /** How far a pixel is outside the pen's stroke (below 0: inside it). */
    const outside = (x: number, y: number): number => {
      let best = 1e6;
      for (const run of runs) for (let i = 1; i < run.length; i++) {
        const p = run[i - 1]!, q = run[i]!;
        const dx = q.x - p.x, dy = q.y - p.y;
        const t = clamp01(((x - p.x) * dx + (y - p.y) * dy) / (dx * dx + dy * dy || 1));
        const d = Math.hypot(x - p.x - dx * t, y - p.y - dy * t) - (p.half + (q.half - p.half) * t);
        if (d < best) best = d;
      }
      return best;
    };
    const field = new Float32Array(r.w * r.h);
    for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) field[y * r.w + x] = outside(r.x + x + 0.5, r.y + y + 0.5);
    const at = (x: number, y: number): number => (x < 0 || y < 0 || x >= r.w || y >= r.h ? 1e6 : field[y * r.w + x]!);
    const light = this.paper();
    const LINE = 1.7;
    for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
      const d = at(x, y);
      const px = r.x + x, py = r.y + y;
      if (d <= 0) {
        const t = clamp01((py - oy) / unit);
        let ink = t < 0.5 ? mix(NAME_GOLD[0], NAME_GOLD[1], t * 2) : mix(NAME_GOLD[1], NAME_GOLD[2], (t - 0.5) * 2);
        // the pen's rim: lit toward the upper left, shaded toward the lower right
        const rim = at(x - 1, y - 1) - at(x + 1, y + 1);
        if (d > -1.8) ink = rim > 0.6 ? mix(ink, NAME_GOLD[0], 0.7) : rim < -0.6 ? mix(ink, NAME_GOLD[3], 0.6) : ink;
        c.put(px, py, lit(ink, light), thing);
      } else if (d <= LINE) c.put(px, py, lit(NAME_GOLD[4], light), thing);
      else if (at(x - 2, y - 3) <= LINE && c.thing[py * w + px] === 0) this.shadowed.add(py * w + px);
    }
    this.foliage(c, thing, runs[NAME_SWASH]!, unit, (x, y) => at(x - r.x, y - r.y) <= 0);
    this.star(c, thing, place(NAME_STAR[0], NAME_STAR[1]), unit * 0.15);
  }

  /** What grows on the name's swash: a leaf every few steps, on one side and then the other, and a flower on every third. */
  private foliage(c: Canvas, thing: number, swash: readonly Pt[], unit: number, letter: (x: number, y: number) => boolean): void {
    const { w } = this;
    const light = this.paper();
    const leaves: Pt[] = [];
    for (let i = 12, n = 0; i < swash.length - 5; i += 4, n++) {
      const p = swash[i]!, q = swash[i + 1]!;
      const along = Math.atan2(q.y - p.y, q.x - p.x);
      const side = n % 2 ? 1 : -1;
      const angle = along + side * (0.75 + 0.3 * hash2(n, 1, 87));
      const length = unit * (0.17 + 0.08 * hash2(n, 2, 88));
      const tip = { x: p.x + Math.cos(angle) * length, y: p.y + Math.sin(angle) * length };
      const wide = { x: -Math.sin(angle) * length * 0.34, y: Math.cos(angle) * length * 0.34 };
      const mid = { x: (p.x + tip.x) / 2, y: (p.y + tip.y) / 2 };
      fill([p, { x: mid.x + wide.x, y: mid.y + wide.y }, tip, { x: mid.x - wide.x, y: mid.y - wide.y }], this.w, this.h, (x, y) => {
        if (letter(x, y)) return;
        const upper = (x - p.x) * wide.x + (y - p.y) * wide.y < 0;
        c.put(x, y, lit(upper ? MEADOW[2] : MEADOW[1], light), thing);
        leaves.push({ x, y });
      });
      if (n % 3 === 1) for (const [dx, dy, petal] of [[0, 0, 1], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]] as const) {
        const fx = Math.round(tip.x) + dx, fy = Math.round(tip.y) + dy;
        c.put(fx, fy, lit(petal ? FLOWERS[1] : FLOWERS[n % 2 ? 0 : 2], light), thing);
        leaves.push({ x: fx, y: fy });
      }
    }
    // a dark line round the leaves and flowers
    for (const p of leaves) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const x = p.x + dx, y = p.y + dy;
      if (x >= 0 && y >= 0 && x < this.w && y < this.h && c.thing[y * w + x] === 0) c.put(x, y, lit(BUSH[0], light), thing);
    }
  }

  /** The star over the i: four long rays and four short ones round a bright middle, with a dark line round it. */
  private star(c: Canvas, thing: number, star: Pt, reach: number): void {
    const { w } = this;
    const light = this.paper();
    for (let dy = -Math.ceil(reach) - 2; dy <= reach + 2; dy++) for (let dx = -Math.ceil(reach) - 2; dx <= reach + 2; dx++) {
      const ax = Math.abs(dx), ay = Math.abs(dy);
      const ray = Math.min(ax, ay) * 3.2 + Math.max(ax, ay), diagonal = Math.abs(ax - ay) * 1.6 + (ax + ay) * 0.9;
      const d = Math.min(ray - reach, diagonal - reach * 0.75, Math.hypot(dx, dy) - reach * 0.42);
      const x = Math.round(star.x) + dx, y = Math.round(star.y) + dy;
      if (d <= 0) c.put(x, y, Math.hypot(dx, dy) < reach * 0.4 ? colour(0xfffbe0) : mix(LAMP, colour(0xffd24a), clamp01(Math.hypot(dx, dy) / reach)), thing);
      else if (d <= 1.3 && c.thing[y * w + x] !== thing) c.put(x, y, lit(NAME_GOLD[4], light), thing);
    }
  }

  /** The light on the name and the compass: they lie on the map, not on the island, so the hour only tints them. */
  private paper(): Colour {
    return mix(this.hour.light, [1, 1, 1], 0.78);
  }

  /** Sea pixels in the shadow of the name. */
  private readonly shadowed = new Set<number>();

  /** The compass rose: four long points and four short ones, each half light and half dark, the north point red. */
  private compass(c: Canvas, r: Rect): void {
    const thing = c.next();
    const cx = r.x + r.w / 2, cy = r.y + r.h * 0.56;
    const reach = r.w * 0.46;
    const light = this.paper();
    const point = (angle: number, length: number, width: number, pale: Colour, dark: Colour): void => {
      const tip = { x: cx + Math.sin(angle) * length, y: cy - Math.cos(angle) * length };
      const side = (s: number): Pt => ({ x: cx + Math.sin(angle + s * Math.PI / 2) * width, y: cy - Math.cos(angle + s * Math.PI / 2) * width });
      c.poly([{ x: cx, y: cy }, side(-1), tip], lit(pale, light), thing);
      c.poly([{ x: cx, y: cy }, side(1), tip], lit(dark, light), thing);
    };
    // the island is turned on the map, and north with it: the red point shows where north is
    const north = (-this.plan.map.north * Math.PI) / 180;
    for (let i = 0; i < 4; i++) point(north + Math.PI / 4 + (i * Math.PI) / 2, reach * 0.5, reach * 0.16, PARCHMENT[1], PARCHMENT[0]);
    point(north + Math.PI / 2, reach, reach * 0.2, PARCHMENT[2], PARCHMENT[0]);
    point(north - Math.PI / 2, reach, reach * 0.2, PARCHMENT[2], PARCHMENT[0]);
    point(north + Math.PI, reach * 1.05, reach * 0.2, PARCHMENT[2], PARCHMENT[0]);
    point(north, reach * 1.4, reach * 0.22, IRON[2], IRON[1]);
    fill(Array.from({ length: 12 }, (_, i) => ({ x: cx + Math.cos((i * Math.PI) / 6) * 3.4, y: cy + Math.sin((i * Math.PI) / 6) * 3.4 })), this.w, this.h, (x, y) => c.put(x, y, lit(colour(0xffd24a), light), thing));
  }

  /**
   * The sea at a pixel, as on the 1991 maps: one deep blue with soft darker and lighter patches far out, a pale halo of
   * shallows round the coast laid in flat bands, and thin darker ripple lines that follow the coast a few pixels out, in
   * broken pieces. No line of white surf. The two looks differ in where the ripples and the bands' edges lie.
   */
  private sea(x: number, y: number, frame: number): Colour {
    const { hour, w } = this;
    const i = y * w + x;
    const [deep] = hour.sea;
    const d = this.toLand[i]! + 9 * (noise2(x / 23, y / 15, 5 + frame) - 0.5) + 5 * (noise2(x / 7, y / 6, 6) - 0.5);
    // far out: three flat tones in broad patches
    const far = fbm(x / 90, y / 48, 3, 51);
    let t = far > 0.6 ? 0.3 : far > 0.4 ? 0.2 : 0.1;
    const sand = this.sandDepth(x, y);
    if (sand > 0) return this.sandColour(x, y, sand);
    if (this.toLand[i]! > 30 && sand < -12) t = this.wave(x, y, frame, t);
    // the sea creature whose back the strip is: a flank and two fins one band darker than the water, no more
    if (this.beast(x, y, sand)) t = Math.max(0.02, t - 0.1);
    if (d < 5) t = 0.94; else if (d < 10) t = 0.8; else if (d < 17) t = 0.66; else if (d < 27) t = 0.52; else if (d < 40) t = Math.max(t, 0.4);
    // the ripple lines, darker than the water they lie on
    for (const [at, gate] of [[8, 0.44], [14, 0.52], [21, 0.6]] as const) {
      const line = at + 2.2 * Math.sin(x / 9 + y / 6 + frame * 1.6);
      if (Math.abs(this.toLand[i]! - line) < 0.75 && noise2(x / 26 + frame * 0.7, y / 14, 7 + at) > gate) t = Math.min(t, 0.5) - 0.2;
    }
    let c = this.seaTone(Math.max(0, t));
    // the low sun lays its colour on the water toward its side
    if (hour.glow.side !== 0) {
      const toward = clamp01(hour.glow.side > 0 ? (x - w * 0.35) / (w * 0.65) : (w * 0.65 - x) / (w * 0.65));
      const band = Math.round(toward * toward * 4 + (noise2(x / 40, y / 6, 52) - 0.5)) / 4;
      c = mix(c, hour.glow.tint, clamp01(band) * 0.45);
    }
    if (this.shadowed.has(i)) c = lit(c, [1, 1, 1], 0.6);
    // the picture's rim sinks into deep water
    return this.rim(x, y) ? deep : c;
  }

  /**
   * How deep a pixel lies inside the sand strip, in pixels from its edge (above 0), or how far outside it (below 0).
   * The strip's edge wanders a little, as sand does.
   */
  private sandDepth(x: number, y: number): number {
    const { spine } = this.plan.sand;
    let best = -Infinity;
    for (let n = 1; n < spine.length; n++) {
      const a = spine[n - 1]!, b = spine[n]!;
      const ex = b.x - a.x, ey = b.y - a.y;
      const u = clamp01(((x - a.x) * ex + (y - a.y) * ey) / (ex * ex + ey * ey));
      const depth = a.half + (b.half - a.half) * u - Math.hypot(x - a.x - ex * u, y - a.y - ey * u);
      if (depth > best) best = depth;
    }
    return best + 2.4 * (noise2(x / 9, y / 7, 71) - 0.5);
  }

  /** The sea's colour at `t`: 0 the deep, 1 the palest shallows. */
  private seaTone(t: number): Colour {
    const [deep, mid, shallow, foam] = this.hour.sea;
    return t < 0.36 ? mix(deep, mid, t / 0.36) : t < 0.72 ? mix(mid, shallow, (t - 0.36) / 0.36) : mix(shallow, foam, (t - 0.72) / 0.28);
  }

  /**
   * The sand strip under the water: seen through the sea, so no colour of the land. By day the
   * water over it turns from the sea's blue through green to a pale sand where it nearly breaks the surface; at the
   * other hours it is the sea's own paler tones. A thin broken pale line lies where the sea breaks on it.
   */
  private sandColour(x: number, y: number, depth: number): Colour {
    const { hour } = this;
    const bands = hour.shoal ?? [0.5, 0.58, 0.66, 0.74, 0.82].map((t) => this.seaTone(t));
    const head = this.plan.sand.spine[this.plan.sand.spine.length - 1]!;
    // its eye, for whoever looks long enough: two dark pixels and a glint in the strip's broad end
    const ex = Math.round(head.x - 5), ey = Math.round(head.y - 2);
    if (y === ey && (x === ex || x === ex + 1)) return hour.shoal ? lit(BANK[0], hour.light) : this.seaTone(0);
    if (y === ey - 1 && x === ex + 1) return this.seaTone(0.96);
    if (Math.abs(depth - this.crestAt(x, y)) < 0.7 && noise2(x / 6, y / 5, 73) > 0.5) return this.seaTone(0.97);
    // flat bands, deeper water at the edge
    if (depth < 2) return bands[0]!;
    if (depth < 4.5) return bands[1]!;
    if (depth < 7.5) return bands[2]!;
    return noise2(x / 11, y / 8, 74) > 0.6 ? bands[4]! : bands[3]!;
  }

  /** How deep in the strip its pale crest runs at a pixel: a wandering line a few pixels in from one edge. */
  private crestAt(x: number, y: number): number {
    return 3.2 + 2.2 * noise2(x / 15, y / 12, 72);
  }

  /** Whether a pixel of the sea lies on the creature's flank or on one of its two fins. */
  private beast(x: number, y: number, sand: number): boolean {
    if (sand > -(4 + 3 * noise2(x / 13, y / 9, 75)) && sand <= 0) return true;
    if (sand < -26) return false;
    const { spine } = this.plan.sand;
    for (const n of [3, 5]) {
      const at = spine[n]!, before = spine[n - 1]!;
      const long = Math.hypot(at.x - before.x, at.y - before.y), ux = (at.x - before.x) / long, uy = (at.y - before.y) / long;
      // a fin lies out from the back, swept toward the tail
      const side = n === 3 ? 1 : -1, cx = at.x - uy * side * (at.half + 7) - ux * 5, cy = at.y + ux * side * (at.half + 7) - uy * 5;
      const a = (x - cx) * ux + (y - cy) * uy, b = -(x - cx) * uy + (y - cy) * ux;
      if ((a / 5) ** 2 + (b / 9) ** 2 < 1) return true;
    }
    return false;
  }

  /**
   * The open sea's waves, as the 1991 maps mark them: here and there a small pale stroke of two or three humps with a
   * darker one under it, no two the same length, lying elsewhere in the sea's second look. The sea's tone at a pixel,
   * `t` where no wave lies.
   */
  private wave(x: number, y: number, frame: number, t: number): number {
    const CW = 52, CH = 20;
    const gx = Math.floor(x / CW), gy = Math.floor(y / CH);
    if (hash2(gx, gy, 76) < 0.58) return t;
    const humps = 2 + Math.floor(hash2(gx, gy, 79) * 2), hump = 5 + Math.floor(hash2(gx, gy, 80) * 3);
    const cx = gx * CW + 4 + hash2(gx, gy, 77) * (CW - humps * hump - 8) + frame * 2, cy = gy * CH + 5 + hash2(gx, gy, 78) * (CH - 9);
    const u = x - cx;
    if (u < 0 || u > humps * hump) return t;
    const off = y - (cy - 2 * Math.abs(Math.sin((u * Math.PI) / hump)));
    if (Math.abs(off) < 0.6) return 0.78;
    return off >= 0.6 && off < 1.7 ? Math.max(0.02, t - 0.12) : t;
  }

  /** Whether a pixel lies on the picture's rim, which is one flat deep blue: a larger window goes on in that colour. */
  private rim(x: number, y: number): boolean {
    const { w, h } = this;
    return Math.max(Math.abs(x - w / 2) / (w / 2), Math.abs(y - h / 2) / (h / 2)) + 0.07 * (noise2(x / 17, y / 11, 58) - 0.5) > 0.965;
  }

  /**
   * The whole picture for one look of the sea (0 or 1): brought down to the palette with no dither, then the grain of
   * scanned paint is laid over the ground and the sea (`paint/grain.ts`); what stands on the ground keeps its clean tones.
   */
  frame(frame: number): Bitmap {
    const { w, h, land } = this;
    const out = createBitmap(w, h);
    const water = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (this.kind[i] === Kind.Sea && land.thing[i] === 0) {
        const c = this.sea(x, y, frame);
        // by day the sand under the water has its own shades, with the land's; the water has its hour's own
        const sand = this.hour.shoal !== undefined && this.sandDepth(x, y) > 0 && !this.rim(x, y);
        out.pixels[i] = (sand ? this.reducer : this.seaReducer).pixel(c[0], c[1], c[2], x, y, DITHER);
        water[i] = sand ? 0 : 1;
      } else {
        out.pixels[i] = this.reducer.pixel(land.rgb[i * 3]!, land.rgb[i * 3 + 1]!, land.rgb[i * 3 + 2]!, x, y, DITHER);
      }
    }
    const runs = mapRuns();
    const sea = [runs.seaDay!, runs.seaNight!, runs.seaTwilight!].map((run) => ({ run, dash: 2 }));
    // the land's grain is the same in both looks; the sea's dashes are longer and lie along the swell
    grain(out.pixels, w, [runs.grass!, runs.stone!, runs.parchment!, runs.moon!], { seed: 7, strength: GRAIN, keep: (i) => water[i] === 1 || land.thing[i] !== 0 });
    grain(out.pixels, w, sea, { seed: 11 + frame, strength: GRAIN * 0.7, keep: (i) => water[i] === 0 || this.rim(i % w, Math.floor(i / w)) });
    return out;
  }

  /**
   * The lamp's light, drawn by the game as it runs (`beam.ts`): from dusk to dawn a beam that turns, a wedge of pale dots
   * thinning with the distance; by day only a glint on the lantern's glass. Here its box, the lamp and its colours.
   */
  beam(): MapBeam {
    const at = this.lamp();
    const { middle } = this.plan;
    // inside the part of the picture every screen shows: the tower stands high in it
    const x0 = Math.max(middle.x, at.x - 140), y0 = Math.max(middle.y, at.y - 90);
    const x1 = Math.min(middle.x + middle.w, at.x + 140), y1 = Math.min(middle.y + middle.h, at.y + 90);
    return {
      x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0), lamp: at, tilt: this.plan.view.tilt, lit: this.hour.lit,
      pale: this.reducer.nearest(255, 240, 160), white: this.reducer.nearest(255, 251, 224),
    };
  }

  /** A cloud (`curlCloud`) in the hour's colours. The map's clouds drift east, so its head leads on the right. */
  cloud(spec: CurlSpec): Bitmap {
    const [pale, shade] = this.hour.cloud;
    const tones = [pale, mix(pale, shade, 0.2), mix(pale, shade, 0.6), shade].map((c) => this.reducer.pixel(c[0], c[1], c[2], 0, 0, 0));
    return tintedCloud(spec, false, tones);
  }
}

/** The map's three clouds: each one stroke that rolls up into a head, as all of Keri's clouds are, and no two alike (d111). */
export const MAP_CLOUDS: readonly CurlSpec[] = [
  { length: 70, girth: 30, belly: 0.8, neck: 0.9, taper: 1.3, bend: 9, wave: 0.7, phase: 0, rise: 8, head: { size: 21, turns: 1.25 }, curls: [{ at: 0.58, size: 18, turns: 1.15 }, { at: 0.22, size: 11, turns: 1.1 }] },
  { length: 96, girth: 12, belly: 0.9, neck: 1, taper: 1.2, bend: 5, wave: 1, phase: 1.2, head: { size: 13, turns: 1.25, down: true } },
  { length: 166, girth: 14, belly: 0.6, neck: 0.85, taper: 0.8, bend: 7, wave: 1.4, phase: 0.6, head: { size: 14, turns: 1.35 }, curls: [{ at: 0.4, size: 10, turns: 1.2 }] },
];

export interface MapPicture {
  palette: readonly number[];
  /** The whole map with the sea in its two looks. */
  frames: Bitmap[];
  /** The lamp's light: what the game needs to draw it turning (`beam.ts`). */
  beam: MapBeam;
  /** The clouds that drift over the map, each one picture. */
  clouds: Bitmap[];
}

/** Paints the map as planned, for one hour of the sky: the island the plan draws (`plan.map`, the caricature of the measured one). */
export function paintMap(plan: KeriMapPlan, phase: SkyPhase): MapPicture {
  const p = new MapPainter(plan.map.world, plan, phase);
  return { palette: p.palette, frames: [p.frame(0), p.frame(1)], beam: p.beam(), clouds: MAP_CLOUDS.map((spec) => p.cloud(spec)) };
}

