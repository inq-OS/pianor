import { describe, expect, it } from 'vitest';
import { createBitmap } from './bitmap';
import { BLOWN_ROOM, blownAt, blownBox, bobAt, flagLift, hangSwing, weedSway, type Blown } from './sway';
import { STILL_AIR, airOf } from './windField';

/** A painted thing of one colour, `w` by `h`. */
function slab(kind: Blown['kind'], w: number, h: number): Blown {
  const bitmap = createBitmap(w, h);
  bitmap.pixels.fill(7);
  return { kind, x: 100, y: 40, bitmap };
}

function drawn(blown: Blown, time: number, air = airOf(2, -1)): Uint8Array {
  const box = blownBox(blown), out = new Uint8Array(box.w * box.h);
  blownAt(blown, time, air, blown.x, out);
  return out;
}

describe('ft_1_19.AC13 painted things the wind moves, bent as the game runs (sway.ts: small touches of life)', () => {
  it('every pixel of the thing is drawn at every moment, inside its box: it bends, it never tears or loses a part', () => {
    for (const kind of ['flag', 'hang', 'weed'] as const) {
      const thing = slab(kind, 18, 12);
      const seen = new Set<string>();
      for (let t = 0; t < 30_000; t += 66) {
        const out = drawn(thing, t);
        expect(out.filter((p) => p === 7).length, `${kind} at ${t}`).toBe(18 * 12);
        seen.add(out.join(''));
      }
      // it moves
      expect(seen.size).toBeGreaterThan(5);
    }
  });

  it('a flag is made fast at its hoist and flaps most at its free end, harder in a gust and in a harder wind', () => {
    const air = { wind: 2 as const };
    let hoist = 0, fly = 0, hard = 0, calm = 0;
    for (let t = 0; t < 20_000; t += 50) {
      hoist = Math.max(hoist, Math.abs(flagLift(0, 18, t, air, 0.5)));
      fly = Math.max(fly, Math.abs(flagLift(17, 18, t, air, 1)));
      hard += Math.abs(flagLift(17, 18, t, air, 1) - flagLift(17, 18, t + 50, air, 1));
      calm += Math.abs(flagLift(17, 18, t, { wind: 0 }, 1) - flagLift(17, 18, t + 50, { wind: 0 }, 1));
    }
    expect(hoist).toBe(0);
    expect(fly).toBeGreaterThan(1);
    expect(fly).toBeLessThanOrEqual(BLOWN_ROOM.flag.y);
    expect(hard).toBeGreaterThan(calm);
  });

  it('washing swings downwind from its line, its hem the furthest, and stays inside its room', () => {
    for (const way of [-1, 1] as const) {
      const air = { wind: 3 as const, way };
      let most = 0;
      for (let t = 0; t < 20_000; t += 50) {
        expect(hangSwing(0, 14, t, air, 1)).toBeCloseTo(0, 5);
        const hem = hangSwing(13, 14, t, air, 1);
        expect(Math.sign(hem)).toBe(way);
        most = Math.max(most, Math.abs(hem));
      }
      expect(most).toBeGreaterThan(2);
      expect(most).toBeLessThanOrEqual(BLOWN_ROOM.hang.x);
    }
    // in still air it hangs nearly straight
    for (let t = 0; t < 5000; t += 50) expect(Math.abs(hangSwing(13, 14, t, STILL_AIR, 0))).toBeLessThan(1);
  });

  it('weed keeps its foot and sways to both sides, slowly, inside its room', () => {
    let left = 0, right = 0;
    for (let t = 0; t < 30_000; t += 66) {
      expect(weedSway(0, 40, t)).toBeCloseTo(0, 5);
      const top = weedSway(39, 40, t);
      left = Math.min(left, top);
      right = Math.max(right, top);
      // never a jump between two frames
      expect(Math.abs(top - weedSway(39, 40, t + 66))).toBeLessThan(0.6);
    }
    expect(left).toBeLessThan(-2);
    expect(right).toBeGreaterThan(2);
    expect(Math.max(-left, right)).toBeLessThanOrEqual(BLOWN_ROOM.weed.x);
  });

  it('a moored boat rides the swell smoothly, about a pixel up and down, each boat in its own time; the same moment the same', () => {
    let low = 0, high = 0;
    for (let t = 0; t < 60_000; t += 16) {
      const now = bobAt(t, 0, 1);
      low = Math.min(low, now);
      high = Math.max(high, now);
      expect(Math.abs(now - bobAt(t + 16, 0, 1))).toBeLessThan(0.05);
    }
    expect(high - low).toBeGreaterThan(1);
    expect(high - low).toBeLessThan(2.6);
    expect(bobAt(5000, 0, 1)).not.toBeCloseTo(bobAt(5000, 1, 1), 3);
    expect(bobAt(5000, 2, 1, 4)).toBe(bobAt(5000, 2, 1, 4));
  });
});
