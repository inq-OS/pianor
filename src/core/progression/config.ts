import { z } from 'zod';

/**
 * How XP and levels work, as data (content/curriculum/progression.json). Tuning the game's pace means editing that file.
 * Everything here is provisional until playtests say otherwise.
 */
export const progressionConfigSchema = z
  .object({
    schemaVersion: z.literal(1),
    note: z.string().optional(),
    xp: z.object({
      /** XP for finishing a piece at all. */
      completion: z.int().nonnegative(),
      /** Extra XP up to this much, in proportion to accuracy (notes right the first time). */
      accuracy: z.int().nonnegative(),
      /** Extra XP the first time a piece is finished. */
      firstTimeBonus: z.int().nonnegative(),
      /** Extra XP for each star above the best so far, on a repeat. */
      improvementPerStar: z.int().nonnegative(),
      /** A repeat that does not improve the stars earns this share of the base XP. */
      replayFactor: z.number().min(0).max(1),
      /** Share of the reward each hint costs when used for every note. The total discount never exceeds 50%. */
      hintDiscount: z.object({ noteNames: z.number().min(0).max(0.5), fingers: z.number().min(0).max(0.5) }),
      /** Largest two-hands bonus (0.5 means up to +50%). */
      bothHandsMaxBonus: z.number().min(0).max(2),
    }),
    /** What the piece stats count as "played well", and how many plays they look back (core_04). */
    stats: z
      .object({
        /** The last this many plays of a piece make its proficiency. */
        window: z.int().positive(),
        /** A play is played well with at least this share of the notes right the first time. */
        goodAccuracy: z.number().min(0).max(1),
        /** And, in Tempo mode, a timing score (0 to 100) of at least this. */
        goodTimingScore: z.number().min(0).max(100),
        /** Whether a play that used a hint can still be played well. */
        allowHints: z.boolean(),
      })
      .default({ window: 60, goodAccuracy: 0.9, goodTimingScore: 70, allowHints: false }),
    /** Total XP needed to reach level 1, 2, 3 ...: starts at 0 and strictly increases. */
    levels: z.array(z.int().nonnegative()).min(2),
    /** The same for one piece's own XP (ft_1_13); a table without it uses `levels`. */
    pieceLevels: z.array(z.int().nonnegative()).min(2).optional(),
  })
  .superRefine((config, ctx) => {
    for (const key of ['levels', 'pieceLevels'] as const) {
      const table = config[key];
      if (!table) continue;
      if (table[0] !== 0) ctx.addIssue({ code: 'custom', message: 'level 1 must need 0 XP', path: [key, 0] });
      table.forEach((xp, i) => {
        if (i > 0 && xp <= table[i - 1]!) ctx.addIssue({ code: 'custom', message: 'levels must need strictly more XP each', path: [key, i] });
      });
    }
  })
  .transform((config) => ({ ...config, pieceLevels: config.pieceLevels ?? config.levels }));

export type ProgressionConfig = z.infer<typeof progressionConfigSchema>;
export type StatsConfig = ProgressionConfig['stats'];

export function parseProgressionConfig(raw: unknown): ProgressionConfig {
  return progressionConfigSchema.parse(raw);
}
