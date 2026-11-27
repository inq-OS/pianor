// Covers ft_1_02d.AC54: where the piece maker's message stands, in the strip at the foot and never over the staff.
import { describe, expect, it } from 'vitest';
import { stripMessageBox } from './stripMessage';

const free = { left: 187, right: 320, top: 163, rows: 17 };
const box = (textWidth: number, lineHeight = 11) => stripMessageBox({ textWidth, lineHeight, linesAt: (w) => Math.ceil(textWidth / w), free, width: 320 });

describe('the message in the strip (ft_1_02d.AC54)', () => {
  it('ft_1_02d.AC54 a short message stands in the empty right side of the strip, inside it, on one line', () => {
    const b = box(80);
    expect(b.x).toBeGreaterThanOrEqual(free.left);
    expect(b.x + b.w).toBeLessThanOrEqual(free.right);
    expect(b.y).toBeGreaterThanOrEqual(free.top);
    expect(b.y + b.h).toBeLessThanOrEqual(free.top + free.rows);
    expect(b.textWidth).toBeGreaterThanOrEqual(80);
  });

  it('ft_1_02d.AC54 a longer one grows to the left along the strip, still one line inside it, never above it', () => {
    const b = box(250);
    expect(b.x).toBeLessThan(free.left);
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.w).toBeLessThanOrEqual(free.right);
    expect(b.y).toBeGreaterThanOrEqual(free.top);
    expect(b.y + b.h).toBeLessThanOrEqual(free.top + free.rows);
  });

  it('ft_1_02d.AC54 one too long for the strip wraps at its width and rises from the strip only as far as it must', () => {
    const b = box(500);
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.w).toBeLessThanOrEqual(320);
    expect(b.y + b.h).toBeLessThanOrEqual(free.top + free.rows);
    expect(b.textWidth).toBeLessThan(500);
  });
});
