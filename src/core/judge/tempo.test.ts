// Covers core_01.AC2.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import littleSteps from '../../../tests/fixtures/charts/little-steps.v2.json';
import { chartWith, graceAt } from '../../../tests/helpers/charts';
import { chartSchema, type Chart } from '../chart';
import { compilePiece } from '../piece/compile';
import { Transport } from '../transport';
import { TempoMode } from './tempo';
import { DEFAULT_TOGETHER_WINDOW_MS } from './wait';
import { DEFAULT_TEMPO_WINDOWS, timingOf } from './timing';
import type { CorrectNoteJudged, JudgeEvent, NoteEvent, NoteJudged, NoteMissed, PieceCompleted } from './types';

const chart = chartSchema.parse(littleSteps); // 4/4, 70 bpm, 11 notes

const on = (midi: number, timeMs: number): NoteEvent => ({ kind: 'on', midi, velocity: 80, timeMs, source: 'test' });
const off = (midi: number, timeMs: number): NoteEvent => ({ kind: 'off', midi, velocity: 0, timeMs, source: 'test' });
const judged = (events: JudgeEvent[]) => events.filter((e): e is NoteJudged => e.type === 'NoteJudged');
const rights = (events: JudgeEvent[]) => judged(events).filter((e): e is CorrectNoteJudged => e.verdict === 'correct');
const missed = (events: JudgeEvent[]) => events.filter((e): e is NoteMissed => e.type === 'NoteMissed');
const piece = (events: JudgeEvent[]) => events.find((e): e is PieceCompleted => e.type === 'PieceCompleted');

/**
 * A mode whose transport started at clock time 0 (the first key press). These tests are about the press: hold grading
 * (d093) is off here, which is the judge of before slice f (core_01.AC9); `tempo.hold.test.ts` covers the holds.
 */
function started(c: Chart = chart, percent = 100) {
  const transport = new Transport(c, { tempoPercent: percent });
  const mode = new TempoMode(c, transport, { gradeHold: false });
  expect(mode.handle(on(0, 0))).toEqual([]);
  const at = (i: number) => transport.timeOfTick(c.notes[i]!.tick)!;
  return { transport, mode, at };
}

/** Press every note of the chart `offset(i)` ms from its time. */
function playAll(c: Chart, offset: (i: number) => number, percent = 100) {
  const { mode, at } = started(c, percent);
  const events = c.notes.flatMap((n, i) => [...mode.handle(on(n.midi, at(i) + offset(i))), ...mode.handle(off(n.midi, at(i) + offset(i) + 50))]);
  return { mode, events, at };
}

describe('TempoMode: starting', () => {
  it('starts the count-in with the first key press and does not judge that press', () => {
    const transport = new Transport(chart);
    const mode = new TempoMode(chart, transport);
    expect(transport.started).toBe(false);
    expect(mode.handle(on(60, 1234))).toEqual([]);
    expect(transport.started).toBe(true);
    expect(transport.songStartMs).toBeCloseTo(1234 + (4 * 60000) / 70, 6);
    expect(mode.getState()).toMatchObject({ done: false, stepIndex: 0, awaiting: [0], heldKeys: [60] });
  });

  it('does nothing in advance before the start', () => {
    const mode = new TempoMode(chart, new Transport(chart));
    expect(mode.advance(1e9)).toEqual([]);
  });

  it('presses before the first window are ignored (the count-in is not a note)', () => {
    const { mode, at } = started();
    expect(mode.handle(on(60, at(0) - 1500))).toEqual([]);
    expect(mode.handle(on(61, at(0) - 800))).toEqual([]);
    expect(mode.getState().stepIndex).toBe(0);
  });
});

