import type { Bitmap } from './bitmap';
import type { Air } from './windField';

/**
 * Painted things the wind moves, bent afresh as the game runs instead of painted in a loop of looks (the
 * painter's proposals, taken up): a pennant, washing on a line, a moored boat on the swell, weed in a
 * current. The painter paints the thing once, as it hangs or flies in still air, and says how the wind takes it
 * (`Blown.kind`); the game shifts its columns or rows on the place's one wind (`windField.ts`), so it flaps harder as a
 * gust reaches it, with the clouds, the water and the gulls. Pure, from the time, as `motes.ts` is: the same moment
 * always looks the same. Places are fine pixels.
 */

/**
 * How the wind takes a painted thing:
 * - `flag`: made fast at its upwind end, it flies downwind in waves that run along it, wider toward its free end;
 * - `hang`: made fast along its top (washing on a line), its lower rows swing downwind and flutter;
 * - `weed`: rooted at its foot (kelp, a reed), its upper rows sway to and fro in the current, slowly.
 */
export type BlownKind = 'flag' | 'hang' | 'weed';

/** A thing the wind moves: its picture in still air and where its top left corner lies (in the pixels of the picture it belongs to). */
export interface Blown {
  readonly kind: BlownKind;
  readonly x: number;
  readonly y: number;
  readonly bitmap: Bitmap;
}

/** How much room round a blown thing its motion needs, in fine pixels: across and up and down. */
export const BLOWN_ROOM: Readonly<Record<BlownKind, { x: number; y: number }>> = { flag: { x: 0, y: 4 }, hang: { x: 6, y: 0 }, weed: { x: 5, y: 0 } };

const TAU = Math.PI * 2;

/** How far column `i` from a flag's hoist (of `len` columns) is lifted or dropped at the wind's clock `time` ms, in a gust of strength `gust`. */
export function flagLift(i: number, len: number, time: number, air: Pick<Air, 'wind'>, gust: number): number {
  // the waves run from the hoist to the fly; none at the hoist itself, the most at the free end
  const free = Math.min(1, i / 4) * (0.6 + 0.4 * (i / Math.max(1, len)));
  const reach = (0.7 + 0.35 * air.wind) * (0.55 + 0.75 * gust);
  // in a lull the fly end sinks a little, in a gust it stands out
  const sink = (1 - gust) * (1.6 - 0.4 * air.wind) * (i / Math.max(1, len)) ** 1.5;
  return free * reach * (Math.sin(i / 3 - time / 210) + 0.35 * Math.sin(i / 1.7 - time / 130 + 1.3)) + Math.max(0, sink);
}

/** How far row `k` under a line (of `rows` rows) swings downwind (along `air.way`) at the wind's clock `time` ms, in a gust of strength `gust`. */
export function hangSwing(k: number, rows: number, time: number, air: Pick<Air, 'wind' | 'way'>, gust: number): number {
  const lean = (0.03 + 0.085 * air.wind) * (0.35 + gust) * k;
  const flutter = 0.6 * (k / Math.max(1, rows)) * Math.sin(time / 260 - k / 2.5) * (0.3 + 0.25 * air.wind);
  return air.way * (lean + flutter);
}

/** How far row `r` over a weed's foot (of `rows` rows) sways at `time` ms: a slow to and fro, the top the furthest, a wave running up it. */
export function weedSway(r: number, rows: number, time: number, turn = 0): number {
  const up = r / Math.max(1, rows);
  return up ** 1.4 * (3.2 * Math.sin(TAU * (time / 5200 - up * 0.35) + turn) + 1.1 * Math.sin(TAU * (time / 2300 - up * 0.8) + 2 * turn));
}

/**
 * Draws `blown` as the wind has it at `time` ms into `out` (a box of `blownBox(blown)`'s size, cleared before): `at` is
 * the thing's column in the picture, where it meets the place's wind.
 */
export function blownAt(blown: Blown, time: number, air: Air, at: number, out: Uint8Array): void {
  const { bitmap, kind } = blown;
  const { width: w, height: h, pixels } = bitmap;
  const room = BLOWN_ROOM[kind], W = w + 2 * room.x;
  const clock = air.time(time, at), gust = air.gust(time, at);
  if (kind === 'flag') {
    for (let x = 0; x < w; x++) {
      // the hoist is its upwind end
      const i = air.way < 0 ? w - 1 - x : x;
      const dy = Math.round(flagLift(i, w, clock, air, gust));
      for (let y = 0; y < h; y++) {
        const c = pixels[y * w + x]!;
        const to = y + room.y + dy;
        if (c !== 0 && to >= 0 && to < h + 2 * room.y) out[to * W + x + room.x] = c;
      }
    }
    return;
  }
  for (let y = 0; y < h; y++) {
    const dx = Math.round(kind === 'hang' ? hangSwing(y, h, clock, air, gust) : weedSway(h - 1 - y, h, time, (blown.x * 7 + blown.y * 3) % 6));
    for (let x = 0; x < w; x++) {
      const c = pixels[y * w + x]!;
      const to = x + room.x + dx;
      if (c !== 0 && to >= 0 && to < W) out[y * W + to] = c;
    }
  }
}

/** The box a blown thing is drawn in: its picture with room for its motion round it, and where the box's corner lies. */
export function blownBox(blown: Blown): { x: number; y: number; w: number; h: number } {
  const room = BLOWN_ROOM[blown.kind];
  return { x: blown.x - room.x, y: blown.y - room.y, w: blown.bitmap.width + 2 * room.x, h: blown.bitmap.height + 2 * room.y };
}

/**
 * How far a moored boat rides up (negative) or down at `time` ms, in fine pixels: a slow rise and fall on the swell
 * with a shorter lop over it, each boat (`k`) in its own time, a little more in a harder wind. Smooth: the game moves
 * the boat by parts of a pixel.
 */
export function bobAt(time: number, k: number, wind: number, seed = 0): number {
  const turn = ((k * 2.399 + seed * 0.731) % 1) * TAU + k * 1.7;
  const reach = 0.55 + 0.2 * wind;
  return reach * (Math.sin(TAU * (time / (3400 + 260 * (k % 3))) + turn) + 0.35 * Math.sin(TAU * (time / 1900) + 2.1 * turn));
}
