import { describe, expect, it } from 'vitest';
import { CLEF_FLIGHT, clefDrop, grownBox } from './clefFlight';

describe('the learned clef on its way to the book', () => {
  it('ft_1_32.AC22 grows to twice its size about its own centre', () => {
    expect(CLEF_FLIGHT.grow).toBe(2);
    expect(grownBox({ x: 100, y: 40, w: 20, h: 50 })).toEqual({ x: 90, y: 15, w: 40, h: 100 });
  });

  it('ft_1_32.AC22 starts in the book where the practice screen left it, and lands on the sign at the height of the sign', () => {
    const { start, end } = clefDrop({ x: 400, y: 48, w: 56, h: 96 }, { x: 1200, y: 200, w: 28, h: 48 });
    expect(start).toEqual({ x: 428, y: 96, scale: 1 });
    expect(end).toEqual({ x: 1214, y: 224, scale: 0.5 });
  });
});
