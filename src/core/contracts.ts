/**
 * The shared names of the characters and teacher programme's contracts (WP-01; docs/architect/program-characters-teacher.md,
 * appendix A.1). The appendix is the source: a change here goes through the architect. Pure: no Phaser, DOM, MIDI or audio.
 */
import { z } from 'zod';
import type { Rect } from './layout/rect';

/**
 * A key in the strings tables (write-ui-text). In content it is any non-empty key; the content's linter checks that the key
 * exists (A.1). Not the same type as `StringKey` in `text/strings.ts`, which is the closed set the game ships today.
 */
export type StringKey = string;
/** The player's local calendar day, 'YYYY-MM-DD'; the seeded daily random keys on it. */
export type DayString = string;
export type SceneId = string;
export type PlaceId = string;
export type ActorId = string;
export type CharacterId = string;
export type ConversationId = string;
export type NodeId = string;
export type ScriptId = string;
export type ItemId = string;
/** A piece's id as today (`content/pieces/<id>`, own pieces too). */
export type PieceId = string;
/** Grows by decision only. */
export type StyleTag = 'classical' | 'jazz' | 'folk';
export type Facing = 'left' | 'right' | 'front' | 'back';
export type Hand = 'left' | 'right';
export type { Rect };

/** Ids are lowercase kebab strings, unique in their kind (A.1). */
export const idSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'an id is lowercase kebab: a-z, 0-9 and single dashes');
/** A string key: never words in data (A.1). Dots, letters, digits, dashes and underscores. */
export const stringKeySchema = z.string().regex(/^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/, 'a string key, not words');
/** A piece's id as today: own pieces' ids are not kebab, so only non-empty. */
export const pieceIdSchema = z.string().min(1);
export const styleTagSchema = z.enum(['classical', 'jazz', 'folk']);
export const facingSchema = z.enum(['left', 'right', 'front', 'back']);
/** A box in fine-grid pixels of the 640 x 360 canvas (d110), origin top left. */
export const rectSchema = z.strictObject({
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.number().int().positive(),
  h: z.number().int().positive(),
});
