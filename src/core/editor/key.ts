/**
 * The key of an editor piece (core_09.AC8): the names of the 15 major keys and their relative minors, the K: name the ABC
 * writes, and the key choice's order. Pure. A key is always a standard key, so the stored value
 * stays a fifths count (-7..7) and a mode (major or minor).
 */
import type { NoteNaming } from '../text/noteName';

export type KeyMode = 'major' | 'minor';

/** The tonic of the major key with each fifths count, from -7 (C flat major) to 7 (C sharp major). */
const MAJOR_TONICS = ['Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'] as const;
/** The tonic of the minor key with each fifths count, from -7 (A flat minor) to 7 (A sharp minor). */
const MINOR_TONICS = ['Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#'] as const;

/** A tonic in a letter naming (d087): with H naming B reads `H` and Bb reads `B`; every other tonic keeps its letter. */
function tonicName(tonic: string, naming: NoteNaming): string {
  if (naming !== 'H') return tonic;
  return tonic === 'B' ? 'H' : tonic === 'Bb' ? 'B' : tonic;
}

/** The major key and its relative minor with this many fifths: "G" and "E" for one sharp; in H naming "B" and "G" for two flats (d087). */
export function keyNames(fifths: number, naming: NoteNaming = 'B'): { major: string; minor: string } {
  return { major: tonicName(MAJOR_TONICS[fifths + 7]!, naming), minor: tonicName(MINOR_TONICS[fifths + 7]!, naming) };
}

/** The K: field of the ABC for a key: `G`, `Em`, `Bbm`. */
export function abcKey(fifths: number, mode: KeyMode): string {
  return mode === 'minor' ? `${MINOR_TONICS[fifths + 7]}m` : MAJOR_TONICS[fifths + 7]!;
}

/**
 * The key's name on the piece maker's key button (d087): the tonic in the player's letter naming, with m for minor.
 * With H naming a B natural reads `H` and a B flat reads `B` (Hm, Bm); every other tonic keeps its letter and sign, so
 * C flat major stays `Cb` (unlike a note-name hint, a key name never swaps to the natural it sounds as).
 */
export function keyLabel(fifths: number, mode: KeyMode, naming: NoteNaming): string {
  const names = keyNames(fifths, naming);
  return mode === 'minor' ? `${names.minor}m` : names.major;
}
