// Covers the mouse buttons of the piece editor: the middle button places, the left one selects.
import { describe, expect, it } from 'vitest';
import { mouseAction } from './mouse';

describe('mouse buttons in the piece editor', () => {
  it('the middle button places (adds notes and rests, lengthens a note)', () => {
    expect(mouseAction({ button: 1, altKey: false, shiftKey: false })).toBe('place');
  });

  it('Alt + the left button places too, for a touchpad without a middle button', () => {
    expect(mouseAction({ button: 0, altKey: true, shiftKey: false })).toBe('place');
  });

  it('the left button selects; with Shift it extends the bar selection', () => {
    expect(mouseAction({ button: 0, altKey: false, shiftKey: false })).toBe('select');
    expect(mouseAction({ button: 0, altKey: false, shiftKey: true })).toBe('extend');
  });

  it('ft_1_20.AC22 the right button opens the bubble of what can be done with the thing under it, and removes nothing itself', () => {
    expect(mouseAction({ button: 2, altKey: false, shiftKey: false })).toBe('bubble');
    expect(mouseAction({ button: 2, altKey: true, shiftKey: true })).toBe('bubble');
  });

  it('other buttons (back, forward) do nothing', () => {
    expect(mouseAction({ button: 3, altKey: false, shiftKey: false })).toBe('none');
  });
});
