// Covers ft_1_10.AC7 (the answer is drawn on the staff: one whole note per note of the question, in order, in one bar each).
import { describe, expect, it } from 'vitest';
import { earAnswerChart } from './earChart';

describe('ear answer chart (ft_1_10.AC7)', () => {
  it('draws one whole note per note, in order, one bar each', () => {
    const chart = earAnswerChart([60, 67]);
    expect(chart.notes.map((n) => n.midi)).toEqual([60, 67]);
    expect(chart.notes.map((n) => n.bar)).toEqual([0, 1]);
    expect(chart.bars).toHaveLength(2);
    expect(chart.phrases[0]).toEqual({ name: 'note', startBar: 0, endBar: 1 });
  });

  it('uses the treble clef from middle C up and the bass clef below it', () => {
    expect(earAnswerChart([60]).tracks[0]!.clef).toBe('treble');
    expect(earAnswerChart([59]).tracks[0]!.clef).toBe('bass');
  });

  it('rejects an empty question', () => {
    expect(() => earAnswerChart([])).toThrow(RangeError);
  });
});
