import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { midiToSpelling, type Spelling } from '../chart/pitch';
import { chordNotesLabel, defaultNoteNaming, noteLabel } from './noteName';

const sp = (step: Spelling['step'], alter: number, octave = 4): Spelling => ({ step, alter, octave });

describe('noteLabel: hint label from the spelling, without octave (core_09.AC6)', () => {
  it('names the white keys with the usual letters in B mode', () => {
    expect(noteLabel(sp('C', 0), 'B')).toBe('C');
    expect(noteLabel(sp('D', 0), 'B')).toBe('D');
    expect(noteLabel(sp('E', 0), 'B')).toBe('E');
    expect(noteLabel(sp('F', 0), 'B')).toBe('F');
    expect(noteLabel(sp('G', 0), 'B')).toBe('G');
    expect(noteLabel(sp('A', 0), 'B')).toBe('A');
    expect(noteLabel(sp('B', 0), 'B')).toBe('B');
  });

  it('names a sharp with the sign from the spelling: C#4 is "C#", F# is "F#"', () => {
    expect(noteLabel(sp('C', 1), 'B')).toBe('C#');
    expect(noteLabel(sp('F', 1), 'B')).toBe('F#');
    expect(noteLabel(sp('F', 1), 'H')).toBe('F#');
  });

  it('names a flat with the sign from the spelling: Db4 is "Db", Bb3 is "Bb" in B mode', () => {
    expect(noteLabel(sp('D', -1), 'B')).toBe('Db');
    expect(noteLabel(sp('B', -1, 3), 'B')).toBe('Bb');
  });

  it('names a double sign with two signs', () => {
    expect(noteLabel(sp('C', 2), 'B')).toBe('C##');
    expect(noteLabel(sp('E', -2), 'B')).toBe('Ebb');
  });

  it('names B natural H in H mode and leaves the other letters alone', () => {
    expect(noteLabel(sp('B', 0), 'H')).toBe('H');
    expect(noteLabel(sp('C', 0), 'H')).toBe('C');
    expect(noteLabel(sp('A', 0), 'H')).toBe('A');
  });

  it('names Bb B in H mode, so German B is B flat, and keeps a spelled A# as A#', () => {
    expect(noteLabel(sp('B', -1), 'H')).toBe('B');
    expect(noteLabel(sp('A', 1), 'H')).toBe('A#');
    expect(noteLabel(sp('B', -1), 'B')).toBe('Bb');
  });

  it('keeps every other letter and its sign in H mode, so a scale never shows a letter twice: Cb, Fb, E#, B# reads "H#", Bbb reads "Bb"', () => {
    expect(noteLabel(sp('C', -1), 'H')).toBe('Cb');
    expect(noteLabel(sp('F', -1), 'H')).toBe('Fb');
    expect(noteLabel(sp('E', 1), 'H')).toBe('E#');
    expect(noteLabel(sp('B', 1), 'H')).toBe('H#');
    expect(noteLabel(sp('B', 2), 'H')).toBe('H##');
    expect(noteLabel(sp('B', -2), 'H')).toBe('Bb');
    expect(noteLabel(sp('B', 1), 'B')).toBe('B#');
  });

  it('names the C flat and C sharp major scales with seven different letters in H mode', () => {
    const cFlat = (['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const).map((step) => noteLabel(sp(step, -1), 'H'));
    expect(cFlat).toEqual(['Cb', 'Db', 'Eb', 'Fb', 'Gb', 'Ab', 'B']);
    const cSharp = (['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const).map((step) => noteLabel(sp(step, 1), 'H'));
    expect(cSharp).toEqual(['C#', 'D#', 'E#', 'F#', 'G#', 'A#', 'H#']);
  });

  it('keeps the other flats and sharps with their signs in H mode', () => {
    expect(noteLabel(sp('D', -1), 'H')).toBe('Db');
    expect(noteLabel(sp('F', 1), 'H')).toBe('F#');
  });

  it('never gives a natural B the letter B in H mode, over the EZ-220 range (MIDI 36 to 96, spelled by default)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 36, max: 96 }), (midi) => {
        const s = midiToSpelling(midi);
        const name = noteLabel(s, 'H');
        expect(name).toMatch(/^[A-H](#|b)?$/);
        // H is a natural B and nothing else
        if (s.step === 'B' && s.alter === 0) expect(name).toBe('H');
        else expect(name).not.toBe('H');
      }),
    );
  });

  it('throws on an alteration beyond a double sign', () => {
    expect(() => noteLabel(sp('C', 3), 'B')).toThrow(RangeError);
  });
});

describe('the default letter naming of a new player (ft_0_18, item 7)', () => {
  it('Estonian players start with H, English players with B', () => {
    expect(defaultNoteNaming('et')).toBe('H');
    expect(defaultNoteNaming('en')).toBe('B');
  });
});

describe('chordNotesLabel: the names of a chord in one label (core_09.AC6)', () => {
  it('core_09.AC6 joins the names low to high with a space, not a slash, which reads like a slash chord', () => {
    expect(chordNotesLabel([sp('C', 1), sp('E', 0), sp('G', 1)], 'B')).toBe('C# E G#');
    expect(chordNotesLabel([sp('B', -1), sp('D', 0), sp('F', 0)], 'H')).toBe('B D F');
    expect(chordNotesLabel([sp('C', 0)], 'B')).toBe('C');
  });
});
