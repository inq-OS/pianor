// Covers ft_1_20 (actions in a bubble, a pinned strip and a backpack, d282).
import { describe, expect, it } from 'vitest';
import { BUBBLE_SLOTS, LONG_PRESS, PIN_COLUMNS, PIN_ROWS, bubbleLayout, bubblePage, cellSpan, longPress, pinFlow, pinRows, slotStep } from './bubble';
import { rectBottom, rectRight, type Rect } from './rect';

const SCREEN = { w: 320, h: 180 };
const overlap = (a: Rect, b: Rect) => a.x < rectRight(b) && b.x < rectRight(a) && a.y < rectBottom(b) && b.y < rectBottom(a);
const inside = (r: Rect, s = SCREEN) => r.x >= 0 && r.y >= 0 && rectRight(r) <= s.w && rectBottom(r) <= s.h;

describe('the bubble (ft_1_20, d282)', () => {
  it('ft_1_20.AC19 opens round the pointer with each option in its own fixed slot, 15 rows high at least, none overlapping', () => {
    const b = bubbleLayout({ at: { x: 160, y: 90 }, options: BUBBLE_SLOTS, screen: SCREEN });
    expect(b.options).toHaveLength(BUBBLE_SLOTS);
    for (const o of b.options) {
      expect(o.h).toBeGreaterThanOrEqual(15);
      expect(inside(o)).toBe(true);
    }
    // two cells at least between neighbours, and none over the Close target in the centre
    const grown = (r: Rect): Rect => ({ x: r.x - 1, y: r.y - 1, w: r.w + 2, h: r.h + 2 });
    for (let i = 0; i < b.options.length; i++) {
      expect(overlap(b.options[i]!, b.close)).toBe(false);
      for (let j = i + 1; j < b.options.length; j++) expect(overlap(grown(b.options[i]!), grown(b.options[j]!))).toBe(false);
    }
    // slot 0 is straight above the centre, slot 2 to its right, slot 4 below, slot 6 to its left
    const mid = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
    expect(mid(b.options[0]!).x).toBeCloseTo(b.centre.x, 0);
    expect(mid(b.options[0]!).y).toBeLessThan(b.centre.y);
    expect(mid(b.options[2]!).x).toBeGreaterThan(b.centre.x);
    expect(mid(b.options[4]!).y).toBeGreaterThan(b.centre.y);
    expect(mid(b.options[6]!).x).toBeLessThan(b.centre.x);
  });

  it('ft_1_20.AC19 an option keeps its slot whatever how many options the screen has, so the hand learns it', () => {
    const three = bubbleLayout({ at: { x: 160, y: 90 }, options: 3, screen: SCREEN });
    const eight = bubbleLayout({ at: { x: 160, y: 90 }, options: 8, screen: SCREEN });
    expect(three.options).toEqual(eight.options.slice(0, 3));
  });

  it('ft_1_20.AC19 stays whole on the screen near an edge or a corner, as close to the pointer as it can', () => {
    for (const at of [{ x: 0, y: 0 }, { x: 319, y: 179 }, { x: 5, y: 170 }, { x: 310, y: 4 }]) {
      const b = bubbleLayout({ at, options: BUBBLE_SLOTS, screen: SCREEN });
      expect(inside(b.area), JSON.stringify(at)).toBe(true);
      for (const o of b.options) expect(inside(o), JSON.stringify(at)).toBe(true);
    }
    expect(bubbleLayout({ at: { x: 160, y: 90 }, options: 8, screen: SCREEN }).centre).toEqual({ x: 160, y: 90 });
  });

  it('ft_1_20.AC20 an option with choices opens them in a row beside the bubble, on the side with room, inside the screen', () => {
    const right = bubbleLayout({ at: { x: 80, y: 90 }, options: 8, screen: SCREEN, open: { option: 0, choices: 5 } });
    expect(right.choices).toHaveLength(5);
    for (const c of right.choices) {
      expect(c.h).toBeGreaterThanOrEqual(15);
      expect(inside(c)).toBe(true);
      expect(c.x).toBeGreaterThanOrEqual(rectRight(right.area));
      for (const o of right.options) expect(overlap(c, o)).toBe(false);
    }
    const left = bubbleLayout({ at: { x: 280, y: 90 }, options: 8, screen: SCREEN, open: { option: 2, choices: 4 } });
    for (const c of left.choices) {
      expect(inside(c)).toBe(true);
      expect(rectRight(c)).toBeLessThanOrEqual(left.area.x);
    }
    expect(bubbleLayout({ at: { x: 160, y: 90 }, options: 8, screen: SCREEN }).choices).toEqual([]);
  });

  it('ft_1_20.AC19 more options than slots: the last slot is More and turns to the rest', () => {
    const first = bubblePage({ options: 11, page: 0 });
    expect(first.slots).toEqual([0, 1, 2, 3, 4, 5, 6, 'more']);
    expect(first.pages).toBe(2);
    expect(bubblePage({ options: 11, page: 1 }).slots).toEqual([7, 8, 9, 10, null, null, null, 'more']);
    expect(bubblePage({ options: 11, page: 2 }).page).toBe(0);
    expect(bubblePage({ options: 5, page: 0 }).slots).toEqual([0, 1, 2, 3, 4, null, null, null]);
  });
});

