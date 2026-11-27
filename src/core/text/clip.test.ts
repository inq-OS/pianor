// Covers d088 (a long player name on the toolbar).
import { describe, expect, it } from 'vitest';
import { clipToWidth, wholeOrInitial } from './clip';

/** Every letter 5 art pixels wide with a 1-pixel gap, the dot 1 wide: like the pixel font's capitals. */
const measure = (text: string) => Math.max(0, Array.from(text).reduce((w, ch) => w + (ch === '.' ? 1 : 5) + 1, 0) - 1);

describe('clipToWidth', () => {
  it('leaves a text that fits as it is', () => {
    expect(clipToWidth('TUVI', 23, measure)).toBe('TUVI');
  });

  it('cuts a text that is too wide and ends it with a dot, so it is still no wider than the room', () => {
    const name = 'A'.repeat(40);
    const clipped = clipToWidth(name, 72, measure);
    expect(clipped.endsWith('.')).toBe(true);
    expect(measure(clipped)).toBeLessThanOrEqual(72);
    expect(measure(clipToWidth(name, 72, measure).slice(0, -1) + 'A.')).toBeGreaterThan(72); // as many letters as fit
  });

  it('cuts at whole letters, never in the middle of one written with two code units', () => {
    expect(clipToWidth('😀😀😀😀😀', 13, measure)).toBe('😀😀.');
  });

  it('puts the dot on the last letter, never after a space', () => {
    const cut = clipToWidth('AB CDEF', measure('AB C.') - 1, measure);
    expect(cut).toBe('AB.');
  });

  it('gives an empty text when not even one letter and the dot fit', () => {
    expect(clipToWidth('TUVI', 3, measure)).toBe('');
  });
});

describe('wholeOrInitial', () => {
  it('ft_1_20.AC13 a name that fits is written whole; a longer one is its first letter, never a name cut short', () => {
    expect(wholeOrInitial('TUVI', 36, measure)).toBe('TUVI');
    expect(wholeOrInitial('KRISTJAN', 36, measure)).toBe('K');
    expect(wholeOrInitial('ÕIEKE', measure('ÕIEK'), measure)).toBe('Õ');
    expect(wholeOrInitial('KIUR', 3, measure)).toBe('');
  });
});
