import { describe, expect, it } from 'vitest';
import { dropMenuLayout, type DropMenuSpec } from './dropMenu';
import { rectBottom, rectRight, type Rect } from './rect';

const bounds: Rect = { x: 0, y: -20, w: 384, h: 236 };
const spec = (over: Partial<DropMenuSpec> = {}): DropMenuSpec => ({ anchor: { x: 100, y: 16, w: 40, h: 14 }, cell: { w: 20, h: 14 }, count: 3, columns: 3, gap: 2, pad: 3, bounds, ...over });
const inside = (inner: Rect, outer: Rect) => inner.x >= outer.x && inner.y >= outer.y && rectRight(inner) <= rectRight(outer) && rectBottom(inner) <= rectBottom(outer);
const overlap = (a: Rect, b: Rect) => a.x < rectRight(b) && b.x < rectRight(a) && a.y < rectBottom(b) && b.y < rectBottom(a);

describe('dropMenuLayout', () => {
  it('opens under its button, from the button\'s left edge, with the cells in a padded grid', () => {
    const m = dropMenuLayout(spec());
    expect(m.panel).toEqual({ x: 100, y: 31, w: 3 * 20 + 2 * 2 + 2 * 3, h: 14 + 2 * 3 });
    expect(m.cells).toEqual([
      { x: 103, y: 34, w: 20, h: 14 },
      { x: 125, y: 34, w: 20, h: 14 },
      { x: 147, y: 34, w: 20, h: 14 },
    ]);
  });

  it('fills rows left to right and wraps after `columns` cells', () => {
    const m = dropMenuLayout(spec({ count: 15, columns: 8, cell: { w: 40, h: 14 } }));
    expect(m.cells).toHaveLength(15);
    expect(m.cells[8]!.x).toBe(m.cells[0]!.x);
    expect(m.cells[8]!.y).toBe(m.cells[0]!.y + 16);
    expect(m.panel.h).toBe(2 * 14 + 2 + 2 * 3);
  });

  it('moves left to stay on the screen, and opens above its button when there is no room below', () => {
    const right = dropMenuLayout(spec({ anchor: { x: 360, y: 16, w: 20, h: 14 }, count: 8, columns: 8, cell: { w: 40, h: 14 } }));
    expect(rectRight(right.panel)).toBe(rectRight(bounds));
    const low = dropMenuLayout(spec({ anchor: { x: 100, y: 200, w: 20, h: 14 } }));
    expect(rectBottom(low.panel)).toBe(200 - 1);
  });

  it('ft_1_20.AC8 a menu from the band opens above its button (the pointer moves there anyway), and under it when there is no room above', () => {
    const up = dropMenuLayout(spec({ anchor: { x: 100, y: 150, w: 40, h: 14 }, open: 'above' }));
    expect(rectBottom(up.panel)).toBe(150 - 1);
    expect(up.cells[0]!.y).toBe(150 - 1 - up.panel.h + 3);
    const top = dropMenuLayout(spec({ anchor: { x: 100, y: -20, w: 40, h: 14 }, open: 'above' }));
    expect(top.panel.y).toBe(-20 + 14 + 1);
  });

  it('property: every cell is inside the panel, the panel is on the screen and never covers its button', () => {
    for (let ax = 0; ax <= 364; ax += 13) {
      for (let ay = -18; ay <= 200; ay += 17) {
        for (const [count, columns] of [[3, 3], [15, 8], [5, 2]] as const) {
          const anchor = { x: ax, y: ay, w: 20, h: 14 };
          const m = dropMenuLayout(spec({ anchor, count, columns }));
          expect(inside(m.panel, bounds)).toBe(true);
          expect(overlap(m.panel, anchor)).toBe(false);
          for (const cell of m.cells) expect(inside(cell, m.panel)).toBe(true);
        }
      }
    }
  });
});
