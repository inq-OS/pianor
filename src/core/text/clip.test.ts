// Covers d088 (a long player name on the toolbar).
import { describe, expect, it } from 'vitest';
import { CUT_MARK, clipToWidth, wholeIfCut } from './clip';

/** Every letter and the ellipsis 5 art pixels wide with a 1-pixel gap: like the pixel font's capitals. */
const measure = (text: string) => Math.max(0, Array.from(text).reduce((w) => w + 5 + 1, 0) - 1);

describe('clipToWidth', () => {
  it('leaves a text that fits as it is', () => {
    expect(clipToWidth('TUVI', 23, measure)).toBe('TUVI');
  });

  it('cuts a text that is too wide and ends it with an ellipsis, never a full stop that reads as a whole title, still no wider than the room', () => {
    const name = 'A'.repeat(40);
    const clipped = clipToWidth(name, 72, measure);
    expect(clipped.endsWith(CUT_MARK)).toBe(true);
    expect(CUT_MARK).toBe('…');
    expect(measure(clipped)).toBeLessThanOrEqual(72);
    expect(measure(clipToWidth(name, 72, measure).slice(0, -1) + `A${CUT_MARK}`)).toBeGreaterThan(72); // as many letters as fit
  });

  it('cuts at whole letters, never in the middle of one written with two code units', () => {
    expect(clipToWidth('😀😀😀😀😀', 17, measure)).toBe('😀😀…');
  });

  it('puts the ellipsis on the last letter, never after a space', () => {
    const cut = clipToWidth('AB CDEF', measure('AB C…') - 1, measure);
    expect(cut).toBe('AB…');
  });

  it('gives an empty text when not even one letter and the ellipsis fit', () => {
    expect(clipToWidth('TUVI', 3, measure)).toBe('');
  });

  it('gives a cut text its whole words as a tooltip, and a whole one none', () => {
    expect(wholeIfCut('Twinkle Twinkle Littl…', 'Twinkle Twinkle Little Star')).toEqual({ tooltip: 'Twinkle Twinkle Little Star' });
    expect(wholeIfCut('Little Steps', 'Little Steps')).toEqual({});
  });
});
