// Covers ft_1_02b.AC3.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { checkPiece } from '../../src/core/piece/check';
import { isPrivatePiecesDir } from './folder';
import { loadLevelsFile } from './levels';
import { lintPieces } from './lintFiles';
import { contentStyles } from './styles';

const root = join(__dirname, '../..');
const { levels } = loadLevelsFile(join(root, 'content/curriculum/levels.json'));
const ABC = 'X:1\nT:Test Piece\nM:4/4\nL:1/4\nQ:1/4=80\nK:C\nC D E F | G2 F2 | F E D C | C4 |]\n';
const meta = (license: string) => JSON.stringify({
  id: 'p', title: 'Test Piece', level: 1, status: 'draft', hands: ['RH'], phrases: [{ name: 'All', bars: [1, 4] }],
  tags: [], source: 'written in Pianor by a friend', license, generator: { kind: 'manual' },
});

const dirs: string[] = [];
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));
/** A pieces folder `<tmp>/<where>` holding the piece `p` with the given licence. */
function piecesAt(where: string, license: string): string {
  const base = mkdtempSync(join(tmpdir(), 'pianor-license-'));
  dirs.push(base);
  const dir = join(base, where);
  mkdirSync(join(dir, 'p'), { recursive: true });
  writeFileSync(join(dir, 'p', 'piece.abc'), ABC);
  writeFileSync(join(dir, 'p', 'piece.meta.json'), meta(license));
  return dir;
}
const licenseWarnings = (dir: string) => lintPieces(dir, levels).linted.flatMap((p) => p.diagnostics).filter((d) => d.rule === 'license');
const lintCommand = (...args: string[]) => spawnSync(process.execPath, ['--import', 'tsx', join(root, 'tools/piece/lint.ts'), ...args], { cwd: root, encoding: 'utf-8' });

describe('the licence rule for own pieces (NaN)', () => {
  it('ft_1_02b.AC3 accepts NaN without a warning under private/pieces', () => {
    expect(licenseWarnings(piecesAt('private/pieces', 'NaN'))).toEqual([]);
  });

  it('ft_1_02b.AC3 warns about NaN in content/pieces and says why', () => {
    const warnings = licenseWarnings(piecesAt('content/pieces', 'NaN'));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ severity: 'warning', rule: 'license' });
    expect(warnings[0]!.message).toContain('private/pieces');
  });

  it('keeps the old rule for every other licence, in both places', () => {
    for (const where of ['private/pieces', 'content/pieces']) {
      expect(licenseWarnings(piecesAt(where, 'All rights reserved')), where).toHaveLength(1);
      expect(licenseWarnings(piecesAt(where, 'CC0-1.0')), where).toEqual([]);
    }
  });

  it('knows a private pieces folder by its last two path segments, relative or absolute', () => {
    expect(isPrivatePiecesDir('private/pieces')).toBe(true);
    expect(isPrivatePiecesDir(join(root, 'private', 'pieces'))).toBe(true);
    expect(isPrivatePiecesDir(join(root, 'private', 'pieces') + '/')).toBe(true);
    expect(isPrivatePiecesDir('content/pieces')).toBe(false);
    expect(isPrivatePiecesDir('private')).toBe(false);
    expect(isPrivatePiecesDir('private/pieces/sub')).toBe(false);
    expect(isPrivatePiecesDir('myprivate/pieces')).toBe(false);
  });

  it('checkPiece takes the same rule as an option for text that is not in a folder', () => {
    const run = (privatePiece: boolean) => checkPiece({ styles: contentStyles, folder: null, abc: ABC, meta: meta('NaN'), levels, ...(privatePiece ? { privatePiece } : {}) });
    expect(run(true).diagnostics.filter((d) => d.rule === 'license')).toEqual([]);
    expect(run(false).diagnostics.filter((d) => d.rule === 'license')).toHaveLength(1);
  });

  it('the lint command does not crash on a missing or empty private/pieces folder', () => {
    const missing = lintCommand(join(tmpdir(), 'pianor-license-none', 'private', 'pieces'));
    expect(missing.status).toBe(0);
    expect(missing.stdout).toContain('No pieces found');
    const empty = join(mkdtempSync(join(tmpdir(), 'pianor-license-')), 'private', 'pieces');
    dirs.push(empty);
    mkdirSync(empty, { recursive: true });
    expect(lintCommand(empty).status).toBe(0);
  });

  it('ft_1_02b.AC3 the lint command accepts NaN in a private folder even with --strict and warns elsewhere', () => {
    const privateRun = lintCommand(piecesAt('private/pieces', 'NaN'), '--strict');
    expect(privateRun.stdout).toContain('0 warning(s)');
    const contentRun = lintCommand(piecesAt('content/pieces', 'NaN'), '--strict');
    expect(contentRun.status).toBe(1);
    expect(contentRun.stdout).toContain('[license]');
  });
});
