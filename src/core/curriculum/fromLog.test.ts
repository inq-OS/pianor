import { describe, expect, it } from 'vitest';
import type { BarPlay, PracticeLog } from '../progression/practiceLog';
import { DEFAULT_EVALUATION_RULES } from './evaluate';
import { cleanPlayDays, cleanPlaysSince, playResultsFromLog } from './fromLog';

function bar(b: number, extra: Partial<BarPlay> = {}): BarPlay {
  return {
    at: `1998-11-10T10:00:0${b}.000Z`,
    pieceId: 'p',
    bar: b,
    notes: 4,
    firstTry: 4,
    timing: null,
    mode: 'wait',
    tempoPercent: 100,
    section: null,
    misses: [],
    ...extra,
  };
}

const dayOf = (iso: string) => iso.slice(0, 10);

describe('playResultsFromLog (core_12.AC1)', () => {
  it('turns each run from the first bar to the last into one whole-piece play, scored from its bars', () => {
    const log: PracticeLog = { bars: [bar(0), bar(1, { firstTry: 2 }), bar(2), bar(0, { firstTry: 0, at: '1998-11-11T09:00:00.000Z' }), bar(1, { at: '1998-11-11T09:00:01.000Z' }), bar(2, { at: '1998-11-11T09:00:02.000Z' })] };
    const plays = playResultsFromLog(log, 'p', 3, dayOf, DEFAULT_EVALUATION_RULES);
    expect(plays.map((p) => [p.day, p.score])).toEqual([
      ['1998-11-10', 83],
      ['1998-11-11', 67],
    ]);
    expect(plays[0]).toMatchObject({ piece: 'p', mode: 'wait', tempoPercent: 100, hands: {} });
    expect(plays[0]!.at).toBe(Date.parse('1998-11-10T10:00:02.000Z'));
  });

  it('skips a play stopped early, section plays, other pieces, and splits on a change of mode or tempo', () => {
    const log: PracticeLog = {
      bars: [
        bar(0),
        bar(1),
        bar(0, { section: { first: 0, last: 2 } }),
        bar(1, { section: { first: 0, last: 2 } }),
        bar(2, { section: { first: 0, last: 2 } }),
        bar(0, { pieceId: 'other' }),
        bar(0),
        bar(1, { tempoPercent: 80 }),
        bar(2, { tempoPercent: 80 }),
      ],
    };
    expect(playResultsFromLog(log, 'p', 3, dayOf, DEFAULT_EVALUATION_RULES)).toEqual([]);
  });

  it('weights each Tempo-mode bar timing by its notes', () => {
    const log: PracticeLog = {
      bars: [bar(0, { mode: 'tempo', timing: 100, tempoPercent: 50 }), bar(1, { mode: 'tempo', timing: 0, tempoPercent: 50, notes: 12, firstTry: 12 })],
    };
    // pitch 1, timing 4 of 16 on time, tempo 0.5: 60 + 7.5 + 5
    expect(playResultsFromLog(log, 'p', 2, dayOf, DEFAULT_EVALUATION_RULES)[0]!.score).toBe(73);
  });
});

