import { clamp01, smoothstep as smooth } from '../../paint/ease';
import { fbm, hash2 } from '../../paint/noise';
import { runOf, type KitBrush, type KitItem } from './kit';
import { lump, scatter, stroke } from './shape';

/**
 * Bushes: the family's types. The model is the knoll (picked for grass, bushes and foliage); each
 * type is that scene's painter, lifted pixel for pixel. The dog rose also hands out its look in pieces (`roseRun`,
 * `roseTone`, `roseFlower`), for a scene that shapes its thicket its own way (the crossroads' thicket cut by paths).
 * The recipe in words: `projects/painter/artists-notes/bushes-and-foliage.md`.
 */

const MODEL = 'the knoll (knollPicture.ts); picked for grass, bushes and foliage';

export interface BushOptions {
  /** The leafy lumps it is heaped of: each `dx` from its middle and `dy` from its foot (up is negative), `r` round. */
  lumps: readonly { dx: number; dy: number; r: number }[];
  /** How much the leaves break up into light and dark patches. */
  leafy: number;
}

/** A bush: leafy lumps heaped on a foot, lit as one heap more than as its lumps, in flat patches of leaf, dark below. */
export const bush: KitItem<BushOptions> = {
  id: 'bushes/bush',
  family: 'bushes',
  about: 'a bush of leafy lumps heaped on its foot, lit as one heap, in flat patches of leaf, dark below',
  state: 'picked',
  model: MODEL,
  note: 'bushes-and-foliage.md',
  atlas: 'bushes, foliage, plants',
  uses: ['bush'],
  options: { lumps: [{ dx: -20, dy: -12, r: 15 }, { dx: 0, dy: -19, r: 17 }, { dx: 23, dy: -12, r: 14 }, { dx: 39, dy: -8, r: 9 }], leafy: 0.85 },
  variants: {
    heap: {},
    low: { lumps: [{ dx: -14, dy: -6, r: 10 }, { dx: 2, dy: -9, r: 12 }, { dx: 16, dy: -5, r: 8 }] },
    round: { lumps: [{ dx: 0, dy: -16, r: 16 }, { dx: -10, dy: -8, r: 9 }] },
  },
  box: (o) => ({
    left: Math.ceil(Math.max(...o.lumps.map((l) => -l.dx + l.r * 1.4))),
    right: Math.ceil(Math.max(...o.lumps.map((l) => l.dx + l.r * 1.4))),
    up: Math.ceil(Math.max(...o.lumps.map((l) => -l.dy + l.r * 1.4))),
    down: 0,
  }),
  ground: () => 'grass',
  paint(b, cx, foot, o, seed) {
    bushAt(b, o.lumps.map((l) => ({ x: cx + l.dx, y: foot + l.dy, r: l.r })), runOf(b.run, 'bush', bush.id), seed, foot, o.leafy);
  },
};

/** A bush of `lumps` placed where a scene has them already, cut at its `foot` row: `bush` with the scene's own places. */
export function bushAt(b: KitBrush, lumps: readonly { x: number; y: number; r: number }[], run: readonly number[], seed: number, foot = Infinity, leafy = 0.85): void {
  const side = b.side;
  const x0 = Math.min(...lumps.map((l) => l.x - l.r * 1.4)), x1 = Math.max(...lumps.map((l) => l.x + l.r * 1.4));
  const y0 = Math.min(...lumps.map((l) => l.y - l.r * 1.4)), y1 = Math.max(...lumps.map((l) => l.y + l.r * 1.4));
  for (let y = Math.floor(y0); y <= Math.min(foot, Math.ceil(y1)); y++) for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
    let best = -1, of = lumps[0]!, k = 0;
    lumps.forEach((l, i) => {
      const v = lump(x, y, l.x, l.y, l.r, l.r * 0.86, seed + i);
      if (v > best) { best = v; of = l; k = i; }
    });
    if (best < 0) continue;
    // lit as one heap more than as its lumps, or it reads as a pile of balls
    const nx = (x - of.x) / of.r, ny = 0.4 * ((y - of.y) / of.r) + 0.6 * ((2 * (y - y0)) / (Math.min(foot, y1) - y0) - 1);
    // leaves in patches: the tone moves in steps, by a blotchy noise
    const leaf = fbm(x / 4.5 + k * 3, y / 3.2, 2, seed + 81);
    let t = 0.5 - ny * 0.42 + nx * side * 0.24 + (leaf - 0.5) * leafy;
    if (best < 0.1) t = ny < 0 ? t + 0.12 : 0;
    b.put(x, y, scatter(run, clamp01(t), x, y, 0));
  }
}

/** The dog rose's leaves, dark to light: the near shade, then the bush's greens. */
export function roseRun(b: KitBrush): readonly number[] {
  const near = runOf(b.run, 'near', rose.id), green = runOf(b.run, 'bush', rose.id);
  return [near[1]!, green[0]!, green[1]!, green[2]!, green[3]!];
}

