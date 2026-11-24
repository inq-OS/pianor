/**
 * The rules for a piece's title (ft_1_02a.AC15): never empty, and never one another piece has. Titles are compared with
 * their case and their spaces ignored, so "Waltz", "waltz" and " WALTZ " are the same title.
 */

/** A title as it is compared: trimmed, every run of spaces one space, lower case. */
export function titleKey(title: string): string {
  return title.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

/** Why a title cannot be saved: `blank` when it is empty, `taken` when one of `taken` (other pieces' titles) is the same; null when it can. */
export function titleProblem(title: string, taken: Iterable<string>): 'blank' | 'taken' | null {
  const key = titleKey(title);
  if (key === '') return 'blank';
  for (const other of taken) if (titleKey(other) === key) return 'taken';
  return null;
}

/** The title itself when it is free, else the title with the first number from 2 that makes it free ("Waltz 2"). Empty stays empty. */
export function freeTitle(title: string, taken: Iterable<string>): string {
  const base = title.trim().replace(/\s+/g, ' ');
  if (base === '') return '';
  const keys = new Set([...taken].map(titleKey));
  let free = base;
  for (let n = 2; keys.has(titleKey(free)); n++) free = `${base} ${n}`;
  return free;
}
