import { fbm, hash2, noise2 } from './noise';
import type { Dab, Material } from './trace';
import { smoothstep as step } from './ease';

/** Painted surfaces: each gives a point its own colour, in metres on the thing's skin, before any light. */

export type Colour = readonly [number, number, number];

/** A colour from 0xRRGGBB, each part 0 to 1. */
export function colour(hex: number): Colour {
  return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
}

export function tint(d: Dab, c: Colour, k = 1): void {
  d.r = c[0] * k;
  d.g = c[1] * k;
  d.b = c[2] * k;
}

export function mix(a: Colour, b: Colour, t: number): Colour {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** One colour, with the soft unevenness of a brush (`rough` 0 for none). */
export function plain(c: Colour, rough = 0.08, seed = 0): Material {
  return (d) => tint(d, c, 1 - rough / 2 + rough * fbm(d.x * 3 + d.y * 2.1, d.z * 3 - d.y * 1.3, 2, seed));
}

/** A plastered, painted wall: a little uneven in broad patches, grubby near the floor, with a hairline crack here and there. */
export function plaster(c: Colour, seed: number): Material {
  return (d) => {
    let k = 0.93 + 0.12 * fbm(d.u * 0.9, d.v * 0.9, 2, seed);
    k *= 0.8 + 0.2 * step(0, 0.55, d.y);
    const crack = Math.abs(fbm(d.u * 0.7 + 3, d.v * 0.7, 2, seed + 7) - 0.5);
    if (crack < d.fine * 0.35 && noise2(d.u * 0.35, d.v * 0.35, seed + 9) > 0.62) k *= 0.7;
    tint(d, c, k);
  };
}

/**
 * Boards `width` metres wide running along `v` (or along `u`): each its own tone, grain streaks, dark seams with a lit
 * edge, a butt joint now and then, knots, and paler patches where feet have worn it.
 */
export function planks(c: Colour, width: number, seed: number, along: 'u' | 'v' = 'v'): Material {
  return (d) => {
    const run = along === 'v' ? d.v : d.u;
    const across = (along === 'v' ? d.u : d.v) + (noise2(run * 0.5, 1, seed + 2) - 0.5) * 0.02;
    const n = Math.floor(across / width);
    const f = across / width - n;
    let k = 0.8 + 0.4 * hash2(n, 7, seed);
    k *= 0.86 + 0.28 * fbm(run * 1.6 + n * 13.7, across * 26, 2, seed + 4);
    k *= 0.9 + 0.2 * fbm(d.x * 0.6, d.z * 0.6, 2, seed + 11);
    const seam = Math.max(0.05, (d.fine * 0.8) / width);
    const joint = (((run + hash2(n, 3, seed) * 2.6) % 2.6) + 2.6) % 2.6;
    if (f < seam || joint < Math.max(0.01, d.fine * 0.7)) k *= 0.4;
    else if (f < seam * 2.3) k *= 1.14;
    const kx = run * 1.3 + n * 5.3;
    const cell = Math.floor(kx);
    if (hash2(cell, n, seed + 8) > 0.84) {
      const dx = kx - cell - 0.5, dy = f - 0.5;
      const r = dx * dx * 30 + dy * dy * 9;
      if (r < 0.22) k *= 0.55;
      else if (r < 0.5) k *= 0.82;
    }
    tint(d, c, k);
  };
}

/** Planed wood of a piece of furniture: fine grain along `v` (or `u`). */
export function wood(c: Colour, seed: number, along: 'u' | 'v' = 'v'): Material {
  return (d) => {
    const run = along === 'v' ? d.v : d.u, across = along === 'v' ? d.u : d.v;
    const k = 0.84 + 0.3 * fbm(run * 2.2, across * 34 + fbm(run * 3, across * 3, 2, seed) * 3, 2, seed + 1);
    tint(d, c, k);
  };
}

/**
 * Bricks laid by hand, long ago: courses that waver and are not all of one height, bricks of every length, each its own
 * tone, a burnt dark one and a pale chipped one here and there, in mortar that is wide in places and gone in others. No
 * even grid: a thing was found or worn, never made in a factory (art-direction rule 25).
 */
export function bricks(c: Colour, mortar: Colour, seed: number): Material {
  const H = 0.092, L = 0.27;
  return (d) => {
    // the courses rise and dip along the wall
    const v = d.v + 0.02 * (noise2(d.u * 1.3, d.v * 0.4, seed + 5) - 0.5) + 0.008 * Math.sin(d.u * 9 + d.v * 3);
    const row = Math.floor(v / H);
    const fv = v / H - row;
    // each course has bricks of its own length, and starts where it likes
    const len = L * (0.72 + 0.6 * hash2(row, 1, seed + 6));
    const u = d.u / len + hash2(row, 2, seed + 7);
    const col = Math.floor(u);
    const fu = u - col;
    const wide = 0.7 + 0.9 * hash2(col, row, seed + 8);
    const gapV = Math.max(0.13 * wide, (d.fine * 0.9) / H), gapU = Math.max(0.05 * wide, (d.fine * 0.9) / len);
    const pick = hash2(col, row, seed);
    if ((fv < gapV || fu < gapU) && hash2(col, row, seed + 9) > 0.12) return tint(d, mortar, 0.7 + 0.3 * noise2(d.u * 9, d.v * 9, seed));
    let k = 0.8 + 0.32 * pick;
    if (pick > 0.88) k = 0.42;
    else if (pick < 0.07) k = 1.35;
    k *= 0.9 + 0.2 * fbm(d.u * 14, d.v * 14, 2, seed + 3);
    // a chipped corner
    if (hash2(col, row, seed + 10) > 0.8 && fu > 0.82 && fv > 0.7) k *= 0.6;
    if (fv < gapV * 2) k *= 1.12;
    tint(d, c, k);
  };
}

/** Stripes `width` metres wide across `u`, in two colours, with soft folds: bed linen. */
export function stripes(a: Colour, b: Colour, width: number, share = 0.5): Material {
  return (d) => {
    const f = d.u / width - Math.floor(d.u / width);
    const k = 0.9 + 0.14 * fbm(d.u * 5, d.v * 5, 2, 31);
    tint(d, f < share ? b : a, k);
  };
}
