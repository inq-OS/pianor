import { insideRing, type World, type WorldPoint } from '../world/world';
import { ART_DETAIL } from './frame';
import { toRing } from './knoll';
import type { Rect } from './rect';
import { ROOM_PICTURE, roomView } from './room';

/**
 * The terrace (ft_1_19, d113): the wooden deck before the main door of the warden's house. The real terrace is a
 * plain deck with a pipe rail and red benches; this one reaches further (more features than the real one has,
 * extending further out over the beach): from its seaward side a walk of boards on piles runs out over the beach to a
 * head at the water, and on the head stands a small watchtower (`TOWER`). The viewer stands on the head and looks
 * back at the house, as the 1991 game stages a place: the building in the middle, a walk leading to it, a near thing
 * framing one side (d279). Its picture is a painting in pixels like the docks' (d111). Pure numbers; the painter is
 * `game/ui/pixel/keri/terracePicture.ts`.
 *
 * From the world model come the way the viewer looks, the shore in each column (`terraceShore`) and the house's
 * size. The deck, the walk and what stands on them are the painter's, in metres on the viewer's plan: `x` to the
 * right, `z` ahead, `y` up from the sea.
 */

/** The scene's id in the world model (`scenes` in content/world/keri.json). */
export const TERRACE_ID = 'terrace';

export const TERRACE = {
  /**
   * The way the viewer looks, as a compass bearing in degrees: north-north-east, back along the walk over the beach to
   * the terrace and the warden's house (whose front faces 205), as the 1991 game shows a place: a stage with its
   * building in the middle, a walk leading to it and a near thing framing one side (d279).
   */
  heading: 35,
  /** The eye stands on the walk's head over the water: this far east and north of the scene's place (the deck's seaward edge, metres). */
  eye: { east: -7.5, north: -11.3 },
  /** The eye over the sea (metres): a little over a person standing on the head's boards, so the boards and the beach show. */
  overSea: 3.5,
  /** Fine pixels per radian: how wide the picture looks (about 80 degrees). */
  lens: 380,
  /** The horizon's row in the picture, in fine pixels: two fifths sky. */
  horizon: 100,
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
 * and gentle.
 */
export const TERRACE_LAND = { top: 1.6, beach: 14 } as const;

/**
 * The deck, in its own frame: `u` runs along the house's front (to the viewer's left), `v` away from the house toward
 * the sea (toward the viewer); `turn` is how far `u` lies right of the way the viewer looks (degrees). It reaches from
 * `u0` to `u1` and from `v0` to `v1` (metres, the frame's nought at the eye), its boards `y` over the sea. The seaward
 * edge is `v1`.
 */
export const DECK = { turn: -100, u0: -15.5, u1: 11.5, v0: -30, v1: -22, y: 2.0 } as const;

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
 * whose near edge, where the viewer stands, is over the water. Nothing leads from it down to the water.
 */
export const REACH = { u0: -0.6, u1: 2.2, long: 8.5, drop: 0.3, deep: 6, head: { u0: -7.8, u1: 6.2 } } as const;

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
 * The watchtower on the head's left, toward the eye (the section that reaches furthest over the beach
 * can have a roofed part, perhaps a small watchtower of about two floors with a fixed telescope to scan the
 * horizon): four posts on the head's boards from `u0` to `u1` and `t0` to `t1` metres out, a floor `floor` metres
 * up with a rail round it, a roof whose eave is `eave` up and stands `over` out past the posts, its peak `peak` up
 * and a staff `staff` over that. It leans: for each metre up it stands `lean` metres further to the viewer's right.
 * The painter's, not Keri's.
 */
export const TOWER = { u0: 3.6, u1: 5.8, t0: 8.7, t1: 10.9, floor: 1.9, rail: 0.85, eave: 3.3, over: 0.4, peak: 4.0, staff: 0.35, lean: 0.035 } as const;

