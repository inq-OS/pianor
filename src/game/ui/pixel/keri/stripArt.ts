import { createBitmap, type Bitmap } from '../bitmap';
import { hash2 } from '../paint/noise';
import { C } from '../palette';

/**
 * The strip under the room's picture: a dark board, empty for now. It keeps the place of the verb
 * buttons and the inventory of a point-and-click interface, as the painted adventures have under their picture.
 */
export function stripArt(width: number, height: number): Bitmap {
  const b = createBitmap(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // a lit edge on top, then the board with a few darker flecks, as a hand-drawn panel has
      const fleck = hash2(x >> 1, y, 3) > 0.9;
      b.pixels[y * width + x] = y === 0 ? C.ink : y === 1 ? C.panel : fleck ? C.night : C.panelDark;
    }
  }
  return b;
}
