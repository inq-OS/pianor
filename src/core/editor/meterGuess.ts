/**
 * The A (Auto) time of a new piece: the parent writes the first bar without choosing a time, and its
 * length sets it; the piece maker then asks to confirm, since a first bar can be a pickup. The time is 2/4, 3/4 or 4/4,
 * as on the start screen. While it waits, the piece is written in 4/4, the widest. Pure.
 */
import { barTicks, LENGTH_TICKS, placedRests, type Edit, type EditorPiece } from './model';

export type Beats = EditorPiece['beats'];

const BEAT = LENGTH_TICKS.quarter;

/** Where the written part of the first bar ends, in ticks (0 when it is empty). */
function firstBarEnd(piece: EditorPiece): number {
  const spans = [...piece.notes, ...placedRests(piece)].filter((e) => e.bar === 0).map((e) => e.start + LENGTH_TICKS[e.length]);
  return Math.max(0, ...spans);
}

/** The time the first bar's length says, in whole beats from 2 to 4 (a part beat counts as one); null while it is empty. */
export function guessBeats(piece: EditorPiece): Beats | null {
  const end = firstBarEnd(piece);
  if (end === 0) return null;
  return Math.min(4, Math.max(2, Math.ceil(end / BEAT))) as Beats;
}

/** Whether the first bar is written to its end (a full bar of the 4/4 the piece waits in): then it is time to ask. */
export function firstBarFull(piece: EditorPiece): boolean {
  return firstBarEnd(piece) >= barTicks(piece);
}

/** Whether the piece's notes allow this time: everything written is in the first bar and fits in it. */
export function beatsFit(piece: EditorPiece, beats: Beats): boolean {
  const all = [...piece.notes, ...placedRests(piece)];
  return all.every((e) => e.bar === 0) && firstBarEnd(piece) <= beats * BEAT;
}

/** The confirmed time: the first bar keeps its notes; refused when anything is past the first bar or would not fit. */
export function confirmBeats(piece: EditorPiece, beats: Beats): Edit {
  if (!beatsFit(piece, beats)) return { ok: false, reason: 'not-empty' };
  return { ok: true, piece: { ...piece, beats } };
}
