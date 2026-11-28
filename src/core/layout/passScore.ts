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
 * The score of a pass goes right after the piece's last bar line: beside the final bar line, centred on
 * its height. When the line runs too close to the edge the box is pulled in so it stays on the layout. Pure: the view only
 * draws it.
 */
export function passScorePlace(layout: Pick<StaffLayout, 'staffSpace' | 'width' | 'barlines'>, size: { w: number; h: number }): PassScorePlace {
  const end = layout.barlines.find((b) => b.kind === 'final') ?? layout.barlines[layout.barlines.length - 1];
  if (!end) return { x: 0, y: 0, ...size, system: 0 };
  const gap = Math.round(layout.staffSpace / 4);
  const x = Math.max(0, Math.min(end.x + gap, layout.width - size.w));
  return { x, y: Math.max(0, Math.round((end.y1 + end.y2 - size.h) / 2)), ...size, system: end.system };
}

/**
 * The pass's numbers (d312: its share right, wrong keys and timing, no words) in a row under the staff, ending at its final
 * bar line, a third of a staff space under the bottom line and the stars, so they cross neither the staff's lines nor its
 * bar line, and stay on the paper where the stars reach its edge. Pure.
 */
export function passNumbersPlace(layout: Pick<StaffLayout, 'staffSpace' | 'width' | 'barlines'>, stars: PassScorePlace, size: { w: number; h: number }): PassScorePlace {
  const end = layout.barlines.find((b) => b.kind === 'final') ?? layout.barlines[layout.barlines.length - 1];
  const bottom = Math.max(stars.y + stars.h, end?.y2 ?? 0);
  const x = Math.max(0, Math.min(end?.x ?? layout.width, layout.width) - size.w);
  return { x, y: Math.round(bottom + layout.staffSpace / 3), ...size, system: stars.system };
}
