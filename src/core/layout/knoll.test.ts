import { describe, expect, it } from 'vitest';
import keriJson from '../../../content/world/keri.json';
import { insideRing, loadWorld, onLand } from '../world/world';
import { ART_DETAIL } from './frame';
import { KNOLL, KNOLL_CLEARING, KNOLL_FIRE, KNOLL_PICTURE, KNOLL_PLATEAU, KNOLL_SPOTS, fromKnoll, knollCrest, knollPlace, knollPlan, knollShore, toKnoll } from './knoll';
import { rectBottom, rectRight, type Rect } from './rect';
import { ROOM_PICTURE } from './room';

const KERI = loadWorld(keriJson);
const plan = knollPlan();
const overlap = (a: Rect, b: Rect): boolean => a.x < rectRight(b) && b.x < rectRight(a) && a.y < rectBottom(b) && b.y < rectBottom(a);

describe('the grassy knoll: its plan (ft_1_19.AC9)', () => {
  it('ft_1_19.AC1 ft_1_19.AC9 the picture is the room\'s low wide band, so the same strip stays free under it', () => {
    expect(KNOLL_PICTURE).toEqual(ROOM_PICTURE);
    expect(plan.fine).toEqual({ w: ROOM_PICTURE.w * ART_DETAIL, h: ROOM_PICTURE.h * ART_DETAIL });
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

  it('ft_1_19.AC9 the knoll is a plateau with the sea over its lip: the lip highest by the fire, falling only a little to the left edge; past its shoulder it cuts off and its side comes down toward the viewer', () => {
    // the knoll is a plateau that rises gradually away from the house, then cuts off abruptly
    // to a drop to a rocky shore
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
    // the cut: past the shoulder it falls steeply at once, then keeps falling to the right edge
    expect(knollCrest(shoulder.x + cut.wide) - knollCrest(shoulder.x)).toBeGreaterThan(cut.drop * 0.8);
    for (let x = shoulder.x + cut.wide; x < plan.fine.w - 30; x += 30) expect(knollCrest(x + 30)).toBeGreaterThan(knollCrest(x));
    expect(knollCrest(plan.fine.w - 1)).toBeGreaterThan(top.y + 80);
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

  it('ft_1_19.AC8 a being\'s place is on the short grass round the fire; the buttons lie inside the picture, apart from each other, the first two left and right of the fire', () => {
    const whole: Rect = { x: 0, y: 0, w: KNOLL_PICTURE.w, h: KNOLL_PICTURE.h };
    expect(plan.spots).toHaveLength(KNOLL_SPOTS.length);
    expect(plan.spots.length).toBeGreaterThanOrEqual(4);
    for (const spot of KNOLL_SPOTS) {
      expect(Math.hypot((spot.x - KNOLL_CLEARING.x) / KNOLL_CLEARING.rx, (spot.y - KNOLL_CLEARING.y) / KNOLL_CLEARING.ry)).toBeLessThan(0.9);
      expect(spot.y).toBeGreaterThan(knollCrest(spot.x) + 10);
      // and not in the fire
      expect(Math.hypot((spot.x - KNOLL_FIRE.x) / KNOLL_FIRE.rx, (spot.y - KNOLL_FIRE.y) / KNOLL_FIRE.ry)).toBeGreaterThan(1.6);
    }
    plan.spots.forEach((spot, i) => {
      const { button, feet } = spot;
      expect(button.x >= whole.x && button.y >= whole.y && rectRight(button) <= whole.w && rectBottom(button) <= whole.h).toBe(true);
      // the feet are at the button's foot, in its middle
      expect(Math.abs(feet.x / ART_DETAIL - (button.x + button.w / 2))).toBeLessThanOrEqual(1);
      expect(rectBottom(button)).toBeGreaterThanOrEqual(feet.y / ART_DETAIL);
      plan.spots.slice(i + 1).forEach((other) => expect(overlap(button, other.button)).toBe(false));
    });
    expect(plan.spots[0]!.feet.x).toBeLessThan(plan.fire.x);
    expect(plan.spots[1]!.feet.x).toBeGreaterThan(plan.fire.x);
  });
});
