// Covers ft_1_33.AC1 (the pictures of the F1 help).
import { describe, expect, it } from 'vitest';
import { HELP_CARDS } from '../../../core/editor/help';
import { GESTURE_SIZE, MOUSE_COLOURS, SKETCH_SIZE, gesturePicture, keyCap, staffSketch } from './mouseArt';
import { C } from './palette';

const has = (pixels: Uint8Array, index: number) => pixels.includes(index);

describe('the F1 help pictures (ft_1_33.AC1)', () => {
  it('ft_1_33.AC1 the small mouse lights only what is pressed, in its colour', () => {
    expect(has(gesturePicture('left').pixels, MOUSE_COLOURS.left)).toBe(true);
    expect(has(gesturePicture('left').pixels, MOUSE_COLOURS.right)).toBe(false);
    expect(has(gesturePicture('right').pixels, MOUSE_COLOURS.right)).toBe(true);
    expect(has(gesturePicture('right').pixels, MOUSE_COLOURS.left)).toBe(false);
    expect(has(gesturePicture('middle').pixels, MOUSE_COLOURS.wheel)).toBe(true);
    expect(has(gesturePicture('middle').pixels, MOUSE_COLOURS.left)).toBe(false);
    for (const g of ['left', 'middle', 'right', 'wheelUp', 'drag'] as const) expect([gesturePicture(g).width, gesturePicture(g).height]).toEqual([GESTURE_SIZE.w, GESTURE_SIZE.h]);
    // the turned wheel and the drag carry a sign the plain presses do not
    const count = (g: 'middle' | 'wheelUp', i: number) => gesturePicture(g).pixels.filter((p) => p === i).length;
    expect(count('wheelUp', C.teal)).toBeGreaterThan(count('middle', C.teal));
  });

  it('ft_1_33.AC1 every card draws a different staff after than before, the same size', () => {
    for (const card of HELP_CARDS) {
      const before = staffSketch(card.before), after = staffSketch(card.after);
      expect([before.width, before.height]).toEqual([SKETCH_SIZE.w, SKETCH_SIZE.h]);
      expect(before.pixels.every((p, i) => p === after.pixels[i])).toBe(false);
    }
  });

  it('ft_1_33.AC1 a selected note and the lasso are blue; a placed note is ink', () => {
    expect(has(staffSketch({ notes: [{ bar: 0, place: 4, length: 'quarter', lit: true }] }).pixels, C.blue)).toBe(true);
    expect(has(staffSketch({ notes: [{ bar: 0, place: 4, length: 'quarter' }] }).pixels, C.blue)).toBe(false);
    expect(has(staffSketch({ notes: [], boxed: true }).pixels, C.blue)).toBe(true);
  });

  it('a key cap is outlined in ink with clear corners', () => {
    const cap = keyCap(18, 11);
    expect(cap.pixels[0]).toBe(0);
    expect(cap.pixels[1]).toBe(C.ink);
    expect(cap.pixels[5 * 18 + 5]).toBe(C.cream);
  });
});
