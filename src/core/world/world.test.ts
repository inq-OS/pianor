import { describe, expect, it } from 'vitest';
import keriJson from '../../../content/world/keri.json';
import { bearing, buildingCorners, distance, fitMap, insideRing, loadWorld, onLand, worldBounds } from './world';

const KERI = loadWorld(keriJson);

describe('the world model of Keri (d108)', () => {
  it('ft_1_18.AC2 loads the shipped world file and refuses one without a schema version', () => {
    expect(KERI.coast.length).toBeGreaterThan(50);
    expect(() => loadWorld({ ...keriJson, schemaVersion: undefined })).toThrow();
  });

  it('ft_1_18.AC2 the lighthouse, the living room and the northern shore stand on land, inside the coast', () => {
    for (const place of Object.values(KERI.places)) expect(onLand(KERI, place)).toBe(true);
    expect(onLand(KERI, { x: 0, y: 300 })).toBe(false); // the open sea north of the island
  });

  it('ft_1_18.AC2 the footpath round the island and the tracks to the lighthouse (Maa- ja Ruumiamet base map) lie on land', () => {
    expect(KERI.paths.some((p) => p.kind === 'footpath')).toBe(true);
    expect(KERI.paths.some((p) => p.kind === 'track')).toBe(true);
    for (const path of KERI.paths.filter((p) => p.kind !== 'slipway')) for (const [x, y] of path.points) expect(onLand(KERI, { x, y }), `${path.id} at ${x}, ${y}`).toBe(true);
  });

  it('ft_1_18.AC2 the boat slipway starts on the southern shore and ends in the sea', () => {
    const slip = KERI.paths.find((p) => p.kind === 'slipway')!;
    const [first, last] = [slip.points[0]!, slip.points[slip.points.length - 1]!];
    expect(onLand(KERI, { x: first[0], y: first[1] })).toBe(true);
    expect(onLand(KERI, { x: last[0], y: last[1] })).toBe(false);
    expect(last[1]).toBeLessThan(first[1]);
  });

  it('ft_1_18.AC2 every building and the mast stand on land, and no two buildings share a place', () => {
    for (const b of KERI.buildings) expect(onLand(KERI, b), b.id).toBe(true);
    for (const m of KERI.landmarks ?? []) expect(onLand(KERI, m), m.id).toBe(true);
    for (const a of KERI.buildings) for (const b of KERI.buildings) if (a.id < b.id) expect(distance(a, b), `${a.id} and ${b.id}`).toBeGreaterThan((a.short + b.short) / 2);
    expect(KERI.buildings.map((b) => b.id)).toContain('warden-house');
  });

  it('ft_1_18.AC2 the northern shore (the yellow circle) is on land with the sea less than 15 m north of it', () => {
    const { northShore } = KERI.places;
    expect(onLand(KERI, northShore)).toBe(true);
    expect(onLand(KERI, { x: northShore.x, y: northShore.y + 15 })).toBe(false);
  });

  it('ft_1_19.AC2 the first scene, the grassy knoll, lies on the meadow between the warden\'s house and the lighthouse, south of the track', () => {
    const knoll = KERI.scenes!.find((s) => s.id === 'knoll')!;
    expect(insideRing(KERI.grass, knoll)).toBe(true);
    const house = KERI.buildings.find((b) => b.id === 'warden-house')!;
    expect(knoll.x).toBeGreaterThan(house.x);
    expect(knoll.x).toBeLessThan(KERI.places.lighthouse.x);
    // the track from the house to the lighthouse passes north of it
    const track = KERI.paths.find((p) => p.id === 'track-to-lighthouse')!;
    const near = track.points.reduce((a, p) => (Math.abs(p[0] - knoll.x) < Math.abs(a[0] - knoll.x) ? p : a));
    expect(near[1]).toBeGreaterThan(knoll.y + 5);
    expect(new Set(KERI.scenes!.map((s) => s.id)).size).toBe(KERI.scenes!.length);
  });

  it('ft_1_18.AC2 the island lies north-west to south-east, about 400 to 500 m long (keri.ee; measured 507 m)', () => {
    const b = worldBounds(KERI);
    expect(b.maxX - b.minX).toBeGreaterThan(380);
    expect(b.maxX - b.minX).toBeLessThan(520);
    // the north-west end is further north than the south-east end
    const west = KERI.coast.reduce((a, p) => (p[0] < a[0] ? p : a));
    const east = KERI.coast.reduce((a, p) => (p[0] > a[0] ? p : a));
    expect(west[1]).toBeGreaterThan(east[1]);
  });

  it('ft_1_18.AC3 the lighthouse is east-south-east of the living room, about 130 m away: the eastern window faces it', () => {
    const b = bearing(KERI.places.livingRoom, KERI.places.lighthouse);
    expect(b).toBeGreaterThan(90);
    expect(b).toBeLessThan(135);
    expect(distance(KERI.places.livingRoom, KERI.places.lighthouse)).toBeGreaterThan(100);
    expect(distance(KERI.places.livingRoom, KERI.places.lighthouse)).toBeLessThan(160);
  });

  it('measures bearings by the compass and distances in metres', () => {
    expect(bearing({ x: 0, y: 0 }, { x: 0, y: 10 })).toBeCloseTo(0);
    expect(bearing({ x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(90);
    expect(bearing({ x: 0, y: 0 }, { x: 0, y: -10 })).toBeCloseTo(180);
    expect(bearing({ x: 0, y: 0 }, { x: -10, y: 0 })).toBeCloseTo(270);
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('tells inside from outside a square', () => {
    const square = [[0, 0], [10, 0], [10, 10], [0, 10]] as const;
    expect(insideRing(square, { x: 5, y: 5 })).toBe(true);
    expect(insideRing(square, { x: 15, y: 5 })).toBe(false);
  });

  it('gives a building its four corners round its centre, turned by its angle', () => {
    const corners = buildingCorners({ id: 'b', x: 10, y: 20, long: 4, short: 2, angle: 90 });
    const xs = corners.map((c) => c.x), ys = corners.map((c) => c.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(2);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(4);
  });

  it('ft_1_18.AC2 fits the whole coast on the screen with its margin, north up, and maps back', () => {
    const screen = { w: 320, h: 160 };
    const view = fitMap(KERI, screen, 6);
    for (const [x, y] of KERI.coast) {
      const s = view.toScreen({ x, y });
      expect(s.x).toBeGreaterThanOrEqual(5.99);
      expect(s.x).toBeLessThanOrEqual(314.01);
      expect(s.y).toBeGreaterThanOrEqual(5.99);
      expect(s.y).toBeLessThanOrEqual(154.01);
    }
    const north = view.toScreen({ x: 0, y: 50 }), south = view.toScreen({ x: 0, y: -50 });
    expect(north.y).toBeLessThan(south.y);
    const back = view.toWorld(view.toScreen({ x: -62, y: 60 }).x, view.toScreen({ x: -62, y: 60 }).y);
    expect(back.x).toBeCloseTo(-62);
    expect(back.y).toBeCloseTo(60);
  });

  it('ft_1_18.AC2 seen at a tilt the island still fits its box, north-south distances shrink, and what stands up rises on the screen', () => {
    const box = { x: 40, y: 20, w: 500, h: 230 };
    const view = fitMap(KERI, box, 0, 0.6);
    for (const [x, y] of KERI.coast) {
      const s = view.toScreen({ x, y });
      expect(s.x).toBeGreaterThanOrEqual(39.99);
      expect(s.x).toBeLessThanOrEqual(540.01);
      expect(s.y).toBeGreaterThanOrEqual(19.99);
      expect(s.y).toBeLessThanOrEqual(250.01);
    }
    const a = view.toScreen({ x: 0, y: 0 }), north = view.toScreen({ x: 0, y: 100 }), east = view.toScreen({ x: 100, y: 0 });
    expect(a.y - north.y).toBeCloseTo((east.x - a.x) * 0.6);
    // a tower of 30 m rises 30 m times the sine of the viewing angle
    const top = view.toScreen({ x: 0, y: 0 }, 30);
    expect(top.x).toBeCloseTo(a.x);
    expect(a.y - top.y).toBeCloseTo(30 * view.scale * 0.8);
    const back = view.toWorld(north.x, north.y);
    expect(back.x).toBeCloseTo(0);
    expect(back.y).toBeCloseTo(100);
    // straight from above nothing rises
    expect(fitMap(KERI, box, 0).toScreen({ x: 0, y: 0 }, 30)).toEqual(fitMap(KERI, box, 0).toScreen({ x: 0, y: 0 }));
  });
});
