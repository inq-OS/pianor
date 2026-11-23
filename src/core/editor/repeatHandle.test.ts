// Covers ft_1_02d.AC24.
import { describe, expect, it } from 'vitest';
import type { StaffLayout } from '../layout/staff';
import { onRepeatHandle, repeatCopies, repeatHandleBox } from './repeatHandle';

// four bars of 100 on the first line, two on the second, both on page 0; one staff a line
const layout = {
  staffSpace: 10,
  bars: [
    { system: 0, x: 0, width: 100 },
    { system: 0, x: 100, width: 100 },
    { system: 0, x: 200, width: 100 },
    { system: 0, x: 300, width: 100 },
    { system: 1, x: 0, width: 100 },
    { system: 1, x: 100, width: 100 },
  ],
  systems: [
    { page: 0, staves: [{ trackId: 'rh', topLineY: 50, bottomLineY: 90 }] },
    { page: 0, staves: [{ trackId: 'rh', topLineY: 250, bottomLineY: 290 }] },
  ],
} as unknown as StaffLayout;

describe('the drag-repeat handle', () => {
  it('ft_1_02d.AC24 sits at the right edge of the selection\'s last bar, on the page that shows it', () => {
    const box = repeatHandleBox(layout, { from: 0, to: 1 }, 0)!;
    expect(box.x1).toBeLessThan(200);
    expect(box.x2).toBeGreaterThan(200);
    expect(box.y1).toBeGreaterThanOrEqual(40);
    expect(box.y2).toBeLessThanOrEqual(100);
    expect(onRepeatHandle(layout, { from: 0, to: 1 }, 0, { x: 200, y: (box.y1 + box.y2) / 2 })).toBe(true);
    expect(onRepeatHandle(layout, { from: 0, to: 1 }, 0, { x: 150, y: 70 })).toBe(false);
    expect(repeatHandleBox(layout, { from: 0, to: 1 }, 1)).toBeNull();
  });

  it('ft_1_02d.AC24 counts the copies in whole selection lengths as it is dragged right, over lines too', () => {
    const one = { from: 0, to: 0 };
    expect(repeatCopies(layout, one, 0, { x: 150, y: 70 })).toBe(1); // into bar 2
    expect(repeatCopies(layout, one, 0, { x: 350, y: 70 })).toBe(3); // into bar 4
    expect(repeatCopies(layout, one, 0, { x: 50, y: 270 })).toBe(4); // bar 5, on the next line
    const two = { from: 0, to: 1 };
    expect(repeatCopies(layout, two, 0, { x: 250, y: 70 })).toBe(1); // half a length: one copy
    expect(repeatCopies(layout, two, 0, { x: 350, y: 70 })).toBe(1);
    expect(repeatCopies(layout, two, 0, { x: 50, y: 270 })).toBe(2);
  });

  it('ft_1_02d.AC24 goes on past the piece\'s last bar by that bar\'s width', () => {
    expect(repeatCopies(layout, { from: 5, to: 5 }, 0, { x: 450, y: 270 })).toBe(3);
    expect(repeatCopies(layout, { from: 0, to: 0 }, 0, { x: 450, y: 70 })).toBe(3); // past the first line's end: its last bar
  });

  it('ft_1_02d.AC24 is no copy when dragged back onto the selection or off the staff', () => {
    expect(repeatCopies(layout, { from: 1, to: 2 }, 0, { x: 150, y: 70 })).toBe(0);
    expect(repeatCopies(layout, { from: 1, to: 2 }, 0, { x: 50, y: 70 })).toBe(0);
    expect(repeatCopies(layout, { from: 1, to: 2 }, 0, { x: 350, y: 500 })).toBe(0);
  });
});
