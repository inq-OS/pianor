import { bayer, noise2 } from './noise';
import type { Dab, Paint, Scene, Shape } from './trace';

/**
 * Paints a scene of shapes the way the hand-painted adventure backgrounds look (ft_1_18): a few strong warm lights and
 * deep shadows, soft shadow edges, a dark line round every thing, and nothing ruler-straight (the lens wobbles a little).
 * It works in full colour; `reduce.ts` then brings the picture down to the palette with dither.
 */

/** A light. A `far` one is the sun or the moon: (`x`, `y`, `z`) is then the way to it, not its place. */
export interface Lamp {
  x: number;
  y: number;
  z: number;
  far: boolean;
  r: number;
  g: number;
  b: number;
  /** A near lamp is half as bright this many metres away. */
  reach: number;
  /** The lamp's own radius in metres (for the sun, the tangent of its disc's spread): larger gives a softer shadow edge. */
  size: number;
  /** True for the fire: its light is kept apart, so it can flicker (`Layers.fire`). */
  flickers: boolean;
}

export interface Stage {
  scene: Scene;
  lamps: Lamp[];
  /** Light that is everywhere in the room, and the daylight on things outside. */
  ambient: readonly [number, number, number];
  outdoors: { toSun: readonly [number, number, number]; sun: readonly [number, number, number]; ambient: readonly [number, number, number] };
  /** What a ray sees that leaves through a window and meets nothing: sky, sea, ground. */
  sky(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, out: Paint): void;
  eye: { x: number; y: number; z: number };
  /** The lens: pixels per radian. */
  lens: number;
  /** The way pixel (px, py) looks from the eye. */
  look(px: number, py: number): { x: number; y: number; z: number };
}

/** The painted picture before it is brought down to the palette, a number per pixel (three for a colour). */
export interface Layers {
  w: number;
  h: number;
  /** The colour from every steady light, and the colour the fire adds at full strength: `settle` fills them. */
  steady: Float32Array;
  fire: Float32Array;
  /** The thing's own colour, and what shines by itself (the sky, a lit lampshade; `ownFire` for the flames). */
  albedo: Float32Array;
  own: Float32Array;
  ownFire: Float32Array;
  /** The light on the pixel, without the thing's own colour: from the sun (sharp shadows), from everything else that is steady, and from the fire. */
  sun: Float32Array;
  light: Float32Array;
  glow: Float32Array;
  /** The shape seen (0 for the sky), its group, and how far away it is. */
  shape: Int32Array;
  group: Int32Array;
  depth: Float32Array;
  /** 1 where the pixel shows the outdoors. */
  outside: Uint8Array;
  /** Where each pixel's point is, and the way its skin faces. */
  at: Float32Array;
  facing: Float32Array;
}

/**
 * How far the lens wobbles, in pixels, and the size of a wobble: long lines lean and bow as a hand draws them, so a
 * wall is not plumb and a table not square (the rooms of the 1991 game have no straight line; d111).
 */
export const WOBBLE = 4.5;
const WOBBLE_SIZE = 120;

/** How far the lens is off at a pixel, in pixels each way. */
function wobble(px: number, py: number): { x: number; y: number } {
  return { x: (noise2(px / WOBBLE_SIZE, py / WOBBLE_SIZE, 5) - 0.5) * 2 * WOBBLE, y: (noise2(px / WOBBLE_SIZE, py / WOBBLE_SIZE, 9) - 0.5) * 2 * WOBBLE };
}

/**
 * Where the wobbling lens shows what a still lens would show at (x, y): a sprite laid into the painted room goes
 * there, or it would stand beside its place. (The wobble changes slowly, so its size at the place itself serves.)
 */
export function lensPlace(x: number, y: number): { x: number; y: number } {
  const w = wobble(x, y);
  return { x: x - w.x, y: y - w.y };
}
/** Light wraps a little round a thing, as it does in a room with pale walls. */
const WRAP = 0.22;
/** How far a point looks for something close by that darkens it (a corner, the floor under a table), in metres. */
const NOOK = 0.42;
const NOOK_SHADE = 0.5;

/** Sixteen spread-out points in a disc, taken in the order of the dither pattern: one shadow ray per pixel gives a dithered soft edge. */
const DISC: readonly (readonly [number, number])[] = Array.from({ length: 16 }, (_, i) => {
  const r = Math.sqrt((i + 0.5) / 16), a = i * 2.39996;
  return [r * Math.cos(a), r * Math.sin(a)] as const;
});

function newDab(): Dab {
  return { x: 0, y: 0, z: 0, fine: 0.01, nx: 0, ny: 1, nz: 0, u: 0, v: 0, face: 0, r: 0, g: 0, b: 0, emit: 0 };
}

