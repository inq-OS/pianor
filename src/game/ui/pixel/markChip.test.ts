import { describe, expect, it } from 'vitest';
import { markChipBitmap, markTipBitmap } from './markChip';
import { measure } from './font';
import { C } from './palette';

describe('markChipBitmap (d312)', () => {
  it('draws the marks twice the font on a plate, the ✓ dark green and the ✗ red', () => {
    const chip = markChipBitmap('E✓ F✗ ½▲');
    expect(chip.width).toBe(measure('E✓ F✗ ½▲') * 2 + 6);
    const colours = new Set(chip.pixels);
    expect(colours.has(C.leafDark) && colours.has(C.red) && colours.has(C.ink)).toBe(true);
  });

  it('draws a tip in ink at the font size on the same plate', () => {
    const tip = markTipBitmap('8: the same letter');
    expect(tip.height).toBeLessThan(markChipBitmap('8').height);
    expect(new Set(tip.pixels).has(C.ink)).toBe(true);
  });
});
