/**
 * Whether a menu card's label `shown` is the piece title `title`: the whole title, or its start cut with a dot where the card's
 * signs (a curriculum piece's hat and days left, a character's bubble) leave too little room (`clipToWidth`, ft_1_26.AC8).
 */
export function showsTitle(shown: string, title: string): boolean {
  if (shown === title) return true;
  return shown.length > 1 && shown.endsWith('.') && title.startsWith(shown.slice(0, -1));
}

/** Of `labels`, the index of the card that shows `title`: a whole title before a cut one. -1 when none does. */
export function cardShowing(labels: readonly string[], title: string): number {
  const whole = labels.indexOf(title);
  return whole >= 0 ? whole : labels.findIndex((shown) => showsTitle(shown, title));
}
