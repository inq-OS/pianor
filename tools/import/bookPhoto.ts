/**
 * The pages behind each part of a book (ft_Y_04 slice 6): the bars Audiveris read are matched to the bars the page finder
 * (`page.ts`) found on the page pictures, and each part gets a strip of its own systems, stacked, with a bar map of only
 * its bars, in the format the piece maker's photo overlay already reads (`photo.json`, ft_Y_04.AC16). So the G key, comma
 * and full stop work for a part as for one photo. Pure: pictures in, pictures and maps out.
 */
import type { PhotoLayout, PhotoSystem } from '../../src/core/editor/photoOverlay';
import type { ScoreMarks } from '../../src/core/import/musicxml';
import { blank, type Gray } from './clean';

/** Where a bar of the score is on the pages: the page (its index in the pages read), the system on it, its columns. */
export interface BarPlace {
  readonly page: number;
  readonly system: number;
  readonly x1: number;
  readonly x2: number;
}

/** A movement as the matching needs it: its bars and printed marks. */
export interface MovementBars {
  readonly bars: number;
  readonly marks: ScoreMarks;
}

/** The bar places of every movement, and the pages whose bar count differs from the reading's (a bar to check). */
export interface Matched {
  readonly places: (BarPlace | undefined)[][];
  readonly uneven: number[];
}

/** The found bars of a run of systems in reading order, with their places. */
function foundBars(pages: readonly PhotoLayout[], page: number, systems: readonly number[]): BarPlace[] {
  return systems.flatMap((system) => (pages[page]?.systems[system]?.bars ?? []).map((b) => ({ page, system, x1: b.x1, x2: b.x2 })));
}

/**
 * Matches the score's bars to the bars found on the pages. When the score marks as many page starts as there are pages, each
 * page is matched on its own, and inside it each system when the system counts agree too, so a bar missed or found twice
 * puts off only its own system or page; otherwise the bars are matched in order from the first.
 */
export function matchBars(movements: readonly MovementBars[], pages: readonly PhotoLayout[]): Matched {
  const total = movements.reduce((n, m) => n + m.bars, 0);
  const global: (BarPlace | undefined)[] = new Array<BarPlace | undefined>(total).fill(undefined);
  const pageStarts = new Set<number>();
  const systemStarts = new Set<number>();
  let offset = 0;
  for (const m of movements) {
    for (const b of m.marks.pageStarts) pageStarts.add(offset + b);
    for (const b of m.marks.systemStarts) systemStarts.add(offset + b);
    offset += m.bars;
  }
  const uneven: number[] = [];
  const fill = (from: number, to: number, found: readonly BarPlace[]): void => {
    for (let i = from; i < to && i - from < found.length; i++) global[i] = found[i - from];
  };
  const starts = [...pageStarts].sort((a, b) => a - b);
  if (starts.length === pages.length) {
    starts.forEach((from, page) => {
      const to = starts[page + 1] ?? total;
      const layout = pages[page];
      const found = foundBars(pages, page, layout?.systems.map((_, s) => s) ?? []);
      if (found.length !== to - from) uneven.push(page);
      const systems = [...systemStarts].filter((b) => b >= from && b < to).sort((a, b) => a - b);
      if (layout && systems.length === layout.systems.length) systems.forEach((s, k) => fill(s, systems[k + 1] ?? to, foundBars(pages, page, [k])));
      else fill(from, to, found);
    });
  } else {
    const found = pages.flatMap((layout, page) => foundBars(pages, page, layout.systems.map((_, s) => s)));
    if (found.length !== total) uneven.push(...pages.map((_, page) => page));
    fill(0, total, found);
  }
  const places: (BarPlace | undefined)[][] = [];
  offset = 0;
  for (const m of movements) {
    places.push(global.slice(offset, offset + m.bars));
    offset += m.bars;
  }
  return { places, uneven };
}

/** The rows a system's strip takes: four staff spaces above and below, never past halfway to the next system. */
function rowsOf(layout: PhotoLayout, system: number): { from: number; to: number } {
  const s = layout.systems[system];
  if (!s) return { from: 0, to: 0 };
  const top = s.staves[0]?.top ?? 0;
  const bottom = s.staves.at(-1)?.bottom ?? 0;
  const space = ((s.staves[0]?.bottom ?? 0) - top) / 4;
  const above = layout.systems[system - 1]?.staves.at(-1)?.bottom;
  const below = layout.systems[system + 1]?.staves[0]?.top;
  return {
    from: Math.max(0, Math.round(Math.max(top - 4 * space, above !== undefined ? (above + top) / 2 : -Infinity))),
    to: Math.min(layout.height, Math.round(Math.min(bottom + 4 * space, below !== undefined ? (bottom + below) / 2 : Infinity))),
  };
}

/**
 * The strip of a part: the systems its bars stand on, cut from their pages and stacked top to bottom, with a bar map of the
 * part's own bars in order (a bar not found on the pages is left out, which the person evens out with comma and full stop).
 * Undefined when none of its bars was found.
 */
export function partStrip(images: readonly Gray[], pages: readonly PhotoLayout[], bars: readonly (BarPlace | undefined)[]): { image: Gray; layout: PhotoLayout } | undefined {
  const systems: { page: number; system: number }[] = [];
  for (const b of bars) if (b && !systems.some((s) => s.page === b.page && s.system === b.system)) systems.push({ page: b.page, system: b.system });
  if (systems.length === 0) return undefined;
  const cuts = systems.map((s) => ({ ...s, ...rowsOf(pages[s.page]!, s.system) }));
  const width = Math.max(...cuts.map((c) => images[c.page]?.width ?? 0));
  const height = cuts.reduce((h, c) => h + (c.to - c.from), 0);
  const image = blank(width, height);
  const out: PhotoSystem[] = [];
  let y = 0;
  for (const c of cuts) {
    const page = images[c.page];
    const found = pages[c.page]?.systems[c.system];
    if (!page || !found) continue;
    for (let row = c.from; row < c.to; row++) image.data.set(page.data.subarray(row * page.width, row * page.width + page.width), (y + row - c.from) * width);
    const shift = y - c.from;
    out.push({
      staves: found.staves.map((s) => ({ top: s.top + shift, bottom: s.bottom + shift })),
      bars: bars.filter((b): b is BarPlace => b !== undefined && b.page === c.page && b.system === c.system).map((b) => ({ x1: b.x1, x2: b.x2 })),
    });
    y += c.to - c.from;
  }
  return { image, layout: { width, height, systems: out } };
}
