import type { World, WorldPoint } from '../world/world';
import { ART_DETAIL } from './frame';
import { toRing } from './knoll';
import { ROOM_PICTURE, roomView } from './room';

/**
 * The docks (ft_1_19, d113): the jetty on the north shore behind the warden's house (the reference aerial photograph,
 * option C), seen from the shingle where it starts, looking out along it to the big boulder it goes round, a birdwatching tower on its top.
 * Its picture is a painting in pixels like the knoll's (d111), and the jetty is wood and rope, not today's
 * aluminium (it should look more like the 1991 game, not modern). Pure numbers; the painter is
 * `game/ui/pixel/keri/docksPicture.ts`.
 *
 * From the world model come the way the viewer looks and the shore in each column (`docksShore`), so the little bay
 * between the two points of land is the real one. The jetty's way, the tower and the props are the painter's after the art direction; the boulders, placed after
 * the reference photographs, in metres on the viewer's plan: `x` to the right, `z` ahead, `y` up from the sea.
 */

/** The scene's id in the world model (`scenes` in content/world/keri.json). */
export const DOCKS_ID = 'docks';

export const DOCKS = {
  /** The way the viewer looks, as a compass bearing in degrees: north-north-east; the jetty runs out a little west of north, so it leads from the lower right into the middle. */
  heading: 21,
  /** The eye stands on the shingle where the jetty starts: this far east and north of the scene's place (the jetty's middle, metres), this high over the sea. */
  eye: { east: -0.7, north: -20.9 },
  overSea: 2.9,
  /** Fine pixels per radian: how wide the picture looks (about 78 degrees). */
  lens: 470,
  /** The horizon's row in the picture, in fine pixels: a little over a third sky. */
  horizon: 90,
  /**
   * The 1991 game's bent wide-angle look, never a camera's (it must not try
   * to look realistic, and quirks are welcome): how much a level line bows toward the picture's edges, in fine pixels per (fine
   * pixel from the middle) squared, and how much what stands up fans out from the middle the higher it reaches over
   * the horizon (and draws in a little below it), as a share of its distance from the middle per horizon's height.
   * The bow is 0: the 1991 game's horizons are straight, and the
   * quirk stays in what stands up (the splay) and in the drawing.
   */
  bow: 0,
  splay: 0.3,
} as const;

/** The scene's picture has the room's size: a low wide band over the same strip. */
export const DOCKS_PICTURE = ROOM_PICTURE;
export const docksView = roomView;

const FINE = { w: DOCKS_PICTURE.w * ART_DETAIL, h: DOCKS_PICTURE.h * ART_DETAIL } as const;

/** The big boulder the walk goes round (the reference photograph of the jetty: the walk goes around the big rock): its middle, its half width and its height over the sea. */
export const BOULDER = { x: 2, z: 30.5, r: 4.2, high: 3.2 } as const;

/** How far from the boulder's middle the walk's middle line runs where it goes round it (metres). */
const ROUND = BOULDER.r + 1.5;

/** A point on the walk's way round the boulder, at a bearing from its middle (degrees, 0 to the right, 90 straight ahead). */
function round(deg: number): readonly [number, number] {
  const a = (deg * Math.PI) / 180;
  return [BOULDER.x + ROUND * Math.cos(a), BOULDER.z + ROUND * Math.sin(a)];
}

/**
 * The walk's middle line, in metres on the viewer's plan: from its root on the shingle out to the boulder, then round
 * its left side to the landing behind it (the walk comes around the rock from the left side
 * and the landing area is behind the rock). A smooth line through these points.
 */
const WAY: readonly (readonly [number, number])[] = [[3.2, 4.2], [2.2, 12], [0.4, 18.5], [-2.2, 23.5], round(205), round(180), round(150), round(120), round(95), round(80)];

/** Catmull-Rom through the way's points, sampled finely, each sample with its distance from the root. */
const LINE: readonly { x: number; z: number; s: number }[] = (() => {
  const out: { x: number; z: number; s: number }[] = [];
  const at = (i: number) => WAY[Math.max(0, Math.min(WAY.length - 1, i))]!;
  for (let i = 0; i < WAY.length - 1; i++) for (let k = 0; k < 40; k++) {
    const t = k / 40, [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (3 * b - a - 3 * c + d) * t * t * t);
    out.push({ x: f(p0[0], p1[0], p2[0], p3[0]), z: f(p0[1], p1[1], p2[1], p3[1]), s: 0 });
  }
  const last = WAY[WAY.length - 1]!;
  out.push({ x: last[0], z: last[1], s: 0 });
  for (let i = 1; i < out.length; i++) out[i]!.s = out[i - 1]!.s + Math.hypot(out[i]!.x - out[i - 1]!.x, out[i]!.z - out[i - 1]!.z);
  return out;
})();

