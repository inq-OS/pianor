import { clamp01, smoothstep as smooth } from '../../paint/ease';
import { fbm, hash2, noise2 } from '../../paint/noise';
import { runOf, type KitBrush, type KitFill, type KitGround, type KitItem } from './kit';
import { beside, grain, lump, part, stroke } from './shape';

/**
 * Grass: the family's types. The model is the knoll (picked for grass, bushes and foliage); every
 * type here is that scene's painter, lifted pixel for pixel. A slope of grass is painted as fills, back to front: its
 * turf with the swells (`swells`), gravel and moss on it, the blades over it all, the flowers last; then the scene
 * places clumps (`clump`) row by row toward the viewer. The recipe in words: `projects/painter/artists-notes/grass.md`.
 */

const MODEL = 'the knoll (knollPicture.ts); picked for grass, bushes and foliage';
const ATLAS = 'grass, meadow, plants';

/** How much lighter a swell's top is than the slope's body, and how much darker the hollow behind it (shares of the greens' run). */
const SWELL = { top: 0.26, hollow: 0.3 } as const;
/** A blade is this long at the slope's top edge, and longer by this much for each row down it. */
const BLADE = { far: 1.6, grow: 0.036 } as const;
/** How short the grass is `v` rows below the top edge: low meadow over most of a slope, longer only nearest the viewer. */
export const meadow = (v: number): number => 0.42 + 0.58 * smooth(78, 126, v);

/** What the grass is like at a pixel: how light, how wild (0 kept short, 1 open) and how dry. */
interface Tuft {
  light: number;
  open: number;
  dry: number;
}

/**
 * A slope as the grass sees it, worked out once for a scene's ground: where its swells lie (low mounds one before
 * another down the slope, each with a pale top and the ground behind it dipping into shade, so a light edge lies over
 * a dark one), and from that the grass's light at every pixel.
 */
class Slope {
  /** The swells' top edges in each column, far to near: the row and how strong the edge is there (0 to 1). */
  private readonly edges: { y: number; strong: number }[][];
  private readonly green: readonly number[];
  private readonly gold: readonly number[];
  private readonly lawn: readonly number[];

  constructor(private readonly ground: KitGround, b: KitBrush) {
    const run = runOf(b.run, 'grass', 'grass'), fine = runOf(b.fine, 'grass', 'grass');
    const dry = runOf(b.run, 'dry', 'grass'), dryFine = runOf(b.fine, 'dry', 'grass');
    // the slope's body: the greens from the darkest to the fourth named tone, and the golds of dry grass beside them;
    // the grass kept short is the light end of the run
    this.green = part(fine, run[0]!, run[3]!);
    this.gold = part(dryFine, dry[0]!, dry[2]!);
    this.lawn = part(fine, run[2]!, run[4]!);
    this.edges = this.swellEdges();
  }

  /** The swells: a few in each of the rows down the slope, small by the top and broad toward the viewer; none where the grass is kept short. */
  private swellEdges(): { y: number; strong: number }[][] {
    const { width: w, height: h } = this.ground;
    const swells: { x: number; half: number; v: number; rise: number; seed: number }[] = [];
    for (let k = 0, v = 12; v < h; k++, v += 12 + k * 6) {
      let x = -140 * hash2(k, 1, 151);
      for (let n = 0; x < w + 80; n++) {
        const half = (64 + k * 24) * (0.7 + 0.6 * hash2(k, n, 152));
        if (hash2(k, n, 153) < 0.82) swells.push({ x: x + half, half, v: v + (hash2(k, n, 154) - 0.5) * (7 + k * 3), rise: (2.5 + k * 1.4) * (0.7 + 0.6 * hash2(k, n, 155)), seed: k * 31 + n });
        x += half * (1.3 + 0.9 * hash2(k, n, 156));
      }
    }
    return Array.from({ length: w }, (_, x) => {
      const edges = swells.flatMap((s) => {
        const u = (x - s.x) / s.half;
        if (Math.abs(u) >= 1) return [];
        const y = this.ground.row(x, s.v) - s.rise * (1 - u * u) + (noise2(x / 13, s.seed * 0.37, 157) - 0.5) * 2.4;
        const strong = Math.min(1, (1 - u * u) * 1.8) * smooth(1.05, 1.5, this.ground.short(x, y));
        return strong > 0.02 && y > this.ground.edge(x) + 6 ? [{ y, strong }] : [];
      });
      return edges.sort((a, b) => a.y - b.y);
    });
  }

