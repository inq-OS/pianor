/**
 * The world model of Keri (d108, AX-3 provisional): the island in local metres, x east, y north, the lighthouse at the
 * origin. The data is content (content/world/keri.json), traced from the Maa- ja Ruumiamet orthophoto; places are marked
 * on it (ft_1_18). Persisted-format rules: the file has a `schemaVersion`, and a new version needs a migration
 * (docs/testing.md section 4). The JSON import is done by the caller; this module only validates and measures.
 */
import { z } from 'zod';

const pointSchema = z.tuple([z.number(), z.number()]);
const ringSchema = z.array(pointSchema).min(3);
const placeSchema = z.object({ x: z.number(), y: z.number() });

/** A building's roof as a rectangle: its centre, its long and short side in metres, and the long side's angle (degrees, counter-clockwise from east). */
const buildingSchema = z.object({
  id: z.string().min(1),
  x: z.number(),
  y: z.number(),
  long: z.number().positive(),
  short: z.number().positive(),
  angle: z.number(),
  /** What the reference photographs show of it (all optional: a plain pale house with a ridged tin roof without them). */
  shape: z.enum(['gable', 'hip', 'flat']).optional(),
  roof: z.enum(['tin', 'blue', 'red', 'dark', 'boards']).optional(),
  walls: z.enum(['plaster', 'yellow', 'boards', 'green']).optional(),
  /** A porch in the middle of the long side that faces south; a chimney on a small house (a large one has its own). */
  porch: z.boolean().optional(),
  chimney: z.boolean().optional(),
});

/**
 * A thing at one point that is no house: the lattice mast at the warden's house, the wooden terrace before the house's
 * main door, the concrete helicopter pad in the west (marked on the orthophoto), the memorial
 * between the sauna and the lighthouse (circled on the map).
 */
const landmarkSchema = z.object({ id: z.string().min(1), kind: z.enum(['mast', 'terrace', 'helipad', 'memorial']), x: z.number(), y: z.number() });

/** A way: the footpath round the island (dotted on the base map), a track (dashed), or the boat slipway, whose rails run from the shore into the sea; its points in order. */
const pathSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['footpath', 'track', 'slipway']),
  points: z.array(pointSchema).min(2),
});

/**
 * A scene (ft_1_19, d112): a place on the island where beings to be tamed are found, opened from the map once the student
 * has reached `level`. Its id names its picture and its texts.
 */
const sceneSchema = z.object({ id: z.string().min(1), x: z.number(), y: z.number(), level: z.number().int().min(1), note: z.string().optional() });

export const worldSchema = z.object({
  schemaVersion: z.literal(1),
  note: z.string().optional(),
  origin: z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180), what: z.string().optional() }),
  coast: ringSchema,
  grass: ringSchema,
  buildings: z.array(buildingSchema),
  landmarks: z.array(landmarkSchema).optional(),
  scenes: z.array(sceneSchema).optional(),
  paths: z.array(pathSchema),
  places: z.object({ lighthouse: placeSchema, livingRoom: placeSchema, northShore: placeSchema }),
});

export type World = z.infer<typeof worldSchema>;
export type WorldPoint = { readonly x: number; readonly y: number };
type Ring = readonly (readonly [number, number])[];

/** The world file, validated; throws with zod's message when it is not sound. */
export function loadWorld(json: unknown): World {
  return worldSchema.parse(json);
}

/** Whether `p` lies inside the polygon `ring` (even-odd rule; a point exactly on an edge may go either way). */
export function insideRing(ring: Ring, p: WorldPoint): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Whether `p` is on land (inside the coast). */
export function onLand(world: World, p: WorldPoint): boolean {
  return insideRing(world.coast, p);
}

/** The distance between two points, in metres. */
export function distance(a: WorldPoint, b: WorldPoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** The compass bearing from `a` to `b`, in degrees: 0 north, 90 east, 180 south, 270 west. */
export function bearing(a: WorldPoint, b: WorldPoint): number {
  const deg = (Math.atan2(b.x - a.x, b.y - a.y) * 180) / Math.PI;
  return (deg + 360) % 360;
}

/** A building's four roof corners, in metres. */
export function buildingCorners(b: World['buildings'][number]): WorldPoint[] {
  const a = (b.angle * Math.PI) / 180;
  const ux = Math.cos(a), uy = Math.sin(a);
  const hl = b.long / 2, hs = b.short / 2;
  return [
    [-hl, -hs], [hl, -hs], [hl, hs], [-hl, hs],
  ].map(([l, s]) => ({ x: b.x + l! * ux - s! * uy, y: b.y + l! * uy + s! * ux }));
}

/** The smallest box round the coast, in metres. */
export function worldBounds(world: World): { minX: number; maxX: number; minY: number; maxY: number } {
  const xs = world.coast.map((p) => p[0]), ys = world.coast.map((p) => p[1]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

/**
 * A view of the world on a screen, north up (ft_1_18.AC2): where a point lands. With `tilt` 1 it is straight from above;
 * with less the island is seen at a slant from the south, as on an illustrated map: a north-south metre is drawn `tilt`
 * times as long as an east-west one, and what stands up rises on the screen.
 */
export interface MapView {
  /** Pixels per metre, east to west. */
  readonly scale: number;
  readonly tilt: number;
  /** Where a point lands; `up` is its height over the ground in metres. */
  toScreen(p: WorldPoint, up?: number): { x: number; y: number };
  /** The point of the ground under a pixel. */
  toWorld(x: number, y: number): WorldPoint;
}

/** The view that fits the whole coast into `box` (pixels) with `margin` pixels free on every side, centred. */
export function fitMap(world: World, box: { x?: number; y?: number; w: number; h: number }, margin: number, tilt = 1): MapView {
  const b = worldBounds(world);
  const scale = Math.min((box.w - 2 * margin) / (b.maxX - b.minX), (box.h - 2 * margin) / ((b.maxY - b.minY) * tilt));
  const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
  const ox = (box.x ?? 0) + box.w / 2, oy = (box.y ?? 0) + box.h / 2;
  // a tilt of cos(angle) from straight above shows heights by sin(angle)
  const rise = Math.sqrt(1 - tilt * tilt);
  return {
    scale,
    tilt,
    toScreen: (p, up = 0) => ({ x: ox + (p.x - cx) * scale, y: oy - (p.y - cy) * scale * tilt - up * scale * rise }),
    toWorld: (x, y) => ({ x: cx + (x - ox) / scale, y: cy - (y - oy) / (scale * tilt) }),
  };
}
