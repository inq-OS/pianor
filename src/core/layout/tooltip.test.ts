import { describe, expect, it } from 'vitest';
import { TOOLTIP_DELAY_MS, tooltipBox } from './tooltip';

const screen = { w: 320, h: 180 };

describe('tooltipBox (ft_1_08)', () => {
  it('ft_1_08.AC5 sits centred under its button with a gap', () => {
    expect(tooltipBox({ x: 100, y: 40, w: 40, h: 18 }, { w: 30, h: 15 }, screen)).toEqual({ x: 105, y: 60, w: 30, h: 15 });
  });

  it('ft_1_08.AC5 goes above the button when there is no room under it', () => {
    expect(tooltipBox({ x: 100, y: 160, w: 40, h: 18 }, { w: 30, h: 15 }, screen)).toEqual({ x: 105, y: 143, w: 30, h: 15 });
  });

  it('ft_1_08.AC7 sits above a room object, under it when there is no room above', () => {
    expect(tooltipBox({ x: 100, y: 60, w: 40, h: 30 }, { w: 30, h: 15 }, screen, 'above')).toEqual({ x: 105, y: 43, w: 30, h: 15 });
    expect(tooltipBox({ x: 100, y: 10, w: 40, h: 30 }, { w: 30, h: 15 }, screen, 'above')).toEqual({ x: 105, y: 42, w: 30, h: 15 });
  });

  it('ft_1_08.AC7 a room object\'s name keeps below the corner buttons\' strip: over the top of a tall object, else under it', () => {
    // a tall door just under the strip of the corner buttons (rows 0 to 14): its name moves down onto the door's top
    expect(tooltipBox({ x: 280, y: 28, w: 30, h: 90 }, { w: 30, h: 15 }, screen, 'above', 15)).toEqual({ x: 280, y: 15, w: 30, h: 15 });
    // one reaching higher: under it
    expect(tooltipBox({ x: 280, y: 12, w: 30, h: 90 }, { w: 30, h: 15 }, screen, 'above', 15)).toEqual({ x: 280, y: 104, w: 30, h: 15 });
    // a small object up there: under it
    expect(tooltipBox({ x: 100, y: 16, w: 40, h: 12 }, { w: 30, h: 15 }, screen, 'above', 15)).toEqual({ x: 105, y: 30, w: 30, h: 15 });
    // with room above the strip changes nothing
    expect(tooltipBox({ x: 100, y: 60, w: 40, h: 30 }, { w: 30, h: 15 }, screen, 'above', 15)).toEqual({ x: 105, y: 43, w: 30, h: 15 });
  });

  it('ft_1_08.AC5 stays on the screen at its left and right edges', () => {
    expect(tooltipBox({ x: 300, y: 10, w: 20, h: 18 }, { w: 60, h: 15 }, screen).x).toBe(320 - 2 - 60);
    expect(tooltipBox({ x: 0, y: 10, w: 20, h: 18 }, { w: 60, h: 15 }, screen).x).toBe(2);
  });

  it('ft_1_08.AC5 waits about 0.6 s before it shows', () => {
    expect(TOOLTIP_DELAY_MS).toBe(600);
  });
});
