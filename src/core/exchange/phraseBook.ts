/**
 * The phrase book (ft_1_22.AC5, WP-12): every phrase a character taught the student, by character, *heard* until it is
 * played clean on a later day than it was taught, then *mine*. Derived, not stored (d092): the taught phrases and their
 * days are in the world (`MetRecord.taught`, `taughtOn`), the clean plays in the practice log (the caller reads them, e.g.
 * `cleanPlayDays`). Pure.
 * A phrase saved before its day was kept counts from the character's `lastDay`, the latest it can have been taught, so no
 * clean play from before its teaching makes it mine (AX-1: the harder reading). The check from memory and the style that
 * fills most of the book are to come (TODO in ft_1_22).
 */
import type { CharacterId, DayString, PieceId } from '../contracts';
import type { WorldState } from '../island/worldState';

export interface PhraseEntry {
  readonly piece: PieceId;
  readonly character: CharacterId;
  readonly taughtOn: DayString;
  readonly state: 'heard' | 'mine';
}

/** The book, in the order the characters were saved and each one's phrases in the order taught. */
export function phraseBook(world: WorldState, cleanDays: (piece: PieceId) => readonly DayString[]): PhraseEntry[] {
  return Object.entries(world.met).flatMap(([character, met]) => met.taught.map((piece): PhraseEntry => {
    const taughtOn = met.taughtOn?.[piece] ?? met.lastDay;
    const mine = cleanDays(piece).some((day) => day > taughtOn);
    return { piece, character, taughtOn, state: mine ? 'mine' : 'heard' };
  }));
}
