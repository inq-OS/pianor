/**
 * Ear levels table as data (content/trainer/ear-levels.json, ft_1_10). Each row is a mode and the keys its questions use;
 * earRowFor (earTrainer.ts) reads row N for level N. Validated with zod; the JSON import is done by the caller.
 * Persisted-format rule: the file has a `schemaVersion`, and a new version needs a migration (docs/testing.md section 4).
 */
import { z } from 'zod';
import { EZ220_HIGH, EZ220_LOW } from '../chart/pitch';

const midiKey = z.number().int().min(EZ220_LOW).max(EZ220_HIGH);

export const earRowSchema = z
  .object({
    mode: z.enum(['single', 'two']),
    keys: z.array(midiKey).min(1),
  })
  .refine((row) => new Set(row.keys).size === row.keys.length, { message: 'keys must be distinct' })
  .refine((row) => row.mode === 'single' || row.keys.length >= 2, { message: 'a two-note row needs at least two keys' });

export const earLevelsSchema = z.object({
  schemaVersion: z.literal(1),
  note: z.string().optional(),
  levels: z.array(earRowSchema).min(1),
});

export type EarLevels = z.infer<typeof earLevelsSchema>;

/** Validate the ear levels file and return it. Throws a ZodError on bad data. */
export function loadEarLevels(json: unknown): EarLevels {
  return earLevelsSchema.parse(json);
}
