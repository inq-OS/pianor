/**
 * The key of an editor piece (core_09.AC8): the names of the 15 major keys and their relative minors, the K: name the ABC
 * writes, the name the player reads, and the key choice's order. Pure. A key is always a standard key, so the stored value
 * stays a fifths count (-7..7) and a mode (major or minor).
 */
import { language, type Language } from '../text/language';
import type { NoteNaming } from '../text/noteName';
import { t } from '../text/strings';

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

/** The Estonian syllable of a tonic in H naming: the letter and `is` for a sharp, `es` for a flat, contracted to Es and As, and B for B flat. */
function estonianTonic(tonic: string): string {
  const step = tonic[0]!;
  if (tonic.endsWith('#')) return `${step === 'B' ? 'H' : step}is`;
  if (!tonic.endsWith('b')) return step === 'B' ? 'H' : step;
  return step === 'B' ? 'B' : step === 'E' || step === 'A' ? `${step}s` : `${step}es`;
}

/**
 * The tonic of a key as the player reads it in the key's name (d087). Estonian with H naming writes it the Estonian way
 * (Fis, Es, B for B flat, H, Ces); otherwise it is the letter in the player's naming with a flat written as the flat sign
 * (F#, E♭, B♭, or B in H naming), and a key keeps its own letter, so C flat major is C♭, never H. A minor key's tonic is
 * in small letters (h, gis, e♭).
 */
export function keyTonic(fifths: number, mode: KeyMode, naming: NoteNaming, lang: Language): string {
  const tonic = (mode === 'major' ? MAJOR_TONICS : MINOR_TONICS)[fifths + 7]!;
  const name = lang === 'et' && naming === 'H' ? estonianTonic(tonic) : tonicName(tonic, naming).replace(/(?<=.)b/, '♭');
  return mode === 'minor' ? name.toLowerCase() : name;
}

/** The whole name of a key in the game's language, the one helper every screen names a key with (d087): "F# major", "Fis-duur", "gis-moll". */
export function keyName(fifths: number, mode: KeyMode, naming: NoteNaming): string {
  const key = keyTonic(fifths, mode, naming, language());
  return t(mode === 'major' ? 'circle.major' : 'circle.minor', { key });
}
