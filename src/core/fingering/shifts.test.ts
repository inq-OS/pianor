// Covers ft_1_30.AC9 (where the hand moves along the keyboard, from the fingering).
import { describe, expect, it } from 'vitest';
import { chartWith } from '../../../tests/helpers/charts';
import type { Chart } from '../chart';
import { handShiftMap, handShifts } from './shifts';

/** One track of quarter notes; `fingers` are written where given. */
function chartOf(midis: number[], hand: 'RH' | 'LH' = 'RH', fingers: (number | undefined)[] = []): Chart {
  const chart = chartWith(midis.map((midi, i) => ({ tick: i * 480, dur: 480, midi, track: hand === 'RH' ? 'rh' : 'lh' })));
  return { ...chart, notes: chart.notes.map((n, i) => (fingers[i] ? { ...n, finger: fingers[i] } : n)) };
}

describe('hand shifts (ft_1_30.AC9)', () => {
  it('a piece in one hand position has none', () => {
    expect(handShifts(chartOf([60, 62, 64, 65, 67, 65, 64, 62]))).toEqual([]);
  });

  it('the thumb turning under in the C major scale moves the hand up at F, and back down at E', () => {
    const shifts = handShifts(chartOf([60, 62, 64, 65, 67, 69, 71, 72, 71, 69, 67, 65, 64, 62, 60, 60]));
    expect(shifts[0]).toEqual({ note: 3, direction: 'up', keys: 3 });
    expect(shifts.at(-1)!.direction).toBe('down');
  });

  it('the left hand mirrors: going down the keyboard is down', () => {
    const shifts = handShifts(chartOf([60, 59, 57, 55, 53, 52, 50, 48], 'LH'));
    expect(shifts).toEqual([{ note: 3, direction: 'down', keys: 3 }]);
  });

  it('follows the fingers the author wrote', () => {
    // 1 on C, then 1 on G: the hand jumps up four keys
    const shifts = handShifts(chartOf([60, 67, 69, 71], 'RH', [1, 1]));
    expect(shifts[0]).toEqual({ note: 1, direction: 'up', keys: 4 });
  });

  it('prefers the level\u2019s hand position, so a tune that leaves it moves the hand once and comes back', () => {
    // Twinkle's first bars, C C G G A A G F F E E D D C, in the C position (C4 1 to G4 5)
    const tune = chartOf([60, 60, 67, 67, 69, 69, 67, 65, 65, 64, 64, 62, 62, 60]);
    const level = { fingerings: { RH: { C4: 1, D4: 2, E4: 3, F4: 4, G4: 5 } } };
    const shifts = handShifts(tune, level);
    expect(shifts.map((s) => s.direction)).toEqual(['up', 'down']);
    expect(handShiftMap(tune, level)).toEqual(new Map(shifts.map((s) => [s.note, s.direction])));
  });
});
