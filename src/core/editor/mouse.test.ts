// Covers the mouse buttons of the piece editor: the middle button places, the left one selects.
import { describe, expect, it } from 'vitest';
import { clickOutcome, mouseAction } from './mouse';

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

  it('ft_1_20.AC22 the right button is left to the bubble: it changes nothing on the staff itself', () => {
    expect(mouseAction({ button: 2, altKey: false, shiftKey: false })).toBe('none');
    expect(mouseAction({ button: 2, altKey: true, shiftKey: true })).toBe('none');
  });

  it('other buttons (back, forward) do nothing', () => {
    expect(mouseAction({ button: 3, altKey: false, shiftKey: false })).toBe('none');
  });

  it('ft_1_02d.AC50 a left click on an empty place writes a note there, as the middle button does; on a note it selects it', () => {
    const left = { button: 0, altKey: false, shiftKey: false };
    expect(clickOutcome(left, 'place')).toBe('write');
    expect(clickOutcome(left, 'note')).toBe('select');
    expect(clickOutcome({ ...left, button: 1 }, 'place')).toBe('write');
  });

  it('ft_1_02d.AC50 the middle button and Alt + left click still lengthen a note; Shift + left still extends the bars', () => {
    expect(clickOutcome({ button: 1, altKey: false, shiftKey: false }, 'note')).toBe('lengthen');
    expect(clickOutcome({ button: 0, altKey: true, shiftKey: false }, 'note')).toBe('lengthen');
    expect(clickOutcome({ button: 0, altKey: true, shiftKey: false }, 'place')).toBe('write');
    expect(clickOutcome({ button: 0, altKey: false, shiftKey: true }, 'place')).toBe('extend');
    expect(clickOutcome({ button: 2, altKey: false, shiftKey: false }, 'place')).toBe('none');
  });
});