  /** What the swells add to the light at a pixel: light just under a swell's top edge, dark just above the next one's. */
  private relief(x: number, y: number): number {
    const edges = this.edges[Math.max(0, Math.min(this.ground.width - 1, Math.round(x)))]!;
    let above: { y: number; strong: number } | undefined, below: { y: number; strong: number } | undefined;
    for (const e of edges) {
      if (e.y <= y) above = e;
      else { below = e; break; }
    }
    const reach = 3 + this.ground.down(x, y) * 0.07;
    return (above ? above.strong * SWELL.top * Math.exp(-(y - above.y) / (reach * 1.8)) : 0) - (below ? below.strong * SWELL.hollow * Math.exp(-(below.y - y) / reach) : 0);
  }

  /** How dry the grass at a pixel is (0 green, 1 gold): gold lies in patches along the slope, where the light is on it. */
  dryness(x: number, y: number, light: number): number {
    return smooth(0.44, 0.66, fbm(x / 150 + 3, this.ground.down(x, y) / 6, 2, 111)) * smooth(0.2, 0.42, light);
  }

  /** The grass at a pixel: how light it is with the swells in it, how short it is kept and how dry it is. */
  tuft(x: number, y: number): Tuft {
    const v = y - this.ground.edge(x);
    const open = smooth(0.72, 1.55, this.ground.short(x, y));
    // the top edge catches the light; the lawn is one light green that the feet keep even
    const body = this.ground.light(x, y) + this.relief(x, y) + 0.3 * Math.exp(-Math.max(0, v) / 2.5);
    const light = clamp01(body * open + (0.5 + (fbm(x / 26, y / 5, 2, 116) - 0.5) * 0.7) * (1 - open));
    return { light, open, dry: this.dryness(x, y, light) * open };
  }

  /** The colour of the grass for a tuft and a tone some places up or down its run: the lawn's greens, the slope's, or dry gold. */
  colour(tuft: Tuft, gold: boolean, places: number, x: number, y: number, spread: number, seed: number): number {
    if (gold) return beside(this.gold, clamp01(tuft.light * 1.15), places);
    const run = tuft.open < 0.5 ? this.lawn : this.green;
    return run[Math.max(0, Math.min(run.length - 1, Math.round(tuft.light * (run.length - 1) + (grain(x, y, seed) - 0.5) * spread) + places))]!;
  }
}

const slopes = new WeakMap<KitGround, Slope>();
/** The slope of a scene's ground, worked out once however many fills ask. */
function slopeOf(ground: KitGround, b: KitBrush): Slope {
  let slope = slopes.get(ground);
  if (!slope) slopes.set(ground, (slope = new Slope(ground, b)));
  return slope;
}

/** How dry the grass is at a pixel of a scene's ground, for its own light: where a scene places dry clumps among green ones. */
export function grassDryness(b: KitBrush, ground: KitGround, x: number, y: number, light: number): number {
  return slopeOf(ground, b).dryness(x, y, light);
}

/**
 * A plain slope `width` by `height` for the sheet and the tests: its top edge a little way down, falling gently to the
 * right, darker toward the viewer, with a trodden oval in its middle and the grass kept short round it.
 */
export function slopePatch(width: number, height: number): KitGround {
  const covered = new Uint8Array(width * height);
  const inside = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < width && y < height;
  const edge = (x: number): number => 6 + x * 0.02;
  const trodden = (x: number, y: number): number => Math.hypot((x - width * 0.5) / (width * 0.16), (y - height * 0.5) / (height * 0.12));
  return {
    width,
    height,
    edge,
    down: (x, y) => y - edge(x),
    row: (x, v) => edge(x) + v,
    light: (x, y) => clamp01(0.86 - (y - edge(x)) / 150 + (fbm(x / 70, y / 34, 2, 112) - 0.5) * 0.3),
    trodden,
    short: (x, y) => trodden(x, y) * 0.9 + 0.2,
    free: (x, y) => trodden(x, y) >= 1.25,
    bare: (x, y) => inside(x, y) && covered[y * width + x] === 1,
    cover: (x, y) => { if (inside(x, y)) covered[y * width + x] = 1; },
  };
}

