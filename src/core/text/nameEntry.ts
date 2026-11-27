/**
 * The letters a student types into the name box (ft_1_07, d306): the Estonian alphabet, plus Q, W, X and Y for names from
 * other languages. Each entry is one letter, in capitals.
 */
export const NAME_LETTERS: readonly string[] = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'Š', 'Z', 'Ž', 'T',
  'U', 'V', 'W', 'Õ', 'Ä', 'Ö', 'Ü', 'X', 'Y',
];

/** What may stand between two letters of a name (Mari-Liis, Anna Maria; d306): one at a time, never at an end. */
export const NAME_SEPARATORS: readonly string[] = [' ', '-'];

/** The longest name the box takes, in letters (a space or hyphen counts as one). */
export const NAME_MAX = 12;

const isSeparator = (c: string | undefined): boolean => c !== undefined && NAME_SEPARATORS.includes(c);

/**
 * The name with one more letter at the end; a full name is returned unchanged. A space or hyphen is taken only after a
 * letter and with room left for a letter after it; anything else is dropped.
 */
export function typeLetter(name: string, letter: string): string {
  const letters = Array.from(name);
  if (letters.length >= NAME_MAX) return name;
  if (NAME_LETTERS.includes(letter)) return name + letter;
  if (!isSeparator(letter)) return name;
  const last = letters.at(-1);
  if (last === undefined || isSeparator(last) || letters.length >= NAME_MAX - 1) return name;
  return name + letter;
}

/** The name without its last letter (a whole letter, so an accented one goes in one press). */
export function deleteLetter(name: string): string {
  return Array.from(name).slice(0, -1).join('');
}

/**
 * A name typed into a text field (the tablet's own keyboard, ft_1_07.AC6): in capitals, only the name letters and a single
 * space or hyphen between them, at most `NAME_MAX`; anything else typed is dropped. A space or hyphen at the end stays, as
 * the next letter may follow; `finishedName` drops it.
 */
export function nameFrom(text: string): string {
  let name = '';
  for (const c of text.toLocaleUpperCase('et')) name = typeLetter(name, c);
  return name;
}

/** The name as it is saved when Done is pressed: no space or hyphen left at its end. */
export function finishedName(name: string): string {
  const letters = Array.from(name);
  while (isSeparator(letters.at(-1))) letters.pop();
  return letters.join('');
}
