import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { deserialize, serialize } from 'node:v8';
import { constants, gunzipSync, gzipSync } from 'node:zlib';
import { PAINT_SOURCES } from '../art/paintSources.ts';

/**
 * Pictures a test painted, kept on disk until the code that paints them changes. Painting every picture of Keri at
 * every hour is most of a unit-test run (the art rules' test, about half of the run), and the painters are pure:
 * the same code and the same world file paint the same pixels. So a painting is kept under a key made of everything it
 * is painted from (the painters' folders, the world file, the tool that packs a picture for the checks, the locked
 * dependencies and the version of Node), and a later run whose key is the same reads it instead of painting it again.
 * The checks still run on every picture, every time: only the painting is skipped.
 *
 * `PIANOR_PAINT_CACHE=0` paints everything afresh (the weekly CI run does, so a key that missed an input is caught);
 * `PIANOR_PAINT_CACHE_DIR` puts the cache elsewhere (CI keeps it out of `node_modules`, which `npm ci` clears).
 */

/** The single files a painting depends on, beside the painters' folders (`PAINT_SOURCES`). */
export const PAINT_FILES = ['content/world/keri.json', 'tools/art/pictures.ts', 'tools/test/paintCache.ts', 'package-lock.json'] as const;

const DEFAULT_DIR = 'node_modules/.cache/pianor-paint';
/** How many keys are kept: every change to the art leaves one more, some tens of MB each. */
const KEEP = 3;

export interface PaintCacheOptions {
  /** Where the paintings are kept. */
  dir?: string;
  /** The folders and files the key is made of, relative to the working directory. */
  sources?: readonly string[];
  /** False to paint everything afresh and keep nothing. */
  enabled?: boolean;
}

export interface PaintCache {
  /** `paint()`'s result, read from the cache where this key holds `what`, else painted and kept. */
  painted<T>(what: string, paint: () => T): T;
  /** The key the paintings are kept under: changes when any source does. */
  readonly key: string;
}

/** Every `.ts` file under `path` that is not a test, or `path` itself where it is a file. */
function filesOf(path: string): string[] {
  if (!existsSync(path)) return [];
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path).sort().flatMap((name) => {
    const inner = join(path, name);
    if (statSync(inner).isDirectory()) return filesOf(inner);
    return inner.endsWith('.ts') && !inner.endsWith('.test.ts') ? [inner] : [];
  });
}

/** The key made of every source file's path and content, and the version of Node (its `Math` may round otherwise). */
export function paintKey(sources: readonly string[]): string {
  const hash = createHash('sha256').update(process.version);
  for (const file of sources.flatMap((source) => filesOf(resolve(source)))) hash.update(file).update('\0').update(readFileSync(file));
  return hash.digest('hex').slice(0, 24);
}

/** Keeps the newest `KEEP` keys in `dir`. */
function prune(dir: string): void {
  try {
    const keys = readdirSync(dir).map((name) => join(dir, name)).map((path) => ({ path, at: statSync(path).mtimeMs })).sort((a, b) => b.at - a.at);
    for (const { path } of keys.slice(KEEP)) rmSync(path, { recursive: true, force: true });
  } catch {
    // another run pruned at the same time: what is left is pruned next time
  }
}

export function paintCache(options: PaintCacheOptions = {}): PaintCache {
  const enabled = options.enabled ?? process.env.PIANOR_PAINT_CACHE !== '0';
  const dir = resolve(options.dir ?? process.env.PIANOR_PAINT_CACHE_DIR ?? DEFAULT_DIR);
  const sources = options.sources ?? [...PAINT_SOURCES, ...PAINT_FILES];
  let key: string | undefined;
  const keyNow = (): string => (key ??= paintKey(sources));
  return {
    get key() {
      return keyNow();
    },
    painted<T>(what: string, paint: () => T): T {
      if (!enabled) return paint();
      const folder = join(dir, keyNow());
      const file = join(folder, `${createHash('sha256').update(what).digest('hex').slice(0, 24)}.bin`);
      if (existsSync(file)) {
        try {
          return deserialize(gunzipSync(readFileSync(file))) as T;
        } catch {
          // a file cut short (a run stopped while writing, say): painted again below
        }
      }
      const result = paint();
      try {
        mkdirSync(folder, { recursive: true });
        // written beside and renamed, so a run that reads it at the same time sees all of it or nothing
        const part = `${file}.${process.pid}.part`;
        writeFileSync(part, gzipSync(serialize(result), { level: constants.Z_BEST_SPEED }));
        renameSync(part, file);
        prune(dir);
      } catch {
        // a full or read-only disk: the painting is used, only not kept
      }
      return result;
    },
  };
}
