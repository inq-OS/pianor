import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { Random, hashSeed, mulberry32 } from './random';

describe('hashSeed', () => {
  it('turns a number or a string into an unsigned 32-bit integer, the same every time', () => {
    expect(hashSeed(7)).toBe(hashSeed(7));
    expect(hashSeed('seven')).toBe(hashSeed('seven'));
    for (const seed of [0, 1, -5, 1.5, 2 ** 40, 'a', '', 'long seed with spaces']) {
      const h = hashSeed(seed);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(2 ** 32);
    }
  });

  it('gives different numbers for different seeds, and a number and its text are the same seed', () => {
    expect(hashSeed(1)).not.toBe(hashSeed(2));
    expect(hashSeed('a')).not.toBe(hashSeed('b'));
    expect(hashSeed(12)).toBe(hashSeed('12'));
  });
});

describe('mulberry32', () => {
  it('is deterministic and stays in [0, 1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 1000; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it('keeps the exact sequence the virtual player has always used (its recorded performances depend on it)', () => {
    const next = mulberry32(1);
    expect([next(), next(), next()].map((x) => Math.round(x * 1e6))).toEqual([627074, 2736, 527447]);
  });
});

describe('Random', () => {
  it('gives the same sequence for the same seed and a different one for another seed', () => {
    const take = (seed: string | number) => {
      const r = new Random(seed);
      return Array.from({ length: 20 }, () => r.next());
    };
    expect(take(5)).toEqual(take(5));
    expect(take('x')).toEqual(take('x'));
    expect(take(5)).not.toEqual(take(6));
  });

  it('int stays inside its inclusive bounds and reaches both ends (property)', () => {
    fc.assert(
      fc.property(fc.integer({ min: -20, max: 20 }), fc.integer({ min: 0, max: 15 }), fc.integer(), (min, span, seed) => {
        const r = new Random(seed);
        const seen = new Set<number>();
        for (let i = 0; i < 400; i++) {
          const v = r.int(min, min + span);
          expect(v).toBeGreaterThanOrEqual(min);
          expect(v).toBeLessThanOrEqual(min + span);
          expect(Number.isInteger(v)).toBe(true);
          seen.add(v);
        }
        expect(seen.has(min)).toBe(true);
        expect(seen.has(min + span)).toBe(true);
      }),
    );
  });

  it('pick returns a member and refuses an empty list', () => {
    const r = new Random(1);
    for (let i = 0; i < 100; i++) expect(['a', 'b', 'c']).toContain(r.pick(['a', 'b', 'c']));
    expect(() => r.pick([])).toThrow(/empty/);
  });

  it('chance is false at 0 and true at 1, and about right in between', () => {
    const r = new Random(3);
    expect(Array.from({ length: 50 }, () => r.chance(0)).some(Boolean)).toBe(false);
    expect(Array.from({ length: 50 }, () => r.chance(1)).every(Boolean)).toBe(true);
    const hits = Array.from({ length: 4000 }, () => r.chance(0.25)).filter(Boolean).length;
    expect(hits).toBeGreaterThan(800);
    expect(hits).toBeLessThan(1200);
  });

  it('weighted never picks a zero weight and follows the weights', () => {
    const r = new Random(9);
    const counts = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 6000; i++) counts[r.weighted([['a', 1], ['b', 3], ['c', 0]] as const)]++;
    expect(counts.c).toBe(0);
    expect(counts.b).toBeGreaterThan(counts.a * 2);
    expect(counts.b).toBeLessThan(counts.a * 4);
    expect(() => r.weighted([['a', 0]])).toThrow(/weight/);
    expect(() => r.weighted([])).toThrow(/weight/);
  });

  it('shuffle keeps every item and leaves its input alone', () => {
    const r = new Random(11);
    const input = [1, 2, 3, 4, 5, 6];
    const out = r.shuffle(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6]);
    expect([...out].sort()).toEqual(input);
  });

  it('derive makes independent streams that depend only on the seed and the name', () => {
    const a = Random.derive('piece', 'attempt', 1);
    const b = Random.derive('piece', 'attempt', 1);
    const c = Random.derive('piece', 'attempt', 2);
    expect(a.next()).toBe(b.next());
    expect(Random.derive('piece', 'attempt', 1).next()).not.toBe(c.next());
  });
});
