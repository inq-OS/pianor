import { afterEach, describe, expect, it } from 'vitest';
import { motionAllowed, setSceneryStill } from './motion';

describe('whether the scenery moves (d127)', () => {
  afterEach(() => setSceneryStill(false));

  it('moves by default, whatever the operating system says about motion (d127)', () => {
    // a PC with the system's animation effects off still gets the game's motion
    const asked = globalThis.matchMedia;
    globalThis.matchMedia = ((query: string) => ({ matches: query.includes('reduce'), media: query })) as unknown as typeof globalThis.matchMedia;
    try {
      expect(motionAllowed()).toBe(true);
    } finally {
      globalThis.matchMedia = asked;
    }
  });

  it('stands still only when the game is told to (`?motion=still`)', () => {
    setSceneryStill(true);
    expect(motionAllowed()).toBe(false);
    setSceneryStill(false);
    expect(motionAllowed()).toBe(true);
  });
});
