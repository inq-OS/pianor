/**
 * The language the game shows (ft_0_18, d081). Pure module state, set once when the page loads (`?lang=en` for the
 * English catalog, used by the end-to-end tests). The default is Estonian, the game's first language.
 */
export type Language = 'et' | 'en';

export const DEFAULT_LANGUAGE: Language = 'et';

/**
 * `smallCaps`: capitals where the text has them, small capitals for its lowercase letters (the students's default, d086).
 * `upper`: every letter in capitals. `normal`: the text as written in the catalog.
 */
export type LetterCase = 'smallCaps' | 'upper' | 'normal';

let current: Language = DEFAULT_LANGUAGE;

export function language(): Language {
  return current;
}

export function setLanguage(next: Language): void {
  current = next;
}

/** The case a language shows by default: Estonian in small capitals (d086), English as written (today's game). */
export function defaultLetterCase(lang: Language): LetterCase {
  return lang === 'et' ? 'smallCaps' : 'normal';
}

/**
 * The text as it is drawn. Catalogs keep normal sentence case; the case is applied once, here, at the render boundary,
 * so piece titles, player names and parameters follow it too. `toLocaleUpperCase` takes the language, so Estonian
 * capitals are right in every locale. `smallCaps` keeps the text as written: the font draws its lowercase letters as small
 * capitals (`smallCaps` in the pixel font).
 */
export function displayText(text: string, letterCase?: LetterCase, lang: Language = current): string {
  const shown = letterCase ?? defaultLetterCase(lang);
  return shown === 'upper' ? text.toLocaleUpperCase(lang) : text;
}

/** Parse a language from a URL switch or a stored value; anything unknown is the default. */
export function parseLanguage(value: string | null | undefined): Language {
  return value === 'en' || value === 'et' ? value : DEFAULT_LANGUAGE;
}
