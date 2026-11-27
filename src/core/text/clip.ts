/**
 * `text` cut to at most `maxWidth` (in whatever unit `measure` gives), at whole letters, ending in a dot when cut: a long
 * player name on the toolbar (d088). The profile schema allows 40 letters, the name screen 12, so an imported name can be
 * longer than the toolbar has room for. Empty when not even one letter and the dot fit.
 */
export function clipToWidth(text: string, maxWidth: number, measure: (text: string) => number): string {
  if (measure(text) <= maxWidth) return text;
  const letters = Array.from(text);
  for (let n = letters.length - 1; n > 0; n--) {
    const clipped = `${letters.slice(0, n).join('').trimEnd()}.`;
    if (measure(clipped) <= maxWidth) return clipped;
  }
  return '';
}

/**
 * `text` whole when it fits `maxWidth`, else its first letter alone (a monogram): for a place that must never show a name
 * cut short, such as the room's rank shield (ft_1_20.AC13). Empty when not even the letter fits.
 */
export function wholeOrInitial(text: string, maxWidth: number, measure: (text: string) => number): string {
  if (measure(text) <= maxWidth) return text;
  const initial = Array.from(text.trimStart())[0] ?? '';
  return measure(initial) <= maxWidth ? initial : '';
}
