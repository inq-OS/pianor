import type { FlockRules } from '../ui/pixel/flock';
import { LIVE, SURF_EDGE, type LiveWater } from '../ui/pixel/paint/live';

/**
 * How the things that fly and swim over Keri's places keep together (`flock.ts`), and where the sea throws its spray.
 * The numbers are the painter's, tried on the screen: AX-3 provisional.
 */

/** Gulls: slow on their long wings, gliding nearly level, keeping loosely together and well apart. */
export const GULL_FLIGHT: Omit<FlockRules, 'box'> = { speed: [8, 17], sight: 70, room: 10, part: 20, align: 0.8, gather: 0.25, wander: 7, climb: 0.25 };

/** The small fish of the school: each pulled to its place in it, darting and keeping clear of the next. */
export const SCHOOL_SWIM: Omit<FlockRules, 'box' | 'follow'> = { speed: [2, 34], sight: 18, room: 4, part: 30, align: 1.6, gather: 0, wander: 4, climb: 0.7, pull: 3.5 };

/** Where the surf breaks on the rocks in a place's live water (`paint/live.ts`): every few columns, its edge's top pixel. */
export function surfPoints(water: LiveWater, every = 5): { x: number; y: number }[] {
  const { x: ox, y: oy, frames } = water.layers;
  const surf = frames[LIVE.surf];
  if (!surf) return [];
  const points: { x: number; y: number }[] = [];
  for (let x = 0; x < surf.width; x += every) {
    for (let y = 0; y < surf.height; y++) {
      if (surf.pixels[y * surf.width + x] !== SURF_EDGE) continue;
      points.push({ x: ox + x, y: oy + y });
      break;
    }
  }
  return points;
}
