/**
 * A MusicXML file on disk as a chart (ft_Y_04 slice 1): `.musicxml` or `.xml` as text, `.mxl` unzipped with Node's zlib.
 * The reading itself is `src/core/import/musicxml.ts`.
 */
import { readFileSync } from 'node:fs';
import { basename, extname } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { musicXmlToChart, mxlScoreText, scoreText, type MusicXmlResult } from '../../src/core/import/musicxml';
import { MAX_ENTRY_BYTES, zipEntries, type ZipEntry } from '../../src/core/import/zip';

function entryBytes(entry: ZipEntry): Uint8Array {
  if (entry.method === 0) return entry.data;
  if (entry.method === 8) return new Uint8Array(inflateRawSync(entry.data, { maxOutputLength: MAX_ENTRY_BYTES }));
  throw new Error(`${entry.name} is compressed with method ${entry.method}, which this reader does not know`);
}

/** The score text inside a compressed MusicXML archive. */
export function mxlText(bytes: Uint8Array): string {
  return mxlScoreText(zipEntries(bytes), entryBytes);
}

/** Read a `.musicxml`, `.xml` or `.mxl` file; the id is its name without the extension. */
export function readMusicXmlFile(path: string): MusicXmlResult {
  const id = basename(path, extname(path));
  try {
    const bytes = new Uint8Array(readFileSync(path));
    return musicXmlToChart(extname(path).toLowerCase() === '.mxl' ? mxlText(bytes) : scoreText(bytes), id);
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}
