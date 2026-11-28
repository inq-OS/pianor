import type { StaffLayout } from './staffTypes';

/** Where the score of a finished pass is drawn on the staff (ft_1_12): a box in layout pixels, and the system it belongs to. */
export interface PassScorePlace {
  x: number;
  y: number;
  w: number;
  h: number;
  system: number;
}

/**
 * The score of a pass (its stars, then its numbers, d312) goes in a row under the staff's last bar, ending at the final
 * bar line, a third of a staff space under the bottom line: it crosses neither the staff's lines nor its bar line and stays
 * on the paper, and there is room for stars big enough to read at a glance. Pulled in to stay on the layout. Pure: the
 * view only draws it.
 */
export function passScorePlace(layout: Pick<StaffLayout, 'staffSpace' | 'width' | 'height' | 'barlines'>, size: { w: number; h: number }): PassScorePlace {
  const end = layout.barlines.find((b) => b.kind === 'final') ?? layout.barlines[layout.barlines.length - 1];
  if (!end) return { x: 0, y: 0, ...size, system: 0 };
  const x = Math.max(0, Math.min(end.x, layout.width) - size.w);
  const y = Math.max(0, Math.min(Math.round(end.y2 + layout.staffSpace / 3), layout.height - size.h));
  return { x, y, ...size, system: end.system };
}
