import type { World, WorldPoint } from '../world/world';
import { ART_DETAIL } from './frame';
import { ROOM_PICTURE, roomView } from './room';

/**
 * The grassy knoll with the bonfire place (ft_1_19.AC9, d113): the first scene on Keri, between the warden's house and the
 * lighthouse, south of the path. Its picture is a painting in pixels, not a lit set (2D pixel art with soul and depth; d111): a plateau the viewer stands on, rising gently to its lip with the fire ring by it, the sea over the lip and the rocky shore below where it cuts off on the right. Pure numbers; the
 * painter is `game/ui/pixel/keri/knollPicture.ts`.
 *
 * The viewer stands north of the knoll and looks south-south-west over it, to where the shore is nearest (show more towards the sea). Only the shore's place comes from the world model; the plateau's shape is the art direction, drawn by the painter.
 */

/** The scene's id in the world model (`scenes` in content/world/keri.json). */
export const KNOLL_ID = 'knoll';

export const KNOLL = {
  /** The way the viewer looks, as a compass bearing in degrees: south-south-west, to the nearest shore; no house stands that way, only grass, shingle and the sea. */
  heading: 207,
  /** The eye: this far behind the fire ring (metres) and this high over the sea (the island is a few metres high: docs/keri.md). */
  back: 9.2,
  overSea: 5.3,
  /** Fine pixels per radian: how wide the picture looks (about 80 degrees). */
  lens: 460,
  /** The horizon's row in the picture, in fine pixels: a third sky, the sea under it. */
  horizon: 84,
} as const;

/** The scene's picture has the room's size: a low wide band over the same strip. */
export const KNOLL_PICTURE = ROOM_PICTURE;
export const knollView = roomView;

const FINE = { w: KNOLL_PICTURE.w * ART_DETAIL, h: KNOLL_PICTURE.h * ART_DETAIL } as const;

/**
 * The knoll as it is painted, in fine pixels: a plateau, not a round hill (the knoll is a plateau
 * that rises gradually away from the house and cuts off abruptly to a drop to a rocky shore, where one could sit on the
 * edge with the feet over it). The viewer stands on
 * it; the ground rises gently to its lip, and over the lip is the sea. `top` is the lip's highest point, by the fire;
 * from there it falls a little to the picture's left edge (`left`, the row there) and to its `shoulder` on the right.
 * Past the shoulder the plateau cuts off: its lip falls `drop` rows within `wide` pixels, then its side comes toward
 * the viewer, `side` rows lower for each pixel right, with the rocky shore below it.
 */
export const KNOLL_PLATEAU = {
  top: { x: 300, y: 109 },
  left: { y: 117 },
  shoulder: { x: 452, y: 113 },
  cut: { wide: 12, drop: 24 },
  side: 0.46,
} as const;

/** The lip's small bumps and bites, so it is never ruled: a sum of a few slow waves, in rows. */
function tussocks(px: number): number {
  return 1.1 * Math.sin(px / 23 + 1) + 0.7 * Math.sin(px / 9.3 + 0.4) + 0.5 * Math.sin(px / 4.1 + 2);
}

/**
 * The row of the land's edge in a column of the picture, in fine pixels (not rounded): above it the sea and the shore
 * show, below it the plateau's top. Its lip across the picture, and past the shoulder the plateau's side edge.
 */
export function knollCrest(px: number): number {
  const { top, left, shoulder, cut, side } = KNOLL_PLATEAU;
  if (px <= shoulder.x) {
    const lip = px <= top.x ? top.y + (left.y - top.y) * Math.max(0, (top.x - px) / top.x) ** 1.6 : top.y + (shoulder.y - top.y) * ((px - top.x) / (shoulder.x - top.x)) ** 2;
    return lip + tussocks(px);
  }
  const past = px - shoulder.x, t = Math.min(1, past / cut.wide);
  // the cut: steep at once, as a bank breaks off, then the side running down toward the viewer with a few slumps in it
  return shoulder.y + tussocks(shoulder.x) + cut.drop * (1 - (1 - t) ** 2) + side * past + 5 * Math.sin(past / 23 + 0.5) + 2.4 * Math.sin(past / 7.3 + 1) + 1.2 * Math.sin(past / 3.1);
}

