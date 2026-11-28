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
/** How many steps the outer ring may turn away from its option at least; a longer row turns as far as it still reaches its option. */
const TURN_STEPS = 2;
/** How far an option's round plate reaches past its box (24 across over 20): the plate, not only the box, stays on the screen. */
export const PLATE_REACH = 2;
/** How far the sausage the choices lie in reaches past their boxes (`SAUSAGE_PAD` in bubbleArt.ts). */
export const SAUSAGE_REACH = 3;
/** The bubble's reach from its centre with its plates: what is kept on the screen. */
const EDGE = HALF + PLATE_REACH;
/**
 * AX-3 provisional: how many cells of moving the bubble count the same as choices lying over the thing it was opened on
 * (its note); the turn that covers it is taken only when the others would move the bubble farther than this.
 */
const COVER_COST = 32;
/** How far, in steps of `AWAY_STEP` cells, the bubble may move on away from the thing pressed to leave it in sight. */
const AWAY_STEP = 4;
/**
 * AX-3 provisional: how many cells of moving the bubble count the same as one choice lying over a place the screen keeps in
 * sight (`avoid`: the piece maker's staff), so the ring turns toward the empty side where it can.
 */
const AVOID_COST = 3;
const AWAY_STEPS = 10;

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

/** Between the ring's edge and the thing it opens beside. */
const BESIDE_GAP = 2;

/**
 * Where the ring stands across: at the pointer, or with `beside` (the note it acts on, ft_1_02d.AC52) level with it on its
 * right, on its left where the right has no room, so the thing stays in view.
 */
function besideX(x: number, beside: Rect | undefined, width: number): number {
  if (!beside) return x;
  const right = rectRight(beside) + BESIDE_GAP + EDGE;
  if (right + EDGE <= width) return right;
  const left = beside.x - BESIDE_GAP - EDGE;
  return left - EDGE >= 0 ? left : x;
}

