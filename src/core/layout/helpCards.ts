import type { Rect } from './rect';
import type { Size } from './talk';

/**
 * Where the piece maker's F1 help puts its cards (ft_1_33.AC2): a grid of `columns`, row by row, centred in the panel, the
 * Keys button centred under it. Inside a card, from the left: the held key's cap (right-aligned in its zone, so every mouse
 * stands in one column), the small mouse, the staff before, the arrow, the staff after, each centred on the card's middle.
 * Pure, in art pixels; the scene draws it.
 */
export const HELP_GRID = {
  /** Inside the panel's edge. */
  pad: 5,
  /** Between two columns of cards. */
  column: 18,
  /** Between two rows, and between the last row and the Keys button. */
  row: 5,
  /** Between the parts of a card. */
  inside: 3,
} as const;

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface HelpParts {
  /** The widest key cap: its zone. */
  readonly cap: Size;
  /** The small mouse with the sign beside it (the wheel's arrow, the drag's arrow). */
  readonly mouse: Size;
  readonly sketch: Size;
  readonly arrow: Size;
}

export interface HelpCardPlan {
  readonly box: Rect;
  /** The right edge of the cap's zone and the cap's top: a narrower cap ends here too. */
  readonly capRight: number;
  readonly capY: number;
  readonly mouse: Point;
  readonly before: Point;
  readonly arrow: Point;
  readonly after: Point;
}

export interface HelpGridLayout {
  readonly cards: readonly HelpCardPlan[];
  readonly keys: Rect;
  /** How high the panel must be to hold it all. */
  readonly height: number;
}

export function helpCardSize(parts: HelpParts): Size {
  const { inside } = HELP_GRID;
  return {
    w: parts.cap.w + inside + parts.mouse.w + inside + parts.sketch.w + inside + parts.arrow.w + inside + parts.sketch.w,
    h: Math.max(parts.cap.h, parts.mouse.h, parts.sketch.h, parts.arrow.h),
  };
}

export function helpGridLayout(input: { panel: Rect; count: number; columns: number; parts: HelpParts; keys: Size }): HelpGridLayout {
  const { panel, count, columns, parts, keys } = input;
  const { pad, column, row, inside } = HELP_GRID;
  const card = helpCardSize(parts);
  const rows = Math.ceil(count / columns);
  const gridW = columns * card.w + (columns - 1) * column;
  const left = panel.x + Math.max(pad, Math.floor((panel.w - gridW) / 2));
  const top = panel.y + pad;
  const mid = (h: number) => Math.floor((card.h - h) / 2);
  const cards: HelpCardPlan[] = [];
  for (let i = 0; i < count; i++) {
    const x = left + (i % columns) * (card.w + column);
    const y = top + Math.floor(i / columns) * (card.h + row);
    const mouseX = x + parts.cap.w + inside;
    const beforeX = mouseX + parts.mouse.w + inside;
    const arrowX = beforeX + parts.sketch.w + inside;
    cards.push({
      box: { x, y, w: card.w, h: card.h },
      capRight: x + parts.cap.w,
      capY: y + mid(parts.cap.h),
      mouse: { x: mouseX, y: y + mid(parts.mouse.h) },
      before: { x: beforeX, y: y + mid(parts.sketch.h) },
      arrow: { x: arrowX, y: y + mid(parts.arrow.h) },
      after: { x: arrowX + parts.arrow.w + inside, y: y + mid(parts.sketch.h) },
    });
  }
  const gridBottom = top + rows * card.h + (rows - 1) * row;
  const keysBox: Rect = { x: panel.x + Math.floor((panel.w - keys.w) / 2), y: gridBottom + row, w: keys.w, h: keys.h };
  return { cards, keys: keysBox, height: keysBox.y + keysBox.h + pad - panel.y };
}
