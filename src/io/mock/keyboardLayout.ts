/** Pure geometry for a piano keyboard, in white-key widths. Used by the on-screen keyboard. */

import { isBlackKey } from '../../core/chart/pitch';

export interface KeyShape {
  midi: number;
  black: boolean;
  /** Left edge, in white-key widths from the left of the keyboard. */
  x: number;
  /** Width in white-key widths. */
  width: number;
}

export interface KeyboardGeometry {
  keys: KeyShape[];
  whiteCount: number;
}

export const BLACK_KEY_WIDTH = 0.6;

/** Layout for keys `low` to `high` inclusive; both must be white keys (the EZ-220 starts and ends on C). */
export function keyboardLayout(low: number, high: number): KeyboardGeometry {
  if (isBlackKey(low) || isBlackKey(high)) throw new RangeError('The keyboard must start and end on a white key');
  if (low > high) throw new RangeError('low is above high');
  const keys: KeyShape[] = [];
  let whites = 0;
  for (let midi = low; midi <= high; midi++) {
    if (isBlackKey(midi)) {
      // Centred on the line between the white keys either side.
      keys.push({ midi, black: true, x: whites - BLACK_KEY_WIDTH / 2, width: BLACK_KEY_WIDTH });
    } else {
      keys.push({ midi, black: false, x: whites, width: 1 });
      whites++;
    }
  }
  return { keys, whiteCount: whites };
}

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** "C4" for MIDI 60. */
export function midiName(midi: number): string {
  return `${NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;
}
