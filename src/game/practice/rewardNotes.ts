import type { ChunkNote, LearnRewards, Medal } from '../../core/learn/progress';
import { blit, createBitmap, fromAscii, type Bitmap } from '../ui/pixel/bitmap';
import { C } from '../ui/pixel/palette';

/**
 * The rewards of learning a piece (ft_1_32.AC4) as one row of pixel notes for the practice screen's strip: per chunk its
 * secured bars as quarter notes (a bar still to learn as a grey one), or once the chunk is finished the one note they merged
 * into; at the end a treble clef, grey until the piece is learned. Each note in its medal's colours.
 * AX-3 provisional: drawn for this project, 10 rows high (TODO(painter, R2) in ft_1_32).
 */

/** f: the fill, d: the outline (the stem and a hollow head's ring). */
const QUARTER = ['....d', '....d', '....d', '....d', '....d', '....d', '....d', '.fffd', 'fffff', '.fff.'];
const HALF = ['....d', '....d', '....d', '....d', '....d', '....d', '....d', '.dddd', 'd...d', '.ddd.'];
const DOTTED_HALF = HALF.map((row, y) => row + (y === 8 ? '.f' : '..'));
const WHOLE = ['.......', '.......', '.......', '.......', '.......', '.......', '.dfffd.', 'df...fd', 'df...fd', '.dfffd.'];
const CLEF = [
  '...dd.', '..d..d', '..d.d.', '...d..', '..dd..', '.d.d..', 'd..ddd', 'd.d.dd', '.d.d.d', '..ddd.',
];
const NOTE_ART: Record<ChunkNote, readonly string[]> = { quarter: QUARTER, half: HALF, 'dotted-half': DOTTED_HALF, whole: WHOLE };

/** A medal's two colours: the fill and the outline; `todo` is a bar or piece not learned yet. */
const COLOURS: Record<Medal | 'todo', { f: number; d: number }> = {
  gold: { f: C.gold, d: C.goldDark },
  silver: { f: C.silver, d: C.silverDark },
  bronze: { f: C.orangeDark, d: C.brownDark },
  todo: { f: C.lock, d: C.lock },
};

/** Gaps in art pixels: between two notes of a chunk, between chunks, and before the clef. */
const NOTE_GAP = 1;
const CHUNK_GAP = 4;
export const REWARD_ROWS = 10;

const glyph = (rows: readonly string[], medal: Medal | 'todo'): Bitmap => fromAscii(rows, { '.': C.clear, ...COLOURS[medal] });

/** The glyphs of the row in order, each with the gap before it. */
function glyphs(rewards: LearnRewards): { art: Bitmap; gap: number }[] {
  const out: { art: Bitmap; gap: number }[] = [];
  rewards.chunks.forEach((chunk, c) => {
    const first = c === 0 ? 0 : CHUNK_GAP;
    if (chunk.merged) {
      out.push({ art: glyph(NOTE_ART[chunk.merged.note], chunk.merged.medal), gap: first });
      return;
    }
    for (let u = 0; u < chunk.units; u++) out.push({ art: glyph(QUARTER, chunk.quarters[u] ?? 'todo'), gap: u === 0 ? first : NOTE_GAP });
  });
  if (rewards.chunks.length > 0) out.push({ art: glyph(CLEF, rewards.piece ?? 'todo'), gap: CHUNK_GAP });
  return out;
}

/** The row as one bitmap, at most `maxWidth` wide: a row too long keeps its end (the clef and the chunks being learned). */
export function rewardNotes(rewards: LearnRewards, maxWidth = Number.POSITIVE_INFINITY): Bitmap {
  const all = glyphs(rewards);
  let width = 0;
  let from = all.length;
  while (from > 0) {
    const g = all[from - 1]!;
    const next = width + g.art.width + (from - 1 === 0 ? 0 : g.gap);
    if (next > maxWidth) break;
    width = next;
    from--;
  }
  const row = createBitmap(Math.max(1, width), REWARD_ROWS);
  let x = 0;
  all.slice(from).forEach((g, i) => {
    if (i > 0) x += g.gap;
    blit(row, g.art, x, REWARD_ROWS - g.art.height);
    x += g.art.width;
  });
  return row;
}
