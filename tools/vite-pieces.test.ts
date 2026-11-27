import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { E2E_PIECES, piecesPlugin } from './vite-pieces.ts';
import { listPieceFolders } from './piece/folder';

type Hook = (this: unknown, ...args: unknown[]) => unknown;

/** Runs the plugin's `load` of `virtual:pieces` as a dev server or a production build would, and reads back what it exports. */
function loadVirtualPieces(command: 'serve' | 'build', mode = command === 'build' ? 'production' : 'development'): { pieces: { meta: { id: string; status: string } }[]; omittedIds: string[] } {
  const plugin = piecesPlugin();
  (plugin.configResolved as Hook)({ command, mode });
  const resolved = (plugin.resolveId as Hook)('virtual:pieces') as string;
  const context = { error: (text: string) => { throw new Error(text); }, warn: () => {}, addWatchFile: () => {} };
  const code = (plugin.load as Hook).call(context, resolved) as string;
  const match = /^export default (.*);\nexport const omittedIds = (.*);$/s.exec(code);
  if (!match) throw new Error(`unexpected module: ${code.slice(0, 80)}`);
  return { pieces: JSON.parse(match[1]!), omittedIds: JSON.parse(match[2]!) };
}

/** Runs `run` with PIANOR_E2E set to `value` (undefined: unset), as the end-to-end tests' server would. */
function withE2E<T>(value: string | undefined, run: () => T): T {
  const before = process.env['PIANOR_E2E'];
  if (value === undefined) delete process.env['PIANOR_E2E'];
  else process.env['PIANOR_E2E'] = value;
  try {
    return run();
  } finally {
    if (before === undefined) delete process.env['PIANOR_E2E'];
    else process.env['PIANOR_E2E'] = before;
  }
}

describe('virtual:pieces', () => {
  it('a production build leaves out the drafts and lists their ids', () => {
    // the end-to-end tests' own pieces hold drafts, whatever the game's pieces are
    const dev = withE2E('1', () => loadVirtualPieces('serve'));
    const build = withE2E('1', () => loadVirtualPieces('build'));
    const drafts = dev.pieces.filter((p) => p.meta.status !== 'approved').map((p) => p.meta.id);
    expect(drafts.length).toBeGreaterThan(0);
    expect(dev.omittedIds).toEqual([]);
    expect(build.pieces.every((p) => p.meta.status === 'approved')).toBe(true);
    expect(build.omittedIds.sort()).toEqual(drafts.sort());
    expect(build.pieces.length + build.omittedIds.length).toBe(dev.pieces.length);
  });

  it('a build in mode development (the end-to-end tests\' bundle) keeps the drafts, as the dev server does', () => {
    const dev = loadVirtualPieces('serve');
    const bundle = loadVirtualPieces('build', 'development');
    expect(bundle.omittedIds).toEqual([]);
    expect(bundle.pieces.map((p) => p.meta.id)).toEqual(dev.pieces.map((p) => p.meta.id));
  });
});

describe('the end-to-end tests\' own pieces', () => {
  it('come only into the tests\' bundle, never into the game', () => {
    const own = listPieceFolders(E2E_PIECES);
    expect(own).toEqual(expect.arrayContaining(['grace-steps', 'morning-song-intro']));
    const ids = (e2e: string | undefined) => withE2E(e2e, () => loadVirtualPieces('build', 'development')).pieces.map((p) => p.meta.id);
    expect(ids('1')).toEqual(expect.arrayContaining(own));
    expect(ids(undefined).filter((id) => own.includes(id))).toEqual([]);
  });
});

describe('the preview tool\'s requests on the preview server', () => {
  const handlers = (env: string | undefined): unknown[] => {
    const before = process.env['PIANOR_E2E'];
    if (env === undefined) delete process.env['PIANOR_E2E'];
    else process.env['PIANOR_E2E'] = env;
    try {
      const used: unknown[] = [];
      (piecesPlugin().configurePreviewServer as Hook)({ middlewares: { use: (h: unknown) => void used.push(h) } });
      return used;
    } finally {
      if (before === undefined) delete process.env['PIANOR_E2E'];
      else process.env['PIANOR_E2E'] = before;
    }
  };

  it('are answered only for the end-to-end tests, so a student\'s own build (start:local) can never change a piece', () => {
    expect(handlers(undefined)).toHaveLength(0);
    expect(handlers('1')).toHaveLength(1);
  });
});

