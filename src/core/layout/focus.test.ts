import { describe, expect, it } from 'vitest';
import { cycleFocus, initialFocus, moveFocus, refocus, type FocusRect } from './focus';

const box = (x: number, y: number, disabled = false): FocusRect => ({ x, y, width: 40, height: 20, disabled });
// a 2 x 2 grid, then one wide button below
const grid: FocusRect[] = [box(0, 0), box(60, 0), box(0, 40), box(60, 40), { x: 0, y: 80, width: 100, height: 20 }];

describe('keyboard focus', () => {
  it('ft_Y_13.AC1 starts on the first enabled button, or nothing', () => {
    expect(initialFocus(grid)).toBe(0);
    expect(initialFocus([box(0, 0, true), box(0, 30)])).toBe(1);
    expect(initialFocus([box(0, 0, true)])).toBe(-1);
    expect(initialFocus([])).toBe(-1);
  });

  it('ft_Y_13.AC1 moves to the nearest enabled button in the direction', () => {
    expect(moveFocus(grid, 0, 'right')).toBe(1);
    expect(moveFocus(grid, 0, 'down')).toBe(2);
    expect(moveFocus(grid, 3, 'left')).toBe(2);
    expect(moveFocus(grid, 3, 'up')).toBe(1);
    expect(moveFocus(grid, 2, 'down')).toBe(4);
  });

  it('ft_Y_13.AC1 skips disabled buttons', () => {
    const rects = [box(0, 0), box(0, 30, true), box(0, 60)];
    expect(moveFocus(rects, 0, 'down')).toBe(2);
    expect(moveFocus(rects, 2, 'up')).toBe(0);
  });

  it('ft_Y_13.AC1 wraps to the far side, or clamps when wrapping is off', () => {
    expect(moveFocus(grid, 1, 'right')).toBe(0);
    expect(moveFocus(grid, 0, 'up')).toBe(4);
    expect(moveFocus(grid, 4, 'down')).toBe(0);
    expect(moveFocus(grid, 1, 'right', false)).toBe(1);
    expect(moveFocus(grid, 0, 'up', false)).toBe(0);
  });

  it('ft_Y_13.AC1 stays when it is the only enabled button', () => {
    const rects = [box(0, 0), box(0, 30, true)];
    expect(moveFocus(rects, 0, 'down')).toBe(0);
    expect(moveFocus(rects, 0, 'left')).toBe(0);
  });

  it('ft_Y_13.AC1 chooses the first enabled button when the current focus is missing or disabled', () => {
    expect(moveFocus(grid, -1, 'down')).toBe(0);
    expect(moveFocus(grid, 9, 'down')).toBe(0);
    expect(moveFocus([box(0, 0, true), box(0, 30)], 0, 'down')).toBe(1);
    expect(moveFocus([], 0, 'down')).toBe(-1);
  });

  it('ft_Y_13.AC1 prefers the button straight ahead over one far to the side', () => {
    const rects = [box(100, 0), box(0, 30), box(100, 30)];
    expect(moveFocus(rects, 0, 'down')).toBe(2);
  });

  it('ft_Y_13.AC1 keeps the place after a redraw: the nearest enabled button, or the first when nothing was focused', () => {
    expect(refocus(grid[3]!, grid)).toBe(3);
    expect(refocus(grid[3]!, [box(0, 0), box(60, 0), box(60, 40, true), box(0, 40)])).toBe(1);
    expect(refocus(null, grid)).toBe(0);
    expect(refocus(grid[0]!, [box(0, 0, true)])).toBe(-1);
    expect(refocus(box(30, 0), [box(0, 0), box(60, 0)])).toBe(0); // a tie goes to the first, so a redraw never flips between two
  });

  it('ft_Y_13.AC1 left and right on a scattered screen step through every enabled button, left to right, and wrap', () => {
    // scattered as a room's objects: a far corner, a low one, a high one between, a disabled one
    const room = [box(300, 0), box(0, 100), box(120, 10), box(200, 60, true), box(120, 120)];
    const order: number[] = [];
    let at = 1;
    for (let i = 0; i < 4; i++) {
      order.push(at);
      at = cycleFocus(room, at, 1);
    }
    expect(order).toEqual([1, 2, 4, 0]);
    expect(at).toBe(1);
    expect(cycleFocus(room, 1, -1)).toBe(0);
    expect(cycleFocus(room, 2, -1)).toBe(1);
    expect(cycleFocus(room, -1, 1)).toBe(0);
    expect(cycleFocus([box(0, 0, true)], 0, 1)).toBe(-1);
  });

  it('ft_Y_13.AC1 a step through the screen takes the corner first and the corners last before the rest by place', () => {
    // the way back in the top left corner, the gear in the top right, a scene's objects between
    const screen = [box(200, 50), { ...box(0, 0), group: -1 as const }, box(10, 60), { ...box(150, 0), group: 1 as const }, box(300, 60)];
    const order: number[] = [];
    let at = 1;
    for (let i = 0; i < 5; i++) {
      order.push(at);
      at = cycleFocus(screen, at, 1);
    }
    expect(order).toEqual([1, 2, 0, 4, 3]);
  });
});
