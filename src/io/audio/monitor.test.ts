import { describe, expect, it } from 'vitest';
import type { NoteEvent } from '../../core/judge/types';
import type { PianoSound } from '../audio';
import { Emitter } from '../emitter';
import type { KeyboardInput, KeyboardStatus } from '../keyboard';
import { monitorKeyboard } from './monitor';

class FakeKeyboard implements KeyboardInput {
  readonly id = 'fake';
  readonly notes = new Emitter<NoteEvent>();
  getStatus(): KeyboardStatus { return { state: 'connected', name: null }; }
  onNote(l: (e: NoteEvent) => void) { return this.notes.on(l); }
  onStatus() { return () => undefined; }
  dispose() { this.notes.clear(); }
  play(source: string, kind: 'on' | 'off', midi = 60, velocity = 80) { this.notes.emit({ kind, midi, velocity: kind === 'on' ? velocity : 0, timeMs: 0, source }); }
}

function fakePiano() {
  const calls: string[] = [];
  const piano: PianoSound = {
    loaded: true, ready: Promise.resolve(), failed: 0,
    noteOn: (m, v) => void calls.push(`on ${m} ${v}`),
    noteOff: (m) => void calls.push(`off ${m}`),
    allNotesOff: () => undefined,
    setVolume: () => undefined,
    sound: 'full',
    setSound: () => Promise.resolve(),
  };
  return { piano, calls };
}

describe('monitorKeyboard', () => {
  it('sounds on-screen and computer keys', () => {
    const keyboard = new FakeKeyboard();
    const { piano, calls } = fakePiano();
    monitorKeyboard(keyboard, piano, { monitorMidi: false });
    keyboard.play('on-screen', 'on', 60, 90);
    keyboard.play('on-screen', 'off');
    keyboard.play('qwerty', 'on', 64);
    expect(calls).toEqual(['on 60 90', 'off 60', 'on 64 80']);
  });

  it('stays quiet for real MIDI by default: the keyboard sounds itself', () => {
    const keyboard = new FakeKeyboard();
    const { piano, calls } = fakePiano();
    monitorKeyboard(keyboard, piano, { monitorMidi: false });
    keyboard.play('midi', 'on');
    keyboard.play('midi', 'off');
    expect(calls).toEqual([]);
  });

  it('sounds real or virtual MIDI when asked', () => {
    const keyboard = new FakeKeyboard();
    const { piano, calls } = fakePiano();
    monitorKeyboard(keyboard, piano, { monitorMidi: true });
    keyboard.play('midi', 'on', 62);
    keyboard.play('midi', 'off', 62);
    expect(calls).toEqual(['on 62 80', 'off 62']);
  });

  it('stops when unsubscribed', () => {
    const keyboard = new FakeKeyboard();
    const { piano, calls } = fakePiano();
    const stop = monitorKeyboard(keyboard, piano, { monitorMidi: true });
    stop();
    keyboard.play('qwerty', 'on');
    expect(calls).toEqual([]);
  });
});
