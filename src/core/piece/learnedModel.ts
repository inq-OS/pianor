/**
 * The Learned model of the difficulty estimator (core_08, M5 of the analyser plan): a linear model fitted offline to a
 * graded repertoire (CIPI's Henle levels 1 to 9, or any labelled set) over the Rules model's features, that says where a
 * piece sits on that set's scale. Pure: fitting is done by `tools/analysis/`, this module only reads a fitted model and
 * applies it. A model fitted on a set whose licence does not allow publishing (CIPI is CC BY-NC-SA, research only) stays
 * in the gitignored `private/models/` and is never committed or built into a release.
 */
import { z } from 'zod';
import { DIMENSIONS, type Difficulty } from './difficulty';

/** The inputs of the learned model, in order: the eight dimensions, then the shape of the piece. */
export const FEATURE_NAMES = [
  ...DIMENSIONS.map((d) => `parts.${d}`),
  'bars.log2',
  'bars.meanScore',
  'bars.peakScore',
  'bars.hardShare',
  'piece.range',
  'piece.keySignature',
] as const;

/** The feature vector of a scored piece or passage, in `FEATURE_NAMES` order. */
export function featureVector(d: Difficulty): number[] {
  const played = d.bars.filter((b) => b.features.presses > 0);
  const mean = played.length > 0 ? played.reduce((sum, b) => sum + b.score, 0) / played.length : 0;
  const peak = Math.max(0, ...played.map((b) => b.score));
  const hard = played.length > 0 ? played.filter((b) => b.score >= mean * 1.25 && b.score > 0).length / played.length : 0;
  return [...DIMENSIONS.map((dim) => d.parts[dim]), Math.log2(Math.max(1, d.bars.length)), mean, peak, hard, d.piece.range, d.piece.keySignature];
}

/** A fitted model, as `tools/analysis/train.ts` writes it. Persisted, so it has a schema version. */
export const learnedModelSchema = z.object({
  schemaVersion: z.literal(1),
  kind: z.literal('ridge'),
  /** The labelled set and its scale, for people: "CIPI (Henle 1 to 9)". */
  label: z.object({ name: z.string().min(1), min: z.number(), max: z.number() }),
  /** Where it came from and whether it may be published. */
  source: z.object({ dataset: z.string().min(1), licence: z.string().min(1), items: z.int().nonnegative(), trainedAt: z.string().min(1), publishable: z.boolean() }),
  features: z.array(z.string()),
  /** Standardisation: each input is (x - mean) / scale before the weights. */
  mean: z.array(z.number()),
  scale: z.array(z.number().positive()),
  weights: z.array(z.number()),
  intercept: z.number(),
  /** Cross-validated quality, for people to judge the model by. */
  metrics: z.object({ mae: z.number(), withinOne: z.number(), exact: z.number(), spearman: z.number(), folds: z.int().positive() }),
});
export type LearnedModel = z.infer<typeof learnedModelSchema>;

/** Validate a model file; it must be fitted on exactly today's features, else it is refused with the reason. */
export function parseLearnedModel(raw: unknown): { model: LearnedModel } | { error: string } {
  const parsed = learnedModelSchema.safeParse(raw);
  if (!parsed.success) return { error: `not a learned model: ${parsed.error.issues[0]?.message ?? 'invalid'}` };
  const m = parsed.data;
  const n = FEATURE_NAMES.length;
  if (m.features.join() !== FEATURE_NAMES.join()) return { error: 'fitted on other features than today\'s: train it again' };
  if (m.mean.length !== n || m.scale.length !== n || m.weights.length !== n) return { error: `needs ${n} means, scales and weights` };
  return { model: m };
}

/** The linear prediction on a standardised vector, unclamped (the fitting code uses it as it is). */
export function linearPredict(model: Pick<LearnedModel, 'mean' | 'scale' | 'weights' | 'intercept'>, x: readonly number[]): number {
  return x.reduce((sum, v, i) => sum + model.weights[i]! * ((v - model.mean[i]!) / model.scale[i]!), model.intercept);
}

/** Where a piece or passage sits on the model's scale, clamped to it, to one decimal: "Henle-like 3.2". */
export function predictLevel(model: LearnedModel, d: Difficulty): number {
  const y = linearPredict(model, featureVector(d));
  return Math.round(Math.min(model.label.max, Math.max(model.label.min, y)) * 10) / 10;
}

/** Where a piece or passage sits on the model's scale and how far to trust it, for the analyser: "Learned on CIPI (private): Henle-like 3.2 of 1 to 9 (...)". */
export function learnedSummary(model: LearnedModel, d: Difficulty): string {
  const m = model;
  return `Learned on ${m.source.dataset}${m.source.publishable ? '' : ' (private)'}: ${m.label.name}-like ${predictLevel(m, d).toFixed(1)} of ${m.label.min} to ${m.label.max} (cross-validated on ${m.source.items} pieces: within one step ${Math.round(m.metrics.withinOne * 100)}%)`;
}

/** Model files as the dev server hands them over: the ones that read, and the others with why. */
export function parseModelFiles(files: readonly { file: string; text: string }[]): { models: LearnedModel[]; refused: string[] } {
  const models: LearnedModel[] = [];
  const refused: string[] = [];
  for (const f of files) {
    let raw: unknown = null;
    try {
      raw = JSON.parse(f.text);
    } catch {
      // refused below as not a learned model
    }
    const result = parseLearnedModel(raw);
    if ('model' in result) models.push(result.model);
    else refused.push(`${f.file}: ${result.error}`);
  }
  return { models, refused };
}
