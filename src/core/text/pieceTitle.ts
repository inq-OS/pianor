import { language, type Language } from './language.ts';

/**
 * The title of a piece as the student reads it (ft_0_18.AC4): the Estonian title where the piece gives one, otherwise the
 * English `title`. Pure: the language is passed in, or read from the active language.
 */
export function pieceTitle(piece: { title: string; titles?: { et?: string | undefined } | undefined }, lang: Language = language()): string {
  return (lang === 'et' ? piece.titles?.et : undefined) ?? piece.title;
}
