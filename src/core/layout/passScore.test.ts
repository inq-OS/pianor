import { describe, expect, it } from 'vitest';
import { passScorePlace } from './passScore';

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
});
