import { rectBottom, type Rect } from './rect';

const EDGE = 6;
const BACK = { w: 48, h: 16 };
const GAP = 4;
/** The staff of the whole piece on top, in art pixels, then the graph and the weakest sections side by side. */
const STAFF_SHARE = 0.42;
const PERCENT_LABELS = 24;
const CARD_HEIGHT = 14;

export interface AnalyzeLayout {
  back: Rect;
  title: Rect;
  /** Where the staff is drawn (the piece, bars tinted by heat). */
  staff: Rect;
  /** The graph's title line, and its plot (accuracy 100 percent on its top row). */
  graphTitle: Rect;
  plot: Rect;
  /** One card per weakest section, top to bottom, right of the graph. */
  cards: Rect[];
}

/** The Analyze screen (core_10.AC8): Back and the title, the staff, then the graph at the left and up to three section cards at the right. */
export function analyzeLayout(width: number, height: number, cardCount = 3): AnalyzeLayout {
  const back: Rect = { x: EDGE, y: 4, w: BACK.w, h: BACK.h };
  const title: Rect = { x: back.x + back.w + GAP, y: back.y + 4, w: width - back.w - GAP - 2 * EDGE, h: back.h };
  const staff: Rect = { x: 0, y: rectBottom(back) + GAP, w: width, h: Math.floor((height - rectBottom(back)) * STAFF_SHARE) };
  const below = rectBottom(staff) + GAP;
  const graphWidth = Math.floor((width - 2 * EDGE) * 0.5);
  const graphTitle: Rect = { x: EDGE, y: below, w: graphWidth, h: 8 };
  const plot: Rect = { x: EDGE + PERCENT_LABELS, y: rectBottom(graphTitle) + GAP + 3, w: graphWidth - PERCENT_LABELS, h: height - rectBottom(graphTitle) - GAP - 3 - EDGE };
  const cardX = EDGE + graphWidth + GAP;
  const cards: Rect[] = Array.from({ length: cardCount }, (_, i) => ({ x: cardX, y: below + i * (CARD_HEIGHT + 3), w: width - cardX - EDGE, h: CARD_HEIGHT }));
  return { back, title, staff, graphTitle, plot, cards };
}

/** The warmest colour a hot bar gets (a soft red) and the faintest (the paper's pale yellow); under `MIN_HEAT` a bar has no tint. */
const COOL = [0xfb, 0xeb, 0xbc] as const;
const HOT = [0xf0, 0x9a, 0x8a] as const;
export const MIN_HEAT = 0.05;

/** The background of a bar by its heat (0 to 1): null when it is cool or unplayed, else a pale yellow warming to a soft red. Never a cross or a count. */
export function heatColour(heat: number | null): number | null {
  if (heat === null || heat < MIN_HEAT) return null;
  const k = Math.min(1, heat);
  const channel = (i: 0 | 1 | 2) => Math.round(COOL[i] + (HOT[i] - COOL[i]) * k);
  return (channel(0) << 16) | (channel(1) << 8) | channel(2);
}