/** A point of the watchtower: `a` across it from its `u0` side (0) to its `u1` side (1), `b` from the side nearest the eye (0) toward the house (1), `up` metres over the head's boards. Outside 0 to 1 it is out past the posts. */
export function onTower(a: number, b: number, up = 0): P3 {
  // `a` runs across the tower as the viewer sees it, left (0) to right (1); `b` from its side nearest the eye (0) away toward the house (1)
  const [x, y, z] = onReach(TOWER.u1 - (TOWER.u1 - TOWER.u0) * a, TOWER.t1 - (TOWER.t1 - TOWER.t0) * b, up);
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
export const LONG_EYE = { a: 0.14, b: 0.3, high: 1.1, long: 2.1, aim: { x: -0.97, z: 0.24 } } as const;

/** The grill by the deck's seaward rail (the terrace's own, on the photographs: half a barrel on legs), its place in the deck's frame. */
export const GRILL = { u: -5.2, v: -23.2, r: 0.36, high: 0.9 } as const;

/**
 * The terrace's torches (torches at night, the terrace being like the village plaza): three standing torches lashed to
 * rail posts, a pair at the head's near corners framing the picture and one at the deck's seaward rail before the
 * house; the watchtower has its lantern. Few, so the place stays calm (d278). Each has its foot `on` the deck's boards
 * (`u`, `v` of the deck's frame) or the walk's (`u`, and `v` metres out from the deck's edge), and its head `high` over
 * those boards; none stands plumb (`lean` metres to the viewer's right for each metre up). Unlit by day; they burn at
 * dusk and night, as the lantern does. The painter's, not Keri's.
 */
export const TORCHES: readonly { on: 'deck' | 'reach'; u: number; v: number; high: number; lean: number }[] = [
  // at the head's near corners, nearest the eye, under the watchtower on the left and on the rail on the right
  { on: 'reach', u: 3.6, v: REACH.long + REACH.deep - 0.2, high: 1.5, lean: 0.05 },
  { on: 'reach', u: REACH.head.u0 + 0.15, v: REACH.long + REACH.deep - 0.2, high: 1.6, lean: -0.05 },
  // and one at the deck's seaward edge left of the walk's mouth, before the house
  { on: 'deck', u: REACH.u1 + 0.4, v: DECK.v1 - 0.12, high: 1.7, lean: 0.04 },
];

/** The torches that throw sparks in the game: the two nearest the eye, by their place in `TORCHES`. */
export const TORCH_SPARKS: readonly number[] = [0, 1];

/** How tall a torch's flame stands over its head, in metres. */
export const TORCH_FLAME = 0.5;

/** A point `up` metres over the foot of a torch of `TORCHES`. */
export function onTorch(torch: (typeof TORCHES)[number], up = 0): P3 {
  const [x, y, z] = torch.on === 'deck' ? onDeck(torch.u, torch.v, up) : onReach(torch.u, torch.v, up);
  return [x + torch.lean * up, y, z];
}

/** Boulders on the beach and in the shallows, as on the reference drone photograph: each its place and half width (metres on the viewer's plan). */
export const TERRACE_ROCKS: readonly { x: number; z: number; r: number }[] = [
  { x: 6.5, z: 9, r: 1.2 }, { x: -9, z: 13, r: 1.6 }, { x: 11, z: 18, r: 1.4 }, { x: -14, z: 22, r: 1.1 },
  { x: 4.5, z: 16, r: 0.7 }, { x: -6, z: 7, r: 0.6 }, { x: 16, z: 28, r: 1.8 },
]

/**
 * The warden's house (the world model's `warden-house`: 28 m long, 8.8 m deep, a gable roof of grey tin over plastered
 * walls, the front toward the sea with a porch in the middle and the living room at the south-east end, two front
 * windows there): in the deck's frame its front wall stands at `front` from `u0` to `u1` (four fifths of its length,
 * as the map draws it), `deep` metres back. Heights over the sea: the ground at its foot `ground`, the floor `floor`
 * (the deck's boards' height), the eaves `eave`, the ridge `ridge`. The door is at `door` under the porch, the front's
 * other windows at `windows` (the living room's two at the south-east end, on the viewer's right). `sag` is how far the ridge sags in its middle
 * and `lean` how far the front leans out at the eaves (metres): a house of the 1991 game, crooked with age. The
 * chimney stands on the ridge at `chimney`.
 */
export const HOUSE = {
  u0: -13.5, u1: 9.5, front: -30, deep: 8.8, ground: 1.6, floor: DECK.y, eave: 4.5, ridge: 8.0, over: 0.5,
  door: -2, windows: [-12, -9.7, -6.4, 2.6, 5.1, 7.6], sag: 1.3, lean: 0.3, chimney: 3.8,
} as const;

/** A point of the house's front: `u` along it, `up` metres over the sea, `out` metres out from the wall (toward the sea); the front leans out a little toward the eaves and bows along its length. */
export function onHouse(u: number, up: number, out = 0): P3 {
  const t = Math.max(0, Math.min(1, (up - HOUSE.ground) / (HOUSE.eave - HOUSE.ground)));
  const bow = 0.12 * Math.sin((Math.PI * (u - HOUSE.u0)) / (HOUSE.u1 - HOUSE.u0));
  const [x, , z] = onDeck(u, HOUSE.front + out + HOUSE.lean * t * t + bow * t);
  return [x, up, z];
}

/** A point of the roof: `u` along the house, `b` from the eave (0) up to the ridge (1); the ridge sags in its middle. */
export function onRoof(u: number, b: number): P3 {
  const sag = HOUSE.sag * Math.sin((Math.PI * (u - HOUSE.u0)) / (HOUSE.u1 - HOUSE.u0));
  const v = HOUSE.front + HOUSE.over + HOUSE.lean + (-HOUSE.deep / 2 - HOUSE.over - HOUSE.lean) * b;
  const [x, , z] = onDeck(u, v);
  return [x, HOUSE.eave - 0.12 + (HOUSE.ridge - HOUSE.eave + 0.12 - sag) * b - 0.08 * sag * Math.sin(Math.PI * b), z];
}

/** The lattice mast by the house's north-west gable (the world model's landmark `mast`), in the deck's frame, and its height (metres over the sea). */
export const MAST = { u: 10.6, v: -38, high: 30 } as const;

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

/** One column of the picture: how far ahead the water's edge is where the land begins (`far`), and where it ends again at the island's far shore (`exit`), in metres. */
export interface TerraceShore {
  far: number;
  exit: number;
}

/** How many columns either side of one the shore is eased over (fine pixels), so a step in the traced coast is no cliff. */
const SHORE_EASE = 14;

/**
 * How much further in than the traced coast the water stands before the terrace (metres): high water, so that the
 * walk's head stands in it and the eye looks over water to the beach. AX-3 provisional, the painter's.
 */
export const TERRACE_TIDE = 14;

/** The shore before the viewer, column by column, from the world model's coast. */
export function terraceShore(world: World): TerraceShore[] {
  const place = terracePlace(world);
  const eye = fromTerrace(place, 0, 0);
  const onLand = insideRing(world.coast, eye);
  const raw = Array.from({ length: FINE.w }, (_, px) => {
    const a = Math.atan((px + 0.5 - FINE.w / 2) / TERRACE.lens);
    const there = fromTerrace(place, Math.sin(a), Math.cos(a));
    const dx = there.x - eye.x, dy = there.y - eye.y;
    // the distance along the ray is slant; the floor's rows go by the distance ahead
    const first = toRing(world.coast, eye, dx, dy);
    if (onLand) return { far: 0, exit: Math.min(400, first) * Math.cos(a) };
    if (!Number.isFinite(first)) return { far: 400, exit: 400 };
    const back = toRing(world.coast, { x: eye.x + dx * (first + 0.5), y: eye.y + dy * (first + 0.5) }, dx, dy);
    return { far: Math.min(400, first + TERRACE_TIDE) * Math.cos(a), exit: Math.min(400, first + 0.5 + back) * Math.cos(a) };
  });
  const ease = (pick: (s: TerraceShore) => number, px: number): number => {
    let sum = 0, weight = 0;
    for (let k = -SHORE_EASE; k <= SHORE_EASE; k++) {
      const w = SHORE_EASE + 1 - Math.abs(k);
      sum += pick(raw[Math.max(0, Math.min(raw.length - 1, px + k))]!) * w; weight += w;
    }
    return sum / weight;
  };
  return raw.map((_, px) => ({ far: ease((s) => s.far, px), exit: Math.max(ease((s) => s.far, px) + 1, ease((s) => s.exit, px)) }));
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
  /** How far inland of the nearest water's edge it lies, along the way the viewer looks (metres; under 0 on the sea). */
  inland: number;
}

/** How many steps the eye's ray is walked over the land. */
const FLOOR_STEPS = 64;

/** The column of the shore a pixel's column looks along. */
const column = (shore: readonly TerraceShore[], px: number): TerraceShore => shore[Math.max(0, Math.min(shore.length - 1, Math.round(px)))]!;

/** How far inland a point `z` metres ahead lies in a column of the shore: from the water's edge before it, or to the far shore after it. */
function inlandOf(c: TerraceShore, z: number): number {
  return Math.min(z - c.far, c.exit - z);
}

/**
 * The floor under a pixel: the water before the beach, the land where the eye's ray first meets its rise, else the
 * sea beyond the island. Null above the horizon.
 */
export function terraceFloor(shore: readonly TerraceShore[], px: number, py: number): TerraceFloor | null {
  const down = py - TERRACE.horizon;
  if (down <= 0) return null;
  const c = column(shore, px);
  const side = (px + 0.5 - FINE.w / 2) / TERRACE.lens;
  const sea = (TERRACE.lens * TERRACE.overSea) / down;
  const wet = (z: number): TerraceFloor => ({ wet: true, x: side * z, z, y: 0, inland: inlandOf(c, z) });
  if (sea <= c.far) return wet(sea);
  // how far the ray is over the ground `z` metres ahead
  const over = (z: number): number => TERRACE.overSea - (down * z) / TERRACE.lens - terraceRise(inlandOf(c, z));
  const to = Math.min(sea, c.exit);
  let lo = c.far;
  for (let k = 1; k <= FLOOR_STEPS; k++) {
    const z = c.far + ((to - c.far) * k) / FLOOR_STEPS;
    if (over(z) > 0) { lo = z; continue; }
    let hi = z;
    for (let n = 0; n < 12; n++) {
      const mid = (lo + hi) / 2;
      if (over(mid) > 0) lo = mid;
      else hi = mid;
    }
    const at = (lo + hi) / 2;
    return { wet: false, x: side * at, z: at, y: terraceRise(inlandOf(c, at)), inland: inlandOf(c, at) };
  }
  return wet(sea);
}

/** How far inland a point of the viewer's plan lies (metres; under 0 on the sea). */
export function terraceInland(shore: readonly TerraceShore[], x: number, z: number): number {
  return inlandOf(column(shore, FINE.w / 2 + (TERRACE.lens * x) / Math.max(0.05, z)), z);
}

/** The ground's height at a point of the viewer's plan (0 on the sea). */
export function terraceGroundAt(shore: readonly TerraceShore[], x: number, z: number): number {
  return terraceRise(terraceInland(shore, x, z));
}

/**
 * Where a being stands on the walk's head: in the deck's frame (metres), in a row across its open boards right of the
 * watchtower, all about ten metres ahead, where a figure of the game's size is to the picture's scale. AX-3
 * provisional: four places, as the knoll has.
 */
export const TERRACE_SPOTS: readonly { u: number; v: number }[] = [
  { u: 0, v: -10.3 },
  { u: -2.1, v: -10.6 },
  { u: -4.3, v: -10.6 },
  { u: -6.4, v: -10.3 },
];

/** A being's button in layout cells: the being with its name and stars over it. */
const SPOT_HIT = { w: 26, h: 44 } as const;

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
  /** For each place of `TERRACE_SPOTS`: where a being's feet are (fine pixels) and its button (layout cells from the picture's top-left corner). */
  spots: { feet: { x: number; y: number }; button: Rect }[];
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
    spots: TERRACE_SPOTS.map(({ u, v }) => {
      const feet = at(onDeck(u, v));
      const x = Math.round(feet.x / ART_DETAIL - SPOT_HIT.w / 2), bottom = Math.round(feet.y / ART_DETAIL) + 2;
      return { feet, button: { x, y: bottom - SPOT_HIT.h, w: SPOT_HIT.w, h: SPOT_HIT.h } };
    }),
  };
}
