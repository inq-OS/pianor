/**
 * Ties and slurs as one tool of the piece maker (merged into one item): both
 * are drawn as one curve, and which one a curve is follows from the notes. To the same key right after: a tie (one long
 * note); to any other note of the hand: a slur (played smoothly). The rules stay in ties.ts and slurs.ts. Pure.
 */
import type { Edit, EditorPiece, NoteRef } from './model';
import { removeSlur, slurHolds, slurInto, toggleSlur } from './slurs';
import { chordTied, tieInto, toggleTie } from './ties';

/**
 * One press on the selected note: a tie or a slur on it goes (the tie first); otherwise it is tied to the same key right
 * after it, or, when none follows, slurred to the next note of its hand.
 */
export function toggleArc(piece: EditorPiece, ref: NoteRef): Edit {
  if (chordTied(piece, ref)) return toggleTie(piece, ref);
  if (slurHolds(piece, ref)) return removeSlur(piece, ref);
  const tie = toggleTie(piece, ref);
  return tie.ok ? tie : toggleSlur(piece, ref);
}

/** Pick two notes: a tie when `into` is the same key right after `from`, else a slur from `from` to `into`. */
export function arcInto(piece: EditorPiece, from: NoteRef, into: NoteRef): Edit {
  const tie = tieInto(piece, from, into);
  return tie.ok ? tie : slurInto(piece, from, into);
}
