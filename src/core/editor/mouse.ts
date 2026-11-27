/**
 * The mouse buttons of the piece editor. A left click on an empty place of the staff writes a note or rest there, so
 * whoever has not read the help writes at once (ft_1_02d.AC50); on a note it selects it, Shift extends the bar selection,
 * and a drag draws the lasso. The middle button also writes, and on a note lengthens it (Ctrl shortens). Alt with the
 * left button stands in for the middle one on a touchpad that has none. The right button opens the bubble (ft_1_20,
 * d282), whose Delete removes.
 */
export type MouseAction = 'place' | 'select' | 'extend' | 'none';

/** `button` is the DOM MouseEvent.button: 0 left, 1 middle, 2 right. */
export function mouseAction(event: { button: number; altKey: boolean; shiftKey: boolean }): MouseAction {
  if (event.button === 1) return 'place';
  if (event.button !== 0) return 'none';
  if (event.altKey) return 'place';
  return event.shiftKey ? 'extend' : 'select';
}

/** What a click (pressed and let go without a drag) does on an empty place or on a note head. */
export type ClickOutcome = 'write' | 'lengthen' | 'select' | 'extend' | 'none';

export function clickOutcome(event: { button: number; altKey: boolean; shiftKey: boolean }, on: 'place' | 'note'): ClickOutcome {
  const action = mouseAction(event);
  if (action === 'none' || action === 'extend') return action;
  if (on === 'place') return 'write';
  return action === 'place' ? 'lengthen' : 'select';
}
