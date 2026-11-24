// Covers ft_1_34.AC3.
import { describe, expect, it } from 'vitest';
import { ART_DETAIL } from '../../../core/layout/frame';
import { roomPlan } from '../../../core/layout/room';
import { phoneAtRest, phoneRinging } from './phoneArt';

describe('the telephone\'s picture (ft_1_34)', () => {
  it('ft_1_34.AC3 fits its place on the room\'s wall, and the ringing looks differ from the one at rest', () => {
    const place = roomPlan().phone;
    const rest = phoneAtRest();
    expect(rest.width).toBeLessThanOrEqual(place.w * ART_DETAIL);
    expect(rest.height).toBeLessThanOrEqual(place.h * ART_DETAIL);
    const [left, right] = phoneRinging();
    for (const look of [left, right]) expect([look.width, look.height]).toEqual([rest.width, rest.height]);
    expect(left.pixels).not.toEqual(rest.pixels);
    expect(left.pixels).not.toEqual(right.pixels);
  });
});
