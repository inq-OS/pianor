// Covers core_04.AC2.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import progressionJson from '../../../content/curriculum/progression.json';
import { parseProgressionConfig } from './config';
import type { Attempt } from './profile';
import { pieceStats, playedWell, startPercent } from './stats';

const config = parseProgressionConfig(progressionJson).stats; // window 60, 90 percent, timing 70, no hints

let n = 0;
function attempt(over: { piece?: string; accuracy?: number; hints?: number; mode?: 'wait' | 'tempo'; percent?: number; timing?: number | null } = {}): Attempt {
  const mode = over.mode ?? 'wait';
  const accuracy = over.accuracy ?? 1;
  return {
    n: ++n, at: '1998-10-09T10:00:00.000Z', pieceId: over.piece ?? 'p', contentVersion: 1, stars: 3,
    result: {
      chartId: over.piece ?? 'p', contentVersion: 1, notes: 10, firstTryCorrect: Math.round(accuracy * 10), mistakes: 0, accuracy, rhythmErrorMs: null,
      hints: { noteNames: over.hints ?? 0, fingers: 0 }, bothHands: { notes: 0, together: 0 },
      ...(mode === 'tempo' && over.timing !== null ? { timing: { played: 10, onTime: 10, early: 0, late: 0, missed: 0, meanAbsErrorMs: 20, score: over.timing ?? 90 } } : {}),
    },
    play: { mode, tempoPercent: over.percent ?? 100 },
    noteTimings: [],
    helps: [],
    xp: { kind: 'first', completion: 0, accuracy: 0, bonus: 0, replayFactor: 1, hintFactor: 1, bothHandsMultiplier: 1, total: 0 },
  };
}

describe('the config of the stats', () => {
  it('has the provisional numbers: the last 60 plays, 90 percent right, a timing score of 70, no hints', () => {
    expect(config).toEqual({ window: 60, goodAccuracy: 0.9, goodTimingScore: 70, allowHints: false });
  });
});

describe('playedWell', () => {
  it('needs enough notes right the first time', () => {
    expect(playedWell(attempt({ accuracy: 0.9 }), config)).toBe(true);
    expect(playedWell(attempt({ accuracy: 0.8 }), config)).toBe(false);
  });

  it('is spoiled by a hint, unless hints are allowed', () => {
    expect(playedWell(attempt({ hints: 3 }), config)).toBe(false);
    expect(playedWell(attempt({ hints: 3 }), { ...config, allowHints: true })).toBe(true);
  });

  it('in Tempo mode also needs a good enough timing score, and a missing timing is not good', () => {
    expect(playedWell(attempt({ mode: 'tempo', timing: 70 }), config)).toBe(true);
    expect(playedWell(attempt({ mode: 'tempo', timing: 69 }), config)).toBe(false);
    expect(playedWell(attempt({ mode: 'tempo', timing: null }), config)).toBe(false);
    expect(playedWell(attempt({ mode: 'wait', timing: 10 }), config)).toBe(true); // Wait mode is not judged on timing
  });
});

describe('pieceStats', () => {
  it('is empty for a piece never played, and ignores other pieces', () => {
    expect(pieceStats([attempt({ piece: 'other' })], 'p', config)).toEqual({ plays: 0, windowPlays: 0, goodPlays: 0, accuracy: null, timing: null, speed: null, proficiency: 0 });
  });

  it('the worked example: 15 good plays of the last 60 is a proficiency of 25', () => {
    const plays = [...Array(15).fill(0).map(() => attempt()), ...Array(45).fill(0).map(() => attempt({ accuracy: 0.5 }))];
    expect(pieceStats(plays, 'p', config)).toMatchObject({ plays: 60, windowPlays: 60, goodPlays: 15, proficiency: 25 });
  });

  it('looks only at the last N plays, so proficiency can go down as well as up', () => {
    const good = Array(60).fill(0).map(() => attempt());
    expect(pieceStats(good, 'p', config).proficiency).toBe(100);
    const worse = [...good, ...Array(30).fill(0).map(() => attempt({ accuracy: 0.4 }))];
    const stats = pieceStats(worse, 'p', config);
    expect(stats).toMatchObject({ plays: 90, windowPlays: 60, goodPlays: 30, proficiency: 50 });
  });

  it('accuracy is the mean over the window, timing the mean over the Tempo plays only', () => {
    const plays = [attempt({ accuracy: 1 }), attempt({ accuracy: 0.5 }), attempt({ mode: 'tempo', timing: 80 }), attempt({ mode: 'tempo', timing: 60, accuracy: 0.9 })];
    const stats = pieceStats(plays, 'p', config);
    expect(stats.accuracy).toBeCloseTo((1 + 0.5 + 1 + 0.9) / 4, 10);
    expect(stats.timing).toBe(70);
  });

  it('speed is the highest tempo percent a Tempo play was played well at, ever, also above 100', () => {
    const plays = [
      attempt({ mode: 'tempo', percent: 60 }), attempt({ mode: 'tempo', percent: 120 }), attempt({ mode: 'tempo', percent: 150, accuracy: 0.3 }),
      attempt({ mode: 'tempo', percent: 140, timing: 20 }), attempt({ mode: 'wait', percent: 200 }),
    ];
    expect(pieceStats(plays, 'p', config).speed).toBe(120);
    expect(pieceStats([attempt()], 'p', config).speed).toBeNull();
  });

  it('speed looks at all history while proficiency only at the window', () => {
    const old = attempt({ mode: 'tempo', percent: 130 });
    const rest = Array(60).fill(0).map(() => attempt({ accuracy: 0.2 }));
    const stats = pieceStats([old, ...rest], 'p', config);
    expect(stats.speed).toBe(130);
    expect(stats.proficiency).toBe(0);
  });

  it('keeps proficiency between 0 and 100 and the good plays within the window, for any history', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ accuracy: fc.double({ min: 0, max: 1, noNaN: true }), hints: fc.integer({ min: 0, max: 2 }), tempo: fc.boolean(), timing: fc.integer({ min: 0, max: 100 }), percent: fc.integer({ min: 30, max: 150 }) }), { maxLength: 150 }),
        (rows) => {
          const attempts = rows.map((r) => attempt({ accuracy: r.accuracy, hints: r.hints, mode: r.tempo ? 'tempo' : 'wait', timing: r.timing, percent: r.percent }));
          const stats = pieceStats(attempts, 'p', config);
          expect(stats.proficiency).toBeGreaterThanOrEqual(0);
          expect(stats.proficiency).toBeLessThanOrEqual(100);
          expect(stats.windowPlays).toBe(Math.min(60, attempts.length));
          expect(stats.goodPlays).toBeLessThanOrEqual(stats.windowPlays);
          expect(stats.plays).toBe(attempts.length);
        },
      ),
    );
  });
});

describe('startPercent', () => {
  it('is where the piece was last played, 100 for a piece never played', () => {
    const plays = [attempt({ percent: 80 }), attempt({ piece: 'other', percent: 50 }), attempt({ percent: 110 })];
    expect(startPercent(plays, 'p')).toBe(110);
    expect(startPercent(plays, 'other')).toBe(50);
    expect(startPercent(plays, 'never')).toBe(100);
    expect(startPercent([], 'p')).toBe(100);
    expect(startPercent([attempt({ percent: 70 }), attempt({ piece: 'other', percent: 50 })], 'p')).toBe(70); // the very first attempt counts too
  });
});
