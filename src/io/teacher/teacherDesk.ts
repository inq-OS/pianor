import type { DayString } from '../../core/contracts';
import type { KeyValueStore } from '../../core/progression';
import { DEFAULT_TEACHER_RECORD, TEACHER_RECORD_KEY } from '../../core/admin/teacherRecord';
import { createPasswordLock, type PasswordLock } from '../admin/passwordLock';

/**
 * What the teacher's screen needs besides the players' saves (ft_1_26, WP-14): her own password (d140). The curricula are each
 * player's `curriculum` save document, through `ProfileService` (d136). Scenes get only this.
 */
export interface TeacherDesk {
  readonly lock: PasswordLock;
}

/** The teacher's desk on the device's store, where her password record is kept (d140). `now` is the clock, for tests. */
export function createTeacherDesk(store: KeyValueStore, now?: () => number): TeacherDesk {
  return { lock: createPasswordLock(store, TEACHER_RECORD_KEY, DEFAULT_TEACHER_RECORD, now) };
}

/** The local calendar day of `date`, as a `DayString` ('YYYY-MM-DD'). */
export function dayString(date: Date): DayString {
  const two = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`;
}
