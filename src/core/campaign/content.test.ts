// Covers ft_1_06.AC1, ft_1_06.AC2, ft_1_06.AC5 (the ladder data they rest on).
import { describe, expect, it } from 'vitest';
import ladderJson from '../../../content/campaign/ladder.json';
import { buildBars } from '../chart/time';
import { DEFAULT_WINDOW_FACTORS, findKeyOptionsFor, ladderPieceProblems, levelBars, loadLadder, windowFactorOf } from './content';
import { DEFAULT_CRACK_RULES } from './findKey';

const level = (over: Record<string, unknown> = {}) => ({ bars: [1, 8], accuracy: 0.5, ...over });
const monster = (id: string, levels: unknown[] = [level(), level({ bars: [1, 16], accuracy: 0.75 }), level({ bars: [1, 32], accuracy: 0.9 })]) =>
  ({ id, name: `Placeholder ${id}`, piece: `placeholder-${id}`, levels });
/** The monster's piece: 32 bars of 4/4 at 120 BPM, so a bar takes 2000 ms. */
const chart = { tempoMap: [{ tick: 0, bpm: 120 }], bars: buildBars([{ tick: 0, num: 4, den: 4 }], 32) };
const ladder = (over: Record<string, unknown> = {}) => ({ schemaVersion: 1, monsters: [monster('m1')], ...over });

describe('campaign ladder (content/campaign/ladder.json)', () => {
  it('ft_1_06.AC1: the file holds 4 monsters m1 to m4 in order, each with 3 levels', () => {
    const l = loadLadder(ladderJson);
    expect(l.monsters.map((m) => m.id)).toEqual(['m1', 'm2', 'm3', 'm4']);
    for (const m of l.monsters) expect(m.levels).toHaveLength(3);
  });

  it('ft_1_06.AC5: levels 1 to 3 ask for the first half of the song, the whole song, the whole song, and accuracy 0.6, 0.8, 0.95', () => {
    for (const [index, m] of loadLadder(ladderJson).monsters.entries()) {
      const song = 8 * (index + 1);
      expect(m.levels.map((x) => x.bars)).toEqual([[1, song / 2], [1, song], [1, song]]);
      expect(m.levels.map((x) => x.accuracy)).toEqual([0.6, 0.8, 0.95]);
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

  it('rejects accuracy outside 0 to 1', () => {
    for (const accuracy of [-0.1, 1.1]) {
      const bad = monster('m1', [level({ accuracy }), level(), level()]);
      expect(() => loadLadder(ladder({ monsters: [bad] }))).toThrow();
    }
  });

  it('rejects an empty monster list', () => {
    expect(() => loadLadder(ladder({ monsters: [] }))).toThrow();
  });

  it('rejects a monster without exactly 3 levels', () => {
    expect(() => loadLadder(ladder({ monsters: [monster('m1', [level(), level()])] }))).toThrow();
    expect(() => loadLadder(ladder({ monsters: [monster('m1', [level(), level(), level(), level()])] }))).toThrow();
  });

  it('ft_1_06.AC2 the file gives levels 1 to 3 the window factors 2.5, 1.75 and 1.25', () => {
    for (const m of loadLadder(ladderJson).monsters) expect(m.levels.map((x) => x.windowFactor)).toEqual([2.5, 1.75, 1.25]);
  });

  it('ft_1_06.AC2 a level without a window factor takes the default of its place: 2.5, 1.75, 1.25', () => {
    const l = loadLadder(ladder());
    expect(l.monsters[0]!.levels.map((x, i) => windowFactorOf(x, i))).toEqual([...DEFAULT_WINDOW_FACTORS]);
    expect(windowFactorOf({ bars: [1, 8], accuracy: 0.5, windowFactor: 2.5 }, 0)).toBe(2.5);
  });

  it('rejects a window factor below 1, which would make the window shorter than the part', () => {
    const bad = monster('m1', [level({ windowFactor: 0.9 }), level(), level()]);
    expect(() => loadLadder(ladder({ monsters: [bad] }))).toThrow();
  });

  it('still loads an older ladder with a fixed windowMs and ignores it', () => {
    expect(loadLadder(ladder({ windowMs: 120000 }))).not.toHaveProperty('windowMs');
  });

  it('ft_1_06.AC2: levels 1 to 3 break the key after 4, 3 and 2 cracks, with the numbers in the file', () => {
    const l = loadLadder(ladderJson);
    for (const m of l.monsters) expect(m.levels.map((x) => x.cracks)).toEqual([4, 3, 2]);
    expect(l.findKey).toEqual({ crackNotes: 16, lengthStep: 0.25, repeatStep: 0.25, weightCap: 2.5 });
    expect(findKeyOptionsFor(l, 0, 2, chart)).toEqual({ windowMs: 8 * 2000 * 1.75, cracks: 3, rules: DEFAULT_CRACK_RULES });
  });

  it('ft_1_06.AC2: a ladder without cracks, window factors or rules (an older file) falls back to the defaults', () => {
    const l = loadLadder(ladder({ windowMs: 5000 }));
    expect(l.findKey).toBeUndefined();
    expect([1, 2, 3].map((lv) => findKeyOptionsFor(l, 0, lv as 1 | 2 | 3, chart).cracks)).toEqual([4, 3, 2]);
    expect([1, 2, 3].map((lv) => findKeyOptionsFor(l, 0, lv as 1 | 2 | 3, chart).windowMs)).toEqual([8 * 2000 * 2.5, 16 * 2000 * 1.75, 32 * 2000 * 1.25]);
    expect(findKeyOptionsFor(l, 0, 1, chart)).toMatchObject({ rules: DEFAULT_CRACK_RULES });
  });

  it('takes a level\'s own cracks and the file\'s own rules over the defaults', () => {
    const rules = { crackNotes: 8, lengthStep: 0.5, repeatStep: 0, weightCap: 1 };
    const l = loadLadder(ladder({ findKey: rules, monsters: [monster('m1', [level({ cracks: 9, windowFactor: 1 }), level(), level()])] }));
    expect(findKeyOptionsFor(l, 0, 1, chart)).toMatchObject({ windowMs: 8 * 2000, cracks: 9, rules });
  });

  it('throws for a monster that is not in the ladder', () => {
    expect(() => findKeyOptionsFor(loadLadder(ladder()), 3, 1, chart)).toThrow();
  });

  it('rejects cracks below 1 and crack rules out of range', () => {
    for (const cracks of [0, 1.5]) {
      const bad = monster('m1', [level({ cracks }), level(), level()]);
      expect(() => loadLadder(ladder({ monsters: [bad] }))).toThrow();
    }
    const rules = { crackNotes: 16, lengthStep: 0.25, repeatStep: 0.25, weightCap: 2.5 };
    for (const over of [{ crackNotes: 0 }, { lengthStep: -1 }, { repeatStep: -1 }, { weightCap: 0.5 }]) {
      expect(() => loadLadder(ladder({ findKey: { ...rules, ...over } }))).toThrow();
    }
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
  it('ft_1_06.AC9 the find-the-key window follows the bars it is given, so a long own piece gets a long window', () => {
    const l = loadLadder(ladderJson);
    expect(findKeyOptionsFor(l, 0, 2, chart, levelBars(2, 32)).windowMs).toBe(32 * 2000 * 1.75);
    expect(findKeyOptionsFor(l, 0, 1, chart, levelBars(1, 32)).windowMs).toBe(16 * 2000 * 2.5);
  });
});
