import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DebugLog } from '../../core/debug/debugLog';
import type { NoteEvent } from '../../core/judge/types';
import type { KeyboardInput, KeyboardStatus } from '../keyboard';
import { DEBUG_FLUSH_MS, DEBUG_STORAGE_KEY, describe as describeThrown, keyName, startDebugCapture } from './debugCapture';

class FakeTarget {
  readonly handlers = new Map<string, Set<(e: Event) => void>>();
  addEventListener(type: string, listener: (e: Event) => void): void {
    this.handlers.set(type, (this.handlers.get(type) ?? new Set()).add(listener));
  }
  removeEventListener(type: string, listener: (e: Event) => void): void {
    this.handlers.get(type)?.delete(listener);
  }
  fire(type: string, event: object): void {
    this.handlers.get(type)?.forEach((h) => h(event as Event));
  }
  count(): number {
    return [...this.handlers.values()].reduce((n, s) => n + s.size, 0);
  }
}

class FakeStorage {
  readonly items = new Map<string, string>();
  writes = 0;
  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.writes++;
    this.items.set(key, value);
  }
}

function fakeInput() {
  let note: ((e: NoteEvent) => void) | null = null;
  let status: ((s: KeyboardStatus) => void) | null = null;
  const input: KeyboardInput = {
    id: 'merged', getStatus: () => ({ state: 'connected', name: null }), dispose: () => {},
    onNote: (l) => { note = l; return () => { note = null; }; },
    onStatus: (l) => { status = l; return () => { status = null; }; },
  };
  return { input, play: (e: NoteEvent) => note?.(e), status: (s: KeyboardStatus) => status?.(s), followed: () => note !== null && status !== null };
}

