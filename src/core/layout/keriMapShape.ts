import type { World, WorldPoint } from '../world/world';

/**
 * The map's caricature of Keri (ft_1_18.AC2): an illustrated map draws its places larger than to scale, and so that they
 * have room, the island itself is drawn a little unlike the measured one. This is the one step between the world model
 * (content/world/keri.json, d108) and the map's picture, and every number of it is in a `MapShape`: what the map changes
 * of the real island can be read here and nowhere else. Scenes, rooms and distances keep using the measured world.
 *
 * Pure numbers. The result is a world in "map metres" that the map's plan and painter take as they took the measured one.
 */
export interface MapShape {
  /** How many times as wide the island is drawn across its short side (1 as measured). */
  fat: number;
  /**
   * The empty end: what lies further north-west than `from` (metres along the long side from the island's middle,
   * negative north-westward) is drawn `by` times as long (1 as measured).
   */
  tail: { from: number; by: number };
  /**
   * The north-west tip drawn sharper: what lies further north-west than `from` (metres along the long side, as `tail`)
   * narrows evenly toward the island's very end, where it is `sharp` times as wide (1 as measured): a wedge. It narrows
   * onto the tip itself.
   */
  tip: { from: number; sharp: number };
  /** Degrees the island is turned counter-clockwise on the map, so that its long side lies flatter (0: north is up). */
  turn: number;
  /** The ground swells round a place: within `radius` metres of it everything moves outward, at the place itself `gain` times as far. */
  swells: readonly { x: number; y: number; radius: number; gain: number }[];
  /**
   * What stands on the ground round a place stands further apart (spread them out): within
   * `radius` metres of it houses, landmarks, scenes and paths move outward, near the place `gain` times as far. The
   * shore and the meadow's edge stay where they are, so the island keeps its outline.
   */
  spreads: readonly { x: number; y: number; radius: number; gain: number }[];
  /**
   * A thing the map draws somewhere else (the boxes marked on the map): the house, landmark or scene `id`
   * stands where the measured point (x, y) lies on the map's ground, whatever the spreads would do with it. What stands
   * within `hold` metres of its measured place (`MOVE_HOLD` unless told), the end of a path that leads to it, goes with
   * it; with a hold of 0 the thing moves alone.
   */
  moves: readonly { id: string; x: number; y: number; hold?: number }[];
  /**
   * A path the map draws along another line than the measured one: its points on the map's ground, in measured metres.
   * The path's first `keep` measured points stay as they are and the line goes on from them (0 unless told: the whole
   * path is the line).
   */
  lines: readonly { id: string; keep?: number; points: readonly (readonly [number, number])[] }[];
}

/** How near a moved thing's measured place a point has to stand to go with it, in metres. */
export const MOVE_HOLD = 6;

/** The island as measured. */
export const TRUE_SHAPE: MapShape = { fat: 1, tail: { from: 0, by: 1 }, tip: { from: 0, sharp: 1 }, turn: 0, swells: [], spreads: [], moves: [], lines: [] };

/** A swell folds the ground over itself above this gain (the smooth falloff's steepest slope is 1.5 over the radius). */
const MAX_GAIN = 4.5;

/** The island's middle and the angle of its long side (radians, counter-clockwise from east), from the coast's points. */
export function longSide(world: World): { x: number; y: number; angle: number } {
  const n = world.coast.length;
  const x = world.coast.reduce((sum, p) => sum + p[0], 0) / n, y = world.coast.reduce((sum, p) => sum + p[1], 0) / n;
  let xx = 0, xy = 0, yy = 0;
  for (const [px, py] of world.coast) { xx += (px - x) ** 2; xy += (px - x) * (py - y); yy += (py - y) ** 2; }
  return { x, y, angle: 0.5 * Math.atan2(2 * xy, xx - yy) };
}

export interface MapWorld {
  /** The island as the map draws it. A house keeps its size and is turned with the island. */
  world: World;
  /** Where a thing that stands on the measured island lies on the map (a house, a landmark, a scene, a point of a path). */
  place(p: WorldPoint): WorldPoint;
  /** Where a point of the measured shore or of the ground itself lies on the map: as `place`, without the spreads. */
  ground(p: WorldPoint): WorldPoint;
  /** How many degrees north has turned counter-clockwise from straight up: the compass rose shows it. */
  north: number;
}

