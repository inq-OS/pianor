// Covers ft_1_15.AC3.
import type Phaser from 'phaser';
import { describe, expect, it } from 'vitest';
import { CANCELLED, closeOverlay, openOverlay, settleOverlay } from './scenes';

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
