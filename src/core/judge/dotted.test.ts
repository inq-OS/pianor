// Covers core_09.AC39 and core_09.AC43: the judge plays dotted quarters, dotted eighths and sixteenths on their own ticks, in Wait and Tempo mode.
import { describe, expect, it } from 'vitest';
import { chartWith } from '../../../tests/helpers/charts';
import { NOTE_TICKS } from '../chart';
import { Transport } from '../transport';
import { TempoMode } from './tempo';
import { WaitMode } from './wait';
import type { CorrectNoteJudged, JudgeEvent, NoteEvent, NoteJudged, PieceCompleted } from './types';

const on = (midi: number, timeMs: number): NoteEvent => ({ kind: 'on', midi, velocity: 80, timeMs, source: 'test' });
const off = (midi: number, timeMs: number): NoteEvent => ({ kind: 'off', midi, velocity: 0, timeMs, source: 'test' });
const judged = (events: JudgeEvent[]) => events.filter((e): e is NoteJudged => e.type === 'NoteJudged');
const rights = (events: JudgeEvent[]) => judged(events).filter((e): e is CorrectNoteJudged => e.verdict === 'correct');
const piece = (events: JudgeEvent[]) => events.find((e): e is PieceCompleted => e.type === 'PieceCompleted');

// 4/4 at 120 bpm (a quarter is 500 ms): G dotted quarter, A eighth, B half; then an eighth before a dotted quarter.
const DQ = NOTE_TICKS.dottedQuarter;
const E = NOTE_TICKS.eighth;
const dotted = chartWith([
  { tick: 0, dur: DQ, midi: 67 }, { tick: DQ, dur: E, midi: 69 }, { tick: 960, dur: 960, midi: 71 },
  { tick: 1920, dur: E, midi: 72 }, { tick: 1920 + E, dur: DQ, midi: 71 }, { tick: 2880, dur: 960, midi: 67 },
]);

describe('dotted quarter notes in the judge (core_09.AC39)', () => {
  it('core_09.AC39 Wait mode waits for each note of a dotted rhythm in order and completes the piece', () => {
    const mode = new WaitMode(dotted);
    const events = dotted.notes.flatMap((n, i) => [...mode.handle(on(n.midi, 1000 * i)), ...mode.handle(off(n.midi, 1000 * i + 100))]);
    expect(rights(events)).toHaveLength(6);
    expect(judged(events).every((e) => e.verdict === 'correct')).toBe(true);
    expect(piece(events)).toBeDefined();
  });

  it('core_09.AC39 Wait mode refuses the eighth before the dotted quarter it follows', () => {
    const mode = new WaitMode(dotted);
    const wrong = judged(mode.handle(on(69, 0)));
    expect(wrong).toHaveLength(1);
    expect(wrong[0]!.verdict).toBe('wrong');
  });

  it('core_09.AC39 Tempo mode expects the eighth after a dotted quarter at 750 ms and grades the dotted quarter held for its whole length', () => {
    const transport = new Transport(dotted, { countInBars: 0 });
    const mode = new TempoMode(dotted, transport);
    transport.start(0);
    expect(transport.timeOfTick(dotted.notes[1]!.tick)).toBeCloseTo(750, 6);
    expect(transport.timeOfTick(dotted.notes[4]!.tick)).toBeCloseTo(2250, 6);
    mode.handle(on(67, 0));
    mode.handle(off(67, 745));
    mode.handle(on(69, 750));
    mode.handle(off(69, 995));
    const [first, second] = mode.getState().timings!;
    expect(first).toMatchObject({ verdict: 'on-time', score: 100, hold: 100 });
    expect(second).toMatchObject({ verdict: 'on-time', pressScore: 100 });
  });
});

// 4/4 at 120 bpm: four sixteenths (62.5 ms apart), then a dotted eighth and a sixteenth, then a half.
const SX = NOTE_TICKS.sixteenth;
const DE = NOTE_TICKS.dottedEighth;
const fast = chartWith([
  { tick: 0, dur: SX, midi: 60 }, { tick: SX, dur: SX, midi: 62 }, { tick: 2 * SX, dur: SX, midi: 64 }, { tick: 3 * SX, dur: SX, midi: 65 },
  { tick: 480, dur: DE, midi: 67 }, { tick: 480 + DE, dur: SX, midi: 65 }, { tick: 960, dur: 960, midi: 64 },
]);

describe('sixteenths and dotted eighths in the judge (core_09.AC43)', () => {
  it('core_09.AC43 Wait mode waits for each sixteenth in order', () => {
    const mode = new WaitMode(fast);
    const events = fast.notes.flatMap((n, i) => [...mode.handle(on(n.midi, 500 * i)), ...mode.handle(off(n.midi, 500 * i + 50))]);
    expect(rights(events)).toHaveLength(7);
    expect(piece(events)).toBeDefined();
  });

  it('core_09.AC43 Tempo mode judges every sixteenth on time when each key comes on its own tick, 62.5 ms apart', () => {
    const transport = new Transport(fast, { countInBars: 0 });
    const mode = new TempoMode(fast, transport);
    transport.start(0);
    expect(transport.timeOfTick(fast.notes[5]!.tick)).toBeCloseTo(875, 6);
    for (const n of fast.notes) {
      const at = transport.timeOfTick(n.tick)!;
      mode.handle(on(n.midi, at));
      mode.handle(off(n.midi, at + (n.dur * 500 / 480) * 0.97));
    }
    const timings = mode.getState().timings!;
    expect(timings).toHaveLength(7);
    for (const t of timings) expect(t).toMatchObject({ verdict: 'on-time', pressScore: 100 });
  });
});
