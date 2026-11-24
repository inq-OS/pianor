// Covers ft_1_06.AC1, ft_1_06.AC5 (the ladder data they rest on).
import { describe, expect, it } from 'vitest';
import ladderJson from '../../../content/campaign/ladder.json';
import { ladderPieceProblems, levelBars, loadLadder } from './content';

const level = (over: Record<string, unknown> = {}) => ({ bars: [1, 8], ...over });
const monster = (id: string, levels: unknown[] = [level(), level({ bars: [1, 16] }), level({ bars: [1, 32] })]) =>
  ({ id, name: `Placeholder ${id}`, piece: `placeholder-${id}`, levels });
const ladder = (over: Record<string, unknown> = {}) => ({ schemaVersion: 1, monsters: [monster('m1')], ...over });

describe('campaign ladder (content/campaign/ladder.json)', () => {
  it('ft_1_06.AC1: the file holds 4 monsters m1 to m4 in order, each with 3 levels', () => {
    const l = loadLadder(ladderJson);
    expect(l.monsters.map((m) => m.id)).toEqual(['m1', 'm2', 'm3', 'm4']);
    for (const m of l.monsters) expect(m.levels).toHaveLength(3);
  });

  it('ft_1_06.AC5: levels 1 to 3 ask for the first half of the song, the whole song, the whole song', () => {
    for (const [index, m] of loadLadder(ladderJson).monsters.entries()) {
      const song = 8 * (index + 1);
      expect(m.levels.map((x) => x.bars)).toEqual([[1, song / 2], [1, song], [1, song]]);
    }
  });

  it('accepts a minimal valid ladder', () => {
    expect(loadLadder(ladder()).monsters).toHaveLength(1);
  });

  it('rejects a wrong schemaVersion', () => {
    expect(() => loadLadder(ladder({ schemaVersion: 2 }))).toThrow();
  });

  it('rejects a bar range whose end is below its start', () => {
    const bad = monster('m1', [level({ bars: [5, 4] }), level(), level()]);
    expect(() => loadLadder(ladder({ monsters: [bad] }))).toThrow();
  });

  it('accepts a level of one bar (the end equals the start)', () => {
    const one = monster('m1', [level({ bars: [1, 1] }), level(), level()]);
    expect(loadLadder(ladder({ monsters: [one] })).monsters[0]!.levels[0]!.bars).toEqual([1, 1]);
  });

  it('rejects a bar range that does not start at 1', () => {
    const bad = monster('m1', [level({ bars: [2, 8] }), level(), level()]);
    expect(() => loadLadder(ladder({ monsters: [bad] }))).toThrow();
  });

  it('rejects an empty monster list', () => {
    expect(() => loadLadder(ladder({ monsters: [] }))).toThrow();
  });

  it('rejects a monster without exactly 3 levels', () => {
    expect(() => loadLadder(ladder({ monsters: [monster('m1', [level(), level()])] }))).toThrow();
    expect(() => loadLadder(ladder({ monsters: [monster('m1', [level(), level(), level(), level()])] }))).toThrow();
  });

  it('still loads an older ladder with the retired find-the-key numbers and ignores them', () => {
    const old = loadLadder(ladder({ windowMs: 120000, findKey: { crackNotes: 16 }, monsters: [monster('m1', [level({ accuracy: 0.6, cracks: 4, windowFactor: 2.5 }), level(), level()])] }));
    expect(old).not.toHaveProperty('windowMs');
    expect(old).not.toHaveProperty('findKey');
    expect(old.monsters[0]!.levels[0]).toEqual({ bars: [1, 8] });
  });

});

describe('ladderPieceProblems', () => {
  // A synthetic ladder: m1's piece is long enough, m2's has 12 bars for a level that needs 32, m3's does not exist.
  const synthetic = loadLadder(ladder({ monsters: [monster('m1'), monster('m2'), monster('m3')] }));
  const bars: Record<string, number> = { 'placeholder-m1': 32, 'placeholder-m2': 12 };

  it('names a missing piece and a piece shorter than the longest bar range of its levels', () => {
    expect(ladderPieceProblems(synthetic, (id) => bars[id])).toEqual([
      { monster: 'm2', piece: 'placeholder-m2', problem: 'too-short', bars: 12, needs: 32 },
      { monster: 'm3', piece: 'placeholder-m3', problem: 'missing' },
    ]);
  });

  it('finds nothing when every piece exists and holds every level', () => {
    expect(ladderPieceProblems(synthetic, () => 32)).toEqual([]);
    expect(ladderPieceProblems(synthetic, () => 40)).toEqual([]);
  });
});

describe('levelBars: the part of the player\'s own piece a level plays (d095)', () => {
  it('ft_1_06.AC9 level 1 is the first half of the piece, levels 2 and 3 the whole piece', () => {
    expect([1, 2, 3].map((lv) => levelBars(lv as 1 | 2 | 3, 8))).toEqual([[1, 4], [1, 8], [1, 8]]);
    expect([1, 2, 3].map((lv) => levelBars(lv as 1 | 2 | 3, 40))).toEqual([[1, 20], [1, 40], [1, 40]]);
  });
  it('ft_1_06.AC9 an odd number of bars rounds the half up, and a one-bar piece is played whole', () => {
    expect(levelBars(1, 7)).toEqual([1, 4]);
    expect(levelBars(1, 1)).toEqual([1, 1]);
  });
  it('ft_1_06.AC9 gives the same bars as the ladder for every monster song', () => {
    for (const [index, m] of loadLadder(ladderJson).monsters.entries()) {
      const song = 8 * (index + 1);
      expect(m.levels.map((_, i) => levelBars((i + 1) as 1 | 2 | 3, song))).toEqual(m.levels.map((x) => x.bars));
    }
  });
});
