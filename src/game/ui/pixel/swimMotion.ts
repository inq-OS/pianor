import { hash2 } from './paint/noise';

/**
 * How the things under the water move (fish should not reset their position and should behave like the
 * clouds): each on a course of its own, worked out from the time, so nothing jumps back and nothing repeats in step
 * with anything else. Pure, as `windMotion.ts` is: the scene only places what this gives. Places are in fine pixels of
 * the picture, a sprite's top-left corner.
 *
 * - A fish crosses the whole water at its own pace, either way, a little higher or lower each time, and waits a while
 *   out of sight before it comes back.
 * - The school crosses slowly as one, each small fish weaving round its place in it.
 * - A jellyfish hangs where it is, drifting a little to and fro and bobbing as it pulses.
 * - Bubbles rise from the anchor, one after another.
 */

export interface SwimPlace {
  x: number;
  y: number;
  /** True when it swims to the right (a sprite painted facing the other way is turned). */
  right: boolean;
}

const TAU = 2 * Math.PI;

/**
 * Where crossing number `c` of swimmer `k` stands at `t` ms, or null while it waits out of sight: its left edge from
 * off the left side (`-wide`) to off the right (`width`), at `speed` fine pixels a second, after a wait of up to `rest` ms.
 */
function crossing(k: number, seed: number, t: number, width: number, wide: number, speed: number, rest: number): { x: number; right: boolean; c: number; at: number } | null {
  const across = ((width + wide) / speed) * 1000;
  const period = across + rest;
  const u = t + hash2(k, seed, 801) * period;
  const c = Math.floor(u / period);
  const at = u - c * period - hash2(k, c + seed, 802) * rest;
  if (at < 0 || at > across) return null;
  const right = hash2(k, c + seed, 803) > 0.5;
  const gone = (speed * at) / 1000;
  return { x: Math.round(right ? -wide + gone : width - gone), right, c, at };
}

/** Bright fish `k` (its sprite `wide` across), keeping near row `home`, at `t` ms; null while it is away. */
export function fishAt(k: number, home: number, wide: number, width: number, t: number, seed = 0): SwimPlace | null {
  const speed = 9 + 10 * hash2(k, seed, 804);
  const pass = crossing(k, seed, t, width, wide, speed, 4000 + 9000 * hash2(k, seed, 805));
  if (!pass) return null;
  const lane = Math.round((hash2(k, pass.c + seed, 806) - 0.5) * 20);
  const bob = Math.round(2 * Math.sin((TAU * pass.at) / (2600 + 900 * hash2(k, seed, 807))));
  return { x: pass.x, y: home + lane + bob, right: pass.right };
}

/** The school's members: each one's place in it, from its front left (as the school was painted). */
export const SCHOOL = Array.from({ length: 26 }, (_, k) => ({ dx: ((k * 13) % 84) - (k % 3) * 4, dy: ((k * 7) % 30) - 12 }));
/** How wide the school is, in fine pixels. */
const SCHOOL_WIDE = 96;

/** The school's small fish `k` (of `SCHOOL`), the school keeping near row `home`, at `t` ms; null while the school is away. */
export function schoolAt(k: number, home: number, width: number, t: number, seed = 0): SwimPlace | null {
  const pass = crossing(1000, seed, t, width, SCHOOL_WIDE, 6 + 2 * hash2(1, seed, 811), 6000);
  if (!pass) return null;
  const m = SCHOOL[k]!;
  // the school rises and sinks as it goes, and each fish weaves round its place
  const swell = 6 * Math.sin((TAU * pass.at) / 9000);
  const weave = { x: 2 * Math.sin((TAU * t) / (1700 + 37 * k) + k), y: 1.5 * Math.sin((TAU * t) / (1300 + 53 * k) + k * 2) };
  const dx = pass.right ? SCHOOL_WIDE - m.dx : m.dx;
  return { x: Math.round(pass.x + dx + weave.x), y: Math.round(home + m.dy + swell + weave.y), right: pass.right };
}

/** Jellyfish `k` hanging at (`x`, `y`) at `t` ms, and which of its `looks` shows (its threads sway as it pulses). */
export function jellyAt(k: number, x: number, y: number, looks: number, t: number, seed = 0): SwimPlace & { look: number } {
  const drift = 16 * Math.sin((TAU * t) / (26000 + 7000 * hash2(k, seed, 821)) + TAU * hash2(k, seed, 822));
  const pulse = (TAU * t) / (3400 + 900 * hash2(k, seed, 823));
  return { x: Math.round(x + drift), y: Math.round(y + 3 * Math.sin(pulse)), right: true, look: Math.floor(((pulse / TAU) * looks) % looks) };
}

/** Bubbles rising from a point: each one's place at `t` ms, the lowest first; `n` of them a `gap` apart. */
export function bubblesAt(from: { x: number; y: number }, t: number, n = 4, gap = 36, speed = 12): { x: number; y: number }[] {
  return Array.from({ length: n }, (_, k) => {
    const y = from.y - (((speed * t) / 1000 + k * gap) % (gap * n));
    return { x: Math.round(from.x + 2 * Math.sin(y / 9)), y: Math.round(y) };
  });
}
