import { describe, expect, it } from 'vitest';
import { characterKnown, knownFlag } from './character';

describe('a character is known once asked who it is (ft_1_22.AC10)', () => {
  it('ft_1_22.AC10 its flag is known-<id>; until the world holds it, the character is not known', () => {
    expect(knownFlag('puuvaim')).toBe('known-puuvaim');
    expect(characterKnown([], 'puuvaim')).toBe(false);
    // meeting and talking is not enough: met-puuvaim is not known-puuvaim
    expect(characterKnown(['met-puuvaim'], 'puuvaim')).toBe(false);
    expect(characterKnown(['met-puuvaim', 'known-puuvaim'], 'puuvaim')).toBe(true);
    expect(characterKnown(['known-puuvaim'], 'vares')).toBe(false);
  });
});
