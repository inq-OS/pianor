/**
 * The pitch trainer by ear's two settings (ft_1_10 AC6), saved per player from version 16 (d069): how long each note sounds,
 * in whole seconds from 1 to 3, and whether a question repeats when the student is quiet. Plain data; the rules read it.
 */
import { z } from 'zod';

export const earTrainerSettingsSchema = z.object({
  seconds: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  repeat: z.boolean(),
});

export type EarTrainerSettings = z.infer<typeof earTrainerSettingsSchema>;

/** The harder choice by default: one second, and repeat on (AX-3 provisional, ft_1_10). */
export const DEFAULT_EAR_TRAINER_SETTINGS: EarTrainerSettings = { seconds: 1, repeat: true };
