/**
 * `ActorDef` (ft_1_24, WP-05; contract A.4): how a figure is drawn and animated. File: `content/actors/<id>.json`; the sprite
 * sheet is the painter's (`src/game/ui/pixel/`), named by `sheet`, or the figure is the template character (d142) with its
 * chosen `features`: exactly one of the two. `idle` is required; any other missing state falls back to `idle`. Facing left
 * is the right-facing frames mirrored unless the sheet has its own.
 */
import { z } from 'zod';
import { idSchema, type ActorId } from '../contracts';

export type ActorState = 'idle' | 'talk' | 'play' | 'listen' | 'walk';

/** @public */
export interface ActorAnimation { readonly frames: number; readonly fps: number; readonly loop: boolean }

export interface ActorDef {
  readonly schemaVersion: 1;
  readonly id: ActorId;
  /** A hand-made figure's sprite sheet id (the painter's); a sheet the game does not have draws a labelled box of `size`. */
  readonly sheet?: string;
  /**
   * The template character (d142) with its chosen layers (head, hair, top, bottom, held, palette ramps); `generate` as a
   * value means drawn from the feature set with the seeded daily random.
   */
  readonly template?: { readonly features: Readonly<Record<string, string>> };
  /** One frame, fine-grid pixels. */
  readonly size: { readonly w: number; readonly h: number };
  /** The feet, inside the frame. */
  readonly anchor: { readonly x: number; readonly y: number };
  readonly states: Readonly<Partial<Record<ActorState, ActorAnimation>>>;
  /** The small figure that walks the map (WP-06), a sheet id. */
  readonly mapFigure?: string;
}

const animationSchema = z.strictObject({
  frames: z.number().int().positive(),
  fps: z.number().positive(),
  loop: z.boolean(),
});

const sizeSchema = z.strictObject({ w: z.number().int().positive(), h: z.number().int().positive() });

export const actorDefSchema: z.ZodType<ActorDef> = z
  .strictObject({
    schemaVersion: z.literal(1),
    id: idSchema,
    sheet: z.exactOptional(idSchema),
    template: z.exactOptional(z.strictObject({ features: z.record(z.string().min(1), z.string().min(1)) })),
    size: sizeSchema,
    anchor: z.strictObject({ x: z.number().int().min(0), y: z.number().int().min(0) }),
    states: z.partialRecord(z.enum(['idle', 'talk', 'play', 'listen', 'walk']), animationSchema),
    mapFigure: z.exactOptional(idSchema),
  })
  .refine((actor) => (actor.sheet === undefined) !== (actor.template === undefined), {
    message: 'an actor has exactly one of a sheet and a template',
    path: ['sheet'],
  })
  .refine((actor) => actor.states.idle !== undefined, { message: 'an actor needs the idle state', path: ['states', 'idle'] })
  .refine((actor) => actor.anchor.x <= actor.size.w && actor.anchor.y <= actor.size.h, {
    message: 'the anchor (the feet) is inside the frame',
    path: ['anchor'],
  });
