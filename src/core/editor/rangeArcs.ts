/**
 * Ties and slurs over selected bars (ft_1_02d.AC36): the bars a lasso or Shift + click selected are slurred or tied in one
 * press, with no first note to pick. Pure, like ties.ts and slurs.ts, whose rules it uses.
 */
import type { BarRange } from './bars';
import { withSlurs, type Edit, type EditorHand, type EditorNote, type EditorPiece } from './model';
import { onsetTick, slurSpan, slursOf } from './slurRules';
import { slurInto } from './slurs';
import { tieAll, tieTargetOf } from './ties';

const inside = (range: BarRange, bar: number): boolean => bar >= range.from && bar <= range.to;

/**
 * One slur per hand over the selected bars, from the first note of the hand in them to its last. A slur of that hand lying
 * wholly in the bars gives way to it; a hand with fewer than two onsets there gets none. Refused (the first hand's reason)
 * when no hand gets a slur.
 */
export function slurBars(piece: EditorPiece, range: BarRange): Edit {
  let next = piece;
  let refusal: Edit | null = null;
  for (const hand of ['RH', 'LH'] as const satisfies readonly EditorHand[]) {
    const notes = piece.notes.filter((n) => n.hand === hand && inside(range, n.bar));
    const tick = (n: EditorNote) => onsetTick(piece.beats, n);
    const first = notes.reduce<EditorNote | null>((a, n) => (a === null || tick(n) < tick(a) ? n : a), null);
    const last = notes.reduce<EditorNote | null>((a, n) => (a === null || tick(n) > tick(a) ? n : a), null);
    if (!first || !last || tick(first) === tick(last)) continue;
    const [lo, hi] = [tick(first), tick(last)];
    const kept = slursOf(next).filter((s) => {
      if (s.hand !== hand) return true;
      const [a, b] = slurSpan(piece.beats, s);
      return !(a >= lo && b <= hi);
    });
    const made = slurInto(withSlurs(next, kept), first, last);
    if (made.ok) next = made.piece;
    else refusal ??= made;
  }
  if (next !== piece) return { ok: true, piece: next };
  return refusal ?? { ok: false, reason: 'slur-target' };
}

/** Every repeated chord in the selected bars tied to its match right after it, when that match is in the bars too. */
export function tieBars(piece: EditorPiece, range: BarRange): Edit {
  const all = tieAll(piece);
  if (!all.ok) return all;
  let tied = false;
  const notes = piece.notes.map((n, i) => {
    const after = all.piece.notes[i]!;
    if (!after.tieNext || n.tieNext || !inside(range, n.bar)) return n;
    const target = tieTargetOf(piece, n);
    if (!target || !inside(range, target.bar)) return n;
    tied = true;
    return after;
  });
  return tied ? { ok: true, piece: { ...piece, notes } } : { ok: false, reason: 'tie-none' };
}
