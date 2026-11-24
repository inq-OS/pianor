import { describe, expect, it } from 'vitest';
import { UI_SHEETS, uiSheet, type UiSheet } from './stripSheet';

describe('the bubble\'s, the strip\'s and the backpack\'s sheet', () => {
  it.each(Object.keys(UI_SHEETS))('the %s sheet is the smallest screen on the fine grid, so a zoom of 3 is 1920 x 1080', (name) => {
    const sheet = uiSheet(name as UiSheet);
    expect(sheet.width).toBe(640);
    expect(sheet.height).toBe(360);
    expect(sheet.pixels.some((p) => p !== 0)).toBe(true);
    expect(sheet.pixels.every((p) => p < sheet.palette.length)).toBe(true);
  });
});
