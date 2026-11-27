import type { Spelling } from '../chart/pitch';
import type { Language } from './language.ts';

/** Letter naming: `B` is the English/Dutch letter, `H` the German one (German B is our Bb, German H is our B natural). */
export type NoteNaming = 'B' | 'H';

const SIGN_TEXT: Readonly<Record<number, string>> = { [-2]: 'bb', [-1]: 'b', 0: '', 1: '#', 2: '##' };

/**
 * The hint label of a spelled note, without the octave: the letter and its sign from the spelling (C#, Db, Bb, F#).
 * H mode (German): the letter B with one flat reads `B` and every other B reads `H` with its sign, so a natural B is `H`,
 * B# is `H#`, and a double flat B reads `Bb` (B flat with one more flat; the German name Heses is too rare to teach).
 * Every other note keeps its letter and sign (Cb, Fb, E#, A#), so a scale's seven notes always have seven letters.
 * Pure: no DOM, no engine.
 */
export function noteLabel(spelling: Spelling, naming: NoteNaming): string {
  const sign = SIGN_TEXT[spelling.alter];
  if (sign === undefined) throw new RangeError(`Unsupported alteration: ${spelling.alter}`);
  if (naming === 'H') {
    if (spelling.step === 'B' && spelling.alter === -1) return 'B';
    if (spelling.step === 'B' && spelling.alter === -2) return 'Bb';
    if (spelling.step === 'B') return `H${sign}`;
  }
  return `${spelling.step}${sign}`;
}

/** The letter naming a new player starts with (ft_0_18, item 7): Estonian schools use H. A default only; saved settings win. */
export function defaultNoteNaming(lang: Language): NoteNaming {
  return lang === 'et' ? 'H' : 'B';
}
