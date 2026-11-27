import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { JUDGE_EVENT_VERSION, type NoteJudged, type PieceResult, type WrongReason } from '../judge/types';
import { emptyFreePlay, playedToTheEnd, recordFreePlayNote, recordFreePlayRound, summarizeFreePlay } from './freePlay';

const hints = { noteNames: false, fingers: false };

const correct = (timeMs = 0): NoteJudged => ({
  v: JUDGE_EVENT_VERSION, type: 'NoteJudged', verdict: 'correct', timeMs, midi: 60, noteIndex: 0, stepIndex: 0, bar: 0,
  firstTry: true, intervalErrorMs: null, hints,
});

const wrong = (reason: WrongReason, timeMs = 0): NoteJudged => ({
  v: JUDGE_EVENT_VERSION, type: 'NoteJudged', verdict: 'wrong', timeMs, midi: 61, expectedMidi: 60, reason, direction: 'higher',
  stepIndex: 0, bar: 0, hints,
});

const round = (firstTryCorrect: number, notes: number, mistakes = 0): PieceResult => ({
  chartId: 'little-steps', contentVersion: 1, notes, firstTryCorrect, mistakes, accuracy: notes === 0 ? 1 : firstTryCorrect / notes,
  rhythmErrorMs: null, hints: { noteNames: 0, fingers: 0 }, bothHands: { notes: 0, together: 0 },
});

describe('free play session', () => {
  it('starts empty: nothing played, no rounds, no time', () => {
    const summary = summarizeFreePlay(emptyFreePlay(), 5000);
    expect(summary).toEqual({
      played: false, rounds: 0, roundAccuracy: [], bestAccuracy: null, lastAccuracy: null, notesRight: 0,
      wrong: { total: 0, 'wrong-octave': 0, 'neighbour-key': 0, 'wrong-letter': 0 }, playedMs: 0,
    });
  });

  it('counts notes right and wrong keys by reason, also in a round that was not finished', () => {
    let s = emptyFreePlay();
    s = recordFreePlayNote(s, correct(1000), 1000);
    s = recordFreePlayNote(s, wrong('wrong-octave'), 1200);
    s = recordFreePlayNote(s, wrong('neighbour-key'), 1300);
    s = recordFreePlayNote(s, wrong('neighbour-key'), 1400);
    s = recordFreePlayNote(s, wrong('wrong-letter'), 1500);
    s = recordFreePlayNote(s, correct(), 1600);
    const summary = summarizeFreePlay(s, 4000);
    expect(summary.played).toBe(true);
    expect(summary.rounds).toBe(0);
    expect(summary.notesRight).toBe(2);
    expect(summary.wrong).toEqual({ total: 4, 'wrong-octave': 1, 'neighbour-key': 2, 'wrong-letter': 1 });
  });

  it('times the session from its first key to when the player leaves', () => {
    let s = recordFreePlayNote(emptyFreePlay(), correct(), 2000);
    s = recordFreePlayNote(s, correct(), 9000);
    expect(summarizeFreePlay(s, 62_000).playedMs).toBe(60_000);
    // a clock that went backwards never gives a negative time
    expect(summarizeFreePlay(s, 1000).playedMs).toBe(0);
  });

  it('keeps every finished round: its accuracy, the best and the last', () => {
    let s = emptyFreePlay();
    s = recordFreePlayRound(s, round(8, 10));
    s = recordFreePlayRound(s, round(10, 10));
    s = recordFreePlayRound(s, round(9, 10, 1));
    const summary = summarizeFreePlay(s, 0);
    expect(summary.rounds).toBe(3);
    expect(summary.roundAccuracy).toEqual([0.8, 1, 0.9]);
    expect(summary.bestAccuracy).toBe(1);
    expect(summary.lastAccuracy).toBe(0.9);
    expect(summary.played).toBe(true);
  });

  it('never changes the session it is given (it survives a scene restart as plain data)', () => {
    const s = emptyFreePlay();
    const frozen = JSON.stringify(s);
    recordFreePlayNote(s, wrong('wrong-letter'), 10);
    recordFreePlayRound(s, round(1, 1));
    expect(JSON.stringify(s)).toBe(frozen);
    const after = recordFreePlayRound(recordFreePlayNote(s, correct(), 10), round(1, 1));
    expect(JSON.parse(JSON.stringify(after))).toEqual(after);
  });

  it('property: counts are never negative, best is at least last, and every note is counted once', () => {
    const note = fc.oneof(fc.constant<'right'>('right'), fc.constantFrom<WrongReason>('wrong-octave', 'neighbour-key', 'wrong-letter'));
    const step = fc.oneof(
      fc.record({ kind: fc.constant<'note'>('note'), note, at: fc.nat(100_000) }),
      fc.record({ kind: fc.constant<'round'>('round'), notes: fc.integer({ min: 1, max: 40 }), right: fc.nat(40) }),
    );
    fc.assert(fc.property(fc.array(step, { maxLength: 60 }), fc.nat(200_000), (steps, now) => {
      let s = emptyFreePlay();
      let notes = 0;
      let rounds = 0;
      for (const item of steps) {
        if (item.kind === 'note') {
          s = recordFreePlayNote(s, item.note === 'right' ? correct() : wrong(item.note), item.at);
          notes++;
        } else {
          s = recordFreePlayRound(s, round(Math.min(item.right, item.notes), item.notes));
          rounds++;
        }
      }
      const summary = summarizeFreePlay(s, now);
      expect(summary.notesRight + summary.wrong.total).toBe(notes);
      expect(summary.wrong.total).toBe(summary.wrong['wrong-octave'] + summary.wrong['neighbour-key'] + summary.wrong['wrong-letter']);
      expect(summary.rounds).toBe(rounds);
      expect(summary.playedMs).toBeGreaterThanOrEqual(0);
      expect(summary.played).toBe(notes + rounds > 0);
      if (rounds > 0) expect(summary.bestAccuracy!).toBeGreaterThanOrEqual(summary.lastAccuracy!);
      for (const a of summary.roundAccuracy) expect(a >= 0 && a <= 1).toBe(true);
    }));
  });
});

describe('playedToTheEnd', () => {
  const timing = (played: number, missed: number) => ({ played, onTime: played, early: 0, late: 0, missed, meanAbsErrorMs: played === 0 ? null : 10, score: played === 0 ? 0 : 80 });

  it('a Tempo pass where the clock ran to the end with no note played right is not played to the end', () => {
    expect(playedToTheEnd({ ...round(0, 8), timing: timing(0, 8) })).toBe(false);
    expect(playedToTheEnd({ ...round(0, 8, 3), timing: timing(0, 8) })).toBe(false);
  });

  it('a Tempo pass with one note played right is played to the end', () => {
    expect(playedToTheEnd({ ...round(1, 8), timing: timing(1, 7) })).toBe(true);
  });

  it('a Wait pass that reached its end is played to the end, also when every note came after a wrong key', () => {
    expect(playedToTheEnd(round(0, 8, 8))).toBe(true);
    expect(playedToTheEnd(round(8, 8))).toBe(true);
  });
});
