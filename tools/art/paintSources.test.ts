import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PAINT_FILES } from '../test/paintCache';
import { inSources, PAINT_SOURCES, paintedFrom, valueImports } from './paintSources';

describe('what the pictures are painted from', () => {
  it('every file the painters import is in the sources the caches are keyed on, so none can leave a painting stale', () => {
    // the build's painter and the art tools' pictures (the same files esbuild bundles from them); the
    // build's cache keys on vite-keri.ts itself, and the list of sources only says where to look
    const files = paintedFrom(['tools/vite-keri.ts', 'tools/art/pictures.ts']);
    const keyed = [...PAINT_SOURCES, ...PAINT_FILES, 'tools/vite-keri.ts', 'tools/art/paintSources.ts'];
    expect(files.length).toBeGreaterThan(50);
    expect(files).toContain('src/game/ui/pixel/keri/roomPicture.ts');
    expect(files.filter((file) => !inSources(file, keyed))).toEqual([]);
  });

  it('follows value imports, multi-line, re-exports and dynamic ones, and leaves out type-only imports and packages', () => {
    const root = mkdtempSync(join(tmpdir(), 'paint-sources-'));
    try {
      mkdirSync(join(root, 'kit'));
      const put = (name: string, text: string) => writeFileSync(join(root, name), text);
      put('scene.ts', "import { a,\n  b } from './a';\nimport type { T } from './shape';\nimport { z } from 'zod';\nexport { c } from './c.ts';\nimport './side';\nconst k = () => import('./kit');\n");
      put('a.ts', "import { d } from './d';");
      put('d.ts', '');
      put('c.ts', '');
      put('side.ts', '');
      put('shape.ts', '');
      put('kit/index.ts', '');
      expect(valueImports(join(root, 'scene.ts')).map((f) => f.slice(root.length + 1)).sort()).toEqual(['a.ts', 'c.ts', 'kit/index.ts', 'side.ts']);
      const cwd = process.cwd();
      process.chdir(root);
      try {
        expect(paintedFrom(['scene.ts'])).toEqual(['a.ts', 'c.ts', 'd.ts', 'kit/index.ts', 'scene.ts', 'side.ts']);
      } finally {
        process.chdir(cwd);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('a folder holds what lies under it, and no folder whose name only begins the same', () => {
    expect(inSources('src/core/sky/wind.ts', ['src/core/sky'])).toBe(true);
    expect(inSources('src/core/random.ts', ['src/core/random.ts'])).toBe(true);
    expect(inSources('src/core/skyline.ts', ['src/core/sky'])).toBe(false);
  });
});
