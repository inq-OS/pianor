// Covers core_08.AC2, core_08.AC4.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkPieceFolder, listPieceFolders } from '../../tools/piece/folder';
import { loadLevelsFile } from '../../tools/piece/levels';

/** The estimator on the real pieces of content/pieces/: the d138 anchors and the confirmed numbers hold. */
const root = join(__dirname, '../..');
const dir = join(root, 'content/pieces');
const { levels } = loadLevelsFile(join(root, 'content/curriculum/levels.json'));
/** Frozen copies of pieces once in the game (tests/fixtures/anchors): the anchors stay when the game's own pieces change. */
const anchors = join(root, 'tests/fixtures/anchors');
const checks = [
  ...listPieceFolders(dir).map((folder) => ({ folder, check: checkPieceFolder(dir, folder, levels) })),
  ...listPieceFolders(anchors).map((folder) => ({ folder, check: checkPieceFolder(anchors, folder, levels) })),
];
/** A character's phrase carries its tug level as its difficulty (d138), not a reading of the estimator's scale. */
const phrases = new Set(
  readdirSync(join(root, 'content/characters')).filter((f) => f.endsWith('.json')).flatMap((f) =>
    Object.values((JSON.parse(readFileSync(join(root, 'content/characters', f), 'utf-8')) as { phrases: Record<string, string[]> }).phrases).flat(),
  ),
);
const proposed = (folder: string) => {
  const found = checkPieceFolder(anchors, folder, levels).difficulty;
  if (!found) throw new Error(`tests/fixtures/anchors/${folder} is gone or does not compile: pick another anchor piece for this test`);
  return found.scale;
};

describe('difficulty of the real pieces', () => {
  it('proposes the number a person confirmed, within one step, for every piece that has one', () => {
    const confirmed = checks.filter((c) => c.check.compiled?.meta?.difficulty !== undefined && !phrases.has(c.folder));
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

  it('keeps the pieces of levels 1 to 5 in the lower half of the scale: none of them is a real classic in full', () => {
    const first = checks.filter((c) => (c.check.compiled?.meta?.level ?? 0) <= 5);
    expect(first.length).toBeGreaterThan(0);
    for (const { folder, check } of first) expect(check.difficulty?.scale ?? 0, folder).toBeLessThanOrEqual(6);
  });

  it('keeps the classics arranged for level 6 at early intermediate at most: a beginner arrangement, never the full score', () => {
    for (const { folder, check } of checks.filter((c) => c.check.compiled?.meta?.level === 6)) expect(check.difficulty?.scale ?? 0, folder).toBeLessThanOrEqual(12);
  });
});
