import { rectRight, type Rect } from './rect';

/**
 * The action and inventory band along the foot of every screen (ft_1_20, d115), in the manner of the classic point-and-click
 * games: a 3 x 3 grid of the screen's actions at the left, an arrow column and two rows of item slots. No line of text
 * (no text in the band): a cell or slot names itself in a tooltip bubble. Pure: `PixelScene` only
 * draws it. Coordinates count layout cells from the band's top-left corner.
 *
 * AX-3 provisional (ft_1_20): the sizes are the architect's first fit, the cells made taller when the text line went so a
 * painted place keeps its 124 rows; the painter may move them inside the band's rows, and these tests move with them.
 */
export const BAND_ROWS = 56;
/** Cells in the action grid, numbered 0 to 8 row by row (rule 6: a later piano mapping names a cell by its index). */
export const BAND_CELLS = 9;
const GRID_COLUMNS = 3;
const TOP = 1;
const CELL = { w: 46, h: 18 } as const;
const CELL_GAP = 1;
const SLOT = { w: 38, h: 27 } as const;
const SLOT_GAP = 1;
const SLOT_ROWS = 2;
const ARROW_WIDTH = 12;
const EDGE = 2;
/** Room between the grid and the arrows, and between the arrows and the slots. */
const GROUP_GAP = 3;
const ARROW_GAP = 2;

export interface BandLayout {
  /** The nine action cells, row by row. */
  cells: Rect[];
  arrows: { up: Rect; down: Rect };
  /** The item slots, row by row: two rows, four columns at 320 wide and more on a wider screen. */
  slots: Rect[];
}

/** The band on a screen `width` layout cells wide. */
export function bandLayout(width: number): BandLayout {
  const cells = Array.from({ length: BAND_CELLS }, (_, i) => ({
    x: EDGE + (i % GRID_COLUMNS) * (CELL.w + CELL_GAP),
    y: TOP + Math.floor(i / GRID_COLUMNS) * CELL.h,
    w: CELL.w,
    h: CELL.h,
  }));
  const arrowX = rectRight(cells[GRID_COLUMNS - 1]!) + GROUP_GAP;
  const up = { x: arrowX, y: TOP, w: ARROW_WIDTH, h: SLOT.h };
  const down = { x: arrowX, y: TOP + SLOT.h + SLOT_GAP, w: ARROW_WIDTH, h: SLOT.h };
  const slotX = rectRight(up) + ARROW_GAP;
  const columns = Math.max(0, Math.floor((width - EDGE - slotX + SLOT_GAP) / (SLOT.w + SLOT_GAP)));
  const slots: Rect[] = [];
  for (let row = 0; row < SLOT_ROWS; row++) {
    for (let column = 0; column < columns; column++) slots.push({ x: slotX + column * (SLOT.w + SLOT_GAP), y: TOP + row * (SLOT.h + SLOT_GAP), w: SLOT.w, h: SLOT.h });
  }
  return { cells, arrows: { up, down }, slots };
}

/** What a cell shows: one of the screen's actions (its number in the screen's list), More, or nothing. */
export type BandCell = { action: number } | 'more' | null;

/**
 * Which action goes in which cell: the screen's actions by index. Back and Settings are not in the grid
 * (the door and the gear stay in the screen's top corners, `frameCorners`). AX-3 provisional (ft_1_20 rule 4):
 * with more than nine actions the last cell (bottom right) is More, which turns the grid to the next set (`page`, wrapping
 * round).
 */
export function bandCells(input: { actions: number; page: number }): { cells: BandCell[]; page: number; pages: number } {
  const cells: BandCell[] = Array.from({ length: BAND_CELLS }, () => null);
  const paged = input.actions > BAND_CELLS;
  const perPage = paged ? BAND_CELLS - 1 : BAND_CELLS;
  const pages = Math.max(1, Math.ceil(input.actions / perPage));
  const page = ((Math.floor(input.page) % pages) + pages) % pages;
  if (paged) cells[BAND_CELLS - 1] = 'more';
  const first = page * perPage;
  for (let i = 0; i < perPage && first + i < input.actions; i++) cells[i] = { action: first + i };
  return { cells, page, pages };
}

