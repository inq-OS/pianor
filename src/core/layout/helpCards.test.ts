// Covers ft_1_33.AC2 (where the F1 help puts its cards).
import { describe, expect, it } from 'vitest';
import { helpCardSize, helpGridLayout, type HelpParts } from './helpCards';
import type { Rect } from './rect';

const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inside = (r: Rect, p: Rect) => r.x >= p.x && r.y >= p.y && r.x + r.w <= p.x + p.w && r.y + r.h <= p.y + p.h;

const parts = (cap = 22): HelpParts => ({ cap: { w: cap, h: 11 }, mouse: { w: 19, h: 18 }, sketch: { w: 32, h: 21 }, arrow: { w: 7, h: 5 } });

describe('the F1 help cards (ft_1_33.AC2)', () => {
  it.each([['English caps', parts()], ['wider caps', parts(30)]])('ft_1_33.AC2 %s: eight cards in two columns and the Keys button fit the panel and do not overlap', (_n, p) => {
    const panel = { x: 0, y: 14, w: 320, h: 140 };
    const plan = helpGridLayout({ panel, count: 8, columns: 2, parts: p, keys: { w: 44, h: 14 } });
    expect(plan.height).toBeLessThanOrEqual(panel.h);
    const room = { ...panel, h: plan.height };
    const boxes = [...plan.cards.map((c) => c.box), plan.keys];
    for (const b of boxes) expect(inside(b, room)).toBe(true);
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(overlap(boxes[i]!, boxes[j]!)).toBe(false);
  });

  it('ft_1_33.AC2 inside a card the parts go left to right without overlapping, and every mouse stands in one column per grid column', () => {
    const p = parts();
    const plan = helpGridLayout({ panel: { x: 0, y: 0, w: 320, h: 140 }, count: 8, columns: 2, parts: p, keys: { w: 44, h: 14 } });
    for (const c of plan.cards) {
      expect(c.capRight).toBeLessThan(c.mouse.x);
      expect(c.mouse.x + p.mouse.w).toBeLessThan(c.before.x);
      expect(c.before.x + p.sketch.w).toBeLessThan(c.arrow.x);
      expect(c.arrow.x + p.arrow.w).toBeLessThan(c.after.x);
      expect(c.after.x + p.sketch.w).toBe(c.box.x + helpCardSize(p).w);
    }
    expect(new Set(plan.cards.filter((_, i) => i % 2 === 0).map((c) => c.mouse.x)).size).toBe(1);
  });
});
