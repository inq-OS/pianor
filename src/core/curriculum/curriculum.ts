/**
 * `Curriculum` (core_12, ft_1_26, ft_1_25; WP-04; the `curriculum` save document; contract A.12): the pieces a teacher or a
 * parent set, with deadlines and priorities, and the calendar. WP-01 delivers the types only.
 */
import type { DayString, PieceId } from '../contracts';
import type { Cast } from '../island/cast';

export interface Curriculum {
  /** The expected level before priority, default 85. */
  readonly base: number;
  readonly pieces: readonly CurriculumPiece[];
  readonly calendar: readonly CalendarEntry[];
  /**
   * The teacher's weekly test days (ft_1_26.AC9): weekdays, 0 Sunday to 6 Saturday, on which her boat lands and she checks
   * the most urgent piece she has not passed. Absent in older saves and by default: Sunday and Wednesday
   * (`DEFAULT_TEST_WEEKDAYS`); an empty list means none.
   */
  readonly testWeekdays?: readonly number[];
  /**
   * The time of day, `HH:MM` in the player's local time, from which the teacher comes on a weekly test day or a deadline
   * (ft_1_26.AC9). Absent in older saves and by default: from the start of the day.
   */
  readonly testTime?: string;
  /**
   * The teacher's settings of the cast for this player (ft_1_37): each character on or off, its weekdays, its chance, its
   * piece and neediness, and the wanderers sent. Absent in older saves and by default: every character as before.
   */
  readonly cast?: Cast;
}
export interface CurriculumPiece {
  readonly piece: PieceId;
  readonly deadline: DayString;
  /** 1 to 10. */
  readonly priority: number;
  readonly overrides?: {
    readonly base?: number;
    /** X, default 10. */
    readonly lastPlays?: number;
    /** Y, Z, B (d139). */
    readonly retain?: { readonly atLeast: number; readonly belowAtMost: number; readonly byAtMost: number };
  };
}
export interface CalendarEntry {
  readonly day: DayString;
  readonly kind: 'deadline' | 'lesson' | 'test' | 'note';
  /** The teacher's own words; private to the device, never in the repository. */
  readonly text?: string;
  readonly piece?: PieceId;
  /** A `test` entry's time of day, `HH:MM` local, from which she comes (a test the teacher ordered, ft_1_26.AC9); absent: all day. */
  readonly time?: string;
}
