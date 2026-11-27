import type { Rect } from './rect';

/** How long the pointer rests on a button before its tooltip shows (ft_1_08): long enough not to flash while moving past. */
export const TOOLTIP_DELAY_MS = 600;

/** Gap between a button and its tooltip, and the least margin to the screen's edge, in art pixels. */
const GAP = 2;

/**
 * Where a tooltip of `size` goes for the button `anchor`: centred under it, or above it when there is no room below,
 * moved sideways so it stays on a screen of `screen` art pixels. `prefer: 'above'` (a room object's name, ft_1_08.AC7)
 * tries above first. `top` is the least row it may start at above its button: under a screen's corner buttons (their strip),
 * so a name never covers the gear: moved down onto the object's top when that takes at most half its height, else under it.
 */
export function tooltipBox(anchor: Rect, size: { w: number; h: number }, screen: { w: number; h: number }, prefer: 'below' | 'above' = 'below', top: number = GAP): Rect {
  const below = anchor.y + anchor.h + GAP;
  const above = anchor.y - GAP - size.h;
  const fitsBelow = below + size.h <= screen.h - GAP;
  // a little short of room above: the name moves down onto the object's own top, by at most half its height
  const overTop = top - above <= size.h / 2 && top + size.h <= anchor.y + anchor.h;
  const high = above >= top ? above : overTop ? top : fitsBelow ? below : above;
  const y = prefer === 'above' ? high : fitsBelow ? below : above;
  const centred = Math.round(anchor.x + anchor.w / 2 - size.w / 2);
  const x = Math.max(GAP, Math.min(screen.w - GAP - size.w, centred));
  return { x, y, w: size.w, h: size.h };
}
