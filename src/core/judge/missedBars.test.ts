// Covers core_01.AC11: the auto reset after two bars with nothing played right.
import { describe, expect, it } from 'vitest';
import { MissedBars, AUTO_RESET_BARS } from './missedBars';
import type { BarCompleted, JudgeEvent, PlayStats } from './types';

const stats = (notes: number, played: number, wrong = 0): PlayStats => ({
  notes, firstTryCorrect: played, mistakes: wrong, accuracy: notes === 0 ? 1 : played / notes, rhythmErrorMs: null,
  hints: { noteNames: 0, fingers: 0 }, bothHands: { notes: 0, together: 0 },
  timing: { played, onTime: played, early: 0, late: 0, missed: notes - played, meanAbsErrorMs: null, score: 0 },
});
const bar = (index: number, notes: number, played: number, wrong = 0): BarCompleted => ({ v: 2, type: 'BarCompleted', timeMs: index * 2000, result: { bar: index, ...stats(notes, played, wrong) } });

function feed(events: JudgeEvent[][]): boolean[] {
  const watch = new MissedBars();
  return events.map((e) => watch.push(e));
}

describe('MissedBars (core_01.AC11)', () => {
  it('core_01.AC11 asks for a reset once two bars in a row pass with no note played right', () => {
    expect(AUTO_RESET_BARS).toBe(2);
    expect(feed([[bar(0, 4, 0)], [bar(1, 3, 0)]])).toEqual([false, true]);
  });

  it('core_01.AC11 a bar with one right note breaks the run', () => {
    expect(feed([[bar(0, 4, 0)], [bar(1, 4, 1)], [bar(2, 4, 0)], [bar(3, 4, 0)]])).toEqual([false, false, false, true]);
  });

  it('core_01.AC11 wrong keys alone do not save a bar: nothing was played right', () => {
    expect(feed([[bar(0, 4, 0, 3)], [bar(1, 4, 0, 1)]])).toEqual([false, true]);
  });

  it('core_01.AC11 a bar with no notes to play (rests only) neither counts nor breaks the run', () => {
    expect(feed([[bar(0, 4, 0)], [bar(1, 0, 0)], [bar(2, 2, 0)]])).toEqual([false, false, true]);
  });

  it('core_01.AC11 two missed bars completed by the same advance ask once', () => {
    const watch = new MissedBars();
    expect(watch.push([bar(0, 4, 0), bar(1, 4, 0), bar(2, 4, 0)])).toBe(true);
  });

  it('core_01.AC11 starts from a given run, so a looped section carries it over its wrap', () => {
    const watch = new MissedBars(1);
    expect(watch.missed).toBe(1);
    expect(watch.push([bar(0, 2, 0)])).toBe(true);
  });

  it('ignores the other judge events', () => {
    const watch = new MissedBars();
    expect(watch.push([{ v: 2, type: 'NoteMissed', timeMs: 0, midi: 60, noteIndex: 0, stepIndex: 0, bar: 0, hints: { noteNames: false, fingers: false } }])).toBe(false);
    expect(watch.missed).toBe(0);
  });
});
