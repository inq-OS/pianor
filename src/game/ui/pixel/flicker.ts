import { hash2, noise2 } from './paint/noise';

/**
 * How a fire moves (smooth, with randomness where it makes sense: fire, clouds, water):
 * its flames lick, going through their drawings smoothly at a pace that wanders, and its light wanders up and down in
 * strength instead of pulsing on a beat. Pure, from the time and a seed, as `windMotion.ts` is: the same
 * moment always looks the same, so the tests and the screenshots stay still.
 */

/**
 * How long the stove's flames take to go once through their drawings, in milliseconds, at their middle pace. The fire is
 * calm, licking rather than biting: so the drawings are one smooth
 * loop of tongues rising in turn, shown in order and blended one into the next, never a jump to a drawing at random.
 */
export const FLAME_LOOP_MS = 2200;

/**
 * Where in its `n` drawings the fire is at `t` ms, from 0 up to (not reaching) `n`: the drawing under it shows whole and
 * the next over it in part (`n` wraps to 0). It always goes forward, but at a pace that wanders between about half and
 * one and a half of the middle pace, so the licks come unevenly as a real fire's do.
 */
export function flameAt(t: number, n: number, seed = 0): number {
  if (n < 2) return 0;
  const slow = FLAME_LOOP_MS * 2.5;
  // a slow wobble of the clock: the noise's steepest slope is about 1.5, so it adds or takes at most about half the pace
  const phase = t / FLAME_LOOP_MS + 0.9 * (noise2(t / slow, 0.5, 921 + seed) - 0.5);
  const at = (phase + hash2(seed, 0, 922)) * n;
  return ((at % n) + n) % n;
}

/**
 * How strong a fire's light is at `t` ms, from 0 (its lowest look) to `looks` - 1 (its highest): a slow swell with
 * quicker flutters over it, and now and then a flare, never the same twice; for blending the looks (`PixelScene.blend`).
 */
export function glowAt(t: number, looks: number, seed = 0): number {
  const s = t / 1000;
  const swell = noise2(s * 0.45, 0.5, 911 + seed) - 0.5;
  const flutter = noise2(s * 2.3, 1.5, 912 + seed) - 0.5;
  const flare = Math.max(0, noise2(s * 0.9, 2.5, 913 + seed) - 0.72) * 2.5;
  const level = 0.5 + 1.1 * swell + 0.45 * flutter + flare;
  return Math.max(0, Math.min(looks - 1, level * (looks - 1)));
}
