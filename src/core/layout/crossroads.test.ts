import { describe, expect, it } from 'vitest';
import keriJson from '../../../content/world/keri.json';
import { bearing, insideRing, loadWorld } from '../world/world';
import { ART_DETAIL } from './frame';
import { CROSSROADS, CROSSROADS_PICTURE, CROSSROADS_SPOTS, crossroadsEye, crossroadsHouses, crossroadsPaths, crossroadsPlace, crossroadsPlan, crossroadsShore, depthOfRow, onPicture, toCrossroads } from './crossroads';
import { ROOM_PICTURE } from './room';

const KERI = loadWorld(keriJson);
const plan = crossroadsPlan();

describe('the crossroads: its plan', () => {
  it('ft_1_19.AC1 the picture is the room\'s low wide band, so the same strip stays free under it', () => {
    expect(CROSSROADS_PICTURE).toEqual(ROOM_PICTURE);
    expect(plan.fine).toEqual({ w: ROOM_PICTURE.w * ART_DETAIL, h: ROOM_PICTURE.h * ART_DETAIL });
    // the horizon is where the viewer's eye is, never the middle row (art-direction rule 21)
    expect(plan.horizon).not.toBe(plan.fine.h / 2);
    expect(plan.horizon / plan.fine.h).toBeGreaterThan(0.35);
    expect(plan.horizon / plan.fine.h).toBeLessThan(0.65);
  });

  it('ft_1_19.AC1 the crossroads is a scene of the world model, on the fork of the traced tracks, and the viewer stands on the island before it', () => {
    const fork = crossroadsPlace(KERI);
    expect(insideRing(KERI.coast, fork)).toBe(true);
    const eye = crossroadsEye(KERI);
    expect(insideRing(KERI.coast, eye)).toBe(true);
    // the warden's house is behind the viewer (it stands just behind)
    const house = KERI.buildings.find((b) => b.id === 'warden-house')!;
    expect(toCrossroads(eye, house).z).toBeLessThan(0);
    expect(toCrossroads(eye, fork).z).toBeGreaterThan(3);
  });

  it('ft_1_19.AC1 as on the reference photograph: the fork near the middle, the green hut with the chimney up the left arm, the lighthouse up the right one', () => {
    const eye = crossroadsEye(KERI);
    const fork = onPicture(toCrossroads(eye, crossroadsPlace(KERI)));
    expect(fork.x / plan.fine.w).toBeGreaterThan(0.4);
    expect(fork.x / plan.fine.w).toBeLessThan(0.6);
    const lighthouse = onPicture(toCrossroads(eye, KERI.places.lighthouse));
    const hut = crossroadsHouses(KERI).find((h) => h.id === 'hut-middle')!;
    expect(hut.building.chimney).toBe(true);
    const hutX = hut.corners.reduce((a, c) => a + onPicture(c).x, 0) / 4;
    expect(hutX).toBeLessThan(fork.x);
    expect(lighthouse.x).toBeGreaterThan(fork.x);
    // both stand in the picture, the hut nearer than the lighthouse
    expect(hutX).toBeGreaterThan(0);
    expect(lighthouse.x).toBeLessThan(plan.fine.w);
    expect(Math.min(...hut.corners.map((c) => c.z))).toBeLessThan(toCrossroads(eye, KERI.places.lighthouse).z);
    // the view looks east, between them
    const look = CROSSROADS.heading;
    expect(look).toBeGreaterThan(bearing(eye, { x: hut.building.x, y: hut.building.y }));
    expect(look).toBeLessThan(bearing(eye, KERI.places.lighthouse));
  });

  it('ft_1_19.AC1 the paths are the stem to the fork and its two arms, one toward the hut, one toward the lighthouse', () => {
    const paths = crossroadsPaths(KERI);
    expect(paths.map((p) => p.id)).toEqual(['stem', 'hut', 'lighthouse']);
    const [stem, hut, light] = paths;
    // all three meet at the fork
    expect(stem!.points.at(-1)).toEqual(hut!.points[0]);
    expect(hut!.points[0]).toEqual(light!.points[0]);
    // the hut's arm turns left of the lighthouse's
    const toward = (p: { x: number; z: number }[]) => Math.atan2(p[1]!.x - p[0]!.x, p[1]!.z - p[0]!.z);
    expect(toward(hut!.points)).toBeLessThan(toward(light!.points));
  });

  it('ft_1_19.AC1 the ground under a row and a point on the ground go into each other; the sea shows over the low island only below the horizon', () => {
    for (const z of [3.5, 8, 20, 60]) expect(depthOfRow(onPicture({ x: 0, z }).y)).toBeCloseTo(z, 6);
    expect(depthOfRow(plan.horizon)).toBe(Infinity);
    for (const water of crossroadsShore(KERI)) expect(water).toBeGreaterThan(plan.horizon);
  });

  it('ft_1_19.AC8 the beings\' places are on the grass under the horizon, their buttons inside the picture', () => {
    for (const [i, spot] of CROSSROADS_SPOTS.entries()) {
      expect(spot.y).toBeGreaterThan(plan.horizon + 20);
      const b = plan.spots[i]!.button;
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.x + b.w).toBeLessThanOrEqual(CROSSROADS_PICTURE.w);
    }
  });
});
