/**
 * Pre-notes (grace notes, eelnoot) in the editor (core_09.AC35, d121): one small note before a note, set by picking
 * a pitch after the band item armed it, taken away by the same item. Only a single note that is not the second note of a
 * tie can carry one, as the ABC compiler allows. Pure.
 */
import type { Step } from '../chart/pitch';
import {
  chordOf, findNote, keyAlterOf, replaceGrace, soundingMidi,
  type Edit, type EditorGrace, type EditorNote, type EditorPiece, type NoteRef, type Refusal,
} from './model';
import { spellKey } from './playEntry';
import { tieTargetOf, tieWritten } from './ties';

/** Whether a written tie enters `note`: then it is not struck again, and a pre-note cannot go before it. */
function tieEnters(piece: EditorPiece, note: EditorNote): boolean {
  return piece.notes.some((m) => m !== note && tieWritten(piece, m) && tieTargetOf(piece, m) === note);
}

/** Why `note` cannot carry a pre-note now (a chord, or a tie's second note), or null when it can. */
function graceProblem(piece: EditorPiece, note: EditorNote): Refusal | null {
  if (chordOf(piece, note).length > 1) return 'grace-chord';
  if (tieEnters(piece, note)) return 'grace-tie';
  return null;
}

/**
 * Whether the ABC and the chart write this note's pre-note: it has one, and a later edit did not make it a chord or the
 * second note of a tie. A pre-note that cannot be written is kept on the note, so it comes back when the note is single
 * again. The ABC and the chart both use this one rule, as `tieWritten`.
 */
export function graceWritten(piece: EditorPiece, note: EditorNote): boolean {
  return note.grace !== undefined && graceProblem(piece, note) === null && soundingMidi(note.grace) !== soundingMidi(note);
}

/** Sets the pre-note of the note at `ref`; refused on a chord, on a tie's second note, on its own pitch or off the keyboard. */
export function setGrace(piece: EditorPiece, ref: NoteRef, grace: EditorGrace): Edit {
  const note = findNote(piece, ref);
  if (!note) return { ok: false, reason: 'no-note' };
  const problem = graceProblem(piece, note);
  if (problem) return { ok: false, reason: problem };
  return replaceGrace(piece, ref, grace);
}

/** Takes the pre-note away from the note at `ref`. */
export function removeGrace(piece: EditorPiece, ref: NoteRef): Edit {
  const note = findNote(piece, ref);
  if (!note) return { ok: false, reason: 'no-note' };
  if (!note.grace) return { ok: false, reason: 'grace-none' };
  return replaceGrace(piece, ref, undefined);
}

/**
 * One press of the pre-note item on the selected note: on a note that has one it takes it away (an edit); on a note that
 * can take one it arms the pick (the next pitch picked is the pre-note); otherwise it is refused at once, with its reason.
 */
export function graceItem(piece: EditorPiece, ref: NoteRef): { kind: 'arm' } | { kind: 'edit'; edit: Edit } {
  const note = findNote(piece, ref);
  if (!note) return { kind: 'edit', edit: { ok: false, reason: 'no-note' } };
  if (note.grace) return { kind: 'edit', edit: removeGrace(piece, ref) };
  const problem = graceProblem(piece, note);
  return problem ? { kind: 'edit', edit: { ok: false, reason: problem } } : { kind: 'arm' };
}

/** The pre-note picked with a key (the EZ-220, the on-screen piano, QWERTY): spelled as a played note is, slashed (d121). */
export function graceFromKey(piece: EditorPiece, ref: NoteRef, midi: number): Edit {
  return setGrace(piece, ref, { ...spellKey(piece, midi), slash: true });
}

/** The pre-note picked on the staff: the letter and octave clicked, with the key's sharp or flat, slashed (d121). */
export function graceFromPlace(piece: EditorPiece, ref: NoteRef, step: Step, octave: number): Edit {
  return setGrace(piece, ref, { step, octave, alter: keyAlterOf(piece, step), slash: true });
}
