/**
 * `SceneData` (ft_1_24, WP-05; d137; contract A.3): a scene as data, run by one `AdventureScene`. File:
 * `content/scenes/<id>.json`, one per scene; its id is the world model's scene id (`content/world/keri.json`). Positions are
 * fine-grid pixels of the 640 x 360 canvas (d110). No walk area in the MVP; a later version adds `walkArea` as optional.
 */
import { z } from 'zod';
import {
  facingSchema, idSchema, rectSchema, stringKeySchema,
  type Facing, type PlaceId, type Rect, type SceneId, type StringKey,
} from '../contracts';

export interface SceneData {
  readonly schemaVersion: 1;
  readonly id: SceneId;
  /** The painted picture's id in `tools/art/pictures.ts`; the hour comes from the sky (ft_1_14). */
  readonly picture: string;
  readonly hotspots: readonly Hotspot[];
  /** Where actors stand. */
  readonly places: readonly StandingPlace[];
  readonly exits: readonly Exit[];
  /** What the place has to do with music (d132), shown on looking. */
  readonly musicTie?: StringKey;
}
/** @public */
export interface Hotspot { readonly id: string; readonly area: Rect; readonly name: StringKey; readonly look: StringKey; readonly place?: PlaceId }
/** @public */
export interface StandingPlace { readonly id: PlaceId; readonly x: number; readonly y: number; readonly facing: Facing; /** default 1 */ readonly scale?: number }
/** @public */
export interface Exit {
  readonly id: string;
  readonly area: Rect;
  /** `SceneId | 'map' | 'room'` in the contract; written as `SceneId` alone, which already holds the two words (lint). */
  readonly to: SceneId;
  readonly name: StringKey;
}

const hotspotSchema = z.strictObject({
  id: idSchema,
  area: rectSchema,
  name: stringKeySchema,
  look: stringKeySchema,
  place: z.exactOptional(idSchema),
});

const standingPlaceSchema = z.strictObject({
  id: idSchema,
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  facing: facingSchema,
  scale: z.exactOptional(z.number().positive()),
});

/** `to` is a scene id or one of the two places every scene can lead to; both are kebab ids. */
const exitSchema = z.strictObject({ id: idSchema, area: rectSchema, to: idSchema, name: stringKeySchema });

export const sceneDataSchema: z.ZodType<SceneData> = z.strictObject({
  schemaVersion: z.literal(1),
  id: idSchema,
  picture: idSchema,
  hotspots: z.array(hotspotSchema),
  places: z.array(standingPlaceSchema),
  exits: z.array(exitSchema),
  musicTie: z.exactOptional(stringKeySchema),
});