export interface SwellsOptions {
  /** How far the turf's tone is scattered over its run: the grain of scanned paint. */
  spread: number;
}

/**
 * The turf of a slope: its body in the greens, dark toward the viewer, with the swells' light tops and dark hollows
 * in it, and bare earth where it is trodden. What the blades stand on.
 */
export const swells: KitFill<SwellsOptions> = {
  id: 'grass/swells',
  family: 'grass',
  about: 'the turf of a slope: its body with low swells, a light top over a dark hollow, and trodden earth',
  state: 'picked',
  model: MODEL,
  note: 'grass.md',
  atlas: ATLAS,
  uses: ['grass', 'dry', 'earth', 'shingle'],
  options: { spread: 1.8 },
  variants: { meadow: {}, smooth: { spread: 0.8 } },
  sample: (_o, width, height) => slopePatch(width, height),
  paint(b, ground, o, seed) {
    const slope = slopeOf(ground, b), earth = runOf(b.run, 'earth', swells.id), shingle = runOf(b.run, 'shingle', swells.id);
    for (let x = 0; x < ground.width; x++) for (let y = Math.max(0, Math.floor(ground.edge(x))); y < ground.height; y++) {
      if (ground.trodden(x, y) < 1 && y - ground.edge(x) > 2) {
        const blot = fbm(x / 9, y / 4, 2, 114 + seed);
        let c = blot < 0.36 ? earth[1]! : blot > 0.68 ? earth[3]! : earth[2]!;
        if (hash2(x >> 1, y, 115 + seed) > 0.985) c = shingle[1]!;
        b.put(x, y, c);
      } else b.put(x, y, slope.colour(slope.tuft(x, y), false, 0, x, y, o.spread, seed));
    }
  },
};

export interface GravelOptions {
  /** How thick the pebbles lie in a patch: 1 as on the knoll. */
  thick: number;
}

/** Patches of loose small pebbles in the turf (the reference photographs of the knoll): grains of the shingle's tones, thick in the middle of a patch. */
export const gravel: KitFill<GravelOptions> = {
  id: 'grass/gravel',
  family: 'grass',
  about: 'loose small pebbles in patches in the turf, thick in the middle of a patch',
  state: 'picked',
  model: MODEL,
  note: 'grass.md',
  atlas: 'gravel, path, stones',
  uses: ['shingle', 'near'],
  options: { thick: 1 },
  variants: { patches: {}, thick: { thick: 1.8 } },
  sample: (_o, width, height) => slopePatch(width, height),
  paint(b, ground, o, seed) {
    const shingle = runOf(b.run, 'shingle', gravel.id), near = runOf(b.run, 'near', gravel.id);
    for (let y = 0; y < ground.height; y++) for (let x = 0; x < ground.width; x++) {
      const v = y - ground.edge(x);
      if (v < 4 || !ground.free(x, y)) continue;
      const patch = fbm(x / 34, y / 11, 2, 270 + seed);
      if (patch < 0.6 || hash2(x, y, 271 + seed) > (patch - 0.6) * 3.2 * o.thick) continue;
      const k = hash2(x, y, 272 + seed);
      b.put(x, y, k > 0.66 ? shingle[3]! : k > 0.33 ? shingle[2]! : shingle[1]!);
      if (v > 50 && hash2(x, y, 273 + seed) > 0.5) b.put(x, y + 1, near[0]!);
    }
  },
};

export interface MossOptions {
  /** How big the cushions are: 1 as on the knoll. */
  size: number;
}

