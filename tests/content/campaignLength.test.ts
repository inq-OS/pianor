import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadLadder } from '../../src/core/campaign/content';
import { loadLevelsFile } from '../../tools/piece/levels';

const root = join(__dirname, '../..');
const { levels } = loadLevelsFile(join(root, 'content/curriculum/levels.json'));
const ladder = loadLadder(JSON.parse(readFileSync(join(root, 'content/campaign/ladder.json'), 'utf8')));

describe('campaign songs and the level table', () => {
  it('lets every level hold the longest campaign song, so a beginner monster song passes piece-length', () => {
    const longest = Math.max(...ladder.monsters.flatMap((m) => m.levels.map((l) => l.bars[1])));
    expect(levels.length).toBeGreaterThan(0);
    for (const level of levels) expect(level.bars.max, `level ${level.level}`).toBeGreaterThanOrEqual(longest);
  });
});
