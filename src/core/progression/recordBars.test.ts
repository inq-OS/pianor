// Covers core_10.AC1 and core_10.AC4: one practice-log entry per bar of each play, and the per-piece cap.
import { describe, expect, it } from 'vitest';
import { chartWith } from '../../../tests/helpers/charts';
import type { BarCompleted, CorrectNoteJudged, JudgeEvent, NoteMissed, PlayStats, WrongNoteJudged } from '../judge';
import { EMPTY_PRACTICE_LOG, MAX_BAR_PLAYS_PER_PIECE, type BarPlay, type PracticeLog } from './practiceLog';
import { appendBarPlays, barPlaysFromEvents } from './recordBars';

// Bar 0 (ticks 0 to 1919): C4 D4 E4 F4 quarter notes (note indices 0 to 3). Bar 1: G4 and A4 (indices 4 and 5).
const chart = chartWith([
  { tick: 0, dur: 480, midi: 60 },
  { tick: 480, dur: 480, midi: 62 },
  { tick: 960, dur: 480, midi: 64 },
  { tick: 1440, dur: 480, midi: 65 },
  { tick: 1920, dur: 480, midi: 67 },
  { tick: 2400, dur: 480, midi: 69 },
]);

const base = { v: 1 as const, timeMs: 0 };
const hints = { noteNames: false, fingers: false };

function correct(noteIndex: number, firstTry: boolean): CorrectNoteJudged {
  const note = chart.notes[noteIndex]!;
  return { ...base, type: 'NoteJudged', verdict: 'correct', midi: note.midi, noteIndex, stepIndex: noteIndex, bar: note.bar, firstTry, intervalErrorMs: null, hints };
}

function wrong(noteIndex: number): WrongNoteJudged {
  const note = chart.notes[noteIndex]!;
  return {
    ...base, type: 'NoteJudged', verdict: 'wrong', midi: note.midi + 1, expectedMidi: note.midi, reason: 'neighbour-key',
    direction: 'higher', stepIndex: noteIndex, bar: note.bar, hints,
  };
}

function missed(noteIndex: number): NoteMissed {
  const note = chart.notes[noteIndex]!;
  return { ...base, type: 'NoteMissed', midi: note.midi, noteIndex, stepIndex: noteIndex, bar: note.bar, hints };
}

function stats(overrides: Partial<PlayStats> & { notes: number; firstTryCorrect: number }): PlayStats {
  return { mistakes: 0, accuracy: 1, rhythmErrorMs: null, hints: { noteNames: 0, fingers: 0 }, bothHands: { notes: 0, together: 0 }, ...overrides };
}

function barDone(bar: number, result: Omit<BarCompleted['result'], 'bar'>): BarCompleted {
  return { ...base, type: 'BarCompleted', result: { bar, ...result } };
}

const waitInfo = { at: '1998-10-30T10:00:00Z', pieceId: 'test-piece', mode: 'wait' as const, tempoPercent: 100, section: null };

describe('barPlaysFromEvents, Wait play', () => {
  it('records bar 0 with one wrong key and the note that was not right first time', () => {
    const events: JudgeEvent[] = [
      correct(0, true),
      correct(1, true),
      wrong(2),
      correct(2, false),
      correct(3, true),
      barDone(0, stats({ notes: 4, firstTryCorrect: 3, mistakes: 1, accuracy: 0.75 })),
    ];
    expect(barPlaysFromEvents(events, chart, waitInfo)).toEqual([
      {
        at: '1998-10-30T10:00:00Z', pieceId: 'test-piece', bar: 0, notes: 4, firstTry: 3, timing: null, mode: 'wait', tempoPercent: 100,
        section: null, misses: [{ tick: 960, track: 'rh', midi: 64 }], hands: { RH: { notes: 4, firstTry: 3 } },
      },
    ]);
  });

  it('records a bar with no miss as an empty misses list', () => {
    const events: JudgeEvent[] = [correct(4, true), correct(5, true), barDone(1, stats({ notes: 2, firstTryCorrect: 2 }))];
    const [play] = barPlaysFromEvents(events, chart, waitInfo);
    expect(play).toMatchObject({ bar: 1, notes: 2, firstTry: 2, misses: [] });
  });

  it('makes one entry per BarCompleted, in order', () => {
    const events: JudgeEvent[] = [
      correct(0, true), correct(1, true), correct(2, true), correct(3, true), barDone(0, stats({ notes: 4, firstTryCorrect: 4 })),
      correct(4, true), correct(5, true), barDone(1, stats({ notes: 2, firstTryCorrect: 2 })),
    ];
    expect(barPlaysFromEvents(events, chart, waitInfo).map((p) => p.bar)).toEqual([0, 1]);
  });
});