describe('virtual:pieces with the private folder (ft_Y_04.AC14)', () => {
  it('ft_Y_04.AC14 gives the private pieces that compile, without the level limits; a draft only to the dev server; a taken id left out', () => {
    const root = mkdtempSync(join(tmpdir(), 'pianor-private-'));
    const piece = (id: string, abc: string, status = 'draft') => {
      mkdirSync(join(root, id));
      writeFileSync(join(root, id, 'piece.abc'), `X:1\nT:${id}\nM:4/4\nL:1/4\nK:C\n${abc}\n`);
      writeFileSync(join(root, id, 'piece.meta.json'), JSON.stringify({ id, title: id, level: 1, unlockLevel: 1, status, hands: ['RH'], phrases: [], source: 'synthetic', license: 'NaN', generator: { kind: 'import' } }));
    };
    piece('wish-chords', '[CEG]4 | [DFA]4 | [CEG]4 | C4 | D4 | E4 | F4 | G4 | A4 | B4 | c4 | d4 | e4 | f4 | g4 | a4 | b4 |]', 'approved');
    piece('wish-draft', 'C4 | D4 | E4 | C4 |]');
    piece('broken', 'C4 | D3 |]', 'approved');
    piece('twinkle-twinkle', 'C4 | C4 | C4 | C4 |]', 'approved');
    const warnings: string[] = [];
    const load = (command: 'serve' | 'build') => {
      const plugin = piecesPlugin('content/pieces', 'content/curriculum/levels.json', root);
      (plugin.configResolved as Hook)({ command });
      const context = { error: (text: string) => { throw new Error(text); }, warn: (text: string) => void warnings.push(text), addWatchFile: () => {} };
      const code = (plugin.load as Hook).call(context, (plugin.resolveId as Hook)('virtual:pieces')) as string;
      const match = /^export default (.*);\nexport const omittedIds = (.*);$/s.exec(code)!;
      return { pieces: JSON.parse(match[1]!) as { meta: { id: string; source: string } }[], omittedIds: JSON.parse(match[2]!) as string[] };
    };
    const dev = load('serve');
    const ids = dev.pieces.map((p) => p.meta.id);
    expect(ids).toContain('wish-chords');
    expect(ids).toContain('wish-draft');
    expect(ids).not.toContain('broken');
    expect(dev.pieces.filter((p) => p.meta.id === 'twinkle-twinkle').map((p) => p.meta.source)).not.toContain('synthetic');
    expect(warnings.some((w) => w.includes('broken/piece.abc'))).toBe(true);
    expect(warnings.some((w) => w.includes('content/pieces has a piece "twinkle-twinkle" too'))).toBe(true);
    const build = load('build');
    expect(build.pieces.map((p) => p.meta.id)).toContain('wish-chords');
    expect(build.omittedIds).toContain('wish-draft');
    rmSync(root, { recursive: true, force: true });
  });
});

describe('a piece with an error', () => {
  it('fails a production build, and only warns in the end-to-end tests\' bundle as on the dev server', () => {
    const root = mkdtempSync(join(tmpdir(), 'pianor-pieces-'));
    mkdirSync(join(root, 'broken'));
    writeFileSync(join(root, 'broken', 'piece.abc'), 'X:1\nT:broken\nM:4/4\nL:1/4\nK:C\nC4 | D3 |]\n');
    writeFileSync(join(root, 'broken', 'piece.meta.json'), JSON.stringify({ id: 'broken', title: 'broken', level: 1, unlockLevel: 1, status: 'draft', hands: ['RH'], phrases: [], source: 'synthetic', license: 'CC0-1.0', generator: { kind: 'import' } }));
    const load = (command: 'serve' | 'build', mode: string) => {
      const plugin = piecesPlugin(root, 'content/curriculum/levels.json', null);
      (plugin.configResolved as Hook)({ command, mode });
      const context = { error: (text: string) => { throw new Error(text); }, warn: () => {}, addWatchFile: () => {} };
      return () => (plugin.load as Hook).call(context, (plugin.resolveId as Hook)('virtual:pieces'));
    };
    try {
      expect(load('build', 'production')).toThrow();
      expect(load('build', 'development')).not.toThrow();
      expect(load('serve', 'development')).not.toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
