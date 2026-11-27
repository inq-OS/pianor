/**
 * A trainer round's result as one objective line (ft_0_17.AC11, AX-2): how many were right and the XP earned, "12 correct,
 * 110 XP". Shared by the trainers that end a round (note names, scales and chords, chord names). Pure: text only.
 */
import { t } from '../text/strings';

/** The line for `count` right answers and `xp` earned in the round. */
export function roundResultLine(count: number, xp: number): string {
  return t(count === 1 ? 'trainer.roundResultOne' : 'trainer.roundResult', { n: count, xp });
}
