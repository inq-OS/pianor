import type { ChartPhrase } from './schema.ts';

/**
 * Pairs of parts (phrases) that cross: they overlap, and neither holds the other. Parts may nest (a tricky 4 bars inside "A")
 * or sit side by side, so brackets draw in at most two rows and every bar has one innermost part (core_06).
 */
export function crossingParts(phrases: readonly ChartPhrase[]): [ChartPhrase, ChartPhrase][] {
  const pairs: [ChartPhrase, ChartPhrase][] = [];
  for (let i = 0; i < phrases.length; i++) {
    for (let j = i + 1; j < phrases.length; j++) {
      const a = phrases[i]!;
      const b = phrases[j]!;
      const overlap = a.startBar <= b.endBar && b.startBar <= a.endBar;
      const nested = (a.startBar <= b.startBar && b.endBar <= a.endBar) || (b.startBar <= a.startBar && a.endBar <= b.endBar);
      if (overlap && !nested) pairs.push([a, b]);
    }
  }
  return pairs;
}

/**
 * For each bar (0-based, `barCount` of them) the index in `phrases` of the innermost part that holds it, the one spanning the
 * fewest bars; `undefined` when no part does. Ties go to the earlier part.
 */
export function partTree(phrases: readonly ChartPhrase[], barCount: number): (number | undefined)[] {
  return Array.from({ length: barCount }, (_, bar) => {
    let best: number | undefined;
    phrases.forEach((p, i) => {
      if (bar < p.startBar || bar > p.endBar) return;
      if (best === undefined || p.endBar - p.startBar < phrases[best]!.endBar - phrases[best]!.startBar) best = i;
    });
    return best;
  });
}

/** The parts in reading order: by first bar, and a part before the parts it holds, so the list reads outside in (core_06.AC4). */
export function partsInOrder(phrases: readonly ChartPhrase[]): ChartPhrase[] {
  return [...phrases].sort((a, b) => a.startBar - b.startBar || b.endBar - a.endBar);
}
