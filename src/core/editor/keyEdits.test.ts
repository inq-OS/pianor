// Covers ft_1_02d.AC16, ft_1_02d.AC17, ft_1_02d.AC18 (keyboard edits in the piece maker).
import { describe, expect, it } from 'vitest';
import { CHORD_SHAPES, chordKeyPress, moveNoteKeepingLegato, placeChordShape, repeatTied } from './keyEdits';
import { emptyPiece, findNote, type EditorHand, type EditorNote, type EditorPiece, type NoteRef } from './model';
import { slursOf } from './slurRules';
import { tieWritten } from './ties';

const n = (hand: EditorHand, bar: number, start: number, step: EditorNote['step'], octave = 4, length: EditorNote['length'] = 'quarter', extra: Partial<EditorNote> = {}): EditorNote => ({
  hand, bar, start, length, step, octave, alter: 0, ...extra,
});
const piece = (notes: EditorNote[], extra: Partial<EditorPiece> = {}): EditorPiece => ({ ...emptyPiece({ title: 'Keys', hands: 'both', beats: 4, bars: 4 }), notes, ...extra });
const at = (hand: EditorHand, bar: number, start: number, step: NoteRef['step'], octave = 4): NoteRef => ({ hand, bar, start, step, octave });
const pitches = (p: EditorPiece, bar: number, start: number) => p.notes.filter((x) => x.hand === 'RH' && x.bar === bar && x.start === start).map((x) => `${x.step}${x.octave}`);

function ok<T extends { ok: boolean }>(edit: T): Extract<T, { ok: true }> {
  if (!edit.ok) throw new Error(`refused: ${(edit as unknown as { reason: string }).reason}`);
  return edit as Extract<T, { ok: true }>;
}

describe('Shift + Enter holds the note on with a tie (ft_1_02d.AC17)', () => {
  it('ft_1_02d.AC17 writes the note again right after it, tied, and says where it went', () => {
    const p = piece([n('RH', 0, 0, 'E')]);
    const made = ok(repeatTied(p, at('RH', 0, 0, 'E'), 'half'));
    expect(made.into).toEqual(at('RH', 0, 480, 'E'));
    expect(findNote(made.piece, made.into)?.length).toBe('half');
    expect(tieWritten(made.piece, findNote(made.piece, at('RH', 0, 0, 'E'))!)).toBe(true);
  });

  it('ft_1_02d.AC17 crosses the bar line, ties a whole chord, and shortens the new note to fit', () => {
    const p = piece([n('RH', 0, 960, 'C', 4, 'half'), n('RH', 0, 960, 'E', 4, 'half'), n('RH', 1, 480, 'G')]);
    const made = ok(repeatTied(p, at('RH', 0, 960, 'E'), 'half'));
    expect(made.into).toEqual(at('RH', 1, 0, 'E'));
    expect(pitches(made.piece, 1, 0)).toEqual(['C4', 'E4']);
    expect(findNote(made.piece, made.into)?.length).toBe('quarter');
    expect(made.piece.notes.filter((x) => x.bar === 0).every((x) => x.tieNext)).toBe(true);
  });

  it('ft_1_02d.AC17 is refused when the next place is taken or past the piece', () => {
    expect(repeatTied(piece([n('RH', 0, 0, 'E'), n('RH', 0, 480, 'G')]), at('RH', 0, 0, 'E'), 'quarter')).toEqual({ ok: false, reason: 'no-room' });
    expect(repeatTied(piece([n('RH', 0, 0, 'E')], { rests: [{ hand: 'RH', bar: 0, start: 480, length: 'quarter' }] }), at('RH', 0, 0, 'E'), 'quarter')).toEqual({ ok: false, reason: 'no-room' });
    expect(repeatTied(piece([n('RH', 3, 0, 'E', 4, 'whole')]), at('RH', 3, 0, 'E'), 'quarter')).toEqual({ ok: false, reason: 'bar' });
    expect(repeatTied(piece([]), at('RH', 0, 0, 'E'), 'quarter')).toEqual({ ok: false, reason: 'no-note' });
  });
});

