import { chunkNoteOf, type ChunkNote, type LearnRewards, type Medal } from '../learn/progress';
import type { PrizeFocus } from '../learn/view';
import type { StaffLayout } from './staffTypes';

/**
 * Where the prizes of learning a piece stand on the staff (ft_1_32.AC19, d287): past the last bar line, level with the
 * (first) staff of its line, a quarter note for each bar of the chunk being learned, then one note per chunk; the piece's
 * treble clef above the lines over them. Pure: the view only draws it. Sizes in staff spaces.
 * AX-3 provisional: more than `PRIZE.row` chunk notes wrap to a row under the first.
 */
export const PRIZE = {
  /** From the final bar line to the first quarter's place. */
  gap: 1.4,
  /** The width of a quarter's place and of a chunk note's place. */
  quarter: 1.9,
  chunk: 2.6,
  /** Room between the quarters and the chunk notes. */
  between: 0.8,
  /** Chunk notes in a row, and how far a second row is under the first. */
  row: 4,
  rowDrop: 6,
  /** The clef is drawn at this share of the staff's own clef, its foot this far above the top line. */
  clefScale: 0.55,
  clefRise: 1.9,
  /** The treble clef's box in its own staff spaces (`TREBLE_CLEF_STROKE`). */
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
  system: number;
  /** The place of the glyph, for its box. */
  box: { x: number; y: number; w: number; h: number };
}

/** The staff spaces the column takes past the final bar line, for a piece of `chunks` chunks: what the staff leaves free. */
export function prizeRoom(chunks: number): number {
  const notes = Math.min(Math.max(1, chunks), PRIZE.row);
  return PRIZE.gap + 4 * PRIZE.quarter + PRIZE.between + notes * PRIZE.chunk + 0.5;
}

export function prizeColumn(layout: Pick<StaffLayout, 'staffSpace' | 'barlines'> & { systems: readonly { topLineY: number }[] }, rewards: LearnRewards, focus: PrizeFocus): { glyphs: PrizeGlyph[] } {
  const end = layout.barlines.find((b) => b.kind === 'final') ?? layout.barlines.at(-1);
  if (!end || rewards.chunks.length === 0) return { glyphs: [] };
  const S = layout.staffSpace;
  const top = layout.systems[end.system]?.topLineY ?? end.y1;
  const middle = top + 2 * S;
  const system = end.system;
  const glyphs: PrizeGlyph[] = [];
  const noteBox = (left: number, width: number, y: number) => ({ x: left, y: y - 3.2 * S, w: width, h: 6.4 * S });
  // the quarters of the chunk shown, in four fixed places so the chunk notes never move
  const left = end.x + PRIZE.gap * S;
  const shown = rewards.chunks[focus.chunk] ?? rewards.chunks[0]!;
  for (let i = 0; i < shown.units; i++) {
    const x0 = left + i * PRIZE.quarter * S;
    glyphs.push({ kind: 'quarter', role: 'bar', index: i, medal: shown.quarters[i] ?? null, lit: focus.bars.includes(i), x: x0 + (PRIZE.quarter * S) / 2, y: middle, system, box: noteBox(x0, PRIZE.quarter * S, middle) });
  }
  const chunksLeft = left + (4 * PRIZE.quarter + PRIZE.between) * S;
  rewards.chunks.forEach((chunk, c) => {
    const x0 = chunksLeft + (c % PRIZE.row) * PRIZE.chunk * S;
    const y = middle + Math.floor(c / PRIZE.row) * PRIZE.rowDrop * S;
    glyphs.push({
      kind: chunk.merged?.note ?? chunkNoteOf(chunk.units), role: 'chunk', index: c, medal: chunk.merged?.medal ?? null, lit: focus.chunks.includes(c),
      x: x0 + (PRIZE.chunk * S) / 2, y, system, box: noteBox(x0, PRIZE.chunk * S, y),
    });
  });
  // the clef over the middle of the first row
  const right = chunksLeft + Math.min(rewards.chunks.length, PRIZE.row) * PRIZE.chunk * S;
  const w = PRIZE.clefBox.w * PRIZE.clefScale * S;
  const h = PRIZE.clefBox.h * PRIZE.clefScale * S;
  const cx = (left + right) / 2;
  const y = top - PRIZE.clefRise * S - h;
  glyphs.push({ kind: 'clef', role: 'piece', index: 0, medal: rewards.piece, lit: focus.clef, x: cx - w / 2, y, system, box: { x: cx - w / 2 - 0.6 * S, y: y - 0.4 * S, w: w + 1.2 * S, h: h + 0.8 * S } });
  return { glyphs };
}
