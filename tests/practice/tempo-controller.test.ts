// Covers core_01.AC3, core_01.AC7.
import { describe, expect, it } from 'vitest';
import littleSteps from '../fixtures/charts/little-steps.v2.json';
import { chartSchema } from '../../src/core/chart';
import { TempoMode, type NoteEvent, type NoteJudged, type PieceResult, type PlayState } from '../../src/core/judge';
import { Transport } from '../../src/core/transport';
import { PracticeController } from '../../src/game/practice/PracticeController';
import type { KeyboardInput } from '../../src/io/keyboard';

const chart = chartSchema.parse(littleSteps);

/** A keyboard the test presses by hand, on a clock the test sets. */
class HandKeyboard implements KeyboardInput {
  readonly id = 'hand';
  private listeners = new Set<(e: NoteEvent) => void>();
  getStatus() { return { state: 'connected' as const, name: 'test' }; }
  onNote(listener: (e: NoteEvent) => void) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  onStatus() { return () => undefined; }
  dispose() { this.listeners.clear(); }
  press(midi: number, timeMs: number) {
    for (const l of this.listeners) l({ kind: 'on', midi, velocity: 80, timeMs, source: 'test' });
  }
}

function setup() {
  const keyboard = new HandKeyboard();
  const transport = new Transport(chart);
  const judged: NoteJudged[] = [];
  const states: PlayState[] = [];
  const completed: PieceResult[] = [];
  const controller = new PracticeController(
    chart, keyboard,
    { onChange: (s) => states.push(s), onJudged: (e) => judged.push(e), onCompleted: (r) => completed.push(r) },
    undefined, new TempoMode(chart, transport),
  );
  return { keyboard, transport, controller, judged, states, completed };
}

describe('PracticeController with Tempo mode', () => {
  it('starts on the first key, judges the notes on time and completes with timing statistics', () => {
    const { keyboard, transport, controller, judged, completed } = setup();
    keyboard.press(60, 0); // the starting key
    expect(transport.started).toBe(true);
    expect(judged).toHaveLength(0);
    chart.notes.forEach((n) => keyboard.press(n.midi, transport.timeOfTick(n.tick)!));
    expect(judged).toHaveLength(11);
    // the last note is still held (no key goes up here): the piece waits for its hold (core_01.AC7)
    expect(completed).toHaveLength(0);
    controller.advance(transport.endMs!);
    expect(completed).toHaveLength(1);
    expect(completed[0]!.timing).toMatchObject({ played: 11, missed: 0, score: 100, holds: { full: 11, short: 0 } });
    expect(controller.getState().done).toBe(true);
  });

  it('closes missed notes when the scene advances the clock, and reports the piece once', () => {
    const { keyboard, transport, controller, states, completed } = setup();
    keyboard.press(60, 0);
    const before = states.length;
    controller.advance(transport.timeOfTick(0)! - 1000); // nothing is over yet: no callback
    expect(states).toHaveLength(before);
    controller.advance(transport.timeOfTick(chart.notes.at(-1)!.tick)! + 5000);
    expect(completed).toHaveLength(1);
    expect(completed[0]).toMatchObject({ accuracy: 0, timing: { played: 0, missed: 11, score: 0 } });
    controller.advance(1e9);
    expect(completed).toHaveLength(1);
    expect(controller.getState().noteProgress.every((p) => p === 'missed')).toBe(true);
  });

  it('advance does nothing for Wait mode and after dispose', () => {
    const keyboard = new HandKeyboard();
    const completed: PieceResult[] = [];
    const wait = new PracticeController(chart, keyboard, { onChange: () => undefined, onJudged: () => undefined, onCompleted: (r) => completed.push(r) });
    wait.advance(1e9);
    expect(wait.getState().stepIndex).toBe(0);
    const { controller, transport, keyboard: k2 } = setup();
    k2.press(60, 0);
    controller.dispose();
    controller.advance(transport.timeOfTick(0)! + 1e6);
    expect(controller.getState().stepIndex).toBe(0);
  });
});
