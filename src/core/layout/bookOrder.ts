/**
 * The orders the piece book can be read in (ft_1_12.AC11): as the game lists the pieces (`book`), by stars earned, by the
 * teacher's deadline, by the piece's level, by title, or by when the piece was last played. Pure; the menu draws the result.
 */
export const BOOK_ORDERS = ['book', 'achieved', 'deadline', 'difficulty', 'title', 'recent'] as const;
export type BookOrder = (typeof BOOK_ORDERS)[number];

/** What an order reads of a piece. */
export interface BookEntry {
  id: string;
  title: string;
  /** The piece's curriculum level. */
  level: number;
  /** The five-star grade of its best play, 0 when not played. */
  stars: number;
  /** Days left to the teacher's deadline; null when the piece has none (or it is finished). */
  daysLeft: number | null;
  /** ISO time of the last play; null when never played. */
  lastPlayedAt: string | null;
}

/** A comparison where `null` (no value) always goes last. */
function lastWhenNull<T>(a: T | null, b: T | null, compare: (a: T, b: T) => number): number {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
  return compare(a, b);
}

const COMPARE: Readonly<Record<BookOrder, (a: BookEntry, b: BookEntry) => number>> = {
  book: () => 0,
  achieved: (a, b) => b.stars - a.stars,
  deadline: (a, b) => lastWhenNull(a.daysLeft, b.daysLeft, (x, y) => x - y),
  difficulty: (a, b) => a.level - b.level,
  title: (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }),
  recent: (a, b) => lastWhenNull(a.lastPlayedAt, b.lastPlayedAt, (x, y) => (x < y ? 1 : x > y ? -1 : 0)),
};

/** The entries in `order`; ties keep the order they came in (a stable sort), and the list given is not changed. */
export function orderBook<E extends BookEntry>(entries: readonly E[], order: BookOrder): E[] {
  return [...entries].sort(COMPARE[order]);
}
