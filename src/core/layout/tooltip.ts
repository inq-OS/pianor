import type { Rect } from './rect';

/** How long the pointer rests on a button before its tooltip shows (ft_1_08): long enough not to flash while moving past. */
export const TOOLTIP_DELAY_MS = 600;

/** Gap between a button and its tooltip, and the least margin to the screen's edge, in art pixels. */
const GAP = 2;

/**
 * Where a tooltip of `size` goes for the button `anchor`: centred under it, or above it when there is no room below,
 * moved sideways so it stays on a screen of `screen` art pixels. `prefer: 'above'` (a room object's name, ft_1_08.AC7)
 * tries above first.
 */
export function tooltipBox(anchor: Rect, size: { w: number; h: number }, screen: { w: number; h: number }, prefer: 'below' | 'above' = 'below'): Rect {
  const below = anchor.y + anchor.h + GAP;
  const above = anchor.y - GAP - size.h;
  const fitsBelow = below + size.h <= screen.h - GAP;
  const y = prefer === 'above' ? (above >= GAP || !fitsBelow ? above : below) : fitsBelow ? below : above;
  const centred = Math.round(anchor.x + anchor.w / 2 - size.w / 2);
  const x = Math.max(GAP, Math.min(screen.w - GAP - size.w, centred));
  return { x, y, w: size.w, h: size.h };
}
