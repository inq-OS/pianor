import type { Wind } from '../../../core/sky/wind';
import type { WindWay } from './paint/motion';

/**
 * The pace of everything that moves in a painted place, in one table for every scene (motion shared
 * as the colours are), all read from the one wind of the scenery (ft_1_06.AC12): how fast a gust runs
 * through a picture's looks, how fast the clouds drift, and the day's sky: where the clouds start, at what pace each
 * goes and how many show (cloud movement, pattern and placement should vary,
 * especially once different weathers are considered). Pure: the scene (`PixelScene.drift`) only places what this gives.
 */

/**
 * How long one gust takes to run over a picture at each strength of the wind, in milliseconds. A calm day still breathes:
 * a slow air runs through the grass and the sea's glints still twinkle (on a calm day the
 * knoll showed no movement; AX-2: stimulation may be added, never removed). AX-3 provisional.
 */
export const GUST_MS: readonly number[] = [4400, 2700, 1760, 1120];

/** How long each of a picture's `looks` shows in `wind`: a whole gust in its loop of looks. */
export function lookMs(wind: Wind, looks: number): number {
  return GUST_MS[wind]! / looks;
}

/** How fast the farthest clouds drift at each strength of the wind, in fine pixels a second; the nearest go three times as fast. In a calm they drift slowly, but so that the eye sees it. */
export const DRIFT: readonly number[] = [0.5, 0.8, 1.3, 2];

/**
 * The day's sky until the real weather sets it (ft_Y_14): a number that places the day's clouds, and how much of the
 * sky they cover (0 clear to 1 all the painted clouds). AX-3 provisional: picked from the day's number as the wind is
 * (`windOfDay`), more cover in more wind; a storm always brings every cloud.
 */
export interface DaySky {
  seed: number;
  cover: number;
}

const DAY_MS = 86_400_000;

/** A small integer hash of `n` and `salt`, 0 to under 1. */
function hash(n: number, salt: number): number {
  let h = (Math.imul(n, 2654435761) ^ Math.imul(salt + 1, 40503)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 3266489917) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function daySky(instant: number, wind: Wind): DaySky {
  const seed = Math.floor(instant / DAY_MS);
  return { seed, cover: wind === 3 ? 1 : Math.min(1, 0.45 + 0.4 * hash(seed, 1) + 0.1 * wind) };
}

/** A cloud of a picture as painted: its place in the picture (fine pixels), its size, and how near it is (0 far, 1 near). */
export interface PaintedCloud {
  x: number;
  y: number;
  width: number;
  height: number;
  near: number;
}

/** A cloud's way across the sky on one day: where it starts (fine pixels in the picture), and its pace (fine pixels a second). */
export interface CloudCourse {
  x: number;
  y: number;
  speed: number;
}

/** A box of a picture in fine pixels. */
export interface SkyBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** How much of two boxes lies over each other, in square pixels (0 when they do not meet). */
function overlap(a: SkyBox, b: SkyBox): number {
  return Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
}

/**
 * The day's course of each cloud, or null for one the day's cover leaves out. The clouds shown are the largest first (the
 * big ones at the back stay), at least `least` of them; each starts somewhere else along its way across the picture
 * (`width` fine pixels wide), sits up to a few pixels higher than painted (never lower: what stands before the sky is cut
 * to the rows the clouds are painted in), and goes at its own pace round the wind's, a nearer one faster. They start
 * apart, the big ones placed first, and off the boxes in `clear` (the night's moon): a cloud that would meet one is
 * moved along its way to where it meets the least (the art review of the knoll: two clouds heaped into one
 * lump that hid the moon). Drifting at their own paces they pass over each other later, as clouds do.
 */
export function cloudCourses(clouds: readonly PaintedCloud[], width: number, wind: Wind, sky: DaySky, least = 0, clear: readonly SkyBox[] = []): (CloudCourse | null)[] {
  const shown = Math.max(Math.min(least, clouds.length), Math.round(sky.cover * clouds.length));
  const bySize = clouds.map((c, i) => ({ i, size: c.width * c.height * (0.75 + 0.5 * hash(sky.seed, 10 + i)) })).sort((a, b) => b.size - a.size);
  const placed: SkyBox[] = [...clear];
  const courses: (CloudCourse | null)[] = clouds.map(() => null);
  for (const { i } of bySize.slice(0, shown)) {
    const c = clouds[i]!;
    const lap = width + c.width;
    const y = c.y - Math.round(hash(sky.seed, 200 + i) * Math.min(6, c.y));
    const start = c.x + c.width + hash(sky.seed, 100 + i) * lap;
    // the day's place first, then further along the way in eighths of a lap: the first where it meets nothing, else the one where it meets least
    let best = { x: 0, met: Infinity };
    for (let k = 0; k < 8 && best.met > 0; k++) {
      const x = Math.floor((((start + (k * lap) / 8) % lap) + lap) % lap) - c.width;
      const box = { x: x - 3, y: y - 2, w: c.width + 6, h: c.height + 4 };
      const met = placed.reduce((sum, p) => sum + overlap(box, p), 0);
      if (met < best.met) best = { x, met };
    }
    placed.push({ x: best.x, y, w: c.width, h: c.height });
    courses[i] = { x: best.x, y, speed: DRIFT[wind]! * (1 + 2 * c.near) * (0.75 + 0.5 * hash(sky.seed, 300 + i)) };
  }
  return courses;
}

/**
 * Where a cloud of `cloudWidth` on `course` is at `timeMs` (its left edge, fine pixels in a picture `width` wide): it
 * drifts the wind's `way`, leaves the picture on one side and comes in again on the other. Not rounded to the art's
 * pixels: the screen draws it on its own, finer pixels, so a slow cloud glides instead of jumping a fine pixel at a time
 * (the scenery had been choppy).
 */
export function cloudX(course: CloudCourse, cloudWidth: number, width: number, timeMs: number, way: WindWay): number {
  const lap = width + cloudWidth;
  const moved = course.x + cloudWidth + way * (timeMs / 1000) * course.speed;
  return (((moved % lap) + lap) % lap) - cloudWidth;
}

/**
 * How much of each look shows `steps` looks into a loop played in `order` (look numbers), for looks that dissolve one into
 * the next instead of stepping (`PixelScene.cycle` with `fade`): a map from look to its opacity, 0 to 1; looks not in it
 * do not show. In each step the look shown fades out over the step's second half while the next fades in over its first,
 * so wherever the two cover the same pixel one of them is fully there (no flicker toward what lies behind), and whichever
 * of the two is drawn on top, the picture goes smoothly from the one to the other.
 */
export function fadeWeights(order: readonly number[], steps: number): Map<number, number> {
  const n = order.length;
  const step = Math.floor(steps);
  const f = steps - step;
  const shown = order[((step % n) + n) % n]!;
  const next = order[(((step + 1) % n) + n) % n]!;
  const weights = new Map<number, number>([[shown, Math.min(1, 2 * (1 - f))]]);
  weights.set(next, Math.max(weights.get(next) ?? 0, Math.min(1, 2 * f)));
  return weights;
}