describe('barPlaysFromEvents, Tempo play', () => {
  it('records a missed note with its tick in the bar, and the rounded timing score', () => {
    const events: JudgeEvent[] = [
      correct(0, true),
      correct(1, true),
      missed(2),
      correct(3, true),
      barDone(0, stats({
        notes: 4, firstTryCorrect: 3,
        timing: { played: 3, onTime: 3, early: 0, late: 0, missed: 1, meanAbsErrorMs: 4, score: 74.6 },
      })),
    ];
    const info = { ...waitInfo, mode: 'tempo' as const, tempoPercent: 80 };
    expect(barPlaysFromEvents(events, chart, info)).toEqual([
      {
        at: waitInfo.at, pieceId: 'test-piece', bar: 0, notes: 4, firstTry: 3, timing: 75, mode: 'tempo', tempoPercent: 80,
        section: null, misses: [{ tick: 960, track: 'rh', midi: 64 }],
        hands: { RH: { notes: 4, firstTry: 3, onTime: 0, onsets: { n: 0, sum: 0, sumSq: 0 } } },
      },
    ]);
  });

  it('records timing null in Tempo mode when the bar carries no timing', () => {
    const events: JudgeEvent[] = [correct(4, true), correct(5, true), barDone(1, stats({ notes: 2, firstTryCorrect: 2 }))];
    const info = { ...waitInfo, mode: 'tempo' as const };
    expect(barPlaysFromEvents(events, chart, info)[0]!.timing).toBeNull();
  });
});

describe('barPlaysFromEvents, per hand (core_12.AC2)', () => {
  // Bar 0: RH C4 E4 on beats 1 and 3 (indices 0, 1); LH C3 on beats 1 and 3 (indices 2, 3). 120 bpm: 480 ticks = 500 ms.
  const two = chartWith([
    { tick: 0, dur: 960, midi: 60 }, { tick: 960, dur: 960, midi: 64 },
    { tick: 0, dur: 960, midi: 48, track: 'lh' }, { tick: 960, dur: 960, midi: 48, track: 'lh' },
  ]);
  const timed = (noteIndex: number, firstTry: boolean, errorMs: number, verdict: 'on-time' | 'early' | 'late'): CorrectNoteJudged => {
    const note = two.notes[noteIndex]!;
    return {
      ...base, type: 'NoteJudged', verdict: 'correct', midi: note.midi, noteIndex, stepIndex: noteIndex, bar: 0, firstTry, intervalErrorMs: errorMs,
      timing: { errorMs, verdict, score: 100 }, hints,
    };
  };
  const timingStats = { played: 3, onTime: 2, early: 0, late: 1, missed: 1, meanAbsErrorMs: 20, score: 60 };

  it('core_12.AC2 splits the notes, first tries, on-time notes and onset deviations by the hand of the note\'s track', () => {
    const lhMiss: NoteMissed = { ...base, type: 'NoteMissed', midi: 48, noteIndex: 3, stepIndex: 3, bar: 0, hints };
    const events: JudgeEvent[] = [
      timed(0, true, 0, 'on-time'), timed(2, true, 26, 'on-time'),
      timed(1, false, 104, 'late'), lhMiss,
      barDone(0, stats({ notes: 4, firstTryCorrect: 2, timing: timingStats })),
    ];
    // At 80 % the clock runs slower: 104 ms late is 83.2 ms of written time, 80 ticks; 26 ms is 20 ticks.
    const [play] = barPlaysFromEvents(events, two, { ...waitInfo, mode: 'tempo', tempoPercent: 80 });
    expect(play!.hands).toEqual({
      RH: { notes: 2, firstTry: 1, onTime: 1, onsets: { n: 2, sum: 80, sumSq: 6400 } },
      LH: { notes: 2, firstTry: 1, onTime: 1, onsets: { n: 1, sum: 20, sumSq: 400 } },
    });
    expect(play!.hands!.RH!.notes + play!.hands!.LH!.notes).toBe(play!.notes);
  });

  it('core_12.AC2 in Wait mode keeps notes and first tries per hand, no timing', () => {
    const plain = (i: number, firstTry: boolean): CorrectNoteJudged => ({ ...timed(i, firstTry, 0, 'on-time'), intervalErrorMs: null, timing: undefined } as unknown as CorrectNoteJudged);
    const events: JudgeEvent[] = [plain(0, true), plain(2, false), plain(1, true), plain(3, true), barDone(0, stats({ notes: 4, firstTryCorrect: 3 }))];
    expect(barPlaysFromEvents(events, two, waitInfo)[0]!.hands).toEqual({ RH: { notes: 2, firstTry: 2 }, LH: { notes: 2, firstTry: 1 } });
  });

  it('a bar played with one hand has only that hand', () => {
    const events: JudgeEvent[] = [correct(4, true), correct(5, true), barDone(1, stats({ notes: 2, firstTryCorrect: 2 }))];
    expect(barPlaysFromEvents(events, chart, waitInfo)[0]!.hands).toEqual({ RH: { notes: 2, firstTry: 2 } });
  });
});

