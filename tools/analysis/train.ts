/**
 * Training the Learned model from a labelled set (core_08.AC11): read each item's scores, score them with the Rules model,
 * cross-validate with composers held out, fit on everything and write the model. A model on a set that is not
 * publishable goes to the gitignored `private/models/`; `train-cli.ts` is the command.
 */
import { join } from 'node:path';
import { difficultyOf } from '../../src/core/piece/difficulty';
import { FEATURE_NAMES, featureVector, learnedModelSchema, type LearnedModel } from '../../src/core/piece/learnedModel';
import { crossValidate, fitRidge, type Sample } from './fitting';
import { readScore, type Manifest, type ReadResult } from './labelledSet';

export interface Samples {
  samples: Sample[];
  /** Items with no score read, with why (MusicXML waiting for its importer, a file that does not compile). */
  skipped: { id: string; reason: string }[];
}

/**
 * One feature vector per item. A work in movements takes, feature by feature, the hardest movement: AX-3 provisional,
 * a Henle level grades the whole work by its hardest part (TODO(builder, R3) in core_08).
 */
export function buildSamples(manifest: Manifest, baseDir: string, read: (path: string) => ReadResult = readScore): Samples {
  const samples: Sample[] = [];
  const skipped: Samples['skipped'] = [];
  for (const item of manifest.items) {
    const vectors: number[][] = [];
    const reasons: string[] = [];
    for (const file of item.files) {
      const result = read(join(baseDir, file));
      if (result.ok) vectors.push(featureVector(difficultyOf(result.chart)));
      else reasons.push(result.reason);
    }
    if (reasons.length > 0) skipped.push({ id: item.id, reason: [...new Set(reasons)].join('; ') });
    else samples.push({ id: item.id, group: item.group, x: FEATURE_NAMES.map((_, j) => Math.max(...vectors.map((v) => v[j]!))), y: item.label });
  }
  return { samples, skipped };
}

export interface TrainOptions {
  trainedAt: string;
  lambda?: number;
  folds?: number;
}

/** Cross-validate, then fit on every sample: the model file, checked against its own schema. */
export function trainModel(manifest: Manifest, samples: readonly Sample[], options: TrainOptions): LearnedModel {
  const lambda = options.lambda ?? 1;
  const metrics = crossValidate(samples, options.folds ?? 5, lambda, manifest.label);
  const fit = fitRidge(samples, lambda);
  return learnedModelSchema.parse({
    schemaVersion: 1,
    kind: 'ridge',
    label: manifest.label,
    source: { dataset: manifest.name, licence: manifest.licence, items: samples.length, trainedAt: options.trainedAt, publishable: manifest.publishable },
    features: [...FEATURE_NAMES],
    ...fit,
    metrics,
  });
}

/** Where a model goes: `private/models/` unless its set may be published, then `content/models/`. */
export function modelPath(model: LearnedModel, root = '.'): string {
  const slug = model.source.dataset.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'model';
  return join(root, model.source.publishable ? 'content/models' : 'private/models', `${slug}.json`);
}

/** The lines the command prints: quality first, then what could not be read. */
export function trainReport(model: LearnedModel, skipped: Samples['skipped'], path: string): string[] {
  const m = model.metrics;
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  return [
    `${model.source.dataset}: ${model.source.items} item(s), ${m.folds} folds with composers held out`,
    `  mean error ${m.mae.toFixed(2)} ${model.label.name} steps, within one step ${pct(m.withinOne)}, exact ${pct(m.exact)}, rank correlation ${m.spearman.toFixed(2)}`,
    `  written to ${path}${model.source.publishable ? '' : ' (private: the set\'s licence does not allow publishing)'}`,
    ...(skipped.length > 0 ? [`${skipped.length} item(s) not read:`, ...skipped.map((s) => `  ${s.id}: ${s.reason}`)] : []),
  ];
}
