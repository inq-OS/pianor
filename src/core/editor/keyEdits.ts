/**
 * Edits made from the keyboard in the piece maker: Shift + Enter holds the note on with a tie, the chord
 * key builds a chord on the cursor's pitch, and Shift + up or down moves one note while keeping its legato (a tie that no
 * longer joins one pitch becomes a slur, and back). Pure, like ties.ts and slurs.ts.
 */
import { LENGTH_TICKS, autoLength, placeAfter, tickOf, chordOf, findNote, noteAt, placeNote, placedRests, removeNote, setPitch, stepped, withSlurs, type Edit, type EditorLength, type EditorNote, type EditorPiece, type NoteRef, type Refusal } from './model';
import { slurInto } from './slurs';
import { tieTargetOf, tieWritten } from './ties';

type Refused = Extract<Edit, { ok: false }>;
const refuse = (reason: Refusal): Refused => ({ ok: false, reason });
const refOf = (n: EditorNote): NoteRef => ({ hand: n.hand, bar: n.bar, start: n.start, step: n.step, octave: n.octave });

/** The notes of `chord` with their ties set or taken away. */
function tied(piece: EditorPiece, chord: readonly EditorNote[], on: boolean): EditorPiece {
  const refs = chord.map(refOf);
  const inChord = (n: EditorNote) => refs.some((r) => r.hand === n.hand && r.bar === n.bar && r.start === n.start && r.step === n.step && r.octave === n.octave);
  return {
    ...piece,
    notes: piece.notes.map((n) => {
      if (!inChord(n)) return n;
      const rest: EditorNote = { ...n };
      delete rest.tieNext;
      return on ? { ...rest, tieNext: true } : rest;
    }),
  };
}

/**
 * Shift + Enter (ft_1_02d.AC17): the note or chord under the cursor is written again in the free place right after it, with
 * the selected length (shortened to fit), and tied to it. Refused when that place is past the piece or not free. Returns the
 * new piece and where the copy of `ref` went, so the cursor can follow it.
 */
export function repeatTied(piece: EditorPiece, ref: NoteRef, selected: EditorLength): { ok: true; piece: EditorPiece; into: NoteRef } | Refused {
  const note = findNote(piece, ref);
  if (!note) return refuse('no-note');
  const end = note.start + LENGTH_TICKS[note.length];
  const { bar, start } = placeAfter(piece, note.bar, end);
  if (bar >= piece.bars) return refuse('bar');
  const taken = noteAt(piece, note.hand, bar, start) || placedRests(piece).some((r) => r.hand === note.hand && r.bar === bar && r.start <= start && start < r.start + LENGTH_TICKS[r.length]);
  if (taken) return refuse('no-room');
  const length = autoLength(piece, note.hand, bar, start, selected);
  const chord = chordOf(piece, note);
  let next = piece;
  for (const head of chord) {
    const edit = placeNote(next, { hand: head.hand, bar, start, step: head.step, octave: head.octave, alter: head.alter, length });
    if (!edit.ok) return edit;
    next = edit.piece;
  }
  next = tied(next, chord, true);
  if (!tieWritten(next, findNote(next, ref)!)) return refuse('tie-none');
  return { ok: true, piece: next, into: { ...ref, bar, start } };
}

/**
 * The chords the chord key cycles through, as steps of the scale counted from the root (1): the triad,
 * the root and fifth, the root and third, the seventh chord, and the root alone, then the triad again. The notes are in the
 * key of the piece, so on D in C major the triad is D F A.
 */
// AX-3 provisional: the order after the seventh chord (the first four are set; the rest follow the same pattern)
export const CHORD_SHAPES: readonly (readonly number[])[] = [[1, 3, 5], [1, 5], [1, 3], [1, 3, 5, 7], [1]];

/** The pitch `degree` steps of the scale above `root` (1 is the root itself). */
function above(root: Pick<NoteRef, 'step' | 'octave'>, degree: number): Pick<NoteRef, 'step' | 'octave'> {
  let p = { step: root.step, octave: root.octave };
  for (let i = 1; i < degree; i++) p = stepped(p, 1);
  return p;
}

/**
 * One press of the chord key: the notes `previous` added on the last press go, then the notes of `shape` on `root` are
 * placed at the root's place (a note already there stays and is not counted as added). They take the length of the notes
 * left there, or the selected length. All or nothing: a note past the keyboard's range refuses the whole chord.
 */
export function placeChordShape(piece: EditorPiece, root: NoteRef, shape: readonly number[], previous: readonly NoteRef[], selected: EditorLength): { ok: true; piece: EditorPiece; added: NoteRef[] } | Refused {
  let next = piece;
  for (const old of previous) {
    const edit = removeNote(next, old);
    if (edit.ok) next = edit.piece;
  }
  const length = autoLength(next, root.hand, root.bar, root.start, selected);
  const added: NoteRef[] = [];
  for (const degree of shape) {
    const ref: NoteRef = { ...root, ...above(root, degree) };
    if (findNote(next, ref)) continue;
    const edit = placeNote(next, { ...ref, length });
    if (!edit.ok) return edit;
    next = edit.piece;
    added.push(ref);
  }
  return { ok: true, piece: next, added };
}