/**
 * The tone of the rose's leaves at a pixel (0 to 1, a place on `roseRun`) for the light `t` of the thicket there: the
 * leaves break it up in small blotches, `grain` across and down (finer for a thicket further off).
 */
export function roseTone(t: number, x: number, y: number, grain: readonly [number, number] = [4.2, 3.1]): number {
  return clamp01(t + (fbm(x / grain[0], y / grain[1], 2, 186) - 0.5) * 0.8);
}

/**
 * A flower of the dog rose at a pixel: five petals as a small cross, pale toward the light and dark under, with a
 * yellow middle (`heart`) in the nearer ones; or a hip, two red pixels (`hip`).
 */
export function roseFlower(b: KitBrush, x: number, y: number, hip: boolean, heart: boolean): void {
  const petals = runOf(b.run, 'rose', rose.id), bloom = runOf(b.run, 'bloom', rose.id);
  if (hip) { b.put(x, y, petals[1]!); b.put(x + 1, y, petals[1]!); return; }
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) b.put(x + dx, y + dy, dy < 0 || dx * b.side > 0 ? petals[3]! : dy > 0 ? petals[0]! : petals[2]!);
  b.put(x, y, heart ? bloom[1]! : petals[2]!);
}

export interface RoseOptions {
  /** How far its top falls from its high end to the ground, across, and how high its high end stands, in fine pixels. */
  wide: number;
  high: number;
  /** How many leafy lumps heap its top. */
  lumps: number;
  /** The share of its width over which its top stays at its full height before it falls (0: it falls from its high end). */
  keep: number;
  /** How far under its top, in fine pixels, its leaves go from lit to their darkest. */
  deep: number;
}

/**
 * A thicket of wild dog rose (kibuvits) banked against a picture's left side: its top falls from its high end at the
 * left down to the ground at its right end, heaped of leafy lumps that catch the light, under them leaves in light and
 * dark heaps, and pink flowers and red hips scattered over the lit leaves. The wild dog rose thicket
 * is thick, in reality at least 3 m high. `x` is the middle of its slope, `foot` the ground.
 * Variants: `corner` closes a picture's side as the knoll's does; `low` is a young one; `tall` is the full 3 m thicket
 * near the viewer, as the crossroads has it right of the track, that stands its whole height over half its width and
 * only then falls.
 */
export const rose: KitItem<RoseOptions> = {
  id: 'bushes/rose',
  family: 'bushes',
  about: 'a thicket of wild dog rose banked against a side, falling to the ground, pink flowers and red hips',
  state: 'picked',
  model: `${MODEL}; the wild dog rose grows thick, at least 3 m high`,
  note: 'bushes-and-foliage.md',
  atlas: 'bushes, foliage, flowers',
  uses: ['near', 'bush', 'rose', 'bloom'],
  options: { wide: 214, high: 182, lumps: 19, keep: 0, deep: 70 },
  variants: { corner: {}, low: { wide: 120, high: 60, lumps: 9 }, tall: { wide: 250, high: 220, lumps: 23, keep: 0.5, deep: 170 } },
  box: (o) => ({ left: Math.ceil(o.wide / 2 + 18), right: Math.ceil(o.wide / 2 + 26), up: Math.ceil(o.high + 30), down: 0 }),
  ground: () => 'grass',
  paint(b, x, foot, o, seed) {
    const left = x - o.wide / 2, from = foot - o.high;
    const run = roseRun(b);
    const top = (px: number): number => from + (foot - from) * Math.max(0, ((px - left) / o.wide - o.keep) / (1 - o.keep)) ** 1.15;
    const lumps = Array.from({ length: o.lumps }, (_, k) => {
      const lx = left + (-8 + ((o.wide + 6) * k) / (o.lumps - 1) + (hash2(k, 1, 181 + seed) - 0.5) * 9);
      return { x: lx, y: top(lx) + 5 + (hash2(k, 2, 181 + seed) - 0.5) * 10, r: 13 + hash2(k, 3, 181 + seed) * 12 };
    });
    // what the thicket itself painted: a flower only sits where leaves are all round it
    const leaves = new Map<number, number>();
    const key = (px: number, py: number): number => py * 65536 + px;
    const lit: [number, number][] = [];
    for (let y = from - 28; y < foot; y++) for (let px = left; px < left + o.wide + 24; px++) {
      let best = -1, of = lumps[0]!;
      for (const [i, l] of lumps.entries()) {
        const v = lump(px, y, l.x, l.y, l.r, l.r * 0.9, 190 + i + seed);
        if (v > best) { best = v; of = l; }
      }
      const under = y - top(px);
      if (best < 0 && under < 3) continue;
      const heap = fbm(px / 15, y / 11, 2, 187);
      // the lumps along the top catch the light from above; under them the thicket is leaves in light and dark heaps
      const above = 0.62 - ((y - of.y) / of.r) * 0.4 + ((px - of.x) / of.r) * b.side * 0.2;
      const body = 0.4 - Math.min(1, Math.max(0, under) / o.deep) * 0.24 + (heap - 0.5) * 0.9;
      const share = best < 0 ? 0 : smooth(14, 2, under);
      const t = roseTone(above * share + body * (1 - share), px, y);
      const c = scatter(run, t, px, y, 0);
      b.put(px, y, c);
      leaves.set(key(Math.round(px), y), c);
      if (t > 0.34) lit.push([px, y]);
    }
    const leafy = new Set(run);
    const isLeaf = (px: number, py: number): boolean => leafy.has(leaves.get(key(px, py)) ?? -1);
    // a flower takes the leaves it covers, so no other opens right beside it
    const flowering: KitBrush = { ...b, put: (px, py, c) => { b.put(px, py, c); leaves.set(key(Math.round(px), Math.round(py)), c); } };
    for (const [k, [px, py]] of lit.entries()) {
      if (hash2(px, py, 182 + seed) > 0.022 || !isLeaf(px + 2, py) || !isLeaf(px - 2, py) || !isLeaf(px, py - 2)) continue;
      roseFlower(flowering, px, py, hash2(px, py, 184 + seed) < 0.28, py > foot - 60 && k % 2 === 0);
    }
  },
};

