// Covers core_10.AC1: each finished bar of a play becomes one bar play, with the notes that were not right first time.
import { describe, expect, it } from 'vitest';
import { chartWith } from '../../../tests/helpers/charts';
import type { BarCompleted, CorrectNoteJudged, JudgeEvent, NoteMissed, PlayStats, WrongNoteJudged } from '../../core/judge';
import { BarRecorder } from './BarRecorder';

// Bar 0 (ticks 0 to 1919): C4 D4 E4 F4 (note indices 0 to 3). Bar 1: G4 and A4 (indices 4 and 5).
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

function barDone(bar: number, notes: number, firstTryCorrect: number): BarCompleted {
  const stats: PlayStats = { notes, firstTryCorrect, mistakes: 0, accuracy: firstTryCorrect / notes, rhythmErrorMs: null, hints: { noteNames: 0, fingers: 0 }, bothHands: { notes: 0, together: 0 } };
  return { ...base, type: 'BarCompleted', result: { bar, ...stats } };
}

const info = { pieceId: 'little-steps', mode: 'wait' as const, tempoPercent: 100, section: null };
const at = new Date('1998-10-30T10:00:00.000Z');

describe('BarRecorder (core_10.AC1)', () => {
  it('a miss in one push and the bar finished in a later push make one bar play with that miss', () => {
    const recorder = new BarRecorder(chart, info, () => at);
    const first: JudgeEvent[] = [correct(0, true), correct(1, true), wrong(2), correct(2, false)];
    expect(recorder.push(first)).toEqual([]);
    const second: JudgeEvent[] = [correct(3, true), barDone(0, 4, 3)];
    expect(recorder.push(second)).toEqual([
      {
        at: at.toISOString(), pieceId: 'little-steps', bar: 0, notes: 4, firstTry: 3, timing: null, mode: 'wait', tempoPercent: 100,
        section: null, misses: [{ tick: 960, track: 'rh', midi: 64 }], hands: { RH: { notes: 4, firstTry: 3 } },
      },
    ]);
  });

  it('core_12.AC2 a next-bar note judged before the bar before it completes (an early legato start) stays with its bar', () => {
    const recorder = new BarRecorder(chart, info, () => at);
    expect(recorder.push([correct(0, true), correct(1, true), correct(2, true), correct(3, true)])).toEqual([]);
    expect(recorder.push([correct(4, true)])).toEqual([]);
    const first = recorder.push([barDone(0, 4, 4)]);
    expect(first.map((p) => p.hands)).toEqual([{ RH: { notes: 4, firstTry: 4 } }]);
    const second = recorder.push([correct(5, true), barDone(1, 2, 2)]);
    expect(second[0]).toMatchObject({ bar: 1, notes: 2, hands: { RH: { notes: 2, firstTry: 2 } } });
  });

  it('the next bar does not inherit a miss of the bar before it', () => {
    const recorder = new BarRecorder(chart, info, () => at);
    recorder.push([correct(0, true), wrong(1), correct(1, false), correct(2, true), correct(3, true), barDone(0, 4, 3)]);
    const plays = recorder.push([correct(4, true), correct(5, true), barDone(1, 2, 2)]);
    expect(plays).toHaveLength(1);
    expect(plays[0]).toMatchObject({ bar: 1, notes: 2, firstTry: 2, misses: [] });
  });

  it('two bars finished in one push give two bar plays, each with its own misses', () => {
    const recorder = new BarRecorder(chart, info, () => at);
    const plays = recorder.push([
      correct(0, true), missed(1), correct(2, true), correct(3, true), barDone(0, 4, 3),
      correct(4, false), correct(5, true), barDone(1, 2, 1),
    ]);
    expect(plays.map((p) => [p.bar, p.misses.length])).toEqual([[0, 1], [1, 1]]);
    expect(plays[0]!.misses).toEqual([{ tick: 480, track: 'rh', midi: 62 }]);
    expect(plays[1]!.misses).toEqual([{ tick: 0, track: 'rh', midi: 67 }]);
  });

  it('a play with no finished bar returns nothing, and events after the last bar carry over to the next bar', () => {
    const recorder = new BarRecorder(chart, info, () => at);
    expect(recorder.push([correct(0, true)])).toEqual([]);
    expect(recorder.push([correct(1, false)])).toEqual([]);
    const plays = recorder.push([correct(2, true), correct(3, true), barDone(0, 4, 3)]);
    expect(plays[0]).toMatchObject({ bar: 0, misses: [{ tick: 480, track: 'rh', midi: 62 }] });
  });

  it('the time of a bar play is the time the bar was finished', () => {
    const later = new Date('1998-10-30T10:05:00.000Z');
    const recorder = new BarRecorder(chart, info, () => later);
    expect(recorder.push([correct(0, true), correct(1, true), correct(2, true), correct(3, true), barDone(0, 4, 4)])[0]!.at).toBe(later.toISOString());
  });

  it('logs the bar a learning run stopped in, and keeps nothing of it for the next push (ft_1_32.AC5)', () => {
    const recorder = new BarRecorder(chart, info, () => new Date('1998-11-22T10:00:00.000Z'));
    expect(recorder.push([correct(0, true), correct(1, true), correct(2, true), correct(3, true), barDone(0, 4, 4), correct(4, true)])).toHaveLength(1);
    expect(recorder.stop(wrong(5))).toMatchObject({ bar: 1, notes: 2, firstTry: 1, misses: [{ tick: 480, track: 'rh', midi: 69 }] });
    expect(recorder.push([barDone(1, 2, 2)])[0]!.misses).toEqual([]);
  });
});
