import { describe, expect, it } from 'vitest';
import { dustAt, firefliesAt, mothsAt, sparksAt, sprayAt } from './motes';
import { STILL_AIR, airOf } from './windField';

const FIRE = { x: 200, y: 150 };

describe('ft_1_19.AC12 motes that glow (motes.ts: modern-looking sparks and fireflies in 1990s pixel art)', () => {
  it('sparks rise from the fire, cool and go out, and the same moment always looks the same', () => {
    let seen = 0;
    for (let t = 0; t < 60_000; t += 70) {
      const sparks = sparksAt(t, FIRE, STILL_AIR, () => 1);
      seen += sparks.length;
      for (const s of sparks) {
        expect(s.y).toBeLessThan(FIRE.y);
        expect(s.y).toBeGreaterThan(FIRE.y - 130);
        expect(s.glow).toBeGreaterThanOrEqual(0);
        expect(s.glow).toBeLessThanOrEqual(1);
      }
    }
    expect(seen).toBeGreaterThan(0);
    expect(sparksAt(12_345, FIRE, STILL_AIR, () => 1)).toEqual(sparksAt(12_345, FIRE, STILL_AIR, () => 1));
  });

  it('a hotter fire throws more sparks, and a strong wind bends them its way', () => {
    const count = (heat: number) => {
      let n = 0;
      for (let t = 0; t < 120_000; t += 100) n += sparksAt(t, FIRE, STILL_AIR, () => heat).length;
      return n;
    };
    expect(count(1)).toBeGreaterThan(count(0) * 1.5);
    let lean = 0;
    for (let t = 0; t < 120_000; t += 100) for (const s of sparksAt(t, FIRE, airOf(3, -1), () => 1)) lean += s.x - FIRE.x;
    expect(lean).toBeLessThan(0);
  });

  it('sparks live a few seconds, and some climb on far up, into the sky', () => {
    let high = 0, low = 0;
    for (let t = 0; t < 120_000; t += 100) {
      for (const s of sparksAt(t, FIRE, STILL_AIR, () => 1)) {
        if (FIRE.y - s.y > 60) high++;
        else low++;
      }
    }
    expect(high).toBeGreaterThan(0);
    expect(low).toBeGreaterThan(high);
    // living longer, several are in the air at once
    const now = sparksAt(30_000, FIRE, STILL_AIR, () => 1).length;
    expect(now).toBeGreaterThan(4);
  });

  it('sparks are sharp dots that rise nearly straight, even in a storm, never thrown sideways', () => {
    for (let t = 0; t < 120_000; t += 100) {
      for (const s of sparksAt(t, FIRE, airOf(3, 1), () => 1)) {
        expect(s.size).toBe(0);
        // far more up than across
        expect(Math.abs(s.x - FIRE.x)).toBeLessThan(Math.max(4, (FIRE.y - s.y) * 0.6));
      }
    }
  });

  it('fireflies stay over their patch of grass and are dark some of the time', () => {
    const box = { x: 40, y: 200, w: 300, h: 60 };
    let lit = 0, dark = 0;
    for (let t = 0; t < 60_000; t += 100) {
      const flies = firefliesAt(t, box, 6);
      if (flies.length < 6) dark++;
      for (const f of flies) {
        lit++;
        expect(f.x).toBeGreaterThanOrEqual(box.x);
        expect(f.x).toBeLessThanOrEqual(box.x + box.w);
        expect(f.y).toBeGreaterThanOrEqual(box.y);
        expect(f.y).toBeLessThanOrEqual(box.y + box.h);
      }
    }
    expect(lit).toBeGreaterThan(0);
    expect(dark).toBeGreaterThan(0);
  });

  it('moths keep near their lamp on paths that never settle, as sharp dots, and are away or unseen some of the time', () => {
    const lamp = { x: 300, y: 80 };
    const places = new Set<string>();
    let seen = 0, fewer = 0;
    for (let t = 0; t < 60_000; t += 50) {
      const moths = mothsAt(t, lamp, 4);
      if (moths.length < 4) fewer++;
      for (const m of moths) {
        seen++;
        expect(m.size).toBe(0);
        expect(Math.abs(m.x - lamp.x)).toBeLessThan(22);
        expect(Math.abs(m.y - lamp.y)).toBeLessThan(15);
        places.add(`${Math.round(m.x)},${Math.round(m.y)}`);
      }
    }
    expect(seen).toBeGreaterThan(1000);
    expect(fewer).toBeGreaterThan(100);
    expect(places.size).toBeGreaterThan(150);
    expect(mothsAt(4321, lamp, 4, 2)).toEqual(mothsAt(4321, lamp, 4, 2));
  });

  it('dust stays in its shaft of light, drifts slowly, and swells up and fades softly', () => {
    const box = { x: 196, y: 96, w: 124, h: 130 };
    let most = 0, least = 9;
    for (let t = 0; t < 120_000; t += 100) {
      const dust = dustAt(t, box, 9);
      most = Math.max(most, dust.length);
      least = Math.min(least, dust.length);
      for (const d of dust) {
        expect(d.x).toBeGreaterThanOrEqual(box.x);
        expect(d.x).toBeLessThanOrEqual(box.x + box.w);
        expect(d.y).toBeGreaterThanOrEqual(box.y);
        expect(d.y).toBeLessThanOrEqual(box.y + box.h);
        expect(d.glow).toBeLessThanOrEqual(0.75);
      }
    }
    expect(most).toBeGreaterThan(2);
    expect(least).toBeLessThan(most);
  });

  it('spray flies only in a wind, more in a storm, and falls back to the rock it left', () => {
    const rocks = [{ x: 100, y: 120 }, { x: 160, y: 124 }];
    const total = (wind: 0 | 1 | 2 | 3) => {
      let n = 0;
      for (let t = 0; t < 120_000; t += 100) {
        const drops = sprayAt(t, rocks, airOf(wind, 1));
        n += drops.length;
        for (const d of drops) expect(d.y).toBeLessThanOrEqual(125);
      }
      return n;
    };
    expect(total(0)).toBe(0);
    expect(total(3)).toBeGreaterThan(total(1));
  });
});
