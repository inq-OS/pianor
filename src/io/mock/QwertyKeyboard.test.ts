import { describe, expect, it } from 'vitest';
import type { NoteEvent } from '../../core/judge/types';
import { QWERTY_OFFSETS, QwertyKeyboard, type KeyLike, type KeyTarget } from './QwertyKeyboard';

class FakeTarget implements KeyTarget {
  private handlers = new Map<string, Set<(e: KeyLike) => void>>();
  addEventListener(type: string, listener: (e: KeyLike) => void): void {
    this.handlers.set(type, (this.handlers.get(type) ?? new Set()).add(listener));
  }
  removeEventListener(type: string, listener: (e: KeyLike) => void): void {
    this.handlers.get(type)?.delete(listener);
  }
  fire(type: string, event: Partial<KeyLike> = {}): KeyLike {
    const full: KeyLike = { code: '', repeat: false, ...event };
    this.handlers.get(type)?.forEach((h) => h(full));
    return full;
  }
  listeners(): number {
    return [...this.handlers.values()].reduce((n, s) => n + s.size, 0);
  }
}

function setup(baseMidi?: number) {
  const target = new FakeTarget();
  const keyboard = new QwertyKeyboard(target, { now: () => 42, ...(baseMidi === undefined ? {} : { baseMidi }) });
  const events: NoteEvent[] = [];
  keyboard.onNote((e) => events.push(e));
  return { target, keyboard, events };
}

describe('QwertyKeyboard', () => {
  it('maps Z to middle C and plays a C-position scale on Z X C V B', () => {
    const { target, events } = setup();
    for (const code of ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB']) {
      target.fire('keydown', { code });
      target.fire('keyup', { code });
    }
    expect(events.filter((e) => e.kind === 'on').map((e) => e.midi)).toEqual([60, 62, 64, 65, 67]);
    expect(events.filter((e) => e.kind === 'off').map((e) => e.midi)).toEqual([60, 62, 64, 65, 67]);
    expect(events[0]).toMatchObject({ velocity: 80, timeMs: 42, source: 'qwerty' });
    expect(events[1]).toMatchObject({ kind: 'off', velocity: 0 });
  });

  it('has black keys on the S D G H J row and an upper octave on Q..', () => {
    const { target, events } = setup();
    for (const code of ['KeyS', 'KeyQ', 'Digit2']) target.fire('keydown', { code });
    expect(events.map((e) => e.midi)).toEqual([61, 72, 73]);
  });

  it('has a distinct note for every mapped key within an octave pair', () => {
    const lower = ['KeyZ', 'KeyS', 'KeyX', 'KeyD', 'KeyC', 'KeyV', 'KeyG', 'KeyB', 'KeyH', 'KeyN', 'KeyJ', 'KeyM'].map((c) => QWERTY_OFFSETS[c]);
    expect(lower).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });

  it('ignores key auto-repeat: a held key is one press', () => {
    const { target, events } = setup();
    target.fire('keydown', { code: 'KeyZ' });
    for (let i = 0; i < 5; i++) target.fire('keydown', { code: 'KeyZ', repeat: true });
    target.fire('keydown', { code: 'KeyZ' }); // repeat flag missing but still down
    expect(events).toHaveLength(1);
    target.fire('keyup', { code: 'KeyZ' });
    expect(events.map((e) => e.kind)).toEqual(['on', 'off']);
  });

  it('ignores keys with ctrl, meta or alt, typing targets, and unmapped keys', () => {
    const { target, events } = setup();
    target.fire('keydown', { code: 'KeyZ', ctrlKey: true });
    target.fire('keydown', { code: 'KeyZ', metaKey: true });
    target.fire('keydown', { code: 'KeyZ', altKey: true });
    target.fire('keydown', { code: 'KeyZ', target: { tagName: 'INPUT' } });
    target.fire('keydown', { code: 'KeyZ', target: { tagName: 'div', isContentEditable: true } });
    target.fire('keydown', { code: 'F5' });
    target.fire('keyup', { code: 'KeyZ' });
    expect(events).toEqual([]);
  });

  it('shifts octaves with the arrow keys, releasing held keys first, within the keyboard', () => {
    const { target, keyboard, events } = setup();
    target.fire('keydown', { code: 'KeyZ' });
    target.fire('keydown', { code: 'ArrowRight' });
    expect(events.map((e) => [e.kind, e.midi])).toEqual([['on', 60], ['off', 60]]);
    expect(keyboard.base).toBe(72);
    target.fire('keydown', { code: 'KeyZ' });
    expect(events.at(-1)).toMatchObject({ kind: 'on', midi: 72 });
    target.fire('keydown', { code: 'ArrowLeft', repeat: true }); // repeat ignored
    expect(keyboard.base).toBe(72);
    target.fire('keydown', { code: 'ArrowLeft' });
    target.fire('keydown', { code: 'ArrowLeft' });
    target.fire('keydown', { code: 'ArrowLeft' });
    expect(keyboard.base).toBe(36);
    target.fire('keydown', { code: 'ArrowLeft' }); // already at the bottom
    expect(keyboard.base).toBe(36);
    for (let i = 0; i < 10; i++) target.fire('keydown', { code: 'ArrowRight' });
    expect(keyboard.base).toBe(84);
  });

  it('releases a key with the note it started even if the octave changed meanwhile', () => {
    const { target, events } = setup();
    target.fire('keydown', { code: 'KeyC' });
    target.fire('keydown', { code: 'ArrowRight' });
    target.fire('keyup', { code: 'KeyC' });
    expect(events.filter((e) => e.kind === 'off')).toHaveLength(1);
  });

  it('does not play keys that would be off the keyboard', () => {
    const { target, events } = setup(84);
    target.fire('keydown', { code: 'KeyP' }); // 84 + 28 = 112, off the top
    target.fire('keydown', { code: 'KeyZ' }); // 84, fine
    expect(events.map((e) => e.midi)).toEqual([84]);
  });

  it('prevents the browser default for keys it uses', () => {
    const { target } = setup();
    let prevented = 0;
    const preventDefault = () => {
      prevented++;
    };
    target.fire('keydown', { code: 'Slash', preventDefault });
    target.fire('keydown', { code: 'ArrowLeft', preventDefault });
    target.fire('keydown', { code: 'F5', preventDefault });
    expect(prevented).toBe(2);
  });

  it('releases everything when the window loses focus', () => {
    const { target, events } = setup();
    target.fire('keydown', { code: 'KeyZ' });
    target.fire('keydown', { code: 'KeyX' });
    target.fire('blur');
    expect(events.filter((e) => e.kind === 'off').map((e) => e.midi)).toEqual([60, 62]);
  });

  it('removes its listeners on dispose, releasing keys', () => {
    const { target, keyboard, events } = setup();
    expect(target.listeners()).toBe(3);
    target.fire('keydown', { code: 'KeyZ' });
    keyboard.dispose();
    expect(target.listeners()).toBe(0);
    expect(events.map((e) => e.kind)).toEqual(['on', 'off']);
    expect(keyboard.getStatus()).toEqual({ state: 'connected', name: 'Computer keyboard' });
    expect(keyboard.onStatus(() => undefined)).toBeTypeOf('function');
  });
});
