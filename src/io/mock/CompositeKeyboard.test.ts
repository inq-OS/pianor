// Covers ft_0_06.AC3.
import { describe, expect, it } from 'vitest';
import type { NoteEvent } from '../../core/judge/types';
import { Emitter } from '../emitter';
import type { KeyboardInput, KeyboardStatus } from '../keyboard';
import { CompositeKeyboard } from './CompositeKeyboard';

class Fake implements KeyboardInput {
  readonly notes = new Emitter<NoteEvent>();
  readonly statuses = new Emitter<KeyboardStatus>();
  disposed = false;
  constructor(readonly id: string, public status: KeyboardStatus) {}
  getStatus() {
    return this.status;
  }
  onNote(l: (e: NoteEvent) => void) {
    return this.notes.on(l);
  }
  onStatus(l: (s: KeyboardStatus) => void) {
    return this.statuses.on(l);
  }
  dispose() {
    this.disposed = true;
  }
  setStatus(s: KeyboardStatus) {
    this.status = s;
    this.statuses.emit(s);
  }
}

const note = (midi: number): NoteEvent => ({ kind: 'on', midi, velocity: 80, timeMs: 0, source: 'fake' });

describe('CompositeKeyboard', () => {
  it('merges note events from all inputs', () => {
    const a = new Fake('a', { state: 'connected', name: 'A' });
    const b = new Fake('b', { state: 'connected', name: 'B' });
    const composite = new CompositeKeyboard([a, b]);
    const got: number[] = [];
    composite.onNote((e) => got.push(e.midi));
    a.notes.emit(note(60));
    b.notes.emit(note(62));
    expect(got).toEqual([60, 62]);
  });

  it('is connected when any input is, named after the first connected one, and reports changes once', () => {
    const real = new Fake('real', { state: 'disconnected', name: null });
    const screen = new Fake('screen', { state: 'connected', name: 'On-screen keyboard' });
    const composite = new CompositeKeyboard([real, screen]);
    const seen: KeyboardStatus[] = [];
    composite.onStatus((s) => seen.push(s));
    expect(composite.getStatus()).toEqual({ state: 'connected', name: 'On-screen keyboard' });
    real.setStatus({ state: 'connected', name: 'EZ-220' });
    expect(composite.getStatus().name).toBe('EZ-220');
    real.setStatus({ state: 'connected', name: 'EZ-220' }); // no change
    expect(seen).toEqual([{ state: 'connected', name: 'EZ-220' }]);
  });

  it('is disconnected when none is', () => {
    const a = new Fake('a', { state: 'disconnected', name: null });
    const composite = new CompositeKeyboard([a]);
    expect(composite.getStatus()).toEqual({ state: 'disconnected', name: null });
    expect(new CompositeKeyboard([]).getStatus().state).toBe('disconnected');
  });

  it('picks up an input added later, with its notes and its status', () => {
    const screen = new Fake('screen', { state: 'connected', name: 'On-screen keyboard' });
    const composite = new CompositeKeyboard([screen]);
    const statuses: KeyboardStatus[] = [];
    composite.onStatus((s) => statuses.push(s));
    const got: number[] = [];
    composite.onNote((e) => got.push(e.midi));
    const midi = new Fake('midi', { state: 'connected', name: 'EZ-220' });
    composite.add(midi);
    midi.notes.emit(note(60));
    expect(got).toEqual([60]);
    expect(composite.getStatus().name).toBe('On-screen keyboard'); // first connected input wins
    expect(statuses).toEqual([]);
    screen.setStatus({ state: 'disconnected', name: null });
    expect(composite.getStatus().name).toBe('EZ-220');
  });

  it('disposes the inputs and stops forwarding', () => {
    const a = new Fake('a', { state: 'connected', name: 'A' });
    const composite = new CompositeKeyboard([a]);
    const got: number[] = [];
    composite.onNote((e) => got.push(e.midi));
    composite.dispose();
    a.notes.emit(note(60));
    expect(a.disposed).toBe(true);
    expect(got).toEqual([]);
  });
});
