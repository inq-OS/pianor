/**
 * Which pieces a player has turned off (profile version 5 on). A piece that is off is hidden from the menu and never offered
 * in a tug; nothing is deleted, so turning it on again brings it back with its stars. Pure rules; the menu and the list
 * screen only call them.
 */
import { z } from 'zod';

export const piecesSettingsSchema = z.object({
  /** Ids of the pieces turned off. Every other piece is on, including pieces added later. Ids of pieces that no longer exist are ignored. */
  hidden: z.array(z.string().min(1)),
  /**
   * The parts of each song turned off, by song id: node ids (ft_1_36 rule 5). Absent means every part of every song is on;
   * optional, so older saves read as they are (d069.3). Ids of songs or nodes that no longer exist are ignored.
   */
  songs: z.record(z.string(), z.array(z.string().min(1))).optional(),
  /** Whether the player was told, on a first visit to a song page, what a tick does (ft_1_36 rule 10). Optional, no version bump (d069.3): absent reads as not yet. */
  songTickTold: z.boolean().optional(),
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
  if (on) return { ...settings, hidden: settings.hidden.filter((id) => id !== pieceId) };
  if (!canTurnOff(settings, pieceId, offered)) return settings;
  return isPieceOn(settings, pieceId) ? { ...settings, hidden: [...settings.hidden, pieceId] } : settings;
}

/** A second press on an armed hide sooner than this after the first is a double click, not a confirmation (ft_1_02c.AC8). */
export const HIDE_SECOND_PRESS_MS = 500;

/** The hide pressed once, and when (ms on any one clock). */
export interface ArmedHide { piece: string; at: number }

/**
 * A press on a piece's hide button in the book (ft_1_02c.AC8) at time `now`: the first press arms it (the book shows what
 * will happen), a second press on the same piece hides it, unless it comes within `HIDE_SECOND_PRESS_MS` (a double click
 * or a held key), which leaves it armed. A press on another piece arms that one.
 */
export function pressHide(armed: ArmedHide | null, pieceId: string, now: number): { armed: ArmedHide | null; hide: string | null } {
  if (armed?.piece !== pieceId) return { armed: { piece: pieceId, at: now }, hide: null };
  return now - armed.at < HIDE_SECOND_PRESS_MS ? { armed, hide: null } : { armed: null, hide: pieceId };
}

/** The node ids of a song the player turned off (ft_1_36 rule 5). */
export function songPartsOff(settings: PiecesSettings, songId: string): readonly string[] {
  return settings.songs?.[songId] ?? [];
}

/**
 * The pieces the piece book can show, of `ids`: all but a song's own pieces (ft_1_36 rule 13), which are filed under their
 * song. These are the ones the guard "keep one piece on" counts.
 */
export function bookPieces(ids: readonly string[], inSongs: ReadonlySet<string>): string[] {
  return ids.filter((id) => !inSongs.has(id));
}

/** The settings with a song's parts that are off replaced by `off`. */
export function withSongPartsOff(settings: PiecesSettings, songId: string, off: readonly string[]): PiecesSettings {
  const songs = { ...settings.songs, [songId]: [...off] };
  if (off.length === 0) delete songs[songId];
  return { ...settings, songs };
}
