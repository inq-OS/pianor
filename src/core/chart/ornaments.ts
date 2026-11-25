import { STEPS, type Spelling } from './pitch.ts';
import { PPQ } from './time.ts';

/**
 * Ornament signs on a note (core_09.AC60, d305): a trill, an upper mordent (pralltriller), a lower mordent and a turn.
 * The chart keeps the sign and the neighbour notes it uses; computer playback reads the notes it sounds from
 * `ornamentNotes`, and the judge ignores a press of those pitches around the note (optional for the student).
 */
export const ORNAMENT_KINDS = ['trill', 'upperMordent', 'lowerMordent', 'turn'] as const;
export type OrnamentKind = (typeof ORNAMENT_KINDS)[number];

/** ABC 2.1 decoration names (`!trill!`) for each sign; `!mordent!` is the lower mordent and `!pralltriller!` the upper one. */
export const ABC_ORNAMENTS: Readonly<Record<string, OrnamentKind>> = {
  trill: 'trill',
  uppermordent: 'upperMordent',
  pralltriller: 'upperMordent',
  lowermordent: 'lowerMordent',
  mordent: 'lowerMordent',
  turn: 'turn',
};

/** The decoration the game writes for each sign (the importer and the editor write these). */
export const ORNAMENT_DECORATION: Readonly<Record<OrnamentKind, string>> = { trill: 'trill', upperMordent: 'uppermordent', lowerMordent: 'lowermordent', turn: 'turn' };

/** The sign uses the note a step above. */
export const usesUpper = (kind: OrnamentKind): boolean => kind !== 'lowerMordent';
/** The sign uses the note a step below. */
export const usesLower = (kind: OrnamentKind): boolean => kind === 'lowerMordent' || kind === 'turn';

/** The letter a diatonic step above (`dir` 1) or below (-1), natural: the caller spells it in the key and bar. */
export function neighbourLetter(s: Pick<Spelling, 'step' | 'octave'>, dir: 1 | -1): { step: Spelling['step']; octave: number } {
  const index = STEPS.indexOf(s.step) + dir;
  if (index > 6) return { step: 'C', octave: s.octave + 1 };
  if (index < 0) return { step: 'B', octave: s.octave - 1 };
  return { step: STEPS[index]!, octave: s.octave };
}

/**
 * The quick notes of a mordent and a trill: a thirty-second note in ticks, so they follow the tempo.
 * AX-3 provisional: TODO(architect, R2) in core_09.
 */
export const ORNAMENT_QUICK_TICKS = PPQ / 8;
/** The notes of a turn: a sixteenth each, or a quarter of the note when it is shorter than a quarter. AX-3 provisional (see above). */
export const TURN_NOTE_TICKS = PPQ / 4;

/** One note an ornament sounds: its pitch, its start from the main note's start and its length, in ticks. */
export interface OrnamentNote {
  midi: number;
  offset: number;
  dur: number;
}

/**
 * The notes a sign on a note of `dur` ticks sounds, in order, filling the note's length (AX-3 provisional, d305):
 * - upper mordent: main, upper, main (held); lower mordent: main, lower, main; each quick note a thirty-second;
 * - turn: upper, main, lower, main (held), each a sixteenth (a quarter of a shorter note);
 * - trill: main and upper in thirty-seconds through the note, starting and ending on the main note (the student's
 *   written note first, the simpler start for a beginner), at least main, upper, main.
 * A note too short for the quick notes shares its length out evenly. The last note takes what is left.
 */
export function ornamentNotes(kind: OrnamentKind, main: number, aux: { upper?: number; lower?: number }, dur: number): OrnamentNote[] {
  const pitches = ((): number[] => {
    const upper = aux.upper ?? main;
    const lower = aux.lower ?? main;
    if (kind === 'upperMordent') return [main, upper, main];
    if (kind === 'lowerMordent') return [main, lower, main];
    if (kind === 'turn') return [upper, main, lower, main];
    let count = Math.max(3, Math.floor(dur / ORNAMENT_QUICK_TICKS));
    if (count % 2 === 0) count--;
    return Array.from({ length: count }, (_, i) => (i % 2 === 0 ? main : upper));
  })();
  const wanted = kind === 'turn' ? Math.min(TURN_NOTE_TICKS, Math.floor(dur / 4)) : ORNAMENT_QUICK_TICKS;
  const unit = Math.max(1, Math.min(wanted, Math.floor(dur / pitches.length)));
  return pitches.map((midi, i) => {
    const offset = i * unit;
    return { midi, offset, dur: i === pitches.length - 1 ? dur - offset : unit };
  });
}