/** The light of one lamp on a point, into `out` (three numbers); nothing when the point is in its shadow. */
function lampLight(stage: Stage, lamp: Lamp, d: Dab, jitter: readonly [number, number], out: Float32Array): void {
  out[0] = out[1] = out[2] = 0;
  let lx: number, ly: number, lz: number, gain: number, tMax: number;
  if (lamp.far) {
    lx = lamp.x + jitter[0] * lamp.size; ly = lamp.y + jitter[1] * lamp.size; lz = lamp.z + jitter[0] * lamp.size * 0.5;
    const l = Math.hypot(lx, ly, lz);
    lx /= l; ly /= l; lz /= l;
    gain = 1;
    tMax = 40;
  } else {
    lx = lamp.x + jitter[0] * lamp.size - d.x; ly = lamp.y + jitter[1] * lamp.size - d.y; lz = lamp.z - jitter[0] * lamp.size - d.z;
    const dist = Math.hypot(lx, ly, lz);
    gain = 1 / (1 + (dist * dist) / (lamp.reach * lamp.reach));
    lx /= dist; ly /= dist; lz /= dist;
    tMax = dist;
  }
  const facing = (d.nx * lx + d.ny * ly + d.nz * lz + WRAP) / (1 + WRAP);
  if (facing <= 0 || gain < 0.012) return;
  if (stage.scene.blocked(d.x + d.nx * 0.012, d.y + d.ny * 0.012, d.z + d.nz * 0.012, lx, ly, lz, 0.004, tMax - 0.02)) return;
  const k = facing * gain;
  out[0] = lamp.r * k; out[1] = lamp.g * k; out[2] = lamp.b * k;
}

/** The way a pixel looks through the wobbling lens. */
export function lensRay(stage: Pick<Stage, 'look'>, px: number, py: number): { x: number; y: number; z: number } {
  const w = wobble(px, py);
  return stage.look(px + 0.5 + w.x, py + 0.5 + w.y);
}

/** Paints the scene: one ray per pixel, then the light of every lamp on what it found. */
export function paint(stage: Stage, w: number, h: number): Layers {
  const n = w * h;
  const layers: Layers = {
    w, h, steady: new Float32Array(n * 3), fire: new Float32Array(n * 3), albedo: new Float32Array(n * 3), own: new Float32Array(n * 3), ownFire: new Float32Array(n * 3),
    sun: new Float32Array(n * 3), light: new Float32Array(n * 3), glow: new Float32Array(n * 3),
    shape: new Int32Array(n), group: new Int32Array(n), depth: new Float32Array(n).fill(Infinity), outside: new Uint8Array(n),
    at: new Float32Array(n * 3), facing: new Float32Array(n * 3),
  };
  const dab = newDab();
  const got = new Float32Array(3);
  const { scene, eye } = stage;
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const i = py * w + px;
      const dir = lensRay(stage, px, py);
      const shape = scene.first(eye.x, eye.y, eye.z, dir.x, dir.y, dir.z, 0.05, 400);
      if (!shape) {
        stage.sky(eye.x, eye.y, eye.z, dir.x, dir.y, dir.z, dab);
        layers.own[i * 3] = dab.r; layers.own[i * 3 + 1] = dab.g; layers.own[i * 3 + 2] = dab.b;
        layers.outside[i] = 1;
        continue;
      }
      const t = scene.t;
      dab.x = eye.x + dir.x * t; dab.y = eye.y + dir.y * t; dab.z = eye.z + dir.z * t;
      shape.skin(dab.x, dab.y, dab.z, dab);
      if (dab.nx * dir.x + dab.ny * dir.y + dab.nz * dir.z > 0) { dab.nx = -dab.nx; dab.ny = -dab.ny; dab.nz = -dab.nz; }
      dab.emit = 0;
      dab.fine = t / stage.lens;
      shape.material(dab);
      layers.shape[i] = shape.id; layers.group[i] = shape.group; layers.depth[i] = t;
      layers.at[i * 3] = dab.x; layers.at[i * 3 + 1] = dab.y; layers.at[i * 3 + 2] = dab.z;
      layers.facing[i * 3] = dab.nx; layers.facing[i * 3 + 1] = dab.ny; layers.facing[i * 3 + 2] = dab.nz;
      shade(stage, shape, dab, px, py, i, layers, got);
    }
  }
  settle(layers);
  return layers;
}

/** How far the soft light is evened out, in pixels each way: one ray per lamp leaves it speckled. */
const EVEN = 2;

/**
 * Evens out the soft light over the neighbours on the same skin (one ray per lamp and pixel leaves it speckled), then
 * mixes light and colour into `steady` and `fire`. The sun's light is left as it is: its shadows stay sharp.
 */
