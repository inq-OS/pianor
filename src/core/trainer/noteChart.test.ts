import { describe, expect, it } from 'vitest';
import { chartSchema } from '../chart/schema.ts';
import { midiToSpelling } from '../chart/pitch.ts';
import { PPQ } from '../chart/time.ts';
import { clefOfRange, trainerChart } from './noteChart.ts';

// Covers ft_0_17.AC1: the staff shows one note, drawn with the clef of the step it belongs to.
describe('trainerChart (ft_0_17.AC1)', () => {
  it('is a valid chart holding one whole note at the target', () => {
    const chart = trainerChart(60, { low: 60, high: 72 });
    expect(chartSchema.safeParse(chart).success).toBe(true);
    expect(chart.notes).toHaveLength(1);
    expect(chart.notes[0]).toMatchObject({ tick: 0, dur: 4 * PPQ, midi: 60, bar: 0 });
    expect(chart.notes[0]!.spelling).toEqual(midiToSpelling(60));
    expect(chart.bars).toHaveLength(1);
  });

  it('uses the step range as the chart range', () => {
    const chart = trainerChart(64, { low: 60, high: 67 });
    expect(chart.range).toEqual({ low: 60, high: 67 });
  });

  it('draws a black key with a sharp spelling', () => {
    const chart = trainerChart(61, { low: 60, high: 67 });
    expect(chart.notes[0]!.spelling).toMatchObject({ step: 'C', alter: 1, octave: 4 });
  });

  it('takes the clef of the step: bass below middle C, treble from it up', () => {
    expect(clefOfRange({ low: 36, high: 59 }, 40)).toBe('bass');
    expect(clefOfRange({ low: 60, high: 96 }, 72)).toBe('treble');
    expect(trainerChart(40, { low: 36, high: 59 }).tracks[0]!.clef).toBe('bass');
    expect(trainerChart(72, { low: 60, high: 96 }).tracks[0]!.clef).toBe('treble');
  });

  it('a step that straddles middle C follows the target note', () => {
    expect(clefOfRange({ low: 48, high: 72 }, 50)).toBe('bass');
    expect(clefOfRange({ low: 48, high: 72 }, 66)).toBe('treble');
  });
});
