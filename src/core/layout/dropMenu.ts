import type { Rect } from './rect';

/**
 * A drop-down menu: a panel of choices that opens from a button, so a setting with many values (the 15 key
 * signatures) is one press on the choice itself instead of a cycle that a single extra press throws past. Pure.
 */
export interface DropMenuSpec {
  /** The button the menu opens from. */
  anchor: Rect;
  /** Every cell has this size; a menu of choices reads as a grid of equal buttons. */
  cell: { w: number; h: number };
  /** Cells, empty ones included (a gap in a grid keeps a column lined up). */
  count: number;
  /** Cells per row; rows fill left to right, top to bottom. */
  columns: number;
  /** Between cells, and from the panel's frame to the cells. */
  gap: number;
  pad: number;
  /** The screen the panel must stay on. */
  bounds: Rect;
  /** Which side of the button the menu opens on when it fits there (default below); a band item's opens above, toward the staff. */
  open?: 'below' | 'above';
}

export interface DropMenuLayout {
  panel: Rect;
  cells: Rect[];
}

/** Space between the button and its menu. */
const DROP = 1;

/**
 * Where the menu and each cell go: under the button (or above it, with `open: 'above'`) from its left edge, moved left to
 * stay on the screen, or on the other side when there is no room on the first. The panel never covers its button, so the choice it opened from stays in view.
 */
export function dropMenuLayout(spec: DropMenuSpec): DropMenuLayout {
  const { anchor, cell, count, gap, pad, bounds } = spec;
  const columns = Math.max(1, Math.min(spec.columns, count));
  const rows = Math.max(1, Math.ceil(count / columns));
  const w = columns * cell.w + (columns - 1) * gap + 2 * pad;
  const h = rows * cell.h + (rows - 1) * gap + 2 * pad;
  const right = bounds.x + bounds.w;
  const bottom = bounds.y + bounds.h;
  const x = Math.max(bounds.x, Math.min(right - w, anchor.x));
  const below = anchor.y + anchor.h + DROP;
  const above = anchor.y - DROP - h;
  const y = spec.open === 'above' ? (above >= bounds.y ? above : below) : below + h <= bottom ? below : Math.max(bounds.y, above);
  const cells = Array.from({ length: count }, (_, i) => ({
    x: x + pad + (i % columns) * (cell.w + gap),
    y: y + pad + Math.floor(i / columns) * (cell.h + gap),
    w: cell.w,
    h: cell.h,
  }));
  return { panel: { x, y, w, h }, cells };
}
