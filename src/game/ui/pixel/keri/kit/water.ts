import { clamp01, smoothstep as smooth } from '../../paint/ease';
import { fbm, hash2, noise2 } from '../../paint/noise';
import { tone } from '../keriPalette';
import { runOf, type KitBrush, type KitFill, type KitItem } from './kit';
import { beside } from './shape';

/**
 * Water: the sea, the pale bands that curl round what stands in it, and the dark reflections under a post. The look is
 * the picked one, both following the Phatt dock (mi2-bg-2-028): a dark far band, pale swirls in the
 * shallows, dark reflections. The docks were painted to it first and these are lifted from them pixel for
 * pixel, and `picked` once that pass was approved. The recipe in words: `projects/painter/artists-notes/water.md`.
 *
 * The sea's ground is the scene's answer about where the water is, in its own terms: the horizon's row, how far out
 * from the shore a pixel lies and the bottom under it, where the light lies on it, and what stands in it. The scene
 * keeps where its sea is; the kit keeps how the sea looks.
 */

const MODEL = 'the docks (docksPicture.ts), painted to the picked look (both follow the Phatt dock); the docks\' pass 10 was approved';

/** Where a pixel lies on the sea. */
export interface SeaPlace {
  /** How far out from the water's edge, in metres (above 0 on the water). */
  shore: number;
  /** The bottom under it, in metres across and ahead, so a stone on the bottom stays put on the ground. */
  gx: number;
  gz: number;
}

/** A thing standing in the water, as the picture shows it: the column and row of its foot and its half width in fine pixels. */
export interface SeaStand {
  x: number;
  y: number;
  r: number;
  /** A post or a leg (its bands trail off far; it casts a reflection), or a boulder (two or three bands, open upstream). */
  leg: boolean;
}

/** The ground of the sea. */
export interface SeaGround {
  /** The region's columns, 0 to `width` - 1, and its rows, 0 to `height` - 1. */
  width: number;
  height: number;
  /** The horizon's row: the sea lies under it. */
  horizon: number;
  /** Where a pixel lies on the sea; null off the water (the land, the sky). */
  place(x: number, y: number): SeaPlace | null;
  /** The column where the sun or the moon lies on the water at this hour. */
  glint: number;
  /**
   * At night, how much a broad plane of the water catches the moon at a pixel, 0 to 1 (the 1991 nights light one big
   * plane pale); left out, none does.
   */
  moon?(x: number, y: number): number;
  /** What stands in the water, for the bands that curl round it. */
  stands: readonly SeaStand[];
}

export interface SeaOptions {
  /** How many rows under the horizon the dark far band holds, about two fifths of the way to the shore. */
  band: number;
  /** The way the water drifts: 1 to the right, -1 to the left (the wind's way). */
  way: 1 | -1;
}

/** Where the dark far band ends in a column, in rows under the horizon: its lower edge ragged along the swell (rule 2). */
function bandEnd(o: SeaOptions, x: number, seed: number): number {
  const sx = x + seed * 1000;
  return o.band + 7 * (fbm(sx / 46, 2, 2, 216) - 0.5) + 2 * (hash2(sx >> 3, 1, 217) - 0.5);
}

/**
 * The sea's tone at a pixel, 0 to 1 along its run (rules 1 to 3): under the pale horizon the darkest water in a broad
 * far band, then a step of mid blue, then a brighter body that steps up toward the viewer, the shallows by the shore
 * palest. Steps of flat colour, never a gradient.
 */
function seaTone(b: KitBrush, g: SeaGround, o: SeaOptions, x: number, y: number, at: SeaPlace, seed: number): number {
  const depth = y - g.horizon, end = bandEnd(o, x, seed), sx = x + seed * 1000;
  const { shore } = at;
  let t: number;
  if (depth < end) t = depth < 2 ? 0.12 : b.hour.night ? 0.2 : 0.03;
  else if (depth < end + 6 + 3 * hash2(sx >> 2, 3, 218)) t = 0.22;
  else t = depth < end + 34 + 8 * (fbm(sx / 30, 4, 2, 219) - 0.5) ? 0.42 : 0.5;
  // the shallows over the pale bottom, in two steps toward the shore
  if (shore < 2.4 + 0.8 * noise2(sx / 18, 5, 220)) t = Math.max(t, shore < 0.9 + 0.4 * noise2(sx / 9, 6, 221) ? 0.76 : 0.62);
  // a little more light where the sun or the moon lies on the water, in one flat step
  if (depth >= end && Math.abs(x - g.glint) < 10 + depth * 0.4 + 6 * noise2(y / 3, sx >> 4, 222)) t += 0.08;
  if (b.hour.night && g.moon) {
    const plane = g.moon(x, y);
    t += plane > 0.7 ? 0.3 : plane > 0.35 ? 0.16 : 0;
  }
  return clamp01(t);
}

