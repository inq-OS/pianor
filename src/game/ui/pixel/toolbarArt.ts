import { createBitmap, type Bitmap } from './bitmap';
import { C } from './palette';

/**
 * The separator between the toolbar and the main area of every screen (d088): one vine stalk across the whole
 * width, a single staff line with a leaf note now and then (preview T1, one line picked over five). Original,
 * drawn for this project. `VINE_ART_ROWS` tall; its stalk is on `STALK_ROW`, the leaves' stems reach the rows above.
 */
export const VINE_ART_ROWS = 5;
const STALK_ROW = 3;
const LEAF_STEP = 37;

type Canvas = { width: number; height: number; pixels: Uint8Array };
const put = (b: Canvas, x: number, y: number, c: number) => {
  if (x >= 0 && y >= 0 && x < b.width && y < b.height) b.pixels[y * b.width + x] = c;
};
const stalkAt = (x: number) => STALK_ROW + Math.round(Math.sin(x / 9) * 0.6);

export function separatorBitmap(width: number): Bitmap {
  const b = createBitmap(Math.max(1, width), VINE_ART_ROWS);
  for (let x = 0; x < width; x++) put(b, x, stalkAt(x), C.leafDark);
  // a leaf note: a head on the stalk and a short stem
  for (let x = 14; x < width; x += LEAF_STEP) {
    const y = stalkAt(x);
    for (const [dx, dy, c] of [[0, -1, C.leaf], [1, -1, C.leafLight], [2, -1, C.leaf], [-1, 0, C.leaf], [0, 0, C.leaf], [1, 0, C.leaf], [2, 0, C.leaf], [3, 0, C.leaf], [0, 1, C.leaf], [1, 1, C.leaf], [2, 1, C.leafDark]] as const) put(b, x + dx, y + dy, c);
    for (let s = 2; s <= 3; s++) put(b, x + 3, y - s, C.leaf);
  }
  return b;
}
