import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import littleSteps from '../../../tests/fixtures/charts/little-steps.v2.json';
import handsTogether from '../../../tests/golden/hands-together.chart.json';
import { chartWith } from '../../../tests/helpers/charts';
import { chartSchema } from '../../core/chart';
import { DEFAULT_TOGETHER_WINDOW_MS, TempoMode, WaitMode, type JudgeEvent, type NoteEvent, type NoteJudged } from '../../core/judge';
import { Transport } from '../../core/transport';
import { composePerformance, playThroughDevice, wrongKeyFor, type TimedNoteEvent } from './performance';
import { ManualScheduler } from './scheduler';
import { ScriptedKeyboard } from './ScriptedKeyboard';
import { VirtualEz220 } from './VirtualEz220';

const chart = chartSchema.parse(littleSteps);

function judge(events: TimedNoteEvent[], source = chart): JudgeEvent[] {
  const mode = new WaitMode(source);
  return events.flatMap((e) => mode.handle({ kind: e.kind, midi: e.midi, velocity: e.velocity, timeMs: e.atMs, source: 'test' } satisfies NoteEvent));
}
const verdicts = (events: JudgeEvent[]) => events.filter((e): e is NoteJudged => e.type === 'NoteJudged');

describe('composePerformance', () => {
  it('plays the chart in order at its tempo: a quarter at 70 bpm is about 857 ms', () => {
    const events = composePerformance(chart);
    const ons = events.filter((e) => e.kind === 'on');
    expect(ons.map((e) => e.midi)).toEqual(chart.notes.map((n) => n.midi));
    expect(ons[1]!.atMs - ons[0]!.atMs).toBeCloseTo(60000 / 70, 6);
    expect(events.filter((e) => e.kind === 'off')).toHaveLength(11);
  });

  it('is sorted by time and a perfect performance completes the piece with full accuracy', () => {
    const events = composePerformance(chart);
    expect(events.map((e) => e.atMs)).toEqual([...events.map((e) => e.atMs)].sort((a, b) => a - b));
    const result = judge(events).find((e) => e.type === 'PieceCompleted');
    expect(result).toMatchObject({ result: { accuracy: 1, mistakes: 0 } });
  });

  it('scales tempo, adds latency and a start offset', () => {
    const base = composePerformance(chart).filter((e) => e.kind === 'on');
    const fast = composePerformance(chart, { tempoScale: 2, latencyMs: 30, startMs: 100 }).filter((e) => e.kind === 'on');
    expect(fast[3]!.atMs).toBeCloseTo(100 + 30 + base[3]!.atMs / 2, 6);
  });

  it('is deterministic for a seed and differs between seeds when jitter is on', () => {
    const options = { jitterMs: 40, velocityJitter: 20, seed: 7 };
    expect(composePerformance(chart, options)).toEqual(composePerformance(chart, options));
    expect(composePerformance(chart, options)).not.toEqual(composePerformance(chart, { ...options, seed: 8 }));
  });

  it('keeps jitter and velocity inside their bounds (property)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 60 }), fc.integer({ min: 0, max: 60 }), fc.integer(), (jitterMs, velocityJitter, seed) => {
        const exact = composePerformance(chart).filter((e) => e.kind === 'on');
        const events = composePerformance(chart, { jitterMs, velocityJitter, seed, velocity: 70 }).filter((e) => e.kind === 'on');
        events.forEach((e, i) => {
          expect(Math.abs(e.atMs - exact[i]!.atMs)).toBeLessThanOrEqual(jitterMs + 1e-9);
          expect(e.velocity).toBeGreaterThanOrEqual(1);
          expect(e.velocity).toBeLessThanOrEqual(127);
          expect(Math.abs(e.velocity - 70)).toBeLessThanOrEqual(velocityJitter + 1);
        });
      }),
    );
  });

  it('scripted mistakes are judged as exactly the kind requested, and the piece still completes', () => {
    const events = composePerformance(chart, {
      mistakes: [
        { stepIndex: 1, kind: 'wrong-octave' },
        { stepIndex: 4, kind: 'neighbour-key', count: 2 },
        { stepIndex: 8, kind: 'wrong-letter' },
      ],
    });
    const judged = judge(events);
    const wrong = verdicts(judged).filter((e) => e.verdict === 'wrong');
    expect(wrong.map((e) => e.verdict === 'wrong' && e.reason)).toEqual(['wrong-octave', 'neighbour-key', 'neighbour-key', 'wrong-letter']);
    expect(judged.find((e) => e.type === 'PieceCompleted')).toMatchObject({ result: { mistakes: 4, firstTryCorrect: 8 } });
  });

  it('a skipped step is never played, so Wait mode stays waiting on it', () => {
    const events = composePerformance(chart, { mistakes: [{ stepIndex: 4, kind: 'skip' }] }); // the only G in the piece
    expect(events.filter((e) => e.kind === 'on')).toHaveLength(10);
    const mode = new WaitMode(chart);
    events.forEach((e) => mode.handle({ kind: e.kind, midi: e.midi, velocity: e.velocity, timeMs: e.atMs, source: 'test' }));
    expect(mode.getState()).toMatchObject({ done: false, stepIndex: 4 });
  });

  it('plays chords in the requested order and the judge accepts every order', () => {
    const chord = chartWith([
      { tick: 0, dur: 960, midi: 60 }, { tick: 0, dur: 960, midi: 64 }, { tick: 0, dur: 960, midi: 67 }, { tick: 960, dur: 960, midi: 62 },
    ]);
    const orders = { ascending: [60, 64, 67], descending: [67, 64, 60] } as const;
    for (const [order, expected] of Object.entries(orders)) {
      const ons = composePerformance(chord, { chordOrder: order as 'ascending' | 'descending' }).filter((e) => e.kind === 'on');
      expect(ons.slice(0, 3).map((e) => e.midi)).toEqual(expected);
    }
    for (const chordOrder of ['ascending', 'descending', 'shuffled'] as const) {
      expect(judge(composePerformance(chord, { chordOrder, seed: 3 }), chord).some((e) => e.type === 'PieceCompleted')).toBe(true);
    }
  });

  it('puts a release before a press at the same instant so repeated notes retrigger', () => {
    const repeated = chartWith([{ tick: 0, dur: 480, midi: 60 }, { tick: 480, dur: 480, midi: 60 }]);
    const events = composePerformance(repeated, { holdFraction: 1 });
    expect(events.map((e) => e.kind)).toEqual(['on', 'off', 'on', 'off']);
  });

  it('every composed key is on the EZ-220 keyboard, so the virtual device accepts it (property)', () => {
    fc.assert(
      fc.property(fc.integer(), (seed) => {
        const events = composePerformance(chart, { seed, mistakes: [{ stepIndex: 0, kind: 'wrong-octave' }, { stepIndex: 3, kind: 'neighbour-key' }] });
        const device = new VirtualEz220();
        for (const e of events) {
          expect(() => (e.kind === 'on' ? device.press(e.midi, e.velocity, e.atMs) : device.release(e.midi, e.atMs))).not.toThrow();
        }
      }),
    );
  });
});

