import { describe, expect, it } from 'vitest';
import keriJson from '../../../content/world/keri.json';
import { insideRing, loadWorld } from '../world/world';
import { ART_DETAIL } from './frame';
import { ROOM_PICTURE } from './room';
import { bend, SQUARE, SQUARE_ID, SQUARE_PICTURE, SQUARE_SPOTS, SQUARE_VIEW, squarePlan, squareView } from './square';

const KERI = loadWorld(keriJson);
const plan = squarePlan();

describe('the village square: its plan', () => {
  it('ft_1_19.AC1 the picture fills a scene\'s whole main area, 180 rows, the horizon high because the eye stands on the hill', () => {
    expect(SQUARE_PICTURE).toEqual({ w: ROOM_PICTURE.w, h: 180 });
    expect(plan.fine).toEqual({ w: 320 * ART_DETAIL, h: 180 * ART_DETAIL });
    expect(plan.horizon / plan.fine.h).toBeGreaterThan(0.2);
    expect(plan.horizon / plan.fine.h).toBeLessThan(0.4);
  });

  it('ft_1_20 the picture lies from the top where it does not fit, and what is pressed keeps to its upper 124 rows', () => {
    expect(squareView({ w: 320, h: 124 }, 0).picture).toEqual({ x: 0, y: 0, w: 320, h: 180 });
    expect(squareView({ w: 320, h: 180 }, 0).picture).toEqual({ x: 0, y: 0, w: 320, h: 180 });
    for (const spot of plan.spots) expect(spot.button.y + spot.button.h).toBeLessThanOrEqual(ROOM_PICTURE.h);
    expect((plan.pier.y + plan.pier.h) / ART_DETAIL).toBeLessThanOrEqual(ROOM_PICTURE.h);
  });

  it('ft_1_19.AC1 the square is a scene of the world model, on the island between the side building and the old boat shed, and the viewer stands at the lighthouse\'s foot', () => {
    const place = KERI.scenes!.find((s) => s.id === SQUARE_ID)!;
    expect(insideRing(KERI.coast, place)).toBe(true);
    const eye = { x: KERI.places.lighthouse.x + SQUARE_VIEW.x, y: KERI.places.lighthouse.y + SQUARE_VIEW.y };
    expect(insideRing(KERI.coast, eye)).toBe(true);
    expect(Math.hypot(SQUARE_VIEW.x, SQUARE_VIEW.y)).toBeLessThan(15);
    // the view looks east-south-east, toward the sea south of the old boat shed
    expect(SQUARE_VIEW.bearing).toBeGreaterThan(90);
    expect(SQUARE_VIEW.bearing).toBeLessThan(135);
    // the place lies ahead of the viewer, east and south of the eye
    expect(place.x).toBeGreaterThan(eye.x);
    expect(place.y).toBeLessThan(eye.y);
  });

  it('ft_1_19.AC1 the bent view leaves the middle column upright and the foot of the picture where it was, and bows level lines down at the sides', () => {
    expect(bend(SQUARE.w / 2, 100)[0]).toBe(SQUARE.w / 2);
    expect(bend(100, SQUARE.h)).toEqual([100, SQUARE.h]);
    expect(bend(0, SQUARE.horizon)[1]).toBeGreaterThan(bend(SQUARE.w / 2, SQUARE.horizon)[1]);
    expect(bend(SQUARE.w, SQUARE.horizon)[1]).toBeCloseTo(bend(0, SQUARE.horizon)[1]);
  });

  it('ft_1_19.AC1 the pier\'s box lies in the picture under the horizon, right of the middle, and clear of the foot, which a taller picture may one day take', () => {
    const { pier } = plan;
    expect(pier.x).toBeGreaterThan(plan.fine.w / 2);
    expect(pier.x + pier.w).toBeLessThanOrEqual(plan.fine.w);
    expect(pier.y + pier.h).toBeGreaterThan(plan.horizon);
    expect(pier.y + pier.h).toBeLessThan(plan.fine.h * 0.7);
  });

  it('ft_1_19.AC2 the beings\' places stand on the flagstones inside the picture, apart from each other and off the pier', () => {
    expect(plan.spots).toHaveLength(SQUARE_SPOTS.length);
    for (const [i, spot] of plan.spots.entries()) {
      expect(spot.feet.y).toBeGreaterThan(180);
      expect(spot.feet.y).toBeLessThanOrEqual(plan.fine.h);
      expect(spot.button.x).toBeGreaterThanOrEqual(0);
      expect(spot.button.x + spot.button.w).toBeLessThanOrEqual(SQUARE_PICTURE.w);
      expect(spot.button.y).toBeGreaterThanOrEqual(0);
      for (const other of plan.spots.slice(i + 1)) expect(Math.hypot(other.feet.x - spot.feet.x, other.feet.y - spot.feet.y)).toBeGreaterThan(40);
    }
  });
});
