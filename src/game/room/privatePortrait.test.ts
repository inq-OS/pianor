import { describe, expect, it } from 'vitest';
import { C } from '../ui/pixel/palette';
import { PORTRAIT_MAX } from '../../core/layout/room';
import { privatePortrait } from './privatePortrait';

const picture = (w: number, h: number, letter = 'a') => ({ schemaVersion: 1, legend: { a: 'gold', b: 'ink' }, rows: Array<string>(h).fill(letter.repeat(w)) });

describe('the private room portrait (ft_1_08.AC10)', () => {
  it('ft_1_08.AC10 reads a picture of rows and a legend of palette names', () => {
    const bitmap = privatePortrait(picture(40, 50))!;
    expect([bitmap.width, bitmap.height]).toEqual([40, 50]);
    expect(bitmap.pixels.every((p) => p === C.gold)).toBe(true);
    expect(privatePortrait(picture(PORTRAIT_MAX.w, PORTRAIT_MAX.h))).not.toBeNull();
  });

  it('ft_1_08.AC10 no file, or a file that is not a sound picture, gives no portrait', () => {
    expect(privatePortrait(null)).toBeNull();
    expect(privatePortrait('portrait')).toBeNull();
    expect(privatePortrait({ rows: ['aa'] })).toBeNull();
    expect(privatePortrait({ legend: { a: 'gold' }, rows: 'aaaa' })).toBeNull();
    // too small, too large, ragged rows, a colour the palette does not have, a letter the legend does not have
    expect(privatePortrait(picture(8, 50))).toBeNull();
    expect(privatePortrait(picture(40, 8))).toBeNull();
    expect(privatePortrait(picture(PORTRAIT_MAX.w + 1, 50))).toBeNull();
    expect(privatePortrait(picture(40, PORTRAIT_MAX.h + 1))).toBeNull();
    expect(privatePortrait({ legend: { a: 'gold' }, rows: [...Array<string>(19).fill('a'.repeat(20)), 'a'.repeat(19)] })).toBeNull();
    expect(privatePortrait({ legend: { a: 'mauve' }, rows: Array<string>(20).fill('a'.repeat(20)) })).toBeNull();
    expect(privatePortrait({ legend: { ab: 'gold' }, rows: Array<string>(20).fill('a'.repeat(20)) })).toBeNull();
    expect(privatePortrait(picture(40, 50, 'z'))).toBeNull();
    expect(privatePortrait({ legend: { a: 'gold' }, rows: [5, ...Array<string>(19).fill('a'.repeat(20))] })).toBeNull();
  });
});
