// Covers ft_0_06.AC1.
import { describe, expect, it } from 'vitest';
import littleSteps from '../../tests/fixtures/charts/little-steps.v2.json';
import { chartSchema } from '../../src/core/chart';
import { WaitMode, type JudgeEvent, type NoteEvent } from '../../src/core/judge';
import { WebMidiKeyboard } from '../../src/io/midi/WebMidiKeyboard';
import { composePerformance, playThroughDevice } from '../../src/io/mock/performance';
import { ManualScheduler } from '../../src/io/mock/scheduler';
import { ScriptedKeyboard } from '../../src/io/mock/ScriptedKeyboard';
import { VirtualEz220 } from '../../src/io/mock/VirtualEz220';

const chart = chartSchema.parse(littleSteps);

/** Wire an input to a Wait mode, the way the Practice scene will. */
function wire(keyboard: { onNote(l: (e: NoteEvent) => void): unknown }) {
  const mode = new WaitMode(chart);
  const events: JudgeEvent[] = [];
  keyboard.onNote((e) => events.push(...mode.handle(e)));
  return { mode, events };
}

describe('the whole input path without an EZ-220', () => {
  it('virtual player -> virtual EZ-220 bytes -> Web MIDI wrapper -> judge: a full piece with mistakes', async () => {
    const device = new VirtualEz220();
    const keyboard = await WebMidiKeyboard.create({ requestAccess: () => Promise.resolve(device.access) });
    const { mode, events } = wire(keyboard);
    const scheduler = new ManualScheduler();
    playThroughDevice(device, composePerformance(chart, {
      tempoScale: 1.5, jitterMs: 25, latencyMs: 12, velocityJitter: 15, seed: 11,
      mistakes: [{ stepIndex: 2, kind: 'neighbour-key' }, { stepIndex: 6, kind: 'wrong-octave', count: 2 }],
    }), scheduler);
    scheduler.runAll();

    expect(mode.getState().done).toBe(true);
    const piece = events.find((e) => e.type === 'PieceCompleted');
    expect(piece).toMatchObject({ result: { notes: 11, mistakes: 3, firstTryCorrect: 9 } });
    expect(events.filter((e) => e.type === 'BarCompleted')).toHaveLength(4);
    keyboard.dispose();
  });

  it('a replay through the scripted keyboard gives the same piece result as through the MIDI bytes', async () => {
    const script = composePerformance(chart, { seed: 5, mistakes: [{ stepIndex: 1, kind: 'wrong-letter' }] });

    const scripted = new ScriptedKeyboard(script);
    const a = wire(scripted);
    scripted.flush();

    const device = new VirtualEz220();
    const keyboard = await WebMidiKeyboard.create({ requestAccess: () => Promise.resolve(device.access) });
    const b = wire(keyboard);
    const scheduler = new ManualScheduler();
    playThroughDevice(device, script, scheduler);
    scheduler.runAll();

    const result = (events: JudgeEvent[]) => events.find((e) => e.type === 'PieceCompleted');
    expect(result(a.events)).toEqual(result(b.events));
  });

  it('unplugging the keyboard mid-piece releases held keys and the piece can be finished after plugging back in', async () => {
    const device = new VirtualEz220();
    const keyboard = await WebMidiKeyboard.create({ requestAccess: () => Promise.resolve(device.access) });
    const { mode, events } = wire(keyboard);

    for (const [i, n] of chart.notes.slice(0, 4).entries()) {
      device.press(n.midi, 80, i * 900);
      if (i < 3) device.release(n.midi, i * 900 + 300);
    }
    // Last key still held when the cable is pulled.
    expect(mode.getState().heldKeys).toEqual([65]);
    device.disconnect();
    expect(keyboard.getStatus().state).toBe('disconnected');
    expect(mode.getState().heldKeys).toEqual([]); // judge saw the synthetic release
    expect(mode.getState().stepIndex).toBe(4); // progress kept

    device.connect();
    for (const [i, n] of chart.notes.slice(4).entries()) {
      device.press(n.midi, 80, 10000 + i * 900);
      device.release(n.midi, 10000 + i * 900 + 300);
    }
    expect(mode.getState().done).toBe(true);
    expect(events.at(-1)!.type).toBe('PieceCompleted');
    keyboard.dispose();
  });

  it('a device that appears after the game started is picked up', async () => {
    const device = new VirtualEz220({ connected: false });
    const keyboard = await WebMidiKeyboard.create({ requestAccess: () => Promise.resolve(device.access) });
    const { mode } = wire(keyboard);
    expect(keyboard.getStatus().state).toBe('disconnected');
    device.connect();
    device.press(60, 80, 1);
    expect(mode.getState().stepIndex).toBe(1);
    keyboard.dispose();
  });
});
