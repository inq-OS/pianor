/**
 * Practice time from the practice log (ft_1_25, WP-08): the minutes a player has played, counted from the bars of the log
 * (core_10, d092), never from the time the game was open. AX-3 provisional.
 */
import type { DayString } from '../contracts';
import type { PracticeLog } from './practiceLog';

/** A gap between two bars longer than this starts a new session and counts nothing (AX-3 provisional). */
export const SESSION_GAP_MS = 120_000;

/**
 * The practice minutes in the log, and those of `day` (by `dayOf`, the player's local calendar day of a bar's time). Each
 * bar counts the time since the bar before it, when that is at most `SESSION_GAP_MS`; the first bar of a session counts 0.
 */
export function practiceMinutes(log: PracticeLog, day: DayString, dayOf: (iso: string) => DayString): { total: number; today: number } {
  const times = log.bars.map((b) => ({ ms: Date.parse(b.at), day: dayOf(b.at) })).filter((t) => Number.isFinite(t.ms)).sort((a, b) => a.ms - b.ms);
  let total = 0;
  let today = 0;
  for (let i = 1; i < times.length; i++) {
    const gap = times[i]!.ms - times[i - 1]!.ms;
    if (gap > SESSION_GAP_MS) continue;
    total += gap;
    if (times[i]!.day === day) today += gap;
  }
  return { total: total / 60_000, today: today / 60_000 };
}
