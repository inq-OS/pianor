import type { DayString } from '../../core/contracts';
import type { Curriculum } from '../../core/curriculum/curriculum';
import { DAY_MINUTES, minutesOf, orderTest, testWeekdaysOf, timeOf } from '../../core/island/teacher';
import { dayString } from '../../io/teacher/teacherDesk';

/**
 * Setting when the teacher comes to test (ft_1_26.AC9): the weekly test days, the time of day from which she comes, and a
 * test she orders for hours and minutes from now. Pure; `TeacherTestsScene` draws it.
 */

/** The week as an Estonian calendar shows it: Monday first (weekdays 0 Sunday to 6 Saturday). */
export const WEEK_ORDER: readonly number[] = [1, 2, 3, 4, 5, 6, 0];
/** A new order is for an hour from now. AX-3 provisional. */
export const DEFAULT_DELAY = 60;
/** The steps of the time of day, and of an order's delay, in minutes. */
export const TIME_STEPS: readonly number[] = [-60, -10, 10, 60];
export const DELAY_STEPS: readonly number[] = [-60, -5, 5, 60];
/** The latest an order can be: just under a day ahead. */
const MAX_DELAY = DAY_MINUTES - 5;

/** A weekly test day turned on or off. */
export function toggleWeekday(curriculum: Curriculum, weekday: number): Curriculum {
  const days = testWeekdaysOf(curriculum);
  const next = days.includes(weekday) ? days.filter((d) => d !== weekday) : [...days, weekday].sort((a, b) => a - b);
  return { ...curriculum, testWeekdays: next };
}

/** The time of day she comes from, stepped by `by` minutes round the clock. */
export function stepTestTime(curriculum: Curriculum, by: number): Curriculum {
  const minutes = (((minutesOf(curriculum.testTime) + by) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  return { ...curriculum, testTime: timeOf(minutes) };
}

/** An order's delay stepped by `by` minutes, from now to just under a day ahead. */
export function stepDelay(delay: number, by: number): number {
  return Math.min(MAX_DELAY, Math.max(0, delay + by));
}

/** A test ordered for `delay` minutes from `now`: on the day and at the minute (local) it falls on. */
export function orderIn(curriculum: Curriculum, now: Date, delay: number): Curriculum {
  const at = new Date(now.getTime() + delay * 60_000);
  return orderTest(curriculum, dayString(at), timeOf(at.getHours() * 60 + at.getMinutes()));
}

/** The tests she ordered (with a time, no piece) still to come after `now`, soonest first. */
export function orderedTests(curriculum: Curriculum, now: Date): { day: DayString; time: string }[] {
  const today = dayString(now);
  const minutes = now.getHours() * 60 + now.getMinutes();
  return curriculum.calendar
    .filter((c): c is typeof c & { time: string } => c.kind === 'test' && c.time !== undefined && c.piece === undefined)
    .filter((c) => c.day > today || (c.day === today && minutesOf(c.time) > minutes))
    .map((c) => ({ day: c.day, time: c.time }))
    .sort((a, b) => (a.day + a.time < b.day + b.time ? -1 : 1));
}