function settle(layers: Layers): void {
  const { w, h, shape, facing, light, glow, sun, albedo, own, ownFire, steady, fire } = layers;
  const sum = new Float32Array(6);
  const even = new Float32Array(light.length), evenGlow = new Float32Array(glow.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (shape[i] === 0) {
        for (let k = 0; k < 3; k++) steady[i * 3 + k] = own[i * 3 + k]!;
        continue;
      }
      sum.fill(0);
      let n = 0;
      for (let dy = -EVEN; dy <= EVEN; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -EVEN; dx <= EVEN; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          const j = yy * w + xx;
          if (shape[j] !== shape[i]) continue;
          if (facing[i * 3]! * facing[j * 3]! + facing[i * 3 + 1]! * facing[j * 3 + 1]! + facing[i * 3 + 2]! * facing[j * 3 + 2]! < 0.92) continue;
          for (let k = 0; k < 3; k++) { sum[k]! += light[j * 3 + k]!; sum[3 + k]! += glow[j * 3 + k]!; }
          n++;
        }
      }
      for (let k = 0; k < 3; k++) {
        const a = albedo[i * 3 + k]!;
        even[i * 3 + k] = sum[k]! / n; evenGlow[i * 3 + k] = sum[3 + k]! / n;
        steady[i * 3 + k] = a * (sum[k]! / n + sun[i * 3 + k]!) + own[i * 3 + k]!;
        fire[i * 3 + k] = a * (sum[3 + k]! / n) + ownFire[i * 3 + k]!;
      }
    }
  }
  // the soft light is kept as it was evened out: a painter that lays the light in steps of its own starts from it
  light.set(even); glow.set(evenGlow);
}

function shade(stage: Stage, shape: Shape, dab: Dab, px: number, py: number, i: number, layers: Layers, got: Float32Array): void {
  const { albedo, own, ownFire, sun, light, glow } = layers;
  const o = i * 3;
  if (shape.outdoor) {
    layers.outside[i] = 1;
    const out = stage.outdoors;
    const facing = Math.max(0, dab.nx * out.toSun[0] + dab.ny * out.toSun[1] + dab.nz * out.toSun[2]);
    own[o] = dab.r * (out.ambient[0] + out.sun[0] * facing + dab.emit);
    own[o + 1] = dab.g * (out.ambient[1] + out.sun[1] * facing + dab.emit);
    own[o + 2] = dab.b * (out.ambient[2] + out.sun[2] * facing + dab.emit);
    return;
  }
  if (dab.emit < 0) {
    // the fire itself: it shines by the fire's own strength
    ownFire[o] = dab.r * -dab.emit; ownFire[o + 1] = dab.g * -dab.emit; ownFire[o + 2] = dab.b * -dab.emit;
    return;
  }
  albedo[o] = dab.r; albedo[o + 1] = dab.g; albedo[o + 2] = dab.b;
  own[o] = dab.r * dab.emit; own[o + 1] = dab.g * dab.emit; own[o + 2] = dab.b * dab.emit;
  const jitter = DISC[Math.floor(bayer(px, py) * 16) & 15]!;
  // a near thing darkens a point: one short ray out from the skin, in a direction that changes from pixel to pixel
  const j2 = DISC[Math.floor(bayer(px + 2, py + 1) * 16) & 15]!;
  let ax = dab.nx + j2[0] * 0.9, ay = dab.ny + j2[1] * 0.9, az = dab.nz + (bayer(px + 1, py + 3) - 0.5) * 1.6;
  const al = Math.hypot(ax, ay, az) || 1;
  ax /= al; ay /= al; az /= al;
  const nook = stage.scene.blocked(dab.x + dab.nx * 0.012, dab.y + dab.ny * 0.012, dab.z + dab.nz * 0.012, ax, ay, az, 0.004, NOOK) ? NOOK_SHADE : 1;
  light[o] = stage.ambient[0] * nook; light[o + 1] = stage.ambient[1] * nook; light[o + 2] = stage.ambient[2] * nook;
  for (const lamp of stage.lamps) {
    lampLight(stage, lamp, dab, jitter, got);
    const to = lamp.far ? sun : lamp.flickers ? glow : light;
    to[o] = to[o]! + got[0]!; to[o + 1] = to[o + 1]! + got[1]!; to[o + 2] = to[o + 2]! + got[2]!;
  }
}

/** The dark line a hand draws round every thing, and the softer one along an edge inside it. 0 is no line, 1 the full outline. */
export function outlines(layers: Layers): Float32Array {
  const { w, h, shape, group, depth, facing } = layers;
  const ink = new Float32Array(w * h);
  const mark = (i: number, j: number): void => {
    if (shape[i] === shape[j]) {
      // a fold in one shape: where its skin turns sharply
      const turn = facing[i * 3]! * facing[j * 3]! + facing[i * 3 + 1]! * facing[j * 3 + 1]! + facing[i * 3 + 2]! * facing[j * 3 + 2]!;
      if (shape[i] !== 0 && turn < 0.6) ink[i] = Math.max(ink[i]!, 0.42);
      return;
    }
    // the line lies on the nearer of the two things
    const near = depth[i]! <= depth[j]! ? i : j;
    const strength = group[i] === group[j] ? 0.42 : 1;
    ink[near] = Math.max(ink[near]!, strength);
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (x + 1 < w) mark(i, i + 1);
      if (y + 1 < h) mark(i, i + w);
    }
  }
  return ink;
}
