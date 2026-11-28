/**
 * A chip of marks (d312): the marks shown where there is no staff ("E✓ F✗ ½▲" in the ear trainer and the tug, a count
 * over a teaching) on a paper plate, drawn `zoom` times the font so they read at a glance, in ink with the ✓ green and
 * the ✗ red. One bitmap, so a view places it like any picture.
 */
import { blit, createBitmap, type Bitmap } from './bitmap';
import { drawnText, renderMarks, renderText } from './font';
import { panelBitmap } from './frames';
import { C } from './palette';

const PAD = 3;

export function markChipBitmap(text: string, zoom = 2): Bitmap {
  const marks = renderMarks(drawnText(text), C.ink, { '✓': C.green, '✗': C.red });
  const big = createBitmap(marks.width * zoom, marks.height * zoom);
  for (let y = 0; y < big.height; y++) {
    for (let x = 0; x < big.width; x++) big.pixels[y * big.width + x] = marks.pixels[Math.floor(y / zoom) * marks.width + Math.floor(x / zoom)]!;
  }
  const chip = createBitmap(big.width + 2 * PAD, big.height + 2 * PAD);
  blit(chip, panelBitmap(chip.width, chip.height, 'bubble'), 0, 0);
  blit(chip, big, PAD, PAD);
  return chip;
}

/** A one-time tip naming a mark (d312: "8: the same letter, an octave higher or lower") on the same paper plate, in ink at the font's size. */
export function markTipBitmap(text: string): Bitmap {
  const words = renderText(drawnText(text), { color: C.ink });
  const tip = createBitmap(words.width + 2 * PAD + 2, words.height + 2 * PAD);
  blit(tip, panelBitmap(tip.width, tip.height, 'bubble'), 0, 0);
  blit(tip, words, PAD + 1, PAD);
  return tip;
}
