import { describe, expect, it } from 'vitest';
import { rectBottom, rectCentre, rectRight } from './rect';

describe('rect helpers', () => {
  const bar = { x: 36, y: 41, w: 150, h: 9 };
  it('finds the far edges', () => {
    expect(rectRight(bar)).toBe(186);
    expect(rectBottom(bar)).toBe(50);
  });
  it('gives the centre form a button takes', () => {
    expect(rectCentre(bar)).toEqual({ x: 111, y: 45.5, width: 150, height: 9 });
  });
});
