// Covers core_01.AC10: Tempo mode can start on the first note's own keys, with no count-in.
import { describe, expect, it } from 'vitest';
import { chartWith } from '../../../tests/helpers/charts';
import { Transport } from '../transport';
import { TempoMode } from './tempo';
import type { CorrectNoteJudged, JudgeEvent, NoteEvent, NoteJudged } from './types';

const on = (midi: number, timeMs: number): NoteEvent => ({ kind: 'on', midi, velocity: 80, timeMs, source: 'test' });
const off = (midi: number, timeMs: number): NoteEvent => ({ kind: 'off', midi, velocity: 0, timeMs, source: 'test' });
const rights = (events: JudgeEvent[]) => events.filter((e): e is CorrectNoteJudged => e.type === 'NoteJudged' && e.verdict === 'correct');
const judged = (events: JudgeEvent[]) => events.filter((e): e is NoteJudged => e.type === 'NoteJudged');

// 4/4 at 120 bpm: a quarter is 500 ms
const melody = chartWith([{ tick: 0, dur: 480, midi: 60 }, { tick: 480, dur: 480, midi: 62 }, { tick: 960, dur: 480, midi: 64 }, { tick: 1440, dur: 480, midi: 65 }]);
const chordFirst = chartWith([
  { tick: 0, dur: 480, midi: 60 }, { tick: 0, dur: 480, midi: 64 }, { tick: 0, dur: 480, midi: 48, track: 'lh' },
  { tick: 480, dur: 480, midi: 62 },
]);
// a pickup: the first note is on the last beat of bar 1
const pickup = chartWith([{ tick: 1440, dur: 480, midi: 67 }, { tick: 1920, dur: 480, midi: 72 }]);

function firstNote(chart = melody) {
  const transport = new Transport(chart, { countInBars: 0 });
  const mode = new TempoMode(chart, transport, { gradeHold: false, start: 'firstNote' });
  return { transport, mode };
}

describe('TempoMode: start on the first note (core_01.AC10)', () => {
  it('core_01.AC10 a wrong key does not start the clock and is not judged', () => {
    const { transport, mode } = firstNote();
    expect(mode.handle(on(61, 100))).toEqual([]);
    expect(mode.handle(off(61, 200))).toEqual([]);
    expect(transport.started).toBe(false);
    expect(mode.advance(1e6)).toEqual([]);
    expect(mode.getState()).toMatchObject({ stepIndex: 0, awaiting: [0] });
  });

  it('core_01.AC10 the first note starts the clock at its own press, is judged on time, and the piece runs on from there', () => {
    const { transport, mode } = firstNote();
    const events = mode.handle(on(60, 1000));
    expect(transport.started).toBe(true);
    expect(transport.timeOfTick(0)).toBe(1000);
    expect(transport.countIn(1000)).toBeNull();
    expect(rights(events)).toHaveLength(1);
    expect(rights(events)[0]).toMatchObject({ midi: 60, firstTry: true, timing: { verdict: 'on-time', score: 100 } });
    // the second note is due 500 ms later
    expect(rights(mode.handle(on(62, 1500)))[0]).toMatchObject({ timing: { verdict: 'on-time' } });
    // the third is not played: its window passes and it is missed
    expect(mode.advance(2500).filter((e) => e.type === 'NoteMissed')).toHaveLength(1);
  });

  it('core_01.AC10 a chord starts once all its keys are down at once, at the press of the last one; each counts on time', () => {
    const { transport, mode } = firstNote(chordFirst);
    expect(mode.handle(on(60, 1000))).toEqual([]);
    expect(mode.handle(on(48, 1040))).toEqual([]);
    expect(transport.started).toBe(false);
    const events = mode.handle(on(64, 1080));
    expect(transport.timeOfTick(0)).toBe(1080);
    expect(rights(events).map((e) => e.midi).sort()).toEqual([48, 60, 64]);
    for (const e of rights(events)) expect(e.timing).toMatchObject({ verdict: 'on-time', score: 100 });
    expect(mode.getState().stepIndex).toBe(1);
  });

  it('core_01.AC10 a key of the chord let go before the others are down does not count: the chord is pressed together', () => {
    const { transport, mode } = firstNote(chordFirst);
    mode.handle(on(60, 1000));
    mode.handle(off(60, 1100));
    mode.handle(on(48, 1200));
    mode.handle(on(64, 1250));
    expect(transport.started).toBe(false);
    const events = mode.handle(on(60, 1300));
    expect(transport.timeOfTick(0)).toBe(1300);
    expect(rights(events)).toHaveLength(3);
  });

  it('core_01.AC10 with a pickup the first note keeps its beat: tick 0 lies before the press', () => {
    const { transport, mode } = firstNote(pickup);
    const events = mode.handle(on(67, 5000));
    expect(rights(events)).toHaveLength(1);
    expect(transport.timeOfTick(1440)).toBe(5000);
    expect(transport.timeOfTick(0)).toBe(5000 - 1500);
    expect(judged(mode.handle(on(72, 5500)))[0]).toMatchObject({ verdict: 'correct', timing: { verdict: 'on-time' } });
  });

  it('core_01.AC10 with hold grading on, the first note is held from its press', () => {
    const transport = new Transport(melody, { countInBars: 0 });
    const mode = new TempoMode(melody, transport, { start: 'firstNote' });
    mode.handle(on(60, 1000));
    const released = mode.handle(off(60, 1490));
    expect(mode.getState().timings?.[0]).toMatchObject({ hold: 100, score: 100 });
    expect(released.some((e) => e.type === 'NoteJudged')).toBe(false);
  });

  it('the count-in start stays the default: the first key starts the count-in and is not judged', () => {
    const transport = new Transport(melody);
    const mode = new TempoMode(melody, transport, { gradeHold: false });
    expect(mode.handle(on(60, 1000))).toEqual([]);
    expect(transport.songStartMs).toBe(1000 + 2000);
  });
});
