import type { Bitmap } from './bitmap';

/**
 * Painted grounds kept by their size (the desk, the beam, a card, a book): a screen draws again after every change that
 * moves things, and a painter costs tens of milliseconds, so each size is painted once. Only the latest few are kept.
 */
const KEEP = 12;
const painted = new Map<string, Bitmap>();

/** The picture for `key`, painted by `paint` the first time it is asked for. */
export function paintedOnce(key: string, paint: () => Bitmap): Bitmap {
  const known = painted.get(key);
  if (known) {
    painted.delete(key);
    painted.set(key, known);
    return known;
  }
  const bitmap = paint();
  painted.set(key, bitmap);
  while (painted.size > KEEP) painted.delete(painted.keys().next().value!);
  return bitmap;
}
