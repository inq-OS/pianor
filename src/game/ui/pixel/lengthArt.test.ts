import { describe, expect, it } from 'vitest';
import { inkCount, type Bitmap } from './bitmap';
import { ACCIDENTAL_ICONS, NOTE_ICONS, REST_ICONS, signatureIcon } from './lengthArt';

const same = (a: Bitmap, b: Bitmap) => a.width === b.width && a.height === b.height && a.pixels.every((p, i) => p === b.pixels[i]);

describe('piece maker length pictures', () => {
  it.each([...Object.entries(NOTE_ICONS).map(([k, v]) => [`${k} note`, v] as const), ...Object.entries(REST_ICONS).map(([k, v]) => [`${k} rest`, v] as const)])(
    'the %s fits inside a 14 pixel bar button with its frame', (_id, icon) => {
      expect(icon.height).toBeLessThanOrEqual(10);
      expect(icon.width).toBeLessThanOrEqual(12);
      expect(inkCount(icon)).toBeGreaterThan(8);
    },
  );

  it('no two lengths look alike, as notes or as rests', () => {
    for (const set of [NOTE_ICONS, REST_ICONS]) {
      const all = Object.values(set);
      for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) expect(same(all[i]!, all[j]!)).toBe(false);
    }
  });

  it('draws each key signature with as many accidentals as it has, inside the button, and no key as nothing', () => {
    expect(inkCount(signatureIcon(0))).toBe(0);
    for (let f = -7; f <= 7; f++) {
      const icon = signatureIcon(f);
      expect(icon.height).toBeLessThanOrEqual(10);
      if (f !== 0) expect(icon.width).toBe(Math.abs(f) * 5 - 1);
    }
    expect(same(signatureIcon(2), signatureIcon(-2))).toBe(false);
  });

  it('the sharp, flat and natural tools are three different signs that fit a bar button', () => {
    const all = Object.values(ACCIDENTAL_ICONS);
    for (const icon of all) expect(icon.height).toBeLessThanOrEqual(10);
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) expect(same(all[i]!, all[j]!)).toBe(false);
  });
});
