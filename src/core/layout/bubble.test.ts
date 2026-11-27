// Covers ft_1_20 (actions in a bubble, a pinned strip and a backpack, d282).
import { describe, expect, it } from 'vitest';
import { BUBBLE_SLOTS, PLATE_REACH, SAUSAGE_REACH, SLIDER_CELLS, PIN_COLUMNS, sliderArc, sliderFraction, sliderPoint, sliderStep, PINCH_SLIDE, PIN_ROWS, TAP_SLIP, TWO_FINGER_TOGETHER_MS, bubbleLayout, bubblePage, bubbleTooltipBox, cellSpan, keyBadgeBox, pinFlow, pinRows, twoFingerTap, twoFingersSlid, wheelChoice } from './bubble';
import { rectBottom, rectRight, type Rect } from './rect';

const SCREEN = { w: 320, h: 180 };
const overlap = (a: Rect, b: Rect) => a.x < rectRight(b) && b.x < rectRight(a) && a.y < rectBottom(b) && b.y < rectBottom(a);
const inside = (r: Rect, s = SCREEN) => r.x >= 0 && r.y >= 0 && rectRight(r) <= s.w && rectBottom(r) <= s.h;

describe('the bubble (ft_1_20, d282)', () => {
  it('ft_1_20.AC19 opens round the pointer with each round option in its own fixed slot, 15 rows high at least, none touching', () => {
    const b = bubbleLayout({ at: { x: 160, y: 90 }, options: BUBBLE_SLOTS, screen: SCREEN });
    expect(b.options).toHaveLength(BUBBLE_SLOTS);
    for (const o of b.options) {
      expect(o.h).toBeGreaterThanOrEqual(15);
      expect(inside(o)).toBe(true);
    }
    // the options are round: a cell and a half at least between neighbours, and two from the round Close target in the centre
    const middle = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
    const apart = (a: Rect, c: Rect) => Math.hypot(middle(a).x - middle(c).x, middle(a).y - middle(c).y) - a.w / 2 - c.w / 2;
    for (let i = 0; i < b.options.length; i++) {
      expect(apart(b.options[i]!, b.close)).toBeGreaterThanOrEqual(2);
      for (let j = i + 1; j < b.options.length; j++) expect(apart(b.options[i]!, b.options[j]!)).toBeGreaterThanOrEqual(1.5);
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

  it('ft_1_20.AC20 an option with choices opens them on an outer ring round the bubble, centred on that option, inside the screen', () => {
    const centreOf = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
    const b = bubbleLayout({ at: { x: 160, y: 90 }, options: 8, screen: SCREEN, open: { option: 0, choices: 8 } });
    expect(b.choices).toHaveLength(8);
    const radius = (r: Rect) => Math.hypot(centreOf(r).x - b.centre.x, centreOf(r).y - b.centre.y);
    for (const c of b.choices) {
      expect(c.h).toBeGreaterThanOrEqual(15);
      expect(inside(c)).toBe(true);
      // every choice on the same outer ring, outside the options' ring and over no option
      expect(Math.abs(radius(c) - radius(b.choices[0]!))).toBeLessThanOrEqual(1);
      expect(radius(c)).toBeGreaterThan(rectRight(b.area) - b.centre.x);
      for (const o of b.options) expect(overlap(c, o)).toBe(false);
    }
    // neighbouring choices do not touch, and they read left to right over the top option
    for (let i = 1; i < b.choices.length; i++) {
      expect(overlap(b.choices[i - 1]!, b.choices[i]!)).toBe(false);
      expect(b.choices[i]!.x).toBeGreaterThan(b.choices[i - 1]!.x);
    }
    // centred on the pressed option: the middle of the arc lies straight above the centre, as slot 0 does
    const mid = (centreOf(b.choices[3]!).x + centreOf(b.choices[4]!).x) / 2;
    expect(mid).toBeCloseTo(b.centre.x, 0);
    // the option on the right opens its few choices to the right of the bubble
    const right = bubbleLayout({ at: { x: 160, y: 90 }, options: 8, screen: SCREEN, open: { option: 2, choices: 3 } });
    for (const c of right.choices) expect(c.x).toBeGreaterThanOrEqual(rectRight(right.area));
    expect(bubbleLayout({ at: { x: 160, y: 90 }, options: 8, screen: SCREEN }).choices).toEqual([]);
  });

  it('ft_1_20.AC20 near an edge the outer ring turns round the bubble to the side with room, and stays on the screen', () => {
    for (const at of [{ x: 160, y: 4 }, { x: 316, y: 90 }, { x: 4, y: 170 }, { x: 316, y: 176 }]) {
      for (const option of [0, 2, 4, 6]) {
        const b = bubbleLayout({ at, options: 8, screen: SCREEN, open: { option, choices: 8 } });
        for (const c of b.choices) {
          expect(inside(c), JSON.stringify({ at, option })).toBe(true);
          for (const o of b.options) expect(overlap(c, o)).toBe(false);
        }
      }
    }
  });

  it('ft_1_20.AC20 near an edge the bubble moves only as far as its outer ring needs, and not at all where a turn is enough', () => {
    const shut = bubbleLayout({ at: { x: 160, y: 56 }, options: 8, screen: SCREEN });
    const open = bubbleLayout({ at: { x: 160, y: 56 }, options: 8, screen: SCREEN, open: { option: 0, choices: 8 } });
    // the choices' sausage rests on the screen's top: moved no farther than that
    expect(Math.min(...open.choices.map((c) => c.y)) - SAUSAGE_REACH).toBeLessThanOrEqual(1);
    expect(open.centre.x).toBe(shut.centre.x);
    // a few choices turn round the bubble instead of moving it
    const few = bubbleLayout({ at: { x: 160, y: 60 }, options: 8, screen: SCREEN, open: { option: 0, choices: 2 } });
    expect(few.centre).toEqual(bubbleLayout({ at: { x: 160, y: 60 }, options: 8, screen: SCREEN }).centre);
  });

  // the screen of the piece maker: the top strip kept off, the pinned strip below (art cells)
  const MAKER = { y: 19, w: 320, h: 144 };
  const pad = (r: Rect, by: number): Rect => ({ x: r.x - by, y: r.y - by, w: r.w + 2 * by, h: r.h + 2 * by });
  const within = (r: Rect, s: { y?: number; w: number; h: number }) => r.x >= 0 && r.y >= (s.y ?? 0) && rectRight(r) <= s.w && rectBottom(r) <= (s.y ?? 0) + s.h;
  const holds = (r: Rect, p: { x: number; y: number }) => p.x >= r.x && p.x < rectRight(r) && p.y >= r.y && p.y < rectBottom(r);

  it('ft_1_20.AC19 ft_1_20.AC20 draws every plate and the choices round them whole on the screen, not only the boxes a press counts in', () => {
    for (const at of [{ x: 0, y: 0 }, { x: 319, y: 179 }, { x: 30, y: 50 }, { x: 300, y: 160 }, { x: 5, y: 120 }, { x: 160, y: 162 }]) {
      for (const open of [undefined, ...[0, 1, 2, 3, 4, 5, 6, 7].flatMap((option) => [2, 3, 5, 6, 7, 8].map((choices) => ({ option, choices })))]) {
        const b = bubbleLayout({ at, options: 8, screen: MAKER, ...(open ? { open } : {}) });
        const where = JSON.stringify({ at, open });
        for (const o of b.options) expect(within(pad(o, PLATE_REACH), MAKER), where).toBe(true);
        expect(within(pad(b.close, PLATE_REACH), MAKER), where).toBe(true);
        for (const c of b.choices) {
          expect(within(pad(c, SAUSAGE_REACH), MAKER), where).toBe(true);
          for (const o of b.options) expect(overlap(c, o), where).toBe(false);
        }
      }
    }
  });

  it('ft_1_20.AC20 the choices never lie over the thing the bubble was opened on, so its note stays in sight while they are tried', () => {
    for (const at of [{ x: 30, y: 50 }, { x: 30, y: 60 }, { x: 60, y: 45 }, { x: 160, y: 50 }, { x: 290, y: 140 }, { x: 30, y: 150 }]) {
      for (const [option, choices] of [[0, 8], [4, 7], [5, 6], [1, 3], [3, 5]] as const) {
        const b = bubbleLayout({ at, options: 8, screen: MAKER, open: { option, choices } });
        for (const c of b.choices) expect(holds(pad(c, SAUSAGE_REACH), at), JSON.stringify({ at, option })).toBe(false);
        // nor does an option's plate, where the bubble moved to make room for them
        const shut = bubbleLayout({ at, options: 8, screen: MAKER });
        if (b.centre.x !== shut.centre.x || b.centre.y !== shut.centre.y) for (const o of b.options) expect(Math.hypot(at.x - o.x - o.w / 2, at.y - o.y - o.h / 2), JSON.stringify({ at, option })).toBeGreaterThanOrEqual(o.w / 2 + PLATE_REACH);
      }
    }
  });

  it('ft_1_20.AC20 a long row of choices turns farther round the bubble before moving it, as long as it still reaches its option', () => {
    // the fingers (slot 5, six choices) of a note near the left edge: turned round below, the bubble moves a cell or two at most
    const shut = bubbleLayout({ at: { x: 30, y: 60 }, options: 8, screen: MAKER });
    const open = bubbleLayout({ at: { x: 30, y: 60 }, options: 8, screen: MAKER, open: { option: 5, choices: 6 } });
    expect(Math.abs(open.centre.x - shut.centre.x) + Math.abs(open.centre.y - shut.centre.y)).toBeLessThanOrEqual(4);
    // the arc still reaches its option: the option's direction lies within the arc
    const angle = (r: Rect) => Math.atan2(r.y + r.h / 2 - open.centre.y, r.x + r.w / 2 - open.centre.x);
    const option = angle(open.options[5]!);
    const turns = open.choices.map((c) => Math.abs(Math.atan2(Math.sin(angle(c) - option), Math.cos(angle(c) - option))));
    expect(Math.min(...turns)).toBeLessThan(0.5);
  });

  it('ft_1_20.AC20 the choices turn toward the empty side, off what the screen keeps in sight (the staff), where a turn can', () => {
    // a note at the staff's left end: the staff runs to the right of it along the top of the screen
    const staff = { x: 10, y: 30, w: 300, h: 50 };
    const overStaff = (b: ReturnType<typeof bubbleLayout>) => b.choices.filter((c) => overlap(c, staff)).length;
    for (const [option, choices] of [[0, 8], [4, 7], [5, 6]] as const) {
      const plain = bubbleLayout({ at: { x: 30, y: 50 }, options: 8, screen: MAKER, open: { option, choices } });
      const kept = bubbleLayout({ at: { x: 30, y: 50 }, options: 8, screen: MAKER, open: { option, choices }, avoid: [staff] });
      expect(overStaff(kept), JSON.stringify({ option })).toBeLessThanOrEqual(overStaff(plain));
    }
    // the lengths (slot 0, eight) no longer lie along the staff to the right
    const lengths = bubbleLayout({ at: { x: 30, y: 50 }, options: 8, screen: MAKER, open: { option: 0, choices: 8 }, avoid: [staff] });
    expect(overStaff(lengths)).toBeLessThan(overStaff(bubbleLayout({ at: { x: 30, y: 50 }, options: 8, screen: MAKER, open: { option: 0, choices: 8 } })));
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

  it('ft_1_20.AC19 keeps off the top strip a screen without a toolbar has: opened near the top it moves down below it', () => {
    const b = bubbleLayout({ at: { x: 160, y: 5 }, options: BUBBLE_SLOTS, screen: { y: 20, w: 320, h: 160 }, open: { option: 0, choices: 4 } });
    expect(bubbleLayout({ at: { x: 160, y: 5 }, options: BUBBLE_SLOTS, screen: { y: 20, w: 320, h: 160 } }).area.y).toBe(20 + PLATE_REACH);
    // with choices open over slot 0 it moves down as far as their outer ring needs
    expect(b.area.y).toBeGreaterThanOrEqual(20);
    expect(b.choices).toHaveLength(4);
    for (const r of [...b.options, ...b.choices]) expect(r.y).toBeGreaterThanOrEqual(20);
  });
});

describe('the wheel over a strip cell with choices (ft_1_20.AC16)', () => {
  it('ft_1_20.AC16 the wheel over an item with choices steps to the next choice that can be picked, and stops at the ends', () => {
    const choices = [{}, { active: true }, { disabled: true }, {}];
    expect(wheelChoice(choices, 1)).toBe(3);
    expect(wheelChoice(choices, -1)).toBe(0);
    expect(wheelChoice([{}, {}, { active: true }], 1)).toBeNull();
    expect(wheelChoice([{ active: true }, {}], -1)).toBeNull();
    // no choice lit: the first one that can be picked, either way
    expect(wheelChoice([null, { disabled: true }, {}, {}], 1)).toBe(2);
    expect(wheelChoice([], 1)).toBeNull();
  });
});

describe('the two-finger tap on a touch screen (ft_1_20.AC25)', () => {
  it('ft_1_20.AC25 two fingers down together open the bubble midway between them', () => {
    const first = { x: 100, y: 200, t: 1000 };
    expect(twoFingerTap({ ...first, now: { x: 103, y: 198 } }, { x: 300, y: 260, t: 1080 })).toEqual({ x: 200, y: 230 });
  });

  it('ft_1_20.AC25 a second finger that comes late, or a first that has already slid, is no two-finger tap', () => {
    const first = { x: 100, y: 200, t: 1000 };
    expect(twoFingerTap({ ...first, now: first }, { x: 300, y: 260, t: 1000 + TWO_FINGER_TOGETHER_MS + 1 })).toBeNull();
    expect(twoFingerTap({ ...first, now: { x: 100, y: 200 + TAP_SLIP + 1 } }, { x: 300, y: 260, t: 1050 })).toBeNull();
  });

  it('ft_1_20.AC25 two fingers that slide apart after it opened are a pinch, not a tap', () => {
    const start = [{ x: 100, y: 200 }, { x: 300, y: 260 }];
    expect(twoFingersSlid(start, [{ x: 104, y: 200 }, { x: 300, y: 255 }])).toBe(false);
    expect(twoFingersSlid(start, [{ x: 100 - PINCH_SLIDE - 1, y: 200 }, { x: 300, y: 260 }])).toBe(true);
  });
});

describe('a slider on the outer ring (ft_1_20.AC26)', () => {
  const layout = bubbleLayout({ at: { x: 160, y: 90 }, options: BUBBLE_SLOTS, screen: SCREEN, open: { option: 2, choices: SLIDER_CELLS } });
  const arc = sliderArc(layout)!;
  const middle = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

  it('ft_1_20.AC26 runs along the outer ring where the choices would be, its least at the first and its most at the last', () => {
    expect(sliderPoint(arc, 0).x).toBeCloseTo(middle(layout.choices[0]!).x, 0);
    expect(sliderPoint(arc, 0).y).toBeCloseTo(middle(layout.choices[0]!).y, 0);
    expect(sliderPoint(arc, 1).x).toBeCloseTo(middle(layout.choices.at(-1)!).x, 0);
    expect(sliderPoint(arc, 1).y).toBeCloseTo(middle(layout.choices.at(-1)!).y, 0);
    expect(sliderArc({ ...layout, choices: [] })).toBeNull();
  });

  it('ft_1_20.AC26 reads where the pointer is along it, the nearer end past either end', () => {
    for (const f of [0, 0.3, 0.5, 1]) expect(sliderFraction(arc, sliderPoint(arc, f))).toBeCloseTo(f);
    // farther out or nearer in on the same line of the ring reads the same
    const p = sliderPoint(arc, 0.7);
    const out = { x: arc.centre.x + (p.x - arc.centre.x) * 1.2, y: arc.centre.y + (p.y - arc.centre.y) * 1.2 };
    expect(sliderFraction(arc, out)).toBeCloseTo(0.7);
    // round the ring past the last cell: the most; past the first: the least
    const past = (f: number) => {
      const a = arc.from + f * (arc.to - arc.from);
      return { x: arc.centre.x + arc.radius * Math.cos(a), y: arc.centre.y + arc.radius * Math.sin(a) };
    };
    expect(sliderFraction(arc, past(1.3))).toBe(1);
    expect(sliderFraction(arc, past(-0.3))).toBe(0);
  });

  it('ft_1_20.AC26 snaps a value to its steps between its least and its most', () => {
    const range = { min: 0, max: 1.5, step: 0.1 };
    expect(sliderStep(0, range)).toBe(0);
    expect(sliderStep(1, range)).toBe(1.5);
    expect(sliderStep(0.5, range)).toBeCloseTo(0.8);
    expect(sliderStep(2, range)).toBe(1.5);
  });
});

describe('an option\'s key on a bubble opened from the keyboard (ft_1_20)', () => {
  const overlap = (a: Rect, b: Rect) => a.x < rectRight(b) && b.x < rectRight(a) && a.y < rectBottom(b) && b.y < rectBottom(a);
  // an option's picture: at most 14 wide and 10 high, centred on its plate
  const picture = (r: Rect): Rect => ({ x: r.x + r.w / 2 - 7, y: r.y + r.h / 2 - 5, w: 14, h: 10 });
  const screen = { w: 320, h: 180 };
  const layout = bubbleLayout({ at: { x: 160, y: 90 }, options: BUBBLE_SLOTS, screen });

  it('sits on the same spot of every plate, its lower right, covering no other option\'s picture and no other key', () => {
    for (const size of [{ w: 7, h: 9 }, { w: 13, h: 9 }]) {
      const badges = layout.options.map((_, i) => keyBadgeBox(layout, i, size, screen));
      badges.forEach((badge, i) => {
        const own = layout.options[i]!;
        expect({ dx: rectRight(badge) - (own.x + own.w / 2), dy: rectBottom(badge) - (own.y + own.h / 2) }).toEqual({ dx: 12, dy: 12 });
        expect(overlap(badge, picture(layout.close))).toBe(false);
        layout.options.forEach((other, j) => {
          if (j !== i) expect(overlap(badge, picture(other))).toBe(false);
        });
        badges.forEach((b, j) => {
          if (j !== i) expect(overlap(b, badge)).toBe(false);
        });
      });
    }
  });

  it('stays on the screen when the bubble opens in a corner', () => {
    for (const at of [{ x: 0, y: 0 }, { x: 320, y: 180 }, { x: 0, y: 180 }, { x: 320, y: 0 }]) {
      const corner = bubbleLayout({ at, options: BUBBLE_SLOTS, screen });
      corner.options.forEach((_, i) => {
        const b = keyBadgeBox(corner, i, { w: 13, h: 9 }, screen);
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.y).toBeGreaterThanOrEqual(0);
        expect(rectRight(b)).toBeLessThanOrEqual(screen.w);
        expect(rectBottom(b)).toBeLessThanOrEqual(screen.h);
      });
    }
  });
});

describe('an option\'s name on the bubble (ft_1_20)', () => {
  const overlap = (a: Rect, b: Rect) => a.x < rectRight(b) && b.x < rectRight(a) && a.y < rectBottom(b) && b.y < rectBottom(a);
  const screen = { y: 13, w: 320, h: 167 };
  const size = { w: 90, h: 15 };

  it('stands outside the ring, above it, hiding no option, the Close target or a key', () => {
    const layout = bubbleLayout({ at: { x: 160, y: 110 }, options: BUBBLE_SLOTS, screen });
    const tip = bubbleTooltipBox(layout, size, screen);
    expect(rectBottom(tip)).toBeLessThanOrEqual(layout.centre.y);
    for (const r of [...layout.options, layout.close]) expect(overlap(tip, { x: r.x - 2, y: r.y - 2, w: r.w + 4, h: r.h + 4 })).toBe(false);
    layout.options.forEach((_, i) => expect(overlap(tip, keyBadgeBox(layout, i, { w: 13, h: 9 }, screen))).toBe(false));
  });

  it('goes under the ring when there is no room above, and stays on the screen', () => {
    const layout = bubbleLayout({ at: { x: 10, y: 20 }, options: BUBBLE_SLOTS, screen });
    const tip = bubbleTooltipBox(layout, size, screen);
    expect(tip.y).toBeGreaterThan(layout.centre.y);
    for (const r of layout.options) expect(overlap(tip, r)).toBe(false);
    expect(tip.x).toBeGreaterThanOrEqual(0);
  });

  it('keeps clear of an option\'s choices open on the outer ring', () => {
    const layout = bubbleLayout({ at: { x: 160, y: 110 }, options: BUBBLE_SLOTS, screen, open: { option: 0, choices: 5 } });
    const tip = bubbleTooltipBox(layout, size, screen);
    for (const r of [...layout.options, ...layout.choices]) expect(overlap(tip, r)).toBe(false);
  });
});