/** Which items show in the slots (rule 5): a page of `slots` at a time, turned by the arrows; `up`/`down` say which arrow works. */
export function bandItemPage(input: { items: number; slots: number; page: number }): { page: number; pages: number; first: number; count: number; up: boolean; down: boolean } {
  const per = Math.max(1, input.slots);
  const pages = Math.max(1, Math.ceil(input.items / per));
  const page = Math.min(pages - 1, Math.max(0, Math.floor(input.page)));
  const first = page * per;
  return { page, pages, first, count: Math.max(0, Math.min(per, input.items - first)), up: page > 0, down: page < pages - 1 };
}

/**
 * The wheel over an item with choices (ft_1_20.AC16): the index of the next choice that can be picked,
 * down the list for a wheel turned toward the person (`dy` > 0), up for away; null at the end (no wrap, as the length wheel).
 * With no choice lit it takes the first that can be picked.
 */
export function wheelChoice(choices: readonly ({ active?: boolean; disabled?: boolean } | null)[], dy: number): number | null {
  if (dy === 0) return null;
  const pickable = (i: number) => choices[i] !== null && choices[i] !== undefined && !choices[i].disabled;
  const at = choices.findIndex((c) => c?.active);
  if (at < 0) {
    const first = choices.findIndex((_, i) => pickable(i));
    return first < 0 ? null : first;
  }
  const step = dy > 0 ? 1 : -1;
  for (let i = at + step; i >= 0 && i < choices.length; i += step) if (pickable(i)) return i;
  return null;
}

/** The wheel over the inventory (ft_1_20.AC16): the page one turn moves to, or null when it is already the first or last. */
export function wheelPage(input: { items: number; slots: number; page: number }, dy: number): number | null {
  if (dy === 0) return null;
  const now = bandItemPage(input);
  const next = now.page + (dy > 0 ? 1 : -1);
  return next < 0 || next >= now.pages ? null : next;
}

/**
 * The quiet band (ft_1_20 rule 8): only what is used is drawn, and the band is as tall as what it holds: no band on a
 * screen with nothing in it, one row of cells and slots, or two. `BAND_ROWS` stays the full board a conversation's
 * choices and the tug use. AX-3 provisional: five columns of cells 30 x 15, slots of the same size.
 */
export const QUIET_COLUMNS = 5;
const QUIET_CELL = { w: 30, h: 15 } as const;
/** The quiet band's height in rows: one row of cells or two, touching as the cells of `bandLayout` do, a line above and below. */
export const QUIET_ROWS = { one: TOP + QUIET_CELL.h + 1, two: TOP + 2 * QUIET_CELL.h + 1 } as const;

/** How tall the quiet band is for a screen with `actionCells` cells of actions (their spans added) and `items` items. */
export function quietBandRows(input: { actionCells: number; items: number; slotsPerRow: number }): number {
  if (input.actionCells <= 0 && input.items <= 0) return 0;
  return input.actionCells <= QUIET_COLUMNS && input.items <= input.slotsPerRow ? QUIET_ROWS.one : QUIET_ROWS.two;
}