export interface StemOptions {
  /** How far its head stands from its foot, across (negative: to the left) and up, in fine pixels. */
  reach: number;
  high: number;
  /** How wide its seed head fans out, and in how many rays. */
  size: number;
  rays: number;
}

/**
 * A tall dry stem with its flat seed head (an umbel): a stalk that bends once, two withered leaves at its joints, the
 * head's rays fanning out from its top with a small cluster at the end of each. Dark before the sky as things near the
 * viewer are; the gust bends its top as it passes.
 */
export const stem: KitItem<StemOptions> = {
  id: 'bushes/stem',
  family: 'bushes',
  about: 'a tall dry stalk with a flat seed head of rays, bending in the wind: closes a corner before the sky',
  state: 'picked',
  model: MODEL,
  note: 'bushes-and-foliage.md',
  atlas: 'plants, grass, meadow',
  uses: ['stem'],
  options: { reach: -30, high: 200, size: 17, rays: 9 },
  variants: { tall: {}, short: { reach: -10, high: 70, size: 12, rays: 7 }, lone: { reach: 8, high: 130, size: 21, rays: 11 } },
  box: (o) => ({ left: Math.ceil(Math.max(0, -o.reach) + o.size * 1.2 + 30), right: Math.ceil(Math.max(0, o.reach) + o.size * 1.2 + 30), up: Math.ceil(o.high + o.size), down: 0 }),
  ground: () => 'grass',
  paint(b, x, foot, o, seed) {
    const s = runOf(b.run, 'stem', stem.id);
    const put = (px: number, py: number, c: number): void => b.put(px, py, c);
    const n = seed;
    // the wind a little way above its foot
    const gust = b.lean?.(x + o.reach, foot - 54) ?? 0;
    const top: [number, number] = [x + o.reach + gust * 16 * (0.6 + 0.5 * hash2(n, 1, 181)), foot - o.high];
    const at: [number, number] = [x, foot];
    const bend: [number, number] = [at[0] + (top[0] - at[0]) * 0.25 + 6, (at[1] + top[1]) / 2];
    stroke(put, at, bend, top, (t) => (t < 0.7 ? 2 : 1), (t) => (t > 0.25 && t < 0.7 && hash2(n, Math.round(t * 40), 182) > 0.55 ? s[1]! : s[0]!));
    // a withered leaf at two joints
    const j = ((n % 5) + 5) % 5;
    for (const t of [0.34 + j * 0.03, 0.58 - j * 0.02]) {
      const u = 1 - t, lx = u * u * at[0] + 2 * u * t * bend[0] + t * t * top[0], ly = u * u * at[1] + 2 * u * t * bend[1] + t * t * top[1];
      const way = n % 2 ? 1 : -1;
      stroke(put, [lx, ly], [lx + way * 6, ly - 5], [lx + way * 11, ly + 2], () => 1, (k) => (k < 0.6 ? s[1]! : s[0]!));
    }
    // the seed head: rays that fan out from the stem's top, a small cluster at the end of each
    for (let r = 0; r < o.rays; r++) {
      const a = -Math.PI / 2 + (r / (o.rays - 1) - 0.5) * 2.5 + gust * 0.5;
      const far = o.size * (0.8 + 0.3 * hash2(n, r, 183));
      const ex = Math.round(top[0] + Math.cos(a) * far), ey = Math.round(top[1] + Math.sin(a) * far * 0.7);
      stroke(put, top, [(top[0] + ex) / 2, (top[1] + ey) / 2 + 1], [ex, ey], () => 1, () => s[1]!);
      const seedTone = hash2(n, r, 184) > 0.5 ? s[2]! : s[3]!;
      for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, -1], [1, -1], [-1, -1], [0, 1], [0, -2]] as const) put(ex + dx, ey + dy, dy < 0 ? s[3]! : dy > 0 ? s[0]! : seedTone);
    }
  },
};
