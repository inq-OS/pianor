import type { StaffLayout } from './staff';

/**
 * The bar under a point of the staff (layout pixels), or null when the point is on no bar of that page: used to mark the first
 * and last bar of a section by clicking. The target is generous, a few staff spaces above and below the lines, for small fingers.
 */
export function barAtPoint(layout: StaffLayout, x: number, y: number, page = 0): number | null {
  const reach = 3 * layout.staffSpace;
  for (const bar of layout.bars) {
    const system = layout.systems[bar.system]!;
    if (system.page !== page) continue;
    if (x >= bar.x && x < bar.x + bar.width && y >= system.topLineY - reach && y <= system.bottomLineY + reach) return bar.index;
  }
  return null;
}
