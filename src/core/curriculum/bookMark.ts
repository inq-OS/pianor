/**
 * What the teacher's hat on a curriculum piece in the piece book shows (ft_1_26.AC8): the days left to
 * the deadline and how near the piece's level is to the expected one; a finished piece (retained at its expected level, the
 * strong green of d139) shows its medal instead. Pure.
 *
 * AX-3 provisional: "how near" is the measured level over the expected level (what the player has played, not the trend's
 * guess); TODO(architect) in ft_1_26 to confirm it.
 */
import type { DayString } from '../contracts';
import { dayNumber } from './evaluate';
import type { Medal, PieceStatus } from './play';

export interface CurriculumMark {
  /** Retained at the expected level (d139's strong green). */
  readonly finished: boolean;
  readonly medal?: Medal;
  /** Whole days from `today` to the deadline; 0 on and after it. */
  readonly daysLeft: number;
  /** The level over the expected level, 0 to 1; 0 before there is a level. */
  readonly closeness: number;
}

export function curriculumMark(status: PieceStatus, deadline: DayString, today: DayString): CurriculumMark {
  const finished = status.colour === 'strongGreen';
  const daysLeft = Math.max(0, dayNumber(deadline) - dayNumber(today));
  const closeness = finished ? 1 : status.level === null || status.expected <= 0 ? 0 : Math.min(1, Math.max(0, status.level / status.expected));
  return { finished, ...(finished && status.medal !== undefined ? { medal: status.medal } : {}), daysLeft, closeness };
}
