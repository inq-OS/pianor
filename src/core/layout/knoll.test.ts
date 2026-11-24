import { describe, expect, it } from 'vitest';
import keriJson from '../../../content/world/keri.json';
import { insideRing, loadWorld, onLand } from '../world/world';
import { ART_DETAIL, FRAME_MIN } from './frame';
import { KNOLL, KNOLL_FIRE, KNOLL_PICTURE, KNOLL_PLATEAU, fromKnoll, knollCrest, knollPlace, knollPlan, knollShore, toKnoll } from './knoll';

const KERI = loadWorld(keriJson);
const plan = knollPlan();

describe('the grassy knoll: its plan (ft_1_19.AC9)', () => {
  it('ft_1_19.AC1 ft_1_19.AC9 the picture fills every row of the target screen\'s main area', () => {
    expect(KNOLL_PICTURE).toEqual({ w: FRAME_MIN.width, h: FRAME_MIN.height });
    expect(plan.fine).toEqual({ w: FRAME_MIN.width * ART_DETAIL, h: FRAME_MIN.height * ART_DETAIL });
  });

  it('ft_1_19.AC9 the knoll is the scene of the world model, on the meadow; the viewer\'s metres and the island\'s go into each other', () => {
    const at = knollPlace(KERI);
    expect(insideRing(KERI.grass, at)).toBe(true);
    for (const [x, z] of [[3, -7], [-40, 12], [0, 0], [120, -260]] as const) {
      const back = toKnoll(at, fromKnoll(at, x, z));
      expect(back.x).toBeCloseTo(x, 9);
      expect(back.z).toBeCloseTo(z, 9);
    }
    // a metre toward the viewer's right and a metre away from the viewer are a metre on the island
    const right = fromKnoll(at, 1, 0), ahead = fromKnoll(at, 0, -1);
    expect(Math.hypot(right.x - at.x, right.y - at.y)).toBeCloseTo(1, 9);
    expect(Math.hypot(ahead.x - at.x, ahead.y - at.y)).toBeCloseTo(1, 9);
  });

  it('ft_1_19.AC9 the viewer looks south-south-west from the knoll, to the nearest shore: land under the first metres, the sea within 60 m, no house that way', () => {
    const at = knollPlace(KERI);
    const ahead = fromKnoll(at, 0, -1);
    expect(ahead.y).toBeLessThan(at.y);
    expect(ahead.x).toBeLessThan(at.x);
    expect(onLand(KERI, fromKnoll(at, 0, -8))).toBe(true);
    expect(onLand(KERI, fromKnoll(at, 0, -60))).toBe(false);
    // every house of the island is outside the picture: more than 40 degrees off the way the viewer looks
    for (const b of KERI.buildings) {
      const p = toKnoll(at, b);
      const off = Math.abs(Math.atan2(p.x, KNOLL.back - p.z));
      expect(off, b.id).toBeGreaterThan((plan.fine.w / 2) / KNOLL.lens);
    }
  });

  it('ft_1_19.AC9 the sea is a wide band across the whole picture: in every column the water\'s edge lies well under the horizon, lowest where the shore is nearest', () => {
    const shore = knollShore(KERI);
    expect(shore).toHaveLength(plan.fine.w);
    for (const column of shore) {
      expect(column.far).toBeGreaterThan(30);
      expect(column.far).toBeLessThan(90);
      expect(column.water - plan.horizon).toBeGreaterThan(28);
      expect(column.water).toBeLessThan(plan.fine.h * 0.6);
    }
    const nearest = shore.reduce((a, b) => (b.far < a.far ? b : a));
    expect(nearest.water).toBe(Math.max(...shore.map((c) => c.water)));
    // nearer water is lower in the picture
    expect(shore[320]!.far).toBeLessThan(shore[10]!.far);
    expect(shore[320]!.water).toBeGreaterThan(shore[10]!.water);
  });

  it('ft_1_19.AC9 the knoll is a plateau with the sea over its lip: the lip highest by the fire, falling only a little to the left edge; past its shoulder the edge leads off down to the right with no step, grass still high at the right edge', () => {
    // the knoll is a plateau that rises gradually away from the house, with a rocky shore below its far edge
    const { top, shoulder, cut } = KNOLL_PLATEAU;
    expect(top.y).toBeGreaterThan(plan.horizon + 20);
    const lip = Array.from({ length: shoulder.x + 1 }, (_, x) => knollCrest(x));
    // a plateau: across three quarters of the picture the lip stays within a few rows of its top, the left edge included (the left side continues and does not drop off)
    expect(Math.max(...lip) - Math.min(...lip)).toBeLessThan(12);
    expect(Math.abs(Math.min(...lip) - top.y)).toBeLessThan(3);
    // never ruled: it rises and falls a little along its length
    let turns = 0;
    for (let x = 2; x < shoulder.x; x += 2) if (Math.sign(lip[x]! - lip[x - 2]!) !== Math.sign(lip[x + 2 > shoulder.x ? x : x + 2]! - lip[x]!)) turns++;
    expect(turns).toBeGreaterThan(10);
    // past the shoulder the edge leads off to the right: no step and no wedge anywhere (never a row a pixel over a dozen pixels), yet it keeps falling to the right edge
    for (let x = shoulder.x - 12; x < plan.fine.w - 12; x++) expect(knollCrest(x + 12) - knollCrest(x), `no step at ${x}`).toBeLessThan(12);
    expect(knollCrest(shoulder.x + cut.wide) - knollCrest(shoulder.x)).toBeGreaterThan(cut.drop * 0.8);
    for (let x = shoulder.x; x < plan.fine.w - 60; x += 60) expect(knollCrest(x + 60)).toBeGreaterThan(knollCrest(x));
    // grass stands high at the right edge: the edge ends well above the picture's middle of the ground
    expect(knollCrest(plan.fine.w - 1)).toBeGreaterThan(top.y + 30);
    expect(knollCrest(plan.fine.w - 1)).toBeLessThan(top.y + 70);
    expect(knollCrest(plan.fine.w - 1)).toBeLessThan(plan.fine.h);
  });

  it('ft_1_19.AC9 the fire ring is by the plateau\'s lip, near the picture\'s middle, and the smoke rises from its embers', () => {
    expect(Math.abs(KNOLL_FIRE.x - plan.fine.w / 2)).toBeLessThan(60);
    expect(Math.abs(KNOLL_FIRE.x - KNOLL_PLATEAU.top.x)).toBeLessThan(20);
    // the ring's far stones reach the lip, its near ones lie on the plateau
    expect(KNOLL_FIRE.y - KNOLL_FIRE.ry).toBeGreaterThan(knollCrest(KNOLL_FIRE.x) - 2);
    expect(KNOLL_FIRE.y - KNOLL_FIRE.ry).toBeLessThan(knollCrest(KNOLL_FIRE.x) + 12);
    expect(Math.hypot(plan.fire.x - KNOLL_FIRE.x, plan.fire.y - KNOLL_FIRE.y)).toBeLessThan(4);
    expect(plan.fire.y).toBeGreaterThan(plan.horizon);
  });
});
