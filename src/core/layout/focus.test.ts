import { describe, expect, it } from 'vitest';
import { FOCUS_LAYOUT, initialFocus, moveFocus, refocus, type FocusRect } from './focus';

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
});

describe('keyboard focus over a picture (the room)', () => {
  // the room's things by their centres: the corners' Back, backpack and gear on top, the shield on the wall, Kiur on the bed,
  // the piano, the easel, the telephone and the door, at their places in no rows
  const at = (x: number, y: number): FocusRect => ({ x: x - 5, y: y - 5, width: 10, height: 10 });
  const room = { back: at(15, 10), backpack: at(281, 10), gear: at(305, 10), shield: at(177, 35), kiur: at(40, 75), piano: at(156, 82), easel: at(209, 77), phone: at(283, 54), door: at(305, 70) };
  const names = Object.keys(room) as (keyof typeof room)[];
  const rects = names.map((n) => room[n]);
  const walk = (from: keyof typeof room, move: 'left' | 'right', steps: number) => {
    let i = names.indexOf(from);
    const seen: string[] = [];
    for (let s = 0; s < steps; s++) {
      i = moveFocus(rects, i, move, true, FOCUS_LAYOUT.picture);
      seen.push(names[i]!);
    }
    return seen;
  };

  it('ft_Y_13.AC1 Right goes through the things below the corners in their order across the screen, then wraps to the left', () => {
    expect(walk('kiur', 'right', 7)).toEqual(['piano', 'shield', 'easel', 'phone', 'door', 'back', 'kiur']);
  });

  it('ft_Y_13.AC1 Left goes the same way back, and the telephone is reached from the door', () => {
    expect(walk('door', 'left', 5)).toEqual(['phone', 'easel', 'shield', 'piano', 'kiur']);
  });

  it('ft_Y_13.AC1 a grid keeps its rows: Right stays on the row even with a nearer button on the next', () => {
    expect(moveFocus(grid, 0, 'right', true, FOCUS_LAYOUT.grid)).toBe(1);
    expect(moveFocus(grid, 2, 'up', true, FOCUS_LAYOUT.picture)).toBe(0);
  });
});
