/**
 * `Conversation` (ft_1_22, ft_1_27; WP-09; contract A.6): a talk as data, stepped by a pure interpreter (WP-09). File:
 * `content/conversations/<id>.json`. The schema checks the shape only; references (an unreachable node, a missing key, a
 * branch that does not reach playing or leaving within 4 presses) are the linter's (WP-09).
 */
import { z } from 'zod';
import {
  idSchema, pieceIdSchema, stringKeySchema,
  type CharacterId, type ConversationId, type ItemId, type NodeId, type PieceId, type StringKey,
} from '../contracts';

export type Speaker = 'character' | 'student' | 'kiur';

export interface Conversation {
  readonly schemaVersion: 1;
  readonly id: ConversationId;
  readonly start: NodeId;
  readonly nodes: Readonly<Record<NodeId, ConversationNode>>;
}
export interface ConversationNode {
  readonly speaker: Speaker;
  readonly line: StringKey;
  /** A node whose condition fails is skipped to `next`. */
  readonly when?: Condition;
  /** At most 3; the student's lines. */
  readonly choices?: readonly Choice[];
  /** Without choices; none ends the talk. */
  readonly next?: NodeId;
  /** Applied when the node is shown. */
  readonly effects?: readonly Effect[];
}
/** @public */
export interface Choice { readonly text: StringKey; readonly next: NodeId; readonly when?: Condition }

export type Condition =
  | { readonly flag: string } | { readonly notFlag: string }
  | { readonly hasItem: ItemId } | { readonly met: CharacterId }
  | { readonly taught: PieceId } | { readonly levelAtLeast: number }
  /** The per-player knowledge switch (d132). */
  | { readonly knowledge: boolean }
  | { readonly all: readonly Condition[] } | { readonly any: readonly Condition[] };

export type Effect =
  | { readonly setFlag: string } | { readonly clearFlag: string }
  | { readonly give: ItemId } | { readonly take: ItemId }
  /** Starts a teaching exchange (A.10). */
  | { readonly teach: PieceId }
  /** Starts the tug at that level (the show, d135). */
  | { readonly tug: 1 | 2 | 3 }
  /** The teacher's check-up (ft_1_27). */
  | { readonly checkup: PieceId }
  /** Opens a knowledge topic. */
  | { readonly topic: string }
  | { readonly leave: true };

const flagSchema = z.string().min(1);

const conditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z.strictObject({ flag: flagSchema }),
    z.strictObject({ notFlag: flagSchema }),
    z.strictObject({ hasItem: idSchema }),
    z.strictObject({ met: idSchema }),
    z.strictObject({ taught: pieceIdSchema }),
    z.strictObject({ levelAtLeast: z.number().int().min(1) }),
    z.strictObject({ knowledge: z.boolean() }),
    z.strictObject({ all: z.array(conditionSchema).min(1) }),
    z.strictObject({ any: z.array(conditionSchema).min(1) }),
  ]),
);

const effectSchema = z.union([
  z.strictObject({ setFlag: flagSchema }),
  z.strictObject({ clearFlag: flagSchema }),
  z.strictObject({ give: idSchema }),
  z.strictObject({ take: idSchema }),
  z.strictObject({ teach: pieceIdSchema }),
  z.strictObject({ tug: z.union([z.literal(1), z.literal(2), z.literal(3)]) }),
  z.strictObject({ checkup: pieceIdSchema }),
  z.strictObject({ topic: z.string().min(1) }),
  z.strictObject({ leave: z.literal(true) }),
]);

const choiceSchema = z.strictObject({ text: stringKeySchema, next: idSchema, when: z.exactOptional(conditionSchema) });

const nodeSchema = z.strictObject({
  speaker: z.enum(['character', 'student', 'kiur']),
  line: stringKeySchema,
  when: z.exactOptional(conditionSchema),
  choices: z.exactOptional(z.array(choiceSchema).min(1).max(3)),
  next: z.exactOptional(idSchema),
  effects: z.exactOptional(z.array(effectSchema)),
});

export const conversationSchema: z.ZodType<Conversation> = z.strictObject({
  schemaVersion: z.literal(1),
  id: idSchema,
  start: idSchema,
  nodes: z.record(idSchema, nodeSchema),
});
