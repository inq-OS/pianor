import { describe, expect, it, vi } from 'vitest';
import type { NoteEvent } from '../../src/core/judge/types';
import type { KeyboardInput } from '../../src/io/keyboard';

/** How a contract run drives one implementation through its own native means. */
export interface KeyboardHarness {
  keyboard: KeyboardInput;
  /** Press and release middle C once (press velocity 90), by whatever means this implementation has. */
  playMiddleC(): void;
}

/**
 * Behaviour every `KeyboardInput` must have, whether it is the Web MIDI wrapper over a (virtual) device,
 * the computer keyboard, a replay or a combination. A new input device passes this suite before the game uses it.
 */
export function keyboardContract(name: string, create: () => KeyboardHarness | Promise<KeyboardHarness>): void {
  describe(`KeyboardInput contract: ${name}`, () => {
    it('emits a note-on and then a note-off for a key press, as plain NoteEvents', async () => {
      const { keyboard, playMiddleC } = await create();
      const events: NoteEvent[] = [];
      keyboard.onNote((e) => events.push(e));
      playMiddleC();
      expect(events.map((e) => [e.kind, e.midi])).toEqual([['on', 60], ['off', 60]]);
      expect(events[0]!.velocity).toBeGreaterThan(0);
      expect(events[1]!.velocity).toBe(0);
      for (const e of events) {
        expect(typeof e.source).toBe('string');
        expect(e.source.length).toBeGreaterThan(0);
        expect(Number.isFinite(e.timeMs)).toBe(true);
        expect(Object.keys(e).sort()).toEqual(['kind', 'midi', 'source', 'timeMs', 'velocity']);
      }
      keyboard.dispose();
    });

    it('never emits a note-on with velocity 0', async () => {
      const { keyboard, playMiddleC } = await create();
      const events: NoteEvent[] = [];
      keyboard.onNote((e) => events.push(e));
      playMiddleC();
      expect(events.filter((e) => e.kind === 'on' && e.velocity === 0)).toEqual([]);
      keyboard.dispose();
    });

    it('stops delivering to a listener after it unsubscribes, and to everyone after dispose', async () => {
      const { keyboard, playMiddleC } = await create();
      const a: NoteEvent[] = [];
      const b: NoteEvent[] = [];
      const offA = keyboard.onNote((e) => a.push(e));
      keyboard.onNote((e) => b.push(e));
      offA();
      playMiddleC();
      expect(a).toEqual([]);
      expect(b.length).toBeGreaterThan(0);
      const seen = b.length;
      keyboard.dispose();
      keyboard.dispose(); // safe twice
      expect(() => playMiddleC()).not.toThrow();
      expect(b.length).toBe(seen);
    });

    it('survives a listener that throws', async () => {
      const { keyboard, playMiddleC } = await create();
      const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const good: NoteEvent[] = [];
      keyboard.onNote(() => {
        throw new Error('bad listener');
      });
      keyboard.onNote((e) => good.push(e));
      playMiddleC();
      expect(good).toHaveLength(2);
      error.mockRestore();
      keyboard.dispose();
    });

    it('reports a status with a state and a name or null', async () => {
      const { keyboard } = await create();
      const status = keyboard.getStatus();
      expect(['connected', 'disconnected']).toContain(status.state);
      expect(status.name === null || typeof status.name === 'string').toBe(true);
      expect(keyboard.id.length).toBeGreaterThan(0);
      expect(typeof keyboard.onStatus(() => undefined)).toBe('function');
      keyboard.dispose();
    });
  });
}
