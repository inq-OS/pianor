// Covers core_13.AC5.
import { describe, expect, it } from 'vitest';
import { PACE_MARKS, paceMark, paceOff } from './beat';

describe('paceMark', () => {
  it('core_13.AC5 a gap as long as the pace asks is even; one shorter is early, longer late, and past the far margin far', () => {
    expect(paceMark(0)).toEqual({ side: 'even', far: false });
    expect(paceMark(-PACE_MARKS.near / 2)).toEqual({ side: 'even', far: false });
    expect(paceMark(-0.3)).toEqual({ side: 'early', far: false });
    expect(paceMark(0.3)).toEqual({ side: 'late', far: false });
    expect(paceMark(-0.6)).toEqual({ side: 'early', far: true });
    expect(paceMark(0.9)).toEqual({ side: 'late', far: true });
  });

  it('core_13.AC5 measures a gap against the written gap at the pace', () => {
    // a written half second at half the written tempo asks a second: 1300 ms is 30% late
    expect(paceOff(500, 1300, 2)).toBeCloseTo(0.3);
    expect(paceOff(500, 700, 2)).toBeCloseTo(-0.3);
  });
});
