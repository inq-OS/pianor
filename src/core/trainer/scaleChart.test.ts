import { describe, expect, it } from 'vitest';
import { chartSchema } from '../chart/schema.ts';
import { noteName } from '../chart/pitch.ts';
import { scaleChart, scaleSpellings, signatureAlter } from './scaleChart.ts';

const names = (fifths: number, mode: 'major' | 'minor') => scaleSpellings(fifths, mode).map(noteName);

describe('scaleSpellings (ft_1_28.AC5)', () => {
  it('spells the major scales with their signature', () => {
    expect(names(0, 'major')).toEqual(['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5']);
    expect(names(1, 'major')).toEqual(['G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F#5', 'G5']);
    expect(names(-1, 'major')).toEqual(['F4', 'G4', 'A4', 'Bb4', 'C5', 'D5', 'E5', 'F5']);
    expect(names(6, 'major')).toEqual(['F#4', 'G#4', 'A#4', 'B4', 'C#5', 'D#5', 'E#5', 'F#5']);
    expect(names(-7, 'major')).toEqual(['Cb4', 'Db4', 'Eb4', 'Fb4', 'Gb4', 'Ab4', 'Bb4', 'Cb5']);
  });

  it('spells the natural minor of the relative minor with the same signature', () => {
    expect(names(0, 'minor')).toEqual(['A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G5', 'A5']);
    expect(names(1, 'minor')).toEqual(['E4', 'F#4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5']);
    expect(names(-3, 'minor')).toEqual(['C4', 'D4', 'Eb4', 'F4', 'G4', 'Ab4', 'Bb4', 'C5']);
  });

  it('uses exactly the signs of the signature in all fifteen keys', () => {
    for (let fifths = -7; fifths <= 7; fifths++) {
      for (const mode of ['major', 'minor'] as const) {
        const signs = scaleSpellings(fifths, mode).slice(0, 7).reduce((sum, s) => sum + s.alter, 0);
        expect(signs).toBe(fifths);
      }
    }
  });

  it('puts the signs in circle order', () => {
    expect(signatureAlter(2, 'C')).toBe(1);
    expect(signatureAlter(2, 'G')).toBe(0);
    expect(signatureAlter(-2, 'E')).toBe(-1);
    expect(signatureAlter(-2, 'A')).toBe(0);
  });
});

describe('scaleChart (ft_1_28.AC5)', () => {
  it('is a valid chart of eight quarter notes in two bars, in the key', () => {
    for (let fifths = -7; fifths <= 7; fifths++) {
      const chart = scaleChart(fifths, 'major');
      expect(chartSchema.safeParse(chart).success).toBe(true);
      expect(chart.notes).toHaveLength(8);
      expect(chart.bars).toHaveLength(2);
      expect(chart.keyMap[0]).toEqual({ tick: 0, fifths, mode: 'major' });
      expect(chart.notes.at(-1)!.midi - chart.notes[0]!.midi).toBe(12);
    }
  });
});
