// Covers core_08.AC10.
import { describe, expect, it } from 'vitest';
import { chartWith } from '../../../tests/helpers/charts';
import { PPQ } from '../chart/time';
import { difficultyOf } from '../piece/difficulty';
import { heatColour } from './analyzeLayout';
import { difficultyMarks } from './difficultyMarks';

const Q = PPQ;
// bar 1 four quarters, bar 2 fast jumping eighths (the hardest), bar 3 empty, bar 4 one whole note
const chart = chartWith([
  ...[60, 62, 64, 62].map((midi, i) => ({ tick: i * Q, dur: Q, midi })),
  ...[60, 67, 61, 72, 60, 67, 61, 72].map((midi, i) => ({ tick: 4 * Q + (i * Q) / 2, dur: Q / 2, midi })),
  { tick: 12 * Q, dur: 4 * Q, midi: 60 },
]);
const piece = difficultyOf(chart);

describe('difficultyMarks', () => {
  it('colours every bar by its heat, the hardest the hottest, and leaves an empty bar plain', () => {
    const marks = difficultyMarks(piece, [], true)!;
    expect(marks.fills!.get(1)).toBe(heatColour(1));
    expect(marks.fills!.has(0)).toBe(true);
    expect(marks.fills!.has(2)).toBe(false);
    expect(marks.tint).toEqual([]);
  });

  it('tints the chosen passage and numbers its ranges in play order', () => {
    const marks = difficultyMarks(piece, [{ first: 2, last: 3 }, { first: 0, last: 0 }], true)!;
    expect(marks.tint).toEqual([2, 3, 0]);
    expect(marks.letters).toEqual([{ bar: 2, text: '1' }, { bar: 0, text: '2' }]);
  });

  it('with heat off marks only the passage, and nothing when there is none', () => {
    expect(difficultyMarks(piece, [{ first: 1, last: 1 }], false)).toEqual({ tint: [1], letters: [{ bar: 1, text: '1' }] });
    expect(difficultyMarks(piece, [], false)).toBeNull();
    expect(difficultyMarks(null, [], true)).toBeNull();
  });
});