/** Whether a stone lies on the bottom under the shallows at a point (metres): it shows darker through the water. */
function underwater(gx: number, gz: number, seed: number): boolean {
  const cx = Math.floor(gx / 0.7) + seed * 101, cz = Math.floor(gz / 0.7);
  for (let i = -1; i <= 1; i++) for (let k = -1; k <= 1; k++) {
    const h = hash2(cx + i, cz + k, 201);
    if (h < 0.5) continue;
    const sx = (cx + i - seed * 101 + hash2(cx + i, cz + k, 202)) * 0.7, sz = (cz + k + hash2(cx + i, cz + k, 203)) * 0.7;
    const r = 0.14 + 0.2 * hash2(cx + i, cz + k, 204);
    if (Math.hypot(gx - sx, (gz - sz) * 1.3) < r) return true;
  }
  return false;
}

/** The sea's tone where the ground has water, for the bands (`rings`) to know the shallows; null off it. */
const loopAt = (b: KitBrush): number => b.beat ?? 0;
const twinkles = (seed: number, beat: number, on: number): boolean => (seed + 2 * beat) % 1 < on;

/**
 * The open sea from the horizon to the shore (rules 1 to 3 and 6): the tones in flat steps, the stones of the bottom
 * darker through the shallows, and the wave strokes: in the far band short level dashes of its own near tones, a step
 * darker or lighter; in the body longer, sparser dashes a step lighter with now and then a whitecap; none in the
 * shallows, where the bands curl round the posts and rocks instead. The strokes rock with the loop; the band holds still.
 * With live water (`KitBrush.live`) the strokes are not painted: every stroke row is recorded and the game lights them.
 */
export const sea: KitFill<SeaOptions, SeaGround> = {
  id: 'water/sea',
  family: 'water',
  about: 'the open sea after the Phatt dock: a pale horizon, a broad dark far band, a brighter body, pale shallows, level dashes',
  state: 'picked',
  model: MODEL,
  note: 'water.md',
  atlas: 'dock, sea,outdoor',
  uses: ['sea'],
  options: { band: 33, way: 1 },
  variants: { bay: {}, 'narrow-band': { band: 20 }, 'drift-left': { way: -1 } },
  sample: (o, width, height) => seaPatch(width, height, []),
  paint(b, g, o, seed) {
    const all = runOf(b.fine, 'sea', sea.id);
    for (let y = Math.max(0, Math.ceil(g.horizon)); y < g.height; y++) for (let x = 0; x < g.width; x++) {
      const at = g.place(x, y);
      if (!at) continue;
      const t = seaTone(b, g, o, x, y, at, seed);
      // the bottom shows in the shallows: its stones darker under the water
      const stony = at.shore < 3.2 && underwater(at.gx, at.gz, seed);
      b.put(x, y, stony ? beside(all, t, -2) : tone(all, t, x, y, 0.2));
    }
    waves(b, g, o, seed, all);
  },
};

function waves(b: KitBrush, g: SeaGround, o: SeaOptions, seed: number, all: readonly number[]): void {
  const { width: w, horizon: hz, height: h } = g;
  const beat = loopAt(b);
  let y = hz + 3;
  for (let row = 0; y < h; row++) {
    const depth = y - hz, len = 2 + depth * 0.22, r = row + seed * 1000;
    let x = -30 * hash2(r, 1, 51) + (b.sway?.(hash2(r, 7, 50)) ?? 0) * (1.5 + depth * 0.08) * o.way;
    for (let n = 0; x < w; n++) {
      const long = Math.max(2, len * (0.5 + hash2(r, n, 52)));
      const px0 = Math.round(x), far = depth < bandEnd(o, px0, seed);
      if (!b.live && hash2(r, n, 53) < (far ? 0.7 : 0.4)) {
        const step = far ? (hash2(r, n, 57) > 0.45 ? 1 : -1) : 1;
        const cap = !far && hash2(r, n, 54) > 0.93 && twinkles(hash2(r, n, 55), beat, 0.6);
        for (let k = 0; k < long; k++) {
          const px = Math.round(x + k);
          const at = px >= 0 && px < w ? g.place(px, y) : null;
          if (!at || at.shore < 4.5) continue;
          const base = seaTone(b, g, o, px, y, at, seed);
          b.put(px, y, cap && k > long * 0.25 && k < long * 0.75 ? b.run.foam : beside(all, base, step));
        }
      }
      x += long + len * (0.5 + 1.7 * hash2(r, n, 56));
    }
    // live water (`paint/live.ts`): the whole row may carry a stroke, and the game lights them as it runs
    if (b.live) for (let px = 0; px < w; px++) {
      const at = g.place(px, y);
      if (!at || at.shore < 4.5) continue;
      const base = seaTone(b, g, o, px, y, at, seed);
      b.live.stroke(px, y, beside(all, base, 1), depth < bandEnd(o, px, seed) ? beside(all, base, -1) : 0);
    }
    y += Math.max(1, Math.round(1.2 + depth * 0.06));
  }
}

