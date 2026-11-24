import { describe, expect, it } from 'vitest';
import { SEA_STATES, seaState, windFrom, windOfDay, type Wind } from './wind';
import { sceneLook } from './sceneLook';
import { KERI } from './skyPhase';

describe('the wind over Keri (ft_1_14.AC9)', () => {
  it('ft_1_14.AC9 each wind has its sea state: calm, an occasional wave, restless, stormy', () => {
    expect(([0, 1, 2, 3] as Wind[]).map(seaState)).toEqual(['calm', 'waves', 'restless', 'stormy']);
    expect(SEA_STATES).toHaveLength(4);
  });

  it('ft_1_14.AC9 the dev switch reads a number or a sea state and refuses anything else', () => {
    expect(windFrom('0')).toBe(0);
    expect(windFrom('3')).toBe(3);
    expect(windFrom('stormy')).toBe(3);
    expect(windFrom('calm')).toBe(0);
    expect(windFrom('restless')).toBe(2);
    for (const bad of [null, '', '4', '-1', '1.5', 'gale']) expect(windFrom(bad)).toBeNull();
  });

  it('ft_1_14.AC9 a day has one wind, the same at every hour of it, and over a year every wind comes, calm and breeze most often', () => {
    const day = Date.UTC(1998, 10, 9);
    expect(windOfDay(day + 3_600_000)).toBe(windOfDay(day + 80_000_000));
    const counts = [0, 0, 0, 0];
    for (let d = 0; d < 365; d++) counts[windOfDay(day + d * 86_400_000)]!++;
    for (const n of counts) expect(n).toBeGreaterThan(5);
    expect(counts[0]! + counts[1]!).toBeGreaterThan(counts[2]! + counts[3]!);
    expect(counts[3]!).toBeLessThan(counts[1]!);
  });

  it('ft_1_14.AC9 the scene look carries the day\'s wind, or the forced one', () => {
    const at = Date.UTC(1998, 10, 9, 12);
    expect(sceneLook(at, KERI).wind).toBe(windOfDay(at));
    for (const wind of [0, 1, 2, 3] as Wind[]) expect(sceneLook(at, KERI, null, wind).wind).toBe(wind);
  });
});