function setup(options: { storage?: FakeStorage | null; masking?: boolean } = {}) {
  const log = new DebugLog(50, () => 0);
  const target = new FakeTarget();
  const storage = options.storage === undefined ? new FakeStorage() : options.storage;
  let masked = options.masking ?? false;
  const capture = startDebugCapture({ log, target, storage, masking: () => masked });
  return { log, target, storage, capture, mask: (on: boolean) => (masked = on), lines: () => log.entries().map((e) => `${e.kind} ${e.text}`) };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('debug capture (ft_Y_15)', () => {
  it('ft_Y_15.AC1 turns the log on, and leaves no listener behind once disposed', () => {
    const { log, target, capture } = setup();
    expect(log.on).toBe(true);
    expect(target.count()).toBe(4);
    capture.dispose();
    expect(target.count()).toBe(0);
  });

  it('ft_Y_15.AC2 records an uncaught error and a rejection with their stacks and copies the log at once', () => {
    const { target, storage, lines } = setup();
    const error = new RangeError('Maximum call stack size exceeded');
    error.stack = 'RangeError: Maximum call stack size exceeded\n    at refreshStaff (EditorScene.ts:1:1)';
    target.fire('error', { error, message: error.message, filename: 'EditorScene.ts', lineno: 1, colno: 1 });
    expect(lines()[0]).toBe('error RangeError: Maximum call stack size exceeded\n    at refreshStaff (EditorScene.ts:1:1) (EditorScene.ts:1:1)');
    expect(storage!.items.get(DEBUG_STORAGE_KEY)).toContain('RangeError');
    target.fire('unhandledrejection', { reason: 'no sound' });
    expect(lines()[1]).toBe('rejection no sound');
    expect(storage!.items.get(DEBUG_STORAGE_KEY)).toContain('rejection no sound');
  });

  it('ft_Y_15.AC2 records an error event with only a message (a script error from another origin)', () => {
    const { target, lines } = setup();
    target.fire('error', { error: null, message: 'Script error.', filename: '' });
    expect(lines()).toEqual(['error Script error.']);
  });

  it('ft_Y_15.AC2 copies the log every few seconds only when it changed, and the next page restores it', () => {
    const { log, storage, capture } = setup();
    vi.advanceTimersByTime(DEBUG_FLUSH_MS);
    expect(storage!.writes).toBe(0);
    log.log('scene', 'editor');
    vi.advanceTimersByTime(DEBUG_FLUSH_MS);
    vi.advanceTimersByTime(DEBUG_FLUSH_MS);
    expect(storage!.writes).toBe(1);
    capture.dispose();
    const next = setup({ storage });
    next.log.log('scene', 'menu');
    expect(next.log.text()).toBe('1970-01-01T00:00:00.000Z scene editor\n--- page reloaded ---\n1970-01-01T00:00:00.000Z scene menu');
  });

  it('works without session storage, and when it is full or refused', () => {
    const none = setup({ storage: null });
    none.log.log('scene', 'menu');
    none.capture.flush();
    expect(none.lines()).toEqual(['scene menu']);
    const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('full'); } } as unknown as FakeStorage;
    const refused = setup({ storage: broken });
    refused.log.log('scene', 'menu');
    expect(() => refused.capture.flush()).not.toThrow();
  });

  it('ft_Y_15.AC3 records keys, presses and the notes played, and masks typed characters on a text screen and in a text field of the page', () => {
    const { target, capture, mask, lines } = setup();
    const keys = fakeInput();
    capture.follow(keys.input);
    target.fire('keydown', { key: 'z', ctrlKey: true, altKey: false, metaKey: false, shiftKey: false, repeat: false });
    target.fire('keydown', { key: 'z', ctrlKey: true, altKey: false, metaKey: false, shiftKey: false, repeat: true });
    target.fire('pointerdown', { clientX: 10.4, clientY: 20.6, button: 0 });
    keys.play({ kind: 'on', midi: 60, velocity: 90, timeMs: 1, source: 'midi' });
    keys.status({ state: 'disconnected', name: 'Digital Keyboard' });
    keys.status({ state: 'connected', name: null });
    mask(true);
    target.fire('keydown', { key: 'a', ctrlKey: false, altKey: false, metaKey: false, shiftKey: false, repeat: false });
    expect(lines()).toEqual(['key Control+z', 'press 10,21 button 0', 'note on 60 v90 midi', 'midi disconnected Digital Keyboard', 'midi connected', 'key *']);
    mask(false);
    target.fire('keydown', { key: 'T', ctrlKey: false, altKey: false, metaKey: false, shiftKey: true, repeat: false, target: { tagName: 'INPUT' } });
    target.fire('keydown', { key: 'u', ctrlKey: false, altKey: false, metaKey: false, shiftKey: false, repeat: false, target: { tagName: 'TEXTAREA' } });
    target.fire('keydown', { key: 'n', ctrlKey: false, altKey: false, metaKey: false, shiftKey: false, repeat: false, target: { tagName: 'DIV', isContentEditable: true } });
    target.fire('keydown', { key: 'e', ctrlKey: false, altKey: false, metaKey: false, shiftKey: false, repeat: false, target: { tagName: 'CANVAS' } });
    expect(lines().slice(-4)).toEqual(['key *', 'key *', 'key *', 'key e']);
    capture.dispose();
    expect(keys.followed()).toBe(false);
  });
});

describe('keyName', () => {
  const key = (k: string, mods: Partial<Record<'ctrlKey' | 'altKey' | 'metaKey' | 'shiftKey', boolean>> = {}) => ({ key: k, ctrlKey: false, altKey: false, metaKey: false, shiftKey: false, ...mods });
  it('names a chord and a named key, and Shift only before a named key', () => {
    expect(keyName(key('C', { shiftKey: true }), false)).toBe('C');
    expect(keyName(key('ArrowLeft', { shiftKey: true }), false)).toBe('Shift+ArrowLeft');
    expect(keyName(key('Control', { ctrlKey: true }), false)).toBe('Control');
    expect(keyName(key('Shift', { shiftKey: true }), true)).toBe('Shift');
    expect(keyName(key('v', { ctrlKey: true, altKey: true, metaKey: true }), true)).toBe('Control+Alt+Meta+v');
    expect(keyName(key('Backspace'), true)).toBe('Backspace');
  });
});

describe('describe', () => {
  it('gives an error with its stack, a string as it is and anything else as JSON', () => {
    const plain = new Error('boom');
    delete plain.stack;
    expect(describeThrown(plain)).toBe('Error: boom');
    const odd = new TypeError('bad');
    odd.stack = 'at somewhere';
    expect(describeThrown(odd)).toBe('TypeError: bad\nat somewhere');
    expect(describeThrown('text')).toBe('text');
    expect(describeThrown({ code: 1 })).toBe('{"code":1}');
    expect(describeThrown(undefined)).toBe('undefined');
    const loop: Record<string, unknown> = {};
    loop.self = loop;
    expect(describeThrown(loop)).toBe('[object Object]');
  });
});
