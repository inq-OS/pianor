import { describe, expect, it } from 'vitest';
import { FLAME_LOOP_MS, flameAt, glowAt } from './flicker';

describe('ft_1_19.AC11 a fire that licks (flicker.ts: the oven fire is calm, licking rather than biting)', () => {
  it('the flames go through every drawing in order, a little at a time, always forward and at a pace that wanders', () => {
    const n = 16, frame = 33;
    const seen = new Set<number>();
    let was = flameAt(0, n), fastest = 0, slowest = Infinity;
    for (let t = frame; t < 120_000; t += frame) {
      const now = flameAt(t, n);
      expect(now).toBeGreaterThanOrEqual(0);
      expect(now).toBeLessThan(n);
      const went = (now - was + n) % n;
      // forward, never by more than half a drawing in one screen frame: no jumps
      expect(went).toBeGreaterThan(0);
      expect(went).toBeLessThan(0.5);
      fastest = Math.max(fastest, went);
      slowest = Math.min(slowest, went);
      seen.add(Math.floor(now));
      was = now;
    }
    expect(seen.size).toBe(n);
    expect(fastest).toBeGreaterThan(slowest * 1.3);
    // its middle pace: a frame moves it about n / FLAME_LOOP_MS drawings a millisecond
    expect(fastest).toBeGreaterThan((n / FLAME_LOOP_MS) * frame);
    expect(slowest).toBeLessThan((n / FLAME_LOOP_MS) * frame);
  });

  it('the same moment shows the same place; another seed another fire', () => {
    expect(flameAt(12_345, 16, 3)).toBe(flameAt(12_345, 16, 3));
    expect(flameAt(12_345, 16, 1)).not.toBe(flameAt(12_345, 16, 2));
    expect(flameAt(500, 1)).toBe(0);
  });

  it('the light wanders smoothly over all its strengths: never out of range, never a jump between frames', () => {
    let lowest = Infinity, highest = -Infinity, was = glowAt(0, 3);
    for (let t = 16; t < 120_000; t += 16) {
      const g = glowAt(t, 3);
      expect(g).toBeGreaterThanOrEqual(0);
      expect(g).toBeLessThanOrEqual(2);
      expect(Math.abs(g - was)).toBeLessThan(0.15);
      lowest = Math.min(lowest, g);
      highest = Math.max(highest, g);
      was = g;
    }
    expect(lowest).toBeLessThan(0.4);
    expect(highest).toBeGreaterThan(1.6);
  });
});
