/** Seeded randomness: the same seed always gives the same numbers, on every machine. Used where output must be reproducible. */

/** A 32-bit unsigned integer from a number or a text (FNV-1a), so `12` and `"12"` are the same seed. */
export function hashSeed(seed: string | number): number {
  const text = String(seed);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** The mulberry32 generator: a function returning numbers in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A seeded random source with the few helpers generators need. */
export class Random {
  private readonly source: () => number;

  constructor(seed: string | number) {
    this.source = mulberry32(hashSeed(seed));
  }

  /** An independent stream named by `parts` (for instance a piece seed and an attempt number). */
  static derive(...parts: (string | number)[]): Random {
    return new Random(parts.join('#'));
  }

  /** A number in [0, 1). */
  next(): number {
    return this.source();
  }

  /** A whole number from `min` to `max`, both included. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('cannot pick from an empty list');
    return items[this.int(0, items.length - 1)]!;
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  /** One of `items` with the given weights (not all zero); an item with weight 0 is never picked. */
  weighted<T>(items: readonly (readonly [T, number])[]): T {
    const total = items.reduce((sum, [, w]) => sum + Math.max(0, w), 0);
    if (!(total > 0)) throw new Error('weighted needs at least one positive weight');
    let at = this.next() * total;
    for (const [item, weight] of items) {
      if (weight <= 0) continue;
      at -= weight;
      if (at < 0) return item;
    }
    // only reached by rounding: the last item with a positive weight
    const last = [...items].reverse().find(([, w]) => w > 0)!;
    return last[0];
  }

  /** The items in a random order; the input is left alone. */
  shuffle<T>(items: readonly T[]): T[] {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [out[i], out[j]] = [out[j]!, out[i]!];
    }
    return out;
  }
}