describe('playResultsFromLog per hand (core_12.AC2)', () => {
  const tempo = { mode: 'tempo' as const, timing: 80 };

  it('core_12.AC2 sums each hand over the run: notes, first tries, on time, and the mean and spread of the onsets in ticks', () => {
    const log: PracticeLog = { bars: [
      bar(0, { ...tempo, hands: { RH: { notes: 2, firstTry: 2, onTime: 2, onsets: { n: 2, sum: 20, sumSq: 200 } }, LH: { notes: 2, firstTry: 1, onTime: 1, onsets: { n: 2, sum: -40, sumSq: 1000 } } } }),
      bar(1, { ...tempo, hands: { RH: { notes: 2, firstTry: 1, onTime: 1, onsets: { n: 2, sum: 0, sumSq: 0 } } } }),
    ] };
    const [play] = playResultsFromLog(log, 'p', 2, dayOf, DEFAULT_EVALUATION_RULES);
    // RH onsets 10, 10, 0, 0 (one set of values with these sums): mean 5, spread 5. LH: mean -20, spread √(500 − 400) = 10.
    expect(play!.hands).toEqual({
      right: { notes: 4, firstTry: 3, onTime: 3, onsetMeanTicks: 5, onsetSpreadTicks: 5 },
      left: { notes: 2, firstTry: 1, onTime: 1, onsetMeanTicks: -20, onsetSpreadTicks: 10 },
    });
  });

  it('core_12.AC2 Wait mode gives notes and first tries per hand only; a run with a bar from before AC2 gives no hands', () => {
    const wait = (b: number) => bar(b, { hands: { RH: { notes: 3, firstTry: 2 }, LH: { notes: 1, firstTry: 1 } } });
    expect(playResultsFromLog({ bars: [wait(0), wait(1)] }, 'p', 2, dayOf, DEFAULT_EVALUATION_RULES)[0]!.hands).toEqual({
      right: { notes: 6, firstTry: 4 }, left: { notes: 2, firstTry: 2 },
    });
    expect(playResultsFromLog({ bars: [wait(0), bar(1)] }, 'p', 2, dayOf, DEFAULT_EVALUATION_RULES)[0]!.hands).toEqual({});
  });

  it('a hand with no onset in time has no onset mean or spread', () => {
    const log: PracticeLog = { bars: [bar(0, { ...tempo, hands: { RH: { notes: 1, firstTry: 0, onTime: 0, onsets: { n: 0, sum: 0, sumSq: 0 } } } })] };
    expect(playResultsFromLog(log, 'p', 1, dayOf, DEFAULT_EVALUATION_RULES)[0]!.hands).toEqual({ right: { notes: 1, firstTry: 0, onTime: 0 } });
  });
});

describe('cleanPlaysSince: the cool-down after a lost tug (ft_1_25.AC3)', () => {
  const at = (minute: number, b: number) => `1998-11-18T10:${String(minute).padStart(2, '0')}:0${b}.000Z`;
  const play = (minute: number, extra: Partial<BarPlay> = {}, bars = 3) =>
    Array.from({ length: bars }, (_, b) => bar(b, { at: at(minute, b), ...extra }));

  it('counts whole clean plays of the piece after the tug, never an unclean, partial, section or older one', () => {
    const log: PracticeLog = { bars: [
      ...play(0), // before the tug
      ...play(10), ...play(11, { firstTry: 3 }), ...play(12, {}, 2), ...play(13, { section: { first: 0, last: 2 } }),
      ...play(14, { misses: [{ tick: 0, track: 'rh', midi: 61 }] }), ...play(15), ...play(16, { pieceId: 'other' }), ...play(17, { mode: 'tempo', timing: 70 }),
    ] };
    expect(cleanPlaysSince(log, 'p', 3, '1998-11-18T10:05:00.000Z')).toBe(3);
    expect(cleanPlaysSince(log, 'p', 3, '1998-11-18T10:20:00.000Z')).toBe(0);
    expect(cleanPlaysSince({ bars: [] }, 'p', 3, '1998-11-18T10:05:00.000Z')).toBe(0);
  });
});

describe('cleanPlayDays: the days a piece was played clean (ft_1_22.AC5)', () => {
  const play = (day: string, extra: Partial<BarPlay> = {}, bars = 3) =>
    Array.from({ length: bars }, (_, b) => bar(b, { at: `${day}T10:00:0${b}.000Z`, ...extra }));

  it('ft_1_22.AC5 gives the day of every whole clean play, oldest first, never an unclean, partial or section play', () => {
    const log: PracticeLog = { bars: [
      ...play('1998-11-18'), ...play('1998-11-19', { firstTry: 3 }), ...play('1998-11-20', {}, 2),
      ...play('1998-11-21', { section: { first: 0, last: 2 } }), ...play('1998-11-22', { pieceId: 'other' }), ...play('1998-11-23'),
    ] };
    expect(cleanPlayDays(log, 'p', 3, dayOf)).toEqual(['1998-11-18', '1998-11-23']);
    expect(cleanPlayDays({ bars: [] }, 'p', 3, dayOf)).toEqual([]);
  });
});
