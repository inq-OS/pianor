/**
 * Repeatable noise for painted textures (wood grain, plaster, grass): the same numbers on every machine, so a picture is
 * the same pixels everywhere and a test can count on it. No `Math.random`.
 */

/** A number in 0 to 1 (1 not included) for a whole-number point. */
export function hash2(x: number, y: number, seed = 0): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Smooth noise in 0 to 1: one soft bump per unit of `x` and `y`. */
export function noise2(x: number, y: number, seed = 0): number {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = smooth(x - x0), fy = smooth(y - y0);
  const a = hash2(x0, y0, seed), b = hash2(x0 + 1, y0, seed), c = hash2(x0, y0 + 1, seed), d = hash2(x0 + 1, y0 + 1, seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

/** Noise with finer noise laid over it, `octaves` times, in 0 to 1: blotches with detail, as a brush leaves them. */
export function fbm(x: number, y: number, octaves = 3, seed = 0): number {
  let sum = 0, weight = 0.5, total = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noise2(x, y, seed + i * 17) * weight;
    total += weight;
    x *= 2.03;
    y *= 2.03;
    weight *= 0.5;
  }
  return sum / total;
}

/** The 4 x 4 ordered-dither threshold of a pixel, in 0 to 1 (never 1): the even spread a 256-colour screen used for shades it did not have. */
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5] as const;
export function bayer(x: number, y: number): number {
  return (BAYER4[(y & 3) * 4 + (x & 3)]! + 0.5) / 16;
}
