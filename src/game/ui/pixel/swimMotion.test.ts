import { describe, expect, it } from 'vitest';
import { SCHOOL, bubblesAt, fishAt, jellyAt, schoolAt } from './swimMotion';

const WIDTH = 640;

describe('ft_1_19.AC11 swimming under the quay (swimMotion.ts: fish never reset their position and drift as the clouds do)', () => {
  it('a fish never jumps: while it is in sight it moves at most a pixel or two each 66 ms, and it goes and comes back from off the edges', () => {
    for (let k = 0; k < 5; k++) {
      let was = fishAt(k, 100, 30, WIDTH, 0);
      let seen = 0, away = 0;
      for (let t = 66; t < 400_000; t += 66) {
        const now = fishAt(k, 100, 30, WIDTH, t);
        if (now) seen++; else away++;
        if (was && now && was.right === now.right) {
          expect(Math.abs(now.x - was.x)).toBeLessThanOrEqual(2);
          expect(Math.abs(now.y - was.y)).toBeLessThanOrEqual(2);
        }
        // it comes into sight and leaves it only off an edge
        if (!was && now) expect(now.x <= -28 || now.x >= WIDTH - 2).toBe(true);
        if (was && !now) expect(was.x <= -28 || was.x >= WIDTH - 2).toBe(true);
        was = now;
      }
      expect(seen).toBeGreaterThan(0);
      expect(away).toBeGreaterThan(0);
    }
  });

  it('a fish swims both ways over time, at its own row give or take, and each fish keeps its own pace', () => {
    const ways = new Set<boolean>(), rows: number[] = [];
    for (let t = 0; t < 2_000_000; t += 500) {
      const at = fishAt(0, 100, 30, WIDTH, t);
      if (at) { ways.add(at.right); rows.push(at.y); }
    }
    expect(ways.size).toBe(2);
    expect(Math.min(...rows)).toBeGreaterThanOrEqual(100 - 12);
    expect(Math.max(...rows)).toBeLessThanOrEqual(100 + 12);
    expect(fishAt(1, 100, 30, WIDTH, 50_000)).not.toEqual(fishAt(2, 100, 30, WIDTH, 50_000));
  });

  it('the school moves as one: its fish are near each other and face the same way, and none jumps', () => {
    let was: ReturnType<typeof schoolAt>[] = SCHOOL.map((_, k) => schoolAt(k, 60, WIDTH, 0));
    for (let t = 66; t < 200_000; t += 66) {
      const now = SCHOOL.map((_, k) => schoolAt(k, 60, WIDTH, t));
      const shown = now.filter((p) => p !== null);
      if (shown.length > 0) {
        expect(new Set(shown.map((p) => p.right)).size).toBe(1);
        expect(Math.max(...shown.map((p) => p.x)) - Math.min(...shown.map((p) => p.x))).toBeLessThan(110);
      }
      now.forEach((p, k) => {
        const before = was[k];
        if (p && before && p.right === before.right) expect(Math.abs(p.x - before.x)).toBeLessThanOrEqual(2);
      });
      was = now;
    }
  });

  it('a jellyfish stays near where it hangs and pulses through its looks', () => {
    const looks = new Set<number>();
    for (let t = 0; t < 60_000; t += 100) {
      const at = jellyAt(0, 200, 50, 4, t);
      expect(Math.abs(at.x - 200)).toBeLessThanOrEqual(16);
      expect(Math.abs(at.y - 50)).toBeLessThanOrEqual(3);
      looks.add(at.look);
    }
    expect([...looks].sort()).toEqual([0, 1, 2, 3]);
  });

  it('bubbles rise: each a little higher a moment later, until it starts again at the bottom', () => {
    const a = bubblesAt({ x: 520, y: 200 }, 1000), b = bubblesAt({ x: 520, y: 200 }, 1066);
    a.forEach((p, k) => {
      const q = b[k]!;
      if (q.y < p.y + 100) expect(q.y).toBeLessThanOrEqual(p.y);
      expect(p.y).toBeLessThanOrEqual(200);
    });
  });
});
