import type { EditorLength } from '../../../core/editor/model';
import { keySignaturePositions } from '../../../core/layout/staff';
import { blit, createBitmap, fromAscii, type Bitmap } from './bitmap';
import { C } from './palette';

/**
 * The piece maker's length buttons as the notes and rests themselves, white on the blue button. Original, drawn
 * for this project. Each fits inside a 14 pixel bar button with its frame (10 rows at most).
 */
export type LengthId = EditorLength;

const art = (rows: readonly string[]) => fromAscii(rows, { w: C.white });

export const NOTE_ICONS: Readonly<Record<LengthId, Bitmap>> = {
  whole: art(['.wwwww.', 'ww..www', 'www..ww', '.wwwww.']),
  half: art(['.....w', '.....w', '.....w', '.....w', '.....w', '.....w', '..wwww', '.w..ww', 'ww..w.', '.www..']),
  dottedHalf: art(['.....w..', '.....w..', '.....w..', '.....w..', '.....w..', '.....w..', '..wwww..', '.w..ww..', 'ww..w..w', '.www....']),
  dottedQuarter: art(['....w..', '....w..', '....w..', '....w..', '....w..', '....w..', '....w..', '.wwww..', 'wwwww.w', '.www...']),
  quarter: art(['....w', '....w', '....w', '....w', '....w', '....w', '....w', '.wwww', 'wwwww', '.www.']),
  dottedEighth: art(['....ww....', '....w.w...', '....w..w..', '....w..w..', '....w.....', '....w.....', '....w.....', '.wwww.....', 'wwwww....w', '.www......']),
  eighth: art(['....ww..', '....w.w.', '....w..w', '....w..w', '....w...', '....w...', '....w...', '.wwww...', 'wwwww...', '.www....']),
  sixteenth: art(['....ww..', '....w.w.', '....ww.w', '....w.w.', '....w..w', '....w..w', '....w...', '.wwww...', 'wwwww...', '.www....']),
};

export const REST_ICONS: Readonly<Record<LengthId, Bitmap>> = {
  // hangs from a line
  whole: art(['wwwwwwwww', '..wwwww..', '..wwwww..']),
  // sits on a line
  half: art(['..wwwww..', '..wwwww..', 'wwwwwwwww']),
  dottedHalf: art(['..wwwww....', '..wwwww..w.', 'wwwwwwwww..']),
  dottedQuarter: art(['.w.....', '..w....', '..ww...', '.ww....', 'ww....w', '.ww....', '..ww...', '.w.....', 'w......', '.ww....']),
  quarter: art(['.w...', '..w..', '..ww.', '.ww..', 'ww...', '.ww..', '..ww.', '.w...', 'w....', '.ww..']),
  dottedEighth: art(['ww..w..', 'wwwww..', '...w..w', '..w....', '..w....', '.w.....', '.w.....']),
  eighth: art(['ww..w', 'wwwww', '...w.', '..w..', '..w..', '.w...', '.w...']),
  sixteenth: art(['..ww..w', '..wwwww', '.....w.', 'ww..w..', 'wwwww..', '...w...', '..w....', '..w....', '.w.....']),
};

const SHARP = art(['.w.w', 'wwww', '.w.w', 'wwww', 'w.w.']);
const FLAT = art(['w..', 'w..', 'www', 'w.w', 'ww.']);
/** Rows of the signature picture: the highest place (G5) at row 1, the lowest (F4) near the bottom. */
const SIGNATURE_HEIGHT = 10;

/**
 * The key signature on the piece maker's signature button: its sharps or flats in the order and the up-and-down of the
 * treble staff, without the lines, half as tall so they fit the button. No key (C major) is an empty button, as no bar
 * numbers is on the settings screen.
 */
export function signatureIcon(fifths: number): Bitmap {
  const places = fifths === 0 ? [] : keySignaturePositions(fifths, 'treble');
  const b = createBitmap(Math.max(1, places.length * 5 - 1), SIGNATURE_HEIGHT);
  places.forEach(({ alter, position }, i) => {
    // the middle of a sharp is its third row, of a flat the middle of its loop (its fourth row)
    const middle = Math.round((9 - position) / 2) + 3;
    blit(b, alter === 1 ? SHARP : FLAT, i * 5, middle - (alter === 1 ? 2 : 3));
  });
  return b;
}

/** The sharp, flat and natural tools as the signs themselves; their names stay as tooltips. */
export const ACCIDENTAL_ICONS = {
  sharp: art(['.w.w.', '.w.w.', 'wwwww', '.w.w.', 'wwwww', '.w.w.', '.w.w.']),
  flat: art(['w...', 'w...', 'w...', 'www.', 'w..w', 'w.w.', 'ww..']),
  natural: art(['w..', 'w..', 'www', 'w.w', 'www', '..w', '..w']),
} as const;
