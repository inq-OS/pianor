import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ladderPieceProblems, loadLadder } from '../../src/core/campaign/content';
import { checkPieceFolder, listPieceFolders } from '../../tools/piece/folder';
import { loadLevelsFile } from '../../tools/piece/levels';

/**
 * The campaign ladder against the pieces it names: a missing or too short piece would only fail when the student starts
 * that level. Ids starting with `placeholder-` stand for pieces not written yet; they are listed here so
 * the test notices when one is replaced, and every real id is checked.
 */
const PLACEHOLDER = 'placeholder-';
const root = join(__dirname, '../..');
const dir = join(root, 'content/pieces');
const { levels } = loadLevelsFile(join(root, 'content/curriculum/levels.json'));
const ladder = loadLadder(JSON.parse(readFileSync(join(root, 'content/campaign/ladder.json'), 'utf8')));
const barsById = new Map(listPieceFolders(dir).flatMap((folder) => {
  const chart = checkPieceFolder(dir, folder, levels).compiled?.chart;
  return chart ? [[chart.id, chart.bars.length] as const] : [];
}));

describe('campaign ladder and its pieces (content/campaign/ladder.json)', () => {
  it('every real ladder piece exists in content/pieces and holds the longest bar range of its levels', () => {
    const real = { ...ladder, monsters: ladder.monsters.filter((m) => !m.piece.startsWith(PLACEHOLDER)) };
    expect(ladderPieceProblems(real, (id) => barsById.get(id))).toEqual([]);
  });

  it('the same check finds a real piece that is too short for a synthetic ladder', () => {
    const [id, bars] = [...barsById][0]!;
    const synthetic = loadLadder({
      schemaVersion: 1,
      monsters: [{ id: 'm1', name: 'Synthetic', piece: id, levels: [1, 2, bars + 1].map((end) => ({ bars: [1, end], accuracy: 0.5 })) }],
    });
    expect(ladderPieceProblems(synthetic, (pieceId) => barsById.get(pieceId))).toEqual([{ monster: 'm1', piece: id, problem: 'too-short', bars, needs: bars + 1 }]);
  });

  it('a placeholder id is only used while the ladder says it holds placeholders', () => {
    const placeholders = ladder.monsters.filter((m) => m.piece.startsWith(PLACEHOLDER));
    if (placeholders.length > 0) expect(ladder.note ?? '').toMatch(/PLACEHOLDER/);
    for (const m of placeholders) expect(barsById.has(m.piece), `${m.piece} is a real piece now: drop the prefix`).toBe(false);
  });
});

describe('monster songs', () => {
  it('the four monsters fight over songs of 8, 16, 24 and 32 bars: level 1 the first half, levels 2 and 3 the whole song', () => {
    expect(ladder.monsters.map((m) => barsById.get(m.piece))).toEqual([8, 16, 24, 32]);
    for (const m of ladder.monsters) {
      const bars = barsById.get(m.piece)!;
      expect(m.levels.map((l) => l.bars), m.id).toEqual([[1, bars / 2], [1, bars], [1, bars]]);
    }
  });

  it('every monster song is original, a draft until a person approves it, and written for its level', () => {
    for (const [index, m] of ladder.monsters.entries()) {
      const meta = JSON.parse(readFileSync(join(dir, m.piece, 'piece.meta.json'), 'utf8')) as { level: number; status: string; source: string; license: string };
      expect(meta.level, m.piece).toBe(index + 1);
      expect(meta.source, m.piece).toBe('original');
      expect(meta.license, m.piece).toBe('CC0-1.0');
      expect(['draft', 'approved'], m.piece).toContain(meta.status);
    }
  });
});