/**
 * The jetty, in metres on the viewer's plan: its root on the shingle (`from`), its end on the boulder's far left (`to`),
 * its length along its way, its deck this high over the sea and this wide, a pair of legs every `legs` metres, the rope
 * rail on its outer side this high over the deck. Longer and higher than the real one, so it reads as the place's big thing (rule 4).
 */
export const JETTY = {
  from: { x: WAY[0]![0], z: WAY[0]![1] },
  to: { x: WAY[WAY.length - 1]![0], z: WAY[WAY.length - 1]![1] },
  long: LINE[LINE.length - 1]!.s,
  deck: 1.0,
  wide: 1.6,
  legs: 2.9,
  rail: 1.05,
} as const;

/** The walk's middle at `s` metres from its root, and the way it runs there (a unit vector on the plan). */
export function jettyAt(s: number): { x: number; z: number; ux: number; uz: number } {
  const t = Math.max(0, Math.min(JETTY.long, s));
  let lo = 0, hi = LINE.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (LINE[mid]!.s <= t) lo = mid;
    else hi = mid;
  }
  const a = LINE[lo]!, b = LINE[hi]!;
  const f = b.s > a.s ? (t - a.s) / (b.s - a.s) : 0;
  const long = Math.hypot(b.x - a.x, b.z - a.z) || 1;
  return { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f, ux: (b.x - a.x) / long, uz: (b.z - a.z) / long };
}

/**
 * The landing behind the boulder where boats come in (the landing area is behind the rock): a deck at
 * the walk's end, from `x0` to `x1` and `z0` to `z1` (metres), its right end showing past the boulder.
 */
export const LANDING = { x0: 0.8, x1: 8.2, z0: 35.8, z1: 37.9 } as const;

/**
 * The birdwatching hut on the boulder's top (a small roofed tower on top, which can be a further scene later, more
 * a birdwatching tower than a hut to stay in; then: a tall tower on legs was too high and featureless, and for a
 * thatched lookout like the 1991 game's treehouses, option B without the legs, built directly on top of the stone, so
 * that in a future scene the stone is the floor of the hut): corner posts set straight into the rock round a square `half` metres from its middle (half
 * width), turned by `yaw` degrees; the stone is its floor at `base` over the sea; an open rail `rail` high; the eaves
 * `posts` over the floor; a round thatched roof rising `roof` over them and reaching `eaves` past the posts.
 */
export const TOWER = { x: BOULDER.x + 0.2, z: BOULDER.z + 0.4, half: 1.55, yaw: 22, base: BOULDER.high - 0.25, rail: 0.85, posts: 1.6, roof: 1.9, eaves: 1.0 } as const;

/** The hut's floor (the stone) and its eaves, over the sea (metres). */
export const TOWER_FLOOR = TOWER.base;
export const TOWER_EAVES = TOWER_FLOOR + TOWER.posts;

/** A corner of the hut: `a` and `b` are -1 or 1 (left or right, near or far before it is turned). */
export function towerCorner(a: number, b: number): { x: number; z: number } {
  const t = (TOWER.yaw * Math.PI) / 180, u = a * TOWER.half, v = b * TOWER.half;
  return { x: TOWER.x + u * Math.cos(t) + v * Math.sin(t), z: TOWER.z - u * Math.sin(t) + v * Math.cos(t) };
}

/** Boulders in the shallow water round the jetty, as on the reference photographs: each its place and half width (metres). */
export const DOCKS_ROCKS: readonly { x: number; z: number; r: number }[] = [
  { x: -12, z: 15, r: 1.2 }, { x: -8.5, z: 25, r: 0.8 }, { x: -19, z: 31, r: 1.7 }, { x: -5, z: 44, r: 0.9 },
  { x: 16, z: 18, r: 1.3 }, { x: 22, z: 34, r: 1.9 }, { x: 15, z: 50, r: 1.0 }, { x: 27, z: 14, r: 0.8 },
  { x: -26, z: 18, r: 0.9 }, { x: 31, z: 46, r: 1.2 }, { x: 4.5, z: 52, r: 0.7 },
];

/** Where the docks are on the island: the scene's place in the world model. */
export function docksPlace(world: World): WorldPoint {
  const scene = (world.scenes ?? []).find((s) => s.id === DOCKS_ID);
  if (!scene) throw new Error(`the world model has no scene "${DOCKS_ID}"`);
  return { x: scene.x, y: scene.y };
}

/** A point of the viewer's plan (metres right and ahead of the eye) on the island. */
export function fromDocks(place: WorldPoint, x: number, z: number): WorldPoint {
  const a = (DOCKS.heading * Math.PI) / 180;
  const eye = { x: place.x + DOCKS.eye.east, y: place.y + DOCKS.eye.north };
  return { x: eye.x + x * Math.cos(a) + z * Math.sin(a), y: eye.y - x * Math.sin(a) + z * Math.cos(a) };
}