/**
 * One press of the chord key (ft_1_02d.AC18), read from the notes alone so undo and redo need no memory: the scale steps 1,
 * 3, 5 and 7 written at the root's place (the octave above it) name the shape there; a press takes away the steps of that
 * shape the next one does not have and adds the ones it lacks. The root and every note that stays keep their length,
 * accidental, finger, tie and slur; new notes take the chord's length. Matched by letter, so an author's C Eb G counts as the
 * triad. Any other set (nothing yet, or notes of other steps, which stay) starts with the triad.
 */
export function chordKeyPress(piece: EditorPiece, root: NoteRef, selected: EditorLength): { ok: true; piece: EditorPiece; shape: readonly number[] } | Refused {
  const present = [1, 3, 5, 7].filter((d) => findNote(piece, { ...root, ...above(root, d) }));
  const index = CHORD_SHAPES.findIndex((shape) => shape.length === present.length && shape.every((d) => present.includes(d)));
  const shape = CHORD_SHAPES[(index + 1) % CHORD_SHAPES.length]!;
  const previous = index < 0 ? [] : CHORD_SHAPES[index]!.filter((d) => d !== 1 && !shape.includes(d)).map((d) => ({ ...root, ...above(root, d) }));
  const made = placeChordShape(piece, root, shape, previous, selected);
  return made.ok ? { ok: true, piece: made.piece, shape } : made;
}

/** The note of the hand whose tie enters `note` in `piece`, or null. */
function tiedInto(piece: EditorPiece, note: EditorNote): EditorNote | null {
  return piece.notes.find((p) => p.hand === note.hand && p.tieNext && tieTargetOf(piece, p) === note) ?? null;
}

/** The note of the hand that ends where `note` starts (any pitch), or null. */
function endingAt(piece: EditorPiece, note: EditorNote): EditorNote | null {
  const at = tickOf(piece, note.bar, note.start);
  return piece.notes.find((p) => p.hand === note.hand && tickOf(piece, p.bar, p.start) + LENGTH_TICKS[p.length] === at) ?? null;
}

/** The note of the hand that starts where `note` ends (any pitch), or null. */
function startingAfter(piece: EditorPiece, note: EditorNote): EditorNote | null {
  const end = tickOf(piece, note.bar, note.start) + LENGTH_TICKS[note.length];
  return piece.notes.find((p) => p.hand === note.hand && tickOf(piece, p.bar, p.start) === end) ?? null;
}

/** A tie from the chord of `from` that no longer joins one pitch becomes a slur from `from` to `into` (kept when the slur is refused). */
function tieToSlur(piece: EditorPiece, from: NoteRef, into: NoteRef): EditorPiece {
  const note = findNote(piece, from);
  if (!note || tieWritten(piece, note)) return piece;
  const untied = tied(piece, chordOf(piece, note), false);
  const slur = slurInto(untied, from, into);
  return slur.ok ? slur.piece : piece;
}

/** A slur over exactly the onsets of `from` and `into` whose pitches now match becomes a tie again. */
function slurToTie(piece: EditorPiece, from: EditorNote, into: EditorNote): EditorPiece {
  const exact = (piece.slurs ?? []).find((s) => s.hand === from.hand && s.from.bar === from.bar && s.from.start === from.start && s.to.bar === into.bar && s.to.start === into.start);
  if (!exact) return piece;
  const tiedPiece = tied(piece, chordOf(piece, from), true);
  if (!tieWritten(tiedPiece, findNote(tiedPiece, refOf(from))!)) return piece;
  return withSlurs(tiedPiece, (piece.slurs ?? []).filter((s) => !(s.hand === exact.hand && s.from.bar === exact.from.bar && s.from.start === exact.from.start && s.to.bar === exact.to.bar && s.to.start === exact.to.start)));
}

/**
 * Shift + up or down (ft_1_02d.AC16): one note, not its chord, a staff step (or an octave) up or down. A tie into it or out of
 * it that no longer joins one pitch becomes a slur over the same two notes; a slur over just those two whose pitches match
 * again becomes a tie, so moving a note away and back leaves the piece as it was. The middle note of a tied run of three
 * gets one slur over the run; moving it back keeps that slur (no tie comes back). Returns where the note went.
 */
export function moveNoteKeepingLegato(piece: EditorPiece, ref: NoteRef, direction: 1 | -1, octave: boolean): { ok: true; piece: EditorPiece; to: NoteRef } | Refused {
  const note = findNote(piece, ref);
  if (!note) return refuse('no-note');
  const pitch = octave ? { step: note.step, octave: note.octave + direction } : stepped(note, direction);
  const moved = setPitch(piece, ref, pitch.step, pitch.octave);
  if (!moved.ok) return moved;
  const to: NoteRef = { ...ref, ...pitch };
  const before = tiedInto(piece, note);
  const after = note.tieNext ? tieTargetOf(piece, note) : null;
  let next = moved.piece;
  // a note in the middle of a tied run: one slur over the run's three notes (two slurs may not share a note)
  if (before && after) next = tieToSlur(tied(next, chordOf(next, findNote(next, to)!), false), refOf(before), refOf(after));
  else if (before) next = tieToSlur(next, refOf(before), to);
  else if (after) next = tieToSlur(next, to, refOf(after));
  const now = findNote(next, to)!;
  const prev = endingAt(next, now);
  if (prev && !before) next = slurToTie(next, prev, now);
  const following = startingAfter(next, findNote(next, to)!);
  if (following && !after) next = slurToTie(next, findNote(next, to)!, following);
  return { ok: true, piece: next, to };
}
