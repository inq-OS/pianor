import { describe, expect, it } from 'vitest';
import { BOOK_ORDERS, orderBook, type BookEntry } from './bookOrder';

const entry = (id: string, more: Partial<BookEntry> = {}): BookEntry => ({ id, title: id, level: 1, stars: 0, daysLeft: null, lastPlayedAt: null, ...more });

const ids = (entries: readonly BookEntry[]) => entries.map((e) => e.id);

describe('the order of the piece book', () => {
  const book = [
    entry('c', { title: 'Cedar', level: 3, stars: 2, daysLeft: 5, lastPlayedAt: '1999-01-02T00:00:00Z' }),
    entry('a', { title: 'apple', level: 1, stars: 5, daysLeft: null, lastPlayedAt: '1999-01-03T00:00:00Z' }),
    entry('b', { title: 'Birch', level: 2, stars: 0, daysLeft: 1, lastPlayedAt: null }),
    entry('d', { title: 'Dune', level: 2, stars: 2, daysLeft: null, lastPlayedAt: null }),
  ];

  it('ft_1_12.AC11 the book order keeps the pieces as they come', () => {
    expect(ids(orderBook(book, 'book'))).toEqual(['c', 'a', 'b', 'd']);
  });

  it('ft_1_12.AC11 achieved: most stars first, ties in book order', () => {
    expect(ids(orderBook(book, 'achieved'))).toEqual(['a', 'c', 'd', 'b']);
  });

  it('ft_1_12.AC11 deadline: the fewest days left first, pieces with no deadline after them in book order', () => {
    expect(ids(orderBook(book, 'deadline'))).toEqual(['b', 'c', 'a', 'd']);
  });

  it('ft_1_12.AC11 difficulty: the lowest level first, ties in book order', () => {
    expect(ids(orderBook(book, 'difficulty'))).toEqual(['a', 'b', 'd', 'c']);
  });

  it('ft_1_12.AC11 title: A to Z whatever the case', () => {
    expect(ids(orderBook(book, 'title'))).toEqual(['a', 'b', 'c', 'd']);
  });

  it('ft_1_12.AC11 recent: the last played first, never played after them in book order', () => {
    expect(ids(orderBook(book, 'recent'))).toEqual(['a', 'c', 'b', 'd']);
  });

  it('every order is listed once and leaves the list given as it was', () => {
    expect(new Set(BOOK_ORDERS).size).toBe(BOOK_ORDERS.length);
    const copy = [...book];
    for (const order of BOOK_ORDERS) orderBook(book, order);
    expect(book).toEqual(copy);
  });
});
