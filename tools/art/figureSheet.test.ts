import { describe, expect, it } from 'vitest';
import { SAMPLE_PEOPLE } from '../../src/game/ui/pixel/actors/features';
import { figureFrames } from '../../src/game/ui/pixel/actors/figure';
import { figureSheet, GENERATED } from './figureSheet';
import { pngBytes } from './png';

/** The template character's sheet (`npm run art:render -- figures`, WP-05): what the maintainer judges the template by. */
describe('the template character\'s sheet', () => {
  it('shows the six sample people in fourteen frames and a row of generated islanders, lit by the hour', () => {
    // one sheet only: three of them ran past the 30-second limit on a Windows CI runner; the hour is checked on one figure
    const day = figureSheet();
    expect(day.palette[1]).toBe(0xc4b28c);
    expect(day.pixels).toBeInstanceOf(Uint16Array);
    expect(day.pixels.length).toBe(day.width * day.height);
    expect(day.width).toBeGreaterThan(14 * 70);
    expect(day.height).toBeGreaterThan((SAMPLE_PEOPLE.length + 1) * 100);
    expect(GENERATED).toBeLessThanOrEqual(14);
    expect(day.palette.length).toBeGreaterThan(60);
    const one = (hour: 'day' | 'night') => figureFrames(SAMPLE_PEOPLE[0]!.features, 'idle', { hour })[0]!.rgba;
    expect(one('night')).not.toEqual(one('day'));
    expect(pngBytes(day).length).toBeGreaterThan(1000);
  });
});