describe('the chord key (ft_1_02d.AC18)', () => {
  it('ft_1_02d.AC18 cycles 1-3-5, 1-5, 1-3, 1-3-5-7, 1 on the root, in the key of the piece', () => {
    expect(CHORD_SHAPES).toEqual([[1, 3, 5], [1, 5], [1, 3], [1, 3, 5, 7], [1]]);
    const root = at('RH', 0, 0, 'D');
    let p = piece([]);
    let added: NoteRef[] = [];
    const seen: string[][] = [];
    for (const shape of [...CHORD_SHAPES, CHORD_SHAPES[0]!]) {
      const made = ok(placeChordShape(p, root, shape, added, 'quarter'));
      p = made.piece;
      added = made.added;
      seen.push(pitches(p, 0, 0));
    }
    expect(seen).toEqual([['D4', 'F4', 'A4'], ['D4', 'A4'], ['D4', 'F4'], ['D4', 'F4', 'A4', 'C5'], ['D4'], ['D4', 'F4', 'A4']]);
    // in G major the F is sharp
    const g = ok(placeChordShape(piece([], { fifths: 1 }), at('RH', 0, 0, 'D'), [1, 3, 5], [], 'quarter')).piece;
    expect(g.notes.map((x) => `${x.step}${x.alter}`)).toEqual(['D0', 'F1', 'A0']);
  });

  it('ft_1_02d.AC18 keeps a note already there and takes the chord\'s length; refuses past the keyboard', () => {
    const p = piece([n('RH', 0, 0, 'C', 4, 'half')]);
    const made = ok(placeChordShape(p, at('RH', 0, 0, 'C'), [1, 3, 5], [], 'quarter'));
    expect(made.added).toEqual([at('RH', 0, 0, 'E'), at('RH', 0, 0, 'G')]);
    expect(made.piece.notes.every((x) => x.length === 'half')).toBe(true);
    // the next press removes only what this one added: the C the author wrote stays
    const next = ok(placeChordShape(made.piece, at('RH', 0, 0, 'C'), [1], made.added, 'quarter'));
    expect(pitches(next.piece, 0, 0)).toEqual(['C4']);
    expect(placeChordShape(piece([]), at('RH', 0, 0, 'B', 6), [1, 3, 5], [], 'quarter')).toEqual({ ok: false, reason: 'range' });
  });
});

describe('the chord key reads the shape from the notes (ft_1_02d.AC18)', () => {
  it('ft_1_02d.AC18 each press goes to the next shape, so an undone press cycles on from the notes shown', () => {
    const root = at('RH', 0, 0, 'C');
    let p = piece([]);
    const seen: string[] = [];
    for (let i = 0; i < 6; i++) {
      const made = ok(chordKeyPress(p, root, 'quarter'));
      p = made.piece;
      seen.push(`${made.shape.join('-')}=${pitches(p, 0, 0).join(' ')}`);
    }
    expect(seen).toEqual(['1-3-5=C4 E4 G4', '1-5=C4 G4', '1-3=C4 E4', '1-3-5-7=C4 E4 G4 B4', '1=C4', '1-3-5=C4 E4 G4']);
    // after an undo the triad is back on the staff: the next press is 1-5 again, not a stuck triad
    const triad = ok(chordKeyPress(piece([]), root, 'quarter')).piece;
    expect(pitches(ok(chordKeyPress(triad, root, 'quarter')).piece, 0, 0)).toEqual(['C4', 'G4']);
  });

  it('ft_1_02d.AC18 the author\'s notes keep their length, sharp, finger, tie and slur through the cycle', () => {
    const root = at('RH', 0, 0, 'C');
    const written = piece([n('RH', 0, 0, 'C', 4, 'half', { alter: 1, finger: 1, tieNext: true }), n('RH', 0, 960, 'C', 4, 'quarter', { alter: 1 }), n('RH', 1, 0, 'D')], { slurs: [{ hand: 'RH', from: { bar: 0, start: 960 }, to: { bar: 1, start: 0 } }] });
    let p = written;
    for (let i = 0; i < CHORD_SHAPES.length; i++) {
      p = ok(chordKeyPress(p, root, 'quarter')).piece;
      const c = findNote(p, root)!;
      expect(c).toMatchObject({ length: 'half', alter: 1, finger: 1, tieNext: true });
      expect(p.notes.filter((x) => x.bar === 0 && x.start === 0).every((x) => x.length === 'half')).toBe(true);
      expect(slursOf(p)).toHaveLength(1);
    }
    // the author's own chord: one press drops only the third, the others keep their fingers
    const chordPiece = piece([n('RH', 0, 0, 'C', 4, 'half', { finger: 1 }), n('RH', 0, 0, 'E', 4, 'half', { finger: 3 }), n('RH', 0, 0, 'G', 4, 'half', { finger: 5 })]);
    const once = ok(chordKeyPress(chordPiece, root, 'quarter')).piece;
    expect(once.notes.map((x) => `${x.step}${x.length}${x.finger}`)).toEqual(['Chalf1', 'Ghalf5']);
  });

  it('ft_1_02d.AC18 a written root alone gets the triad; notes of other steps stay', () => {
    const root = at('RH', 0, 0, 'C');
    expect(pitches(ok(chordKeyPress(piece([n('RH', 0, 0, 'C')]), root, 'quarter')).piece, 0, 0)).toEqual(['C4', 'E4', 'G4']);
    const withD = piece([n('RH', 0, 0, 'C'), n('RH', 0, 0, 'D')]);
    expect(pitches(ok(chordKeyPress(withD, root, 'quarter')).piece, 0, 0)).toEqual(['C4', 'D4', 'E4', 'G4']);
  });
});

