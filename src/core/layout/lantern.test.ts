import { describe, expect, it } from 'vitest';
import keriJson from '../../../content/world/keri.json';
import { bearing, loadWorld } from '../world/world';
import { LANTERN, LANTERN_PICTURE, lanternEye, lanternGround, lanternPlan, lanternProject, lanternSight } from './lantern';
import { ART_DETAIL } from './frame';

const KERI = loadWorld(keriJson);
const plan = lanternPlan();
const { w: W, h: H } = plan.fine;
const eye = lanternEye(KERI);

describe('the lantern over Keri: the plan of the main menu\'s picture (ft_1_07)', () => {
  it('the picture is the whole screen: no band lies under the main menu (no lower section)', () => {
    expect(plan.fine).toEqual({ w: LANTERN_PICTURE.w * ART_DETAIL, h: LANTERN_PICTURE.h * ART_DETAIL });
    expect(W).toBe(640);
    expect(H).toBe(360);
  });

  it('the horizon is where the viewer\'s eye is, never on the middle row (art-direction rule 21)', () => {
    expect(plan.horizon / H).toBeGreaterThan(0.35);
    expect(plan.horizon / H).toBeLessThan(0.65);
    expect(plan.horizon).not.toBe(H / 2);
  });

  it('the viewer hangs in the air a few metres from the lantern, at its height, and looks north-west past it over the island', () => {
    const tower = KERI.places.lighthouse;
    expect(Math.hypot(eye.x - tower.x, eye.y - tower.y)).toBeGreaterThan(3);
    expect(Math.hypot(eye.x - tower.x, eye.y - tower.y)).toBeLessThan(12);
    expect(LANTERN.overSea).toBeGreaterThan(25);
    expect(LANTERN.heading).toBeGreaterThan(270);
    expect(LANTERN.heading).toBeLessThan(360);
    // the lighthouse itself stands ahead and to the right of where the viewer looks, where the painter puts the lantern
    const turn = ((bearing(eye, tower) - LANTERN.heading + 540) % 360) - 180;
    expect(turn).toBeGreaterThan(5);
    expect(turn).toBeLessThan(40);
    expect(Math.abs(W / 2 + LANTERN.lens * Math.tan((turn * Math.PI) / 180) - plan.lantern.x)).toBeLessThan(8);
  });

  it('a point of the ground and its pixel are each other\'s inverse', () => {
    for (const p of [{ x: -119, y: 51 }, { x: -220, y: 100 }, { x: -60, y: 45 }, { x: -300, y: 150 }]) {
      const at = lanternProject(eye, p);
      const back = lanternGround(eye, at.x, at.y)!;
      expect(back.x).toBeCloseTo(p.x, 4);
      expect(back.y).toBeCloseTo(p.y, 4);
    }
    expect(lanternGround(eye, 100, plan.horizon)).toBeNull();
    expect(lanternGround(eye, 100, plan.horizon - 20)).toBeNull();
  });

  it('the line of sight through a pixel passes every point that lands on that pixel, whatever its height (the island stands over the sea)', () => {
    for (const [p, up] of [[{ x: -119, y: 51 }, 4], [{ x: -68, y: 10 }, 5.5], [{ x: -220, y: 100 }, 0]] as const) {
      const at = lanternProject(eye, p, up);
      const on = lanternSight(eye, at.x, at.y, at.far);
      expect(on.x).toBeCloseTo(p.x, 4);
      expect(on.y).toBeCloseTo(p.y, 4);
      expect(on.up).toBeCloseTo(up, 4);
    }
    // it leaves the eye at the eye's height and goes down under the horizon
    expect(lanternSight(eye, 200, 300, 0)).toEqual({ x: eye.x, y: eye.y, up: LANTERN.overSea });
    expect(lanternSight(eye, 200, 300, 50).up).toBeLessThan(LANTERN.overSea);
  });

  it('what stands up rises on the picture, and what is further off lies nearer the horizon', () => {
    const house = KERI.buildings.find((b) => b.id === 'warden-house')!;
    const foot = lanternProject(eye, house), roof = lanternProject(eye, house, 8);
    expect(roof.y).toBeLessThan(foot.y);
    const spit = lanternProject(eye, { x: -280, y: 140 });
    expect(spit.y).toBeLessThan(foot.y);
    expect(spit.y).toBeGreaterThan(plan.horizon);
    expect(spit.far).toBeGreaterThan(foot.far);
  });

  it('the warden\'s house, the mast at its gable and the well house lie in the picture, left of the lantern and under the horizon, as the reference photograph has them', () => {
    const mast = (KERI.landmarks ?? []).find((l) => l.id === 'mast')!;
    for (const thing of [KERI.buildings.find((b) => b.id === 'warden-house')!, mast, KERI.buildings.find((b) => b.id === 'hut-west')!]) {
      const at = lanternProject(eye, thing);
      // right of the sheet of names, which hangs over the picture's left (`mainMenu.ts`)
      expect(at.x).toBeGreaterThan(200);
      expect(at.x).toBeLessThan(plan.lantern.x - plan.lantern.ring);
      expect(at.y).toBeGreaterThan(plan.horizon + 20);
      expect(at.y).toBeLessThan(H);
    }
  });

  it('the houses at the lighthouse\'s own foot are under the viewer, outside the picture', () => {
    for (const id of ['building-2', 'building-3', 'red-shed', 'wood-shed']) {
      const b = KERI.buildings.find((x) => x.id === id)!;
      const at = lanternProject(eye, b);
      expect(at.far < 1 || at.y > H || at.x < 0 || at.x > W).toBe(true);
    }
  });

  it('the lantern stands whole in the picture from its gallery to the top of its dome, right of the middle, where it stays, and takes most of its height: grand', () => {
    const { x, floor, ring, top } = plan.lantern;
    expect(x - ring).toBeGreaterThan(W / 2);
    expect(x + ring).toBeLessThan(W);
    expect(top).toBeGreaterThanOrEqual(2);
    expect(floor).toBeLessThan(H);
    expect(floor - top).toBeGreaterThan(H * 0.7);
    // the eye is at the height of its glass: the horizon crosses the panes
    expect(plan.horizon).toBeGreaterThan(plan.lantern.glass.top);
    expect(plan.horizon).toBeLessThan(plan.lantern.glass.bottom);
    // the light sits in the glass
    expect(plan.light.y).toBeGreaterThan(plan.lantern.glass.top);
    expect(plan.light.y).toBeLessThan(plan.lantern.glass.bottom);
    expect(Math.abs(plan.light.x - x)).toBeLessThan(ring / 4);
  });
});