/** Moss in soft cushions among the grass, in patches over the slope: dark under each, its top a pale yellow-green. */
export const moss: KitFill<MossOptions> = {
  id: 'grass/moss',
  family: 'grass',
  about: 'soft moss cushions in patches, dark under, a pale yellow-green top; covers the turf it lies on',
  state: 'picked',
  model: MODEL,
  note: 'grass.md',
  atlas: 'moss, grass, stones',
  uses: ['near', 'grass', 'far'],
  options: { size: 1 },
  variants: { cushions: {}, big: { size: 1.6 } },
  sample: (_o, width, height) => slopePatch(width, height),
  paint(b, ground, o, seed) {
    const near = runOf(b.run, 'near', moss.id), grass = runOf(b.run, 'grass', moss.id), far = runOf(b.run, 'far', moss.id);
    const tones = [near[1]!, grass[2]!, grass[4]!, grass[5]!, far[3]!];
    const { width: w, height: h } = ground, side = b.side;
    for (let gy = 0; gy < h; gy += 4) for (let gx = -4; gx < w; gx += 7) {
      const x = gx + Math.floor(hash2(gx, gy, 230 + seed) * 7), cx = Math.max(0, Math.min(w - 1, x)), y = gy + Math.floor(hash2(gx, gy, 231 + seed) * 4);
      const v = y - ground.edge(cx);
      if (v < 4 || fbm(x / 46, y / 15, 2, 232 + seed) < 0.52 || hash2(gx, gy, 233 + seed) > 0.55 || !ground.free(x, y)) continue;
      const rx = (2.2 + v * 0.05) * (0.7 + 0.7 * hash2(gx, gy, 234 + seed)) * o.size, ry = rx * 0.55, at = gx * 7 + gy * 3;
      for (let py = Math.floor(y - ry * 1.3); py <= Math.ceil(y + ry * 1.3); py++) for (let px = Math.floor(x - rx * 1.3); px <= Math.ceil(x + rx * 1.3); px++) {
        const e = lump(px, py, x, y, rx, ry, at);
        if (e < 0 || (ground.bare(px, py) && hash2(px, py, 236) < 0.9)) continue;
        const nx = (px - x) / rx, ny = (py - y) / ry;
        const t = clamp01(0.58 - ny * 0.42 + nx * side * 0.18 + (hash2(px >> 1, py, 235) - 0.5) * 0.4) * (0.55 + 0.45 * ground.light(px, py) / 0.8);
        b.put(px, py, tones[Math.max(0, Math.min(tones.length - 1, Math.round(t * (tones.length - 1))))]!);
        if (hash2(px, py, 237) < 0.75) ground.cover(px, py);
      }
    }
  },
};

export interface BladesOptions {
  /** How long the blades are: 1 as on the knoll (short meadow, longer toward the viewer). */
  long: number;
  /** How many of them are dry gold: 1 as on the knoll. */
  dry: number;
}

/**
 * The blades of a slope's grass, far to near, so each row stands before the one behind it and the top edge and every
 * swell get a ragged edge: one short blade beside the other, each a few places up or down the run from the ground it
 * stands on, longer toward the viewer and shortest where the grass is kept short; dry ones mixed in, and at the rim of
 * trodden earth a few dry blades lean in over it.
 */
