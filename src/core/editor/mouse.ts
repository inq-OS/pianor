/**
 * The mouse buttons of the piece editor. The left button works as in any PC program: it selects
 * (a note, a spot for the entry cursor), Shift extends the bar selection, and a drag draws the lasso. The middle button
 * does what adds or changes notes: it places a note or rest, joins a chord, and lengthens a note (Ctrl shortens). Alt with
 * the left button stands in for the middle one on a touchpad that has none. The right button opens the bubble (ft_1_20, d282), where Delete is.
 */
export type MouseAction = 'place' | 'select' | 'extend' | 'bubble' | 'none';

/** `button` is the DOM MouseEvent.button: 0 left, 1 middle, 2 right. */
export function mouseAction(event: { button: number; altKey: boolean; shiftKey: boolean }): MouseAction {
  if (event.button === 2) return 'bubble';
  if (event.button === 1) return 'place';
  if (event.button !== 0) return 'none';
  if (event.altKey) return 'place';
  return event.shiftKey ? 'extend' : 'select';
}
