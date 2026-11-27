// Covers ft_1_39.AC3.
import { describe, expect, it } from 'vitest';
import { lessonChart } from './chart.ts';

describe('lessonChart', () => {
  it('ft_1_39.AC3 draws the notes to copy as quarters on the treble staff, four to a bar', () => {
    const chart = lessonChart({ shown: [60, 62, 64, 65, 67], answer: [60, 62, 64, 65, 67], played: 2 }, false);
    expect(chart.notes.map((n) => n.midi)).toEqual([60, 62, 64, 65, 67]);
    expect(chart.notes.map((n) => n.bar)).toEqual([0, 0, 0, 0, 1]);
    expect(chart.bars).toHaveLength(2);
    expect(chart.tracks[0]!.clef).toBe('treble');
  });

  it('ft_1_39.AC3 shows an asked item as its shown note and only the answer played so far', () => {
    const now = { shown: [60], answer: [60, 62, 64, 65, 67, 69, 71, 72], played: 3 };
    expect(lessonChart(now, true).notes.map((n) => n.midi)).toEqual([60, 62, 64]);
    expect(lessonChart({ shown: [64], answer: [65], played: 0 }, true).notes.map((n) => n.midi)).toEqual([64]);
  });

  it('spells black keys as sharps and puts a low note on the bass staff', () => {
    const chart = lessonChart({ shown: [66], answer: [66], played: 0 }, false);
    expect(chart.notes[0]!.spelling).toEqual({ step: 'F', alter: 1, octave: 4 });
    expect(lessonChart({ shown: [48], answer: [48], played: 0 }, false).tracks[0]!.clef).toBe('bass');
  });
});
