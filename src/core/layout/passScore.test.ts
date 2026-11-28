import { describe, expect, it } from 'vitest';
import { passScorePlace, rowUnderSystem } from './passScore';

const layout = (finalX: number, width = 600, height = 260) => ({
  staffSpace: 12,
  width,
  height,
  notes: [] as { system: number; y: number; headRy: number; stem: { y1: number; y2: number } | null }[],
  barlines: [
    { system: 0, x: 20, y1: 40, y2: 80, kind: 'start' as const },
    { system: 0, x: 300, y1: 40, y2: 80, kind: 'single' as const },
    { system: 1, x: finalX, y1: 140, y2: 180, kind: 'final' as const },
  ],
});

describe('passScorePlace (ft_1_12.AC3)', () => {
  it('d312 puts the score in a row under the last bar, ending at the final bar line, clear of the staff lines', () => {
    expect(passScorePlace(layout(400), { w: 120, h: 16 })).toEqual({ x: 280, y: 184, w: 120, h: 16, system: 1 });
  });

  it('pulls the row in to stay on the layout, sideways and at the foot', () => {
    expect(passScorePlace(layout(700), { w: 120, h: 16 }).x).toBe(480);
    expect(passScorePlace(layout(400, 600, 190), { w: 120, h: 16 }).y).toBe(174);
  });

  it('never goes above the top of the layout or left of it', () => {
    const tight = { staffSpace: 10, width: 60, height: 50, notes: [], barlines: [{ system: 0, x: 58, y1: 5, y2: 45, kind: 'final' as const }] };
    const place = passScorePlace(tight, { w: 100, h: 80 });
    expect(place.x).toBe(0);
    expect(place.y).toBe(0);
  });

  it('uses the last bar line when the piece has no final one (a section)', () => {
    const noFinal = { staffSpace: 12, width: 600, height: 260, notes: [], barlines: [{ system: 0, x: 200, y1: 40, y2: 80, kind: 'single' as const }] };
    expect(passScorePlace(noFinal, { w: 20, h: 16 })).toMatchObject({ x: 180, system: 0 });
  });

  it('d312 the row goes under the lowest note of the line too, its head and its stem, never over it', () => {
    const low = { ...layout(400), notes: [{ system: 1, y: 190, headRy: 5, stem: null }, { system: 1, y: 170, headRy: 5, stem: { y1: 170, y2: 200 } }] };
    expect(passScorePlace(low, { w: 120, h: 16 }).y).toBe(204);
    // a line other than the last: its own last bar line
    expect(rowUnderSystem(layout(400), 0, { w: 100, h: 16 })).toEqual({ x: 200, y: 84, w: 100, h: 16, system: 0 });
  });
});
