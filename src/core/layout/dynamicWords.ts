/** A dynamic mark on the staff, with the Estonian word that goes beside it (core_09.AC15). */
export interface DynamicWordMark {
  system: number;
  staff: number;
  /** The x of the mark's note, in layout units. */
  column: number;
  /** The word shown beside the mark. */
  word: string;
}

/** Where the word starts, right of the mark, in staff spaces (matches StaffView). */
const WORD_OFFSET = 1.2;
/** Width of one character of the monospace word font, in em (the font is 0.9 staff spaces). */
const CHAR_WIDTH = 0.65;
const WORD_FONT = 0.9;
/** Clear space kept before the next mark, in staff spaces. */
const GAP = 0.5;

/**
 * For each mark (in the order given), whether its word fits before the next mark on the same staff: a word that would run into
 * the next mark is not drawn, so two marks never overlap (core_09.AC15). The mark itself is always drawn.
 */
export function wordFits(marks: readonly DynamicWordMark[], staffSpace: number): boolean[] {
  return marks.map((m, i) => {
    const room = wordWidth(m.word, staffSpace) + (WORD_OFFSET + GAP) * staffSpace;
    const next = marks
      .filter((o, j) => j !== i && o.system === m.system && o.staff === m.staff && o.column > m.column)
      .reduce<number>((least, o) => Math.min(least, o.column), Number.POSITIVE_INFINITY);
    return m.column + room <= next;
  });
}

/** The width of a word in layout units. */
export function wordWidth(word: string, staffSpace: number): number {
  return word.length * CHAR_WIDTH * WORD_FONT * staffSpace;
}
