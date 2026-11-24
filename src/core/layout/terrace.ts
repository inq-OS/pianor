import { insideRing, type World, type WorldPoint } from '../world/world';
import { ART_DETAIL } from './frame';
import { toRing } from './knoll';
import { ROOM_PICTURE, roomView } from './room';

/**
 * The terrace (ft_1_19, d113): the wooden deck before the main door of the warden's house, seen from its end by the
 * door, looking away from the house, a little south of west, over the deck and the shingle to the sea (the
 * marks on the reference drone photograph: the terrace, looking away from the house, slightly south-west). Its picture is a
 * painting in pixels like the docks' (d111). The real terrace is a plain deck with a pipe rail and red benches; this
 * one has more on it and reaches further (more features than the real one has, extending further out over the beach): from its seaward side a walk of boards on piles runs out over
 * the beach to a head over the water (a boat's bow stood there in passes 1 and 2; a deck with
 * features and character is better, the boat was too much), and on the head stands a small watchtower (`TOWER`). Pure numbers; the painter is
 * `game/ui/pixel/keri/terracePicture.ts`.
 *
 * From the world model come the way the viewer looks and the shore in each column (`terraceShore`). The deck, the
 * walk and what stands on them are the painter's, in metres on the viewer's plan: `x` to the right, `z` ahead, `y` up
 * from the sea.
 */

/** The scene's id in the world model (`scenes` in content/world/keri.json). */
export const TERRACE_ID = 'terrace';

export const TERRACE = {
  /** The way the viewer looks, as a compass bearing in degrees: west-south-west, away from the house's front (which faces 205). */
  heading: 240,
  /** The eye stands on the deck's end by the door: this far east and north of the scene's place (the deck's seaward edge, metres). */
  eye: { east: 7.5, north: 5 },
  /** The eye over the sea (metres): 1.7 over the deck. The house stands low by the shore, so the shingle shows down to the water. */
  overSea: 3.6,
  /** Fine pixels per radian: how wide the picture looks (about 80 degrees). */
  lens: 380,
  /** The horizon's row in the picture, in fine pixels: a third sky. */
  horizon: 84,
} as const;

/** The scene's picture has the room's size: a low wide band over the same strip. */
export const TERRACE_PICTURE = ROOM_PICTURE;
export const terraceView = roomView;

const FINE = { w: TERRACE_PICTURE.w * ART_DETAIL, h: TERRACE_PICTURE.h * ART_DETAIL } as const;

/** A point on the viewer's plan, metres: `x` right, `y` up from the sea, `z` ahead. */
export type P3 = readonly [number, number, number];

/**
 * The ground: before the house it lies `top` metres over the sea, and from the water's edge the shingle rises to it
 * over `beach` metres (docs/keri.md: the middle of the island is three to four metres over the waterline; the house
 * stands lower, by the shore). AX-3 provisional: nobody has measured the ground here; these are the painter's, low
 * and gentle enough that the eye on the deck sees the whole beach down to the surf.
 */
export const TERRACE_LAND = { top: 1.6, beach: 14 } as const;

/**
 * The deck, in its own frame: `u` runs along the house's front (to the viewer's right and ahead), `v` away from the
 * house toward the sea (to the left and ahead); `turn` is how far `u` lies right of the way the viewer looks (degrees).
 * It reaches from `u0` to `u1` and from `v0` to `v1` (metres from the eye), its boards `y` over the sea. The seaward
 * edge is `v1`.
 */
export const DECK = { turn: 55, u0: -1.2, u1: 10.6, v0: -2, v1: 6.5, y: TERRACE.overSea - 1.7 } as const;

const TURN = (DECK.turn * Math.PI) / 180;
const U = { x: Math.sin(TURN), z: Math.cos(TURN) } as const;
const V = { x: -Math.cos(TURN), z: Math.sin(TURN) } as const;

/** A point of the deck's frame on the viewer's plan, `up` metres over the deck's boards. */
export function onDeck(u: number, v: number, up = 0): P3 {
  return [u * U.x + v * V.x, DECK.y + up, u * U.z + v * V.z];
}

/** A point of the viewer's plan in the deck's frame. */
export function deckOf(x: number, z: number): { u: number; v: number } {
  return { u: x * U.x + z * U.z, v: x * V.x + z * V.z };
}

/**
 * The reach over the beach (the painter's, extended further out over the beach, with
 * features and character): a walk of boards on piles that leaves the deck's seaward edge between `u0` and `u1`, a
 * step (`drop`) lower, and runs `long` metres along `v` to a head `deep` metres long, wider than the walk (`head`),
 * that stands at the water's edge. Nothing leads from it down to the water.
 */
