/**
 * How many monsters a player fights: one, or a series that goes on until the piece has
 * been played to its end (`BattleSeries`). Saved per player (`core/progression`, profile version 8). One monster is the default,
 * so the game everyone plays is unchanged until the player chooses.
 */
import { z } from 'zod';

export const battleSettingsSchema = z.object({
  fights: z.union([z.literal('one'), z.literal('many')]),
});

export type BattleSettings = z.infer<typeof battleSettingsSchema>;

export const DEFAULT_BATTLE_SETTINGS: BattleSettings = { fights: 'one' };
