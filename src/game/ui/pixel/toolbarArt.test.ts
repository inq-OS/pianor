import { describe, expect, it } from 'vitest';
import { C } from './palette';
import { VINE_ART_ROWS, separatorBitmap } from './toolbarArt';

describe('the vine under the toolbar (d088)', () => {
  it('runs one vine stalk from edge to edge, inside its rows', () => {
    const b = separatorBitmap(384);
    expect(b.height).toBe(VINE_ART_ROWS);
    for (const x of [0, 100, 383]) {
      const column = Array.from({ length: b.height }, (_, y) => b.pixels[y * b.width + x]);
      expect(column.some((p) => p === C.leafDark || p === C.leaf)).toBe(true);
    }
  });
});