/** The fire ring near the plateau's lip, in fine pixels (seen from the house, the sea horizon meets the fireplace): its middle and its half width and half height as the viewer sees it. */
export const KNOLL_FIRE = { x: KNOLL_PLATEAU.top.x - 6, y: KNOLL_PLATEAU.top.y + 16, rx: 42, ry: 9 } as const;

/** The moon's place in the night's sky, in fine pixels: its middle and radius. The day's clouds start off it (`cloudCourses`). */
export const KNOLL_MOON = { x: 392, y: 25, r: 9 } as const;

/** Round the fire the grass is short, kept down by feet: this oval of the picture (fine pixels). */
export const KNOLL_CLEARING = { x: KNOLL_FIRE.x, y: KNOLL_FIRE.y + 13, rx: 118, ry: 30 } as const;

/** A point of the island (world metres) on the viewer's plan, in metres: `x` to the viewer's right and `z` toward the viewer, from the knoll. */
export function toKnoll(knoll: WorldPoint, p: WorldPoint): { x: number; z: number } {
  const a = (KNOLL.heading * Math.PI) / 180;
  const east = p.x - knoll.x, north = p.y - knoll.y;
  return { x: east * Math.cos(a) - north * Math.sin(a), z: -(east * Math.sin(a) + north * Math.cos(a)) };
}

/** The point of the island under a point of the viewer's plan: the other way of `toKnoll`. */
export function fromKnoll(knoll: WorldPoint, x: number, z: number): WorldPoint {
  const a = (KNOLL.heading * Math.PI) / 180;
  return { x: knoll.x + x * Math.cos(a) - z * Math.sin(a), y: knoll.y - x * Math.sin(a) - z * Math.cos(a) };
}

/** Where the knoll is on the island: the scene's place in the world model. */
export function knollPlace(world: World): WorldPoint {
  const scene = (world.scenes ?? []).find((s) => s.id === KNOLL_ID);
  if (!scene) throw new Error(`the world model has no scene "${KNOLL_ID}"`);
  return { x: scene.x, y: scene.y };
}

/** How far along a ray from `from` toward `(dx, dy)` (a unit vector) the ring is first crossed, in metres; `Infinity` when never. */
export function toRing(ring: World['coast'], from: WorldPoint, dx: number, dy: number): number {
  let best = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [px, py] = ring[j]!, [qx, qy] = ring[i]!;
    const ex = qx - px, ey = qy - py;
    const den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-12) continue;
    const t = ((px - from.x) * ey - (py - from.y) * ex) / den;
    const u = ((px - from.x) * dy - (py - from.y) * dx) / den;
    if (t > 0 && u >= 0 && u <= 1 && t < best) best = t;
  }
  return best;
}

/** One column of the picture: how far the water's edge is that way, and the row where the sea ends at it. */
export interface KnollShore {
  /** From the eye to the water's edge along this column, in metres. */
  far: number;
  /** The row of the water's edge, in fine pixels (not rounded). The plateau may stand before it (`knollCrest`). */
  water: number;
}

/**
 * The shore behind the knoll, column by column, from the world model's coast: the nearer the water, the lower its edge
 * in the picture. So the bay the viewer looks into is the real one.
 */
export function knollShore(world: World): KnollShore[] {
  const at = knollPlace(world);
  const eye = fromKnoll(at, 0, KNOLL.back);
  const out: KnollShore[] = [];
  for (let px = 0; px < FINE.w; px++) {
    const a = (px + 0.5 - FINE.w / 2) / KNOLL.lens;
    const there = fromKnoll(at, Math.sin(a), KNOLL.back - Math.cos(a));
    const far = toRing(world.coast, eye, there.x - eye.x, there.y - eye.y);
    out.push({ far, water: KNOLL.horizon + (KNOLL.lens * KNOLL.overSea) / far });
  }
  return out;
}

export interface KnollPlan {
  /** The picture's size in fine pixels. */
  fine: { w: number; h: number };
  /** The horizon's row, in fine pixels. */
  horizon: number;
  /** The embers' middle on the picture, in fine pixels: the smoke rises from here. */
  fire: { x: number; y: number };
}

export function knollPlan(): KnollPlan {
  return {
    fine: { ...FINE },
    horizon: KNOLL.horizon,
    fire: { x: KNOLL_FIRE.x, y: KNOLL_FIRE.y - 1 },
  };
}
