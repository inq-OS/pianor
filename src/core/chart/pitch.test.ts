// Covers ft_0_02.AC2, ft_0_02.AC3, ft_0_05.AC3.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  isBlackKey,
  isWhiteKey,
  pitchClass,
  STEP_SEMITONES,
  ledgerLinePositions, midiToSpelling, noteName, parseNoteName, spellingToMidi, staffPosition,
} from './pitch';

const sp = (name: string) => parseNoteName(name);

describe('spelling and MIDI', () => {
  it('middle C is MIDI 60 and A4 is 69', () => {
    expect(spellingToMidi(sp('C4'))).toBe(60);
    expect(spellingToMidi(sp('A4'))).toBe(69);
  });

  it('C# and Db are the same key with different spellings', () => {
    expect(spellingToMidi(sp('C#4'))).toBe(61);
    expect(spellingToMidi(sp('Db4'))).toBe(61);
    expect(midiToSpelling(61)).toEqual(sp('C#4'));
    expect(midiToSpelling(61, true)).toEqual(sp('Db4'));
  });

  it('handles octave-crossing spellings (B#3 and Cb4)', () => {
    expect(spellingToMidi(sp('B#3'))).toBe(60);
    expect(spellingToMidi(sp('Cb4'))).toBe(59);
  });

  it('names double accidentals and refuses unsupported alterations', () => {
    expect(noteName({ step: 'F', alter: 2, octave: 4 })).toBe('F##4');
    expect(noteName({ step: 'B', alter: -2, octave: 3 })).toBe('Bbb3');
    expect(() => noteName({ step: 'C', alter: 3, octave: 4 })).toThrow(RangeError);
  });

  it('rejects malformed names and out-of-range MIDI', () => {
    expect(() => parseNoteName('H4')).toThrow();
    expect(() => parseNoteName('C')).toThrow();
    expect(() => midiToSpelling(128)).toThrow(RangeError);
    expect(() => midiToSpelling(1.5)).toThrow(RangeError);
  });

  it('round-trips every MIDI note in both spellings (property)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 127 }), fc.boolean(), (midi, flats) => {
        const s = midiToSpelling(midi, flats);
        expect(spellingToMidi(s)).toBe(midi);
        expect(parseNoteName(noteName(s))).toEqual(s);
      }),
    );
  });
});

describe('staff position', () => {
  it('treble: bottom line E4 is 0, top line F5 is 8, middle C is the first ledger line below (-2)', () => {
    expect(staffPosition(sp('E4'), 'treble')).toBe(0);
    expect(staffPosition(sp('F5'), 'treble')).toBe(8);
    expect(staffPosition(sp('C4'), 'treble')).toBe(-2);
    expect(staffPosition(sp('G4'), 'treble')).toBe(2);
  });

  it('bass: bottom line G2 is 0, top line A3 is 8, middle C is the first ledger line above (10)', () => {
    expect(staffPosition(sp('G2'), 'bass')).toBe(0);
    expect(staffPosition(sp('A3'), 'bass')).toBe(8);
    expect(staffPosition(sp('C4'), 'bass')).toBe(10);
    expect(staffPosition(sp('C3'), 'bass')).toBe(3);
  });

  it('C# shares the position of C but Db is a step higher', () => {
    expect(staffPosition(sp('C#4'), 'treble')).toBe(staffPosition(sp('C4'), 'treble'));
    expect(staffPosition(sp('Db4'), 'treble')).toBe(staffPosition(sp('C4'), 'treble') + 1);
  });

  it('the same pitch is 12 positions apart across the two clefs (property)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 24, max: 108 }), (midi) => {
        const s = midiToSpelling(midi);
        expect(staffPosition(s, 'bass') - staffPosition(s, 'treble')).toBe(12);
      }),
    );
  });

  it('moves up by zero or one step per semitone (property)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 36, max: 95 }), (midi) => {
        const a = midiToSpelling(midi);
        const b = midiToSpelling(midi + 1);
        const diff = staffPosition(b, 'treble') - staffPosition(a, 'treble');
        expect([0, 1]).toContain(diff);
      }),
    );
  });
});

describe('ledger lines', () => {
  it('needs none inside the staff or in the first spaces outside', () => {
    expect(ledgerLinePositions(0)).toEqual([]);
    expect(ledgerLinePositions(8)).toEqual([]);
    expect(ledgerLinePositions(-1)).toEqual([]);
    expect(ledgerLinePositions(9)).toEqual([]);
  });

  it('middle C in treble sits on one ledger line; A3 needs two', () => {
    expect(ledgerLinePositions(staffPosition(sp('C4'), 'treble'))).toEqual([-2]);
    expect(ledgerLinePositions(staffPosition(sp('A3'), 'treble'))).toEqual([-2, -4]);
  });

  it('middle C in bass sits on one ledger line above', () => {
    expect(ledgerLinePositions(staffPosition(sp('C4'), 'bass'))).toEqual([10]);
    expect(ledgerLinePositions(staffPosition(sp('E4'), 'bass'))).toEqual([10, 12]);
  });
});

describe('pitch classes and key colour', () => {
  it('names the white and black keys of one octave', () => {
    expect([60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71].map(isBlackKey)).toEqual([false, true, false, true, false, false, true, false, true, false, true, false]);
  });

  it('agrees with the step table and with every octave, negative numbers included', () => {
    for (const semitone of Object.values(STEP_SEMITONES)) expect(isWhiteKey(semitone)).toBe(true);
    fc.assert(fc.property(fc.integer({ min: -200, max: 200 }), (midi) => {
      expect(pitchClass(midi)).toBeGreaterThanOrEqual(0);
      expect(pitchClass(midi)).toBeLessThan(12);
      expect(isWhiteKey(midi)).toBe(isWhiteKey(midi + 12));
      expect(isWhiteKey(midi)).toBe(!isBlackKey(midi));
    }));
  });
});