/** The bubble for `options` options (at most `BUBBLE_SLOTS`) opened at `at` on a screen `screen` cells large, kept below its `y`. */
export function bubbleLayout(input: { at: { x: number; y: number }; options: number; screen: { y?: number; w: number; h: number }; open?: { option: number; choices: number }; beside?: Rect; avoid?: readonly Rect[] }): BubbleLayout {
  // `screen.y`: rows at the top the bubble keeps off (the top strip of a screen without a toolbar); `h` counts from there
  const top = input.screen.y ?? 0;
  const bottom = top + input.screen.h;
  const slotAngle = (i: number) => -Math.PI / 2 + (2 * Math.PI * i) / BUBBLE_SLOTS;
  const box = (c: { x: number; y: number }, angle: number, radius: number, size: number): Rect => ({ x: Math.round(c.x + radius * Math.cos(angle) - size / 2), y: Math.round(c.y + radius * Math.sin(angle) - size / 2), w: size, h: size });
  const fit = (c: { x: number; y: number }) => ({ x: Math.round(clamp(c.x, EDGE, input.screen.w - EDGE)), y: Math.round(clamp(c.y, top + EDGE, bottom - EDGE)) });
  let centre = fit({ x: besideX(input.at.x, input.beside, input.screen.w), y: input.at.y });
  let choices: Rect[] = [];
  const n = input.open && input.open.option >= 0 && input.open.option < Math.min(BUBBLE_SLOTS, input.options) ? Math.max(0, input.open.choices) : 0;
  if (n > 0 && input.open) {
    // the outer ring centred on the option's slot, or turned round the bubble a step or two, a long row as far as it still
    // reaches its option; the turn nearest the slot that fits the screen and leaves the thing pressed in sight, else the one
    // that needs the bubble moved least, moved by that much (and kept whole on the screen)
    const turns = Math.max(TURN_STEPS, Math.floor(n / 2));
    const arcAt = (c: { x: number; y: number }, middle: number) => Array.from({ length: n }, (_, i) => box(c, middle + (i - (n - 1) / 2) * OUTER_STEP, OUTER, CHOICE));
    // the thing pressed hidden: under a choice's sausage, or under an option's plate where the bubble moved off it
    const slots = Math.min(BUBBLE_SLOTS, input.options);
    const covers = (c: { x: number; y: number }, arc: Rect[]) =>
      arc.some((r) => input.at.x >= r.x - SAUSAGE_REACH && input.at.x < r.x + r.w + SAUSAGE_REACH && input.at.y >= r.y - SAUSAGE_REACH && input.at.y < r.y + r.h + SAUSAGE_REACH) ||
      Array.from({ length: slots }, (_, i) => slotAngle(i)).some((a) => Math.hypot(input.at.x - c.x - RING * Math.cos(a), input.at.y - c.y - RING * Math.sin(a)) < OPTION / 2 + PLATE_REACH);
    // how many choices lie over what the screen asks to keep in sight (the staff): the ring turns toward the empty side
    const crowded = (arc: Rect[]) => arc.filter((r) => (input.avoid ?? []).some((a) => r.x < a.x + a.w && a.x < r.x + r.w && r.y < a.y + a.h && a.y < r.y + r.h)).length;
    const onScreen = (arc: Rect[]) => arc.every((r) => r.x - SAUSAGE_REACH >= 0 && rectRight(r) + SAUSAGE_REACH <= input.screen.w && r.y - SAUSAGE_REACH >= top && rectBottom(r) + SAUSAGE_REACH <= bottom);
    let best: { centre: { x: number; y: number }; middle: number; cost: number } | null = null;
    for (let k = 0; k <= 2 * turns; k++) {
      const middle = slotAngle(input.open.option) + (k % 2 === 1 ? 1 : -1) * Math.ceil(k / 2) * OUTER_STEP;
      const arc = arcAt(centre, middle);
      const out = (lo: number, hi: number, min: number, max: number) => Math.max(0, min - lo) - Math.max(0, hi - max);
      const shift = { x: out(Math.min(...arc.map((r) => r.x)) - SAUSAGE_REACH, Math.max(...arc.map(rectRight)) + SAUSAGE_REACH, 0, input.screen.w), y: out(Math.min(...arc.map((r) => r.y)) - SAUSAGE_REACH, Math.max(...arc.map(rectBottom)) + SAUSAGE_REACH, top, bottom) };
      const moved = fit({ x: centre.x + shift.x, y: centre.y + shift.y });
      // where the row would lie over the thing pressed, the bubble may move on away from it (near a corner)
      const away = { x: moved.x - input.at.x, y: moved.y - input.at.y };
      const length = Math.hypot(away.x, away.y) || 1;
      for (let step = 0; step <= AWAY_STEPS; step++) {
        const c = step === 0 ? moved : fit({ x: moved.x + (away.x / length) * step * AWAY_STEP, y: moved.y + (away.y / length) * step * AWAY_STEP });
        const at = arcAt(c, middle);
        if (step > 0 && !onScreen(at)) continue;
        const cost = Math.abs(c.x - centre.x) + Math.abs(c.y - centre.y) + (covers(c, at) ? COVER_COST : 0) + AVOID_COST * crowded(at);
        if (!best || cost < best.cost) best = { centre: c, middle, cost };
        if (!covers(c, at)) break;
      }
    }
    centre = best!.centre;
    const arc = arcAt(centre, best!.middle);
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

/** Half a round plate (24 across): an option's key has its lower right corner on the corner of the plate's square. */
const PLATE_HALF = OPTION / 2 + 2;
/** How far the ring reaches from its centre: an option's plate and the keyboard's focus ring round it, and one cell more. */
const RING_REACH = RING + PLATE_HALF + 3;
/** How far an open option's choices reach on the outer ring, and one cell more. */
const CHOICES_REACH = OUTER + CHOICE / 2 + 1;

/**
 * Where option `slot`'s key (`size` cells) is drawn on a bubble opened from the keyboard: the same spot on every plate, its
 * lower right, the key's lower right corner on the corner of the plate's square, so it is read as that plate's and covers
 * no other option's picture; kept on the screen.
 */
export function keyBadgeBox(layout: Pick<BubbleLayout, 'options'>, slot: number, size: { w: number; h: number }, screen: { w: number; h: number }): Rect {
  const option = layout.options[slot]!;
  const cx = option.x + option.w / 2, cy = option.y + option.h / 2;
  const x = Math.round(cx + PLATE_HALF - size.w), y = Math.round(cy + PLATE_HALF - size.h);
  return { x: clamp(x, 0, screen.w - size.w), y: clamp(y, 0, screen.h - size.h), w: size.w, h: size.h };
}

/**
 * Where an option's name (its tooltip, `size` cells) is shown on the bubble: outside the ring, above it, or under it where
 * the screen has no room above, centred on the bubble, so it never hides an option or its key; past the outer ring while an
 * option's choices are open there.
 */
export function bubbleTooltipBox(layout: Pick<BubbleLayout, 'centre' | 'choices'>, size: { w: number; h: number }, screen: { y?: number; w: number; h: number }): Rect {
  const top = screen.y ?? 0;
  const reach = layout.choices.length > 0 ? CHOICES_REACH : RING_REACH;
  const above = Math.round(layout.centre.y - reach - size.h);
  const below = Math.round(layout.centre.y + reach);
  const y = above >= top ? above : below + size.h <= top + screen.h ? below : clamp(above, top, top + screen.h - size.h);
  return { x: clamp(Math.round(layout.centre.x - size.w / 2), 0, screen.w - size.w), y, w: size.w, h: size.h };
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

/**
 * A slider in the bubble (ft_1_20.AC26): an option that sets a value in a range opens a track along the outer ring, where
 * `SLIDER_CELLS` choices would stand, its least at the first and its most at the last, with a knob dragged along it.
 */
export const SLIDER_CELLS = 5;

/** The slider's track: the ring's centre and radius and the turns (radians) of its least and its most. */
export interface SliderArc {
  centre: { x: number; y: number };
  radius: number;
  from: number;
  to: number;
}

/** A turn between -π and π. */
const turn = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** The track through the open option's choices (the layout opened with `SLIDER_CELLS` of them), or null with none. */
export function sliderArc(layout: BubbleLayout): SliderArc | null {
  const first = layout.choices[0];
  const last = layout.choices.at(-1);
  if (!first || !last || layout.choices.length < 2) return null;
  const { centre } = layout;
  const at = (r: Rect) => ({ x: r.x + r.w / 2 - centre.x, y: r.y + r.h / 2 - centre.y });
  const radius = layout.choices.reduce((sum, r) => sum + Math.hypot(at(r).x, at(r).y), 0) / layout.choices.length;
  const from = Math.atan2(at(first).y, at(first).x);
  return { centre, radius, from, to: from + turn(Math.atan2(at(last).y, at(last).x) - from) };
}

/** Where on the track the knob stands for `fraction` (0 the least, 1 the most). */
export function sliderPoint(arc: SliderArc, fraction: number): { x: number; y: number } {
  const a = arc.from + Math.min(1, Math.max(0, fraction)) * (arc.to - arc.from);
  return { x: arc.centre.x + arc.radius * Math.cos(a), y: arc.centre.y + arc.radius * Math.sin(a) };
}

/** How far along the track (0 to 1) a pointer at `point` is: by its turn round the centre, the nearer end past either end. */
export function sliderFraction(arc: SliderArc, point: { x: number; y: number }): number {
  const span = arc.to - arc.from;
  if (span === 0) return 0;
  const f = turn(Math.atan2(point.y - arc.centre.y, point.x - arc.centre.x) - arc.from) / span;
  if (f >= 0 && f <= 1) return f;
  // past an end: the end nearer round the ring
  const toFrom = Math.abs(turn(f * span));
  const toEnd = Math.abs(turn(f * span - span));
  return toFrom <= toEnd ? 0 : 1;
}

/** The value at `fraction` of a range, on its steps. */
export function sliderStep(fraction: number, range: { min: number; max: number; step: number }): number {
  const raw = range.min + Math.min(1, Math.max(0, fraction)) * (range.max - range.min);
  const stepped = range.min + Math.round((raw - range.min) / range.step) * range.step;
  return Math.min(range.max, Math.max(range.min, Number(stepped.toFixed(6))));
}
