/**
 * What Kiur remembers of today, per player, while the game is open (ft_1_27.AC3, WP-15): whether the room was visited yet
 * since the game opened, the visits today and whether Kiur reminded today. AX-3 provisional: kept in memory only, not
 * saved, so a game opened again the same day reminds once more (the harder option, AX-1).
 */
import type { DayString } from '../../core/contracts';

interface KiurDay {
  day: DayString;
  visits: number;
  reminded: boolean;
}

const days = new Map<string, KiurDay>();

/**
 * A visit to the room: `open` for the first one after the game opened, `room` for every later one, with the visits today
 * before this one and whether Kiur already reminded today. Counts the visit.
 */
export function roomVisit(player: string, day: DayString): { occasion: 'open' | 'room'; visit: number; remindedToday: boolean } {
  const known = days.get(player);
  const today = known?.day === day ? known : { day, visits: 0, reminded: false };
  days.set(player, { ...today, visits: today.visits + 1 });
  return { occasion: known === undefined ? 'open' : 'room', visit: today.visits, remindedToday: today.reminded };
}

/** Kiur said a reminder to `player` on `day`. */
export function remindedOn(player: string, day: DayString): void {
  const known = days.get(player);
  days.set(player, { day, visits: known?.day === day ? known.visits : 0, reminded: true });
}

/** Forgets every player's day (for the tests). */
export function forgetKiurDays(): void {
  days.clear();
}