export const blades: KitFill<BladesOptions> = {
  id: 'grass/blades',
  family: 'grass',
  about: 'the blades over a slope, far to near: short meadow, longer toward the viewer, dry gold mixed in',
  state: 'picked',
  model: MODEL,
  note: 'grass.md',
  atlas: ATLAS,
  uses: ['grass', 'dry'],
  options: { long: 1, dry: 1 },
  variants: { meadow: {}, tall: { long: 2.2 }, dry: { dry: 2.5 } },
  sample: (_o, width, height) => slopePatch(width, height),
  paint(b, ground, o, seed) {
    const slope = slopeOf(ground, b);
    const { width: w, height: h } = ground;
    for (let y = 0; y < h + 14; y++) for (let x = -4; x < w + 6; x++) {
      const v = y - ground.edge(x);
      if (v < 0 || hash2(x, y, 161 + seed) > 0.62) continue;
      if (y < h && ground.bare(Math.round(x), y) && hash2(x, y, 169 + seed) > 0.06) continue;
      const trodden = ground.trodden(x, y);
      // on the trodden earth nothing grows; at its rim a few dry blades lean in over it
      if (trodden < 0.97) continue;
      const rim = trodden < 1.12;
      if (rim && hash2(x, y, 162 + seed) > 0.5) continue;
      const tuft = slope.tuft(x, y);
      // dry blades are mixed into the green everywhere, and most of the blades where the grass is dry
      const trampled = Math.max((1 - tuft.open) * 0.34 * smooth(0.5, 0.72, fbm(x / 16, y / 6, 2, 193 + seed)), 0.6 * smooth(2.2, 1, trodden));
      const gold = rim ? hash2(x, y, 163 + seed) < 0.7 : hash2(x, y, 163 + seed) < (0.16 + tuft.dry * 0.8) * o.dry * tuft.open + trampled;
      const long = (BLADE.far + v * BLADE.grow) * (0.45 + 1.1 * hash2(x, y, 164 + seed)) * (0.3 + 0.7 * tuft.open) * meadow(v) * o.long + (rim ? 1.5 : 0);
      // most blades are near the ground's tone, a few well lighter or darker: the sum of two throws
      const places = Math.round((hash2(x, y, 165 + seed) + hash2(x, y, 166 + seed) - 1) * 2.6);
      const lean = -0.18 - 0.3 * noise2(x / 60, y / 30, 167);
      for (let i = 0; i <= long; i++) {
        const up = i > long * 0.62 ? 1 : i < long * 0.22 && long > 3 ? -1 : 0;
        b.put(x + Math.round(lean * i), y - i, slope.colour(tuft, gold, places + up, x, y, 0, seed));
      }
    }
  },
};

export interface BloomsOptions {
  /** How many flower heads: 1 as on the knoll. */
  share: number;
}

/** The low meadow plants in flower: small white and yellow heads in loose patches, none on the trodden place or right by the viewer. */
export const blooms: KitFill<BloomsOptions> = {
  id: 'grass/blooms',
  family: 'grass',
  about: 'small white and yellow flower heads of low meadow plants, in loose patches, bigger toward the viewer',
  state: 'picked',
  model: MODEL,
  note: 'grass.md',
  atlas: 'flowers, meadow, plants',
  uses: ['bloom', 'grass'],
  options: { share: 1 },
  variants: { meadow: {}, rich: { share: 2.5 } },
  sample: (_o, width, height) => slopePatch(width, height),
  paint(b, ground, o, seed) {
    const bloom = runOf(b.run, 'bloom', blooms.id), grass = runOf(b.run, 'grass', blooms.id);
    for (let gy = 0; gy < ground.height - 40; gy += 3) for (let gx = 0; gx < ground.width; gx += 5) {
      const x = gx + Math.floor(hash2(gx, gy, 240 + seed) * 5), y = gy + Math.floor(hash2(gx, gy, 241 + seed) * 3);
      const v = y - ground.edge(x);
      if (v < 6 || fbm(x / 30, y / 10, 2, 242 + seed) < 0.58 || hash2(gx, gy, 243 + seed) > 0.3 * o.share || !ground.free(x, y)) continue;
      const c = hash2(gx, gy, 244 + seed) > 0.55 ? bloom[0]! : bloom[1]!;
      b.put(x, y, c);
      if (v > 40) b.put(x + 1, y, c);
      if (v > 70) { b.put(x, y - 1, c); b.put(x + 1, y + 1, grass[1]!); }
    }
  },
};

/** A clump's look by how far it stands: 0 the far meadow's pale ones, 1 the slope's, 2 the dark ones nearest the viewer. */
export type ClumpDepth = 0 | 1 | 2;

export interface ClumpOptions {
  /** How high it stands, in fine pixels. */
  tall: number;
  /** Dry gold, with seed heads, or green with now and then a flower. */
  dry: boolean;
  depth: ClumpDepth;
}

