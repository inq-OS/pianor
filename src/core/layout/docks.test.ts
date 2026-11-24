import { describe, expect, it } from 'vitest';
import keriJson from '../../../content/world/keri.json';
import { loadWorld } from '../world/world';
import { BOULDER, DOCKS, DOCKS_ID, JETTY, LAMP, TOWER, TOWER_EAVES, TOWER_FLOOR, docksGround, docksPlace, docksPlan, docksProject, docksShore, fromDocks, jettyAt, towerCorner } from './docks';

const KERI = loadWorld(keriJson);
const plan = docksPlan();
const { w: W, h: H } = plan.fine;

/** Whether a point is inside a ring (even-odd). */
function inside(ring: readonly (readonly [number, number])[], p: { x: number; y: number }): boolean {
  let yes = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, ay] = ring[i]!, [bx, by] = ring[j]!;
    if (ay > p.y !== by > p.y && p.x < ((bx - ax) * (p.y - ay)) / (by - ay) + ax) yes = !yes;
  }
  return yes;
}

describe('the docks: the plan of the picture (ft_1_19)', () => {
  it('ft_1_19.AC1 the docks are a scene of the world model on the north shore behind the warden\'s house, opened at a higher level than the knoll', () => {
    const scene = KERI.scenes!.find((s) => s.id === DOCKS_ID)!;
    const knoll = KERI.scenes!.find((s) => s.id === 'knoll')!;
    expect(scene.level).toBeGreaterThan(knoll.level);
    const house = KERI.buildings.find((b) => b.id === 'warden-house')!;
    const place = docksPlace(KERI);
    // north of the house and near its east end, out over the water
    expect(place.y).toBeGreaterThan(house.y + 20);
    expect(Math.abs(place.x - house.x)).toBeLessThan(house.long);
    expect(inside(KERI.coast, place)).toBe(false);
  });

  it('ft_1_19.AC1 the viewer stands on the island\'s shingle and the jetty runs from the shore out into the sea, its end over the water', () => {
    const place = docksPlace(KERI);
    expect(inside(KERI.coast, fromDocks(place, 0, 0))).toBe(true);
    expect(inside(KERI.coast, fromDocks(place, JETTY.from.x, JETTY.from.z))).toBe(true);
    expect(inside(KERI.coast, fromDocks(place, JETTY.to.x, JETTY.to.z))).toBe(false);
    expect(inside(KERI.coast, fromDocks(place, BOULDER.x, BOULDER.z))).toBe(false);
  });

  it('ft_1_19.AC1 the shore comes from the world model: near on the left, the bay opening out to the right, every column\'s water edge below the horizon', () => {
    const shore = docksShore(KERI);
    expect(shore).toHaveLength(W);
    for (const column of shore) {
      expect(column.far).toBeGreaterThan(0);
      expect(column.water).toBeGreaterThan(DOCKS.horizon);
    }
    expect(shore[0]!.far).toBeLessThan(shore[W - 1]!.far);
  });

  it('ft_1_19.AC1 the walk goes round the big rock\'s left side to the landing behind it, never into the rock', () => {
    let left = false;
    for (let s = 0; s <= JETTY.long; s += 0.25) {
      const p = jettyAt(s);
      expect(Math.hypot(p.x - BOULDER.x, p.z - BOULDER.z)).toBeGreaterThan(BOULDER.r + JETTY.wide / 2);
      expect(Math.hypot(p.ux, p.uz)).toBeCloseTo(1, 5);
      if (p.x < BOULDER.x - BOULDER.r && Math.abs(p.z - BOULDER.z) < BOULDER.r) left = true;
      expect(p.x).toBeLessThan(BOULDER.x + BOULDER.r);
    }
    expect(left).toBe(true);
    expect(JETTY.to.z).toBeGreaterThan(BOULDER.z + BOULDER.r);
    expect(jettyAt(0)).toMatchObject({ x: JETTY.from.x, z: JETTY.from.z });
    expect(jettyAt(JETTY.long).x).toBeCloseTo(JETTY.to.x, 5);
  });

  it('ft_1_19.AC1 the birdwatching hut stands straight on the boulder\'s top, the stone its floor, every post on the rock', () => {
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
      const c = towerCorner(a, b);
      expect(Math.hypot(c.x - BOULDER.x, c.z - BOULDER.z)).toBeLessThan(BOULDER.r * 0.7);
    }
    expect(TOWER_FLOOR).toBe(TOWER.base);
    expect(TOWER.base).toBeLessThan(BOULDER.high);
    // low and wide, a thatched lookout: the roof at least as tall as the room under it, the eaves well past the posts
    expect(TOWER.roof).toBeGreaterThanOrEqual(TOWER.posts);
    expect(TOWER.eaves).toBeGreaterThan(TOWER.half * 0.5);
  });

  it('ft_1_19.AC1 a stage set: the horizon off the middle row, the tower on the rock (the main thing) near the middle and standing over the horizon, the lamp inside the picture', () => {
    expect(plan.horizon).toBeGreaterThan(H * 0.3);
    expect(plan.horizon).toBeLessThan(H * 0.45);
    const tower = docksProject(TOWER.x, TOWER_EAVES + TOWER.roof, TOWER.z);
    expect(tower.x / W).toBeGreaterThan(0.38);
    expect(tower.x / W).toBeLessThan(0.6);
    expect(tower.y).toBeGreaterThan(0);
    expect(tower.y).toBeLessThan(plan.horizon * 0.6);
    expect(plan.lamp.x).toBeGreaterThan(0);
    expect(plan.lamp.x).toBeLessThan(W);
    expect(plan.lamp.y).toBeGreaterThan(0);
    expect(plan.lamp.y).toBeLessThan(plan.horizon);
    expect(docksProject(LAMP.x, 0, LAMP.z).y).toBeGreaterThan(plan.horizon);
  });

  it('ft_1_19.AC1 the floor under a pixel and a point\'s place on the picture agree', () => {
    for (const [x, z] of [[0, 10], [-4, 25], [6, 7]] as const) {
      const p = docksProject(x, 0, z);
      // the floor is level; the fan of what stands up moves a point's column a little, never its depth
      const g = docksGround(p.x, p.y)!;
      expect(g.z).toBeCloseTo(z, 0);
    }
    expect(docksGround(10, DOCKS.horizon - 1)).toBeNull();
  });
});