export const REACH = { u0: 2.3, u1: 6.3, long: 9.2, drop: 0.3, deep: 5.6, head: { u0: 0.8, u1: 8 } } as const;

/** A point over the reach's boards: `u` across it as on the deck, `t` metres out from the deck's seaward edge, `up` over its boards. */
export function onReach(u: number, t: number, up = 0): P3 {
  return onDeck(u, DECK.v1 + t, up - REACH.drop);
}

/** The reach's two sides `t` metres out: the walk's, or the head's past the walk's end. */
export function reachSides(t: number): { u0: number; u1: number } {
  return t > REACH.long ? { ...REACH.head } : { u0: REACH.u0, u1: REACH.u1 };
}

/** Whether a point of the deck's frame lies under the reach's boards. */
export function underReach(u: number, v: number): boolean {
  const t = v - DECK.v1;
  if (t < 0 || t > REACH.long + REACH.deep) return false;
  const { u0, u1 } = reachSides(t);
  return u >= u0 && u <= u1;
}

/**
 * The watchtower on the head's seaward corner (the section that reaches furthest over the beach
 * can have a roofed part, perhaps a small watchtower of about two floors with a fixed telescope to scan the
 * horizon): four posts on the head's boards from `u0` to `u1` and `t0` to `t1` metres out, a floor `floor` metres
 * up with a rail round it, a roof whose eave is `eave` up and stands `over` out past the posts, its peak `peak` up
 * and a staff `staff` over that. It leans: for each metre up it stands `lean` metres further to the viewer's right.
 * The painter's, not Keri's.
 */
export const TOWER = { u0: 1.3, u1: 3.7, t0: 11.9, t1: 14.3, floor: 2.4, rail: 0.9, eave: 4.2, over: 0.45, peak: 5.2, staff: 0.4, lean: 0.035 } as const;

/** A point of the watchtower: `a` across it from its `u0` side (0) to its `u1` side (1), `b` from its landward side (0) out to its seaward side (1), `up` metres over the head's boards. Outside 0 to 1 it is out past the posts. */
export function onTower(a: number, b: number, up = 0): P3 {
  const [x, y, z] = onReach(TOWER.u0 + (TOWER.u1 - TOWER.u0) * a, TOWER.t0 + (TOWER.t1 - TOWER.t0) * b, up);
  return [x + TOWER.lean * up, y, z];
}

/** The lantern's hook: under an arm at the tower's corner toward the walk, below the eave. */
export function lampHook(): P3 {
  return onTower(1.32, -0.12, TOWER.eave - 0.75);
}

/**
 * The long-eye on the tower's floor (a long spyglass fixed on a post, the fixed telescope): where its post
 * stands, how high its pivot is over the floor, how long its tube is, and the way it points on the viewer's plan (to
 * the left and a little away, out along the horizon). It stands by the tower's left side, so that most of its tube
 * is out past the posts, against the sky.
 */
export const LONG_EYE = { a: 0.14, b: 0.3, high: 1.3, long: 2.1, aim: { x: -0.97, z: 0.24 } } as const;

/** The grill by the deck's seaward rail (the terrace's own, on the photographs: half a barrel on legs), its place in the deck's frame. */
export const GRILL = { u: 6.9, v: 5.7, r: 0.36, high: 0.9 } as const;

/**
 * The terrace's torches (torches at night, the terrace being like the village plaza): standing torches lashed to posts of the rails, round the deck and down the walk's right
 * side, where the village gathers of an evening (the head has the watchtower's lantern). Each has its foot `on` the deck's boards (`u`, `v` of
 * the deck's frame) or the walk's (`u`, and `v` metres out from the deck's edge), and its head `high` over those
 * boards; none stands plumb (`lean` metres to the viewer's right for each metre up). Unlit by day; they burn at dusk and night, as the lantern does. The painter's, not Keri's.
 */
export const TORCHES: readonly { on: 'deck' | 'reach'; u: number; v: number; high: number; lean: number }[] = [
  { on: 'deck', u: -0.2, v: DECK.v1 - 0.1, high: 1.6, lean: 0.05 },
  // two down the walk's right side
  { on: 'reach', u: REACH.u1 - 0.1, v: 1.6, high: 1.5, lean: -0.05 },
  // the further one is low, its flame under the string of lanterns there
  { on: 'reach', u: REACH.u1 - 0.1, v: 5.8, high: 1.1, lean: 0.04 },
  { on: 'deck', u: DECK.u1 - 0.12, v: DECK.v1 - 0.12, high: 2.0, lean: -0.04 },
  { on: 'deck', u: DECK.u1 - 0.12, v: 3.05, high: 1.75, lean: 0.06 },
  // a low pair at the walk's mouth, a gate of fire, their flames under the string of lanterns
  { on: 'deck', u: REACH.u0 - 0.35, v: DECK.v1 - 0.1, high: 1.15, lean: -0.06 },
  { on: 'deck', u: REACH.u1 + 0.35, v: DECK.v1 - 0.1, high: 1.1, lean: 0.05 },
];

