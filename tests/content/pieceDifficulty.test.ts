// Covers core_08.AC2, core_08.AC4.
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkPieceFolder, listPieceFolders } from '../../tools/piece/folder';
import { loadLevelsFile } from '../../tools/piece/levels';

/** The estimator on the real pieces of content/pieces/: the d138 anchors and the confirmed numbers hold. */
const root = join(__dirname, '../..');
const dir = join(root, 'content/pieces');
const { levels } = loadLevelsFile(join(root, 'content/curriculum/levels.json'));
const checks = listPieceFolders(dir).map((folder) => ({ folder, check: checkPieceFolder(dir, folder, levels) }));
const proposed = (folder: string) => {
  const found = checks.find((c) => c.folder === folder)?.check.difficulty;
  if (!found) throw new Error(`content/pieces/${folder} is gone or does not compile: pick another anchor piece for this test`);
  return found.scale;
};

describe('difficulty of the real pieces', () => {
  it('proposes the number a person confirmed, within one step, for every piece that has one', () => {
    const confirmed = checks.filter((c) => c.check.compiled?.meta?.difficulty !== undefined);
    expect(confirmed.length).toBeGreaterThan(0);
    for (const { folder, check } of confirmed) expect(Math.abs(check.compiled!.meta!.difficulty! - check.difficulty!.scale), folder).toBeLessThanOrEqual(1);
  });

  it("orders Puuvaim's three phrases as their tug levels, and a one-hand tune below the two-hand pieces", () => {
    expect(proposed('puuvaim-1')).toBeLessThan(proposed('puuvaim-3'));
    expect(proposed('puuvaim-1')).toBeLessThanOrEqual(proposed('puuvaim-2'));
    expect(proposed('puuvaim-2')).toBeLessThanOrEqual(proposed('puuvaim-3'));
    expect(proposed('hot-cross-buns')).toBeLessThan(proposed('both-hands'));
    expect(proposed('ode-to-joy')).toBeLessThan(proposed('gen-echo-l4-both-s1'));
  });

  it('keeps the first set of pieces in the lower half of the scale: none of them is a real classic in full', () => {
    for (const { folder, check } of checks) expect(check.difficulty?.scale ?? 0, folder).toBeLessThanOrEqual(6);
  });
});
