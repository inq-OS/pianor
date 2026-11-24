import type { Medal } from '../../core/learn/progress';
import { fromAscii, type Bitmap } from '../ui/pixel/bitmap';
import { C } from '../ui/pixel/palette';

/**
 * The clef prize of a piece in the piece book (ft_1_32.AC21, d287): a small pixel treble clef in its medal's colours once the
 * piece is learned, or an empty placeholder (its outline in the faint ink of things still to earn).
 * AX-3 provisional: drawn for this project, 10 rows high (TODO(painter, R2) in ft_1_32).
 */

/** d: the outline; f: the fill along it. */
const CLEF = [
  '...dd.', '..dfd.', '..dfd.', '...d..', '..dd..', '.dfd..', 'dffddd', 'dfdfdd', '.dfd.d', '..ddd.',
];

/** A medal's two colours, the fill and the outline; `todo` is a piece not learned yet. */
const COLOURS: Record<Medal | 'todo', { f: number; d: number }> = {
  gold: { f: C.gold, d: C.goldDark },
  silver: { f: C.silver, d: C.silverDark },
  bronze: { f: C.orangeDark, d: C.brownDark },
  todo: { f: C.clear, d: C.lock },
};

export const CLEF_PRIZE_ROWS = CLEF.length;

/** The clef of a piece learned with `medal`, or the placeholder of one not learned yet (null). */
export function clefPrize(medal: Medal | null): Bitmap {
  return fromAscii(CLEF, { '.': C.clear, ...COLOURS[medal ?? 'todo'] });
}
