// Covers core_09.AC51: the judge plays triplets on their 160-tick spacing, in Wait and Tempo mode.
import { describe, expect, it } from 'vitest';
import { chartWith } from '../../../tests/helpers/charts';
import { Transport } from '../transport';
import { TempoMode } from './tempo';
import { WaitMode } from './wait';
import type { CorrectNoteJudged, JudgeEvent, NoteEvent, NoteJudged, PieceCompleted } from './types';

const on = (midi: number, timeMs: number): NoteEvent => ({ kind: 'on', midi, velocity: 80, timeMs, source: 'test' });
const off = (midi: number, timeMs: number): NoteEvent => ({ kind: 'off', midi, velocity: 0, timeMs, source: 'test' });
const judged = (events: JudgeEvent[]) => events.filter((e): e is NoteJudged => e.type === 'NoteJudged');
const rights = (events: JudgeEvent[]) => judged(events).filter((e): e is CorrectNoteJudged => e.verdict === 'correct');
const piece = (events: JudgeEvent[]) => events.find((e): e is PieceCompleted => e.type === 'PieceCompleted');

// 4/4 at 120 bpm (a quarter is 500 ms): an eighth triplet C D E on beat 1, F quarter, then a quarter triplet G A B, all one bar.
const T = 160;
const Q3 = 320;
const triplets = chartWith(
  [
    { tick: 0, dur: T, midi: 60 }, { tick: T, dur: T, midi: 62 }, { tick: 2 * T, dur: T, midi: 64 }, { tick: 480, dur: 480, midi: 65 },
    { tick: 960, dur: Q3, midi: 67 }, { tick: 960 + Q3, dur: Q3, midi: 69 }, { tick: 960 + 2 * Q3, dur: Q3, midi: 71 },
  ],
  {
    tuplets: [
      { track: 'rh', voice: 1, startTick: 0, endTick: 2 * T, actual: 3, normal: 2 },
      { track: 'rh', voice: 1, startTick: 960, endTick: 960 + 2 * Q3, actual: 3, normal: 2 },
    ],
  },
);

describe('triplets in the judge (core_09.AC51)', () => {
  it('core_09.AC51 Wait mode waits for each note of a triplet in order and completes the piece', () => {
    const mode = new WaitMode(triplets);
    const events = triplets.notes.flatMap((n, i) => [...mode.handle(on(n.midi, 700 * i)), ...mode.handle(off(n.midi, 700 * i + 100))]);
    expect(rights(events)).toHaveLength(7);
    expect(judged(events).every((e) => e.verdict === 'correct')).toBe(true);
    expect(piece(events)).toBeDefined();
  });

  it('core_09.AC51 Wait mode refuses the second note of a triplet before the first', () => {
    const wrong = judged(new WaitMode(triplets).handle(on(62, 0)));
    expect(wrong).toHaveLength(1);
    expect(wrong[0]!.verdict).toBe('wrong');
  });

  it('core_09.AC51 Tempo mode expects triplet eighths 166.7 ms apart and triplet quarters 333.3 ms apart, each on time when played so', () => {
    const transport = new Transport(triplets, { countInBars: 0 });
    const mode = new TempoMode(triplets, transport);
    transport.start(0);
    expect(transport.timeOfTick(T)).toBeCloseTo(500 / 3, 6);
    expect(transport.timeOfTick(960 + Q3)).toBeCloseTo(1000 + 1000 / 3, 6);
    for (const n of triplets.notes) {
      const at = transport.timeOfTick(n.tick)!;
      mode.handle(on(n.midi, at));
      mode.handle(off(n.midi, at + ((n.dur * 500) / 480) * 0.97));
    }
    const timings = mode.getState().timings!;
    expect(timings).toHaveLength(7);
    expect(timings.every((t) => t?.verdict === 'on-time')).toBe(true);
  });
});
