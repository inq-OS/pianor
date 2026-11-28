/**
 * Where a lesson's step marks go (ft_1_39): a bracket and its label above the staff, unless the label would touch the
 * label before it above the staff; that mark goes under the staff, so no two labels or brackets cross. Pure: the
 * scene measures the labels and draws each mark on its side. Layout cells.
 */

/** Room kept between two labels on the same side. */
export const MARK_LABEL_GAP = 6;

export interface MarkSpan {
  /** The bracket's ends, left to right. */
  from: number;
  to: number;
  /** The label's width; it is centred over the bracket. */
  width: number;
}

export type MarkSide = 'above' | 'below';

/** The label's left edge: centred on its bracket. */
export const markLabelX = (mark: MarkSpan): number => Math.round((mark.from + mark.to) / 2 - mark.width / 2);

/** Each mark's side, in order: above unless its label would touch the last label above. */
export function markSides(marks: readonly MarkSpan[]): MarkSide[] {
  let lastRight = Number.NEGATIVE_INFINITY;
  return marks.map((mark) => {
    const x = markLabelX(mark);
    if (x < lastRight + MARK_LABEL_GAP) return 'below';
    lastRight = x + mark.width;
    return 'above';
  });
}
