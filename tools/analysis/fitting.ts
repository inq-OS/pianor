/**
 * Fitting the Learned model (core_08, analyser plan M5): ridge regression on standardised features, checked by
 * cross-validation with whole groups (composers) held out, so a model cannot pass by recognising a style. Pure maths,
 * no files; `train.ts` does the reading and writing.
 */
import { linearPredict } from '../../src/core/piece/learnedModel';

export interface Sample {
  id: string;
  /** Held out together in cross-validation: the composer. */
  group: string;
  x: number[];
  y: number;
}

export interface Fit {
  mean: number[];
  scale: number[];
  weights: number[];
  intercept: number;
}

export interface Metrics {
  /** Mean absolute error in label steps. */
  mae: number;
  /** Share of predictions, rounded, within one step of the label. */
  withinOne: number;
  /** Share of predictions, rounded, exactly on the label. */
  exact: number;
  /** Rank correlation of predictions and labels, -1 to 1. */
  spearman: number;
  folds: number;
}

/** Solve A w = b by Gaussian elimination with partial pivoting (A is small and, with ridge, never singular). */
export function solve(a: number[][], b: number[]): number[] {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]!]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(m[r]![col]!) > Math.abs(m[pivot]![col]!)) pivot = r;
    [m[col], m[pivot]] = [m[pivot]!, m[col]!];
    const p = m[col]![col]!;
    if (Math.abs(p) < 1e-12) throw new Error('the system has no single solution');
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = m[r]![col]! / p;
      for (let c = col; c <= n; c++) m[r]![c]! -= f * m[col]![c]!;
    }
  }
  return m.map((row, i) => row[n]! / row[i]!);
}

/** Ridge regression on standardised inputs; a feature that never varies gets scale 1 and, through ridge, weight 0. */
export function fitRidge(samples: readonly Sample[], lambda = 1): Fit {
  if (samples.length === 0) throw new Error('nothing to fit');
  const n = samples[0]!.x.length;
  const mean = Array.from({ length: n }, (_, j) => samples.reduce((s, p) => s + p.x[j]!, 0) / samples.length);
  const scale = mean.map((mu, j) => Math.sqrt(samples.reduce((s, p) => s + (p.x[j]! - mu) ** 2, 0) / samples.length) || 1);
  const intercept = samples.reduce((s, p) => s + p.y, 0) / samples.length;
  const z = samples.map((p) => p.x.map((v, j) => (v - mean[j]!) / scale[j]!));
  const a = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => z.reduce((s, row) => s + row[i]! * row[j]!, 0) + (i === j ? lambda : 0)));
  const b = Array.from({ length: n }, (_, i) => z.reduce((s, row, k) => s + row[i]! * (samples[k]!.y - intercept), 0));
  return { mean, scale, weights: solve(a, b), intercept };
}

/** Ranks with ties sharing their mean rank. */
function ranks(values: readonly number[]): number[] {
  const order = values.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]);
  const out = new Array<number>(values.length);
  for (let i = 0; i < order.length; ) {
    let j = i;
    while (j + 1 < order.length && order[j + 1]![0] === order[i]![0]) j++;
    for (let k = i; k <= j; k++) out[order[k]![1]] = (i + j) / 2;
    i = j + 1;
  }
  return out;
}

export function spearman(a: readonly number[], b: readonly number[]): number {
  const ra = ranks(a);
  const rb = ranks(b);
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const ma = mean(ra);
  const mb = mean(rb);
  const cov = ra.reduce((s, x, i) => s + (x - ma) * (rb[i]! - mb), 0);
  const va = Math.sqrt(ra.reduce((s, x) => s + (x - ma) ** 2, 0));
  const vb = Math.sqrt(rb.reduce((s, x) => s + (x - mb) ** 2, 0));
  return va === 0 || vb === 0 ? 0 : cov / (va * vb);
}

/**
 * k-fold cross-validation with whole groups held out: groups sorted by name go round-robin into `k` folds (fewer when
 * there are fewer groups), each fold predicted by a model fitted on the others and clamped to the label's `range`, as the
 * game clamps it.
 */
export function crossValidate(samples: readonly Sample[], k = 5, lambda = 1, range: { min: number; max: number } = { min: -Infinity, max: Infinity }): Metrics {
  const groups = [...new Set(samples.map((s) => s.group))].sort();
  const folds = Math.min(k, groups.length);
  if (folds < 2) throw new Error('cross-validation needs at least two groups (composers)');
  const foldOf = new Map(groups.map((g, i) => [g, i % folds]));
  const predicted: number[] = [];
  const actual: number[] = [];
  for (let f = 0; f < folds; f++) {
    const test = samples.filter((s) => foldOf.get(s.group) === f);
    const fit = fitRidge(samples.filter((s) => foldOf.get(s.group) !== f), lambda);
    for (const s of test) {
      predicted.push(Math.min(range.max, Math.max(range.min, linearPredict(fit, s.x))));
      actual.push(s.y);
    }
  }
  const errors = predicted.map((p, i) => Math.abs(Math.round(p) - actual[i]!));
  return {
    mae: predicted.reduce((s, p, i) => s + Math.abs(p - actual[i]!), 0) / predicted.length,
    withinOne: errors.filter((e) => e <= 1).length / errors.length,
    exact: errors.filter((e) => e === 0).length / errors.length,
    spearman: spearman(predicted, actual),
    folds,
  };
}
