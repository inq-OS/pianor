import { describe, expect, it } from 'vitest';
import { playStateOf } from './playState';
import type { NoteProgress } from './types';

const steps = [{ noteIndices: [0, 1] }, { noteIndices: [2] }];
const progress: NoteProgress[] = ['pending', 'pending', 'pending'];

describe('playStateOf', () => {
  it('reports the step, what is still awaited, and the held keys', () => {
    const state = playStateOf({
      stepIndex: 0,
      steps,
      pressed: new Set([1]),
      progress,
      held: new Set([60, 62]),
      lastJudged: null,
    });
    expect(state.done).toBe(false);
    expect(state.stepIndex).toBe(0);
    expect(state.stepCount).toBe(2);
    expect(state.awaiting).toEqual([0]);
    expect(state.heldKeys).toEqual([60, 62]);
    expect(state.noteProgress).toHaveLength(3);
  });

  it('is done with nothing awaited once the step index passes the last step', () => {
    const state = playStateOf({ stepIndex: 2, steps, pressed: new Set(), progress, held: new Set(), lastJudged: null });
    expect(state.done).toBe(true);
    expect(state.awaiting).toEqual([]);
  });

  it('includes timings only when given (Tempo mode), so Wait mode has no timings key', () => {
    const base = { stepIndex: 0, steps, pressed: new Set<number>(), progress, held: new Set<number>(), lastJudged: null };
    expect(playStateOf(base)).not.toHaveProperty('timings');
    expect(playStateOf({ ...base, timings: [null, null, null] }).timings).toEqual([null, null, null]);
  });

  it('returns copies, so changing the result cannot change the judge', () => {
    const held = new Set([60]);
    const state = playStateOf({ stepIndex: 0, steps, pressed: new Set(), progress, held, lastJudged: null });
    held.add(61);
    progress[0] = 'correct';
    expect(state.heldKeys).toEqual([60]);
    expect(state.noteProgress[0]).toBe('pending');
  });
});
