import { describe, expect, it } from 'vitest';
import { parseBuildArgs, parseLintArgs } from './cliArgs.ts';

describe('parseLintArgs', () => {
  it('defaults to the content folders', () => {
    expect(parseLintArgs([])).toEqual({ kind: 'ok', piecesDir: 'content/pieces', levelsPath: 'content/curriculum/levels.json', strict: false });
  });

  it('reads a folder, --levels=path and --strict', () => {
    expect(parseLintArgs(['private/pieces', '--levels=x.json', '--strict'])).toEqual({ kind: 'ok', piecesDir: 'private/pieces', levelsPath: 'x.json', strict: true });
  });

  it('answers --help and -h with the usage instead of linting', () => {
    expect(parseLintArgs(['--help']).kind).toBe('help');
    expect(parseLintArgs(['-h']).kind).toBe('help');
  });

  it('refuses an unknown or misspelt option instead of ignoring it', () => {
    const r = parseLintArgs(['--stict']);
    expect(r.kind).toBe('error');
    expect(r.kind === 'error' && r.message).toMatch(/--stict/);
  });

  it('refuses a second folder', () => {
    expect(parseLintArgs(['a', 'b']).kind).toBe('error');
  });
});

describe('parseBuildArgs', () => {
  it('defaults to content/pieces into build/charts', () => {
    expect(parseBuildArgs([])).toEqual({ kind: 'ok', piecesDir: 'content/pieces', outDir: 'build/charts' });
  });

  it('reads the two folders', () => {
    expect(parseBuildArgs(['p', 'o'])).toEqual({ kind: 'ok', piecesDir: 'p', outDir: 'o' });
  });

  it('answers --help instead of building into a folder named --help', () => {
    expect(parseBuildArgs(['--help']).kind).toBe('help');
  });

  it('refuses an unknown option and a third folder', () => {
    expect(parseBuildArgs(['--out=x']).kind).toBe('error');
    expect(parseBuildArgs(['a', 'b', 'c']).kind).toBe('error');
  });
});