/**
 * The pale bands that curl round what stands in the water (rule 4): flat bands of the sea's two palest tones, two to
 * four pixels thick, close round each post and further apart away from it, trailing off with the drift in long S
 * curves; the families of bands of things near each other run together. A boulder keeps two or three, open on its
 * upstream side: no ring ever closes round a thing, and none is the foam's white. They slide outward along their own
 * curves, one band in a loop, so no look jumps. Only below the far band. At night a step darker, so the bay stays
 * almost flat. Laid over `water/sea` on the same ground.
 */
export const rings: KitFill<SeaOptions, SeaGround> = {
  id: 'water/rings',
  family: 'water',
  about: 'pale bands of the sea curling round posts and rocks and trailing off with the drift, sliding outward in the loop',
  state: 'picked',
  model: MODEL,
  note: 'water.md',
  atlas: 'dock, sea,outdoor',
  uses: ['sea'],
  options: { band: 33, way: 1 },
  variants: { posts: {}, 'drift-left': { way: -1 } },
  sample: (o, width, height) => seaPatch(width, height, [
    { x: width * 0.42, y: height * 0.55, r: 2.5, leg: true }, { x: width * 0.5, y: height * 0.58, r: 2.5, leg: true },
    { x: width * 0.2, y: height * 0.45, r: 9, leg: false },
  ]),
  paint(b, g, o, seed) {
    const all = runOf(b.fine, 'sea', rings.id), run = runOf(b.run, 'sea', rings.id);
    const slide = loopAt(b), sx0 = seed * 1000;
    for (let y = g.horizon + 20; y < g.height; y++) for (let x = 0; x < g.width; x++) {
      const depth = y - g.horizon;
      if (depth < bandEnd(o, x, seed) - 1) continue;
      const at = g.place(x, y);
      if (!at || at.shore < 0.4) continue;
      // the water's own swirl bends the bands into S curves
      const wx = x + 22 * (fbm((x + sx0) / 44, y / 11, 2, 230) - 0.5), wy = y + 6 * (fbm((x + sx0) / 30, y / 8, 2, 231) - 0.5);
      const d = bandsFrom(g.stands, wx, wy, o.way);
      if (d === null) continue;
      // fewer and more broken further out
      if (d > 24 && noise2((x + sx0) / 16, y / 5, 232) * 0.5 + 0.5 < (d - 24) / 66) continue;
      if (noise2((x + sx0) / 11, y / 3.5, 233) < -0.45) continue;
      const u = Math.sqrt(d) * 0.72 - slide;
      const gap = (2 * Math.sqrt(Math.max(1, d))) / 0.72;
      const wide = Math.min(0.4, Math.max(0.22, 4.4 / gap));
      const f = u - Math.floor(u);
      if (f >= wide && !b.live) continue;
      const shallow = seaTone(b, g, o, x, y, at, seed) >= 0.62;
      const [core, rim] = b.hour.night ? [run[3]!, beside(all, 0.62, 0)] : shallow ? [run[4]!, beside(all, 0.88, 0)] : [run[4]!, run[3]!];
      // live water: the band slides through the pixel as the game runs
      if (b.live) b.live.ring(x, y, u, wide, core, rim);
      else b.put(x, y, f < wide * 0.5 ? core : rim);
    }
  },
};

