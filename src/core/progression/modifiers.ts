/**
 * The difficulty factor table (content/curriculum/modifiers.json, core_07) as data.
 * Full difficulty (clef reading, no helps) is 1.0; each help is a factor strictly between 0 and 1, so a help
 * never zeroes XP and never pays more than the full play. The values are proposals until they are tuned after playtests.
 * Persisted-format rules: the file has a `schemaVersion`, and a new version needs a migration (docs/testing.md section 4).
 * The JSON import is done by the caller; this module only validates and looks up.
 */
import { z } from 'zod';

/** The helps the table knows about. Adding one is a content and schema change, so it is listed here. */
export const HELP_IDS = ['noteNames', 'fingerNumbers', 'litKey', 'onScreenKeyboard', 'metronome'] as const;
export type HelpId = (typeof HELP_IDS)[number];

/** A factor strictly between 0 and 1: a help costs reward but never all of it. */
const helpEntrySchema = z.object({
  factor: z.number().gt(0).lt(1),
  note: z.string().optional(),
});

const helpsShape = Object.fromEntries(HELP_IDS.map((id) => [id, helpEntrySchema])) as Record<HelpId, typeof helpEntrySchema>;

export const modifierTableSchema = z.object({
  schemaVersion: z.literal(1),
  note: z.string().optional(),
  /** Full difficulty: no helps on, factor 1.0. */
  full: z.object({
    factor: z.literal(1),
    note: z.string().optional(),
  }),
  helps: z.object(helpsShape).strict(),
});

export type ModifierTable = z.infer<typeof modifierTableSchema>;

/** Validate raw modifier table data; throws a ZodError when it is not valid. */
export function loadModifierTable(raw: unknown): ModifierTable {
  return modifierTableSchema.parse(raw);
}

/**
 * The XP factor of a play with the given helps on: the product of their factors, or the full factor (1.0)
 * when none is on. A repeated help counts once.
 */
export function factorFor(table: ModifierTable, activeHelps: Iterable<HelpId>): number {
  let factor = table.full.factor;
  for (const id of new Set(activeHelps)) factor *= table.helps[id].factor;
  return factor;
}
