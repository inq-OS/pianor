/**
 * The labelled set a command line names: `<manifest.json>` (our neutral manifest) or `--cipi <index.json>` (CIPI's own
 * index). Shared by `train-cli.ts` and `fit-grades-cli.ts`; paths in the set are relative to the folder of that file.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { cipiManifest } from './cipi';
import { readManifest, type Manifest } from './labelledSet';

export type SetArgs = { ok: true; manifest: Manifest; baseDir: string; skipped: { id: string; reason: string }[] } | { ok: false; error: string };

export function setFromArgs(args: readonly string[]): SetArgs {
  const cipi = args[0] === '--cipi';
  const path = (cipi ? args[1] : args[0]) ?? '';
  if (!path || !existsSync(path)) return { ok: false, error: path ? `no such file: ${path}` : 'no set named' };
  if (!cipi) return { ok: true, manifest: readManifest(path), baseDir: dirname(path), skipped: [] };
  const fromIndex = cipiManifest(JSON.parse(readFileSync(path, 'utf-8')));
  return { ok: true, manifest: fromIndex.manifest, baseDir: dirname(path), skipped: fromIndex.skipped };
}
