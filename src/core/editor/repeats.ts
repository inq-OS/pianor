/**
 * Repeats in the editor (core_09.AC20): a parent sets "repeat starts here" and "repeat ends here" on the selected bar.
 * Repeats are kept as written pairs of bars that never overlap, so the ABC and the chart are always valid. Pure.
 */
import type { EditorPiece } from './model';

export type EditorRepeat = { startBar: number; endBar: number };

/** The piece's repeats inside its bars, in order. */
export function repeatsOf(piece: Pick<EditorPiece, 'repeats' | 'bars'>): EditorRepeat[] {
  return (piece.repeats ?? []).filter((r) => r.endBar < piece.bars).sort((a, b) => a.startBar - b.startBar);
}

const withRepeats = (piece: EditorPiece, repeats: EditorRepeat[]): EditorPiece => {
  const rest = { ...piece };
  delete rest.repeats;
  return repeats.length > 0 ? { ...rest, repeats: [...repeats].sort((a, b) => a.startBar - b.startBar) } : rest;
};

/** "Repeat starts here" at the start of `bar`: a second press takes that repeat away. */
export function toggleRepeatStart(piece: EditorPiece, bar: number): EditorPiece {
  const repeats = repeatsOf(piece);
  if (repeats.some((r) => r.startBar === bar)) return withRepeats(piece, repeats.filter((r) => r.startBar !== bar));
  const inside = repeats.find((r) => r.startBar < bar && bar <= r.endBar);
  if (inside) return withRepeats(piece, repeats.map((r) => (r === inside ? { ...r, startBar: bar } : r)));
  return withRepeats(piece, [...repeats, { startBar: bar, endBar: bar }]);
}

/** "Repeat ends here" at the end of `bar`: from the last repeat's end (or the first bar); a second press takes it away. */
export function toggleRepeatEnd(piece: EditorPiece, bar: number): EditorPiece {
  const repeats = repeatsOf(piece);
  if (repeats.some((r) => r.endBar === bar)) return withRepeats(piece, repeats.filter((r) => r.endBar !== bar));
  const inside = repeats.find((r) => r.startBar <= bar && bar < r.endBar);
  if (inside) return withRepeats(piece, repeats.map((r) => (r === inside ? { ...r, endBar: bar } : r)));
  const before = repeats.filter((r) => r.endBar < bar).at(-1);
  // a repeat whose start is still open (a start pressed, the end later) is the one this end closes
  const opened = repeats.find((r) => r.startBar === r.endBar && r.endBar < bar && !repeats.some((o) => o.startBar > r.startBar && o.startBar <= bar));
  if (opened) return withRepeats(piece, repeats.map((r) => (r === opened ? { ...r, endBar: bar } : r)));
  return withRepeats(piece, [...repeats, { startBar: before ? before.endBar + 1 : 0, endBar: bar }]);
}

/**
 * The repeat item: one repeat from bar `a` to bar `b` (either order, both bars inside it). Repeats it
 * would overlap give way to it, so repeats still never overlap; the same repeat again takes it away. Pure.
 */
export function repeatAround(piece: EditorPiece, a: number, b: number): EditorPiece {
  const startBar = Math.max(0, Math.min(a, b));
  const endBar = Math.min(piece.bars - 1, Math.max(a, b));
  const repeats = repeatsOf(piece);
  if (repeats.some((r) => r.startBar === startBar && r.endBar === endBar)) return withRepeats(piece, repeats.filter((r) => r.startBar !== startBar));
  return withRepeats(piece, [...repeats.filter((r) => r.endBar < startBar || r.startBar > endBar), { startBar, endBar }]);
}

/** The repeat bar `bar` lies in, or null. */
export function repeatAt(piece: Pick<EditorPiece, 'repeats' | 'bars'>, bar: number): EditorRepeat | null {
  return repeatsOf(piece).find((r) => r.startBar <= bar && bar <= r.endBar) ?? null;
}

/** Takes away the repeat bar `bar` lies in (the bubble's "remove repeat"); a bar in none leaves the piece as it is. */
export function removeRepeatAt(piece: EditorPiece, bar: number): EditorPiece {
  const at = repeatAt(piece, bar);
  return at ? withRepeats(piece, repeatsOf(piece).filter((r) => r.startBar !== at.startBar)) : piece;
}

/** The ABC bar line before bar `b` (0 to `bars`): `|`, `|:`, `:|`, `::`, or the end `|]` / `:|]`. */
export function abcBarLine(repeats: readonly EditorRepeat[], b: number, bars: number): string {
  const ends = repeats.some((r) => r.endBar === b - 1);
  const starts = b < bars && repeats.some((r) => r.startBar === b);
  if (b === bars) return ends ? ':|]' : '|]';
  if (b === 0) return starts ? '|:' : '';
  return ends && starts ? '::' : ends ? ':|' : starts ? '|:' : '|';
}
