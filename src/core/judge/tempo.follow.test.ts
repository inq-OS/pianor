// Covers core_01.AC12: the following clock waits for a late note, never misses one, and leans toward the pace played.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { chartWith } from '../../../tests/helpers/charts';
import { Transport } from '../transport';
import { TempoMode } from './tempo';
import { DEFAULT_FOLLOW_RULES, DEFAULT_TEMPO_WINDOWS, followRate } from './timing';
import type { CorrectNoteJudged, JudgeEvent, NoteEvent, NoteJudged, PieceCompleted } from './types';

const on = (midi: number, timeMs: number): NoteEvent => ({ kind: 'on', midi, velocity: 80, timeMs, source: 'test' });
const rights = (events: JudgeEvent[]) => events.filter((e): e is CorrectNoteJudged => e.type === 'NoteJudged' && e.verdict === 'correct');
const wrongs = (events: JudgeEvent[]) => events.filter((e): e is NoteJudged => e.type === 'NoteJudged' && e.verdict === 'wrong');
const missed = (events: JudgeEvent[]) => events.filter((e) => e.type === 'NoteMissed');
const piece = (events: JudgeEvent[]) => events.find((e): e is PieceCompleted => e.type === 'PieceCompleted');

// 4/4 at 120 bpm: a quarter is 500 ms, so a window is 250 ms either side
const MIDIS = [60, 62, 64, 65, 67, 69, 71, 72];
const melody = chartWith(MIDIS.map((midi, i) => ({ tick: i * 480, dur: 480, midi })));
const BEAT = 500;
const HALF = 250;

/** The clock follows; the first note starts it at 1000 ms. */
function following(rules = DEFAULT_FOLLOW_RULES, chart = melody) {
  const transport = new Transport(chart, { countInBars: 0 });
  const mode = new TempoMode(chart, transport, { gradeHold: false, start: 'firstNote', follow: rules });
  const first = mode.handle(on(chart.notes[0]!.midi, 1000));
  return { transport, mode, first };
}

