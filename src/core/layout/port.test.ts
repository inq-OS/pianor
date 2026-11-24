import { describe, expect, it } from 'vitest';
import keriJson from '../../../content/world/keri.json';
import { loadWorld } from '../world/world';
import { ART_DETAIL } from './frame';
import { BOAT_KINDS, PORT, PORT_BERTHS, PORT_MOORED, PORT_PICTURE, PORT_TALL, portPlace, portPlan, portWaterAt } from './port';
import { ROOM_PICTURE } from './room';

const KERI = loadWorld(keriJson);
const plan = portPlan();

describe('the southern harbour: its plan', () => {
  it('ft_1_19.AC10 the picture is the room\'s low wide band; the tall cut is that and the dive under it', () => {
    expect(PORT_PICTURE).toEqual(ROOM_PICTURE);
    expect(plan.fine).toEqual({ w: ROOM_PICTURE.w * ART_DETAIL, h: ROOM_PICTURE.h * ART_DETAIL });
    expect(plan.tall).toEqual({ w: plan.fine.w, h: plan.fine.h + PORT.dive });
    expect(PORT_TALL).toBe(plan.tall.h);
  });

  it('ft_1_19.AC10 from the top down: the horizon, the quay\'s top, its face to the water; the dive shows the water line and the bed', () => {
    expect(PORT.horizon).toBeLessThan(PORT.far);
    expect(PORT.far).toBeLessThan(PORT.deck);
    expect(PORT.deck).toBeLessThan(PORT.water);
    // the near water is in the view on top (it is what a press dives from) and the water line in the view under it
    expect(PORT.water).toBeLessThan(plan.fine.h - 20);
    expect(PORT.dive).toBeLessThan(PORT.water);
    expect(PORT.bed).toBeLessThan(PORT_TALL);
    expect(PORT.bed).toBeGreaterThan(PORT.water + 100);
    // the quay's head is in the picture, open water past it
    expect(PORT.head).toBeLessThan(plan.fine.w - 40);
  });

  it('ft_1_19.AC10 the water goes away to the horizon: a row nearer the horizon lies further off', () => {
    expect(portWaterAt(PORT.horizon + 4)).toBeGreaterThan(portWaterAt(PORT.far));
    expect(portWaterAt(PORT.far)).toBeGreaterThan(portWaterAt(plan.fine.h));
  });

  it('ft_1_19.AC10 the boats lie at berths behind the quay, side by side within the picture, and every boat moored is a kind that can come', () => {
    let right = -Infinity;
    for (const berth of PORT_BERTHS) {
      expect(berth.x).toBeGreaterThanOrEqual(right);
      right = berth.x + berth.room;
      expect(right).toBeLessThanOrEqual(PORT.head);
      // behind the quay: the parapet on its far edge hides the waterline
      expect(berth.water).toBeGreaterThan(PORT.far - 12);
      expect(berth.water).toBeLessThan(PORT.deck);
    }
    expect(PORT_MOORED.length).toBeLessThanOrEqual(PORT_BERTHS.length);
    for (const kind of PORT_MOORED) expect(BOAT_KINDS).toContain(kind);
  });

  it('ft_1_19.AC10 a press dives from the near water and rises from the water line\'s strip', () => {
    expect(plan.diveAt.y * ART_DETAIL).toBeGreaterThan(PORT.water);
    expect(plan.diveAt.y + plan.diveAt.h).toBe(PORT_PICTURE.h);
    expect(plan.riseAt.y).toBe(0);
    expect(plan.riseAt.h * ART_DETAIL).toBeLessThanOrEqual(PORT.water - PORT.dive);
  });

  it('ft_1_19.AC2 the harbour is a scene of the world model, at the southern slipway\'s foot by the water', () => {
    const at = portPlace(KERI);
    const slip = KERI.paths.find((p) => p.id === 'slipway')!;
    const foot = slip.points[slip.points.length - 1]!;
    expect(Math.hypot(at.x - foot[0], at.y - foot[1])).toBeLessThan(5);
    // the south of the island: the north jetty, the warden's, is far off
    const docks = (KERI.scenes ?? []).find((s) => s.id === 'docks')!;
    expect(at.y).toBeLessThan(docks.y - 100);
  });
});
