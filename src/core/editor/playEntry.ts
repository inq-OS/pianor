/**
 * Entering notes on the editor's staves (pure, no DOM): how long a key hold is, which staff a pitch goes on, how a key
 * spells its pitches, where the cursor is and how many bars a piece needs for it. The screen reads these and places
 * the note; the rules stay here.
 */
import type { Alter } from '../chart/key';
import { midiToSpelling, type Step } from '../chart/pitch';
import {
  barLength, BARS_STEP, LENGTH_TICKS, MAX_BARS, placedRests, restLengthFor, setBars,
  type EditorHand, type EditorLength, type EditorPiece,
} from './model';

export { restLengthFor };

/** Hold times in milliseconds. The admin page may tune these later; the rest of the module reads them from here. */
export const ENTRY_CONFIG = {
  /** A press shorter than this is a tap: an eighth when the short-tap toggle is on, else a quarter. */
  tapMs: 150,
  /** Keys pressed within this many milliseconds of each other are one chord. */
  chordMs: 80,
  /** Holds from here up to `dottedHalfMs` are halves. */
  halfMs: 1000,
  /** Holds from `dottedHalfMs` up to `wholeMs` are dotted halves. */
  dottedHalfMs: 2000,
  /** Holds of `wholeMs` or more are whole notes. */
  wholeMs: 3000,
} as const;

/** Which staff a pitch goes on: a fixed one, or by pitch (`auto`). */
export type StaffMode = 'auto' | 'RH' | 'LH';

/** The length of a note from how long its key was held. A short tap is an eighth only when `shortTapEighth` is on. */
export function lengthForHold(heldMs: number, shortTapEighth: boolean): EditorLength {
  if (heldMs < ENTRY_CONFIG.tapMs && shortTapEighth) return 'eighth';
  if (heldMs < ENTRY_CONFIG.halfMs) return 'quarter';
  if (heldMs < ENTRY_CONFIG.dottedHalfMs) return 'half';
  if (heldMs < ENTRY_CONFIG.wholeMs) return 'dottedHalf';
  return 'whole';
}


/** The staff of a pitch: the staff it is fixed to, or in `auto` the right hand from middle C (MIDI 60) up. */
export function staffFor(midi: number, mode: StaffMode): EditorHand {
  if (mode === 'RH' || mode === 'LH') return mode;
  return midi >= 60 ? 'RH' : 'LH';
}

/**
 * The spelling of a pitch in the key of the piece: flat keys spell black keys as flats, the others as sharps. The alter
 * is always -1, 0 or 1 here, since a bare MIDI number never needs a double accidental.
 */
export function spellKey(piece: Pick<EditorPiece, 'fifths'>, midi: number): { step: Step; octave: number; alter: Alter } {
  const spelled = midiToSpelling(midi, piece.fifths < 0);
  return { step: spelled.step, octave: spelled.octave, alter: spelled.alter as Alter };
}

/**
 * Where the next note or rest of `hand` goes: the end of its last note or placed rest. At the end of a bar that is the
 * start of the next bar. An empty hand starts at bar 0. Null when that place is past the last bar (the caller adds bars).
 */
export function cursorOf(piece: EditorPiece, hand: EditorHand): { bar: number; start: number } | null {
  const rests = placedRests(piece);
  for (let bar = piece.bars - 1; bar >= 0; bar--) {
    const ends = [
      ...piece.notes.filter((n) => n.hand === hand && n.bar === bar).map((n) => n.start + LENGTH_TICKS[n.length]),
      ...rests.filter((r) => r.hand === hand && r.bar === bar).map((r) => r.start + LENGTH_TICKS[r.length]),
    ];
    if (ends.length === 0) continue;
    const end = Math.max(...ends);
    if (end < barLength(piece, bar)) return { bar, start: end };
    return bar + 1 < piece.bars ? { bar: bar + 1, start: 0 } : null;
  }
  // nothing of this hand yet: an empty piece (or an empty hand) starts at the top
  return { bar: 0, start: 0 };
}

/**
 * The piece with enough bars for `bar` to exist: four more bars at a time, never past MAX_BARS. A piece that already has
 * the bar is returned as it is.
 */
export function ensureBars(piece: EditorPiece, bar: number): EditorPiece {
  let next = piece;
  while (bar >= next.bars && next.bars < MAX_BARS) {
    next = setBars(next, Math.min(MAX_BARS, next.bars + BARS_STEP));
  }
  return next;
}

/**
 * Where the next played key goes after the note or rest at `bar`, `start` of `hand`: the end of it, or the start of the
 * next bar when it ends the bar. Null when nothing is there. A click on a shadow note sets the cursor here, so the next
 * key fills the following gap and does not join the clicked note as a chord.
 */
export function cursorAfter(piece: EditorPiece, hand: EditorHand, bar: number, start: number): { bar: number; start: number } | null {
  const note = piece.notes.find((n) => n.hand === hand && n.bar === bar && n.start === start);
  const rest = placedRests(piece).find((r) => r.hand === hand && r.bar === bar && r.start === start);
  const length = note?.length ?? rest?.length;
  if (length === undefined) return null;
  const end = start + LENGTH_TICKS[length];
  if (end < barLength(piece, bar)) return { bar, start: end };
  // past the last bar there is no place to point at: the caller keeps the cursor `cursorOf` gives
  return bar + 1 < piece.bars ? { bar: bar + 1, start: 0 } : null;
}
