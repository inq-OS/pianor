// Covers core_04.AC4.
import { describe, expect, it } from 'vitest';
import { pieceHistory } from './pieceHistory';
import type { Attempt } from './profile';

let n = 0;
function attempt(over: { piece?: string; at?: string; accuracy?: number; mistakes?: number; mode?: 'wait' | 'tempo' } = {}): Attempt {
  const mode = over.mode ?? 'wait';
  const accuracy = over.accuracy ?? 1;
  return {
    n: ++n, at: over.at ?? '1998-10-09T10:00:00.000Z', pieceId: over.piece ?? 'p', contentVersion: 1, stars: 3,
    result: {
      chartId: over.piece ?? 'p', contentVersion: 1, notes: 10, firstTryCorrect: Math.round(accuracy * 10), mistakes: over.mistakes ?? 0, accuracy, rhythmErrorMs: null,
      hints: { noteNames: 0, fingers: 0 }, bothHands: { notes: 0, together: 0 },
    },
    play: { mode, tempoPercent: 100 },
    noteTimings: [],
    helps: [],
    xp: { kind: 'first', completion: 0, accuracy: 0, bonus: 0, replayFactor: 1, hintFactor: 1, bothHandsMultiplier: 1, total: 0 },
  };
}

describe('pieceHistory', () => {
  it('gives one point per full play of the piece, with its date, accuracy and mode', () => {
    const attempts = [
      attempt({ at: '1998-10-09T10:00:00.000Z', accuracy: 0.5 }),
      attempt({ at: '1998-10-10T10:00:00.000Z', accuracy: 0.75, mistakes: 0, mode: 'tempo' }),
    ];
    expect(pieceHistory(attempts, 'p')).toEqual([
      { at: '1998-10-09T10:00:00.000Z', accuracy: 0.5, mistakes: 0, mode: 'wait' },
      { at: '1998-10-10T10:00:00.000Z', accuracy: 0.75, mistakes: 0, mode: 'tempo' },
    ]);
  });

  it('carries the wrong key presses of each play, for the stats pane (ft_1_12.AC5)', () => {
    expect(pieceHistory([attempt({ mistakes: 4 }), attempt({ mistakes: 0 })], 'p').map((point) => point.mistakes)).toEqual([4, 0]);
  });

  it('leaves out the plays of other pieces', () => {
    const attempts = [attempt({ piece: 'p' }), attempt({ piece: 'other' }), attempt({ piece: 'p' })];
    expect(pieceHistory(attempts, 'p')).toHaveLength(2);
    expect(pieceHistory(attempts, 'missing')).toEqual([]);
  });

  it('is in date order, even when the log is not sorted by date', () => {
    const attempts = [
      attempt({ at: '1998-10-12T10:00:00.000Z' }),
      attempt({ at: '1998-10-09T10:00:00.000Z' }),
      attempt({ at: '1998-10-10T10:00:00.000Z' }),
    ];
    expect(pieceHistory(attempts, 'p').map((point) => point.at)).toEqual([
      '1998-10-09T10:00:00.000Z',
      '1998-10-10T10:00:00.000Z',
      '1998-10-12T10:00:00.000Z',
    ]);
  });

  it('keeps the order of the log for two plays on the same instant', () => {
    const same = '1998-10-09T10:00:00.000Z';
    const attempts = [attempt({ at: same, accuracy: 0.2 }), attempt({ at: same, accuracy: 0.9 })];
    expect(pieceHistory(attempts, 'p').map((point) => point.accuracy)).toEqual([0.2, 0.9]);
  });
});
