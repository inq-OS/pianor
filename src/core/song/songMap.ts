import type { SongRow } from './resolve.ts';

/** How a part looks on the song map (rule 8): written and on, a link (its piece again), a blank not written yet, or off. */
export type MapPartLook = 'written' | 'link' | 'blank' | 'off';

/** One part of the song map: a piece, a link or a blank, in song bars (from 1). */
export interface MapPart {
  id: string;
  name: string;
  startBar: number;
  endBar: number;
  look: MapPartLook;
}

/** A part placed on the map: `x` and `w` in the map's own units, from 0. */
export interface MapBlock extends MapPart {
  x: number;
  w: number;
}

/**
 * The parts of the song map (rule 8), in song order: every piece, link and blank under `root` (the whole song when null),
 * whatever group it is in. A part that is off (or under a group that is off) looks off; a missing piece looks blank.
 */
export function songMapParts(rows: readonly SongRow[], root: string | null = null): MapPart[] {
  const under = (row: SongRow): boolean => {
    if (root === null) return true;
    let parent = row.parent;
    while (parent !== null) {
      if (parent === root) return true;
      parent = rows.find((r) => r.id === parent)?.parent ?? null;
    }
    return false;
  };
  return rows
    .filter((r) => (r.kind === 'piece' || r.kind === 'link' || r.kind === 'blank') && r.bars > 0 && under(r))
    .map((r) => ({
      id: r.id,
      name: r.name,
      startBar: r.startBar,
      endBar: r.endBar,
      look: !r.on ? 'off' : !r.written ? 'blank' : r.kind === 'link' ? 'link' : 'written',
    }));
}

/**
 * Places the parts side by side over `width`, each as wide as its bars but never narrower than `minWidth` (a finger):
 * the long parts give way. Whole units, no gaps; the blocks fill the width exactly when every part can have its minimum.
 */
export function songMapLayout(parts: readonly MapPart[], width: number, minWidth: number): MapBlock[] {
  if (parts.length === 0) return [];
  const bars = parts.map((p) => p.endBar - p.startBar + 1);
  const fixed = new Set<number>();
  let widths: number[] = [];
  // a part too short for its share is held at the minimum, and the rest is shared again by bars
  for (;;) {
    const free = width - fixed.size * minWidth;
    const freeBars = bars.reduce((sum, b, i) => (fixed.has(i) ? sum : sum + b), 0);
    widths = bars.map((b, i) => (fixed.has(i) ? minWidth : freeBars > 0 ? (free * b) / freeBars : minWidth));
    const short = widths.findIndex((w, i) => !fixed.has(i) && w < minWidth);
    if (short < 0 || fixed.size === parts.length - 1) break;
    fixed.add(short);
  }
  // whole units: round the running edges, so the widths add up to the whole
  const blocks: MapBlock[] = [];
  let edge = 0;
  let exact = 0;
  parts.forEach((part, i) => {
    exact += Math.max(minWidth, widths[i]!);
    const next = Math.round(exact);
    blocks.push({ ...part, x: edge, w: next - edge });
    edge = next;
  });
  return blocks;
}

/** The x on the map where song bar `bar` starts (inside its block, by bars), or the right edge past the last block. */
export function songBarX(blocks: readonly MapBlock[], bar: number): number {
  for (const b of blocks) {
    if (bar >= b.startBar && bar <= b.endBar) return b.x + ((bar - b.startBar) / (b.endBar - b.startBar + 1)) * b.w;
  }
  const last = blocks[blocks.length - 1];
  if (!last) return 0;
  return bar < blocks[0]!.startBar ? 0 : last.x + last.w;
}