/**
 * A clump of grass: blades that fan out of the grass round them and bend with the wind, dark low down and light at
 * their tops, a line of shade at its foot (never a block); a seed head on some dry blades, a white flower now and then.
 */
export const clump: KitItem<ClumpOptions> = {
  id: 'grass/clump',
  family: 'grass',
  about: 'a clump of blades fanning out and bending with the wind: pale far off, green, or dark near the viewer',
  state: 'picked',
  model: MODEL,
  note: 'grass.md',
  atlas: ATLAS,
  uses: ['grass', 'dry', 'far', 'near', 'bloom'],
  options: { tall: 14, dry: false, depth: 1 },
  variants: {
    middle: {},
    short: { tall: 5 },
    far: { tall: 6, depth: 0 },
    dry: { tall: 18, dry: true },
    near: { tall: 44, depth: 2 },
  },
  box: (o) => ({ left: Math.ceil(o.tall * 1.5 + 4), right: Math.ceil(o.tall * 1.5 + 4), up: Math.ceil(o.tall + 3), down: 1 }),
  ground: () => 'grass',
  paint(b, x, y, o, seed) {
    const { tall, dry, depth } = o;
    const g = runOf(b.run, 'grass', clump.id), d = runOf(b.run, 'dry', clump.id), far = runOf(b.run, 'far', clump.id), near = runOf(b.run, 'near', clump.id);
    const bloom = runOf(b.run, 'bloom', clump.id);
    const run = dry ? [d[0]!, d[1]!, d[1]!, d[2]!, d[3]!] : depth === 2 ? [near[0]!, near[1]!, g[1]!, g[2]!, g[4]!] : depth === 0 ? [far[0]!, far[0]!, far[1]!, far[2]!, far[3]!] : [g[0]!, g[1]!, g[2]!, g[3]!, g[5]!];
    const wide = Math.max(2, tall * 0.42);
    const put = (px: number, py: number, c: number): void => b.put(px, py, c);
    // its foot is a line of shade in the grass it stands in, never a block
    if (depth > 0 && tall > 9) for (let dx = -Math.round(wide / 2); dx <= Math.round(wide / 2); dx++) if (hash2(seed, dx, 129) < 0.7) put(x + dx, y + 1, depth === 2 ? near[0]! : g[0]!);
    const count = tall > 26 ? 7 : tall > 11 ? 5 : 3;
    const bend = (b.lean?.(x, y) ?? 0) * (0.5 + noise2(x / 90, y / 40, 124));
    for (let k = 0; k < count; k++) {
      const u = (k + 0.5) / count - 0.5;
      const high = tall * (0.6 + 0.4 * hash2(seed, k, 125));
      const bx = x + u * wide;
      const tip: [number, number] = [bx + u * tall * 0.6 + bend * high * (0.7 + 0.6 * hash2(seed, k, 126)), y - high];
      const dark = hash2(seed, k, 127) > 0.6 ? 1 : 0;
      const by = y - Math.round(hash2(seed, k, 130) * Math.min(3, tall * 0.12));
      const end = stroke(put, [bx, by], [bx + u * tall * 0.1, y - high * 0.8], tip,
        (t) => (tall > 52 ? (t < 0.5 ? 3 : 2) : tall > 34 ? (t < 0.55 ? 2 : 1) : 1),
        (t) => run[Math.max(0, (t < 0.3 ? 1 : t < 0.62 ? 2 : t < 0.9 ? 3 : 4) - dark)]!);
      if (tall < 10) continue;
      const what = hash2(seed, k, 128);
      if (dry && what > 0.55) {
        // a seed head
        put(end.x, end.y, d[3]!); put(end.x, end.y - 1, d[3]!);
        if (tall > 24) { put(end.x - 1, end.y, d[2]!); put(end.x - 1, end.y - 2, d[3]!); }
      } else if (what > 0.955 && depth > 0) {
        // a white flower head, yellow in its middle when near
        for (const [dx, dy] of [[-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [-1, -1], [0, -1], [1, -1]] as const) put(end.x + dx, end.y + dy, bloom[0]!);
        if (tall > 22) put(end.x, end.y, bloom[1]!);
      }
    }
  },
};
