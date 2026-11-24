import { rectBottom, rectRight, type Rect } from './rect';

/** Distance from the screen's left and top edge to the left column, and from the right edge to the numbers. */
export const RESULTS_EDGE = 8;
const LEFT_WIDTH = 124;
/** The numbers column starts this far right of the left column. */
const NUMBERS_GAP = 10;
const NUMBERS_TOP = 8;
const BUTTON_HEIGHT = 18;
/** The buttons are small icons (the clean-screen rule, ft_1_12.AC7). */
const BUTTON_WIDTH = 24;
const BUTTON_GAP = 4;
/** The lower button's bottom edge sits this far above the screen's bottom. */
const BUTTON_BOTTOM = 11;

export interface ResultsLayout {
  /** The celebration column: title, Kiur, and the two buttons at its foot. */
  left: Rect;
  /** Play again (left) and back to the pieces (right of it): two small icon buttons on one row. */
  again: Rect;
  back: Rect;
  /** A third small button right of the two, for a screen that has one (the stats page's other view, ft_1_32.AC8). */
  more: Rect;
  /** The numbers: what was played and earned, written top-down from `numbers.y`. */
  numbers: Rect;
}

/**
 * The screens after playing (results, the stats page, the Free play rundown) share one frame: a left column that cheers,
 * with its two buttons at the bottom, and the numbers on the right. Art pixels; pure, so the three screens cannot drift.
 * `rightInset` keeps the numbers clear of something in the top right corner (the band's gear, ft_1_20.AC2).
 */
export function resultsLayout(width: number, height: number, options: { rightInset?: number } = {}): ResultsLayout {
  const left: Rect = { x: RESULTS_EDGE, y: RESULTS_EDGE, w: LEFT_WIDTH, h: height - 2 * RESULTS_EDGE };
  const again: Rect = { x: left.x, y: height - BUTTON_BOTTOM - BUTTON_HEIGHT, w: BUTTON_WIDTH, h: BUTTON_HEIGHT };
  const back: Rect = { ...again, x: again.x + BUTTON_WIDTH + BUTTON_GAP };
  const numbersX = rectRight(left) + NUMBERS_GAP;
  const numbers: Rect = { x: numbersX, y: NUMBERS_TOP, w: width - numbersX - Math.max(RESULTS_EDGE, options.rightInset ?? 0), h: height - NUMBERS_TOP - RESULTS_EDGE };
  const more: Rect = { ...back, x: back.x + BUTTON_WIDTH + BUTTON_GAP };
  return { left, again, back, more, numbers };
}

/** Room left of the score screen's graph for its percent labels, and under it for the dates (ft_1_12.AC4). */
const GRAPH_LABELS_LEFT = 22;
const GRAPH_LABELS_BELOW = 11;
/**
 * A graph lower than this says too little: the screen leaves it out. AX-3 provisional (d110): 24 cells, about the old 30 art
 * pixels' height on the screen (6 screen pixels a cell, 5 before), so the 320 x 157 main area keeps its graph.
 */
export const GRAPH_MIN_HEIGHT = 24;

/**
 * The development graph on the score screen (ft_1_12.AC4): the rest of the numbers column from `top` down, with room for
 * the percent labels on its left and the dates under it; null when less than `GRAPH_MIN_HEIGHT` rows are left.
 */
export function scoreGraphPlot(numbers: Rect, top: number): Rect | null {
  const plot: Rect = { x: numbers.x + GRAPH_LABELS_LEFT, y: top, w: numbers.w - GRAPH_LABELS_LEFT, h: rectBottom(numbers) - top - GRAPH_LABELS_BELOW };
  return plot.h >= GRAPH_MIN_HEIGHT ? plot : null;
}
