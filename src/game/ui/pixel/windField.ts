import type { Wind } from '../../../core/sky/wind';
import { noise2 } from './paint/noise';
import type { WindWay } from './paint/motion';
import { GUST_MS } from './windMotion';

/**
 * One wind for everything that moves in a painted place (perhaps even wind): gusts that travel
 * across the picture the wind's way, each arriving at the left of a view a moment before the right (or the other way).
 * Whatever the wind drives reads it here: the clouds, the grass, the sea's strokes, the smoke, the sparks and the birds,
 * so when a gust comes they all lean into it together, a little after one another, and in a lull they all ease off.
 * Pure, from the time, the place and the day's seed, as `windMotion.ts` is: the same moment always looks the same.
 *
 * Two readings of it:
 * - `gustAt`: how hard it blows at a place now, 0 the stillest lull to 1 the height of a gust;
 * - `windTime`: a clock that runs faster in a gust and slower in a lull (never backwards). A motion made from the plain
 *   time (a cloud's drift, the grass's loop of looks) made from this clock instead surges and slackens with the gusts.
 */

/** How fast a gust's front crosses a picture, in fine pixels a second, at each strength of the wind. */
export const GUST_SPEED: readonly number[] = [40, 60, 90, 130];

/** How much faster the wind's clock runs at the height of a gust than in a lull: from 1 - SURGE to 1 + SURGE times. */
const SURGE = 0.65;
/** One unit of the noise is this many gusts' time: a gust comes along every two or three loops of the grass. */
const GUSTS = 2.5;

/** The noise's own time at a place: the gusts' front moving along the wind's `way`. */
function gustTime(t: number, x: number, wind: Wind, way: WindWay): number {
  return (t - (way * x * 1000) / GUST_SPEED[wind]!) / (GUST_MS[wind]! * GUSTS);
}

/** The noise the gusts are made of (0 to 1, smooth) and how fast it rises or falls at `u`. */
function air(u: number, seed: number): { at: number; slope: number } {
  const e = 1e-3;
  const at = noise2(u, 0.5, 931 + seed);
  return { at, slope: (noise2(u + e, 0.5, 931 + seed) - noise2(u - e, 0.5, 931 + seed)) / (2 * e) };
}

/** A value noise's steepest slope (its smoothstep peaks at 1.5 times the step between two corners). */
const STEEPEST = 1.5;

/**
 * The wind's clock at `t` ms at column `x` of a picture (fine pixels): `t` itself on the whole, running up to
 * 1 + SURGE times as fast in a gust and down to 1 - SURGE times in a lull. Never runs backwards.
 */
export function windTime(t: number, x: number, wind: Wind, way: WindWay, seed = 0): number {
  const period = GUST_MS[wind]! * GUSTS;
  // the noise rises in a gust and falls in a lull: its integral, scaled, is how far the clock runs ahead or lags
  return t + (SURGE / STEEPEST) * period * (air(gustTime(t, x, wind, way), seed).at - 0.5);
}

/** How hard the wind blows at column `x` at `t` ms: 0 the stillest lull to 1 the height of a gust (the wind's clock's pace). */
export function gustAt(t: number, x: number, wind: Wind, way: WindWay, seed = 0): number {
  const { slope } = air(gustTime(t, x, wind, way), seed);
  return Math.max(0, Math.min(1, 0.5 + slope / (2 * STEEPEST)));
}

/** The wind of one view on one day, for the things that read it. */
export interface Air {
  /** The wind's clock (`windTime`) at column `x`. */
  time(t: number, x: number): number;
  /** How hard it blows at column `x` (`gustAt`), 0 to 1. */
  gust(t: number, x: number): number;
  /** The day's wind, 0 calm to 3 storm. */
  readonly wind: Wind;
  /** The way it blows in this view: 1 to the right, -1 to the left. */
  readonly way: WindWay;
}

/** The wind of a view on a day: `wind` blowing its `way`, the gusts placed by the day's `seed`. */
export function airOf(wind: Wind, way: WindWay, seed = 0): Air {
  return {
    time: (t, x) => windTime(t, x, wind, way, seed),
    gust: (t, x) => gustAt(t, x, wind, way, seed),
    wind,
    way,
  };
}

/** Still air: its clock is the plain time and it never gusts (for what has no wind, and for reduced motion's first moment). */
export const STILL_AIR: Air = { time: (t) => t, gust: () => 0.5, wind: 0, way: 1 };