describe('TempoMode: a piece that starts with a pick-up (d120)', () => {
  // 4/4 at 100 bpm (a beat of 600 ms): a one-beat pick-up G, a full bar, and a last bar of three beats
  const pickup = chartSchema.parse(compilePiece({
    abc: 'X:1\nT:Up\nM:4/4\nL:1/4\nQ:1/4=100\nK:C\nG | C D E F | G3 |]',
    meta: JSON.stringify({ id: 'up', title: 'Up', level: 1, status: 'draft', hands: ['RH'], phrases: [], source: 'test', license: 'CC0-1.0', generator: { kind: 'hand' } }),
  }).chart);

  it('core_09.AC23 the first note of a one-beat pick-up in 4/4 is due on beat 4 of the count, and is right there', () => {
    const transport = new Transport(pickup);
    const mode = new TempoMode(pickup, transport, { gradeHold: false });
    expect(mode.handle(on(0, 0))).toEqual([]); // the first press starts the count on a downbeat
    // counted 1 2 3 4 | 1 2 3, then the pick-up on the fourth beat of the second bar
    expect(transport.timeOfTick(0)).toBeCloseTo(7 * 600, 6);
    expect(transport.countIn(6 * 600 + 1)).toMatchObject({ inBar: 2 });
    expect(rights(mode.handle(on(67, 7 * 600)))).toEqual([expect.objectContaining({ noteIndex: 0, timing: expect.objectContaining({ verdict: 'on-time' }) })]);
    // bar 1 is on the first beat of the third bar of the click
    expect(transport.timeOfTick(pickup.bars[1]!.startTick)).toBeCloseTo(8 * 600, 6);
  });
});

describe('TempoMode: a perfect run', () => {
  const { mode, events } = playAll(chart, () => 0);

  it('judges every note correct and on time with a score of 100, then completes bars, the phrase and the piece', () => {
    expect(judged(events)).toHaveLength(11);
    for (const e of judged(events)) expect(e).toMatchObject({ verdict: 'correct', firstTry: true, timing: { verdict: 'on-time', score: 100 } });
    expect(events.filter((e) => e.type === 'BarCompleted')).toHaveLength(4);
    expect(events.at(-1)!.type).toBe('PieceCompleted');
  });

  it('reports full accuracy and perfect timing statistics', () => {
    expect(piece(events)!.result).toMatchObject({
      notes: 11, firstTryCorrect: 11, accuracy: 1, mistakes: 0,
      timing: { played: 11, onTime: 11, early: 0, late: 0, missed: 0, score: 100 },
    });
    expect(piece(events)!.result.timing!.meanAbsErrorMs).toBeCloseTo(0, 6);
    expect(piece(events)!.result.rhythmErrorMs).toBeCloseTo(0, 6);
  });

  it('ends done, with a timing for every note', () => {
    const state = mode.getState();
    expect(state).toMatchObject({ done: true, awaiting: [] });
    expect(state.timings!.every((t) => t !== null && t.score === 100)).toBe(true);
    expect(mode.handle(on(60, 1e6))).toEqual([]);
  });
});

