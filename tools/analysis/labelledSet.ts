/**
 * A labelled set of pieces for fitting the Learned model: our own neutral manifest, so any graded repertoire (CIPI, our
 * confirmed pieces, a teacher's list) is read the same way. Scores are read from files next to the manifest and never
 * copied anywhere; only the fitted numbers leave this folder.
 */
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
import { z } from 'zod';
import type { Chart } from '../../src/core/chart';
import { parseChart } from '../../src/core/chart/migrate';
import { compilePiece } from '../../src/core/piece/compile';
import { readMusicXmlFile } from './scoreFile';

export const manifestSchema = z.object({
  schemaVersion: z.literal(1),
  /** For people: "CIPI". */
  name: z.string().min(1),
  /** The set's licence as its makers give it. */
  licence: z.string().min(1),
  /** May a model fitted on it be committed and built into the game? Only a person sets true, after reading the licence. */
  publishable: z.boolean(),
  label: z.object({ name: z.string().min(1), min: z.number(), max: z.number() }),
  items: z.array(
    z.object({
      id: z.string().min(1),
      /** Held out together in cross-validation, usually the composer. */
      group: z.string().min(1),
      label: z.number(),
      /** Score files relative to the manifest; several for a work in movements. */
      files: z.array(z.string().min(1)).min(1),
    }),
  ),
});
export type Manifest = z.infer<typeof manifestSchema>;

export type ReadResult = { ok: true; chart: Chart; warnings?: string[] } | { ok: false; reason: string };

const MUSICXML = new Set(['.musicxml', '.mxl', '.xml']);

/**
 * One score file as a chart: a piece folder or a `piece.abc` with its `piece.meta.json` beside it, a `.chart.json`, or
 * MusicXML (`.musicxml`, `.xml`, `.mxl`, read by `scoreFile.ts`, with what it simplified in `warnings`). A file that
 * cannot be read is listed with why rather than failing the run.
 */
export function readScore(path: string): ReadResult {
  if (!existsSync(path)) return { ok: false, reason: `no such file: ${path}` };
  if (path.endsWith('.chart.json')) {
    const parsed = parseChart(JSON.parse(readFileSync(path, 'utf-8')));
    return parsed.ok ? { ok: true, chart: parsed.chart } : { ok: false, reason: parsed.errors.join('; ') };
  }
  if (MUSICXML.has(extname(path).toLowerCase())) return readMusicXmlFile(path);
  const abcPath = extname(path) === '.abc' ? path : join(path, 'piece.abc');
  const metaPath = join(dirname(abcPath), 'piece.meta.json');
  if (!existsSync(abcPath) || !existsSync(metaPath)) return { ok: false, reason: `not a score this reader knows: ${basename(path)}` };
  const compiled = compilePiece({ abc: readFileSync(abcPath, 'utf-8'), meta: readFileSync(metaPath, 'utf-8') });
  return compiled.chart ? { ok: true, chart: compiled.chart } : { ok: false, reason: compiled.diagnostics.map((d) => d.message).join('; ') };
}

/** Read and validate a manifest file; its items' files are relative to its folder. */
export function readManifest(path: string): Manifest {
  return manifestSchema.parse(JSON.parse(readFileSync(path, 'utf-8')));
}
