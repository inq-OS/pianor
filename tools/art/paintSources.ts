import { existsSync, readFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';

/**
 * What Keri's pictures are painted from: the build's cache of the painted pictures (`tools/vite-keri.ts`) and the
 * tests' (`tools/test/paintCache.ts`) are both keyed on these folders and files, so a change to any of them paints
 * again. A painter that imports code from anywhere else would leave a cache stale; `paintSources.test.ts` walks the
 * painters' imports and fails for any that lies outside.
 */
export const PAINT_SOURCES = [
  'src/game/ui/pixel',
  'src/core/layout',
  'src/core/sky',
  'src/core/world',
  'src/game/room',
] as const;

/** The relative modules `file` imports for their values (an `import type` only names shapes and paints nothing). */
export function valueImports(file: string): string[] {
  const text = readFileSync(file, 'utf8');
  const found: string[] = [];
  const statement = /(?:^|\n)\s*(?:import|export)\s+(type\s+)?(?:[^;'"]*?\sfrom\s*)?['"](\.{1,2}\/[^'"]+)['"]/g;
  for (const m of text.matchAll(statement)) if (!m[1]) found.push(m[2]!);
  for (const m of text.matchAll(/import\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g)) found.push(m[1]!);
  return found.map((spec) => {
    const base = resolve(dirname(file), spec);
    return [base, `${base}.ts`, `${base}/index.ts`].find((path) => path.endsWith('.ts') && existsSync(path)) ?? base;
  });
}

/** Every file reachable from `entries` through value imports, relative to the working directory, `/` between folders. */
export function paintedFrom(entries: readonly string[]): string[] {
  const seen = new Set<string>();
  const open = entries.map((entry) => resolve(entry));
  while (open.length) {
    const file = open.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    open.push(...valueImports(file));
  }
  return [...seen].map((file) => relative(process.cwd(), file).split(sep).join('/')).sort();
}

/** Whether `file` (relative, `/` between folders) lies in one of `sources`. */
export function inSources(file: string, sources: readonly string[]): boolean {
  return sources.some((source) => file === source || file.startsWith(`${source}/`));
}
