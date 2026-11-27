// Covers core_05.AC1, core_05.AC2.
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { complexityOf } from '../../src/core/properties/complexity';
import { pieceFeatures } from '../../src/core/properties/features';
import { checkPieceFolder, listPieceFolders } from '../../tools/piece/folder';
import { loadLevelsFile } from '../../tools/piece/levels';

/** The features of the real pieces in content/pieces/, compiled from ABC: what the info card in the menu would list. */
const root = join(__dirname, '../..');
const dir = join(root, 'content/pieces');
const { levels } = loadLevelsFile(join(root, 'content/curriculum/levels.json'));
/** Frozen copies of pieces once in the game: the named pieces below are read from here, so they stay when the game's change. */
const anchors = join(root, 'tests/fixtures/anchors');
const featuresOf = (folder: string, from = anchors) => {
  const chart = checkPieceFolder(from, folder, levels).compiled?.chart;
  if (!chart) throw new Error(`${folder} did not compile`);
  return pieceFeatures(chart);
};

describe('features of the real pieces', () => {
  it('gives every piece a fastest note, and none an odd meter or a change (the first set is plain)', () => {
    for (const folder of listPieceFolders(dir)) {
      const features = featuresOf(folder, dir);
      expect(features.filter((f) => f.startsWith('fastest.')), folder).toHaveLength(1);
      expect(features, folder).not.toEqual(expect.arrayContaining(['oddMeter']));
      expect(features, folder).not.toEqual(expect.arrayContaining(['keyChange']));
    }
  });

  it('knows the two-hand pieces from the one-hand ones', () => {
    expect(featuresOf('both-hands')).toEqual(expect.arrayContaining(['twoHands', 'handsApart']));
    expect(featuresOf('take-turns')).toContain('twoHands');
    expect(featuresOf('hot-cross-buns')).not.toContain('twoHands');
    expect(featuresOf('ode-to-joy-left-hand')).not.toContain('twoHands');
  });

  it('finds the rests and the eighth notes that the pieces are about', () => {
    expect(featuresOf('quiet-pond')).toContain('rests');
    expect(featuresOf('skipping-stones')).toContain('fastest.eighth');
    expect(featuresOf('hot-cross-buns')).toEqual(['fastest.quarter']);
  });

  it('gives the easiest piece fewer stars than the two-hand piece, both Beginners (d154)', () => {
    const complexity = (folder: string) => complexityOf(checkPieceFolder(anchors, folder, levels).difficulty!.points);
    expect(complexity('hot-cross-buns').stars).toBeLessThan(complexity('both-hands').stars);
    expect([complexity('hot-cross-buns').grade, complexity('both-hands').grade]).toEqual(['beginner', 'beginner']);
  });
});
