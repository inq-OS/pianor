/**
 * A few piano keys drawn small, two of them lit (the lesson's pitfall card, d312): the student sees the step as keys, E and
 * F with no black key between them, E and F♯ with one, instead of reading a sentence about it. The keys run from the white
 * key below the lower note to the white key above the higher one. Pure: the view only draws it, in art pixels.
 */
import { isBlackKey } from '../chart/pitch';

export const PICTOGRAM_KEY = { whiteW: 7, whiteH: 18, blackW: 5, blackH: 11 } as const;

export interface PictogramKey {
  midi: number;
  black: boolean;
  lit: boolean;
  x: number;
  w: number;
  h: number;
}

export interface KeyPictogram {
  width: number;
  height: number;
  /** The white keys first, then the black ones drawn over them. */
  keys: PictogramKey[];
}

/** The keys round `low` and `high` (MIDI), those two lit. */
export function keyPictogram(low: number, high: number): KeyPictogram {
  const [a, b] = low <= high ? [low, high] : [high, low];
  let first = a - 1;
  while (isBlackKey(first)) first -= 1;
  let last = b + 1;
  while (isBlackKey(last)) last += 1;
  const { whiteW, whiteH, blackW, blackH } = PICTOGRAM_KEY;
  const whites: PictogramKey[] = [];
  const blacks: PictogramKey[] = [];
  for (let midi = first; midi <= last; midi++) {
    const lit = midi === a || midi === b;
    if (isBlackKey(midi)) {
      // a black key stands over the line between the white keys either side of it
      blacks.push({ midi, black: true, lit, x: whites.length * (whiteW - 1) - Math.floor(blackW / 2), w: blackW, h: blackH });
    } else {
      whites.push({ midi, black: false, lit, x: whites.length * (whiteW - 1), w: whiteW, h: whiteH });
    }
  }
  return { width: whites.length * (whiteW - 1) + 1, height: whiteH, keys: [...whites, ...blacks] };
}
