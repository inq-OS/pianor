/**
 * The result of a trainer round in one objective line (AX-2.1), for every trainer that ends a round (note names ft_0_17,
 * scales and chords ft_1_29): what was played right, and the XP it earned, in numbers and marks (d312): "9/15  +90 XP",
 * "✓12  +120 XP"; a chord round's count stands after the triad icon the scene draws ("4  +120 XP"). Also the level a
 * round's XP reached. Pure: no DOM, no engine.
 */
import { countMark, MARK } from '../text/marks';
import { t } from '../text/strings';

export interface RoundTally {
  /** What is counted: right notes, or chords played. */
  unit: 'notes' | 'chords';
  /** How many were played right. */
  right: number;
  /** How many the round had, when it has a fixed number (a scale); none for an open-ended round. */
  total?: number;
  /** The XP the round earned (all of it is kept, won or lost). */
  xp: number;
}

/** The round's result line: the count against the total when there is one, then the XP. */
export function roundResultLine(tally: RoundTally): string {
  const count = tally.total !== undefined ? countMark(tally.right, tally.total) : tally.unit === 'notes' ? `${MARK.right}${tally.right}` : String(tally.right);
  return t('trainerResult.withXp', { result: count, xp: tally.xp });
}

/** The level the player reached when XP was added, or null when it stayed the same. */
export function levelReached(before: number, after: number): number | null {
  return after > before ? after : null;
}
