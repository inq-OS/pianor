import { describe, expect, it } from 'vitest';
import keriJson from '../../../content/world/keri.json';
import { insideRing, loadWorld } from '../world/world';
import { LOW_PICTURE } from './room';
import { DECK, GRILL, LONG_EYE, REACH, TERRACE, TERRACE_ID, TERRACE_LAND, TERRACE_ROCKS, TORCHES, TORCH_FLAME, TORCH_SPARKS, TOWER, deckOf, fromTerrace, lampHook, onDeck, onReach, onTorch, onTower, reachSides, terraceFloor, terraceGrassy, terraceGroundAt, terracePlace, terracePlan, terraceProject, terraceRise, terraceShore, underReach } from './terrace';

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

  it('ft_1_19.AC1 the viewer stands on land and looks away from the house, a little south of west, out to sea (the mark on the reference photograph)', () => {
    const place = terracePlace(KERI);
    const eye = fromTerrace(place, 0, 0);
    expect(insideRing(KERI.coast, eye)).toBe(true);
    // the house's front faces bearing 205: the view is within 45 degrees of it, and west of south-west
    expect(Math.abs(TERRACE.heading - 205)).toBeLessThan(45);
    expect(TERRACE.heading).toBeGreaterThan(225);
    // straight ahead the land ends and the sea begins
    expect(insideRing(KERI.coast, fromTerrace(place, 0, 60))).toBe(false);
    // the house is behind the viewer
    const house = KERI.buildings.find((b) => b.id === 'warden-house')!;
    const a = (TERRACE.heading * Math.PI) / 180;
    expect((house.x - eye.x) * Math.sin(a) + (house.y - eye.y) * Math.cos(a)).toBeLessThan(0);
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

  it('ft_1_19.AC1 the ground rises from the water to the ground before the house, and the eye on the deck sees the whole beach', () => {
    expect(terraceRise(0)).toBe(0);
    expect(terraceRise(-5)).toBe(0);
    expect(terraceRise(TERRACE_LAND.beach)).toBeCloseTo(TERRACE_LAND.top, 6);
    expect(terraceRise(TERRACE_LAND.beach * 3)).toBeCloseTo(TERRACE_LAND.top, 6);
    for (let d = 1; d <= TERRACE_LAND.beach; d++) expect(terraceRise(d)).toBeGreaterThan(terraceRise(d - 1));
    expect(DECK.y).toBeGreaterThan(TERRACE_LAND.top);
    expect(TERRACE.overSea - DECK.y).toBeCloseTo(1.7, 6);
    // down a column the floor goes from the far sea to the wet shingle to the bank, nearer and higher row by row
    for (const x of [40, 150, 300, 450]) {
      let last = Infinity, sea = 0, land = 0, foot = 0;
      for (let y = TERRACE.horizon + 1; y < H; y++) {
        const f = terraceFloor(shore, x, y)!;
        expect(f.z).toBeLessThanOrEqual(last + 1e-6);
        last = f.z;
        if (f.wet) {
          expect(land).toBe(0);
          expect(f.y).toBe(0);
          expect(f.inland).toBeLessThanOrEqual(0);
          sea++;
        } else {
          expect(f.inland).toBeGreaterThanOrEqual(-1e-6);
          expect(f.y).toBeCloseTo(terraceRise(f.inland), 6);
          if (f.inland < 3) foot++;
          land++;
        }
      }
      expect(sea).toBeGreaterThan(20);
      expect(land).toBeGreaterThan(40);
      // where the water is near (the picture's left and middle) the beach's foot is in sight: no bank hides it. Far to
      // the right the brow of the ground before the house stands before the beach, as a brow does
      if (x <= 300) expect(foot).toBeGreaterThan(0);
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

  it('ft_1_19.AC1 the deck lies under the eye and runs out toward the sea; its frame turns to the plan and back', () => {
    for (const [u, v] of [[0, 0], [3, 5], [-1, 6.5], [10, 2]] as const) {
      const [x, y, z] = onDeck(u, v, 0.4);
      expect(y).toBeCloseTo(DECK.y + 0.4, 6);
      const back = deckOf(x, z);
      expect(back.u).toBeCloseTo(u, 6);
      expect(back.v).toBeCloseTo(v, 6);
    }
    // the eye stands on the deck, and the deck's seaward edge crosses the picture from low on the left to higher on the right
    expect(DECK.u0).toBeLessThan(0);
    expect(DECK.v0).toBeLessThan(0);
    const left = terraceProject(...onDeck(DECK.u0, DECK.v1)), right = terraceProject(...onDeck(DECK.u1, DECK.v1));
    expect(left.x).toBeLessThan(0);
    expect(right.x).toBeGreaterThan(W * 0.6);
    expect(right.x).toBeLessThan(W);
    expect(left.y).toBeGreaterThan(right.y);
    expect(right.y).toBeGreaterThan(plan.horizon);
  });

  it('ft_1_19.AC1 a walk of boards reaches from the deck\'s seaward edge out over the beach, a step lower, to a head that stands past the water\'s edge (extend further out over the beach, with features and character)', () => {
    // it leaves the deck's edge inside the deck's width, and is longer than the deck is deep
    expect(REACH.u0).toBeGreaterThan(DECK.u0);
    expect(REACH.u1).toBeLessThan(DECK.u1);
    expect(REACH.long + REACH.deep).toBeGreaterThan(DECK.v1);
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
    // what lies under its boards
    expect(underReach(4, DECK.v1 + 3)).toBe(true);
    expect(underReach(1.5, DECK.v1 + 3)).toBe(false);
    expect(underReach(1.5, DECK.v1 + REACH.long + 1)).toBe(true);
    expect(underReach(4, DECK.v1 - 0.5)).toBe(false);
    expect(underReach(4, DECK.v1 + REACH.long + REACH.deep + 0.5)).toBe(false);
    // the whole of it is in the picture, left of the middle, and its far corner stands over the water, past the island's edge
    const corners = [onReach(REACH.u0, 0), onReach(REACH.u1, 0), onReach(REACH.head.u0, REACH.long), onReach(REACH.head.u1, REACH.long), onReach(REACH.head.u0, REACH.long + REACH.deep), onReach(REACH.head.u1, REACH.long + REACH.deep)];
    for (const corner of corners) {
      const p = terraceProject(...corner);
      expect(p.x).toBeGreaterThan(40);
      expect(p.x).toBeLessThan(W * 0.62);
      expect(p.y).toBeGreaterThan(plan.horizon + 20);
      expect(p.y).toBeLessThan(H - 30);
    }
    const [xf, , zf] = onReach(REACH.head.u0, REACH.long + REACH.deep);
    const far = terraceProject(xf, DECK.y - REACH.drop, zf);
    expect(zf).toBeGreaterThan(shore[Math.round(far.x)]!.far);
    expect(insideRing(KERI.coast, fromTerrace(terracePlace(KERI), xf, zf))).toBe(false);
    // its mouth is nearer the eye than its head: it runs away from the viewer
    expect(z0).toBeLessThan(zf);
  });

  it('ft_1_19.AC1 a stage set: the horizon a third down, the watchtower on the head\'s seaward corner on the picture\'s left, a storey up with a roof over it and a staff on its peak (a small watchtower of about two floors with a fixed telescope to scan the horizon)', () => {
    expect(plan.fine).toEqual({ w: LOW_PICTURE.w * 2, h: LOW_PICTURE.h * 2 });
    expect(plan.horizon).toBe(TERRACE.horizon);
    expect(plan.horizon).toBeGreaterThan(H * 0.3);
    expect(plan.horizon).toBeLessThan(H * 0.45);
    // it stands on the head, inside its boards, at the corner furthest out and furthest left
    expect(TOWER.u0).toBeGreaterThan(REACH.head.u0);
    expect(TOWER.u1).toBeLessThan((REACH.head.u0 + REACH.head.u1) / 2);
    expect(TOWER.t0).toBeGreaterThan(REACH.long);
    expect(TOWER.t1).toBeLessThan(REACH.long + REACH.deep);
    expect(onTower(0, 0)).toEqual(onReach(TOWER.u0, TOWER.t0));
    // it leans a little to the right as it rises, as nothing on this deck is plumb
    const up = onTower(1, 1, 2), plumb = onReach(TOWER.u1, TOWER.t1, 2);
    expect(up[0] - plumb[0]).toBeCloseTo(TOWER.lean * 2, 6);
    expect([up[1], up[2]]).toEqual([plumb[1], plumb[2]]);
    expect(TOWER.lean).toBeGreaterThan(0.01);
    expect(TOWER.lean).toBeLessThan(0.08);
    // its floor is a storey up (over a grown person's head, the eye's too), its rail a rail's height, its roof over that
    expect(TOWER.floor).toBeGreaterThan(2.1);
    expect(TOWER.floor).toBeLessThan(3);
    expect(DECK.y - REACH.drop + TOWER.floor).toBeGreaterThan(TERRACE.overSea);
    expect(TOWER.eave - TOWER.floor).toBeGreaterThan(1.7);
    expect(TOWER.peak).toBeGreaterThan(TOWER.eave + 0.6);
    // the whole of it is in the picture's left third: its feet under the horizon, its floor and its roof over it, in the sky
    for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) {
      const foot = terraceProject(...onTower(a, b)), floor = terraceProject(...onTower(a, b, TOWER.floor)), eave = terraceProject(...onTower(a, b, TOWER.eave));
      expect(foot.x).toBeGreaterThan(70);
      expect(foot.x).toBeLessThan(W / 3);
      expect(foot.y).toBeGreaterThan(plan.horizon + 20);
      expect(floor.y).toBeLessThan(plan.horizon);
      expect(eave.y).toBeLessThan(floor.y - 30);
      expect(eave.y).toBeGreaterThan(20);
    }
    // the pennant flies from the staff on the peak, inside the picture
    const peak = terraceProject(...onTower(0.5, 0.5, TOWER.peak));
    expect(plan.pennant.x).toBe(Math.round(peak.x));
    expect(plan.pennant.y).toBeLessThan(peak.y);
    expect(plan.pennant.y).toBeGreaterThan(2);
    // the long-eye stands on the tower's floor, its pivot over the rail and under the eave, and it points along the horizon: nearly level, to the left
    expect(LONG_EYE.a).toBeGreaterThan(0);
    expect(LONG_EYE.a).toBeLessThan(1);
    expect(LONG_EYE.b).toBeGreaterThan(0);
    expect(LONG_EYE.b).toBeLessThan(1);
    expect(LONG_EYE.high).toBeGreaterThan(TOWER.rail);
    expect(TOWER.floor + LONG_EYE.high).toBeLessThan(TOWER.eave - 0.3);
    expect(LONG_EYE.long).toBeGreaterThan(1.5);
    expect(LONG_EYE.aim.x).toBeLessThan(-0.9);
    expect(Math.hypot(LONG_EYE.aim.x, LONG_EYE.aim.z)).toBeCloseTo(1, 2);
    // the lantern hangs from an arm at the corner toward the walk, right of the tower, under the eave and against the sky
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
    expect(GRILL.u - GRILL.r).toBeGreaterThan(REACH.u1);
    expect(plan.fire.x).toBeGreaterThan(W * 0.6);
    expect(plan.fire.x).toBeLessThan(W - 20);
    expect(plan.fire.y).toBeGreaterThan(plan.horizon);
    expect(plan.fire.y).toBeLessThan(H * 0.6);
  });

  it('ft_1_19.AC1 the plaza\'s torches stand at the rails round the deck and down the walk, none plumb, none behind a being\'s head, a low pair at the walk\'s mouth, each flame in the picture and to its scale (torches at night, the terrace being like the village plaza)', () => {
    expect(TORCHES.length).toBeGreaterThanOrEqual(6);
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
        expect(torch.u).toBeGreaterThan(u0);
        expect(torch.u).toBeLessThan(u1);
        expect(Math.min(torch.u - u0, u1 - torch.u, end - torch.v)).toBeLessThan(0.5);
        // clear of the watchtower's posts
        expect(torch.u > TOWER.u1 + 0.5 || torch.v < TOWER.t0 - 0.5).toBe(true);
      }
      // a head over the rail and within a grown hand's reach; no torch stands plumb
      expect(torch.high).toBeGreaterThan(1);
      expect(torch.high).toBeLessThanOrEqual(2.2);
      expect(Math.abs(torch.lean)).toBeGreaterThan(0.01);
      expect(Math.abs(torch.lean)).toBeLessThan(0.1);
      expect(onTorch(torch, 2)[0] - onTorch(torch)[0]).toBeCloseTo(torch.lean * 2, 9);
      // its flame stands on its head, whole in the picture, and to the picture's scale there
      const at = plan.torches[k]!, head = onTorch(torch, torch.high), there = terraceProject(...head);
      expect(at.x).toBe(Math.round(there.x));
      expect(at.y).toBe(Math.round(there.y));
      expect(at.tall).toBe(Math.max(5, Math.round((TERRACE.lens * TORCH_FLAME) / head[2])));
      expect(at.x).toBeGreaterThan(8);
      expect(at.x).toBeLessThan(W - 8);
      expect(at.y - at.tall).toBeGreaterThan(20);
      expect(at.y).toBeLessThan(H * 0.55);
      // clear of the watchtower's lantern, which is a light of another kind
      expect(Math.hypot(at.x - plan.lamp.x, at.y - at.tall / 2 - plan.lamp.y)).toBeGreaterThan(30);
    });
    // the two that throw sparks are the two nearest the eye
    const byFar = TORCHES.map((torch, k) => ({ k, far: onTorch(torch)[2] })).sort((p, q) => p.far - q.far);
    expect([...TORCH_SPARKS].sort()).toEqual(byFar.slice(0, 2).map((t) => t.k).sort());
    // a plaza: torches on the deck and down the walk alike
    expect(TORCHES.filter((torch) => torch.on === 'deck').length).toBeGreaterThanOrEqual(3);
    expect(TORCHES.filter((torch) => torch.on === 'reach').length).toBeGreaterThanOrEqual(2);
    // the low pair at the walk's mouth, one each side, their flames under the string of lanterns
    const mouth = TORCHES.filter((torch) => torch.on === 'deck' && torch.v > DECK.v1 - 0.3 && torch.u > REACH.u0 - 0.6 && torch.u < REACH.u1 + 0.6);
    expect(mouth).toHaveLength(2);
    expect(mouth.some((torch) => torch.u < REACH.u0)).toBe(true);
    expect(mouth.some((torch) => torch.u > REACH.u1)).toBe(true);
    for (const torch of mouth) expect(torch.high + TORCH_FLAME).toBeLessThan(1.7);
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
});
