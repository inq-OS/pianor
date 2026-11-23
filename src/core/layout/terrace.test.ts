import { describe, expect, it } from 'vitest';
import keriJson from '../../../content/world/keri.json';
import { insideRing, loadWorld } from '../world/world';
import { ROOM_PICTURE } from './room';
import { DECK, GRILL, HOUSE, LONG_EYE, REACH, TERRACE, TERRACE_ID, TERRACE_LAND, TERRACE_ROCKS, TERRACE_SPOTS, TORCHES, TORCH_FLAME, TORCH_SPARKS, TOWER, deckOf, fromTerrace, lampHook, onDeck, onReach, onTorch, onTower, reachSides, terraceFloor, terraceGrassy, terraceGroundAt, terraceInland, terracePlace, terracePlan, terraceProject, terraceRise, terraceShore, terraceView, underReach } from './terrace';

const KERI = loadWorld(keriJson);
const plan = terracePlan();
const { w: W, h: H } = plan.fine;
const shore = terraceShore(KERI);

describe('the terrace: the plan of the picture (ft_1_19)', () => {
  it('ft_1_19.AC1 the terrace is a scene of the world model before the warden\'s house, on its seaward side, on land', () => {
    const scene = KERI.scenes!.find((s) => s.id === TERRACE_ID)!;
    const knoll = KERI.scenes!.find((s) => s.id === 'knoll')!;
    expect(scene.level).toBeGreaterThan(knoll.level);
    const house = KERI.buildings.find((b) => b.id === 'warden-house')!;
    const place = terracePlace(KERI);
    // south-west of the house, where its front faces, and within a house's length of it
    expect(place.y).toBeLessThan(house.y);
    expect(Math.hypot(place.x - house.x, place.y - house.y)).toBeLessThan(house.long);
    expect(insideRing(KERI.coast, place)).toBe(true);
    // near the landmark the map already draws
    const mark = KERI.landmarks!.find((l) => l.id === 'terrace')!;
    expect(Math.hypot(place.x - mark.x, place.y - mark.y)).toBeLessThan(10);
  });

  it('ft_1_19.AC1 the world model must name the scene', () => {
    expect(() => terracePlace({ ...KERI, scenes: [] })).toThrow(/no scene "terrace"/);
  });

  it('ft_1_19.AC1 the viewer stands on the walk\'s head over the water and looks back, a little east of north, to the warden\'s house in the middle of the picture (a stage set of the 1991 game)', () => {
    const place = terracePlace(KERI);
    const eye = fromTerrace(place, 0, 0);
    // off the island's traced shore, over the high water before it
    expect(insideRing(KERI.coast, eye)).toBe(false);
    // the house's front faces bearing 205: the viewer faces it, within 30 degrees
    expect(Math.abs(TERRACE.heading - 25)).toBeLessThan(30);
    // the house is ahead, some thirty metres away, and near the picture's middle
    const house = KERI.buildings.find((b) => b.id === 'warden-house')!;
    const a = (TERRACE.heading * Math.PI) / 180;
    const ahead = (house.x - eye.x) * Math.sin(a) + (house.y - eye.y) * Math.cos(a), side = (house.x - eye.x) * Math.cos(a) - (house.y - eye.y) * Math.sin(a);
    expect(ahead).toBeGreaterThan(25);
    expect(ahead).toBeLessThan(45);
    expect(Math.abs(side) / ahead).toBeLessThan(0.2);
  });

  it('ft_1_19.AC1 the shore comes from the world model: near on the left, running away to the right, every column\'s water edge below the horizon', () => {
    expect(shore).toHaveLength(W);
    for (let x = 0; x < W; x++) {
      expect(shore[x]!.far).toBeGreaterThan(8);
      expect(shore[x]!.far).toBeLessThanOrEqual(400);
      expect(TERRACE.horizon + (TERRACE.lens * TERRACE.overSea) / shore[x]!.far).toBeGreaterThan(TERRACE.horizon);
    }
    expect(shore[0]!.far).toBeLessThan(shore[W - 1]!.far);
    // eased: no cliff from one column to the next
    for (let x = 1; x < W; x++) expect(Math.abs(shore[x]!.far - shore[x - 1]!.far)).toBeLessThan(3);
  });

  it('ft_1_19.AC1 the ground rises from the water to the ground before the house: down a column the far sea, the island, then the near water under the head', () => {
    expect(terraceRise(0)).toBe(0);
    expect(terraceRise(-5)).toBe(0);
    expect(terraceRise(TERRACE_LAND.beach)).toBeCloseTo(TERRACE_LAND.top, 6);
    expect(terraceRise(TERRACE_LAND.beach * 3)).toBeCloseTo(TERRACE_LAND.top, 6);
    for (let d = 1; d <= TERRACE_LAND.beach; d++) expect(terraceRise(d)).toBeGreaterThan(terraceRise(d - 1));
    expect(DECK.y).toBeGreaterThan(TERRACE_LAND.top);
    for (const x of [40, 150, 300, 450, 600]) {
      let last = Infinity, sea = 0, land = 0;
      const kinds: boolean[] = [];
      for (let y = TERRACE.horizon + 1; y < H; y++) {
        const f = terraceFloor(shore, x, y)!;
        expect(f.z).toBeLessThanOrEqual(last + 1e-6);
        last = f.z;
        if (kinds[kinds.length - 1] !== f.wet) kinds.push(f.wet);
        if (f.wet) {
          expect(f.y).toBe(0);
          expect(f.inland).toBeLessThanOrEqual(0);
          sea++;
        } else {
          expect(f.inland).toBeGreaterThanOrEqual(-1e-6);
          expect(f.y).toBeCloseTo(terraceRise(f.inland), 6);
          land++;
        }
      }
      // the island lies between water beyond it and the water the viewer stands over
      expect(kinds[kinds.length - 1]).toBe(true);
      expect(kinds).toContain(false);
      expect(sea).toBeGreaterThan(30);
      expect(land).toBeGreaterThan(60);
    }
    expect(terraceFloor(shore, 100, TERRACE.horizon)).toBeNull();
    expect(terraceFloor(shore, 100, 10)).toBeNull();
  });

  it('ft_1_19.AC1 the ground\'s height at a point of the plan agrees with the floor under the pixel it lands on', () => {
    for (const [x, y] of [[60, 180], [200, 165], [420, 140]] as const) {
      const f = terraceFloor(shore, x, y)!;
      expect(f.wet).toBe(false);
      expect(terraceGroundAt(shore, f.x, f.z)).toBeCloseTo(f.y, 1);
      const back = terraceProject(f.x, f.y, f.z);
      expect(back.x).toBeCloseTo(x + 0.5, 0);
      expect(back.y).toBeCloseTo(y, 0);
    }
    expect(terraceGroundAt(shore, 0, 300)).toBe(0);
    // the island's grass is the world model's ring: the ground behind the viewer is grass or shingle by it, the sea never
    const place = terracePlace(KERI);
    expect(terraceGrassy(KERI, place, 0, 200)).toBe(false);
    expect(typeof terraceGrassy(KERI, place, 10, 12)).toBe('boolean');
  });

  it('ft_1_19.AC1 the deck lies before the house, across the picture beyond the walk; its frame turns to the plan and back', () => {
    for (const [u, v] of [[0, 0], [3, 5], [-1, 6.5], [10, 2]] as const) {
      const [x, y, z] = onDeck(u, v, 0.4);
      expect(y).toBeCloseTo(DECK.y + 0.4, 6);
      const back = deckOf(x, z);
      expect(back.u).toBeCloseTo(u, 6);
      expect(back.v).toBeCloseTo(v, 6);
    }
    // its seaward edge crosses most of the picture under the horizon, further from the eye than the walk's head
    const a = terraceProject(...onDeck(DECK.u0, DECK.v1)), b = terraceProject(...onDeck(DECK.u1, DECK.v1));
    expect(Math.min(a.x, b.x)).toBeLessThan(W * 0.1);
    expect(Math.max(a.x, b.x)).toBeGreaterThan(W * 0.7);
    for (const p of [a, b]) {
      expect(p.y).toBeGreaterThan(plan.horizon);
      expect(p.far).toBeGreaterThan(REACH.long + REACH.deep);
    }
    // the house's front stands on the deck's landward edge
    expect(HOUSE.front).toBeGreaterThanOrEqual(DECK.v0);
    expect(HOUSE.u0).toBeGreaterThan(DECK.u0);
    expect(HOUSE.u1).toBeLessThan(DECK.u1);
  });

  it('ft_1_19.AC1 a walk of boards reaches from the deck\'s seaward edge out over the beach, a step lower, to a head over the water where the viewer stands (extend further out over the beach, with features and character)', () => {
    expect(REACH.u0).toBeGreaterThan(DECK.u0);
    expect(REACH.u1).toBeLessThan(DECK.u1);
    expect(REACH.drop).toBeGreaterThan(0);
    const [x0, y0, z0] = onReach(REACH.u0, 0);
    expect(deckOf(x0, z0).v).toBeCloseTo(DECK.v1, 6);
    expect(y0).toBeCloseTo(DECK.y - REACH.drop, 6);
    expect(onReach(3, 2, 1)[1]).toBeCloseTo(DECK.y - REACH.drop + 1, 6);
    // the walk is as broad as its mouth; the head at its end is broader on both sides
    expect(reachSides(1)).toEqual({ u0: REACH.u0, u1: REACH.u1 });
    expect(reachSides(REACH.long + 1)).toEqual(REACH.head);
    expect(REACH.head.u0).toBeLessThan(REACH.u0);
    expect(REACH.head.u1).toBeGreaterThan(REACH.u1);
    expect(underReach(1, DECK.v1 + 3)).toBe(true);
    expect(underReach(4, DECK.v1 + 3)).toBe(false);
    expect(underReach(4, DECK.v1 + REACH.long + 1)).toBe(true);
    expect(underReach(1, DECK.v1 - 0.5)).toBe(false);
    expect(underReach(1, DECK.v1 + REACH.long + REACH.deep + 0.5)).toBe(false);
    // it runs toward the viewer: its mouth in the picture\'s middle, under the house, the head\'s near edge close before the eye and over the water
    const mouth = terraceProject(...onReach((REACH.u0 + REACH.u1) / 2, 0));
    expect(mouth.x).toBeGreaterThan(W * 0.3);
    expect(mouth.x).toBeLessThan(W * 0.5);
    expect(mouth.y).toBeGreaterThan(plan.horizon + 20);
    const end = REACH.long + REACH.deep;
    for (const u of [REACH.head.u0, REACH.head.u1]) {
      const [x, , z] = onReach(u, end);
      expect(z).toBeLessThan(z0);
      expect(z).toBeLessThan(10);
      expect(terraceInland(shore, x, z)).toBeLessThan(0);
    }
  });

  it('ft_1_19.AC1 a stage set: the horizon under a third down, the watchtower on the head framing the picture\'s left, a storey up with a roof over it and a staff on its peak (a small watchtower of about two floors with a fixed telescope to scan the horizon)', () => {
    expect(plan.fine).toEqual({ w: ROOM_PICTURE.w * 2, h: ROOM_PICTURE.h * 2 });
    expect(plan.horizon).toBe(TERRACE.horizon);
    expect(plan.horizon).toBeGreaterThan(H * 0.3);
    expect(plan.horizon).toBeLessThan(H * 0.45);
    // it stands on the head, inside its boards, left of the walk
    expect(TOWER.u0).toBeGreaterThan(REACH.u1);
    expect(TOWER.u1).toBeLessThan(REACH.head.u1);
    expect(TOWER.t0).toBeGreaterThan(REACH.long);
    expect(TOWER.t1).toBeLessThan(REACH.long + REACH.deep);
    expect(onTower(0, 0)).toEqual(onReach(TOWER.u1, TOWER.t1));
    // it leans a little to the right as it rises, as nothing here is plumb
    const up = onTower(1, 1, 2), plumb = onReach(TOWER.u0, TOWER.t0, 2);
    expect(up[0] - plumb[0]).toBeCloseTo(TOWER.lean * 2, 6);
    expect([up[1], up[2]]).toEqual([plumb[1], plumb[2]]);
    expect(TOWER.lean).toBeGreaterThan(0.01);
    expect(TOWER.lean).toBeLessThan(0.08);
    // its floor is a storey up, over the eye, its roof over that
    expect(TOWER.floor).toBeGreaterThan(1.7);
    expect(TOWER.floor).toBeLessThan(3);
    expect(DECK.y - REACH.drop + TOWER.floor).toBeGreaterThan(TERRACE.overSea);
    expect(TOWER.eave - TOWER.floor).toBeGreaterThan(1.2);
    expect(TOWER.peak).toBeGreaterThan(TOWER.eave + 0.6);
    // the whole of it is in the picture's left quarter: its feet under the horizon, its floor about the horizon and its roof in the sky
    for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) {
      const foot = terraceProject(...onTower(a, b)), floor = terraceProject(...onTower(a, b, TOWER.floor)), eave = terraceProject(...onTower(a, b, TOWER.eave));
      expect(foot.x).toBeGreaterThan(0);
      expect(foot.x).toBeLessThan(W / 4);
      expect(foot.y).toBeGreaterThan(plan.horizon + 40);
      expect(floor.y).toBeLessThan(plan.horizon);
      expect(eave.y).toBeLessThan(floor.y - 30);
      expect(eave.y).toBeGreaterThan(20);
    }
    const peak = terraceProject(...onTower(0.5, 0.5, TOWER.peak));
    expect(plan.pennant.x).toBe(Math.round(peak.x));
    expect(plan.pennant.y).toBeLessThan(peak.y);
    expect(plan.pennant.y).toBeGreaterThan(2);
    expect(LONG_EYE.a).toBeGreaterThan(0);
    expect(LONG_EYE.a).toBeLessThan(1);
    expect(LONG_EYE.b).toBeGreaterThan(0);
    expect(LONG_EYE.b).toBeLessThan(1);
    expect(LONG_EYE.high).toBeGreaterThan(TOWER.rail);
    expect(TOWER.floor + LONG_EYE.high).toBeLessThan(TOWER.eave);
    expect(LONG_EYE.long).toBeGreaterThan(1.5);
    expect(Math.hypot(LONG_EYE.aim.x, LONG_EYE.aim.z)).toBeCloseTo(1, 2);
    // the lantern hangs from an arm at the tower's corner toward the walk, right of the tower, under the eave and against the sky
    const hook = terraceProject(...lampHook());
    expect(plan.lamp).toEqual({ x: Math.round(hook.x), y: Math.round(hook.y) });
    expect(plan.lamp.x).toBeGreaterThan(terraceProject(...onTower(1, 0)).x + 8);
    expect(plan.lamp.y).toBeGreaterThan(terraceProject(...onTower(1, 0, TOWER.eave)).y);
    expect(plan.lamp.y).toBeLessThan(plan.horizon);
  });

  it('ft_1_19.AC12 the grill stands on the deck by its seaward rail, clear of the walk\'s mouth, its smoke\'s foot in the picture with the sky over it', () => {
    expect(GRILL.u).toBeGreaterThan(DECK.u0);
    expect(GRILL.u + GRILL.r).toBeLessThan(DECK.u1);
    expect(GRILL.v + GRILL.r).toBeLessThan(DECK.v1);
    expect(GRILL.u + GRILL.r).toBeLessThan(REACH.u0);
    expect(plan.fire.x).toBeGreaterThan(W * 0.4);
    expect(plan.fire.x).toBeLessThan(W - 20);
    expect(plan.fire.y).toBeGreaterThan(plan.horizon);
    expect(plan.fire.y).toBeLessThan(H * 0.6);
  });

  it('ft_1_19.AC1 the torches are few: a pair at the head\'s near corners and one at the deck\'s rail, none plumb, none behind a being\'s head, each flame in the picture and to its scale (torches at night, the terrace being like the village plaza, and calm)', () => {
    expect(TORCHES).toHaveLength(3);
    expect(plan.torches).toHaveLength(TORCHES.length);
    const end = REACH.long + REACH.deep;
    TORCHES.forEach((torch, k) => {
      // at a rail: on the boards, within half a metre of their edge
      if (torch.on === 'deck') {
        expect(torch.u).toBeGreaterThan(DECK.u0);
        expect(torch.u).toBeLessThan(DECK.u1);
        expect(torch.v).toBeGreaterThan(DECK.v0);
        expect(torch.v).toBeLessThan(DECK.v1);
        expect(Math.min(torch.u - DECK.u0, DECK.u1 - torch.u, DECK.v1 - torch.v)).toBeLessThan(0.5);
      } else {
        const { u0, u1 } = reachSides(torch.v);
        expect(torch.v).toBeGreaterThan(0);
        expect(torch.v).toBeLessThan(end);
        expect(torch.u).toBeGreaterThanOrEqual(u0);
        expect(torch.u).toBeLessThanOrEqual(u1);
        expect(Math.min(torch.u - u0, u1 - torch.u, end - torch.v)).toBeLessThan(0.5);
        // clear of the watchtower's posts
        expect(torch.u < TOWER.u0 - 0.5 || torch.u > TOWER.u1 + 0.5 || torch.v < TOWER.t0 - 0.5 || torch.v > TOWER.t1 + 0.5).toBe(true);
      }
      expect(torch.high).toBeGreaterThan(1);
      expect(torch.high).toBeLessThanOrEqual(2.2);
      expect(Math.abs(torch.lean)).toBeGreaterThan(0.01);
      expect(Math.abs(torch.lean)).toBeLessThan(0.1);
      expect(onTorch(torch, 2)[0] - onTorch(torch)[0]).toBeCloseTo(torch.lean * 2, 9);
      const at = plan.torches[k]!, head = onTorch(torch, torch.high), there = terraceProject(...head);
      expect(at.x).toBe(Math.round(there.x));
      expect(at.y).toBe(Math.round(there.y));
      expect(at.tall).toBe(Math.max(5, Math.round((TERRACE.lens * TORCH_FLAME) / head[2])));
      expect(at.x).toBeGreaterThan(8);
      expect(at.x).toBeLessThan(W - 8);
      expect(at.y - at.tall).toBeGreaterThan(20);
      expect(at.y).toBeLessThan(H * 0.55);
      expect(Math.hypot(at.x - plan.lamp.x, at.y - at.tall / 2 - plan.lamp.y)).toBeGreaterThan(30);
      for (const spot of plan.spots) expect(Math.abs(at.x - spot.feet.x)).toBeGreaterThan(24);
    });
    const byFar = TORCHES.map((torch, k) => ({ k, far: onTorch(torch)[2] })).sort((p, q) => p.far - q.far);
    expect([...TORCH_SPARKS].sort()).toEqual(byFar.slice(0, 2).map((t) => t.k).sort());
    // the near pair on the head, one each side of the picture, and one on the deck
    const near = TORCHES.filter((torch) => torch.on === 'reach');
    expect(near).toHaveLength(2);
    expect(near.every((torch) => end - torch.v < 0.5)).toBe(true);
    expect(near.some((torch) => torch.u > REACH.u1)).toBe(true);
    expect(near.some((torch) => torch.u < REACH.u0)).toBe(true);
  });

  it('ft_1_19.AC1 the boulders lie in the picture, most of them out in the water', () => {
    let wet = 0;
    for (const r of TERRACE_ROCKS) {
      const p = terraceProject(r.x, 0, r.z);
      expect(p.x).toBeGreaterThan(-20);
      expect(p.x).toBeLessThan(W + 20);
      expect(p.y).toBeGreaterThan(plan.horizon);
      expect(p.far).toBe(r.z);
      if (r.z > shore[Math.max(0, Math.min(W - 1, Math.round(p.x)))]!.far) wet++;
    }
    expect(wet).toBeGreaterThan(TERRACE_ROCKS.length * 0.6);
    // a point behind the eye is held just before it, so nothing divides by nought
    expect(terraceProject(1, 0, -3).far).toBeCloseTo(0.05, 6);
  });

  it('ft_1_19.AC8 the beings stand on the head\'s open boards in a row, to the picture\'s scale, their buttons inside the picture and apart', () => {
    expect(plan.spots).toHaveLength(TERRACE_SPOTS.length);
    const view = terraceView({ w: 320, h: 180 }, 0);
    plan.spots.forEach((spot, k) => {
      const { u, v } = TERRACE_SPOTS[k]!;
      // on the head, between its sides, clear of the watchtower
      expect(underReach(u, v)).toBe(true);
      expect(v - DECK.v1).toBeGreaterThan(REACH.long);
      expect(u).toBeLessThan(TOWER.u0);
      // about ten metres ahead: a figure of the game's size is a grown person there
      const [, , z] = onDeck(u, v);
      expect(z).toBeGreaterThan(9.5);
      expect(z).toBeLessThan(11.5);
      expect(spot.feet.x).toBeGreaterThan(W * 0.3);
      expect(spot.feet.x).toBeLessThan(W * 0.8);
      expect(spot.feet.y).toBeGreaterThan(plan.horizon);
      expect(spot.feet.y).toBeLessThan(H - 20);
      expect(spot.button.x).toBeGreaterThanOrEqual(0);
      expect(spot.button.y).toBeGreaterThanOrEqual(0);
      expect(spot.button.x + spot.button.w).toBeLessThanOrEqual(view.picture.w);
      expect(spot.button.y + spot.button.h).toBeLessThanOrEqual(view.picture.h);
      if (k > 0) expect(spot.button.x).toBeGreaterThanOrEqual(plan.spots[k - 1]!.button.x + plan.spots[k - 1]!.button.w);
    });
  });
});