/** The torches that throw sparks in the game: the two nearest the eye, by their place in `TORCHES`. */
export const TORCH_SPARKS: readonly number[] = [0, 5];

/** How tall a torch's flame stands over its head, in metres. */
export const TORCH_FLAME = 0.5;

/** A point `up` metres over the foot of a torch of `TORCHES`. */
export function onTorch(torch: (typeof TORCHES)[number], up = 0): P3 {
  const [x, y, z] = torch.on === 'deck' ? onDeck(torch.u, torch.v, up) : onReach(torch.u, torch.v, up);
  return [x + torch.lean * up, y, z];
}

/** Boulders in the shallows, as on the reference drone photograph: each its place and half width (metres on the viewer's plan). */
export const TERRACE_ROCKS: readonly { x: number; z: number; r: number }[] = [
  { x: -14.5, z: 19.6, r: 1.3 }, { x: -21, z: 27, r: 1.6 }, { x: -6, z: 38, r: 1.9 }, { x: 9, z: 37, r: 0.9 },
  { x: 17, z: 52, r: 2.2 }, { x: -30, z: 46, r: 1.4 }, { x: 28, z: 70, r: 2.6 }, { x: -2, z: 62, r: 1.1 }, { x: 41, z: 96, r: 3.0 },
];

/** Where the terrace is on the island: the scene's place in the world model. */
export function terracePlace(world: World): WorldPoint {
  const scene = (world.scenes ?? []).find((s) => s.id === TERRACE_ID);
  if (!scene) throw new Error(`the world model has no scene "${TERRACE_ID}"`);
  return { x: scene.x, y: scene.y };
}

/** A point of the viewer's plan (metres right and ahead of the eye) on the island. */
export function fromTerrace(place: WorldPoint, x: number, z: number): WorldPoint {
  const a = (TERRACE.heading * Math.PI) / 180;
  const eye = { x: place.x + TERRACE.eye.east, y: place.y + TERRACE.eye.north };
  return { x: eye.x + x * Math.cos(a) + z * Math.sin(a), y: eye.y - x * Math.sin(a) + z * Math.cos(a) };
}

/** Where a point of the viewer's plan lands on the picture, in fine pixels, and how far ahead it is. */
export function terraceProject(x: number, y: number, z: number): { x: number; y: number; far: number } {
  const far = Math.max(0.05, z);
  return { x: FINE.w / 2 + (TERRACE.lens * x) / far, y: TERRACE.horizon - (TERRACE.lens * (y - TERRACE.overSea)) / far, far };
}

/** Whether a point of the viewer's plan lies on the island's grass (the world model's grass ring), not on its shingle. */
export function terraceGrassy(world: World, place: WorldPoint, x: number, z: number): boolean {
  return insideRing(world.grass, fromTerrace(place, x, z));
}

/** One column of the picture: how far ahead the water's edge is, in metres. */
export interface TerraceShore {
  far: number;
}

/** How many columns either side of one the shore is eased over (fine pixels), so a step in the traced coast is no cliff. */
const SHORE_EASE = 14;

/** The shore before the viewer, column by column, from the world model's coast. */
export function terraceShore(world: World): TerraceShore[] {
  const place = terracePlace(world);
  const eye = fromTerrace(place, 0, 0);
  const raw = Array.from({ length: FINE.w }, (_, px) => {
    const a = Math.atan((px + 0.5 - FINE.w / 2) / TERRACE.lens);
    const there = fromTerrace(place, Math.sin(a), Math.cos(a));
    // the distance along the ray is slant; the floor's rows go by the distance ahead
    return toRing(world.coast, eye, there.x - eye.x, there.y - eye.y) * Math.cos(a);
  });
  return raw.map((_, px) => {
    let sum = 0, weight = 0;
    for (let k = -SHORE_EASE; k <= SHORE_EASE; k++) {
      const w = SHORE_EASE + 1 - Math.abs(k);
      sum += Math.min(400, raw[Math.max(0, Math.min(raw.length - 1, px + k))]!) * w; weight += w;
    }
    return { far: sum / weight };
  });
}

