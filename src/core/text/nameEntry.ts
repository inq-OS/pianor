/**
 * The letters a student types into the name picker (ft_1_07): the Estonian alphabet, plus X and Y for loan words. Six per
 * row, five rows, so the picker is one grid of big buttons. Each entry is one letter, in capitals.
 */
export const NAME_LETTERS: readonly string[] = [
  'A', 'B', 'C', 'D', 'E', 'F',
  'G', 'H', 'I', 'J', 'K', 'L',
  'M', 'N', 'O', 'P', 'R', 'S',
  'Š', 'Z', 'Ž', 'T', 'U', 'V',
  'Õ', 'Ä', 'Ö', 'Ü', 'X', 'Y',
];

/** The longest name the picker takes, in letters. */
export const NAME_MAX = 12;

/** The name with one more letter at the end; a full name is returned unchanged. */
export function typeLetter(name: string, letter: string): string {
  if (Array.from(name).length >= NAME_MAX) return name;
  return name + letter;
}

/** The name without its last letter (a whole letter, so an accented one goes in one press). */
export function deleteLetter(name: string): string {
  return Array.from(name).slice(0, -1).join('');
}
