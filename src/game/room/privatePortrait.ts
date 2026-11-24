import { PORTRAIT_MAX } from '../../core/layout/room';
import { fromAscii, type Bitmap } from '../ui/pixel/bitmap';
import { C } from '../ui/pixel/palette';

const PORTRAIT_MIN = 16;

/**
 * The private portrait for the room (d026), or null. It is a picture as rows of
 * letters and a legend of palette colour names, kept in the gitignored `private/room/portrait.json`: art the project
 * does not ship. A build made where
 * the file is absent has none, and the room shows the drawn portrait. A file that is not a sound picture is ignored.
 */
export function privatePortrait(raw: unknown): Bitmap | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { legend, rows } = raw as { legend?: unknown; rows?: unknown };
  if (typeof legend !== 'object' || legend === null || !Array.isArray(rows) || rows.length < PORTRAIT_MIN || rows.length > PORTRAIT_MAX.h) return null;
  const width = typeof rows[0] === 'string' ? rows[0].length : 0;
  if (width < PORTRAIT_MIN || width > PORTRAIT_MAX.w || rows.some((row) => typeof row !== 'string' || row.length !== width)) return null;
  const colours: Record<string, number> = {};
  for (const [letter, name] of Object.entries(legend)) {
    if (letter.length !== 1 || typeof name !== 'string' || !(name in C)) return null;
    colours[letter] = C[name as keyof typeof C];
  }
  if ((rows as string[]).some((row) => [...row].some((ch) => ch !== '.' && colours[ch] === undefined))) return null;
  return fromAscii(rows as string[], colours);
}
