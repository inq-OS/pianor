import { hash2, noise2 } from '../../paint/noise';

/** Shapes the kit's items are built from. */

/** A round lump: 1 in its middle, 0 at its rim (which wobbles by `seed`), below 0 outside. */
export function lump(x: number, y: number, cx: number, cy: number, rx: number, ry: number, seed: number): number {
  const dx = (x - cx) / rx, dy = (y - cy) / ry;
  const far = Math.hypot(dx, dy);
  if (far > 1.35) return -1;
  const wobble = far === 0 ? 0 : (noise2((dx / far) * 1.3 + seed * 3.1, (dy / far) * 1.3 + seed * 1.7, seed) - 0.5) * 0.36;
  return 1 - far / (1 + wobble);
}

/**
 * A pixel's grain, 0 to 1: scattered, never in a pattern (a checkerboard of the ordered dither reads as a screen).
 * MI2's backgrounds were painted and scanned: 21 to 44 percent of their pixels are lone grains (the knoll's art
 * review). `seed` gives another scatter.
 */
export const grain = (x: number, y: number, seed = 0): number => (hash2(x, y, 977 + seed) + hash2(x >> 1, y, 978 + seed)) / 2;

/**
 * The paint's grain on a colour `c` of a run: on a `share` of the pixels the next colour up or down the run, alone, as a
 * scanned painting has (the 1991 game's backgrounds were painted, then scanned). Never a checkerboard.
 */
export function fleck(run: readonly number[], c: number, x: number, y: number, share: number): number {
  const h = hash2(x, y, 99);
  if (h > share) return c;
  const i = run.indexOf(c);
  return i < 0 ? c : run[Math.max(0, Math.min(run.length - 1, i + (h < share / 2 ? -1 : 1)))]!;
}

/** The colour of a run at `t` (0 its darkest, 1 its lightest) with the grain spread over `spread` places of it. */
export function scatter(run: readonly number[], t: number, x: number, y: number, spread = 0, seed = 0): number {
  const v = t * (run.length - 1) + (grain(x, y, seed) - 0.5) * spread;
  return run[Math.max(0, Math.min(run.length - 1, Math.round(v)))]!;
}

/** The part of a whole run from one of its named tones to another. */
export const part = (whole: readonly number[], from: number, to: number): readonly number[] => whole.slice(whole.indexOf(from), whole.indexOf(to) + 1);

/** The colour `steps` places up (or down) a whole run from the tone `t`: a stroke laid over a body of that tone. */
export const beside = (whole: readonly number[], t: number, steps: number): number => whole[Math.max(0, Math.min(whole.length - 1, Math.round(t * (whole.length - 1)) + steps))]!;

/** A curved stroke through `put` from `a` by `b` to `c`, `wide(t)` pixels wide, in the colour `ink(t)`; returns its end. */
export function stroke(put: (x: number, y: number, c: number) => void, a: readonly [number, number], b: readonly [number, number], c: readonly [number, number], wide: (t: number) => number, ink: (t: number) => number): { x: number; y: number } {
  const steps = Math.max(2, Math.ceil((Math.abs(c[0] - a[0]) + Math.abs(c[1] - a[1]) + Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1])) * 1.2));
  let x = a[0], y = a[1];
  for (let k = 0; k <= steps; k++) {
    const t = k / steps, u = 1 - t;
    x = u * u * a[0] + 2 * u * t * b[0] + t * t * c[0];
    y = u * u * a[1] + 2 * u * t * b[1] + t * t * c[1];
    const n = wide(t), colour = ink(t);
    for (let s = 0; s < n; s++) put(x + s - (n >> 1), y, colour);
  }
  return { x: Math.round(x), y: Math.round(y) };
}
