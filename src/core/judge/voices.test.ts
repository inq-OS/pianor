// Two voices in one hand in Wait and Tempo mode (core_09.AC54, d164).
import { describe, expect, it } from 'vitest';
import type { Chart } from '../chart';
import { compilePiece } from '../piece/compile';
import { Transport } from '../transport';
import { buildSteps } from './steps';
import { TempoMode } from './tempo';
import type { JudgeEvent, NoteEvent, NoteJudged } from './types';
import { WaitMode } from './wait';

const META = JSON.stringify({ id: 'two', title: 'Two', level: 5, status: 'draft', hands: ['RH'], phrases: [], source: 'test', license: 'CC0-1.0', generator: { kind: 'hand' } });
/** 4/4 at 120 bpm: a quarter is 500 ms. */
const chartOf = (body: string): Chart => compilePiece({ abc: `X:1\nT:Two\nM:4/4\nL:1/4\nQ:1/4=120\nK:C\n${body}`, meta: META }).chart!;
const on = (midi: number, timeMs: number): NoteEvent => ({ kind: 'on', midi, velocity: 80, timeMs, source: 'test' });
const off = (midi: number, timeMs: number): NoteEvent => ({ kind: 'off', midi, velocity: 0, timeMs, source: 'test' });
const judged = (events: JudgeEvent[]) => events.filter((e): e is NoteJudged => e.type === 'NoteJudged');

// voice 1 holds C5 for the bar while voice 2 moves from E4 to F4
const held = chartOf('c4 & E2 F2 |]');
const C5 = 72;
const E4 = 64;
const F4 = 65;
const indexOf = (chart: Chart, midi: number) => chart.notes.findIndex((n) => n.midi === midi);

describe('two voices in Wait mode (core_09.AC54)', () => {
  it('core_09.AC54 every note of both voices that starts on a tick is one step, like a chord', () => {
    const steps = buildSteps(held);
    expect(steps.map((s) => s.noteIndices.map((i) => held.notes[i]!.midi).sort())).toEqual([[E4, C5], [F4]]);
  });

  it('core_09.AC54 a voice-1 key still held while voice 2 moves on is neither wrong nor a release', () => {
    const mode = new WaitMode(held);
    const events = [on(C5, 0), on(E4, 10), off(E4, 990), on(F4, 1000), off(F4, 1990), off(C5, 2000)].flatMap((e) => mode.handle(e));
    expect(judged(events).map((e) => e.verdict)).toEqual(['correct', 'correct', 'correct']);
    expect(events.at(-1)?.type).not.toBe('NoteJudged');
    expect(events.some((e) => e.type === 'PieceCompleted')).toBe(true);
  });
});

describe('two voices in Tempo mode (core_09.AC54)', () => {
  const start = () => {
    const transport = new Transport(held, { countInBars: 0 });
    const mode = new TempoMode(held, transport);
    transport.start(0);
    return mode;
  };

  it('core_09.AC54 each note is held for its own length: the long voice-1 note to the end of the bar, voice 2 to its own end', () => {
    const mode = start();
    for (const e of [on(C5, 0), on(E4, 0), off(E4, 990), on(F4, 1000), off(F4, 1990), off(C5, 1990)]) mode.handle(e);
    const timings = mode.getState().timings!;
    expect([C5, E4, F4].map((m) => timings[indexOf(held, m)]?.hold)).toEqual([100, 100, 100]);
  });

  it('core_09.AC54 letting go of the long voice-1 note early lowers its hold only, never the moving voice', () => {
    const mode = start();
    for (const e of [on(C5, 0), on(E4, 0), off(C5, 960), off(E4, 990), on(F4, 1000), off(F4, 1990)]) mode.handle(e);
    const timings = mode.getState().timings!;
    expect(timings[indexOf(held, C5)]!.hold).toBe(50);
    expect([E4, F4].map((m) => timings[indexOf(held, m)]?.hold)).toEqual([100, 100]);
  });
});
