import { describe, expect, it } from 'vitest';
import { FEATURE_NAMES, featureVector, learnedSummary, linearPredict, parseModelFiles, parseLearnedModel, predictLevel, type LearnedModel } from './learnedModel';
import { difficultyOf, type Difficulty } from './difficulty';
import { chartWith } from '../../../tests/helpers/charts';

const note = (midi: number, tick: number, dur: number) => ({ midi, tick, dur });
const chart = (notes: ReturnType<typeof note>[]) => chartWith(notes);

const n = FEATURE_NAMES.length;
/** synthetic: a model that answers 5 plus the number of bars' log2. */
const model: LearnedModel = {
  schemaVersion: 1,
  kind: 'ridge',
  label: { name: 'Henle', min: 1, max: 9 },
  source: { dataset: 'test', licence: 'none', items: 3, trainedAt: 'now', publishable: false },
  features: [...FEATURE_NAMES],
  mean: Array(n).fill(0),
  scale: Array(n).fill(1),
  weights: FEATURE_NAMES.map((f) => (f === 'bars.log2' ? 1 : 0)),
  intercept: 5,
  metrics: { mae: 1, withinOne: 0.5, exact: 0.2, spearman: 0.6, folds: 5 },
};

describe('the Learned model (core_08.AC11)', () => {
  it('core_08.AC11 reads a piece as one number per feature, in order', () => {
    const d = difficultyOf(chart([note(60, 0, 480), note(62, 480, 480), note(64, 1920, 480)]));
    const x = featureVector(d);
    expect(x).toHaveLength(n);
    expect(x[FEATURE_NAMES.indexOf('bars.log2')]).toBe(Math.log2(d.bars.length));
    expect(x[FEATURE_NAMES.indexOf('bars.peakScore')]).toBe(Math.max(...d.bars.map((b) => b.score)));
  });

  it('an empty piece gives zeros, not NaN', () => {
    const empty = { parts: Object.fromEntries(FEATURE_NAMES.slice(0, 8).map((f) => [f.slice(6), 0])), bars: [], piece: { range: 0, keySignature: 0 } } as unknown as Difficulty;
    expect(featureVector(empty).every((v) => v === 0)).toBe(true);
  });

  it('core_08.AC11 accepts a model fitted on today\'s features and refuses others with the reason', () => {
    expect(parseLearnedModel(model)).toEqual({ model });
    expect(parseLearnedModel({ ...model, kind: 'forest' })).toMatchObject({ error: expect.stringContaining('not a learned model') });
    expect(parseLearnedModel({ ...model, features: ['old'] })).toEqual({ error: expect.stringContaining('train it again') });
    expect(parseLearnedModel({ ...model, weights: [1] })).toEqual({ error: `needs ${n} means, scales and weights` });
  });

  it('predicts on the model\'s scale, clamped, to one decimal', () => {
    const x = Array(n).fill(0);
    x[FEATURE_NAMES.indexOf('bars.log2')] = 2.04;
    expect(linearPredict(model, x)).toBeCloseTo(7.04);
    const short = difficultyOf(chart([note(60, 0, 480)]));
    expect(predictLevel(model, short)).toBe(5);
    expect(predictLevel({ ...model, intercept: 40 }, short)).toBe(9);
    expect(predictLevel({ ...model, intercept: -40 }, short)).toBe(1);
  });

  it('core_08.AC11 says where a piece sits, on which set, whether private, and how far to trust it', () => {
    const short = difficultyOf(chart([note(60, 0, 480)]));
    expect(learnedSummary(model, short)).toBe('Learned on test (private): Henle-like 5.0 of 1 to 9 (cross-validated on 3 pieces: within one step 50%)');
    expect(learnedSummary({ ...model, source: { ...model.source, publishable: true } }, short)).not.toContain('private');
  });

  it('reads the model files the dev server sends, listing the ones refused with why', () => {
    const { models, refused } = parseModelFiles([
      { file: 'a.json', text: JSON.stringify(model) },
      { file: 'b.json', text: '{ not json' },
      { file: 'c.json', text: JSON.stringify({ ...model, features: ['old'] }) },
    ]);
    expect(models).toEqual([model]);
    expect(refused).toEqual([expect.stringMatching(/^b\.json: not a learned model/), 'c.json: fitted on other features than today\'s: train it again']);
  });
});
