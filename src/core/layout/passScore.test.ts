import { describe, expect, it } from 'vitest';
import { passNumbersPlace, passScorePlace } from './passScore';

const layout = (finalX: number, width = 600) => ({
  staffSpace: 12,
  width,
  barlines: [
    { system: 0, x: 20, y1: 40, y2: 80, kind: 'start' as const },
    { system: 0, x: 300, y1: 40, y2: 80, kind: 'single' as const },
    { system: 1, x: finalX, y1: 140, y2: 180, kind: 'final' as const },
  ],
});

describe('passScorePlace (ft_1_12.AC3)', () => {
  it('puts the score right after the final bar line, centred on its height', () => {
    expect(passScorePlace(layout(400), { w: 20, h: 40 })).toEqual({ x: 403, y: 140, w: 20, h: 40, system: 1 });
  });

  it('pulls the score in when the line runs to the edge, so it stays on the layout', () => {
    expect(passScorePlace(layout(590), { w: 20, h: 40 }).x).toBe(580);
  });

  it('never goes above the top of the layout or left of it', () => {
    const tight = { staffSpace: 10, width: 60, barlines: [{ system: 0, x: 58, y1: 5, y2: 45, kind: 'final' as const }] };
    const place = passScorePlace(tight, { w: 100, h: 80 });
    expect(place.x).toBe(0);
    expect(place.y).toBe(0);
  });

  it('uses the last bar line when the piece has no final one (a section)', () => {
    const noFinal = { staffSpace: 12, width: 600, barlines: [{ system: 0, x: 200, y1: 40, y2: 80, kind: 'single' as const }] };
    expect(passScorePlace(noFinal, { w: 20, h: 40 })).toMatchObject({ x: 203, system: 0 });
  });

  it('d312 the pass numbers stand in a row under the staff, ending at its final bar line, never over its lines', () => {
    const stars = passScorePlace(layout(560), { w: 30, h: 40 });
    const numbers = passNumbersPlace(layout(560), stars, { w: 80, h: 14 });
    expect(numbers.x + numbers.w).toBe(560);
    expect(numbers.y).toBeGreaterThan(180);
    expect(numbers.system).toBe(1);
  });
});