describe('TempoMode: timing a note', () => {
  it('early and late presses are still right, with the error and a verdict', () => {
    const { events } = playAll(chart, (i) => (i === 1 ? -200 : i === 2 ? 200 : i === 3 ? 100 : 0));
    const [, early, late, near] = rights(events);
    expect(early).toMatchObject({ verdict: 'correct', timing: { verdict: 'early', errorMs: -200 } });
    expect(late).toMatchObject({ verdict: 'correct', timing: { verdict: 'late', errorMs: 200 }, intervalErrorMs: 200 });
    expect(near!.timing).toMatchObject({ verdict: 'on-time', errorMs: 100 });
    expect(early!.timing!.score).toBeLessThan(100);
    expect(early!.timing!.score).toBeGreaterThan(0);
    const result = piece(events)!.result;
    expect(result).toMatchObject({ accuracy: 1, timing: { onTime: 9, early: 1, late: 1, missed: 0 } });
    expect(result.timing!.score).toBeLessThan(100);
  });

  it('scores 100 within the perfect window, falling to 0 at the edge of the playing window', () => {
    const w = DEFAULT_TEMPO_WINDOWS;
    expect(timingOf(w.perfectMs).score).toBe(100);
    expect(timingOf(-w.perfectMs).score).toBe(100);
    expect(timingOf(w.windowMs).score).toBe(0);
    expect(timingOf(w.windowMs + 100).score).toBe(0);
    const scores = [60, 100, 150, 200, 300, 400].map((ms) => timingOf(ms).score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('measures against the tempo percent: at half speed the notes fall twice as far apart', () => {
    const { events } = playAll(chart, () => 0, 50);
    expect(rights(events).every((e) => e.timing!.verdict === 'on-time' && e.timing!.errorMs === 0)).toBe(true);
    // pressed at the 100 percent times the notes would be far too early
    const { mode, transport } = started(chart, 50);
    const full = new Transport(chart);
    full.start(0);
    expect(mode.handle(on(chart.notes[1]!.midi, full.timeOfTick(chart.notes[1]!.tick)!))).toEqual([]); // before the window of step 1, ignored
    expect(transport.timeOfTick(chart.notes[1]!.tick)!).toBeGreaterThan(full.timeOfTick(chart.notes[1]!.tick)!);
  });
});

describe('TempoMode: missed notes', () => {
  it('closes every note whose window has passed and finishes the piece without a single key', () => {
    const { mode, at } = started();
    const events = mode.advance(at(10) + DEFAULT_TEMPO_WINDOWS.windowMs + 1);
    expect(missed(events)).toHaveLength(11);
    expect(missed(events).map((e) => e.noteIndex)).toEqual([...Array(11).keys()]);
    expect(events.at(-1)!.type).toBe('PieceCompleted');
    expect(piece(events)!.result).toMatchObject({ notes: 11, firstTryCorrect: 0, accuracy: 0, timing: { played: 0, missed: 11, score: 0, meanAbsErrorMs: null } });
    expect(mode.getState()).toMatchObject({ done: true });
    expect(mode.getState().noteProgress.every((p) => p === 'missed')).toBe(true);
  });

  it('a window is closed only after its time: not a ms early', () => {
    const { mode, at } = started();
    expect(mode.advance(at(0) + DEFAULT_TEMPO_WINDOWS.windowMs)).toEqual([]);
    expect(missed(mode.advance(at(0) + DEFAULT_TEMPO_WINDOWS.windowMs + 0.5))).toHaveLength(1);
  });

  it('a skipped note is reported when the next press arrives, and the next note still counts', () => {
    const { mode, at } = started();
    const events = mode.handle(on(chart.notes[1]!.midi, at(1)));
    expect(missed(events).map((e) => e.noteIndex)).toEqual([0]);
    expect(judged(events)).toHaveLength(1);
    expect(judged(events)[0]).toMatchObject({ verdict: 'correct', noteIndex: 1, timing: { verdict: 'on-time' } });
    expect(mode.getState().noteProgress.slice(0, 2)).toEqual(['missed', 'correct']);
  });

  it('a mix of played and missed notes adds up: score is the mean with missed as 0', () => {
    const { mode, at } = started();
    const events = [
      ...chart.notes.flatMap((n, i) => (i % 2 === 0 ? mode.handle(on(n.midi, at(i))) : [])),
      ...mode.advance(at(10) + 1000),
    ];
    const stats = piece(events)!.result;
    expect(stats.timing).toMatchObject({ played: 6, missed: 5, onTime: 6 });
    expect(stats.timing!.score).toBeCloseTo((6 * 100) / 11, 6);
    expect(stats.accuracy).toBeCloseTo(6 / 11, 6);
  });
});

describe('TempoMode: wrong keys', () => {
  it('judges a wrong key with its reason, but time goes on: the note is missed if it never comes', () => {
    const { mode, at } = started();
    const wrong = mode.handle(on(72, at(0))); // C5 for C4
    expect(wrong).toHaveLength(1);
    expect(wrong[0]).toMatchObject({ type: 'NoteJudged', verdict: 'wrong', reason: 'wrong-octave', expectedMidi: 60 });
    expect(mode.getState()).toMatchObject({ stepIndex: 0, awaiting: [0] }); // still this note's window
    const events = mode.advance(at(0) + 500);
    expect(missed(events)).toHaveLength(1);
    expect(mode.getState().stepIndex).toBe(1);
  });

  it('a wrong key and then the right one in time: right, but not on the first try', () => {
    const { mode, at } = started();
    mode.handle(on(61, at(0) - 20));
    const [good] = mode.handle(on(60, at(0) + 10));
    expect(good).toMatchObject({ verdict: 'correct', firstTry: false, timing: { verdict: 'on-time' } });
  });

  it('a key outside every window is ignored: no wrong note, no mistake', () => {
    const { mode, at } = started();
    expect(mode.handle(on(50, at(0) - 3000))).toEqual([]);
    const events = playRest(mode, at);
    expect(piece(events)!.result.mistakes).toBe(0);
  });
});

function playRest(mode: TempoMode, at: (i: number) => number): JudgeEvent[] {
  return chart.notes.flatMap((n, i) => mode.handle(on(n.midi, at(i))));
}

describe('TempoMode: chords and two hands', () => {
  const both = chartWith([
    { tick: 0, dur: 960, midi: 64, track: 'rh' }, { tick: 0, dur: 960, midi: 48, track: 'lh' },
    { tick: 960, dur: 960, midi: 65, track: 'rh' }, { tick: 960, dur: 960, midi: 47, track: 'lh' },
  ]);

  it('judges each key of a two-hand step on its own time and counts them together when close', () => {
    const { mode, at } = started(both);
    const events = [
      ...mode.handle(on(64, at(0))), ...mode.handle(on(48, at(0) + 50)),
      ...mode.handle(on(65, at(2))), ...mode.handle(on(47, at(2) + 60)),
    ];
    expect(judged(events)).toHaveLength(4);
    expect(piece(events)!.result.bothHands).toEqual({ notes: 4, together: 4 });
    expect(piece(events)!.result.timing).toMatchObject({ played: 4, missed: 0 });
  });

  it('one hand missing makes the step a miss for that note and not together', () => {
    const { mode, at } = started(both);
    const events = [...mode.handle(on(64, at(0))), ...mode.handle(on(65, at(2))), ...mode.handle(on(47, at(2))), ...mode.advance(at(2) + 1000)];
    expect(missed(events).map((e) => e.midi)).toEqual([48]);
    expect(piece(events)!.result.bothHands).toEqual({ notes: 4, together: 2 });
  });

  it('hands exactly the together window apart still count as together, one ms more does not', () => {
    const { mode, at } = started(both);
    const events = [
      ...mode.handle(on(64, at(0))), ...mode.handle(on(48, at(0) + DEFAULT_TOGETHER_WINDOW_MS)),
      ...mode.handle(on(65, at(2))), ...mode.handle(on(47, at(2) + DEFAULT_TOGETHER_WINDOW_MS + 1)),
    ];
    expect(piece(events)!.result.bothHands).toEqual({ notes: 4, together: 2 });
  });
});

describe('TempoMode: the edge of a window', () => {
  it('a press exactly at the end of the last window still counts, one ms later it is a miss', () => {
    const one = chartWith([{ tick: 0, dur: 480, midi: 60 }]);
    const inTime = started(one);
    expect(rights(inTime.mode.handle(on(60, inTime.at(0) + DEFAULT_TEMPO_WINDOWS.windowMs)))).toHaveLength(1);
    const late = started(one);
    const events = late.mode.handle(on(60, late.at(0) + DEFAULT_TEMPO_WINDOWS.windowMs + 1));
    expect(rights(events)).toHaveLength(0);
    expect(missed(events).map((e) => e.midi)).toEqual([60]);
  });
});

describe('TempoMode: tied notes', () => {
  it('a tie needs no press of its own and is missed with its step', () => {
    const tied = chartWith([{ tick: 0, dur: 960, midi: 60, tieNext: true }, { tick: 960, dur: 960, midi: 60 }, { tick: 1920, dur: 960, midi: 62 }]);
    const { mode, at } = started(tied);
    const state = (m: TempoMode) => m.getState().noteProgress;
    mode.handle(on(60, at(0)));
    expect(state(mode)).toEqual(['correct', 'correct', 'pending']);
    mode.advance(at(2) + 1000);
    expect(state(mode)).toEqual(['correct', 'correct', 'missed']);
    const second = started(tied);
    second.mode.advance(second.at(0) + 1000);
    expect(state(second.mode).slice(0, 2)).toEqual(['missed', 'missed']);
  });
});

describe('TempoMode: properties', () => {
  it('any jitter inside the windows leaves every note right, with the mean error as the sum of the jitter', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: -250, max: 250 }), { minLength: 11, maxLength: 11 }), (jitter) => {
        const { events } = playAll(chart, (i) => jitter[i]!);
        const result = piece(events)!.result;
        expect(judged(events)).toHaveLength(11);
        expect(result).toMatchObject({ accuracy: 1, mistakes: 0, timing: { played: 11, missed: 0 } });
        const mean = jitter.reduce((s, j) => s + Math.abs(j), 0) / 11;
        expect(result.timing!.meanAbsErrorMs).toBeCloseTo(mean, 6);
        expect(result.timing!.score).toBeGreaterThanOrEqual(0);
        expect(result.timing!.score).toBeLessThanOrEqual(100);
      }),
    );
  });

  it('how often the scene calls advance changes nothing: the same results either way', () => {
    fc.assert(
      fc.property(fc.array(fc.boolean(), { minLength: 11, maxLength: 11 }), fc.integer({ min: 7, max: 300 }), (play, every) => {
        const run = (frameMs: number | null) => {
          const { mode, at } = started();
          const events: JudgeEvent[] = [];
          let clock = 0;
          chart.notes.forEach((n, i) => {
            if (frameMs !== null) for (; clock < at(i); clock += frameMs) events.push(...mode.advance(clock));
            if (play[i]) events.push(...mode.handle(on(n.midi, at(i))));
          });
          events.push(...mode.advance(at(10) + 5000));
          const trace: unknown[][] = events.map((e) => (e.type === 'NoteJudged' || e.type === 'NoteMissed' ? [e.type, e.midi, e.stepIndex] : [e.type]));
          return [...trace, [JSON.stringify(piece(events)?.result)]];
        };
        expect(run(every)).toEqual(run(null));
      }),
    );
  });

  it('every note ends either played or missed, never both, and the piece completes exactly once', () => {
    fc.assert(
      fc.property(fc.array(fc.option(fc.integer({ min: -600, max: 600 }), { nil: null }), { minLength: 11, maxLength: 11 }), (offsets) => {
        const { mode, at } = started();
        const events: JudgeEvent[] = [];
        chart.notes.forEach((n, i) => {
          const o = offsets[i]!;
          if (o !== null) events.push(...mode.handle(on(n.midi, at(i) + o)));
        });
        events.push(...mode.advance(at(10) + 5000));
        const right = judged(events).filter((e) => e.verdict === 'correct').map((e) => (e.verdict === 'correct' ? e.noteIndex : -1));
        const gone = missed(events).map((e) => e.noteIndex);
        expect(new Set([...right, ...gone]).size).toBe(right.length + gone.length);
        expect(right.length + gone.length).toBe(11);
        expect(events.filter((e) => e.type === 'PieceCompleted')).toHaveLength(1);
      }),
    );
  });
});

