import { z } from 'zod';

/** An id as it appears in file names and text: `core_01`, `ft_0_08`, `ft_Y_03`, with an optional part letter. */
export const FEATURE_ID = /^(core_\d{2}|ft_[0-9Y]_\d{2}[a-z]?)$/;
/** The same ids found inside running text. */
export const FEATURE_ID_IN_TEXT = /\b(core_\d{2}|ft_[0-9Y]_\d{2}[a-z]?)\b/g;
const featureId = z.string().regex(FEATURE_ID);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const commit = z.string().regex(/^[0-9a-f]{7,40}$/);

export const EFFORTS = ['done', 'done (preliminary)', 'split', 'trivial', 'simple', 'medium', 'large', 'high friction'] as const;

/** Staleness tracking, allowed on any doc: which paths it describes and the commit it was last checked against. */
const tracking = {
  covers: z.array(z.string()).optional(),
  verified_against: commit.optional(),
  last_reviewed: date.optional(),
};

export const featureMeta = z
  .object({
    id: featureId,
    title: z.string().min(1),
    scope: z.string().min(1),
    effort: z.enum(EFFORTS),
    status: z.string().min(1),
    /** Share of the feature's own scope that is built and checkable by an agent, 0 to 100 (docs/decisions/workflow.md#d048). */
    completeness: z.number().int().min(0).max(100).optional(),
    depends_on: z.array(featureId).optional(),
    ...tracking,
  })
  .strict()
  .superRefine((meta, ctx) => {
    const fail = (message: string): void => ctx.addIssue({ code: 'custom', path: ['completeness'], message });
    if (meta.effort === 'split') {
      if (meta.completeness !== undefined) fail('a split feature has none: it is derived from its parts');
      return;
    }
    if (meta.completeness === undefined) return fail('required, an integer 0 to 100 (see FEATURES.md, Completeness)');
    if (meta.effort === 'done' && meta.completeness !== 100) fail('a feature with effort "done" is 100');
    if (meta.completeness === 100 && !meta.effort.startsWith('done')) fail('100 needs effort "done" or "done (preliminary)"');
  });

export const decisionMeta = z
  .object({
    id: z.string().regex(/^d\d{3}$/),
    title: z.string().min(1),
    features: z.array(z.union([featureId, z.literal('all')])),
    supersedes: z.array(z.string().regex(/^d\d{3}$/)).optional(),
    ...tracking,
  })
  .strict();

export const authoringMeta = z.object({ id: z.string().regex(/^au\d{2}$/), summary: z.string().min(1), ...tracking }).strict();

export const playtestMeta = z
  .object({ id: z.string().regex(/^pt\d{2}$/), pieces: z.string(), finding: z.string(), ...tracking })
  .strict();

/** Any other doc (architecture, testing, ...) may carry the tracking fields and a title. */
export const plainMeta = z.object({ title: z.string().optional(), ...tracking }).strict();

export type FeatureMeta = z.infer<typeof featureMeta>;
export type DecisionMeta = z.infer<typeof decisionMeta>;
export type AuthoringMeta = z.infer<typeof authoringMeta>;
export type PlaytestMeta = z.infer<typeof playtestMeta>;
