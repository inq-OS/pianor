import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import type { E2eArea } from './areas.ts';
import { matchesPath, playwrightArgs, selectAreas } from './affected.ts';

const AREAS: E2eArea[] = [
  { name: 'practice', specs: ['practice', 'tempo'], sources: ['src/game/PracticeScene.ts', 'src/game/ui/staff/'] },
  { name: 'editor', specs: ['editor'], sources: ['src/game/editor/', 'src/game/ui/staff/'] },
  { name: 'visual', specs: ['visual'], sources: ['src/game/'] },
];
const SHARED = ['src/io/', 'src/game/ui/pixel/', 'package.json'];
const NONE = ['docs/', '*.md', '*.test.ts'];
const select = (files: string[]) => selectAreas(files, AREAS, SHARED, NONE);

describe('matchesPath', () => {
  it('matches a folder by prefix, a file exactly and *.ext by ending', () => {
    expect(matchesPath('src/game/editor/Grid.ts', 'src/game/editor/')).toBe(true);
    expect(matchesPath('src/game/editorX.ts', 'src/game/editor/')).toBe(false);
    expect(matchesPath('package.json', 'package.json')).toBe(true);
    expect(matchesPath('tools/package.json', 'package.json')).toBe(false);
    expect(matchesPath('src/core/judge/judge.test.ts', '*.test.ts')).toBe(true);
    expect(matchesPath('src/core/judge/judge.ts', '*.test.ts')).toBe(false);
  });
});

describe('selectAreas', () => {
  it('runs nothing for docs and unit tests only', () => {
    expect(select(['docs/testing.md', 'README.md', 'src/game/editor/grid.test.ts'])).toEqual({ all: false, areas: [], reasons: [] });
  });

  it('runs the area whose source changed, and every area that shares the source, in table order', () => {
    const sel = select(['src/game/ui/staff/StaffView.ts']);
    expect(sel.all).toBe(false);
    expect(sel.areas).toEqual(['practice', 'editor', 'visual']);
    expect(sel.reasons).toEqual(['src/game/ui/staff/StaffView.ts → practice, editor, visual']);
  });

  it('runs the area of a changed spec file, its screenshot folder included', () => {
    expect(select(['tests/e2e/tempo.spec.ts']).areas).toEqual(['practice']);
    expect(select(['tests/e2e/visual.spec.ts-snapshots/menu-chromium-linux.png']).areas).toEqual(['visual']);
  });

  it('runs every area for a shared path, even when an area also names a folder above it', () => {
    const sel = select(['src/game/ui/pixel/PixelScene.ts', 'src/game/editor/Grid.ts']);
    expect(sel.all).toBe(true);
    expect(sel.areas).toEqual(['practice', 'editor', 'visual']);
    expect(sel.reasons).toContain('src/game/ui/pixel/PixelScene.ts is shared → all areas');
  });

  it('runs every area for a file no area names, so nothing is skipped silently', () => {
    const sel = select(['src/newThing.ts']);
    expect(sel.all).toBe(true);
    expect(sel.reasons).toEqual(['src/newThing.ts is in no area → all areas']);
  });
});

describe('playwrightArgs', () => {
  it('is null when nothing needs to run', () => {
    expect(playwrightArgs({ all: false, areas: [], reasons: [] })).toBeNull();
  });

  it('is empty (the whole suite) when every area runs', () => {
    expect(playwrightArgs({ all: true, areas: ['practice', 'editor'], reasons: [] })).toEqual([]);
  });

  it('greps the chosen projects (the project name leads the title Playwright greps) and the smoke tests', () => {
    expect(playwrightArgs({ all: false, areas: ['practice', 'editor'], reasons: [] })).toEqual(['--grep', '^(?:practice|editor) |@smoke']);
  });
});

describe('affected-cli without node_modules', () => {
  it('runs a dry run with plain Node type stripping, as the changes job of CI does', () => {
    const run = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', 'tools/e2e/affected-cli.ts', 'HEAD', '--dry-run'], { encoding: 'utf8' });
    expect(run.stderr).toBe('');
    expect(run.status).toBe(0);
    expect(run.stdout).toMatch(/Changed files: \d+/);
  });
});
