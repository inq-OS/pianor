// Covers ft_Y_04.AC18 (the photo tool: a key signature or a clef the reading got wrong).
import { describe, expect, it } from 'vitest';
import { emptyPiece, soundingMidi, type EditorNote, type EditorPiece } from './model';
import { handRanges, reclef, rekey } from './photoFix';

const note = (over: Partial<EditorNote>): EditorNote => ({ hand: 'RH', bar: 0, start: 0, length: 'quarter', step: 'C', octave: 4, alter: 0, ...over });

function piece(notes: EditorNote[], fifths = 0): EditorPiece {
  return { ...emptyPiece({ title: 'Read', hands: 'both', beats: 4, bars: 4 }), fifths, notes };
}

describe('the photo tool\'s fixes (ft_Y_04.AC18)', () => {
  it('ft_Y_04.AC18 a missed key signature: the notes that took the key take the new key, an accidental of its own stays', () => {
    const read = piece([note({ step: 'F' }), note({ step: 'F', alter: 1, start: 480 }), note({ step: 'C', alter: 1, start: 960 }), note({ step: 'G', grace: { step: 'F', octave: 4, alter: 0, slash: true }, start: 1440 })]);
    const g = rekey(read, 1, 'major');
    expect(g).toMatchObject({ fifths: 1, mode: 'major' });
    expect(g.notes.map((n) => n.alter)).toEqual([1, 1, 1, 0]);
    expect(g.notes[3]?.grace?.alter).toBe(1);
    // back again: the F that is now in the key turns natural, as does the one that had its own sharp (it is the key's now)
    expect(rekey(g, 0, 'minor').notes.map((n) => n.alter)).toEqual([0, 0, 1, 0]);
  });

  it('ft_Y_04.AC18 a staff read in the wrong clef: one hand moves twelve letters, its accidentals with it', () => {
    // a treble staff read as bass: E4 on the bottom line came out G2
    const read = piece([note({ step: 'G', octave: 2 }), note({ step: 'B', octave: 2, alter: -1, start: 480 }), note({ hand: 'LH', step: 'C', octave: 3 })], 1);
    const up = reclef(read, 'RH', 1);
    expect(up?.notes.map((n) => `${n.step}${n.octave}:${n.alter}`)).toEqual(['E4:0', 'G4:-1', 'C3:0']);
    // in G major an F takes the sharp: a D moved down to an F gets it, the flat sign on a line stays with the line
    const down = reclef(piece([note({ hand: 'LH', step: 'D', octave: 5 })], 1), 'LH', -1);
    expect(down?.notes[0]).toMatchObject({ step: 'F', octave: 3, alter: 1 });
    expect(reclef(piece([note({ step: 'G', octave: 2, grace: { step: 'F', octave: 2, alter: 0, slash: false } })]), 'RH', 1)?.notes[0]?.grace).toMatchObject({ step: 'D', octave: 4 });
    // off the keyboard: no move
    expect(reclef(piece([note({ step: 'C', octave: 6 })]), 'RH', 1)).toBeNull();
    expect(soundingMidi(up!.notes[0]!)).toBe(64);
  });

  it('ft_Y_04.AC18 shows each hand\'s lowest and highest note, so a hand read in the wrong clef stands out', () => {
    const read = piece([note({ step: 'G', octave: 5 }), note({ step: 'C', octave: 4, start: 480 }), note({ hand: 'LH', step: 'B', octave: 2, alter: -1 })]);
    expect(handRanges(read)).toEqual([
      { hand: 'RH', low: { step: 'C', octave: 4, alter: 0 }, high: { step: 'G', octave: 5, alter: 0 } },
      { hand: 'LH', low: { step: 'B', octave: 2, alter: -1 }, high: { step: 'B', octave: 2, alter: -1 } },
    ]);
    expect(handRanges(piece([]))).toEqual([]);
  });
});
