// Covers core_06.AC1, core_06.AC2.
import { describe, expect, it } from 'vitest';
import { crossingParts, partTree, partsInOrder } from './parts.ts';
import type { ChartPhrase } from './schema.ts';

const part = (name: string, startBar: number, endBar: number): ChartPhrase => ({ name, startBar, endBar });

describe('crossingParts', () => {
  it('lets parts nest and sit side by side', () => {
    const phrases = [part('A', 0, 7), part('tricky', 2, 5), part('B', 8, 11)];
    expect(crossingParts(phrases)).toEqual([]);
  });

  it('reports two parts that overlap without one holding the other', () => {
    const [a, b] = crossingParts([part('A', 0, 3), part('B', 2, 5)])[0]!;
    expect([a.name, b.name]).toEqual(['A', 'B']);
  });

  it('counts a part that ends on the bar where the next starts as overlapping', () => {
    expect(crossingParts([part('A', 0, 3), part('B', 3, 5)])).toHaveLength(1);
  });
});

describe('partTree', () => {
  it('gives each bar the innermost part that holds it, or none', () => {
    const phrases = [part('A', 0, 3), part('tricky', 1, 2), part('B', 5, 5)];
    expect(partTree(phrases, 6)).toEqual([0, 1, 1, 0, undefined, 2]);
  });

  // core_06.AC5
  it('gives every bar of a piece with no parts no part', () => {
    expect(partTree([], 3)).toEqual([undefined, undefined, undefined]);
  });
});

describe('partsInOrder', () => {
  it('lists parts by their first bar, a part before the parts it holds (core_06.AC4)', () => {
    const phrases = [part('tricky', 2, 3), part('B', 8, 11), part('A', 0, 7)];
    expect(partsInOrder(phrases).map((p) => p.name)).toEqual(['A', 'tricky', 'B']);
  });
});
