import { rectBottom, rectRight, type Rect } from './rect';

/**
 * Actions without a band (ft_1_20, d282): a press of the right button (a long press on a tablet) opens a bubble of what
 * can be done with the thing under the pointer, each option in a fixed slot of a ring round it; an option with choices
 * opens them on a second, outer ring round the bubble, centred on that option. A screen may pin its few most-used actions in one slim row along its foot; the
 * items a student keeps are in the backpack. Pure: the scenes only draw these boxes. Coordinates are layout cells.
 *
 * AX-3 provisional: eight slots, options 20 x 20 on a ring of radius 28 (a cell and a half between neighbouring round options, big enough that a picture has room round it, so a small
 * hand does not slip onto the next), a Close target in the centre, choices 18 x 18 on an outer ring of radius 56 (as close
 * as their boxes can come without touching an option's), 26 cells apart along it (so no two boxes touch, even on a slant),
 * cells of the strip 30 x 15.
 */
export const BUBBLE_SLOTS = 8;
const OPTION = 20;
const RING = 28;
const HALF = RING + OPTION / 2;
const CHOICE = 18;
const OUTER = 56;
/** The turn between neighbouring choices on the outer ring: 26 cells apart. */
const OUTER_STEP = 2 * Math.asin(13 / OUTER);
/** How many steps the outer ring may turn away from its option to stay on the screen. */
const TURN_STEPS = 2;

export interface BubbleLayout {
  /** The ring's centre: the pointer, moved only as far as the whole bubble needs to stay on the screen. */
  centre: { x: number; y: number };
  /** The square the bubble is drawn in. */
  area: Rect;
  /** The option in each slot used, slot 0 straight above the centre and then clockwise. */
  options: Rect[];
  /** The open option's choices, on the outer ring, first to last reading left to right (top to bottom at the sides), or none. */
  choices: Rect[];
  /** The Close target in the centre of the ring. */
  close: Rect;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

/** The bubble for `options` options (at most `BUBBLE_SLOTS`) opened at `at` on a screen `screen` cells large, kept below its `y`. */
export function bubbleLayout(input: { at: { x: number; y: number }; options: number; screen: { y?: number; w: number; h: number }; open?: { option: number; choices: number } }): BubbleLayout {
  // `screen.y`: rows at the top the bubble keeps off (the top strip of a screen without a toolbar); `h` counts from there
  const top = input.screen.y ?? 0;
  const bottom = top + input.screen.h;
  const slotAngle = (i: number) => -Math.PI / 2 + (2 * Math.PI * i) / BUBBLE_SLOTS;
  const box = (c: { x: number; y: number }, angle: number, radius: number, size: number): Rect => ({ x: Math.round(c.x + radius * Math.cos(angle) - size / 2), y: Math.round(c.y + radius * Math.sin(angle) - size / 2), w: size, h: size });
  let centre = { x: Math.round(clamp(input.at.x, HALF, input.screen.w - HALF)), y: Math.round(clamp(input.at.y, top + HALF, bottom - HALF)) };
  let choices: Rect[] = [];
  const n = input.open && input.open.option >= 0 && input.open.option < Math.min(BUBBLE_SLOTS, input.options) ? Math.max(0, input.open.choices) : 0;
  if (n > 0 && input.open) {
    // the outer ring centred on the option's slot, or turned round the bubble a step or two (farther would leave its option
    // behind); the turn nearest the slot that fits the screen, else the one that needs the bubble moved least, moved by that much
    let best: { shift: { x: number; y: number }; middle: number } | null = null;
    for (let k = 0; k <= 2 * TURN_STEPS; k++) {
      const middle = slotAngle(input.open.option) + (k % 2 === 1 ? 1 : -1) * Math.ceil(k / 2) * OUTER_STEP;
      const arc = Array.from({ length: n }, (_, i) => box(centre, middle + (i - (n - 1) / 2) * OUTER_STEP, OUTER, CHOICE));
      const out = (lo: number, hi: number, min: number, max: number) => Math.max(0, min - lo) - Math.max(0, hi - max);
      const shift = { x: out(Math.min(...arc.map((r) => r.x)), Math.max(...arc.map(rectRight)), 0, input.screen.w), y: out(Math.min(...arc.map((r) => r.y)), Math.max(...arc.map(rectBottom)), top, bottom) };
      if (!best || Math.abs(shift.x) + Math.abs(shift.y) < Math.abs(best.shift.x) + Math.abs(best.shift.y)) best = { shift, middle };
    }
    centre = { x: centre.x + best!.shift.x, y: centre.y + best!.shift.y };
    const arc = Array.from({ length: n }, (_, i) => box(centre, best!.middle + (i - (n - 1) / 2) * OUTER_STEP, OUTER, CHOICE));
    // first to last reads left to right, or top to bottom where the arc stands upright
    const [a, z] = [arc[0]!, arc[n - 1]!];
    if (z.x - a.x < 0 || (z.x === a.x && z.y < a.y)) arc.reverse();
    choices = arc;
  }
  const area = { x: centre.x - HALF, y: centre.y - HALF, w: 2 * HALF, h: 2 * HALF };
  const options: Rect[] = [];
  for (let i = 0; i < Math.min(BUBBLE_SLOTS, Math.max(0, input.options)); i++) options.push(box(centre, slotAngle(i), RING, OPTION));
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
 * The wheel over a strip cell with choices (ft_1_20.AC16, such as the piece maker's writer): the index of the next choice that can be picked,
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

/**
 * A two-finger tap opens the bubble on a touch screen (ft_1_20.AC25), as on a touchpad: at once, with no wait. AX-3
 * provisional: the second finger lands within `TWO_FINGER_TOGETHER_MS` of the first, and neither slides farther than
 * `TAP_SLIP` pixels; farther than `PINCH_SLIDE` afterwards it is a pinch. CSS pixels of the page (so the same distance under the
 * finger on any screen) and milliseconds; generous, since a child's fingers land one after the other and roll.
 */
export const TWO_FINGER_TOGETHER_MS = 200;
export const TAP_SLIP = 16;
/** How far either finger slides, after a two-finger tap opened the bubble, before it is a pinch that closes it. */
export const PINCH_SLIDE = 24;

/** The point midway between two fingers that make a two-finger tap, or null: the second came late or the first slid (`now`). */
export function twoFingerTap(first: { x: number; y: number; t: number; now: { x: number; y: number } }, second: { x: number; y: number; t: number }): { x: number; y: number } | null {
  if (second.t - first.t > TWO_FINGER_TOGETHER_MS) return null;
  if (Math.hypot(first.now.x - first.x, first.now.y - first.y) > TAP_SLIP) return null;
  return { x: Math.round((first.x + second.x) / 2), y: Math.round((first.y + second.y) / 2) };
}

/** Whether either of two fingers slid farther than `PINCH_SLIDE` from where it landed (`start` and `now` in the same order). */
export function twoFingersSlid(start: readonly { x: number; y: number }[], now: readonly { x: number; y: number }[]): boolean {
  return start.some((s, i) => {
    const n = now[i];
    return n !== undefined && Math.hypot(n.x - s.x, n.y - s.y) > PINCH_SLIDE;
  });
}