/** How far a point lies from what stands in the water, in bands: a soft minimum over the things, each measured in its own size; null where none reaches. */
function bandsFrom(stands: readonly SeaStand[], wx: number, wy: number, way: number): number | null {
  let sum = 0;
  for (const o of stands) {
    let dx = wx - o.x;
    const dy = (wy - o.y) * 2.2;
    if (Math.abs(dx) > 90 + o.r * 4 || Math.abs(dy) > 120) continue;
    // the bands stretch away with the drift
    dx *= 1 - 0.6 * smooth(-12, 12, dx * way);
    const reach = Math.hypot(dx, dy) - o.r * (o.leg ? 1.15 : 1);
    // at a boulder's foot its own wet stones meet the water: the bands begin round it, and open on its upstream side
    if (!o.leg && (reach < 0 || dx * way < -o.r * 0.6)) continue;
    const size = o.leg ? 1.3 : Math.min(1.5, Math.max(0.8, o.r / 5));
    const d = Math.max(0, reach) / size;
    // a boulder keeps two or three bands close round it; the legs' bands trail off far
    if (!o.leg && d > 26) continue;
    sum += Math.exp(-d / 7);
  }
  if (sum < 1e-6) return null;
  const d = -7 * Math.log(sum);
  return d > 90 ? null : d;
}

/** A plain sea for the sheet and the tests: a bay seen from a standing eye, the horizon near its top, the shore along its lower edge. */
function seaPatch(width: number, height: number, stands: readonly SeaStand[]): SeaGround {
  const horizon = 2;
  return {
    width,
    height,
    horizon,
    glint: width * 0.7,
    stands,
    place(x, y) {
      if (y <= horizon || y >= height || x < 0 || x >= width) return null;
      const gz = (400 * 1.6) / (y - horizon), gx = ((x - width / 2) * gz) / 400;
      const shore = gz - 3.5 - 1.5 * Math.sin(x / 40);
      return shore > 0 ? { shore, gx, gz } : null;
    },
    // a plane of the bay on the left catches the moon, its edges ragged along the swell
    moon: (x, y) => {
      const wobble = 6 * Math.sin(y / 4 + x / 30);
      return smooth(width * 0.6, width * 0.35, x + wobble) * smooth(horizon + 8, horizon + 20, y + wobble);
    },
  };
}

export interface ReflectionOptions {
  /** The half width of what it reflects (a leg), in fine pixels. */
  r: number;
  /** The way the water drifts: 1 to the right, -1 to the left. */
  way: 1 | -1;
}

/**
 * The dark reflection under a post or a leg (rule 5): near-black blobs straight under its foot, wider than it,
 * broken, with water showing between them, rocking a little with the loop; never a mirror. It lies only on the bare
 * water (the brush's `under`); with no `under` it paints as on open water. Placed by the foot of what it reflects.
 */
export const reflection: KitItem<ReflectionOptions> = {
  id: 'water/reflection',
  family: 'water',
  about: 'the dark broken reflection under a post or a leg: near-black blobs wider than it, water between them',
  state: 'picked',
  model: MODEL,
  note: 'water.md',
  atlas: 'dock, sea,outdoor',
  uses: ['near', 'wood'],
  options: { r: 2.5, way: 1 },
  variants: { leg: {}, thick: { r: 5 }, thin: { r: 1.2 } },
  ground: () => 'sea',
  box: (o) => ({ left: Math.ceil(o.r * 3.2 + 4), right: Math.ceil(o.r * 3.2 + 4), up: 0, down: Math.ceil(5 + 3 * (3 + o.r * 0.6)) }),
  paint(b, x, foot, o, seed) {
    const near = runOf(b.run, 'near', reflection.id), wood = runOf(b.run, 'wood', reflection.id);
    const sky = new Set(b.fine.sky ?? []);
    const sway = b.sway?.(x / 53) ?? 0;
    for (let j = 0; j < 4; j++) {
      if (j > 0 && hash2(seed, j, 235) < 0.3) continue;
      const y = Math.round(foot + 1 + j * (3 + o.r * 0.6) + 2 * hash2(seed, j, 236));
      const half = o.r * (1.2 + 1.0 * hash2(seed, j, 239)) * (1 - j * 0.12) + 1;
      const cx = x + sway * (0.4 + j * 0.5) * o.way + (hash2(seed, j, 237) - 0.5) * o.r;
      for (let k = 0; k < (j < 3 ? 2 : 1); k++) for (let dx = Math.round(-half) + k; dx <= Math.round(half) - k; dx++) {
        const px = Math.round(cx + dx);
        const under = b.under?.(px, y + k);
        if (b.under && (!under || under.thing || sky.has(under.colour))) continue;
        b.put(px, y + k, hash2(px, y + k, 238) > 0.8 ? wood[0]! : near[0]!);
      }
    }
  },
};
