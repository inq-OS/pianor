import { buildingCorners, type World, type WorldPoint } from '../world/world';
import { ART_DETAIL } from './frame';
import { pictureView } from './room';

/**
 * The crossroads (d113): the concrete path's Y fork west of the lighthouse, where the track from the warden's house
 * parts, its left arm to the green board hut with the chimney (`hut-middle`) and its right arm on to the lighthouse.
 * The reference photograph is taken from the path a few metres before the fork,
 * with the warden's house just behind the viewer. Its picture is pixel
 * art as the knoll's (d111). Pure numbers; the painter is `game/ui/pixel/keri/crossroadsPicture.ts`.
 *
 * Where the fork, the paths, the hut, the lighthouse and the other houses stand in the picture comes from the world model
 * (d108). How large the houses are drawn is the painter's: taller than to scale so they read, as on the map.
 */

/** The scene's id in the world model (`scenes` in content/world/keri.json). */
export const CROSSROADS_ID = 'crossroads';

export const CROSSROADS = {
  /** The way the viewer looks, as a compass bearing in degrees: east, between the hut and the lighthouse, as the photograph does. */
  heading: 98,
  /** The eye: this far back from the fork along the track toward the warden's house (metres), this far to the left of it (below 0: to its right, where the photograph was taken from), and this high over the ground. */
  back: 7,
  aside: -1.4,
  eye: 1.5,
  /** How high the eye is over the sea (the island is a few metres high: docs/keri.md). */
  overSea: 4.5,
  /** Fine pixels per radian: a wide view, about 107 degrees, as wide as the photograph's. */
  lens: 300,
  /** The horizon's row, in fine pixels: a little under half the picture is sky. */
  horizon: 156,
  /** The near hut is drawn this much larger than to scale so it reads, the houses far off as they are; the lighthouse this tall in fine pixels from its foot. */
  hutScale: 1.5,
  towerTall: 112,
} as const;

/** The scene's picture has the room's size: a low wide band over the same strip. */
export const CROSSROADS_PICTURE = { w: 320, h: 180 } as const;
export const crossroadsView = pictureView(CROSSROADS_PICTURE);

const FINE = { w: CROSSROADS_PICTURE.w * ART_DETAIL, h: CROSSROADS_PICTURE.h * ART_DETAIL } as const;

/** Where the fork is on the island: the scene's place in the world model. */
export function crossroadsPlace(world: World): WorldPoint {
  const scene = (world.scenes ?? []).find((s) => s.id === CROSSROADS_ID);
  if (!scene) throw new Error(`the world model has no scene "${CROSSROADS_ID}"`);
  return { x: scene.x, y: scene.y };
}

/** A point on the viewer's ground, in metres: `x` to the viewer's right, `z` ahead of the eye. */
export interface Ground {
  x: number;
  z: number;
}

const rad = (deg: number): number => (deg * Math.PI) / 180;

/** The point of a polyline nearest to `p`, and the direction of the polyline there (a unit vector). */
function nearestOn(points: readonly (readonly [number, number])[], p: WorldPoint): { at: WorldPoint; dir: WorldPoint } {
  let best = { d: Infinity, at: p, dir: { x: 1, y: 0 } };
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1]!, [bx, by] = points[i]!;
    const ex = bx - ax, ey = by - ay, long = Math.hypot(ex, ey);
    const t = Math.max(0, Math.min(1, ((p.x - ax) * ex + (p.y - ay) * ey) / (long * long)));
    const at = { x: ax + ex * t, y: ay + ey * t };
    const d = Math.hypot(p.x - at.x, p.y - at.y);
    if (d < best.d) best = { d, at, dir: { x: ex / long, y: ey / long } };
  }
  return { at: best.at, dir: best.dir };
}

/** The track from the warden's house to the lighthouse: the path the viewer stands on. */
function track(world: World): readonly (readonly [number, number])[] {
  const path = world.paths?.find((p) => p.id === 'track-to-lighthouse');
  if (!path) throw new Error('the world model has no path "track-to-lighthouse"');
  return path.points;
}

/** Where the viewer's eye stands on the island: back from the fork along the track toward the warden's house, a little to its left. */
export function crossroadsEye(world: World): WorldPoint {
  const fork = crossroadsPlace(world);
  const { at, dir } = nearestOn(track(world), fork);
  // `dir` runs toward the lighthouse; back is the other way, and the viewer's left is the north side of the track
  const left = { x: -dir.y, y: dir.x };
  return { x: at.x - dir.x * CROSSROADS.back + left.x * CROSSROADS.aside, y: at.y - dir.y * CROSSROADS.back + left.y * CROSSROADS.aside };
}

