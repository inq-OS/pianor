import { hash2 } from './paint/noise';

/**
 * A fish that jumps now and then in open water and leaves a ring (small touches
 * of life). Drawn afresh as the game runs, in a box of the sea: it leaves the water with a fleck of foam,
 * goes over in a low arc, and where it falls back a ring spreads and breaks up. When and where is the day's dice: the
 * gaps between jumps are uneven and some turns nothing jumps. Pure, as `motes.ts` is. Places are fine pixels of the box.
 */

/**
 * The fish's grey back and silver side, the ring's tone and the foam, as palette places. The ring is the water's own
 * pale tone, never the foam's white: white strokes with square ends read as brackets on the sea (art review 2). Only the fleck where the fish breaks the water is foam.
 */
export interface LeapTones {
  back: number;
  belly: number;
  ring: number;
  foam: number;
}

/** About how often a fish may jump, how long its arc takes and how long the ring lasts after it, in milliseconds. */
export const LEAP = { everyMs: 9000, arcMs: 620, ringMs: 2100, far: 10, high: 7 } as const;

/** The jump of turn `c` of the day `seed` in a box `w` by `h`: when it starts in the turn, where, and which way; or null when nothing jumps that turn. */
export function leapOf(c: number, size: { w: number; h: number }, seed: number): { start: number; x: number; y: number; way: 1 | -1 } | null {
  if (hash2(c, seed, 991) < 0.3) return null;
  const start = c * LEAP.everyMs + hash2(c, seed, 992) * (LEAP.everyMs - LEAP.arcMs - LEAP.ringMs);
  const way = hash2(c, seed, 993) < 0.5 ? 1 : -1;
  const margin = LEAP.far + 14;
  return { start, x: Math.round(margin + hash2(c, seed, 994) * (size.w - 2 * margin)), y: Math.round(LEAP.high + 3 + hash2(c, seed, 995) * (size.h - LEAP.high - 7)), way };
}

/** Draws what there is of a jump at `t` ms into the box: the fish in its arc, the foam where it left, the ring where it fell. */
export function leapAt(t: number, size: { w: number; h: number }, tones: LeapTones, seed: number, put: (x: number, y: number, tone: number) => void): void {
  const leap = leapOf(Math.floor(t / LEAP.everyMs), size, seed);
  if (!leap) return;
  const age = t - leap.start;
  if (age < 0 || age > LEAP.arcMs + LEAP.ringMs) return;
  const dot = (x: number, y: number, tone: number): void => {
    x = Math.round(x); y = Math.round(y);
    if (x >= 0 && x < size.w && y >= 0 && y < size.h) put(x, y, tone);
  };
  const ring = (cx: number, since: number, wide: number): void => {
    const v = since / LEAP.ringMs;
    if (v < 0 || v >= 1) return;
    // seen low over the water a ring is two level rows of short dashes, the far one shorter, and a pixel at each end: never a box
    const rx = Math.round(2 + wide * v), ry = rx > 7 ? 2 : 1;
    const stroke = (y: number, half: number, k0: number): void => {
      for (let dx = -half; dx <= half; dx++) {
        // dashes from the start (two pixels and a gap); spreading, it thins: every other piece, then every third
        if (rx > 3 && (((dx + k0) % 3) + 3) % 3 === 2) continue;
        if (v > 0.45 && (dx + k0) % 2 === 0) continue;
        if (v > 0.8 && (dx + k0) % 3 !== 0) continue;
        dot(cx + dx, y, tones.ring);
      }
    };
    stroke(leap.y - ry, Math.max(0, rx - 3), 0);
    stroke(leap.y + ry, Math.max(1, rx - 2), 1);
    if (v < 0.8) { dot(cx - rx, leap.y, tones.ring); dot(cx + rx, leap.y, tones.ring); }
  };
  if (age < LEAP.arcMs) {
    const u = age / LEAP.arcMs;
    const x = leap.x + leap.way * LEAP.far * u, y = leap.y - LEAP.high * 4 * u * (1 - u);
    // nose up as it rises, down as it falls: its tail a pixel behind and a row lower or higher
    const tilt = u < 0.5 ? 1 : -1, steep = u < 0.35 || u > 0.65 ? tilt : 0;
    // a silver side three pixels long, the grey back over its middle, a grey tail
    dot(x + leap.way, y - steep, tones.belly);
    dot(x, y, tones.belly);
    dot(x - leap.way, y + steep, tones.belly);
    dot(x, y - 1, tones.back);
    dot(x - 2 * leap.way, y + tilt, tones.back);
    // a fleck of foam where it broke the water
    if (u < 0.4) { dot(leap.x - 1, leap.y, tones.foam); dot(leap.x + 1, leap.y - (u < 0.2 ? 1 : 0), tones.foam); }
  }
  ring(leap.x, age - 80, 5);
  ring(leap.x + leap.way * LEAP.far, age - LEAP.arcMs, 11);
}
