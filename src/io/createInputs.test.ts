import { describe, expect, it } from 'vitest';
import type { NoteEvent } from '../core/judge/types';
import { fakeDocument } from '../../tests/helpers/fakeDom';
import { createKeyboardInputs } from './createInputs';

function inputs(virtual: boolean) {
  const parent = fakeDocument().createElement();
  const keyListeners = new Map<string, unknown[]>();
  const keyTarget = {
    addEventListener: (type: string, l: unknown) => keyListeners.set(type, [...(keyListeners.get(type) ?? []), l]),
    removeEventListener: (type: string, l: unknown) => keyListeners.set(type, (keyListeners.get(type) ?? []).filter((x) => x !== l)),
  };
  const created = createKeyboardInputs({ virtual, parent: parent as unknown as HTMLElement, keyTarget: keyTarget as unknown as Window, now: () => 5 });
  const notes: NoteEvent[] = [];
  created.keyboard.onNote((e) => notes.push(e));
  return { created, parent, keyListeners, notes };
}

describe('createKeyboardInputs', () => {
  it('is playable at once with the on-screen and computer keyboards, before MIDI is ready', () => {
    const { created, parent, keyListeners } = inputs(false);
    expect(parent.children).toHaveLength(1);
    expect(created.lights).toBe(created.onScreen);
    expect(created.midi).toBeNull();
    expect(keyListeners.get('keydown')).toHaveLength(1);
  });

  it('without Web MIDI (as in Node) reports "unsupported" as a status and keeps the other inputs', async () => {
    const { created } = inputs(false);
    await expect(created.ready).resolves.toBeUndefined();
    expect(created.midi).toBeNull();
    expect(created.midiProblem).toBe('unsupported');
    expect(created.virtualDevice).toBeNull();
  });

  it('with the virtual EZ-220 opens it as MIDI and merges its keys into the one keyboard', async () => {
    const { created, notes } = inputs(true);
    await created.ready;
    expect(created.midiProblem).toBeNull();
    expect(created.midi).not.toBeNull();
    created.virtualDevice!.press(60);
    expect(notes.map((n) => [n.kind, n.midi])).toEqual([['on', 60]]);
  });

  it('dispose removes the on-screen keyboard and stops listening to the computer keyboard', () => {
    const { created, parent, keyListeners } = inputs(false);
    created.dispose();
    expect(parent.children).toEqual([]);
    expect(keyListeners.get('keydown')).toEqual([]);
  });
});
