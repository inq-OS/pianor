import { chunkNoteOf, type ChunkNote, type LearnRewards, type Medal } from '../learn/progress';
import type { PrizeFocus } from '../learn/view';

/**
 * Where the prizes of learning a piece stand on the staff's sheet (ft_1_32.AC19, d287): one narrow column at the top right,
 * the piece's treble clef at its top; under it the bars of the chunk being learned as quarter notes on one stem, stacked a
 * step apart and staggered like the heads of a chord of seconds; under them one whole note per chunk, stacked the same way.
 * A chunk whose bars are all secured shows no quarters: they have become its whole note, which its confirmation play paints. Pure: the view only draws it. Sizes in staff spaces.
 */
export const PRIZE = {
  /** The width the column takes at the right of the staff. */
  room: 5,
  /** From the top of the sheet to the clef, and between the parts of the column. */
  top: 0.6,
  gap: 1.2,
  /** A step between two stacked heads (a second), and the stem above the top head. */
  step: 0.5,
  stem: 3.2,
  /** Head radii: a quarter's and a whole note's. */
  quarterRx: 0.62,
  wholeRx: 0.78,
  headRy: 0.47,
  /** The clef is drawn at this share of the staff's own clef (`TREBLE_CLEF_STROKE`, a 2.6 by 7 box). */
  clefScale: 0.55,
  clefBox: { w: 2.6, h: 7 },
} as const;

export interface PrizeGlyph {
  kind: ChunkNote | 'clef';
  /** A bar's quarter, a chunk's note, or the piece's clef; `index` is the bar in its chunk, the chunk, or 0. */
  role: 'bar' | 'chunk' | 'piece';
  index: number;
  /** Earned in this medal; null is a placeholder still to earn. */
  medal: Medal | null;
  /** The prize the run on the staff is for (a soft box behind it). */
  lit: boolean;
  /** A note's head centre; the clef's top-left corner (drawn at `PRIZE.clefScale`). */
  x: number;
  y: number;
  /** The place of the glyph, for its box. */
  box: { x: number; y: number; w: number; h: number };
}

export interface PrizeColumn {
  glyphs: PrizeGlyph[];
  /** The quarters' one stem (x, from the lowest head up past the top one), and whether any quarter is earned; null with no quarters. */
  stem: { x: number; y1: number; y2: number; earned: boolean } | null;
}

/**
 * The column whose right edge is at `right` (layout pixels; the staff leaves `PRIZE.room` staff spaces free left of it), from
 * the top of the sheet (y 0) down, for a staff of `staffSpace`.
 */
export function prizeColumn(staffSpace: number, right: number, rewards: LearnRewards, focus: PrizeFocus): PrizeColumn {
  if (rewards.chunks.length === 0) return { glyphs: [], stem: null };
  const S = staffSpace;
  const cx = right - (PRIZE.room * S) / 2;
  const glyphs: PrizeGlyph[] = [];
  // the clef at the top
  const w = PRIZE.clefBox.w * PRIZE.clefScale * S;
  const h = PRIZE.clefBox.h * PRIZE.clefScale * S;
  const clefTop = PRIZE.top * S;
  glyphs.push({ kind: 'clef', role: 'piece', index: 0, medal: rewards.piece, lit: focus.clef, x: cx - w / 2, y: clefTop, box: { x: cx - w / 2 - 0.6 * S, y: clefTop - 0.4 * S, w: w + 1.2 * S, h: h + 0.8 * S } });
  let y = clefTop + h + PRIZE.gap * S;
  // heads stacked a step apart from the lowest up, every second one on the other side of the stem, as in a chord of seconds
  const headBox = (x: number, hy: number, rx: number) => ({ x: x - rx - 0.25 * S, y: hy - PRIZE.headRy * S - 0.25 * S, w: 2 * rx + 0.5 * S, h: 2 * PRIZE.headRy * S + 0.5 * S });
  const stack = (count: number, rx: number, from: number) => Array.from({ length: count }, (_, i) => ({ x: cx + (i % 2 === 0 ? -rx : rx), y: from - i * PRIZE.step * S }));
  // the quarters of the chunk being learned, on one stem; none once all its bars are secured: they became its whole note
  const chunk = rewards.chunks[focus.chunk] ?? rewards.chunks[0]!;
  let stem: PrizeColumn['stem'] = null;
  if (!chunk.merged && chunk.quarters.length < chunk.units) {
    const rx = PRIZE.quarterRx * S;
    const lowest = y + (PRIZE.stem + (chunk.units - 1) * PRIZE.step) * S;
    stack(chunk.units, rx, lowest).forEach((head, i) => {
      glyphs.push({ kind: 'quarter', role: 'bar', index: i, medal: chunk.quarters[i] ?? null, lit: focus.bars.includes(i), ...head, box: headBox(head.x, head.y, rx) });
    });
    stem = { x: cx, y1: lowest, y2: y, earned: chunk.quarters.length > 0 };
    y = lowest + PRIZE.headRy * S + PRIZE.gap * S;
  }
  // one whole note (or the shorter chunk's own value) per chunk
  const rx = PRIZE.wholeRx * S;
  const lowest = y + PRIZE.headRy * S + (rewards.chunks.length - 1) * PRIZE.step * S;
  stack(rewards.chunks.length, rx, lowest).forEach((head, c) => {
    const merged = rewards.chunks[c]!.merged;
    glyphs.push({ kind: merged?.note ?? chunkNoteOf(rewards.chunks[c]!.units), role: 'chunk', index: c, medal: merged?.medal ?? null, lit: focus.chunks.includes(c), ...head, box: headBox(head.x, head.y, rx) });
  });
  return { glyphs, stem };
}
