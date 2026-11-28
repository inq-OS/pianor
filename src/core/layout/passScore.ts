import type { StaffLayout } from './staffTypes';

/** Where the score of a finished pass is drawn on the staff (ft_1_12): a box in layout pixels, and the system it belongs to. */
export interface PassScorePlace {
  x: number;
  y: number;
  w: number;
  h: number;
  system: number;
}

type RowLayout = Pick<StaffLayout, 'staffSpace' | 'width' | 'height' | 'barlines'> & {
  notes: readonly { system: number; y: number; headRy: number; stem: { y1: number; y2: number } | null }[];
};

/**
 * A row of marks under line `system` (d312), ending at its last bar line, a third of a staff space under the lower of its
 * bottom staff line and its lowest note (head and stem): it crosses neither the staff's lines, its bar line nor its notes,
 * and stays on the paper. Pulled in to stay on the layout. Pure: the view only draws it.
 */
export function rowUnderSystem(layout: RowLayout, system: number, size: { w: number; h: number }): PassScorePlace {
  const lines = layout.barlines.filter((b) => b.system === system);
  if (lines.length === 0) return { x: 0, y: 0, ...size, system };
  const end = lines.reduce((a, b) => (b.x > a.x ? b : a));
  const notes = layout.notes.filter((n) => n.system === system).map((n) => Math.max(n.y + n.headRy, n.stem ? Math.max(n.stem.y1, n.stem.y2) : -Infinity));
  const bottom = Math.max(end.y2, ...notes);
  const x = Math.max(0, Math.min(end.x, layout.width) - size.w);
  const y = Math.max(0, Math.min(Math.round(bottom + layout.staffSpace / 3), layout.height - size.h));
  return { x, y, ...size, system };
}

/**
 * The score of a pass (its stars, then its numbers, d312) goes in that row under the piece's last line, ending at its
 * final bar line (`rowUnderSystem`), with room for stars big enough to read at a glance.
 */
export function passScorePlace(layout: RowLayout, size: { w: number; h: number }): PassScorePlace {
  const end = layout.barlines.find((b) => b.kind === 'final') ?? layout.barlines[layout.barlines.length - 1];
  if (!end) return { x: 0, y: 0, ...size, system: 0 };
  return rowUnderSystem(layout, end.system, size);
}
