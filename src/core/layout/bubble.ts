import { rectRight, type Rect } from './rect';

/**
 * Actions without a band (ft_1_20, d282): a press of the right button (a long press on a tablet) opens a bubble of what
 * can be done with the thing under the pointer, each option in a fixed slot of a ring round it; an option with choices
 * opens them in a row beside the bubble. A screen may pin its few most-used actions in one slim row along its foot; the
 * items a student keeps are in the backpack. Pure: the scenes only draw these boxes. Coordinates are layout cells.
 *
 * AX-3 provisional: eight slots, options 18 x 18 on a ring of radius 29 (two cells at least between neighbours, so a small
 * hand does not slip onto the next), a Close target in the centre, choices 18 x 18, cells of the strip 30 x 15.
 */
export const BUBBLE_SLOTS = 8;
const OPTION = 18;
const RING = 29;
const HALF = RING + OPTION / 2;
const CHOICE = 18;
const CHOICE_GAP = 2;
const AWAY = 4;

export interface BubbleLayout {
  /** The ring's centre: the pointer, moved only as far as the whole bubble needs to stay on the screen. */
  centre: { x: number; y: number };
  /** The square the bubble is drawn in. */
  area: Rect;
  /** The option in each slot used, slot 0 straight above the centre and then clockwise. */
  options: Rect[];
  /** The open option's choices, left to right, or none. */
  choices: Rect[];
  /** The Close target in the centre of the ring. */
  close: Rect;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

/** The bubble for `options` options (at most `BUBBLE_SLOTS`) opened at `at` on a screen `screen` cells large. */
export function bubbleLayout(input: { at: { x: number; y: number }; options: number; screen: { w: number; h: number }; open?: { option: number; choices: number; widths?: readonly number[] } }): BubbleLayout {
  const centre = { x: Math.round(clamp(input.at.x, HALF, input.screen.w - HALF)), y: Math.round(clamp(input.at.y, HALF, input.screen.h - HALF)) };
  const area = { x: centre.x - HALF, y: centre.y - HALF, w: 2 * HALF, h: 2 * HALF };
  const options: Rect[] = [];
  for (let i = 0; i < Math.min(BUBBLE_SLOTS, Math.max(0, input.options)); i++) {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / BUBBLE_SLOTS;
    options.push({ x: Math.round(centre.x + RING * Math.cos(angle) - OPTION / 2), y: Math.round(centre.y + RING * Math.sin(angle) - OPTION / 2), w: OPTION, h: OPTION });
  }
  const choices: Rect[] = [];
  const open = input.open && input.open.choices > 0 ? options[input.open.option] : undefined;
  if (open && input.open) {
    const n = input.open.choices;
    // a choice that is a word is as wide as its word (AC18), never narrower than a square
    const widths = Array.from({ length: n }, (_, i) => Math.max(CHOICE, Math.ceil(input.open?.widths?.[i] ?? CHOICE)));
    const width = widths.reduce((sum, w) => sum + w, 0) + (n - 1) * CHOICE_GAP;
    const right = rectRight(area) + AWAY;
    const x = right + width <= input.screen.w ? right : area.x - AWAY - width >= 0 ? area.x - AWAY - width : clamp(right, 0, input.screen.w - width);
    const y = Math.round(clamp(open.y + (OPTION - CHOICE) / 2, 0, input.screen.h - CHOICE));
    let left = x;
    for (const w of widths) {
      choices.push({ x: left, y, w, h: CHOICE });
      left += w + CHOICE_GAP;
    }
  }
  const close = { x: centre.x - OPTION / 2, y: centre.y - OPTION / 2, w: OPTION, h: OPTION };
  return { centre, area, options, choices, close };
}

/**
 * Which option goes in which slot (ft_1_20.AC19): the options by their index; with more than `BUBBLE_SLOTS` the last slot is
 * More, which turns to the next page (wrapping round).
 */
export function bubblePage(input: { options: number; page: number }): { slots: (number | 'more' | null)[]; page: number; pages: number } {
  const paged = input.options > BUBBLE_SLOTS;
  const per = paged ? BUBBLE_SLOTS - 1 : BUBBLE_SLOTS;
  const pages = Math.max(1, Math.ceil(input.options / per));
  const page = ((Math.floor(input.page) % pages) + pages) % pages;
  const slots: (number | 'more' | null)[] = Array.from({ length: BUBBLE_SLOTS }, () => null);
  for (let i = 0; i < per && page * per + i < input.options; i++) slots[i] = page * per + i;
  if (paged) slots[BUBBLE_SLOTS - 1] = 'more';
  return { slots, page, pages };
}

/** Cells of the pinned strip in one row. */
export const PIN_COLUMNS = 8;
/** One cell of the strip, in layout cells. */
export const PIN_CELL = { w: 30, h: 15 } as const;
const PIN_TOP = 1;
const PIN_EDGE = 2;
const PIN_GAP = 1;
/** The pinned strip's height in rows: one row of cells with a line above and below. */
export const PIN_ROWS = PIN_TOP + PIN_CELL.h + 1;

/** The strip's rows for a screen with `pinned` pinned actions: none without any (ft_1_20.AC21). */
export function pinRows(pinned: number): number {
  return pinned > 0 ? PIN_ROWS : 0;
}

/** How many cells of the strip a word `wordWidth` wide needs in cells `cellWidth` wide (ft_1_20.AC18: never cut short). */
export function cellSpan(wordWidth: number, cellWidth: number): number {
  return Math.min(PIN_COLUMNS, 1 + Math.max(0, Math.ceil((wordWidth - cellWidth) / (cellWidth + PIN_GAP))));
}

/**
 * The pinned actions in the strip (ft_1_20.AC21), left to right in their order, each `spans[i]` cells wide; from the first
 * that does not fit on, they go to the bubble instead. The screen's main action (`main`: Play again, Done) stands at the
 * strip's right end on a screen `width` cells wide, in the same place on every screen.
 */
export function pinFlow(input: { spans: readonly number[]; width?: number; main?: number }): { placed: { action: number; rect: Rect; span: number }[]; toBubble: number[] } {
  const placed: { action: number; rect: Rect; span: number }[] = [];
  const toBubble: number[] = [];
  const cellsWide = (span: number) => span * PIN_CELL.w + (span - 1) * PIN_GAP;
  const span = (i: number) => Math.min(PIN_COLUMNS, Math.max(1, Math.floor(input.spans[i]!)));
  const main = input.main !== undefined && input.width !== undefined && input.main >= 0 && input.main < input.spans.length ? input.main : null;
  let room = PIN_COLUMNS;
  if (main !== null) {
    const w = cellsWide(span(main));
    placed.push({ action: main, rect: { x: input.width! - PIN_EDGE - w, y: PIN_TOP, w, h: PIN_CELL.h }, span: span(main) });
    room -= span(main);
  }
  let column = 0;
  input.spans.forEach((_, action) => {
    if (action === main) return;
    const s = span(action);
    if (toBubble.length > 0 || column + s > room) {
      toBubble.push(action);
      return;
    }
    placed.push({ action, rect: { x: PIN_EDGE + column * (PIN_CELL.w + PIN_GAP), y: PIN_TOP, w: cellsWide(s), h: PIN_CELL.h }, span: s });
    column += s;
  });
  placed.sort((a, b) => a.rect.x - b.rect.x);
  return { placed, toBubble };
}

/**
 * The keyboard in the bubble (ft_1_20.AC22): from slot `from`, the next used slot clockwise (`step` 1) or back (-1), round
 * the ring; from -1 the first used slot. -1 when no slot is used.
 */
export function slotStep(used: readonly boolean[], from: number, step: 1 | -1): number {
  const n = used.length;
  if (!used.some(Boolean)) return -1;
  let at = from < 0 ? (step > 0 ? -1 : 0) : from;
  for (let i = 0; i < n; i++) {
    at = (((at + step) % n) + n) % n;
    if (used[at]) return at;
  }
  return -1;
}

/**
 * The long press that opens the bubble on a touch screen (ft_1_20, d282): a ring fills round the finger from `ringFromMs`
 * and the bubble opens at `openMs`; a move of more than `slopPx` screen pixels cancels it. AX-3 provisional: the times.
 */
export const LONG_PRESS = { ringFromMs: 150, openMs: 450, slopPx: 12 } as const;

/** Where a press held `elapsedMs` and moved `movedPx` screen pixels stands (ft_1_20.AC22). */
export function longPress(elapsedMs: number, movedPx: number): { state: 'wait' | 'open' | 'cancel' } | { state: 'ring'; fill: number } {
  if (movedPx > LONG_PRESS.slopPx) return { state: 'cancel' };
  if (elapsedMs >= LONG_PRESS.openMs) return { state: 'open' };
  if (elapsedMs < LONG_PRESS.ringFromMs) return { state: 'wait' };
  return { state: 'ring', fill: (elapsedMs - LONG_PRESS.ringFromMs) / (LONG_PRESS.openMs - LONG_PRESS.ringFromMs) };
}
