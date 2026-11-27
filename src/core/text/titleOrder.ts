const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

/** Titles in reading order: numbers by their value (Song 2 before Song 10), case ignored (ft_1_36.AC24). */
export function compareTitles(a: string, b: string): number {
  return collator.compare(a, b);
}