/** The quiet band's grid of cells (row by row, `QUIET_COLUMNS` a row), its arrows and its slots (`rows` rows), `width` cells wide. */
export function quietBandLayout(width: number, rows: 1 | 2): BandLayout {
  const step = QUIET_CELL.h;
  const cells: Rect[] = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < QUIET_COLUMNS; column++) cells.push({ x: EDGE + column * (QUIET_CELL.w + CELL_GAP), y: TOP + row * step, w: QUIET_CELL.w, h: QUIET_CELL.h });
  }
  const arrowX = EDGE + QUIET_COLUMNS * (QUIET_CELL.w + CELL_GAP) + GROUP_GAP;
  // two rows: the down arrow under the up arrow; one row: side by side, as half a row would be under 15 rows high
  const up = { x: arrowX, y: TOP, w: ARROW_WIDTH, h: QUIET_CELL.h };
  const down = rows === 2 ? { x: arrowX, y: TOP + step, w: ARROW_WIDTH, h: QUIET_CELL.h } : { x: arrowX + ARROW_WIDTH + 1, y: TOP, w: ARROW_WIDTH, h: QUIET_CELL.h };
  const slotX = rectRight(rows === 2 ? up : down) + ARROW_GAP;
  const columns = Math.max(0, Math.floor((width - EDGE - slotX + SLOT_GAP) / (QUIET_CELL.w + SLOT_GAP)));
  const slots: Rect[] = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) slots.push({ x: slotX + column * (QUIET_CELL.w + SLOT_GAP), y: TOP + row * step, w: QUIET_CELL.w, h: QUIET_CELL.h });
  }
  return { cells, arrows: { up, down }, slots };
}

/** How many cells of a row a word `wordWidth` wide needs in cells `cellWidth` wide (ft_1_20.AC18: never cut short). */
export function cellSpan(wordWidth: number, cellWidth: number): number {
  const span = 1 + Math.max(0, Math.ceil((wordWidth - cellWidth) / (cellWidth + CELL_GAP)));
  return Math.min(QUIET_COLUMNS, span);
}

export interface BandFlow {
  /** Each action shown on this page: its row, first column and how many cells it takes. */
  placed: { action: number; row: number; column: number; span: number }[];
  /** Where More stands (the last cell) when the actions take more than one page, else null. */
  more: { row: number; column: number } | null;
  page: number;
  pages: number;
}

/**
 * The quiet band's actions (ft_1_20 rules 4 and 6, AC18): in their order, left to right and row by row, each taking
 * `spans[i]` cells; one that does not fit the rest of its row starts the next. With more than fits, the last cell is More,
 * which turns to the next page (wrapping round).
 */
export function bandFlow(input: { spans: readonly number[]; rows: 1 | 2; page: number }): BandFlow {
  const spans = input.spans.map((s) => Math.min(QUIET_COLUMNS, Math.max(1, Math.floor(s))));
  const fill = (first: number, reserve: boolean): { placed: BandFlow['placed']; next: number } => {
    const placed: BandFlow['placed'] = [];
    let row = 0, column = 0, i = first;
    while (i < spans.length && row < input.rows) {
      const last = row === input.rows - 1;
      const room = QUIET_COLUMNS - (reserve && last ? 1 : 0);
      if (column + spans[i]! > room) {
        // a page must show something: an action as wide as the whole row, alone on a last row that also holds More, gets
        // the room left (only a one-row band that pages, which `quietBandRows` never makes, comes here)
        if (placed.length === 0 && last) {
          placed.push({ action: i, row, column, span: room });
          i += 1;
          break;
        }
        row += 1;
        column = 0;
        continue;
      }
      placed.push({ action: i, row, column, span: spans[i]! });
      column += spans[i]!;
      i += 1;
    }
    return { placed, next: i };
  };
  const whole = fill(0, false);
  if (whole.next >= spans.length) return { placed: whole.placed, more: null, page: 0, pages: 1 };
  const starts = [0];
  for (let at = 0; ; ) {
    const next = fill(at, true).next;
    if (next >= spans.length || next === at) break;
    starts.push(next);
    at = next;
  }
  const pages = starts.length;
  const page = ((Math.floor(input.page) % pages) + pages) % pages;
  return { placed: fill(starts[page]!, true).placed, more: { row: input.rows - 1, column: QUIET_COLUMNS - 1 }, page, pages };
}
