import { describe, expect, it } from 'vitest';
import type { KeyLightOutput } from '../../src/io/keyboard';

/** How a contract run drives one key-light output and reads back what it shows. */
export interface KeyLightHarness {
  lights: KeyLightOutput;
  /** The keys the output shows lit now, sorted; null when it cannot show any (`supported` false). */
  lit(): number[] | null;
}

/**
 * Behaviour every `KeyLightOutput` must have: the null output of the real keyboard (until the hardware spike), the on-screen
 * keyboard, and later a Web MIDI lighting output (ft_Y_06, ft_Y_08). A new output passes this suite before the game uses it.
 */
export function keyLightContract(name: string, create: () => KeyLightHarness): void {
  describe(`KeyLightOutput contract: ${name}`, () => {
    it('replaces the lit set on every call instead of adding to it, and an empty list clears it', () => {
      const { lights, lit } = create();
      lights.setLitKeys([60, 64]);
      if (lights.supported) expect(lit()).toEqual([60, 64]);
      lights.setLitKeys([62]);
      if (lights.supported) expect(lit()).toEqual([62]);
      lights.setLitKeys([]);
      if (lights.supported) expect(lit()).toEqual([]);
    });

    it('takes duplicates and keys outside its range without throwing', () => {
      const { lights, lit } = create();
      expect(() => lights.setLitKeys([60, 60, 0, 127])).not.toThrow();
      if (lights.supported) expect(lit()).toEqual([60]);
    });

    it('shows nothing when it says it is not supported', () => {
      const { lights, lit } = create();
      lights.setLitKeys([60]);
      if (!lights.supported) expect(lit()).toBeNull();
    });
  });
}
