/**
 * The XP bank's tuning as data (content/curriculum/xpBank.json): the bite per curriculum level and the floor.
 * Persisted-format rules: the file has a `schemaVersion`, and a new version needs a migration (docs/testing.md section 4).
 */
import { z } from 'zod';

export const xpBankConfigSchema = z.object({
  schemaVersion: z.literal(1),
  note: z.string().optional(),
  /** Miss bites switch off once the bank is at or below this share of the base XP. */
  floorPercent: z.number().min(0).max(100),
  /** Base bite in percent of the base XP, for curriculum level 1, 2, 3 ... The last value applies to higher levels. */
  bitePercentByLevel: z.array(z.number().min(0).max(10)).min(1),
});

export type XpBankConfig = z.infer<typeof xpBankConfigSchema>;

export function parseXpBankConfig(raw: unknown): XpBankConfig {
  return xpBankConfigSchema.parse(raw);
}

/** Base bite in percent for a curriculum level (1 and up). */
export function bitePercentForLevel(config: XpBankConfig, level: number): number {
  if (!Number.isInteger(level) || level < 1) throw new RangeError(`level must be a whole number from 1, got ${level}`);
  const table = config.bitePercentByLevel;
  return table[Math.min(level, table.length) - 1]!;
}
