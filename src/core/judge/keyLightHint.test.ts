// Covers ft_Y_06.AC2 (lit only after N wrong presses on the same awaited note; the count starts again on the next note).
import { describe, expect, it } from 'vitest';
import { recordWrongPress, shouldLightKey, startKeyLightCounter } from './keyLightHint';

describe('key-light hint after N wrong presses', () => {
  it('with N = 0 the awaited key is lit at once, before any wrong press', () => {
    expect(shouldLightKey(startKeyLightCounter(), 0, 0)).toBe(true);
  });

  it('with N = 2 the key is lit only after the second wrong press on that note', () => {
    let counter = startKeyLightCounter();
    expect(shouldLightKey(counter, 2, 3)).toBe(false);
    counter = recordWrongPress(counter, 3);
    expect(shouldLightKey(counter, 2, 3)).toBe(false);
    counter = recordWrongPress(counter, 3);
    expect(shouldLightKey(counter, 2, 3)).toBe(true);
  });

  it('the count starts again on the next note', () => {
    let counter = startKeyLightCounter();
    counter = recordWrongPress(counter, 3);
    counter = recordWrongPress(counter, 3);
    expect(shouldLightKey(counter, 2, 4)).toBe(false);
    counter = recordWrongPress(counter, 4);
    expect(shouldLightKey(counter, 2, 4)).toBe(false);
    counter = recordWrongPress(counter, 4);
    expect(shouldLightKey(counter, 2, 4)).toBe(true);
  });

  it('a press on the next note does not light the key of the note before', () => {
    let counter = startKeyLightCounter();
    counter = recordWrongPress(counter, 3);
    counter = recordWrongPress(counter, 3);
    expect(shouldLightKey(counter, 2, 3)).toBe(true);
    counter = recordWrongPress(counter, 4);
    expect(shouldLightKey(counter, 2, 3)).toBe(false);
  });
});
