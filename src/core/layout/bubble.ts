import { rectRight, type Rect } from './rect';

/**
 * Actions without a band (ft_1_20, d282): a press of the right button (a long press on a tablet) opens a bubble of what
 * can be done with the thing under the pointer, each option in a fixed slot of a ring round it; an option with choices
 * opens them in a row beside the bubble. A screen may pin its few most-used actions in one slim row along its foot; the
 * items a student keeps are in the backpack. Pure: the scenes only draw these boxes. Coordinates are layout cells.
 *
 * AX-3 provisional: eight slots, options 22 x 22 on a ring of radius 36, choices 22 x 22, cells of the strip 30 x 15.
 */
export const BUBBLE_SLOTS = 8;
const OPTION = 22;
const RING = 36;
const HALF = RING + OPTION / 2;
const CHOICE = 22;
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
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

/** The bubble for `options` options (at most `BUBBLE_SLOTS`) opened at `at` on a screen `screen` cells large. */
export function bubbleLayout(input: { at: { x: number; y: number }; options: number; screen: { w: number; h: number }; open?: { option: number; choices: number } }): BubbleLayout {
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
    const width = n * CHOICE + (n - 1) * CHOICE_GAP;
    const right = rectRight(area) + AWAY;
    const x = right + width <= input.screen.w ? right : area.x - AWAY - width >= 0 ? area.x - AWAY - width : clamp(right, 0, input.screen.w - width);
    const y = Math.round(clamp(open.y + (OPTION - CHOICE) / 2, 0, input.screen.h - CHOICE));
    for (let i = 0; i < n; i++) choices.push({ x: x + i * (CHOICE + CHOICE_GAP), y, w: CHOICE, h: CHOICE });
  }
  return { centre, area, options, choices };
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
export const PIN_COLUMNS = 6;
const PIN_CELL = { w: 30, h: 15 } as const;
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
 * that does not fit on, they go to the bubble instead.
 */
export function pinFlow(input: { spans: readonly number[] }): { placed: { action: number; rect: Rect; span: number }[]; toBubble: number[] } {
  const placed: { action: number; rect: Rect; span: number }[] = [];
  const toBubble: number[] = [];
  let column = 0;
  input.spans.forEach((raw, action) => {
    const span = Math.min(PIN_COLUMNS, Math.max(1, Math.floor(raw)));
    if (toBubble.length > 0 || column + span > PIN_COLUMNS) {
      toBubble.push(action);
      return;
    }
    placed.push({ action, rect: { x: PIN_EDGE + column * (PIN_CELL.w + PIN_GAP), y: PIN_TOP, w: span * PIN_CELL.w + (span - 1) * PIN_GAP, h: PIN_CELL.h }, span });
    column += span;
  });
  return { placed, toBubble };
}