/** How much a column is pushed out from the middle at a row: more the higher over the horizon, a little less below it. */
function fan(row: number): number {
  const up = (DOCKS.horizon - row) / DOCKS.horizon;
  return 1 + DOCKS.splay * (up > 0 ? up : up * 0.25);
}

/** Where a point of the viewer's plan (metres: `x` right, `y` up from the sea, `z` ahead) lands on the picture, in fine pixels, and how far it is. */
export function docksProject(x: number, y: number, z: number): { x: number; y: number; far: number } {
  const sx = (DOCKS.lens * x) / z;
  const dy = y - DOCKS.overSea;
  // level lines bow: a line under the eye sags toward the edges, one over it rises; then what stands up fans out
  const sy = DOCKS.horizon - (DOCKS.lens * dy) / z - Math.sign(dy) * DOCKS.bow * sx ** 2;
  return { x: FINE.w / 2 + sx * fan(sy), y: sy, far: z };
}

/** The horizon's row in a column of the picture (fine pixels, not rounded): it bows down toward the edges with the level lines. */
export function docksHorizon(px: number): number {
  return DOCKS.horizon + DOCKS.bow * (px - FINE.w / 2) ** 2;
}

/** The sea's (or the shingle's) point under a pixel below the horizon: metres right and ahead of the eye (`docksProject` undone). */
export function docksGround(px: number, py: number): { x: number; z: number } | null {
  const sx = (px - FINE.w / 2) / fan(py);
  const row = py - DOCKS.bow * sx ** 2;
  if (row <= DOCKS.horizon) return null;
  const z = (DOCKS.lens * DOCKS.overSea) / (row - DOCKS.horizon);
  return { x: (sx * z) / DOCKS.lens, z };
}

/** One column of the picture: how far ahead the water's edge is, in metres (`Infinity` when the column looks along the shore). */
export interface DocksShore {
  far: number;
  /** The row of the water's edge, in fine pixels (not rounded). */
  water: number;
}

/** The shore before the viewer, column by column, from the world model's coast: the bay between its two points is the real one. */
export function docksShore(world: World): DocksShore[] {
  const raw = shoreColumns(world);
  // a step in the coast (the spit on the right stands further out than the bay before it) would leave a sheer cliff
  // edge in the picture: the water's row is eased over a few columns, so the land runs down into the sea instead
  return raw.map((_, px) => {
    let sum = 0, weight = 0;
    for (let k = -SHORE_EASE; k <= SHORE_EASE; k++) {
      const c = raw[Math.max(0, Math.min(raw.length - 1, px + k))]!;
      const w = SHORE_EASE + 1 - Math.abs(k);
      sum += c.water * w; weight += w;
    }
    const water = sum / weight;
    const far = water > DOCKS.horizon ? (DOCKS.lens * DOCKS.overSea) / (water - DOCKS.horizon) : Infinity;
    return { far, water };
  });
}

/** How many columns either side of one the water's row is eased over (fine pixels). */
const SHORE_EASE = 18;

function shoreColumns(world: World): DocksShore[] {
  const place = docksPlace(world);
  const eye = fromDocks(place, 0, 0);
  return Array.from({ length: FINE.w }, (_, px) => {
    // the picture's columns are bent: find the column of the plan at the water's row, a few times over
    let water = DOCKS.horizon + 40, far = Infinity;
    for (let k = 0; k < 4; k++) {
      const sx = (px + 0.5 - FINE.w / 2) / fan(water);
      const a = Math.atan(sx / DOCKS.lens);
      const there = fromDocks(place, Math.sin(a), Math.cos(a));
      // the distance along the ray is measured slant; the floor's rows go by the distance ahead
      far = toRing(world.coast, eye, there.x - eye.x, there.y - eye.y) * Math.cos(a);
      water = DOCKS.horizon + (DOCKS.lens * DOCKS.overSea) / far + DOCKS.bow * sx ** 2;
    }
    return { far, water };
  });
}

export interface DocksPlan {
  /** The picture's size in fine pixels. */
  fine: { w: number; h: number };
  /** The horizon's row, in fine pixels. */
  horizon: number;
  /** Where the lantern hangs from the lamp post's arm, in fine pixels: its light glows round it at dusk and night. */
  lamp: { x: number; y: number };
}

/** The lantern's bracket on the tower's near right corner post, under the eaves: the post, the bracket's height over the sea and how far its arm reaches out to the right (metres). A prop. */
export const LAMP = { ...towerCorner(1, -1), y: TOWER_EAVES - 0.35, arm: 0.45 } as const;

export function docksPlan(): DocksPlan {
  const hook = docksProject(LAMP.x + LAMP.arm, LAMP.y - 0.04, LAMP.z);
  return { fine: { ...FINE }, horizon: DOCKS.horizon, lamp: { x: Math.round(hook.x), y: Math.round(hook.y) } };
}