describe('two hands: together or apart', () => {
  const both = chartSchema.parse(handsTogether); // steps 0, 2, 4 and 6 need both hands (RH on top, LH below)
  const ons = (options: Parameters<typeof composePerformance>[1] = {}) => composePerformance(both, options).filter((e) => e.kind === 'on');
  const finish = (options: Parameters<typeof composePerformance>[1] = {}) =>
    judge(composePerformance(both, options), both).find((e) => e.type === 'PieceCompleted') as Extract<JudgeEvent, { type: 'PieceCompleted' }>;

  it('together is the default: both keys of a two-hand step land within the together window', () => {
    const first = ons();
    expect(first[1]!.atMs - first[0]!.atMs).toBeLessThanOrEqual(DEFAULT_TOGETHER_WINDOW_MS);
    expect(finish().result.bothHands).toEqual({ notes: 8, together: 8 });
    expect(finish({ hands: 'together' }).result.bothHands).toEqual({ notes: 8, together: 8 });
  });

  it('apart presses one hand, then the other after a gap longer than the together window, and the judge still finishes the piece', () => {
    const events = ons({ hands: 'apart' });
    expect(events[1]!.atMs - events[0]!.atMs).toBe(500);
    expect(500).toBeGreaterThan(DEFAULT_TOGETHER_WINDOW_MS);
    const { result } = finish({ hands: 'apart' });
    expect(result.accuracy).toBe(1);
    expect(result.mistakes).toBe(0);
    expect(result.bothHands).toEqual({ notes: 8, together: 0 });
  });

  it('the gap can be changed, and a gap inside the window still counts as together', () => {
    const events = ons({ hands: 'apart', handGapMs: 120 });
    expect(events[1]!.atMs - events[0]!.atMs).toBe(120);
    expect(finish({ hands: 'apart', handGapMs: 120 }).result.bothHands.together).toBe(8);
  });

  it('either hand can go first, in both modes', () => {
    expect(ons({ hands: 'apart' }).slice(0, 2).map((e) => e.midi)).toEqual([48, 60]); // left first is the default
    expect(ons({ hands: 'apart', handOrder: 'right-first' }).slice(0, 2).map((e) => e.midi)).toEqual([60, 48]);
    expect(ons({ hands: 'together', handOrder: 'right-first' }).slice(0, 2).map((e) => e.midi)).toEqual([60, 48]);
    expect(finish({ hands: 'apart', handOrder: 'right-first' }).result.accuracy).toBe(1);
  });

  it('a one-hand piece is not changed by the option, and the same keys are pressed in either mode', () => {
    expect(composePerformance(chart, { hands: 'apart' })).toEqual(composePerformance(chart, { hands: 'together' }));
    expect(ons({ hands: 'apart' }).map((e) => e.midi).sort()).toEqual(ons({ hands: 'together' }).map((e) => e.midi).sort());
  });

  it('refuses a gap that would run into the next step, instead of making the next step look wrong', () => {
    expect(() => composePerformance(both, { hands: 'apart', handGapMs: 5000 })).toThrow(/gap/i);
    expect(() => composePerformance(both, { hands: 'apart', tempoScale: 4 })).toThrow(/gap/i);
  });

  it('a wrong key between the hands is judged as a mistake and the piece still finishes', () => {
    const { result } = finish({ hands: 'apart', mistakes: [{ stepIndex: 2, kind: 'neighbour-key' }] });
    expect(result.mistakes).toBe(1);
    expect(result.bothHands).toEqual({ notes: 8, together: 0 });
  });
});

