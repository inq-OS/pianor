// Covers ft_1_15.AC3.
import type Phaser from 'phaser';
import { describe, expect, it } from 'vitest';
import { CANCELLED, closeOverlay, openOverlay, settleOverlay, startScene } from './scenes';

/** A scene with just the scene plugin calls the overlay helpers use, logging them. */
function fakeScene(key: string, log: string[]): Phaser.Scene {
  return {
    scene: {
      key,
      launch: (k: string, data: unknown) => log.push(`${key}: launch ${k} ${JSON.stringify(data)}`),
      pause: () => log.push(`${key}: pause`),
      stop: () => log.push(`${key}: stop`),
      resume: (k: string) => log.push(`${key}: resume ${k}`),
    },
  } as unknown as Phaser.Scene;
}

describe('openOverlay (d070)', () => {
  it('ft_1_15.AC3 launches the overlay, pauses the caller, and resolves with the result once the caller is resumed', async () => {
    const log: string[] = [];
    const practice = fakeScene('practice', log);
    const overlay = fakeScene('kiurDoor', log);
    const result = openOverlay(practice, 'kiurDoor');
    expect(log).toEqual(['practice: launch kiurDoor {}', 'practice: pause']);
    closeOverlay(overlay, 'kiurDoor', 'door');
    expect(await result).toBe('door');
    expect(log.slice(2)).toEqual(['kiurDoor: stop', 'kiurDoor: resume practice']);
  });

  it('ft_1_15.AC3 resolves cancelled when the overlay goes away without a choice (Esc, shutdown)', async () => {
    const log: string[] = [];
    const result = openOverlay(fakeScene('practice', log), 'kiurDoor');
    const overlay = fakeScene('kiurDoor', log);
    settleOverlay('kiurDoor', CANCELLED, overlay);
    expect(await result).toBe(CANCELLED);
    expect(log.at(-1)).toBe('kiurDoor: resume practice');
    // closing it again later does nothing more
    closeOverlay(overlay, 'kiurDoor', 'back');
    expect(log.at(-1)).toBe('kiurDoor: stop');
  });
});

/** A scene whose `start` only queues the move, as Phaser does, with its own lifecycle events. */
function queuingScene(key: string, log: string[]): Phaser.Scene & { fire: (event: string) => void } {
  const handlers = new Map<string, (() => void)[]>();
  return {
    scene: { key, start: (k: string) => log.push(`${key}: start ${k}`) },
    events: {
      once: (event: string, fn: () => void) => handlers.set(event, [...(handlers.get(event) ?? []), fn]),
      off: (event: string, fn: () => void) => handlers.set(event, (handlers.get(event) ?? []).filter((h) => h !== fn)),
    },
    fire: (event: string) => {
      const fns = handlers.get(event) ?? [];
      handlers.delete(event);
      for (const fn of fns) fn();
    },
  } as unknown as Phaser.Scene & { fire: (event: string) => void };
}

describe('startScene', () => {
  it('a screen that is already on its way to another screen ignores a second move (a click then Esc at once)', () => {
    const log: string[] = [];
    const menu = queuingScene('menu', log);
    startScene(menu, 'practice', { chartId: 'x' });
    startScene(menu, 'profile');
    expect(log).toEqual(['menu: start practice']);
  });

  it('the screen can move again once it was shut down or started anew', () => {
    const log: string[] = [];
    const menu = queuingScene('menu', log);
    startScene(menu, 'practice', { chartId: 'x' });
    menu.fire('shutdown');
    startScene(menu, 'profile');
    menu.fire('start');
    startScene(menu, 'songs');
    expect(log).toEqual(['menu: start practice', 'menu: start profile', 'menu: start songs']);
  });
});
