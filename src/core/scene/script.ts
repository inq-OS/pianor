/**
 * `Script` (ft_1_24, ft_1_27, WP-07; contract A.7): a short scripted moment. File: `content/scripts/<id>.json`; run by the
 * scene, stepped by a pure interpreter (WP-07). Waits and fades are screen time in milliseconds (A.1).
 */
import { z } from 'zod';
import {
  facingSchema, idSchema, pieceIdSchema, stringKeySchema,
  type ActorId, type Facing, type ItemId, type PieceId, type PlaceId, type ScriptId, type StringKey,
} from '../contracts';

export type ScriptCommand =
  | { readonly walkTo: ActorId; readonly place: PlaceId }
  | { readonly face: ActorId; readonly facing: Facing }
  | { readonly say: ActorId; readonly line: StringKey }
  /** Milliseconds (screen time). */
  | { readonly wait: number }
  /** Through the audio output, not judged. */
  | { readonly playPhrase: ActorId; readonly piece: PieceId }
  | { readonly give: ItemId }
  | { readonly fade: 'out' | 'in'; readonly ms: number }
  | { readonly enter: ActorId; readonly place: PlaceId }
  | { readonly exit: ActorId };

export interface Script {
  readonly schemaVersion: 1;
  readonly id: ScriptId;
  readonly commands: readonly ScriptCommand[];
  /** Default true: a file without it is skippable (A.1). */
  readonly skippable: boolean;
}

const ms = z.number().int().min(0);

const scriptCommandSchema = z.union([
  z.strictObject({ walkTo: idSchema, place: idSchema }),
  z.strictObject({ face: idSchema, facing: facingSchema }),
  z.strictObject({ say: idSchema, line: stringKeySchema }),
  z.strictObject({ wait: ms }),
  z.strictObject({ playPhrase: idSchema, piece: pieceIdSchema }),
  z.strictObject({ give: idSchema }),
  z.strictObject({ fade: z.enum(['out', 'in']), ms }),
  z.strictObject({ enter: idSchema, place: idSchema }),
  z.strictObject({ exit: idSchema }),
]);

export const scriptSchema: z.ZodType<Script, unknown> = z.strictObject({
  schemaVersion: z.literal(1),
  id: idSchema,
  commands: z.array(scriptCommandSchema),
  skippable: z.boolean().default(true),
});
