import { describe, expect, it } from 'vitest';
import keriJson from '../../../content/world/keri.json';
import { insideRing, loadWorld, worldBounds, type World } from '../world/world';
import { MOVE_HOLD, TRUE_SHAPE, caricature, longSide, type MapShape } from './keriMapShape';

const KERI = loadWorld(keriJson);
const shape = (over: Partial<MapShape>): MapShape => ({ ...TRUE_SHAPE, ...over });
/** Twice a ring's area, positive when it runs counter-clockwise. */
const area2 = (ring: World['coast']): number => ring.reduce((sum, [x, y], i) => { const [nx, ny] = ring[(i + 1) % ring.length]!; return sum + x * ny - nx * y; }, 0);
/** How far the coast reaches along and across the island's long side. */
function reach(world: World, angle: number): { along: number; across: number } {
  const ux = Math.cos(angle), uy = Math.sin(angle);
  const a = world.coast.map(([x, y]) => x * ux + y * uy), s = world.coast.map(([x, y]) => -x * uy + y * ux);
  return { along: Math.max(...a) - Math.min(...a), across: Math.max(...s) - Math.min(...s) };
}

describe('the map\'s caricature of Keri: places grow, the measured island stays the source (ft_1_18.AC2)', () => {
  it('ft_1_18.AC2 the island lies north-west to south-east, far longer than wide', () => {
    const side = longSide(KERI);
    const degrees = (side.angle * 180) / Math.PI;
    expect(degrees).toBeGreaterThan(-45);
    expect(degrees).toBeLessThan(-25);
    const r = reach(KERI, side.angle);
    expect(r.along).toBeGreaterThan(3 * r.across);
  });

  it('ft_1_18.AC2 the true shape changes nothing', () => {
    const map = caricature(KERI, TRUE_SHAPE);
    expect(map.north).toBe(0);
    expect(map.world).toEqual(KERI);
    expect(map.place({ x: 10, y: -20 })).toEqual({ x: 10, y: -20 });
    // and a shape that only names a tail's start with nothing shortened is the true shape too
    expect(caricature(KERI, shape({ tail: { from: -150, by: 1 } })).world).toEqual(KERI);
  });

  it('ft_1_18.AC2 a fatter island is wider across its short side and as long as before', () => {
    const side = longSide(KERI);
    const before = reach(KERI, side.angle), after = reach(caricature(KERI, shape({ fat: 1.5 })).world, side.angle);
    expect(after.across).toBeCloseTo(before.across * 1.5, 3);
    expect(after.along).toBeCloseTo(before.along, 3);
  });

  it('ft_1_18.AC2 a shorter tail shortens only what lies north-west of its start', () => {
    const side = longSide(KERI);
    const map = caricature(KERI, shape({ tail: { from: -150, by: 0.6 } }));
    expect(reach(map.world, side.angle).along).toBeLessThan(reach(KERI, side.angle).along - 20);
    // the lighthouse end keeps its measure: two places there are as far apart as before
    const a = map.place({ x: 0, y: 0 }), b = map.place({ x: 31.4, y: -11.8 });
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(Math.hypot(31.4, 11.8), 6);
  });

  it('ft_1_18.AC2 a turned island turns its houses and tells how far north has turned', () => {
    const map = caricature(KERI, shape({ turn: 8 }));
    expect(map.north).toBe(8);
    map.world.buildings.forEach((b, i) => expect(b.angle).toBeCloseTo(KERI.buildings[i]!.angle + 8, 6));
    // the long side lies flatter: the island is wider from west to east than before
    const was = worldBounds(KERI), now = worldBounds(map.world);
    expect(now.maxX - now.minX).toBeGreaterThan(was.maxX - was.minX);
    expect(now.maxY - now.minY).toBeLessThan(was.maxY - was.minY);
  });

  it('ft_1_18.AC2 the ground swells round a place: its neighbours move away, what lies outside the swell stays', () => {
    const house = KERI.buildings.find((b) => b.id === 'warden-house')!;
    const map = caricature(KERI, shape({ swells: [{ x: house.x, y: house.y, radius: 100, gain: 1.75 }] }));
    const centre = map.place(house), near = map.place({ x: house.x + 20, y: house.y });
    expect(centre.x).toBeCloseTo(house.x, 6);
    expect(Math.hypot(near.x - centre.x, near.y - centre.y)).toBeGreaterThan(30);
    const far = map.place({ x: house.x + 140, y: house.y });
    expect(far.x).toBeCloseTo(house.x + 140, 6);
  });

  it('ft_1_18.AC2 a sharper tip narrows the north-west end onto its point and leaves the rest', () => {
    const side = longSide(KERI);
    const ux = Math.cos(side.angle), uy = Math.sin(side.angle);
    const along = ([x, y]: readonly [number, number]): number => (x - side.x) * ux + (y - side.y) * uy, across = ([x, y]: readonly [number, number]): number => -(x - side.x) * uy + (y - side.y) * ux;
    const map = caricature(KERI, shape({ tip: { from: -120, sharp: 0.3 } }));
    /** How wide the island is where it is `far` metres or more to the north-west. */
    const wide = (world: World, from: number, to: number): number => { const part = world.coast.filter((p) => along(p) < from && along(p) >= to).map(across); return Math.max(...part) - Math.min(...part); };
    expect(wide(map.world, -200, -230)).toBeLessThan(wide(KERI, -200, -230) * 0.8);
    // a wedge: it narrows evenly, so halfway to the end it has lost about half of what it loses
    expect(wide(map.world, -180, -190)).toBeLessThan(wide(KERI, -180, -190) * 0.75);
    // the island is as long as before, and south-east of the tip's start nothing moves
    expect(reach(map.world, side.angle).along).toBeCloseTo(reach(KERI, side.angle).along, 3);
    const lamp = map.place({ x: 0, y: 0 });
    expect(lamp.x).toBeCloseTo(0, 6);
    expect(lamp.y).toBeCloseTo(0, 6);
    expect(Math.sign(area2(map.world.coast))).toBe(Math.sign(area2(KERI.coast)));
    expect(() => caricature(KERI, shape({ tip: { from: -120, sharp: 0 } }))).toThrow(/tip/);
  });

  it('ft_1_18.AC2 a spread moves what stands round a place apart and leaves the shore alone', () => {
    const map = caricature(KERI, shape({ spreads: [{ x: 0, y: 0, radius: 100, gain: 1.8 }] }));
    map.world.coast.forEach(([x, y], i) => { expect(x).toBeCloseTo(KERI.coast[i]![0], 6); expect(y).toBeCloseTo(KERI.coast[i]![1], 6); });
    map.world.grass.forEach(([x, y], i) => { expect(x).toBeCloseTo(KERI.grass[i]![0], 6); expect(y).toBeCloseTo(KERI.grass[i]![1], 6); });
    const far = (id: string, world: World): number => { const b = world.buildings.find((x) => x.id === id)!; return Math.hypot(b.x, b.y); };
    // the houses by the lighthouse stand further from it, the nearest moved the most for its distance; the tower stays
    for (const id of ['building-2', 'building-3', 'red-shed', 'wood-shed', 'shore-shed']) expect(far(id, map.world), id).toBeGreaterThan(far(id, KERI) * 1.15);
    expect(map.world.places.lighthouse.x).toBeCloseTo(0, 6);
    // their order from the tower is kept, and what lies outside the spread stays
    const order = (world: World): string[] => world.buildings.map((b) => b.id).sort((a, b) => far(a, world) - far(b, world));
    expect(order(map.world)).toEqual(order(KERI));
    expect(far('warden-house', map.world)).toBeCloseTo(far('warden-house', KERI), 6);
    // a room stays in its house: the living room is as far from the warden's house as measured, under any spread
    const round = caricature(KERI, shape({ spreads: [{ x: -110, y: 45, radius: 80, gain: 2 }] }));
    const house = round.world.buildings.find((b) => b.id === 'warden-house')!, was = KERI.buildings.find((b) => b.id === 'warden-house')!;
    expect(Math.hypot(round.world.places.livingRoom.x - house.x, round.world.places.livingRoom.y - house.y)).toBeCloseTo(Math.hypot(KERI.places.livingRoom.x - was.x, KERI.places.livingRoom.y - was.y), 6);
    // a path's point moves as a house does; a point of the ground does not
    expect(map.place({ x: 30, y: 0 }).x).toBeGreaterThan(40);
    expect(map.ground({ x: 30, y: 0 }).x).toBeCloseTo(30, 6);
  });

  it('ft_1_18.AC2 every caricature keeps the island whole: the coast is not folded and everything stays on its ground', () => {
    const strong: MapShape = { fat: 1.5, tail: { from: -150, by: 0.6 }, tip: { from: -140, sharp: 0.4 }, turn: 14, spreads: [], moves: [], lines: [], swells: [{ x: -100, y: 62, radius: 120, gain: 1.75 }, { x: 5, y: -14, radius: 110, gain: 1.6 }, { x: -52, y: 14, radius: 60, gain: 1.35 }] };
    for (const s of [TRUE_SHAPE, shape({ fat: 1.45, turn: 8 }), strong]) {
      const map = caricature(KERI, s);
      expect(Math.sign(area2(map.world.coast))).toBe(Math.sign(area2(KERI.coast)));
      expect(Math.abs(area2(map.world.coast))).toBeGreaterThanOrEqual(Math.abs(area2(KERI.coast)) * 0.9);
      expect(map.world.coast).toHaveLength(KERI.coast.length);
      for (const b of map.world.buildings) expect(insideRing(map.world.coast, b), b.id).toBe(true);
      // a scene stays on its ground or over its water (the docks' place is out on the jetty)
      (map.world.scenes ?? []).forEach((scene, i) => expect(insideRing(map.world.coast, scene), scene.id).toBe(insideRing(KERI.coast, KERI.scenes![i]!)));
      expect(insideRing(map.world.coast, map.world.places.lighthouse)).toBe(true);
      expect(insideRing(map.world.coast, map.world.places.livingRoom)).toBe(true);
      // a point of the measured island lands where `place` says
      const p = map.place(KERI.places.northShore);
      expect(map.world.places.northShore.x).toBeCloseTo(p.x, 6);
      expect(map.world.places.northShore.y).toBeCloseTo(p.y, 6);
    }
  });

  it('ft_1_18.AC2 a moved thing stands where its new measured point lies on the ground, with the end of the path that leads to it; a path can be drawn along another line', () => {
    const sauna = KERI.buildings.find((b) => b.id === 'hut-middle')!;
    const spreads = [{ x: 0, y: 0, radius: 105, gain: 1.8 }];
    const map = caricature(KERI, shape({ fat: 1.45, turn: 8, spreads, moves: [{ id: 'hut-middle', x: sauna.x + 10, y: sauna.y + 12 }], lines: [{ id: 'slipway', points: [[26, -36], [40, -92]] }] }));
    const still = caricature(KERI, shape({ fat: 1.45, turn: 8, spreads }));
    // the house: on the ground at its new point, no spread on it
    const drawn = map.world.buildings.find((b) => b.id === 'hut-middle')!, to = map.ground({ x: sauna.x + 10, y: sauna.y + 12 });
    expect(drawn.x).toBeCloseTo(to.x, 6);
    expect(drawn.y).toBeCloseTo(to.y, 6);
    expect(map.place(sauna)).toEqual(to);
    // the path to it ends a few metres from its measured place: that end goes with it, the path's start does not
    const path = KERI.paths.find((q) => q.id === 'track-to-north-house')!, last = path.points.length - 1;
    const moved = map.world.paths.find((q) => q.id === path.id)!, was = still.world.paths.find((q) => q.id === path.id)!;
    expect(Math.hypot(path.points[last]![0] - sauna.x, path.points[last]![1] - sauna.y)).toBeLessThan(MOVE_HOLD);
    expect(Math.hypot(moved.points[last]![0] - drawn.x, moved.points[last]![1] - drawn.y)).toBeLessThan(MOVE_HOLD * 1.5);
    expect(moved.points[0]).toEqual(was.points[0]);
    // nothing else moves: the other houses, the shore
    for (const b of map.world.buildings.filter((q) => q.id !== 'hut-middle')) expect(b).toEqual(still.world.buildings.find((q) => q.id === b.id));
    expect(map.world.coast).toEqual(still.world.coast);
    // the slipway lies along the given line, on the ground
    const slip = map.world.paths.find((q) => q.id === 'slipway')!, head = map.ground({ x: 26, y: -36 });
    expect(slip.points).toHaveLength(2);
    expect(slip.points[0]![0]).toBeCloseTo(head.x, 6);
    expect(slip.points[0]![1]).toBeCloseTo(head.y, 6);
    // a thing moved with a hold of 0 moves alone: the crossroads four metres from the well stays at the paths' fork
    const well = KERI.buildings.find((b) => b.id === 'hut-west')!, fork = KERI.scenes!.find((q) => q.id === 'crossroads')!;
    expect(Math.hypot(well.x - fork.x, well.y - fork.y)).toBeLessThan(MOVE_HOLD);
    const alone = caricature(KERI, shape({ fat: 1.45, turn: 8, spreads, moves: [{ id: 'hut-west', x: well.x, y: well.y + 12, hold: 0 }] }));
    const held = caricature(KERI, shape({ fat: 1.45, turn: 8, spreads, moves: [{ id: 'hut-west', x: well.x, y: well.y + 12 }] }));
    expect(alone.world.buildings.find((b) => b.id === 'hut-west')).toEqual(held.world.buildings.find((b) => b.id === 'hut-west'));
    expect(alone.world.scenes!.find((q) => q.id === 'crossroads')).toEqual(still.world.scenes!.find((q) => q.id === 'crossroads'));
    expect(held.world.scenes!.find((q) => q.id === 'crossroads')).not.toEqual(still.world.scenes!.find((q) => q.id === 'crossroads'));
    // a line that keeps the path's head: the first measured points as they were, then the line on the ground
    const road = KERI.paths.find((q) => q.id === 'track-to-lighthouse')!;
    const kept = caricature(KERI, shape({ fat: 1.45, turn: 8, spreads, lines: [{ id: road.id, keep: 3, points: [[-20, 0], [0, -16]] }] })).world.paths.find((q) => q.id === road.id)!;
    expect(kept.points).toHaveLength(5);
    expect(kept.points.slice(0, 3)).toEqual(still.world.paths.find((q) => q.id === road.id)!.points.slice(0, 3));
    const tail = map.ground({ x: 0, y: -16 });
    expect(kept.points[4]![0]).toBeCloseTo(tail.x, 6);
    expect(kept.points[4]![1]).toBeCloseTo(tail.y, 6);
    // a thing or a path the world has not is a mistake in the shape
    expect(() => caricature(KERI, shape({ moves: [{ id: 'no-such-house', x: 0, y: 0 }] }))).toThrow(/no-such-house/);
    expect(() => caricature(KERI, shape({ lines: [{ id: 'no-such-path', points: [[0, 0], [1, 1]] }] }))).toThrow(/no-such-path/);
  });

  it('ft_1_18.AC2 a swell too strong to keep the ground in order is refused', () => {
    expect(() => caricature(KERI, shape({ swells: [{ x: 0, y: 0, radius: 50, gain: 6 }] }))).toThrow(/gain/);
    expect(() => caricature(KERI, shape({ fat: 0 }))).toThrow(/fat/);
  });
});
