/**
 * Which pieces a player has turned off (profile version 5 on). A piece that is off is hidden from the menu and never offered
 * in a battle; nothing is deleted, so turning it on again brings it back with its stars. Pure rules; the menu and the list
 * screen only call them.
 */
import { z } from 'zod';

export const piecesSettingsSchema = z.object({
  /** Ids of the pieces turned off. Every other piece is on, including pieces added later. Ids of pieces that no longer exist are ignored. */
  hidden: z.array(z.string().min(1)),
});

export type PiecesSettings = z.infer<typeof piecesSettingsSchema>;

/** Every piece on. */
export const DEFAULT_PIECES_SETTINGS: PiecesSettings = { hidden: [] };

export function isPieceOn(settings: PiecesSettings, pieceId: string): boolean {
  return !settings.hidden.includes(pieceId);
}

/**
 * Whether the piece may be turned off: not when it is the last piece on among `offered` (the pieces the player can play now: unlocked ones, not padlocked cards),
 * which would leave the player with an empty menu. A piece that is already off, or is not on offer, never blocks.
 */
export function canTurnOff(settings: PiecesSettings, pieceId: string, offered: readonly string[]): boolean {
  if (!offered.includes(pieceId) || !isPieceOn(settings, pieceId)) return true;
  return offered.some((id) => id !== pieceId && isPieceOn(settings, id));
}

/**
 * The settings with one piece turned on or off. Turning off the last piece that is on changes nothing (see `canTurnOff`).
 * Returns new settings; the ones given stay as they were.
 */
export function setPieceOn(settings: PiecesSettings, pieceId: string, on: boolean, offered: readonly string[]): PiecesSettings {
  if (on) return { hidden: settings.hidden.filter((id) => id !== pieceId) };
  if (!canTurnOff(settings, pieceId, offered)) return settings;
  return isPieceOn(settings, pieceId) ? { hidden: [...settings.hidden, pieceId] } : settings;
}