/** A point of the island on the viewer's ground (metres). */
export function toCrossroads(eye: WorldPoint, p: WorldPoint): Ground {
  const a = rad(CROSSROADS.heading);
  const east = p.x - eye.x, north = p.y - eye.y;
  return { x: east * Math.cos(a) - north * Math.sin(a), z: east * Math.sin(a) + north * Math.cos(a) };
}

/** Where a point of the ground, `up` metres over it, is in the picture (fine pixels, not rounded). Only for `z` above 0. */
export function onPicture(g: Ground, up = 0): { x: number; y: number } {
  return { x: FINE.w / 2 + (CROSSROADS.lens * g.x) / g.z, y: CROSSROADS.horizon + (CROSSROADS.lens * (CROSSROADS.eye - up)) / g.z };
}

/** How far ahead the ground is under a row of the picture (metres); `Infinity` at and above the horizon. */
export function depthOfRow(y: number): number {
  return y <= CROSSROADS.horizon ? Infinity : (CROSSROADS.lens * CROSSROADS.eye) / (y - CROSSROADS.horizon);
}

/** How far along a ray from `from` toward `(dx, dy)` (a unit vector) the ring is first crossed, in metres; `Infinity` when never. */
function toRing(ring: World['coast'], from: WorldPoint, dx: number, dy: number): number {
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

/** The row in each column of the picture where the water ends at the far shore (fine pixels, not rounded): the island is low, so the sea shows over it where the shore is near. */
export function crossroadsShore(world: World): number[] {
  const eye = crossroadsEye(world);
  const a0 = rad(CROSSROADS.heading);
  return Array.from({ length: FINE.w }, (_, px) => {
    const a = a0 + Math.atan((px + 0.5 - FINE.w / 2) / CROSSROADS.lens);
    const far = toRing(world.coast, eye, Math.sin(a), Math.cos(a));
    return CROSSROADS.horizon + (CROSSROADS.lens * CROSSROADS.overSea) / far;
  });
}

/** A path on the viewer's ground: its middle line, near to far, and how wide it is (metres). */
export interface CrossroadsPath {
  id: string;
  points: Ground[];
  wide: number;
}

/** The world path `id` on the viewer's ground from its point nearest the fork onward. */
function armOf(world: World, eye: WorldPoint, id: string, fork: WorldPoint): Ground[] {
  const path = world.paths?.find((p) => p.id === id);
  if (!path) throw new Error(`the world model has no path "${id}"`);
  const from = nearestOn(path.points, fork).at;
  let start = 0, best = Infinity;
  path.points.forEach(([x, y], i) => {
    const d = Math.hypot(x - from.x, y - from.y) + (i === 0 ? 0 : 0.01);
    if (d < best) { best = d; start = i; }
  });
  return [{ ...toCrossroads(eye, fork) }, ...path.points.slice(start + 1).map(([x, y]) => toCrossroads(eye, { x, y }))];
}

/**
 * The concrete paths in the view: the stem from under the viewer's feet to the fork, the arm to the hut and the arm to
 * the lighthouse, each a strip of slabs about a metre wide (photograph 20; docs/keri/map.md).
 */
export function crossroadsPaths(world: World): CrossroadsPath[] {
  const eye = crossroadsEye(world), fork = crossroadsPlace(world);
  const forkHere = toCrossroads(eye, fork);
  // the stem comes from behind the viewer, along the track, beside the eye
  const stem = [{ x: CROSSROADS.aside * 0.9, z: 0.6 }, forkHere];
  return [
    { id: 'stem', points: stem, wide: 1.25 },
    { id: 'hut', points: armOf(world, eye, 'track-to-north-house', fork), wide: 1.0 },
    { id: 'lighthouse', points: armOf(world, eye, 'track-to-lighthouse', fork), wide: 1.0 },
  ];
}

/** A house in the view: its id, its corners on the viewer's ground (metres) and its world entry. */
export interface CrossroadsHouse {
  id: string;
  corners: Ground[];
  building: World['buildings'][number];
}

/** The houses that stand in the view (ahead of the eye, within the picture's width), far to near. */
export function crossroadsHouses(world: World): CrossroadsHouse[] {
  const eye = crossroadsEye(world);
  return world.buildings
    .map((building) => ({ id: building.id, building, corners: buildingCorners(building).map((p) => toCrossroads(eye, p)) }))
    .filter((h) => h.corners.every((c) => c.z > 2) && h.corners.some((c) => Math.abs(onPicture(c).x - FINE.w / 2) < FINE.w / 2 + 20))
    .sort((a, b) => Math.min(...b.corners.map((c) => c.z)) - Math.min(...a.corners.map((c) => c.z)));
}

export interface CrossroadsPlan {
  /** The picture's size in fine pixels. */
  fine: { w: number; h: number };
  /** The horizon's row, in fine pixels. */
  horizon: number;
}

export function crossroadsPlan(): CrossroadsPlan {
  return {
    fine: { ...FINE },
    horizon: CROSSROADS.horizon,
  };
}
