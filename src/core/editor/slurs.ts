/**
 * Slurs in the editor (core_09.AC30, d120): a parent draws a slur from the selected note to a later note of the same hand,
 * takes it away, or presses once to do whichever applies. A slur is one curve over the notes of one hand, from the chord it
 * starts on to the later chord it ends on; the notes between belong to that hand. Pure, like ties.ts.
 */
import { findNote, withSlurs, type Edit, type EditorNote, type EditorPiece, type EditorSlur, type NoteRef, type Refusal } from './model';
import { onsetTick, slurProblem, slurSpan, slursOf } from './slurRules';

const refuse = (reason: Refusal): Edit => ({ ok: false, reason });

/** The slur of the note's hand whose span holds the note's onset, its first and last onset included, or null. */
function slurHolding(piece: EditorPiece, note: EditorNote): EditorSlur | null {
  const t = onsetTick(piece.beats, note);
  // only the slurs that are drawn count: a stored slur the staff does not show (one pitch, a repeat sign inside) is not there to the parent
  return slursOf(piece).find((s) => {
    if (s.hand !== note.hand) return false;
    const [from, to] = slurSpan(piece.beats, s);
    return from <= t && t <= to;
  }) ?? null;
}

/** Whether a drawn slur holds the note's onset (its first and last onset included). */
export function slurHolds(piece: EditorPiece, ref: NoteRef): boolean {
  const note = findNote(piece, ref);
  return note !== null && slurHolding(piece, note) !== null;
}

/** The note of the same hand that comes next in time after the note's onset (any pitch), or null when there is none. */
function nextOnsetOf(piece: EditorPiece, note: EditorNote): EditorNote | null {
  const t = onsetTick(piece.beats, note);
  let next: EditorNote | null = null;
  for (const m of piece.notes) {
    const at = onsetTick(piece.beats, m);
    if (m.hand !== note.hand || at <= t) continue;
    if (next === null || at < onsetTick(piece.beats, next)) next = m;
  }
  return next;
}

/**
 * Draws a slur from the note `from` to the note `into` (core_09.AC30). Both are of one hand, and `into` starts later. A slur
 * that already starts on `from` is drawn again: its end moves, and the old one is forgotten. Otherwise it is refused when it
 * overlaps or nests another slur of the hand, or a repeat sign falls inside it. Pure.
 */
export function slurInto(piece: EditorPiece, from: NoteRef, into: NoteRef): Edit {
  const note = findNote(piece, from);
  const target = findNote(piece, into);
  if (!note || !target) return refuse('no-note');
  if (target.hand !== note.hand) return refuse('slur-target');
  const slur: EditorSlur = { hand: note.hand, from: { bar: note.bar, start: note.start }, to: { bar: target.bar, start: target.start } };
  const others = slursOf(piece).filter((s) => !(s.hand === slur.hand && s.from.bar === slur.from.bar && s.from.start === slur.from.start));
  const problem = slurProblem({ ...piece, slurs: others }, slur);
  if (problem) return refuse(problem);
  return { ok: true, piece: withSlurs(piece, [...others, slur]) };
}

/** Takes away the slur that holds the note's onset, the one it starts or ends on included (core_09.AC30). Pure. */
export function removeSlur(piece: EditorPiece, ref: NoteRef): Edit {
  const note = findNote(piece, ref);
  if (!note) return refuse('no-note');
  const slur = slurHolding(piece, note);
  if (!slur) return refuse('slur-none');
  return { ok: true, piece: withSlurs(piece, (piece.slurs ?? []).filter((s) => {
    if (s.hand !== slur.hand) return true;
    const [a, b] = slurSpan(piece.beats, s);
    const [from, to] = slurSpan(piece.beats, slur);
    return !(a <= to && from <= b);
  })) };
}

/**
 * One press on the selected note (core_09.AC30): when a slur holds it, that slur goes; otherwise the note is slurred to the
 * next note of its hand, so a slur is never drawn across the other hand. A longer slur is drawn with `slurInto`. Pure.
 */
export function toggleSlur(piece: EditorPiece, ref: NoteRef): Edit {
  const note = findNote(piece, ref);
  if (!note) return refuse('no-note');
  if (slurHolding(piece, note)) return removeSlur(piece, ref);
  const next = nextOnsetOf(piece, note);
  if (!next) return refuse('slur-target');
  return slurInto(piece, ref, next);
}
