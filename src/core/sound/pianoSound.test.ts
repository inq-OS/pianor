import { describe, expect, it } from 'vitest';
import { nextPianoSound } from './pianoSound';

describe('the piano sound switch (ft_0_07.AC3)', () => {
  it('ft_0_07.AC4 cycles full, light, keyboard, full', () => {
    expect(nextPianoSound('full')).toBe('light');
    expect(nextPianoSound('light')).toBe('keyboard');
    expect(nextPianoSound('keyboard')).toBe('full');
  });
});
