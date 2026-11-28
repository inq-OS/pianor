import { describe, expect, it } from 'vitest';
import { keyPictogram } from './keyPictogram';

const shown = (low: number, high: number) => keyPictogram(low, high).keys.map((k) => `${k.midi}${k.black ? 'b' : ''}${k.lit ? '*' : ''}`);

describe('the keys of a pitfall card (d312)', () => {
  it('E and F lit with no black key between them: a half step', () => {
    expect(shown(64, 65)).toEqual(['62', '64*', '65*', '67', '63b', '66b']);
  });

  it('E and F sharp lit with F between them: a whole step', () => {
    expect(shown(64, 66)).toEqual(['62', '64*', '65', '67', '63b', '66b*']);
  });

  it('a black key stands over the line between its two white keys, inside the picture', () => {
    const p = keyPictogram(64, 66);
    for (const key of p.keys) {
      expect(key.x).toBeGreaterThanOrEqual(0);
      expect(key.x + key.w).toBeLessThanOrEqual(p.width);
    }
    const whites = p.keys.filter((k) => !k.black);
    const fSharp = p.keys.find((k) => k.midi === 66)!;
    const g = whites.find((k) => k.midi === 67)!;
    expect(fSharp.x + Math.floor(fSharp.w / 2)).toBe(g.x);
  });
});
