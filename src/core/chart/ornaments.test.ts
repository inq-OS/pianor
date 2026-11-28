// Covers core_09.AC62: the notes each ornament sign sounds (d306).
import { describe, expect, it } from 'vitest';
import { PPQ } from './time';
import { neighbourLetter, ornamentNotes } from './ornaments';

const C = 72;
const D = 74;
const B = 71;

describe('ornament notes (core_09.AC62)', () => {
  it('core_09.AC62 an upper mordent on a quarter sounds main, upper, main in thirty-seconds, the last held to the end', () => {
    expect(ornamentNotes('upperMordent', C, { upper: D }, PPQ)).toEqual([
      { midi: C, offset: 0, dur: 60 },
      { midi: D, offset: 60, dur: 60 },
      { midi: C, offset: 120, dur: 360 },
    ]);
  });

  it('core_09.AC62 a lower mordent goes to the note below', () => {
    expect(ornamentNotes('lowerMordent', C, { lower: B }, PPQ).map((n) => n.midi)).toEqual([C, B, C]);
  });

  it('core_09.AC62 a turn on a quarter sounds upper, main, lower, main as sixteenths', () => {
    expect(ornamentNotes('turn', C, { upper: D, lower: B }, PPQ)).toEqual([
      { midi: D, offset: 0, dur: 120 },
      { midi: C, offset: 120, dur: 120 },
      { midi: B, offset: 240, dur: 120 },
      { midi: C, offset: 360, dur: 120 },
    ]);
  });

  it('core_09.AC62 a turn on a half note keeps sixteenths and holds the main note after them', () => {
    const notes = ornamentNotes('turn', C, { upper: D, lower: B }, 2 * PPQ);
    expect(notes.map((n) => n.dur)).toEqual([120, 120, 120, 600]);
  });

  it('core_09.AC62 a trill alternates main and upper through the note, starting and ending on the main note', () => {
    const notes = ornamentNotes('trill', C, { upper: D }, PPQ);
    expect(notes.map((n) => n.midi)).toEqual([C, D, C, D, C, D, C]);
    expect(notes.at(-1)!.offset + notes.at(-1)!.dur).toBe(PPQ);
    for (let i = 1; i < notes.length; i++) expect(notes[i]!.offset).toBe(notes[i - 1]!.offset + notes[i - 1]!.dur);
  });

  it('core_09.AC62 a sign on a note shorter than its quick notes shares the length out evenly', () => {
    const notes = ornamentNotes('trill', C, { upper: D }, PPQ / 8);
    expect(notes.map((n) => n.midi)).toEqual([C, D, C]);
    expect(notes.map((n) => n.dur)).toEqual([20, 20, 20]);
  });

  it('core_09.AC62 the neighbour letter carries the octave over B and C', () => {
    expect(neighbourLetter({ step: 'B', octave: 4 }, 1)).toEqual({ step: 'C', octave: 5 });
    expect(neighbourLetter({ step: 'C', octave: 4 }, -1)).toEqual({ step: 'B', octave: 3 });
    expect(neighbourLetter({ step: 'E', octave: 4 }, 1)).toEqual({ step: 'F', octave: 4 });
  });
});
