import { STEP_SEMITONES, type Spelling, type Step } from '../chart/pitch';
import type { Language } from './language.ts';

/** Letter naming: `B` is the English/Dutch letter, `H` the German one (German B is our Bb, German H is our B natural). */
export type NoteNaming = 'B' | 'H';

const SIGN_TEXT: Readonly<Record<number, string>> = { [-2]: 'bb', [-1]: 'b', 0: '', 1: '#', 2: '##' };

/** The natural letter a pitch class is, for the sharp or flat that lands on it (B# is C, Fb is E, and so on). */
const NATURAL_OF_PITCH_CLASS: Readonly<Partial<Record<number, Step>>> = { 0: 'C', 2: 'D', 4: 'E', 5: 'F', 7: 'G', 9: 'A', 11: 'B' };

/**
 * The hint label of a spelled note, without the octave: the letter and its sign from the spelling (C#, Db, Bb, F#).
 * H mode (German): a natural B reads `H`, a flat B (Bb) reads `B`, and a single sign that lands on a
 * natural reads that natural, so B# and H# read `C`, E# reads `F`, Cb reads `H` and Fb reads `E`. A#, and every other
 * sharp or flat, keeps its letter and sign. Pure: no DOM, no engine.
 */
export function noteLabel(spelling: Spelling, naming: NoteNaming): string {
  const sign = SIGN_TEXT[spelling.alter];
  if (sign === undefined) throw new RangeError(`Unsupported alteration: ${spelling.alter}`);
  if (naming === 'H') {
    if (spelling.step === 'B' && spelling.alter === 0) return 'H';
    if (spelling.step === 'B' && spelling.alter === -1) return 'B';
    if (Math.abs(spelling.alter) === 1) {
      const natural = NATURAL_OF_PITCH_CLASS[(((STEP_SEMITONES[spelling.step] + spelling.alter) % 12) + 12) % 12];
      if (natural !== undefined && natural !== spelling.step) return natural === 'B' ? 'H' : natural;
    }
  }
  return `${spelling.step}${sign}`;
}

/** The letter naming a new player starts with (ft_0_18, item 7): Estonian schools use H. A default only; saved settings win. */
export function defaultNoteNaming(lang: Language): NoteNaming {
  return lang === 'et' ? 'H' : 'B';
}