describe('wrongKeyFor', () => {
  it('always gives a key that is wrong, of the requested kind, and on the keyboard', () => {
    for (const awaiting of [[36], [96], [60], [60, 64], [95]]) {
      for (const kind of ['wrong-octave', 'neighbour-key', 'wrong-letter'] as const) {
        for (let attempt = 0; attempt < 4; attempt++) {
          const key = wrongKeyFor(kind, awaiting, attempt);
          expect(awaiting).not.toContain(key);
          expect(key).toBeGreaterThanOrEqual(36);
          expect(key).toBeLessThanOrEqual(96);
        }
      }
    }
  });

  it('throws when no such key exists', () => {
    expect(() => wrongKeyFor('wrong-octave', [36 + 24], 0)).not.toThrow();
    expect(() => wrongKeyFor('wrong-octave', [], 0)).toThrow();
  });
});

describe('playThroughDevice and ScriptedKeyboard', () => {
  it('sends a performance through the virtual keyboard bytes on a manual scheduler', () => {
    const device = new VirtualEz220();
    const got: number[][] = [];
    device.input.onmidimessage = (e) => got.push([...e.data!]);
    const scheduler = new ManualScheduler();
    playThroughDevice(device, composePerformance(chart), scheduler);
    expect(got).toEqual([]);
    scheduler.runAll();
    expect(got).toHaveLength(22);
    expect(got[0]).toEqual([0x90, 60, 80]);
  });

  it('does not send while the keyboard is unplugged', () => {
    const device = new VirtualEz220();
    const got: number[][] = [];
    device.input.onmidimessage = (e) => got.push([...e.data!]);
    const scheduler = new ManualScheduler();
    playThroughDevice(device, composePerformance(chart), scheduler);
    scheduler.advance(1000);
    const before = got.length;
    device.disconnect();
    scheduler.runAll();
    expect(got).toHaveLength(before);
  });

  it('ScriptedKeyboard emits step by step, flushes, and schedules', () => {
    const script = composePerformance(chart);
    const keyboard = new ScriptedKeyboard(script);
    const got: NoteEvent[] = [];
    keyboard.onNote((e) => got.push(e));
    expect(keyboard.remaining).toBe(22);
    expect(keyboard.step()).toBe(true);
    expect(got[0]).toMatchObject({ kind: 'on', midi: 60, source: 'replay' });
    keyboard.flush();
    expect(got).toHaveLength(22);
    expect(keyboard.step()).toBe(false);

    const timed = new ScriptedKeyboard(script, 'virtual-player');
    const scheduler = new ManualScheduler();
    const timedGot: NoteEvent[] = [];
    timed.onNote((e) => timedGot.push(e));
    timed.start(scheduler);
    scheduler.advance(1000);
    expect(timedGot.length).toBeGreaterThan(0);
    expect(timedGot.length).toBeLessThan(22);
    expect(timedGot[0]!.source).toBe('virtual-player');
    expect(timed.getStatus().state).toBe('connected');
    timed.dispose();
    scheduler.runAll();
    expect(timedGot.length).toBeLessThan(22);
  });
});

