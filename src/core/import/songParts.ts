/**
 * A long score cut into the parts of a song (ft_Y_04 slice 6): a PDF of many pages is read as one score, far longer than the
 * piece maker's 32 bars, so it becomes an own song whose parts are own pieces. Parts are cut where the music has its own
 * seams, best first: after a double bar line or a repeat sign, at a rehearsal mark; then at a page start, a system start
 * (which also keeps each part's strip of the pages whole); then anywhere. A key or meter change always starts a part, as a
 * piece holds one of each. Pure: a part is its first bar, and the cuts are a sorted list of the bars that start a part.
 */
import { MAX_BARS } from '../editor/model';
import type { ScoreMarks } from './musicxml';

/** `AX-3 provisional:` a part is at most this many bars when the marks allow (the longest character level, ft_1_32). */
export const PART_BARS = 16;
/** Never more than the piece maker holds. */
export const MAX_PART_BARS = MAX_BARS;
/** `AX-3 provisional:` a stretch shorter than this joins its neighbour, unless a key or meter change cuts it off. */
export const MIN_PART_BARS = 4;
/** How far, in bars, a cut may move from its even place to a better seam. */
const REACH = 2;

/** One score as the splitter sees it: its bars, the bars a key or meter change starts, and its printed marks. */
export interface Layout {
  readonly bars: number;
  readonly mustStarts: readonly number[];
  readonly marks: ScoreMarks;
  /** Bars inside a repeat (after its first bar, up to its last): a cut there would play the repeat once. */
  readonly inRepeat?: readonly number[];
  /** Bars a tie or slur reaches into from the bar before: a cut there loses it. */
  readonly tiedInto?: readonly number[];
}

/** A part: its bars (0-based, inclusive) and the rehearsal mark it starts at, if any. */
export interface PartRange {
  readonly firstBar: number;
  readonly lastBar: number;
  readonly name?: string;
}

/**
 * How good a seam the start of bar `bar` is: 3 a section's start, 2 a page's, 1 a system's, 0 any bar line; one less where a
 * tie or slur crosses it, and never inside a repeat (-10, taken only when no other bar is in reach).
 */
function seam(layout: Layout, bar: number): number {
  if (layout.inRepeat?.includes(bar)) return -10;
  return place(layout, bar) - (layout.tiedInto?.includes(bar) ? 1 : 0);
}

function place(layout: Layout, bar: number): number {
  const { marks } = layout;
  if (marks.sectionEnds.includes(bar - 1) || marks.rehearsals.some((r) => r.bar === bar)) return 3;
  if (marks.pageStarts.includes(bar)) return 2;
  if (marks.systemStarts.includes(bar)) return 1;
  return 0;
}

/** The best seam in bars `from` to `to` (inclusive), the one nearest `ideal` among equals, the earlier among those. */
function bestNear(layout: Layout, from: number, to: number, ideal: number): number | undefined {
  let best: number | undefined;
  for (let bar = from; bar <= to; bar++) {
    if (best === undefined) best = bar;
    else {
      const a = seam(layout, bar);
      const b = seam(layout, best);
      if (a > b || (a === b && Math.abs(bar - ideal) < Math.abs(best - ideal))) best = bar;
    }
  }
  return best;
}

/** The cuts of one stretch `from` to `to` (exclusive) that no key or meter change crosses: its inner part starts. */
function cutStretch(layout: Layout, from: number, to: number): number[] {
  const starts = [from];
  for (let bar = from + 1; bar < to; bar++) if (seam(layout, bar) === 3) starts.push(bar);
  // a short stretch joins the shorter of its neighbours
  for (let i = 0; i < starts.length; ) {
    const length = (starts[i + 1] ?? to) - (starts[i] ?? from);
    if (length >= MIN_PART_BARS || starts.length === 1) {
      i++;
      continue;
    }
    const before = i > 0 ? (starts[i] ?? 0) - (starts[i - 1] ?? 0) : Infinity;
    const after = i + 1 < starts.length ? (starts[i + 2] ?? to) - (starts[i + 1] ?? 0) : Infinity;
    starts.splice(before <= after ? i : i + 1, 1);
    i = Math.max(0, i - 1);
  }
  // a long stretch is cut into equal parts, each cut moved to the best seam near its place
  const cut: number[] = [];
  starts.forEach((start, i) => {
    const end = starts[i + 1] ?? to;
    cut.push(start);
    const pieces = Math.ceil((end - start) / PART_BARS);
    let last = start;
    for (let k = 1; k < pieces; k++) {
      const ideal = start + Math.round(((end - start) * k) / pieces);
      const at = bestNear(layout, Math.max(last + 1, ideal - REACH), Math.min(end - 1, ideal + REACH), ideal);
      if (at !== undefined) {
        cut.push(at);
        last = at;
      }
    }
  });
  return cut;
}

/** The proposed part starts of a score: bar 0, every key or meter change, and the seams that keep parts short. */
export function proposeStarts(layout: Layout): number[] {
  const must = [...new Set(layout.mustStarts.filter((b) => b > 0 && b < layout.bars))].sort((a, b) => a - b);
  const bounds = [0, ...must, layout.bars];
  const starts: number[] = [];
  for (let i = 0; i + 1 < bounds.length; i++) starts.push(...cutStretch(layout, bounds[i] ?? 0, bounds[i + 1] ?? layout.bars));
  return starts;
}

/** The parts the starts make, each named by the rehearsal mark it starts at. */
export function partsOf(layout: Layout, starts: readonly number[]): PartRange[] {
  return starts.map((firstBar, i) => {
    const name = layout.marks.rehearsals.find((r) => r.bar === firstBar)?.text;
    return { firstBar, lastBar: (starts[i + 1] ?? layout.bars) - 1, ...(name ? { name } : {}) };
  });
}

/**
 * Part `index` joined with the part after it; null when there is none, a key or meter change starts it (the two cannot be
 * one piece), or the two together are longer than the piece maker holds.
 */
export function joinParts(layout: Layout, starts: readonly number[], index: number): number[] | null {
  const next = starts[index + 1];
  const first = starts[index];
  if (next === undefined || first === undefined || layout.mustStarts.includes(next)) return null;
  if ((starts[index + 2] ?? layout.bars) - first > MAX_PART_BARS) return null;
  return starts.filter((_, i) => i !== index + 1);
}

/** Part `index` cut in two at its best seam near its middle; null for a part of one bar. */
export function splitPart(layout: Layout, starts: readonly number[], index: number): number[] | null {
  const first = starts[index];
  if (first === undefined) return null;
  const end = starts[index + 1] ?? layout.bars;
  if (end - first < 2) return null;
  const middle = (first + end) / 2;
  const reach = Math.max(1, Math.floor((end - first) / 4));
  const at = bestNear(layout, Math.max(first + 1, Math.ceil(middle - reach)), Math.min(end - 1, Math.floor(middle + reach)), middle);
  return at === undefined ? null : [...starts.slice(0, index + 1), at, ...starts.slice(index + 1)];
}
