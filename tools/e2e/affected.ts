import { E2E_AREAS, NO_E2E_PATHS, SHARED_PATHS, type E2eArea } from './areas.ts';

/** A folder pattern (ends in `/`) matches by prefix, `*.ext` by ending, anything else names one file. */
export function matchesPath(file: string, pattern: string): boolean {
  if (pattern.startsWith('*.')) return file.endsWith(pattern.slice(1));
  if (pattern.endsWith('/')) return file.startsWith(pattern);
  return file === pattern;
}

export const specPath = (spec: string): string => `tests/e2e/${spec}.spec.ts`;

export interface Selection {
  /** Every area runs: a shared file, or a file no area names, changed. */
  all: boolean;
  /** The areas to run, in table order (every area when `all`). */
  areas: string[];
  /** Which file chose what, one line each. */
  reasons: string[];
}

/** The areas a change needs, from the changed paths (relative to the repository, `/` separators). */
export function selectAreas(changed: string[], areas: E2eArea[] = E2E_AREAS, shared = SHARED_PATHS, none = NO_E2E_PATHS): Selection {
  const chosen = new Set<string>();
  const reasons: string[] = [];
  let all = false;
  for (const file of changed) {
    if (none.some((p) => matchesPath(file, p))) continue;
    const ofSpec = areas.filter((a) => a.specs.some((s) => file.startsWith(specPath(s))));
    if (ofSpec.length === 0 && shared.some((p) => matchesPath(file, p))) {
      all = true;
      reasons.push(`${file} is shared → all areas`);
      continue;
    }
    const hit = ofSpec.length > 0 ? ofSpec : areas.filter((a) => a.sources.some((p) => matchesPath(file, p)));
    if (hit.length === 0) {
      all = true;
      reasons.push(`${file} is in no area → all areas`);
      continue;
    }
    for (const a of hit) chosen.add(a.name);
    reasons.push(`${file} → ${hit.map((a) => a.name).join(', ')}`);
  }
  const names = areas.map((a) => a.name);
  return { all, areas: all ? names : names.filter((n) => chosen.has(n)), reasons };
}

/**
 * Arguments for `playwright test`: null when nothing needs to run, none for the whole suite, otherwise a grep for the
 * chosen areas plus the smoke tests. Playwright greps "project file describe title", so the project name leads.
 */
export function playwrightArgs(selection: Selection): string[] | null {
  if (selection.all) return [];
  if (selection.areas.length === 0) return null;
  return ['--grep', `^(?:${selection.areas.join('|')}) |@smoke`];
}
