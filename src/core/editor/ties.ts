/**
 * Ties in the editor (core_09.AC13): a parent ties the selected note to the next note of the same pitch, also across a bar
 * line, or takes the tie away with a second press. A chord is tied as a whole, note by note to the same pitches. Pure.
 */
import { LENGTH_TICKS, findNote, placeAfter, tickOf, soundingMidi, type Edit, type EditorNote, type EditorPiece, type NoteRef } from './model';
import { repeatsOf } from './repeats';

/**
 * The note a tie from `note` enters: same hand, same sounding pitch, starting where `note` ends. Null when there is none, or
 * when the tie would cross a repeat sign (ABC has no tie across one). Also used when the ABC is written, so a tie whose
 * target was edited away is not written (it would not compile).
 */
export function tieTargetOf(piece: EditorPiece, note: EditorNote): EditorNote | null {
  const { bar, start } = placeAfter(piece, note.bar, note.start + LENGTH_TICKS[note.length]);
  if (bar !== note.bar && repeatsOf(piece).some((r) => r.endBar === note.bar || r.startBar === bar)) return null;
  return piece.notes.find((n) => n.hand === note.hand && n.bar === bar && n.start === start && soundingMidi(n) === soundingMidi(note)) ?? null;
}

/** The notes that start with `note` in its hand, bar and time: its chord (a single note is a chord of one). */
function chordOf(piece: EditorPiece, note: EditorNote): EditorNote[] {
  return piece.notes.filter((n) => n.hand === note.hand && n.bar === note.bar && n.start === note.start);
}

/**
 * The tie targets of a whole chord: every note of it must have a note of the same pitch right after it, and those notes must
 * be one chord (so the ABC can tie the chord as a whole). Null when any head has no target.
 */
function chordTargets(piece: EditorPiece, chord: readonly EditorNote[]): EditorNote[] | null {
  const targets = chord.map((n) => tieTargetOf(piece, n));
  if (targets.some((t) => t === null)) return null;
  const first = targets[0]!;
  const sameChord = targets.every((t) => t!.bar === first.bar && t!.start === first.start);
  return sameChord ? (targets as EditorNote[]) : null;
}

/**
 * "Tie" on the selected note or chord (core_09.AC13): every note of the chord is tied to the same pitch right after it, so
 * a C/G chord ties to the next C/G. A second press takes the tie away from the whole chord. Pure.
 */
export function toggleTie(piece: EditorPiece, ref: NoteRef): Edit {
  const note = findNote(piece, ref);
  if (!note) return { ok: false, reason: 'no-note' };
  const chord = chordOf(piece, note);
  if (chord.some((n) => n.tieNext)) return { ok: true, piece: withTies(piece, chord, false) };
  if (!chordTargets(piece, chord)) return { ok: false, reason: 'tie-none' };
  return { ok: true, piece: withTies(piece, chord, true) };
}

/** Whether the note's chord is tied (any head of it): a press of tie then takes the tie away. */
export function chordTied(piece: EditorPiece, ref: NoteRef): boolean {
  const note = findNote(piece, ref);
  return !!note && chordOf(piece, note).some((n) => n.tieNext);
}

/**
 * "Tie all" (core_09.AC13): every chord that has its matching chord right after it is tied, so a repeated figure is tied
 * across the whole piece in one press. Chords already tied stay tied; nothing is untied. Pure.
 */
export function tieAll(piece: EditorPiece): Edit {
  const todo = new Set<EditorNote>();
  for (const n of piece.notes) {
    if (n.tieNext) continue;
    const chord = chordOf(piece, n);
    if (chord.some((c) => c.tieNext)) continue;
    if (chordTargets(piece, chord)) chord.forEach((c) => todo.add(c));
  }
  if (todo.size === 0) return { ok: false, reason: 'tie-none' };
  return { ok: true, piece: { ...piece, notes: piece.notes.map((n) => (todo.has(n) ? { ...n, tieNext: true } : n)) } };
}

/**
 * Whether the ABC writes a tie for this note: its whole chord is tied and every head has its target, so the tie mark can
 * go after the chord. The ABC and the chart both use this one rule. Pure.
 */
export function tieWritten(piece: EditorPiece, note: EditorNote): boolean {
  const chord = chordOf(piece, note);
  return chord.every((n) => n.tieNext) && chord.every((n) => tieTargetOf(piece, n));
}

/**
 * Whether some note has a later note of its pitch in its hand but no tie target: the same pitch is there, only not right
 * after it (another note or a rest sits between). Tells the author why "tie all" found nothing to tie. Pure.
 */
export function samePitchNotAdjacent(piece: EditorPiece): boolean {
  const tick = (n: EditorNote) => tickOf(piece, n.bar, n.start);
  return piece.notes.some((n) => {
    if (tieTargetOf(piece, n)) return false;
    return piece.notes.some((m) => m.hand === n.hand && soundingMidi(m) === soundingMidi(n) && tick(m) > tick(n));
  });
}

function withTies(piece: EditorPiece, chord: readonly EditorNote[], tied: boolean): EditorPiece {
  return {
    ...piece,
    notes: piece.notes.map((n) => {
      if (!chord.includes(n)) return n;
      const rest: EditorNote = { ...n };
      delete rest.tieNext;
      return tied ? { ...rest, tieNext: true } : rest;
    }),
  };
}

/**
 * Pick two notes (core_09.AC13): the chord of `from` ties into the chord of `into`, but only when `into` is the chord the tie
 * would enter (the next note of each pitch) and every head of `from` has its pitch there. Pure.
 */
export function tieInto(piece: EditorPiece, from: NoteRef, into: NoteRef): Edit {
  const note = findNote(piece, from);
  const target = findNote(piece, into);
  if (!note || !target) return { ok: false, reason: 'no-note' };
  const chord = chordOf(piece, note);
  const targets = chord.map((n) => tieTargetOf(piece, n));
  // every head must reach the clicked chord at its time, in the same hand (tieTargetOf already matches the pitch)
  const ok = target.hand === note.hand && targets.every((t) => t !== null && t.bar === target.bar && t.start === target.start);
  if (!ok) return { ok: false, reason: 'tie-none' };
  return { ok: true, piece: withTies(piece, chord, true) };
}