describe('barPlaysFromEvents, sections and chunks', () => {
  it('offsets the bar number by the section start, and reads misses from the section chart', () => {
    // The section is bars 1 and 2 of a three-bar piece; the section chart numbers them 0 and 1, so its bar 0 is the piece's bar 1.
    const sectionChart = chartWith([
      { tick: 0, dur: 480, midi: 67 },
      { tick: 480, dur: 480, midi: 69 },
    ]);
    const events: JudgeEvent[] = [
      { ...correct(0, false), midi: 67 }, // the section's own note 0 (G4 at its bar 0)
      { ...correct(1, true), midi: 69 },
      barDone(0, stats({ notes: 2, firstTryCorrect: 1 })),
    ];
    const plays = barPlaysFromEvents(events, sectionChart, { ...waitInfo, section: { first: 1, last: 2 } });
    expect(plays).toHaveLength(1);
    expect(plays[0]).toMatchObject({ bar: 1, section: { first: 1, last: 2 }, misses: [{ tick: 0, track: 'rh', midi: 67 }] });
  });

  it('works for a chunk that starts after the previous bar was completed', () => {
    const chunk: JudgeEvent[] = [correct(4, true), wrong(5), correct(5, false), barDone(1, stats({ notes: 2, firstTryCorrect: 1 }))];
    expect(barPlaysFromEvents(chunk, chart, waitInfo)).toEqual([
      expect.objectContaining({ bar: 1, misses: [{ tick: 480, track: 'rh', midi: 69 }] }),
    ]);
  });

  it('keeps a miss out of the next bar when the chunk ends with its bar', () => {
    const events: JudgeEvent[] = [correct(0, true), correct(1, true), correct(2, true), correct(3, true), barDone(0, stats({ notes: 4, firstTryCorrect: 4 })), correct(4, false)];
    expect(barPlaysFromEvents(events, chart, waitInfo)).toEqual([expect.objectContaining({ bar: 0, misses: [] })]);
  });
});

