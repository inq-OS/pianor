/**
 * `CharacterDef` (ft_1_22, ft_1_25, ft_1_21; WP-11; contract A.5): who a character is. File: `content/characters/<id>.json`.
 * No real person and nothing from a copyrighted novel (ft_1_21); a name on screen is the character's own, never a label word.
 */
import { z } from 'zod';
import {
  idSchema, pieceIdSchema, stringKeySchema, styleTagSchema,
  type ActorId, type CharacterId, type ConversationId, type ItemId, type PieceId, type SceneId, type StringKey, type StyleTag,
} from '../contracts';

export type CharacterKind = 'spirit' | 'visitor' | 'ghost' | 'teacher';

export type CharacterName =
  /** "Vana Toomas" */
  | { readonly kind: 'named'; readonly name: StringKey }
  /** "Vanamees" (an old man) */
  | { readonly kind: 'generic'; readonly name: StringKey }
  /** "Ats Kala", drawn once per player from the seeded random and kept in `WorldState`. */
  | { readonly kind: 'generated'; readonly pool: 'et-given-family' };

export interface CharacterDef {
  readonly schemaVersion: 1;
  readonly id: CharacterId;
  readonly kind: CharacterKind;
  readonly name: CharacterName;
  readonly styles: readonly StyleTag[];
  /** How it ties to music (d132). */
  readonly musicTie: StringKey;
  readonly actor: ActorId;
  readonly conversation: ConversationId;
  /** By tug level; ids of phrase pieces (difficulty 1 to 3, d138). */
  readonly phrases: Readonly<Partial<Record<1 | 2 | 3, readonly PieceId[]>>>;
  /**
   * The prize ladder (d132, ft_1_21.AC18): the item a won tug gives, by level, the first for level 1; each level beaten
   * gives a better one than the last, the last rung for the final level (the whole song, ft_1_32 slice 4).
   */
  readonly prizes?: readonly ItemId[];
  /** d273: the lines (string keys it says in its talk) that teach something of its specialty; at least one. */
  readonly lessons?: readonly StringKey[];
  /** d132: meeting counted in practice minutes, the cool-down after a lost tug in clean plays of that piece (3; ft_1_21.AC13, ft_1_25.AC3), never in hours. */
  readonly meet: { readonly practiceMinutes: number; readonly cooldownCleanPlays: number };
  /** Where it may be present. */
  readonly scenes: readonly SceneId[];
}

const characterNameSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('named'), name: stringKeySchema }),
  z.strictObject({ kind: z.literal('generic'), name: stringKeySchema }),
  z.strictObject({ kind: z.literal('generated'), pool: z.literal('et-given-family') }),
]);

const minutes = z.number().min(0);

export const characterDefSchema: z.ZodType<CharacterDef> = z.strictObject({
  schemaVersion: z.literal(1),
  id: idSchema,
  kind: z.enum(['spirit', 'visitor', 'ghost', 'teacher']),
  name: characterNameSchema,
  styles: z.array(styleTagSchema),
  musicTie: stringKeySchema,
  actor: idSchema,
  conversation: idSchema,
  /** JSON keys are text: '1' to '3' read as the tug levels 1 to 3. */
  phrases: z.partialRecord(z.enum(['1', '2', '3']), z.array(pieceIdSchema)),
  prizes: z.exactOptional(z.array(idSchema).min(1)),
  lessons: z.exactOptional(z.array(stringKeySchema).min(1)),
  meet: z.strictObject({ practiceMinutes: minutes, cooldownCleanPlays: z.int().min(0) }),
  scenes: z.array(idSchema),
});

/** The prize a won tug at `level` gives (ft_1_21.AC18): that rung of the character's ladder, none past its top or without one. */
export function prizeFor(def: Pick<CharacterDef, 'prizes'>, level: number): ItemId | undefined {
  return Number.isInteger(level) && level >= 1 ? def.prizes?.[level - 1] : undefined;
}

/**
 * Which character teaches each phrase piece (the piece book's character group): every piece any
 * character lists under `phrases`, at any tug level, by its id; the first character listed wins a piece two share.
 */
export function phrasePieceCharacters(characters: Iterable<Pick<CharacterDef, 'id' | 'phrases'>>): ReadonlyMap<PieceId, CharacterId> {
  const owners = new Map<PieceId, CharacterId>();
  for (const character of characters) {
    for (const pieces of Object.values(character.phrases)) for (const piece of pieces ?? []) if (!owners.has(piece)) owners.set(piece, character.id);
  }
  return owners;
}

/**
 * The world flag set when the student asks a character who it is (ft_1_22.AC10): until then the
 * character is shown as "???"; meeting it and talking is not enough. A conversation sets it with `setFlag`.
 */
export function knownFlag(id: CharacterId): string {
  return `known-${id}`;
}

/** Whether the student has asked `id` who it is (`knownFlag` among the world's flags). */
export function characterKnown(flags: readonly string[], id: CharacterId): boolean {
  return flags.includes(knownFlag(id));
}
