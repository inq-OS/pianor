// Covers ft_Y_04.AC18 (the photo tool: the part of the photo to read).
import { describe, expect, it } from 'vitest';
import { MIN_CROP, cropOf, fitIn, nextTurn, shownRect, turnTransform, turnedSize, wholeOf } from './photoCrop';

/** Where the transform puts a photo pixel. */
function apply(m: readonly number[], x: number, y: number): [number, number] {
  const [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0] = m;
  return [a * x + c * y + e, b * x + d * y + f];
}

describe('the photo tool\'s picture (ft_Y_04.AC18)', () => {
  it('ft_Y_04.AC18 turns the photo by quarter turns, round to where it started', () => {
    expect([0, 1, 2, 3].map((t) => nextTurn(t as 0))).toEqual([1, 2, 3, 0]);
    expect(turnedSize({ width: 400, height: 300 }, 1)).toEqual({ width: 300, height: 400 });
    expect(turnedSize({ width: 400, height: 300 }, 2)).toEqual({ width: 400, height: 300 });
    const photo = { width: 400, height: 300 };
    const whole = (t: 0 | 1 | 2 | 3) => wholeOf(turnedSize(photo, t));
    // the top left corner goes to the top right on a quarter turn clockwise, to the bottom right on a half turn, ...
    expect(apply(turnTransform(photo, 0, whole(0)), 0, 0)).toEqual([0, 0]);
    expect(apply(turnTransform(photo, 1, whole(1)), 0, 0)).toEqual([300, 0]);
    expect(apply(turnTransform(photo, 2, whole(2)), 0, 0)).toEqual([400, 300]);
    expect(apply(turnTransform(photo, 3, whole(3)), 0, 0)).toEqual([0, 400]);
    // ... and the bottom right corner to the bottom left on a quarter turn
    expect(apply(turnTransform(photo, 1, whole(1)), 400, 300)).toEqual([0, 400]);
    // a crop moves its corner to the origin
    expect(apply(turnTransform(photo, 0, { x: 50, y: 20, width: 100, height: 100 }), 50, 20)).toEqual([0, 0]);
  });

  it('ft_Y_04.AC18 fits the photo in the window and reads a drag as the part to read, kept inside the photo', () => {
    const photo = { width: 2000, height: 1000 };
    const view = fitIn(photo, { width: 1000, height: 1000 });
    expect(view).toEqual({ x: 0, y: 250, scale: 0.5 });
    // a small photo is not blown up
    expect(fitIn({ width: 100, height: 100 }, { width: 1000, height: 500 })).toEqual({ x: 450, y: 200, scale: 1 });
    // a drag from right to left, past the photo's edge, is the same part as one from left to right
    expect(cropOf({ x: 600, y: 900 }, { x: -50, y: 300 }, view, photo)).toEqual({ x: 0, y: 100, width: 1200, height: 900 });
    expect(shownRect({ x: 0, y: 100, width: 1200, height: 900 }, view)).toEqual({ x: 0, y: 300, width: 600, height: 450 });
    // a click, or a drag smaller than a bar could be, marks nothing
    expect(cropOf({ x: 100, y: 400 }, { x: 101, y: 401 }, view, photo)).toBeNull();
    expect(cropOf({ x: 100, y: 400 }, { x: 100 + (MIN_CROP - 1) / 2, y: 600 }, view, photo)).toBeNull();
  });
});
