import type { BarRange, Difficulty } from '../piece/difficulty';
import { heatColour } from './analyzeLayout';

/** What the staff draws for the difficulty panel (core_08.AC10): the shape of the staff view's section marks. */
export interface DifficultyMarks {
  /** The chosen passage's bars, tinted. */
  tint: number[];
  /** Each range's number in play order, over its first bar: the heat colours every bar, so the passage shows by these. */
  letters: { bar: number; text: string }[];
  /** Each bar's heat colour: its score against the hardest bar's, in the practice analysis' colours; absent with heat off. */
  fills?: Map<number, number>;
}

/** The staff marks for a piece's difficulty and a chosen passage; null when there is nothing to mark. Pure. */
export function difficultyMarks(piece: Difficulty | null, ranges: readonly BarRange[], heat: boolean): DifficultyMarks | null {
  const tint = ranges.flatMap((r) => Array.from({ length: r.last - r.first + 1 }, (_, i) => r.first + i));
  const letters = ranges.map((r, i) => ({ bar: r.first, text: String(i + 1) }));
  if (!piece || !heat) return ranges.length > 0 ? { tint, letters } : null;
  const peak = Math.max(...piece.bars.map((b) => b.score), 0.01);
  const fills = new Map<number, number>();
  for (const b of piece.bars) {
    const colour = heatColour(b.score / peak);
    if (colour !== null) fills.set(b.index, colour);
  }
  return { tint, letters, fills };
}