describe('TempoMode: a looped section', () => {
  // four quarters at 120 bpm: the last note is 500 ms before the bar's end, where the next lap's first note falls
  const loopChart = chartWith([{ tick: 0, dur: 480, midi: 60 }, { tick: 480, dur: 480, midi: 62 }, { tick: 960, dur: 480, midi: 64 }, { tick: 1440, dur: 480, midi: 65 }]);
  const play = (loop: boolean, lateMs: number) => {
    const transport = new Transport(loopChart, { countInBars: 0 });
    const mode = new TempoMode(loopChart, transport, { gradeHold: false, ...(loop ? { loop: true } : {}) });
    transport.start(0);
    for (const [i, midi] of [60, 62, 64].entries()) mode.handle(on(midi, i * 500));
    return judged(mode.handle(on(65, 1500 + lateMs)));
  };

  it('core_03.AC4 the last note late window and the next lap first note early window split the gap between them', () => {
    expect(play(false, 300)).toHaveLength(1); // a whole piece: 400 ms late is still the last note
    expect(play(true, 300)).toHaveLength(0); // a loop: 300 ms late is nearer the next lap's first note (250 each)
    expect(play(true, 200)).toHaveLength(1);
  });
});

describe('TempoMode: grace notes are never required and never wrong (core_09.AC33, d121)', () => {
  // C D E at 60 bpm (a quarter is 1000 ms, so the 400 ms windows are not cut), a grace F (65) before the E
  const slow = (graces: unknown[]) =>
    chartWith([{ tick: 0, dur: 480, midi: 60 }, { tick: 480, dur: 480, midi: 62 }, { tick: 960, dur: 960, midi: 64 }], {
      tempoMap: [{ tick: 0, bpm: 60 }], graces,
    });
  const graced = slow([graceAt(960, 65)]);
  const toTheE = (c: Chart) => {
    const s = started(c);
    s.mode.handle(on(60, s.at(0)));
    s.mode.handle(on(62, s.at(1)));
    return s;
  };

  // Covers core_09.AC33.
  it('core_09.AC33 ignores a press of the grace pitch just before its main note: no wrong note, no score, no mistake', () => {
    const { mode, at } = toTheE(graced);
    expect(mode.handle(on(65, at(2) - 60))).toEqual([]);
    expect(mode.handle(off(65, at(2) - 10))).toEqual([]);
    const events = [...mode.handle(on(64, at(2))), ...mode.advance(at(2) + 5000)];
    expect(rights(events).map((e) => [e.midi, e.timing!.score])).toEqual([[64, 100]]);
    expect(missed(events)).toEqual([]);
    expect(piece(events)!.result).toMatchObject({ notes: 3, firstTryCorrect: 3, mistakes: 0, accuracy: 1 });
    expect(piece(events)!.result.timing).toMatchObject({ played: 3, onTime: 3, missed: 0, score: 100 });
  });

  it('core_09.AC65 an ornament is optional: its notes inside its note are ignored, the main note scored as usual', () => {
    const pitch = (midi: number) => graceAt(0, midi).pitch;
    const mordent = chartSchema.parse({ ...slow([]), graces: undefined, ornaments: [{ track: 'rh', voice: 1, tick: 480, kind: 'upperMordent', upper: pitch(64) }] });
    const s = started(mordent);
    s.mode.handle(on(60, s.at(0)));
    const played = [...s.mode.handle(on(62, s.at(1))), ...s.mode.handle(on(64, s.at(1) + 100)), ...s.mode.handle(on(62, s.at(1) + 200))];
    expect(judged(played).map((e) => [e.midi, e.verdict])).toEqual([[62, 'correct']]);
    const events = [...s.mode.handle(on(64, s.at(2))), ...s.mode.advance(s.at(2) + 5000)];
    expect(piece(events)!.result).toMatchObject({ notes: 3, mistakes: 0 });
  });

  it('core_09.AC33 up to 250 ms before the onset is ignored; earlier in the window, or after the onset, the key is wrong (AX-3 provisional: 250 ms)', () => {
    const at250 = toTheE(graced);
    expect(at250.mode.handle(on(65, at250.at(2) - 250))).toEqual([]);
    const at300 = toTheE(graced);
    expect(judged(at300.mode.handle(on(65, at300.at(2) - 300))).map((e) => e.verdict)).toEqual(['wrong']);
    const after = toTheE(graced);
    expect(judged(after.mode.handle(on(65, after.at(2) + 10))).map((e) => e.verdict)).toEqual(['wrong']);
  });

  it('core_09.AC33 the same press without the grace in the chart is a wrong note (the baseline)', () => {
    const { mode, at } = toTheE(slow([]));
    expect(judged(mode.handle(on(65, at(2) - 60))).map((e) => e.verdict)).toEqual(['wrong']);
  });

  it('core_09.AC33 a grace press inside the window of the note before is ignored too, and that note can still be played', () => {
    // eighths at 120 bpm: D's late window reaches 125 ms before the E, so a grace 200 ms before the E falls in D's window
    const fast = chartWith([{ tick: 0, dur: 240, midi: 60 }, { tick: 240, dur: 240, midi: 62 }, { tick: 480, dur: 480, midi: 64 }], { graces: [graceAt(480, 65)] });
    const { mode, at } = started(fast);
    mode.handle(on(60, at(0)));
    expect(mode.handle(on(65, at(2) - 200))).toEqual([]);
    expect(rights(mode.handle(on(62, at(2) - 190))).map((e) => e.noteIndex)).toEqual([1]);
  });

  it('core_09.AC33 a grace never needs a press: skipping it scores the same as playing it', () => {
    const { events } = playAll(graced, () => 0);
    expect(missed(events)).toEqual([]);
    expect(piece(events)!.result).toMatchObject({ notes: 3, firstTryCorrect: 3, mistakes: 0 });
    expect(piece(events)!.result.timing).toMatchObject({ played: 3, missed: 0, score: 100 });
  });
});
