import { mkdirSync, mkdtempSync, readdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PAINT_SOURCES } from '../art/paintSources';
import { paintCache, paintKey } from './paintCache';

describe('the tests\' cache of painted pictures', () => {
  let root: string;
  let src: string;
  let dir: string;
  const env = { ...process.env };

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'paint-cache-'));
    src = join(root, 'painters');
    dir = join(root, 'cache');
    mkdirSync(join(src, 'kit'), { recursive: true });
    writeFileSync(join(src, 'stone.ts'), 'export const stone = 1;');
    writeFileSync(join(src, 'kit', 'tuft.ts'), 'export const tuft = 2;');
    writeFileSync(join(src, 'stone.test.ts'), 'a test');
  });

  afterEach(() => {
    process.env = { ...env };
    rmSync(root, { recursive: true, force: true });
  });

  it('paints once and reads the painting back in a later run, pixels and all', () => {
    let calls = 0;
    const paint = () => {
      calls++;
      return { bitmap: { width: 2, height: 1, pixels: Uint8Array.from([3, 7]) }, apart: new Set(['rose']) };
    };
    const first = paintCache({ dir, sources: [src] }).painted('knoll at night', paint);
    const again = paintCache({ dir, sources: [src] }).painted('knoll at night', paint);
    expect(calls).toBe(1);
    expect(again).toEqual(first);
    expect(again.bitmap.pixels).toBeInstanceOf(Uint8Array);
    expect(again.apart.has('rose')).toBe(true);
    // another painting under the same key is its own
    expect(paintCache({ dir, sources: [src] }).painted('knoll at dawn', () => 'dawn')).toBe('dawn');
  });

  it('paints again when a source changes, and not when a test beside it does', () => {
    const key = paintKey([src]);
    writeFileSync(join(src, 'stone.test.ts'), 'another test');
    expect(paintKey([src])).toBe(key);
    writeFileSync(join(src, 'kit', 'tuft.ts'), 'export const tuft = 3;');
    expect(paintKey([src])).not.toBe(key);
    let calls = 0;
    paintCache({ dir, sources: [src] }).painted('map', () => ++calls);
    writeFileSync(join(src, 'stone.ts'), 'export const stone = 4;');
    paintCache({ dir, sources: [src] }).painted('map', () => ++calls);
    expect(calls).toBe(2);
  });

  it('keys on single files and leaves out a source that is not there', () => {
    const file = join(root, 'keri.json');
    writeFileSync(file, '{}');
    const key = paintKey([src, file, join(root, 'missing')]);
    writeFileSync(file, '{"x":1}');
    expect(paintKey([src, file, join(root, 'missing')])).not.toBe(key);
  });

  it('paints everything afresh and keeps nothing when it is off', () => {
    let calls = 0;
    paintCache({ dir, sources: [src], enabled: false }).painted('room', () => ++calls);
    process.env.PIANOR_PAINT_CACHE = '0';
    paintCache({ dir, sources: [src] }).painted('room', () => ++calls);
    expect(calls).toBe(2);
    expect(readdirSync(root)).not.toContain('cache');
  });

  it('keeps its paintings where PIANOR_PAINT_CACHE_DIR says', () => {
    process.env.PIANOR_PAINT_CACHE_DIR = join(root, 'elsewhere');
    const cache = paintCache({ sources: [src] });
    cache.painted('port', () => 1);
    expect(readdirSync(join(root, 'elsewhere'))).toEqual([cache.key]);
  });

  it('paints again over a file cut short', () => {
    const cache = paintCache({ dir, sources: [src] });
    cache.painted('docks', () => 'first');
    const folder = join(dir, cache.key);
    for (const name of readdirSync(folder)) writeFileSync(join(folder, name), 'not gzip');
    expect(paintCache({ dir, sources: [src] }).painted('docks', () => 'second')).toBe('second');
    expect(paintCache({ dir, sources: [src] }).painted('docks', () => 'third')).toBe('second');
  });

  it('still paints where nothing can be kept', () => {
    writeFileSync(join(root, 'a-file'), '');
    expect(paintCache({ dir: join(root, 'a-file'), sources: [src] }).painted('lantern', () => 'lit')).toBe('lit');
  });

  it('keeps the newest three keys', () => {
    for (let i = 0; i < 5; i++) {
      writeFileSync(join(src, 'stone.ts'), `export const stone = ${i};`);
      const cache = paintCache({ dir, sources: [src] });
      cache.painted('crossroads', () => i);
      // each key older than the next, as on a disk where the runs came minutes apart
      utimesSync(join(dir, cache.key), i, i);
    }
    expect(readdirSync(dir)).toHaveLength(3);
  });

  it('is keyed on the same folders as the build\'s cache', () => {
    expect(PAINT_SOURCES).toContain('src/game/ui/pixel');
    expect(paintCache().key).toMatch(/^[0-9a-f]{24}$/);
  });
});
