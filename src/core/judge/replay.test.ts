import { describe, expect, it } from 'vitest';
import littleSteps from '../../../tests/fixtures/charts/little-steps.v2.json';
import { chartSchema } from '../chart';
import { replayKeys } from './replay';
import type { NoteEvent } from './types';
import { WaitMode } from './wait';

const chart = chartSchema.parse(littleSteps);
const on = (midi: number, timeMs: number): NoteEvent => ({ kind: 'on', midi, velocity: 80, timeMs, source: 'test' });
const off = (midi: number, timeMs: number): NoteEvent => ({ kind: 'off', midi, velocity: 0, timeMs, source: 'test' });

describe('replayKeys: a pass picked up again after leaving the screen', () => {
  const keys = [on(60, 0), off(60, 200), on(61, 900), off(61, 1000), on(62, 1000), off(62, 1200), on(64, 2000)];

  it('a fresh Wait mode given the same keys stands on the same step with the same progress', () => {
    const before = new WaitMode(chart);
    for (const key of keys) before.handle(key);
    const after = new WaitMode(chart);
    expect(replayKeys(after, keys, 50_000)).toBe(true);
    expect(after.getState().stepIndex).toBe(before.getState().stepIndex);
    expect(after.getState().noteProgress).toEqual(before.getState().noteProgress);
  });

  it('keeps no key held, and the next key is timed from the moment it came back, not from before', () => {
    const mode = new WaitMode(chart);
    replayKeys(mode, keys, 50_000);
    expect(mode.getState().heldKeys).toEqual([]);
    const [judged] = mode.handle(on(65, 50_000 + 857));
    expect(judged).toMatchObject({ verdict: 'correct' });
    expect(Math.abs((judged as { intervalErrorMs: number }).intervalErrorMs)).toBeLessThan(100);
  });

  it('refuses keys that would finish the piece: that pass is over and is not picked up', () => {
    const all = chart.notes.map((n, i) => on(n.midi, i * 500));
    expect(replayKeys(new WaitMode(chart), all, 50_000)).toBe(false);
  });
});
