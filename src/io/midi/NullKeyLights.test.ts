// Covers ft_0_06.AC4.
import { describe, expect, it } from 'vitest';
import { VirtualEz220 } from '../mock/VirtualEz220';
import { nullKeyLights } from './NullKeyLights';

describe('nullKeyLights (real EZ-220 lighting is unverified until the hardware spike)', () => {
  it('says it is not supported and does nothing, sending nothing to the keyboard', () => {
    const device = new VirtualEz220();
    expect(nullKeyLights.supported).toBe(false);
    expect(() => nullKeyLights.setLitKeys([60, 64])).not.toThrow();
    expect(device.output.sent).toEqual([]);
  });
});
