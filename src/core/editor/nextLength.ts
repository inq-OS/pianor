/**
 * The length the next note is written with: the piece maker guesses it from the note just written, so
 * a parent rarely picks a length. A note that ends inside a beat is followed by what completes the beat: after one eighth
 * another, after a dotted quarter an eighth, after a dotted eighth a sixteenth. Back on a beat after short notes, the
 * quarter again (two eighths, then a quarter); after a quarter or longer, the same length. A length the rest of the bar
 * cannot hold gives way to the longest that it can. Pure.
 */
import { barLength, barTicks, LENGTH_TICKS, placeAfter, LENGTHS, type EditorLength, type EditorPiece } from './model';

const BEAT = LENGTH_TICKS.quarter;

/** The longest length no longer than `ticks`, or the shortest when none is. */
function longestUpTo(ticks: number): EditorLength {
  return [...LENGTHS].reverse().find((l) => LENGTH_TICKS[l] <= ticks) ?? LENGTHS[0]!;
}

/** The length to write next after a note or rest of `length` placed at `start` ticks into its bar. */
export function nextLength(piece: Pick<EditorPiece, 'beats'> & Partial<Pick<EditorPiece, 'bars' | 'pickup'>>, placed: { bar?: number; start: number; length: EditorLength }): EditorLength {
  // where the next note starts in its bar: a note that fills its bar is followed by the next bar's first beat; a pick-up
  // and the short last bar have their own length (core_09.AC30), a bar past the piece a whole one
  const shape = piece.bars === undefined || placed.bar === undefined ? null : { ...piece, bars: piece.bars };
  const after = shape && placed.bar !== undefined ? placeAfter(shape, placed.bar, placed.start + LENGTH_TICKS[placed.length]) : null;
  const bar = shape && after && after.bar < shape.bars ? barLength(shape, after.bar) : barTicks(piece);
  const at = after ? after.start : (placed.start + LENGTH_TICKS[placed.length]) % bar;
  const toBeat = (BEAT - (at % BEAT)) % BEAT;
  const ticks = LENGTH_TICKS[placed.length];
  let next: EditorLength;
  if (toBeat > 0) next = ticks <= toBeat ? placed.length : longestUpTo(toBeat);
  else next = ticks < BEAT ? 'quarter' : placed.length;
  return LENGTH_TICKS[next] <= bar - at ? next : longestUpTo(bar - at);
}
