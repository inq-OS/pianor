import { describe, expect, it } from 'vitest';
import { Flock, gullLook, gullLooks, type FlockRules } from './flock';

const SKY: FlockRules = { box: { x: 0, y: 20, w: 600, h: 60 }, speed: [8, 18], sight: 60, room: 8, part: 20, align: 1, gather: 0.3, wander: 6, climb: 0.25 };

describe('ft_1_19.AC12 flocks (flock.ts)', () => {
  it('gulls keep near the box they fly in, never on top of each other, and the same seed flies the same way', () => {
    const a = new Flock(3, SKY, 7), b = new Flock(3, SKY, 7);
    let nearest = Infinity;
    for (let t = 0; t < 120_000; t += 33) {
      a.advance(t);
      for (const g of a.boids) {
        expect(g.x).toBeGreaterThan(-60);
        expect(g.x).toBeLessThan(660);
        expect(g.y).toBeGreaterThan(0);
        expect(g.y).toBeLessThan(100);
      }
      if (t > 5000) for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) nearest = Math.min(nearest, Math.hypot(a.boids[i]!.x - a.boids[j]!.x, a.boids[i]!.y - a.boids[j]!.y));
    }
    expect(nearest).toBeGreaterThan(2);
    // stepped in other handfuls (frames of another length), the flight is the same
    for (let t = 0; t < 120_000; t += 250) b.advance(t);
    b.advance(a.time);
    expect(b.boids).toEqual(a.boids);
  });

  it('a wind carries them its way', () => {
    const calm = new Flock(3, SKY, 2), windy = new Flock(3, SKY, 2);
    calm.advance(3000);
    windy.advance(3000, () => -12);
    const mean = (f: Flock) => f.boids.reduce((s, g) => s + g.x, 0) / 3;
    expect(mean(windy)).toBeLessThan(mean(calm));
  });

  it('a school keeps near the places its fish are pulled to, and its fish come back where they belong after being away', () => {
    const place = (k: number, t: number) => (Math.floor(t / 10_000) % 3 === 2 ? null : { x: 50 + (t / 1000) * 6 + (k % 5) * 8, y: 100 + Math.floor(k / 5) * 6 });
    const school = new Flock(10, { box: { x: -100, y: 0, w: 900, h: 300 }, speed: [2, 30], sight: 20, room: 4, part: 25, align: 1.5, gather: 0, wander: 3, climb: 0.6, follow: place, pull: 3 }, 1);
    for (let t = 0; t < 60_000; t += 33) {
      school.advance(t);
      school.boids.forEach((f, k) => {
        const at = place(k, school.time);
        expect(school.away[k]).toBe(at === null);
        if (at) expect(Math.hypot(f.x - at.x, f.y - at.y)).toBeLessThan(25);
      });
    }
  });

  it('a gull mostly glides and now and then beats its wings: up, level, down', () => {
    const { looks, body } = gullLooks(3, 5);
    expect(looks).toHaveLength(3);
    for (const look of looks) expect(look.pixels[body.y * look.width + body.x]).toBe(5);
    const shown = new Map<number, number>();
    for (let t = 0; t < 60_000; t += 50) shown.set(gullLook(0, t, false), (shown.get(gullLook(0, t, false)) ?? 0) + 1);
    expect(shown.get(1)!).toBeGreaterThan(shown.get(0)! + shown.get(2)!);
    expect(shown.get(0)).toBeGreaterThan(0);
  });

  it('ft_1_19.AC13 a gull over pale ground has a dark line under it: under every pixel of the bird, the bird or the line', () => {
    const plain = gullLooks(3, 5), edged = gullLooks(3, 5, 9);
    expect(edged.body).toEqual(plain.body);
    for (const [k, look] of edged.looks.entries()) {
      expect(look.pixels.filter((p) => p === 5).length).toBe(plain.looks[k]!.pixels.filter((p) => p === 5).length);
      look.pixels.forEach((p, i) => { if (p === 5) expect([5, 9]).toContain(look.pixels[i + look.width]); });
    }
    // over a sky it has none
    for (const look of plain.looks) expect(look.pixels.every((p) => p === 0 || p === 5)).toBe(true);
  });
});
