import { describe, expect, it } from 'vitest';
import { C, PALETTE } from '../palette';
import { currentLook, paletteFor } from './skyLooks';

/** The sky's slots: sky, cloud, moon and halo. */
const SKY_SLOTS_FIRST = C.skyDeep;
const SKY_SLOTS_LAST = C.haloLight;

const relative = (rgb: number): number => {
  const lin = (v: number): number => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin((rgb >> 16) & 255) + 0.7152 * lin((rgb >> 8) & 255) + 0.0722 * lin(rgb & 255);
};
const contrast = (a: number, b: number): number => {
  const [hi, lo] = [relative(a), relative(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
};

describe('paletteFor (ft_1_14.AC4)', () => {
  it('gives the base palette at night', () => {
    expect([...paletteFor('night')]).toEqual([...PALETTE]);
  });

  it('changes only the sky, cloud, moon and halo slots in dawn, day and dusk', () => {
    for (const phase of ['dawn', 'day', 'dusk'] as const) {
      const palette = paletteFor(phase);
      expect(palette.length).toBe(PALETTE.length);
      PALETTE.forEach((rgb, index) => {
        const inTrailSlots = index >= SKY_SLOTS_FIRST && index <= SKY_SLOTS_LAST;
        if (!inTrailSlots) expect(palette[index], `${phase} slot ${index}`).toBe(rgb);
      });
      expect(palette[C.skyDeep]).not.toBe(PALETTE[C.skyDeep]);
    }
  });

  it('keeps the sky slots in order from dark to light in each phase (the sky band from the top down)', () => {
    for (const phase of ['dawn', 'day', 'dusk'] as const) {
      const palette = paletteFor(phase);
      const sky = [C.skyDeep, C.skyDark, C.sky, C.skyLight].map((i) => relative(palette[i]!));
      for (let i = 1; i < sky.length; i++) expect(sky[i]!, `${phase} sky ${i}`).toBeGreaterThan(sky[i - 1]!);
    }
  });
});

describe('stars by phase (ft_1_14 scope item 5)', () => {
  // ft_1_14.AC5
  it('keeps the stars readable on the lightest sky band of dawn and dusk (AC5, contrast of 1.5 or more)', () => {
    for (const phase of ['dawn', 'dusk'] as const) {
      const palette = paletteFor(phase);
      expect(contrast(palette[C.cloudPale]!, palette[C.skyLight]!), `${phase} star`).toBeGreaterThanOrEqual(1.5);
    }
  });
});

describe('currentLook (ft_1_14 AC6)', () => {
  it('uses the forced phase when given, else the phase at the instant', () => {
    expect(currentLook(Date.UTC(1998, 10, 1, 13, 0), 'dusk').phase).toBe('dusk');
    expect(currentLook(Date.UTC(1998, 10, 1, 13, 0)).phase).toBe('day');
  });
});