export function caricature(world: World, shape: MapShape): MapWorld {
  if (!(shape.fat > 0)) throw new Error(`a map shape's fat must be above 0, got ${shape.fat}`);
  if (!(shape.tail.by > 0)) throw new Error(`a map shape's tail must be above 0, got ${shape.tail.by}`);
  if (!(shape.tip.sharp > 0 && shape.tip.sharp <= 1)) throw new Error(`a map shape's tip must be above 0 and at most 1, got ${shape.tip.sharp}`);
  for (const s of [...shape.swells, ...shape.spreads]) {
    if (!(s.gain >= 1 && s.gain <= MAX_GAIN)) throw new Error(`a swell's gain must be 1 to ${MAX_GAIN}, got ${s.gain}`);
    if (!(s.radius > 0)) throw new Error(`a swell's radius must be above 0, got ${s.radius}`);
  }
  const things = [...world.buildings, ...(world.landmarks ?? []), ...(world.scenes ?? [])];
  const moves = shape.moves.map((m) => {
    const thing = things.find((t) => t.id === m.id);
    if (!thing) throw new Error(`a map shape moves "${m.id}", which the world has not`);
    return { from: { x: thing.x, y: thing.y }, to: { x: m.x, y: m.y }, hold: m.hold ?? MOVE_HOLD };
  });
  for (const l of shape.lines) if (!world.paths.some((path) => path.id === l.id)) throw new Error(`a map shape draws the path "${l.id}", which the world has not`);
  // the measured island comes back untouched, to the last digit
  if (shape.fat === 1 && shape.tail.by === 1 && shape.tip.sharp === 1 && shape.turn === 0 && shape.swells.length === 0 && shape.spreads.length === 0 && shape.moves.length === 0 && shape.lines.length === 0) {
    return { world, place: (p) => ({ x: p.x, y: p.y }), ground: (p) => ({ x: p.x, y: p.y }), north: 0 };
  }
  const side = longSide(world);
  const ux = Math.cos(side.angle), uy = Math.sin(side.angle);
  const measured = (p: WorldPoint): [number, number] => [(p.x - side.x) * ux + (p.y - side.y) * uy, -(p.x - side.x) * uy + (p.y - side.y) * ux];
  // the island's north-west end: the coast's point furthest that way, which a sharper tip narrows onto
  const end = world.coast.map(([x, y]) => measured({ x, y })).reduce((far, q) => (q[0] < far[0] ? q : far));
  /** Along and across the long side, fattened, with the tail shortened and the tip sharpened. */
  const stretched = (p: WorldPoint): [number, number] => {
    const [along, across] = measured(p);
    const { from, by } = shape.tail;
    const { tip } = shape;
    const toward = along < tip.from && end[0] < tip.from ? Math.min(1, (tip.from - along) / (tip.from - end[0])) : 0;
    const narrow = 1 - (1 - tip.sharp) * toward;
    return [along < from ? from + (along - from) * by : along, (end[1] + (across - end[1]) * narrow) * shape.fat];
  };
  // a swell's place and reach are told in measured metres; it swells the ground after the stretch
  const swells = shape.swells.map((s) => ({ at: stretched(s), radius: s.radius, gain: s.gain }));
  const spreads = shape.spreads.map((s) => ({ at: stretched(s), radius: s.radius, gain: s.gain }));
  type Swell = (typeof swells)[number];
  /** How far the swells move a point, along and across. */
  const moved = (along: number, across: number, by: readonly Swell[]): [number, number] => {
    let moveAlong = 0, moveAcross = 0;
    for (const s of by) {
      const r = Math.hypot(along - s.at[0], across - s.at[1]);
      if (r >= s.radius) continue;
      const t = r / s.radius;
      const k = (s.gain - 1) * (1 - t * t * (3 - 2 * t));
      moveAlong += (along - s.at[0]) * k;
      moveAcross += (across - s.at[1]) * k;
    }
    return [moveAlong, moveAcross];
  };
  const turned = side.angle + (shape.turn * Math.PI) / 180;
  const tx = Math.cos(turned), ty = Math.sin(turned);
  const put = (p: WorldPoint, spread: boolean): WorldPoint => {
    let [along, across] = stretched(p);
    const swollen = moved(along, across, swells);
    along += swollen[0];
    across += swollen[1];
    if (spread) {
      const apart = moved(along, across, spreads);
      along += apart[0];
      across += apart[1];
    }
    return { x: side.x + along * tx - across * ty, y: side.y + along * ty + across * tx };
  };
  const ground = (p: WorldPoint): WorldPoint => put(p, false);
  const place = (p: WorldPoint): WorldPoint => {
    // a moved thing, and what stands right by it, lies on the ground at its new spot
    const m = moves.find((q) => Math.hypot(p.x - q.from.x, p.y - q.from.y) <= q.hold);
    return m ? ground({ x: m.to.x + p.x - m.from.x, y: m.to.y + p.y - m.from.y }) : put(p, true);
  };
  const shore = ([x, y]: readonly [number, number]): [number, number] => { const q = ground({ x, y }); return [q.x, q.y]; };
  /** A point inside a house goes where its house goes, turned with it: a room stays in its house whatever is spread. */
  const indoors = (p: WorldPoint): WorldPoint => {
    const house = world.buildings.find((b) => Math.hypot(b.x - p.x, b.y - p.y) <= b.long / 2);
    if (!house) return place(p);
    const at = place(house), a = (shape.turn * Math.PI) / 180, dx = p.x - house.x, dy = p.y - house.y;
    return { x: at.x + dx * Math.cos(a) - dy * Math.sin(a), y: at.y + dx * Math.sin(a) + dy * Math.cos(a) };
  };
  const pair = ([x, y]: readonly [number, number]): [number, number] => { const q = place({ x, y }); return [q.x, q.y]; };
  const stood = <T extends WorldPoint>(thing: T, more: Partial<T> = {}): T => ({ ...thing, ...place(thing), ...more });
  return {
    place,
    ground,
    north: shape.turn,
    world: {
      ...world,
      coast: world.coast.map(shore),
      grass: world.grass.map(shore),
      buildings: world.buildings.map((b) => stood(b, { angle: b.angle + shape.turn })),
      ...(world.landmarks ? { landmarks: world.landmarks.map((l) => stood(l)) } : {}),
      ...(world.scenes ? { scenes: world.scenes.map((s) => stood(s)) } : {}),
      paths: world.paths.map((path) => {
        const line = shape.lines.find((l) => l.id === path.id);
        return { ...path, points: line ? [...path.points.slice(0, line.keep ?? 0).map(pair), ...line.points.map(shore)] : path.points.map(pair) };
      }),
      places: { lighthouse: stood(world.places.lighthouse), livingRoom: { ...world.places.livingRoom, ...indoors(world.places.livingRoom) }, northShore: stood(world.places.northShore) },
    },
  };
}
