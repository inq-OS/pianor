import { lchOf } from '../../src/game/ui/pixel/paint/lab.ts';
import type { IndexedPicture } from './png';

/**
 * Guides laid over a painted picture for whoever checks its composition (docs/art-direction.md): Monkey Island 2 puts
 * its main subject near the middle (0.4 to 0.6 of the width), never its horizon on the middle row, and the horizon where
 * the viewer's eye is. They are for looking, never a test: the eye decides.
 */
export const GUIDES = {
  /** Where the main subject's middle goes, as shares of the width. */
  band: [0.4, 0.6],
  /** The row a horizon avoids, as a share of the height. */
  middle: 0.5,
} as const;

/** A copy of the picture with the guides drawn in its darkest and lightest colours: dotted band and middle row, solid horizon. */
export function withGuides(picture: IndexedPicture, horizon?: number): IndexedPicture {
  const { width, height, palette } = picture;
  const lightness = palette.map((c, i) => (i === 0 ? NaN : lchOf(c).l));
  const valid = lightness.map((L, i) => [L, i] as const).filter(([L]) => !Number.isNaN(L));
  const dark = valid.reduce((a, b) => (b[0] < a[0] ? b : a))[1];
  const light = valid.reduce((a, b) => (b[0] > a[0] ? b : a))[1];
  const pixels = Uint8Array.from(picture.pixels);
  const dot = (x: number, y: number): void => { pixels[y * width + x] = (x + y) % 4 < 2 ? dark : light; };
  for (const share of GUIDES.band) {
    const x = Math.round(share * width);
    for (let y = 0; y < height; y++) dot(x, y);
  }
  const mid = Math.round(GUIDES.middle * height);
  for (let x = 0; x < width; x += 1) if (x % 8 < 4) dot(x, mid);
  if (horizon !== undefined) for (let x = 0; x < width; x++) pixels[horizon * width + x] = light;
  return { width, height, palette, pixels };
}

/** How many colours of each named run (palette places) a picture uses. */
export function runUse(picture: { pixels: Uint8Array }, runs: Readonly<Record<string, readonly number[]>>): { name: string; used: number; of: number }[] {
  const seen = new Set(picture.pixels);
  return Object.entries(runs).map(([name, places]) => ({ name, used: places.filter((p) => seen.has(p)).length, of: places.length }));
}
