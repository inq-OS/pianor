import { describe, expect, it } from 'vitest';
import { inkCount } from './bitmap';
import { ICONS, NEW_PIECE_HEIGHT, newPieceArt } from './iconArt';

describe('button icons (ft_1_08)', () => {
  it.each(Object.entries(ICONS))('ft_1_08.AC4 the %s icon fits inside an 18 pixel button with its frame', (_id, icon) => {
    expect(icon.height).toBeLessThanOrEqual(14);
    expect(icon.width).toBeLessThanOrEqual(17);
    expect(inkCount(icon)).toBeGreaterThan(20);
  });
});

describe('the New piece card', () => {
  it.each([60, 97, 140])('is an empty staff with a pencil as wide as a %i pixel card', (width) => {
    const art = newPieceArt(width);
    expect(art.width).toBe(width);
    expect(art.height).toBe(NEW_PIECE_HEIGHT);
    // five ink lines run from the left edge to the pencil, and nothing else is on the staff
    const inked = (x: number, y: number): boolean => art.pixels[y * width + x] !== 0;
    const lineRows = Array.from({ length: art.height }, (_, y) => y).filter((y) => inked(0, y) && inked(width - 20, y));
    expect(lineRows).toHaveLength(5);
    for (let x = 0; x < width - 12; x++) for (let y = 0; y < art.height; y++) expect(inked(x, y)).toBe(lineRows.includes(y));
    expect(inkCount(art)).toBeGreaterThan(5 * (width - 12));
  });
});