describe('ManualScheduler', () => {
  it('runs tasks in time order, ties in insertion order, and tracks time', () => {
    const scheduler = new ManualScheduler();
    const order: string[] = [];
    scheduler.at(20, () => order.push('c'));
    scheduler.at(10, () => order.push('a'));
    scheduler.at(10, () => order.push('b'));
    expect(scheduler.pending).toBe(3);
    scheduler.advance(15);
    expect(order).toEqual(['a', 'b']);
    expect(scheduler.now).toBe(15);
    scheduler.runAll();
    expect(order).toEqual(['a', 'b', 'c']);
    expect(scheduler.now).toBe(20);
  });

  it('runs tasks that schedule more tasks', () => {
    const scheduler = new ManualScheduler();
    const order: number[] = [];
    scheduler.at(5, () => {
      order.push(1);
      scheduler.at(5, () => order.push(2));
    });
    scheduler.runAll();
    expect(order).toEqual([1, 2]);
    expect(scheduler.now).toBe(10);
  });
});

describe('composePerformance: how long keys are held (core_01 slice f)', () => {
  const values = chartWith([
    { tick: 0, dur: 1920, midi: 48, track: 'lh' }, { tick: 0, dur: 480, midi: 60 }, { tick: 480, dur: 960, midi: 62, tieNext: true },
    { tick: 1440, dur: 480, midi: 62 }, { tick: 1920, dur: 120, midi: 64 },
  ]);
  const holds = (events: readonly { atMs: number; kind: string; midi: number }[]) => {
    const down = new Map<number, number>();
    const out: [number, number][] = [];
    for (const e of events) {
      if (e.kind === 'on') down.set(e.midi, e.atMs);
      else out.push([e.midi, e.atMs - down.get(e.midi)!]);
    }
    return out;
  };

  it('core_01.AC6: by default each key is held its own value (a tie chain as one) less a short gap', () => {
    // 120 bpm: whole 2000, quarter 500, the tied pair 1500, a sixteenth 125 ms
    expect(holds(composePerformance(values, { chordSpreadMs: 0 })).sort((a, b) => a[0] - b[0])).toEqual([[48, 1970], [60, 470], [62, 1470], [64, 112.5]]);
  });

  it('core_01.AC6: the default player is graded as holding every note in full', () => {
    const transport = new Transport(values, { countInBars: 0 });
    const mode = new TempoMode(values, transport);
    transport.start(0);
    for (const e of composePerformance(values)) mode.handle({ kind: e.kind, midi: e.midi, velocity: e.velocity, timeMs: e.atMs, source: 'test' });
    mode.advance(1e6);
    expect(mode.getState().timings!.filter((t) => t !== null).every((t) => t.hold === 100)).toBe(true);
  });

  it('holdMs holds every key exactly that long: a scripted tap', () => {
    expect(holds(composePerformance(values, { holdMs: 40, chordSpreadMs: 0 })).every(([, ms]) => ms === 40)).toBe(true);
  });
});

describe('composePerformance: a repeated key goes up before it is pressed again', () => {
  const repeated = chartWith(Array.from({ length: 8 }, (_, i) => ({ tick: i * 480, dur: 480, midi: 60 })));

  it('never sends a second note-on before the key went up, whatever the jitter', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 1e6 }), fc.integer({ min: 0, max: 120 }), (seed, jitterMs) => {
      let down = false;
      for (const e of composePerformance(repeated, { seed, jitterMs })) {
        if (e.kind === 'on' && down) return false;
        down = e.kind === 'on';
      }
      return true;
    }));
  });

  it('core_01.AC6: with a little jitter the default player still holds every repeated note in full', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 1e6 }), (seed) => {
      const transport = new Transport(repeated, { countInBars: 0 });
      const mode = new TempoMode(repeated, transport);
      transport.start(0);
      for (const e of composePerformance(repeated, { seed, jitterMs: 20 })) mode.handle({ kind: e.kind, midi: e.midi, velocity: e.velocity, timeMs: e.atMs, source: 'test' });
      mode.advance(1e6);
      return mode.getState().timings!.every((t) => t !== null && t.hold === 100);
    }));
  });
});