describe('TempoMode: the following clock (core_01.AC12)', () => {
  it('core_01.AC12 a note played long after its window is still that note: late, never missed, and the piece goes on from there', () => {
    const { transport, mode } = following();
    // the student stops for three seconds before the second note; the frames go on meanwhile
    const idle = [1400, 1800, 2500, 3500, 4400].flatMap((t) => mode.advance(t));
    expect(missed(idle)).toEqual([]);
    expect(mode.getState()).toMatchObject({ stepIndex: 1, awaiting: [1] });
    const late = rights(mode.handle(on(62, 4500)));
    expect(late).toHaveLength(1);
    expect(late[0]!.timing).toMatchObject({ verdict: 'late' });
    expect(late[0]!.timing!.errorMs).toBeCloseTo(HALF, 6);
    // the clock is on that press: the third note is one beat after it, and a press there is on time
    expect(transport.timeOfTick(960)).toBeCloseTo(4500 + BEAT, 6);
    expect(rights(mode.handle(on(64, 5000)))[0]!.timing!.errorMs).toBeCloseTo(0, 6);
  });

  it('core_01.AC12 the strict clock misses the same note and takes the late press for nothing', () => {
    const transport = new Transport(melody, { countInBars: 0 });
    const mode = new TempoMode(melody, transport, { gradeHold: false, start: 'firstNote' });
    mode.handle(on(60, 1000));
    expect(missed(mode.advance(1800))).toHaveLength(1);
    expect(rights(mode.handle(on(62, 1800)))).toEqual([]);
  });

  it('core_01.AC12 while it waits the playhead stands still and a wrong key is a wrong note of that step', () => {
    const { transport, mode } = following();
    mode.advance(2000);
    const stoodAt = transport.tickAt(2000)!;
    mode.advance(3000);
    expect(transport.tickAt(3000)).toBe(stoodAt);
    expect(stoodAt).toBe(480 + 240); // the end of the second note's window
    const wrong = wrongs(mode.handle(on(61, 3100)));
    expect(wrong).toHaveLength(1);
    expect(wrong[0]!.stepIndex).toBe(1);
    expect(rights(mode.handle(on(62, 3200)))).toHaveLength(1);
  });

  it('core_01.AC12 a right key before the window opens is that note played early, and the clock goes on from it', () => {
    const { transport, mode } = following();
    const early = rights(mode.handle(on(62, 1100)));
    expect(early).toHaveLength(1);
    expect(early[0]!.timing).toMatchObject({ verdict: 'early', score: 0 });
    expect(mode.getState().stepIndex).toBe(2);
    expect(transport.timeOfTick(480)).toBeCloseTo(1100, 6);
  });

  it('core_01.AC12 a wrong key before the window opens is no note, as with the strict clock', () => {
    const { mode } = following();
    expect(mode.handle(on(61, 1100))).toEqual([]);
    expect(mode.getState()).toMatchObject({ stepIndex: 1, awaiting: [1] });
  });

  it('core_01.AC12 a note played early and held its own length is held in full', () => {
    const transport = new Transport(melody, { countInBars: 0 });
    const mode = new TempoMode(melody, transport, { start: 'firstNote', follow: DEFAULT_FOLLOW_RULES });
    mode.handle(on(60, 1000));
    mode.handle({ kind: 'off', midi: 60, velocity: 0, timeMs: 1100, source: 'test' });
    mode.handle(on(62, 1100)); // 400 ms before its time
    mode.handle({ kind: 'off', midi: 62, velocity: 0, timeMs: 1100 + BEAT, source: 'test' });
    expect(mode.getState().timings![1]).toMatchObject({ verdict: 'early', hold: 100 });
  });

  it('core_01.AC12 the count-in before the first note is still no note', () => {
    const transport = new Transport(melody);
    const mode = new TempoMode(melody, transport, { gradeHold: false, follow: DEFAULT_FOLLOW_RULES });
    mode.handle(on(60, 0)); // starts the count-in of 2000 ms
    expect(mode.handle(on(60, 500))).toEqual([]);
    expect(mode.getState().stepIndex).toBe(0);
    mode.advance(9000); // and the first note is waited for like any other
    expect(rights(mode.handle(on(60, 9000)))).toHaveLength(1);
  });

  it('core_01.AC12 the tempo leans toward the pace played, a quarter of the way at each note', () => {
    const { transport, mode } = following();
    // 10% slower than set: gaps of 550 ms
    mode.handle(on(62, 1550));
    expect(transport.rate).toBeCloseTo(followRate(1, 500 / 550), 9);
    expect(transport.rate).toBeLessThan(1);
    // each note is timed from the one before, so a steady slower student is never further off than one gap's difference
    const third = rights(mode.handle(on(64, 2100)))[0]!;
    expect(third.timing!.errorMs).toBeGreaterThan(0);
    expect(third.timing!.errorMs).toBeLessThan(50);
    expect(third.timing!.verdict).toBe('on-time');
  });

  it('core_01.AC12 the tempo stays inside the band, and a gap that was waited in does not move it', () => {
    const { transport, mode } = following();
    let at = 1000;
    for (const midi of MIDIS.slice(1, 6)) {
      at += 300; // far faster than the band allows
      mode.handle(on(midi, at));
    }
    expect(transport.rate).toBeLessThanOrEqual(1 + DEFAULT_FOLLOW_RULES.band + 1e-9);
    const before = transport.rate;
    mode.advance(at + 5000);
    mode.handle(on(mode.getState().awaiting.map((i) => melody.notes[i]!.midi)[0]!, at + 5000));
    expect(transport.rate).toBe(before);
  });

  it('core_01.AC12 with a band of 0 the tempo is kept and only the waiting is left', () => {
    const { transport, mode } = following({ band: 0, gain: 0.25 });
    mode.handle(on(62, 1550));
    expect(transport.rate).toBe(1);
    mode.advance(4000);
    expect(rights(mode.handle(on(64, 4000)))).toHaveLength(1);
    expect(transport.timeOfTick(1440)).toBeCloseTo(4000 + BEAT, 6);
  });

  it('core_01.AC12 a chord waits for all its keys and the clock goes on from its first press', () => {
    const chord = chartWith([{ tick: 0, dur: 480, midi: 60 }, { tick: 480, dur: 480, midi: 64 }, { tick: 480, dur: 480, midi: 48, track: 'lh' }, { tick: 960, dur: 480, midi: 62 }]);
    const { transport, mode } = following(DEFAULT_FOLLOW_RULES, chord);
    mode.advance(3000);
    expect(rights(mode.handle(on(64, 3000)))).toHaveLength(1);
    mode.advance(3900);
    expect(rights(mode.handle(on(48, 3900)))).toHaveLength(1);
    expect(mode.getState().stepIndex).toBe(2);
    expect(transport.timeOfTick(480)).toBeCloseTo(3000, 6);
  });

  it('core_01.AC12 however late, early and uneven the right keys come, every note is played, none is missed and the piece completes', () => {
    fc.assert(fc.property(fc.array(fc.integer({ min: 40, max: 6000 }), { minLength: MIDIS.length - 1, maxLength: MIDIS.length - 1 }), fc.integer({ min: 1, max: 400 }), (gaps, frame) => {
      const { mode, first } = following();
      const events: JudgeEvent[] = [...first];
      let now = 1000;
      gaps.forEach((gap, i) => {
        for (let t = now + frame; t < now + gap; t += frame) events.push(...mode.advance(t));
        now += gap;
        events.push(...mode.handle(on(MIDIS[i + 1]!, now)));
      });
      events.push(...mode.advance(now + 10_000));
      expect(missed(events)).toEqual([]);
      expect(rights(events)).toHaveLength(MIDIS.length);
      expect(piece(events)).toBeDefined();
      for (const e of rights(events)) expect(e.timing!.errorMs).toBeLessThanOrEqual(DEFAULT_TEMPO_WINDOWS.windowMs + 1e-6);
    }));
  });
});

describe('followRate (core_01.AC12)', () => {
  it('core_01.AC12 moves a share of the way and stops at the band', () => {
    expect(followRate(1, 0.9)).toBeCloseTo(0.975, 9);
    expect(followRate(0.86, 0.5)).toBe(0.85);
    expect(followRate(1.14, 3)).toBe(1.15);
    expect(followRate(1, Number.NaN)).toBe(1);
    expect(followRate(1, 0)).toBe(1);
  });
});