describe('barPlaysFromEvents, misses', () => {
  it('lists a note once when it is both a late correct press and a missed note', () => {
    const events: JudgeEvent[] = [
      missed(2),
      correct(2, false),
      correct(3, true),
      barDone(0, stats({ notes: 4, firstTryCorrect: 3 })),
    ];
    const [play] = barPlaysFromEvents(events, chart, { ...waitInfo, mode: 'tempo' as const });
    expect(play!.misses).toEqual([{ tick: 960, track: 'rh', midi: 64 }]);
  });

  it('keeps two notes at the same tick and pitch on different tracks as two misses', () => {
    const twoTracks = chartWith([
      { tick: 0, dur: 480, midi: 60, track: 'rh' },
      { tick: 0, dur: 480, midi: 60, track: 'lh' },
    ]);
    const events: JudgeEvent[] = [
      { ...missed(0), noteIndex: 0 },
      { ...missed(1), noteIndex: 1 },
      barDone(0, stats({ notes: 2, firstTryCorrect: 0 })),
    ];
    expect(barPlaysFromEvents(events, twoTracks, waitInfo)[0]!.misses).toEqual([
      { tick: 0, track: 'rh', midi: 60 },
      { tick: 0, track: 'lh', midi: 60 },
    ]);
  });
});

describe('appendBarPlays', () => {
  const play = (pieceId: string, bar: number): BarPlay => ({
    at: '1998-10-30T10:00:00Z', pieceId, bar, notes: 1, firstTry: 1, timing: null, mode: 'wait', tempoPercent: 100, section: null, misses: [],
  });

  it('returns a new log and never mutates the old one', () => {
    const log: PracticeLog = { bars: [play('a', 0)] };
    const snapshot = JSON.parse(JSON.stringify(log)) as PracticeLog;
    const next = appendBarPlays(log, [play('a', 1), play('b', 0)]);
    expect(next).not.toBe(log);
    expect(log).toEqual(snapshot);
    expect(next.bars.map((p) => `${p.pieceId}:${p.bar}`)).toEqual(['a:0', 'a:1', 'b:0']);
  });

  it('appends to the empty log', () => {
    expect(appendBarPlays(EMPTY_PRACTICE_LOG, []).bars).toEqual([]);
    expect(appendBarPlays(EMPTY_PRACTICE_LOG, [play('a', 0)]).bars).toHaveLength(1);
  });

  it('keeps the newest plays per piece, drops the oldest, and leaves other pieces alone', () => {
    const many = Array.from({ length: MAX_BAR_PLAYS_PER_PIECE + 1 }, (_, i) => play('a', i));
    const log: PracticeLog = { bars: [play('b', 0), play('b', 1), ...many.slice(0, 5)] };
    const next = appendBarPlays(log, many.slice(5));
    const aBars = next.bars.filter((p) => p.pieceId === 'a').map((p) => p.bar);
    expect(aBars).toHaveLength(MAX_BAR_PLAYS_PER_PIECE);
    expect(aBars[0]).toBe(1);
    expect(aBars.at(-1)).toBe(MAX_BAR_PLAYS_PER_PIECE);
    expect(aBars).toEqual([...aBars].sort((x, y) => x - y));
    expect(next.bars.filter((p) => p.pieceId === 'b')).toEqual([play('b', 0), play('b', 1)]);
  });
});

describe('barPlaysFromEvents, hold grading (core_01 slice f, d093)', () => {
  const timingWith = (holds?: { full: number; short: number }) => ({
    played: 4, onTime: 4, early: 0, late: 0, missed: 0, meanAbsErrorMs: 3, score: 90, ...(holds ? { holds } : {}),
  });
  const tempoInfo = { ...waitInfo, mode: 'tempo' as const, tempoPercent: 100 };
  const events = (timing: ReturnType<typeof timingWith>): JudgeEvent[] => [
    correct(0, true), correct(1, true), correct(2, true), correct(3, true),
    barDone(0, stats({ notes: 4, firstTryCorrect: 4, timing })),
  ];

  it('records short from the holds of a Tempo-mode bar', () => {
    const [play] = barPlaysFromEvents(events(timingWith({ full: 3, short: 1 })), chart, tempoInfo);
    expect(play).toHaveProperty('short', 1);
  });

  it('records no short key for a Tempo-mode bar without holds', () => {
    const [play] = barPlaysFromEvents(events(timingWith()), chart, tempoInfo);
    expect(play).not.toHaveProperty('short');
  });

  it('records no short key for a Wait-mode bar', () => {
    const [play] = barPlaysFromEvents(events(timingWith({ full: 3, short: 1 })), chart, waitInfo);
    expect(play).not.toHaveProperty('short');
  });
});
