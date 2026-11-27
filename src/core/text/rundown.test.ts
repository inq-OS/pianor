import { describe, expect, it } from 'vitest';
import type { FreePlaySummary } from '../scoring/freePlay';
import type { PieceResult } from '../judge/types';
import { passLines, scoreLines } from './rundown';
import { t } from './strings';

const summary = (over: Partial<FreePlaySummary> = {}): FreePlaySummary => ({
  played: true, rounds: 0, roundAccuracy: [], bestAccuracy: null, lastAccuracy: null, notesRight: 0,
  wrong: { total: 0, 'wrong-octave': 0, 'neighbour-key': 0, 'wrong-letter': 0 }, playedMs: 0, ...over,
});

const texts = (s: FreePlaySummary) => scoreLines(s).map((line) => t(line.key, line.params));

describe('scoreLines (ft_1_12.AC4)', () => {
  it('a session with no pass finished still says something kind', () => {
    expect(texts(summary({ notesRight: 4, playedMs: 20_000 }))).toEqual([
      'You played some notes. The end can wait for next time!',
      'No wrong keys at all!',
    ]);
  });

  it('one pass shows its accuracy once', () => {
    expect(texts(summary({ rounds: 1, roundAccuracy: [0.9], bestAccuracy: 0.9, lastAccuracy: 0.9, notesRight: 11, playedMs: 60_000 })).slice(0, 2)).toEqual([
      'You played it to the end once!',
      'Your round: 90% right the first time',
    ]);
  });

  it('several passes show the best and the last, and the wrong keys by reason (only the ones that happened)', () => {
    const lines = texts(summary({
      rounds: 3, roundAccuracy: [0.5, 1, 0.75], bestAccuracy: 1, lastAccuracy: 0.75, notesRight: 30, playedMs: 185_000,
      wrong: { total: 4, 'wrong-octave': 1, 'neighbour-key': 2, 'wrong-letter': 1 },
    }));
    expect(lines).toEqual([
      'You played it to the end 3 times!',
      'Best round: 100% right the first time',
      'Last round: 75%',
      'Wrong keys: 4',
      'Right name, other octave: 1',
      'Just next door: 2',
      'Another note: 1',
    ]);
  });
});

const pass = (over: Partial<PieceResult> = {}): PieceResult => ({
  chartId: 'p', contentVersion: 1, notes: 11, firstTryCorrect: 10, mistakes: 2, accuracy: 10 / 11, rhythmErrorMs: null,
  hints: { noteNames: 0, fingers: 0 }, bothHands: { notes: 0, together: 0 }, ...over,
});
const passTexts = (r: PieceResult) => passLines(r).map((line) => t(line.key, line.params));

describe('passLines: what Kiur says after each pass (ft_1_12.AC3)', () => {
  it('says the pass\'s share right the first time and its wrong keys', () => {
    expect(passTexts(pass())).toEqual(['91% right', 'Wrong keys: 2']);
  });

  it('says so when there was no wrong key at all', () => {
    expect(passTexts(pass({ mistakes: 0, firstTryCorrect: 11, accuracy: 1 }))).toEqual(['100% right', 'No wrong keys!']);
  });

  it('adds the timing score in Tempo mode', () => {
    const timing = { played: 11, onTime: 9, early: 1, late: 1, missed: 0, meanAbsErrorMs: 40, score: 83.6 };
    expect(passTexts(pass({ timing }))).toEqual(['91% right', 'Wrong keys: 2', 'Timing 84']);
  });
});