/** The ground's height over the sea `inland` metres from the water's edge: a flat wet foot, then the shingle's bank up to the ground before the house. */
export function terraceRise(inland: number): number {
  const t = Math.max(0, Math.min(1, inland / TERRACE_LAND.beach));
  return TERRACE_LAND.top * t ** 1.25;
}

/** What the floor is under a pixel below the horizon. */
export interface TerraceFloor {
  /** The sea, or the land (the shingle and what grows on it). */
  wet: boolean;
  /** The point on the viewer's plan (metres) and its height over the sea. */
  x: number;
  z: number;
  y: number;
  /** How far inland of the water's edge it lies, along the way the viewer looks (metres; under 0 on the sea). */
  inland: number;
}

/** How many steps the eye's ray is walked in from the ground before the house to the water's edge. */
const FLOOR_STEPS = 48;

/**
 * The floor under a pixel: the land where the eye's ray first meets its rise, else the sea. Null above the horizon.
 * The ray is walked out from where it comes down to the ground's level before the house, since a bank may hide the
 * shingle under it.
 */
export function terraceFloor(shore: readonly TerraceShore[], px: number, py: number): TerraceFloor | null {
  const down = py - TERRACE.horizon;
  if (down <= 0) return null;
  const far = shore[Math.max(0, Math.min(shore.length - 1, Math.round(px)))]!.far;
  const side = (px + 0.5 - FINE.w / 2) / TERRACE.lens;
  // how far the ray is over the ground `z` metres ahead
  const over = (z: number): number => TERRACE.overSea - (down * z) / TERRACE.lens - terraceRise(far - z);
  const sea = (TERRACE.lens * TERRACE.overSea) / down;
  const land = (z: number): TerraceFloor => ({ wet: false, x: side * z, z, y: terraceRise(far - z), inland: far - z });
  const from = (TERRACE.lens * (TERRACE.overSea - TERRACE_LAND.top)) / down, to = Math.min(sea, far);
  if (from >= to) return sea >= far ? { wet: true, x: side * sea, z: sea, y: 0, inland: far - sea } : land(sea);
  if (over(from) <= 0) return land(from);
  let lo = from;
  for (let k = 1; k <= FLOOR_STEPS; k++) {
    const z = from + ((to - from) * k) / FLOOR_STEPS;
    if (over(z) > 0) { lo = z; continue; }
    let hi = z;
    for (let n = 0; n < 12; n++) {
      const mid = (lo + hi) / 2;
      if (over(mid) > 0) lo = mid;
      else hi = mid;
    }
    return land((lo + hi) / 2);
  }
  return sea >= far ? { wet: true, x: side * sea, z: sea, y: 0, inland: far - sea } : land(to);
}

/** The ground's height at a point of the viewer's plan (0 on the sea). */
export function terraceGroundAt(shore: readonly TerraceShore[], x: number, z: number): number {
  const px = FINE.w / 2 + (TERRACE.lens * x) / Math.max(0.05, z);
  const far = shore[Math.max(0, Math.min(shore.length - 1, Math.round(px)))]!.far;
  return terraceRise(far - z);
}

export interface TerracePlan {
  /** The picture's size in fine pixels. */
  fine: { w: number; h: number };
  /** The horizon's row, in fine pixels. */
  horizon: number;
  /** Where the lantern hangs under the arm at the watchtower's corner, in fine pixels: its light glows round it at dusk and night. */
  lamp: { x: number; y: number };
  /** The grill's coals, in fine pixels: its smoke rises from here. */
  fire: { x: number; y: number };
  /** The head of the staff on the watchtower's roof, in fine pixels: the pennant flies from here. */
  pennant: { x: number; y: number };
  /** For each torch of `TORCHES`: the top of its head, where its flame stands (fine pixels), and how `tall` the flame is at that distance (fine pixels). */
  torches: { x: number; y: number; tall: number }[];
}

export function terracePlan(): TerracePlan {
  const at = (p: P3): { x: number; y: number } => {
    const q = terraceProject(...p);
    return { x: Math.round(q.x), y: Math.round(q.y) };
  };
  const hook = at(lampHook());
  const fire = at(onDeck(GRILL.u, GRILL.v, GRILL.high));
  return {
    fine: { ...FINE },
    horizon: TERRACE.horizon,
    lamp: hook,
    fire: { x: fire.x, y: fire.y - 1 },
    pennant: at(onTower(0.5, 0.5, TOWER.peak + TOWER.staff)),
    torches: TORCHES.map((torch) => {
      const head = onTorch(torch, torch.high);
      return { ...at(head), tall: Math.max(5, Math.round((TERRACE.lens * TORCH_FLAME) / head[2])) };
    }),
  };
}