describe('Shift + up or down moves one note and keeps its legato (ft_1_02d.AC16)', () => {
  it('ft_1_02d.AC16 the middle note of three tied notes: one slur over all three', () => {
    const p = piece([n('RH', 0, 0, 'E', 4, 'quarter', { tieNext: true }), n('RH', 0, 480, 'E', 4, 'quarter', { tieNext: true }), n('RH', 0, 960, 'E')]);
    const made = ok(moveNoteKeepingLegato(p, at('RH', 0, 480, 'E'), 1, false)).piece;
    expect(made.notes.some((x) => x.tieNext)).toBe(false);
    expect(slursOf(made)).toEqual([{ hand: 'RH', from: { bar: 0, start: 0 }, to: { bar: 0, start: 960 } }]);
  });

  it('ft_1_02d.AC16 moves one head of a chord, not the chord, a step or an octave', () => {
    const p = piece([n('RH', 0, 0, 'C'), n('RH', 0, 0, 'E')]);
    const made = ok(moveNoteKeepingLegato(p, at('RH', 0, 0, 'E'), 1, false));
    expect(made.to).toEqual(at('RH', 0, 0, 'F'));
    expect(pitches(made.piece, 0, 0)).toEqual(['C4', 'F4']);
    expect(ok(moveNoteKeepingLegato(p, at('RH', 0, 0, 'E'), -1, true)).to).toEqual(at('RH', 0, 0, 'E', 3));
    // onto the other head of the chord: refused
    const second = piece([n('RH', 0, 0, 'C'), n('RH', 0, 0, 'D')]);
    expect(moveNoteKeepingLegato(second, at('RH', 0, 0, 'D'), -1, false)).toEqual({ ok: false, reason: 'duplicate' });
  });

  it('ft_1_02d.AC16 a tie into or out of the moved note becomes a slur over the same two notes', () => {
    const p = piece([n('RH', 0, 0, 'E', 4, 'quarter', { tieNext: true }), n('RH', 0, 480, 'E')]);
    const second = ok(moveNoteKeepingLegato(p, at('RH', 0, 480, 'E'), 1, false)).piece;
    expect(second.notes.some((x) => x.tieNext)).toBe(false);
    expect(slursOf(second)).toEqual([{ hand: 'RH', from: { bar: 0, start: 0 }, to: { bar: 0, start: 480 } }]);
    const first = ok(moveNoteKeepingLegato(p, at('RH', 0, 0, 'E'), -1, false)).piece;
    expect(first.notes.some((x) => x.tieNext)).toBe(false);
    expect(slursOf(first)).toEqual([{ hand: 'RH', from: { bar: 0, start: 0 }, to: { bar: 0, start: 480 } }]);
  });

  it('ft_1_02d.AC16 moving the note back makes the slur a tie again: the piece is as it was', () => {
    const p = piece([n('RH', 0, 0, 'E', 4, 'quarter', { tieNext: true }), n('RH', 0, 480, 'E')]);
    const away = ok(moveNoteKeepingLegato(p, at('RH', 0, 480, 'E'), 1, false));
    const back = ok(moveNoteKeepingLegato(away.piece, away.to, -1, false));
    expect(back.piece.notes).toEqual(p.notes);
    expect(slursOf(back.piece)).toEqual([]);
  });

  it('ft_1_02d.AC16 a note with no tie just moves, and a slur the author drew over other pitches stays', () => {
    const p = piece([n('RH', 0, 0, 'C'), n('RH', 0, 480, 'D')], { slurs: [{ hand: 'RH', from: { bar: 0, start: 0 }, to: { bar: 0, start: 480 } }] });
    const made = ok(moveNoteKeepingLegato(p, at('RH', 0, 480, 'D'), 1, false));
    expect(slursOf(made.piece)).toHaveLength(1);
    expect(made.piece.notes.some((x) => x.tieNext)).toBe(false);
  });
});
