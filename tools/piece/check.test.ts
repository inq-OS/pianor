// Covers ft_0_04.AC1, core_08.AC4.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkPiece } from '../../src/core/piece/check';
import { loadLevelsFile } from './levels';
import { contentStyles } from './styles';

const root = join(__dirname, '../..');
const { levels } = loadLevelsFile(join(root, 'content/curriculum/levels.json'));
const fixture = (name: string, file: string) => readFileSync(join(root, 'tests/fixtures/pieces', name, file), 'utf-8');
const little = { styles: contentStyles, folder: 'little-steps', abc: fixture('little-steps', 'piece.abc'), meta: fixture('little-steps', 'piece.meta.json'), levels };

describe('checkPiece', () => {
  it('passes a clean piece and says which levels it fits and how hard it is', () => {
    const check = checkPiece(little);
    expect(check.ok).toBe(true);
    expect(check.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(check.level?.level).toBe(1);
    expect(check.fitsLevels).toContain(1);
    expect(check.difficulty?.score).toBeGreaterThan(0);
    expect(check.compiled.chart?.id).toBe('little-steps');
  });

  it('names its files after the folder, or "scratch" when the text is not saved yet', () => {
    expect(checkPiece(little)).toMatchObject({ abcFile: 'little-steps/piece.abc', metaFile: 'little-steps/piece.meta.json' });
    expect(checkPiece({ ...little, folder: null })).toMatchObject({ abcFile: 'scratch/piece.abc' });
  });

  it('checks the folder name against the id only for a saved piece', () => {
    const moved = checkPiece({ ...little, folder: 'other-name' });
    expect(moved.ok).toBe(false);
    expect(moved.diagnostics.at(-1)).toMatchObject({ severity: 'error', message: 'id "little-steps" must match the folder name "other-name"' });
    expect(checkPiece({ ...little, folder: null }).ok).toBe(true);
  });

  it('reports a compile error and does not lint', () => {
    const check = checkPiece({ ...little, abc: 'X:1\nK:C\nC D E $ |]\n' });
    expect(check.ok).toBe(false);
    expect(check.compiled.chart).toBeNull();
    expect(check.lint).toEqual([]);
    expect(check.fitsLevels).toEqual([]);
    expect(check.difficulty).toBeNull();
    expect(check.diagnostics[0]).toMatchObject({ severity: 'error', file: 'little-steps/piece.abc' });
  });

  it('reports a meta file that is not JSON', () => {
    const check = checkPiece({ ...little, meta: '{ nope' });
    expect(check.ok).toBe(false);
    expect(check.diagnostics[0]).toMatchObject({ severity: 'error', file: 'little-steps/piece.meta.json' });
  });

  it('reports a level that is not in the table', () => {
    const check = checkPiece({ ...little, meta: little.meta.replace('"level": 1', '"level": 9') });
    expect(check.ok).toBe(false);
    expect(check.diagnostics.at(-1)).toMatchObject({ rule: 'level', message: 'level 9 is not defined in levels.json' });
    expect(check.level).toBeNull();
  });

  it('keeps linter errors apart from the rest and marks the piece not ok', () => {
    const check = checkPiece({ ...little, abc: 'X:1\nT:Little Steps\nM:4/4\nL:1/4\nQ:1/4=80\nK:C\nC, D, E, F, | G,2 F,2 | F, E, D, C, | C,4 |]\n' });
    expect(check.ok).toBe(false);
    expect(check.lint.some((d) => d.rule === 'range')).toBe(true);
    expect(check.diagnostics).toEqual(expect.arrayContaining(check.lint));
    expect(check.fitsLevels).not.toContain(1);
  });

  it('warns when the confirmed difficulty is two or more steps from the proposal (core_08.AC4)', () => {
    const withDifficulty = (difficulty: number) => ({ ...little, meta: JSON.stringify({ ...JSON.parse(little.meta), difficulty }) });
    const rule = (difficulty: number) => checkPiece(withDifficulty(difficulty)).diagnostics.filter((d) => d.rule === 'difficulty');
    expect(checkPiece(little).difficulty?.scale).toBe(1);
    expect(rule(2)).toEqual([]);
    expect(rule(3)).toMatchObject([{ severity: 'warning', file: 'little-steps/piece.meta.json' }]);
    expect(checkPiece(withDifficulty(3)).ok).toBe(true);
  });
});
