import { TEMPO_RULES } from '../learn/tempo';

/**
 * How a key played kept the student's own pace in a learning run (core_13 rule 9, ft_1_32 rule 8): even, early or late,
 * and far off when the run's verdict would not count it as even. The beat lane (`beatLane.ts`) colours the key's dot by it.
 * Pure.
 */
export type PaceSide = 'even' | 'early' | 'late';

export interface PaceMark {
  side: PaceSide;
  /** Off by more than `PACE_MARKS.far`: a gap that the run's evenness does not count (d281). */
  far: boolean;
  /** Where the key fell against the pace, in beats from its bar's first beat. */
  at: number;
}

/**
 * `AX-3 provisional:` a key is even within `near` of the gap the pace asks (the rushing margin, ft_1_32 rule 12), and far
 * off beyond `far`, the share that makes a gap uneven for the run's verdict (`TEMPO_RULES.tolerance`, d281); between the
 * two it shows early or late but still counts as even.
 */
export const PACE_MARKS = { near: 0.2, far: TEMPO_RULES.tolerance } as const;

/** How far a played gap is off the gap the pace asks, as a share: -0.3 is 30% short (early), 0.3 30% long (late). */
export function paceOff(writtenMs: number, playedMs: number, pace: number): number {
  return playedMs / (writtenMs * pace) - 1;
}

/** Whether a gap `off` (`paceOff`) is even, early or late, and whether it is far off. */
export function paceMark(off: number): Omit<PaceMark, 'at'> {
  const size = Math.abs(off);
  if (size <= PACE_MARKS.near) return { side: 'even', far: false };
  return { side: off < 0 ? 'early' : 'late', far: size > PACE_MARKS.far };
}
