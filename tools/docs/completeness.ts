import type { Issue } from './lint.ts';
import type { FeatureMeta } from './schemas.ts';

/**
 * Completeness of features (docs/decisions/workflow.md#d048): the front matter of a feature carries `completeness`, an
 * integer 0 to 100; a split parent has none and gets the effort-weighted mean of its parts. The summary of FEATURES.md is
 * the effort-weighted mean of the features, weighted by the effort they were planned with.
 */

/** The weight of a feature in a mean: its effort rating. */
export const EFFORT_WEIGHT: Record<string, number> = { trivial: 1, simple: 2, medium: 4, large: 8, 'high friction': 16 };

/** Done features keep no effort rating, so they weigh like a simple one. */
export const DEFAULT_WEIGHT = 2;

export const weightOf = (effort: string): number => EFFORT_WEIGHT[effort] ?? DEFAULT_WEIGHT;

export function weightedMean(entries: { value: number; weight: number }[]): number {
  const total = entries.reduce((sum, e) => sum + e.weight, 0);
  return total === 0 ? 0 : entries.reduce((sum, e) => sum + e.value * e.weight, 0) / total;
}

/** `ft_1_02a` is a part of `ft_1_02`; a feature that is not a part has none. */
export function parentOf(id: string): string | null {
  return /^((?:core_\d{2}|ft_[0-9Y]_\d{2}))[a-z]$/.exec(id)?.[1] ?? null;
}

/** Which table of FEATURES.md a feature belongs to: `core`, or `ft_` plus its iteration (`ft_0`, `ft_1`, `ft_Y`). */
export function featureGroup(id: string): string {
  return id.startsWith('core_') ? 'core' : id.slice(0, 4);
}

export interface Rated {
  id: string;
  group: string;
  /** Weight in a mean; 0 for a split parent, which is counted through its parts. */
  weight: number;
  /** 0 to 100; for a split parent the rounded mean of its parts. */
  value: number;
  split: boolean;
}

/** The completeness of every feature, with split parents derived from their parts (a parent without parts is 0). */
export function rate(features: FeatureMeta[]): Rated[] {
  return features.map((f) => {
    const split = f.effort === 'split';
    if (!split) return { id: f.id, group: featureGroup(f.id), weight: weightOf(f.effort), value: f.completeness ?? 0, split };
    const parts = features.filter((p) => parentOf(p.id) === f.id);
    const value = Math.round(weightedMean(parts.map((p) => ({ value: p.completeness ?? 0, weight: weightOf(p.effort) }))));
    return { id: f.id, group: featureGroup(f.id), weight: 0, value, split };
  });
}

export interface Summary {
  label: string;
  /** Rounded effort-weighted mean, 0 to 100. */
  value: number;
  /** Features at 100, and all features (split parents are not counted, their parts are). */
  done: number;
  total: number;
}

const GROUP_LABELS: [string, string][] = [
  ['ft_0', 'MVP, iteration 0'],
  ['ft_1', 'Iteration 1'],
  ['core', 'Core behaviour'],
  ['ft_Y', 'Iteration not defined yet'],
];

/** One row per group that has features, then the overall figure. */
export function summarize(rated: Rated[]): Summary[] {
  const one = (label: string, of: Rated[]): Summary => ({
    label,
    value: Math.round(weightedMean(of.map((r) => ({ value: r.value, weight: r.weight })))),
    done: of.filter((r) => r.value === 100).length,
    total: of.length,
  });
  const leaves = rated.filter((r) => !r.split);
  const rows = GROUP_LABELS.map(([group, label]) => one(label, leaves.filter((r) => r.group === group))).filter((s) => s.total > 0);
  return [...rows, one('Overall', leaves)];
}

/** A parent that is split must have parts to be derived from. */
export function lintCompleteness(features: { meta: FeatureMeta; path: string }[]): Issue[] {
  const ids = features.map((f) => f.meta.id);
  return features
    .filter((f) => f.meta.effort === 'split' && !ids.some((id) => parentOf(id) === f.meta.id))
    .map((f) => ({ severity: 'error' as const, file: f.path, message: `${f.meta.id} is split but has no part files (${f.meta.id}a, ...) to derive its completeness from` }));
}
