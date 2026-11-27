import { describe, expect, it } from 'vitest';
import { STAND_PICTURE, WORDED_GAP, standPanel } from './standPanel';
import type { Rect } from './rect';

const inside = (inner: Rect, outer: Rect) => inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;
const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe("the stand's panel of pictures (ft_1_08.AC11)", () => {
  const picture: Rect = { x: 0, y: 12, w: 320, h: 124 };

  it('ft_1_08.AC11 holds one cell per choice, each as big as a picture with room for its frame, in one row over the middle of the room', () => {
    const { panel, cells } = standPanel(picture, 2);
    expect(cells).toHaveLength(2);
    for (const cell of cells) {
      expect(cell.w).toBeGreaterThanOrEqual(STAND_PICTURE.w);
      expect(cell.h).toBeGreaterThanOrEqual(STAND_PICTURE.h);
      expect(inside(cell, panel)).toBe(true);
    }
    expect(overlap(cells[0]!, cells[1]!)).toBe(false);
    expect(cells[0]!.y).toBe(cells[1]!.y);
    expect(inside(panel, picture)).toBe(true);
    // centred on the picture, so the room shows round it on every side
    expect(Math.abs(panel.x + panel.w / 2 - (picture.x + picture.w / 2))).toBeLessThanOrEqual(1);
    expect(Math.abs(panel.y + panel.h / 2 - (picture.y + picture.h / 2))).toBeLessThanOrEqual(1);
  });

  it('ft_1_08.AC11 a longer list wraps into rows that stay on the picture, so a new minigame is only one more entry', () => {
    const { panel, cells } = standPanel(picture, 9);
    expect(cells).toHaveLength(9);
    expect(new Set(cells.map((c) => c.y)).size).toBeGreaterThan(1);
    for (const cell of cells) expect(inside(cell, panel)).toBe(true);
    for (let i = 0; i < cells.length; i++) for (let j = i + 1; j < cells.length; j++) expect(overlap(cells[i]!, cells[j]!)).toBe(false);
    expect(inside(panel, picture)).toBe(true);
  });

  it('ft_1_08.AC11 the cells lie on whole layout pixels, so the pictures keep their pixels', () => {
    for (const n of [1, 2, 3, 5]) {
      const { panel, cells } = standPanel({ x: 3, y: 9, w: 301, h: 117 }, n);
      for (const r of [panel, ...cells]) for (const v of [r.x, r.y, r.w, r.h]) expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('a board whose pictures have their words under them keeps a wider gap, so two words never read as one phrase', () => {
    const room = { x: 0, y: 0, w: 320, h: 150 };
    const [a, b] = standPanel(room, 2, WORDED_GAP).cells;
    expect(b!.x - (a!.x + a!.w)).toBe(WORDED_GAP);
    expect(WORDED_GAP).toBeGreaterThanOrEqual(20);
  });
});