describe('the pinned strip (ft_1_20, d282)', () => {
  it('ft_1_20.AC21 a screen with nothing pinned has no strip, and anything pinned takes one row of 15-row cells', () => {
    expect(pinRows(0)).toBe(0);
    expect(pinRows(2)).toBe(PIN_ROWS);
    expect(PIN_ROWS).toBe(17);
  });

  it('ft_1_20.AC18 never cuts a word: a word wider than a cell takes as many cells of the row as it needs', () => {
    expect(cellSpan(10, 30)).toBe(1);
    expect(cellSpan(30, 30)).toBe(1);
    expect(cellSpan(31, 30)).toBe(2);
    expect(cellSpan(70, 30)).toBe(3);
    expect(cellSpan(500, 30)).toBe(PIN_COLUMNS);
  });

  it('ft_1_20.AC21 lays the pinned actions left to right in their order; those that do not fit go to the bubble', () => {
    const flow = pinFlow({ spans: [2, 2, 3, 2] });
    expect(flow.placed).toEqual([
      { action: 0, rect: flow.placed[0]!.rect, span: 2 },
      { action: 1, rect: flow.placed[1]!.rect, span: 2 },
      { action: 2, rect: flow.placed[2]!.rect, span: 3 },
    ]);
    expect(flow.toBubble).toEqual([3]);
    for (const p of flow.placed) {
      expect(p.rect.h).toBeGreaterThanOrEqual(15);
      expect(rectBottom(p.rect)).toBeLessThanOrEqual(PIN_ROWS);
    }
    for (let i = 1; i < flow.placed.length; i++) expect(flow.placed[i]!.rect.x).toBeGreaterThan(rectRight(flow.placed[i - 1]!.rect));
  });

  it('ft_1_20.AC21 the main action stands at the right end of the strip on every screen, the rest from the left', () => {
    for (const width of [320, 427]) {
      const flow = pinFlow({ spans: [1, 1], width, main: 1 });
      expect(flow.placed.map((p) => p.action)).toEqual([0, 1]);
      expect(rectRight(flow.placed[1]!.rect)).toBe(width - 2);
      expect(flow.placed[0]!.rect.x).toBe(2);
    }
  });
});

describe('the bubble from the keyboard and on a touch screen (ft_1_20, d282)', () => {
  it('ft_1_20.AC22 walks the used slots clockwise with the arrows, round the ring, skipping empty slots', () => {
    const used = [true, false, true, true, false, false, true, false];
    expect(slotStep(used, 0, 1)).toBe(2);
    expect(slotStep(used, 3, 1)).toBe(6);
    expect(slotStep(used, 6, 1)).toBe(0);
    expect(slotStep(used, 0, -1)).toBe(6);
    expect(slotStep(used, -1, 1)).toBe(0);
    expect(slotStep(used.map(() => false), 0, 1)).toBe(-1);
  });

  it('ft_1_20.AC22 opens on a long press at 450 ms, a ring filling from 150 ms, and a move of more than 12 pixels cancels it', () => {
    expect(longPress(100, 0)).toEqual({ state: 'wait' });
    expect(longPress(150, 0)).toEqual({ state: 'ring', fill: 0 });
    expect(longPress(300, 5)).toEqual({ state: 'ring', fill: 0.5 });
    expect(longPress(LONG_PRESS.openMs, 12)).toEqual({ state: 'open' });
    expect(longPress(200, 13)).toEqual({ state: 'cancel' });
  });
});

describe('the bubble\'s row of choices (ft_1_20, d282)', () => {
  it('ft_1_20.AC18 a choice that is a word is as wide as its word, and the row stays inside the screen over no option', () => {
    const b = bubbleLayout({ at: { x: 280, y: 90 }, options: BUBBLE_SLOTS, screen: SCREEN, open: { option: 2, choices: 3, widths: [10, 40, 18] } });
    expect(b.choices.map((c) => c.w)).toEqual([18, 40, 18]);
    for (let i = 1; i < b.choices.length; i++) expect(b.choices[i]!.x).toBeGreaterThan(rectRight(b.choices[i - 1]!));
    for (const c of b.choices) {
      expect(inside(c)).toBe(true);
      for (const o of b.options) expect(overlap(c, o)).toBe(false);
    }
  });
});
