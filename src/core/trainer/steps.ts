/**
 * Note-name trainer steps as data (content/trainer/steps.json, ft_0_17.AC5): each step is a MIDI range
 * the trainer draws its targets from. Validated with zod; the JSON import is done by the caller.
 * Persisted-format rule: the file has a `schemaVersion`, and a new version needs a migration (docs/testing.md section 4).
 */
import { z } from 'zod';
import { PIECE_HIGH, PIECE_LOW } from '../chart/pitch';
import type { TrainerRange } from './noteTrainer';

const midiKey = z.number().int().min(PIECE_LOW).max(PIECE_HIGH);

export const trainerStepSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    range: z.object({ low: midiKey, high: midiKey }),
  })
  .refine((s) => s.range.low <= s.range.high, { message: 'range low must not be above high' });

export const trainerStepsSchema = z.object({
  schemaVersion: z.literal(1),
  note: z.string().optional(),
  steps: z.array(trainerStepSchema).min(1),
});

export type TrainerSteps = z.infer<typeof trainerStepsSchema>;
export type TrainerStep = z.infer<typeof trainerStepSchema>;

/** Validate the steps file and return it. Throws a ZodError on bad data. */
export function loadTrainerSteps(json: unknown): TrainerSteps {
  return trainerStepsSchema.parse(json);
}

/** The key range of a step, ready for `createRound`. */
export function rangeOf(step: TrainerStep): TrainerRange {
  return { low: step.range.low, high: step.range.high };
}
