import { describe, expect, it } from 'vitest';
import keriJson from '../../../content/world/keri.json';
import { insideRing, loadWorld } from '../world/world';
import { ART_DETAIL, FRAME_MIN, FRAME_ROWS } from './frame';
import { LIGHTHOUSE_DRAWN, LIGHTHOUSE_METRES, MAP_MIDDLE, MAP_PICTURE, MAP_SHAPE, MAP_TILT, beyondCut, keriMapPlan, keriMapView } from './keriMap';
import { longSide } from './keriMapShape';
import { rectBottom, rectRight, type Rect } from './rect';

const KERI = loadWorld(keriJson);
const plan = keriMapPlan(KERI);
const inside = (r: Rect, area: Rect): boolean => r.x >= area.x && r.y >= area.y && rectRight(r) <= rectRight(area) && rectBottom(r) <= rectBottom(area);
const overlap = (a: Rect, b: Rect): boolean => a.x < rectRight(b) && b.x < rectRight(a) && a.y < rectBottom(b) && b.y < rectBottom(a);
const fine = (cells: Rect): Rect => ({ x: cells.x * ART_DETAIL, y: cells.y * ART_DETAIL, w: cells.w * ART_DETAIL, h: cells.h * ART_DETAIL });

describe('the painted map of Keri: its plan (ft_1_18.AC2)', () => {
  it('ft_1_18.AC2 the picture is larger than the target screen\'s main area, whose size is its middle', () => {
    expect(MAP_MIDDLE).toEqual({ w: FRAME_MIN.width, h: FRAME_MIN.height - FRAME_ROWS });
    expect(plan.fine).toEqual({ w: MAP_PICTURE.w * ART_DETAIL, h: MAP_PICTURE.h * ART_DETAIL });
    expect([plan.middle.w, plan.middle.h]).toEqual([MAP_MIDDLE.w * ART_DETAIL, MAP_MIDDLE.h * ART_DETAIL]);
    // the middle lies in the picture's middle
    expect(plan.middle.x * 2 + plan.middle.w).toBe(plan.fine.w);
    expect(plan.middle.y * 2 + plan.middle.h).toBe(plan.fine.h);
  });

  it('ft_1_18.AC2 the whole island, seen at a slant, lies in the middle every screen shows, the lighthouse\'s top too', () => {
    expect(plan.view.tilt).toBe(MAP_TILT);
    expect(inside(plan.island, plan.middle)).toBe(true);
    for (const [x, y] of KERI.coast) {
      const s = plan.at({ x, y });
      expect(s.x).toBeGreaterThanOrEqual(plan.island.x - 0.01);
      expect(s.x).toBeLessThanOrEqual(rectRight(plan.island) + 0.01);
      expect(s.y).toBeGreaterThanOrEqual(plan.island.y - 0.01);
      expect(s.y).toBeLessThanOrEqual(rectBottom(plan.island) + 0.01);
    }
    // drawn far taller than it is, with the rod on its dome, the lighthouse stays below the middle's top edge
    const top = plan.at(KERI.places.lighthouse, LIGHTHOUSE_METRES * LIGHTHOUSE_DRAWN * 1.06);
    expect(top.y).toBeGreaterThan(plan.middle.y + 4);
    // the island lies north-west to south-east: its western end is higher on the screen than its south-eastern spit
    const west = KERI.coast.reduce((a, b) => (b[0] < a[0] ? b : a)), south = KERI.coast.reduce((a, b) => (b[1] < a[1] ? b : a));
    expect(plan.at({ x: west[0], y: west[1] }).y).toBeLessThan(plan.at({ x: south[0], y: south[1] }).y);
  });

  it('ft_1_18.AC2 the map draws fat Keri: wider than measured across its short side and turned, so the island fills the picture; north turns with it', () => {
    expect(MAP_SHAPE).toMatchObject({ fat: 1.45, tail: { from: 0, by: 1 }, turn: 8, swells: [] });
    // the houses round the lighthouse and the warden's house are spread apart, so that none sits on another
    expect(MAP_SHAPE.spreads.length).toBeGreaterThanOrEqual(2);
    // the map's own places: the power station west of the mast, the mast west of the house's end, the
    // helicopter pad in the tip's wedge, the sauna east of the well; the southern slipway's head nearer the lighthouse
    const at = (id: string): { x: number; y: number } => plan.at([...KERI.buildings, ...KERI.landmarks!, ...KERI.scenes!].find((q) => q.id === id)!);
    expect(MAP_SHAPE.moves.map((m) => m.id).sort()).toEqual(['docks', 'helipad', 'hut-middle', 'hut-west', 'mast', 'memorial', 'north-shed']);
    expect(at('helipad').x).toBeLessThan(at('north-shed').x - 40);
    // the helipad a pad's width east of the point inside the tip's wedge
    const box = plan.view.toScreen(plan.map.ground({ x: -259.7, y: 116.1 }));
    expect(at('helipad').x - box.x).toBeGreaterThan(28);
    expect(at('helipad').x - box.x).toBeLessThan(40);
    expect(at('north-shed').x).toBeLessThan(at('mast').x - 15);
    expect(at('mast').x).toBeLessThan(at('warden-house').x);
    expect(at('hut-middle').x).toBeGreaterThan(at('hut-west').x + 25);
    // the sauna well away from the well house, the well clear of the fork it would hide, the fork still where the two ways part
    expect(Math.hypot(at('hut-middle').x - at('hut-west').x, at('hut-middle').y - at('hut-west').y)).toBeGreaterThan(55);
    const way = (id: string): { x: number; y: number }[] => plan.map.world.paths.find((q) => q.id === id)!.points.map(([x, y]) => plan.view.toScreen({ x, y }));
    const far = (p: { x: number; y: number }, q: { x: number; y: number }): number => Math.hypot(p.x - q.x, p.y - q.y);
    const fork = plan.at(KERI.scenes!.find((q) => q.id === 'crossroads')!);
    expect(far(fork, way('track-to-north-house')[0]!)).toBeLessThan(0.01);
    // the well stands by the fork, west of it and
    // south of the way from the house, as measured; the fork itself stays clear of it
    const well = at('hut-west'), stem = way('track-to-lighthouse');
    expect(far(fork, well)).toBeGreaterThan(10);
    expect(far(fork, well)).toBeLessThan(20);
    expect(well.x).toBeLessThan(fork.x);
    const onStem = stem[0]!.y + ((stem[1]!.y - stem[0]!.y) * (well.x - stem[0]!.x)) / (stem[1]!.x - stem[0]!.x);
    expect(well.x).toBeGreaterThan(stem[0]!.x);
    expect(well.x).toBeLessThan(stem[1]!.x);
    expect(well.y).toBeGreaterThan(onStem + 3);
    // the ways by the lighthouse (no way runs round the tower): the way from the west keeps its measured
    // course to the knoll and comes to the tower's foot; the way to the eastern houses leaves it there; the southern
    // dock's road leaves that one; the memorial stands north of the way, between the sauna and the tower
    const road = way('track-to-lighthouse'), traced = KERI.paths.find((q) => q.id === 'track-to-lighthouse')!.points;
    for (let i = 0; i < 6; i++) expect(far(road[i]!, plan.at({ x: traced[i]![0], y: traced[i]![1] }))).toBeLessThan(0.01);
    const foot = plan.at(KERI.places.lighthouse);
    expect(Math.min(...road.map((p) => far(p, foot)))).toBeLessThan(22);
    expect(Math.min(...road.map((p) => far(p, way('track-east-house')[0]!)))).toBeLessThan(0.5);
    const street = way('track-east-house'), dockHead = way('slipway')[0]!;
    expect(Math.min(...street.map((p) => far(p, dockHead)))).toBeLessThan(6);
    const memorial = at('memorial');
    expect(memorial.x).toBeGreaterThan(at('hut-west').x + 30);
    // the memorial closer to the lighthouse than to the crossroads, and clear of the tower's foot
    expect(far(memorial, foot)).toBeLessThan(far(memorial, fork) - 15);
    expect(memorial.x).toBeLessThan(foot.x - 32);
    expect(memorial.y).toBeLessThan(road[5]!.y);
    const slip = plan.map.world.paths.find((q) => q.id === 'slipway')!, shed = at('shore-shed'), lamp = plan.at(KERI.places.lighthouse);
    const head = plan.view.toScreen({ x: slip.points[0]![0], y: slip.points[0]![1] });
    expect(Math.abs(head.x - lamp.x)).toBeLessThan(Math.abs(head.x - shed.x));
    expect(plan.map.north).toBe(8);
    // the island takes most of the middle's width and more than half of its height
    const xs = KERI.coast.map(([x, y]) => plan.at({ x, y }).x), ys = KERI.coast.map(([x, y]) => plan.at({ x, y }).y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(plan.middle.w * 0.88);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(plan.middle.h * 0.55);
    // its long side lies flatter on the map than on the ground, and is still its long side
    const drawn = (longSide(plan.map.world).angle * 180) / Math.PI, measured = (longSide(KERI).angle * 180) / Math.PI;
    expect(drawn).toBeGreaterThan(measured + 4);
    expect(drawn).toBeLessThan(0);
    // a place keeps its neighbours: the house is west of the lighthouse, the docks north of the house
    const house = plan.at(KERI.buildings.find((b) => b.id === 'warden-house')!), tower = plan.at(KERI.places.lighthouse);
    expect(house.x).toBeLessThan(tower.x - 80);
    const docks = at('docks');
    expect(docks.y).toBeLessThan(house.y);
    // the northern dock over the east part of
    // the house, not beyond its end, and the boat slip still leads up to it
    expect(docks.x).toBeGreaterThan(house.x);
    expect(docks.x).toBeLessThan(house.x + 20);
    expect(far(way('boat-slip-north').at(-1)!, docks)).toBeLessThan(10);
  });

  it('ft_1_18.AC2 the sand strip off the south-east end lies under water: cut from the land, out in the sea, inside the middle, clear of the name', () => {
    const { sand } = plan;
    // the island's south-east end beyond the cut is the strip's root and no land; the lighthouse and the houses are land
    expect(beyondCut(sand, sand.beyond.x, sand.beyond.y)).toBe(true);
    for (const p of [KERI.places.lighthouse, ...KERI.buildings]) {
      const s = plan.at(p);
      expect(beyondCut(sand, s.x, s.y)).toBe(false);
    }
    // it leaves the island at its south-east end, and from its third point on it lies off the measured coast
    expect(sand.spine.length).toBeGreaterThanOrEqual(6);
    expect(beyondCut(sand, sand.spine[1]!.x, sand.spine[1]!.y)).toBe(true);
    for (const p of sand.spine.slice(2)) expect(insideRing(plan.map.world.coast, plan.view.toWorld(p.x, p.y))).toBe(false);
    // far longer than it is wide, it hooks back west under the island
    const first = sand.spine[1]!, last = sand.spine[sand.spine.length - 1]!;
    expect(last.x).toBeLessThan(first.x - 60);
    expect(last.y).toBeGreaterThan(first.y);
    for (const p of sand.spine) {
      expect(p.half).toBeGreaterThan(4);
      expect(inside({ x: p.x - p.half, y: p.y - p.half, w: p.half * 2, h: p.half * 2 }, plan.middle)).toBe(true);
      expect(overlap({ x: p.x - p.half, y: p.y - p.half, w: p.half * 2, h: p.half * 2 }, plan.title)).toBe(false);
    }
  });

  it('ft_1_18.AC2 the painted name and the compass rose lie on open sea inside the middle, clear of the island and of each other', () => {
    for (const box of [plan.title, plan.compass]) {
      expect(inside(box, plan.middle)).toBe(true);
      // no land under it: sampled every four pixels, with the shore's bank of a few rows below the land
      for (let y = box.y - 6; y <= rectBottom(box); y += 4) for (let x = box.x; x <= rectRight(box); x += 4) {
        expect(insideRing(plan.map.world.coast, plan.view.toWorld(x, y)), `${x},${y}`).toBe(false);
      }
    }
    expect(overlap(plan.title, plan.compass)).toBe(false);
    // the name in the lower left corner, the compass in the upper right
    expect(plan.title.x).toBeLessThan(plan.middle.x + plan.middle.w / 4);
    expect(plan.title.y).toBeGreaterThan(plan.middle.y + plan.middle.h / 2);
    expect(plan.compass.x).toBeGreaterThan(plan.middle.x + (plan.middle.w * 3) / 4);
    expect(plan.compass.y).toBeLessThan(plan.middle.y + plan.middle.h / 4);
    // the name keeps off the bottom edge (its last rows held the source line until it moved to the credits screen)
    expect(rectBottom(plan.title)).toBeLessThanOrEqual(rectBottom(plan.middle) - 20);
  });

  it('ft_1_18.AC4 the house\'s button is on the warden\'s house, in the middle, off the name and the compass', () => {
    const house = fine(plan.house);
    expect(inside(house, plan.middle)).toBe(true);
    expect(overlap(house, plan.title)).toBe(false);
    expect(overlap(house, plan.compass)).toBe(false);
    // the living room is inside the house's button
    const room = plan.view.toScreen(plan.map.world.places.livingRoom);
    expect(room.x).toBeGreaterThan(house.x);
    expect(room.x).toBeLessThan(rectRight(house));
    expect(room.y).toBeGreaterThan(house.y);
    expect(room.y).toBeLessThan(rectBottom(house));
  });

  it('ft_1_19.AC2 every scene of the world model has a button round its place, clear of the other buttons', () => {
    expect(plan.scenes.map((s) => s.id)).toEqual((KERI.scenes ?? []).map((s) => s.id));
    expect(plan.scenes.length).toBeGreaterThan(0);
    for (const scene of plan.scenes) {
      const at = fine(scene.at);
      const place = KERI.scenes!.find((s) => s.id === scene.id)!;
      expect(inside(at, plan.middle)).toBe(true);
      for (const other of [plan.title, plan.compass, fine(plan.house)]) expect(overlap(at, other)).toBe(false);
      const p = plan.at(place);
      expect(p.x).toBeGreaterThan(at.x);
      expect(p.x).toBeLessThan(rectRight(at));
      expect(p.y).toBeGreaterThan(at.y);
      expect(p.y).toBeLessThan(rectBottom(at));
    }
    const boxes = plan.scenes.map((s) => fine(s.at));
    boxes.forEach((a, i) => boxes.slice(i + 1).forEach((b) => expect(overlap(a, b)).toBe(false)));
  });

  it('ft_1_18.AC2 every screen shows the picture\'s middle on its own middle: the target screen exactly the middle, a larger one more sea, never more than the picture has', () => {
    expect(keriMapView(MAP_MIDDLE)).toEqual({ crop: plan.middle, at: { x: 0, y: 0 } });
    for (const screen of [{ w: 320, h: 169 }, { w: 342, h: 169 }, { w: 384, h: 193 }, { w: 400, h: 202 }, { w: 480, h: 250 }]) {
      const { crop, at } = keriMapView(screen);
      expect(inside(crop, { x: 0, y: 0, ...plan.fine })).toBe(true);
      expect(inside(plan.middle, crop)).toBe(true);
      expect(at.x).toBeGreaterThanOrEqual(0);
      expect(at.y).toBeGreaterThanOrEqual(0);
      // centred: the same room left and right, above and below
      expect(Math.abs(at.x * 2 + crop.w - screen.w * ART_DETAIL)).toBeLessThanOrEqual(1);
      expect(Math.abs(at.y * 2 + crop.h - screen.h * ART_DETAIL)).toBeLessThanOrEqual(1);
      expect(Math.abs(crop.x * 2 + crop.w - plan.fine.w)).toBeLessThanOrEqual(1);
    }
    expect(keriMapView({ w: 480, h: 250 }).crop).toEqual({ x: 0, y: 0, ...plan.fine });
  });
});
