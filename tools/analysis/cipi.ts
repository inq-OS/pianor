/**
 * CIPI (Ramoneda et al. 2024, 652 classical works graded by Henle 1 to 9) read into our neutral manifest. Its
 * `index.json` maps each work to `{ composer, henle, path: { movement: musicxml path }, work_name, ... }` with paths
 * relative to the folder that holds it (mirdata's `cipi` loader). The data is CC BY-NC-SA 4.0 for research only, asked
 * for at zenodo.org/records/8037327 by a person: never committed, and a model fitted on it is not publishable.
 */
import { z } from 'zod';
import type { Manifest } from './labelledSet';

export const CIPI_LICENCE = 'CC BY-NC-SA 4.0 (research only)';

const entrySchema = z.object({
  composer: z.string().min(1),
  henle: z.coerce.number().int().min(1).max(9),
  path: z.record(z.string(), z.string().min(1)),
  work_name: z.string().optional(),
});

export interface CipiResult {
  manifest: Manifest;
  /** Entries left out, with why: no composer, no Henle level, no score. */
  skipped: { id: string; reason: string }[];
}

/** The manifest of a CIPI index; it is written next to `index.json`, so the score paths stay as they are. */
export function cipiManifest(index: unknown): CipiResult {
  if (typeof index !== 'object' || index === null || Array.isArray(index)) throw new Error('a CIPI index.json is an object of works by id');
  const items: Manifest['items'] = [];
  const skipped: CipiResult['skipped'] = [];
  for (const [id, raw] of Object.entries(index).sort(([a], [b]) => a.localeCompare(b))) {
    const entry = entrySchema.safeParse(raw);
    if (!entry.success) {
      const issue = entry.error.issues[0];
      skipped.push({ id, reason: `${issue?.path.join('.') || 'entry'}: ${issue?.message ?? 'invalid'}` });
      continue;
    }
    const files = Object.values(entry.data.path);
    if (files.length === 0) {
      skipped.push({ id, reason: 'no score file' });
      continue;
    }
    items.push({ id, group: entry.data.composer, label: entry.data.henle, files });
  }
  return {
    manifest: { schemaVersion: 1, name: 'CIPI', licence: CIPI_LICENCE, publishable: false, label: { name: 'Henle', min: 1, max: 9 }, items },
    skipped,
  };
}
