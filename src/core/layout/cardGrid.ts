import type { Rect } from './rect';

/** Two columns of cards from this screen width up (art pixels); a narrower screen gets one. */
export const TWO_COLUMNS_MIN_WIDTH = 300;
export const CARD_COLUMN_GAP = 4;
/** Room kept free under the last row of cards, and under the pager. */
export const LIST_BOTTOM_MARGIN = 6;
export const PAGER_HEIGHT = 18;
export const PAGER_BUTTON_WIDTH = 60;
/** Previous and Next sit this far left and right of the screen's centre. */
export const PAGER_OFFSET = 62;
/** What the pager row takes from the list: the row itself and a gap above it. */
const PAGER_RESERVE = PAGER_HEIGHT + 4;
/** The page label's top sits this far above the pager's centre line, so a line of text is centred on it. */
const PAGER_LABEL_RISE = 3;

export interface CardGridOptions {
  /** Screen size in art pixels. */
  width: number;
  height: number;
  /** Top of the first row, and the left and right margin. */
  top: number;
  margin: number;
  rowHeight: number;
  rowGap: number;
  /** Room between the two columns: `CARD_COLUMN_GAP` when not given (a book's gutter is wider, ft_1_08). */
  columnGap?: number;
}

export interface CardGrid {
  columns: number;
  cardWidth: number;
  /** Cards that fit when the list needs no pager. */
  singlePageMax: number;
  /** Cards per page once there is a pager row. */
  perPage: number;
  /** The box of the `index`th card on the page, left to right, then down. */
  cell(index: number): Rect;
  /** The box of the `index`th card on a page of `capacity` cards (`perPage`, or `singlePageMax` unpaged) read as a book: down the left column, then down the right. */
  pageCell(index: number, capacity: number): Rect;
}

/**
 * Cards in one or two columns, as many rows as fit above the bottom margin (the menu's pieces and the piece switch list).
 * Feed `singlePageMax` and `perPage` to `pageOf`.
 */
export function cardGrid(options: CardGridOptions): CardGrid {
  const { width, height, top, margin, rowHeight, rowGap } = options;
  const gap = options.columnGap ?? CARD_COLUMN_GAP;
  const columns = width >= TWO_COLUMNS_MIN_WIDTH ? 2 : 1;
  const cardWidth = Math.floor((width - 2 * margin - (columns - 1) * gap) / columns);
  const rowsFor = (reserved: number) => Math.max(1, Math.floor((height - top - LIST_BOTTOM_MARGIN - reserved + rowGap) / (rowHeight + rowGap)));
  const at = (column: number, row: number): Rect => ({ x: margin + column * (cardWidth + gap), y: top + row * (rowHeight + rowGap), w: cardWidth, h: rowHeight });
  return {
    columns,
    cardWidth,
    singlePageMax: columns * rowsFor(0),
    perPage: columns * rowsFor(PAGER_RESERVE),
    cell: (index) => at(index % columns, Math.floor(index / columns)),
    pageCell: (index, capacity) => {
      const rows = Math.max(1, Math.ceil(capacity / columns));
      return at(Math.floor(index / rows), index % rows);
    },
  };
}

export interface PagerBoxes {
  previous: Rect;
  next: Rect;
  /** Where the "page 2 of 3" label goes: its top, and the x it is centred on. */
  labelY: number;
  centreX: number;
}

/** The pager row at the bottom of a card list: Previous left of the centre, Next right of it, the page label between. */
export function pagerBoxes(width: number, height: number): PagerBoxes {
  const y = height - LIST_BOTTOM_MARGIN - PAGER_HEIGHT;
  const centreX = width / 2;
  const box = (x: number): Rect => ({ x, y, w: PAGER_BUTTON_WIDTH, h: PAGER_HEIGHT });
  return {
    previous: box(centreX - PAGER_OFFSET - PAGER_BUTTON_WIDTH / 2),
    next: box(centreX + PAGER_OFFSET - PAGER_BUTTON_WIDTH / 2),
    labelY: y + PAGER_HEIGHT / 2 - PAGER_LABEL_RISE,
    centreX,
  };
}
