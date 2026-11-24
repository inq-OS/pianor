import { describe, expect, it } from 'vitest';
import { bubbleLayout, cellSpan, PIN_ROWS } from '../../../core/layout/bubble';
import { inkCount, type Bitmap } from './bitmap';
import { BACKPACK, openBackpack, openBagPlaces, OPEN_BAG, choicePlate, choicesBack, closePlate, NEW_ITEM_DOT, OPTION_SIZE, optionFocus, optionPlate, PIN_CELL_SIZE, pinCell, pressRing, STRIP_ROWS, stripBitmap, wornChip, type PlateLook } from './bubbleArt';
import { ICONS } from './iconArt';
import { C } from './palette';
import { TOOL_ICONS } from './toolArt';

const at = (b: Bitmap, x: number, y: number) => b.pixels[y * b.width + x]!;
const same = (a: Bitmap, b: Bitmap) => a.width === b.width && a.height === b.height && a.pixels.every((p, i) => p === b.pixels[i]);
const LOOKS: PlateLook[] = ['plain', 'hover', 'down', 'on', 'off', 'main'];

describe('the bubble, the strip and the backpack (ft_1_20, d282): their look fits the layout', () => {
  it('ft_1_20.AC19 an option is an opaque round plate as large as the layout\'s option, with room between neighbours', () => {
    const layout = bubbleLayout({ at: { x: 160, y: 90 }, options: 8, screen: { w: 320, h: 180 } });
    expect(optionPlate().width).toBe(layout.options[0]!.w);
    expect(optionPlate().height).toBe(layout.options[0]!.h);
    expect(closePlate().width).toBe(layout.close.w);
    // round: the corners are clear, the middle of each side is the outline
    const plate = optionPlate();
    expect(at(plate, 0, 0)).toBe(0);
    expect(at(plate, OPTION_SIZE - 1, OPTION_SIZE - 1)).toBe(0);
    expect(at(plate, OPTION_SIZE >> 1, 0)).toBe(C.groove);
    // opaque: every pixel inside the outline is painted
    expect(at(plate, OPTION_SIZE >> 1, OPTION_SIZE >> 1)).toBe(C.panel);
    // neighbouring plates do not touch
    const [a, b] = layout.options;
    expect(Math.hypot(a!.x - b!.x, a!.y - b!.y)).toBeGreaterThan(OPTION_SIZE);
  });

  it('every look of a plate is told apart from the others', () => {
    for (const make of [optionPlate, choicePlate, (l: PlateLook) => pinCell(1, l)]) {
      const all = LOOKS.map(make);
      for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) expect(same(all[i]!, all[j]!)).toBe(false);
    }
  });

  it('ft_1_20.AC20 a choice and the board under a row of them fit the layout\'s choices with two cells round them', () => {
    const layout = bubbleLayout({ at: { x: 100, y: 90 }, options: 8, screen: { w: 320, h: 180 }, open: { option: 2, choices: 3 } });
    expect(choicePlate().width).toBe(layout.choices[0]!.w);
    const back = choicesBack(3);
    expect(back.width).toBe(layout.choices[2]!.x + layout.choices[2]!.w - layout.choices[0]!.x + 4);
    expect(back.height).toBe(layout.choices[0]!.h + 4);
  });

  it('ft_1_20.AC21 the strip is as high as the layout\'s strip and a cell spans as the layout spans it', () => {
    expect(STRIP_ROWS).toBe(PIN_ROWS);
    expect(stripBitmap(320).height).toBe(PIN_ROWS);
    expect(pinCell(1).width).toBe(PIN_CELL_SIZE.w);
    expect(pinCell(1).height).toBe(PIN_CELL_SIZE.h);
    expect(pinCell(cellSpan(70, PIN_CELL_SIZE.w)).width).toBe(3 * PIN_CELL_SIZE.w + 2);
  });

  it('every picture of an action fits a cell of the strip with a cell\'s room round it', () => {
    for (const icon of Object.values(TOOL_ICONS)) {
      expect(icon.height).toBeLessThanOrEqual(PIN_CELL_SIZE.h - 4);
      expect(icon.width).toBeLessThanOrEqual(PIN_CELL_SIZE.w - 4);
    }
  });

  it('the pictures made for the bubble fit inside an option\'s round plate', () => {
    for (const id of ['more', 'analyse', 'speed', 'scale', 'triad', 'handLeft', 'handRight', 'bug', 'learn', 'sectionShort', 'click', 'circle', 'statsPane', 'tempo'] as const) {
      expect(TOOL_ICONS[id].width, id).toBeLessThanOrEqual(OPTION_SIZE - 4);
      expect(TOOL_ICONS[id].height, id).toBeLessThanOrEqual(OPTION_SIZE - 4);
    }
  });

  it('a long press fills its ring as it goes on, full at the end', () => {
    const gold = (b: Bitmap) => b.pixels.filter((p) => p === C.goldLight).length;
    expect(gold(pressRing(0))).toBe(0);
    expect(gold(pressRing(0.3))).toBeLessThan(gold(pressRing(0.6)));
    expect(gold(pressRing(1))).toBe(gold(pressRing(2)));
    expect(gold(pressRing(1))).toBeGreaterThan(0);
  });

  it('a worn option that is on shows its picture on a gold chip at least as high as a cell', () => {
    const chip = wornChip(TOOL_ICONS.fingers);
    expect(chip.height).toBe(PIN_CELL_SIZE.h);
    expect(chip.width).toBeGreaterThanOrEqual(TOOL_ICONS.fingers.width + 4);
    expect(chip.pixels.some((p) => p === C.gold)).toBe(true);
  });

  it('ft_1_20.AC23 the backpack is no larger than the gear beside it, wears a dot when an item is new, and opens into a bag of 3 x 3 items', () => {
    expect(BACKPACK.width).toBeLessThanOrEqual(ICONS.settings.width);
    expect(BACKPACK.height).toBeLessThanOrEqual(ICONS.settings.height + 1);
    expect(inkCount(BACKPACK)).toBeGreaterThan(100);
    expect(NEW_ITEM_DOT.pixels.some((p) => p === C.red)).toBe(true);
    // opened, the bag holds 3 x 3 items, each place inside the bag and large enough for a 56 x 40 fine picture
    const bag = openBackpack();
    expect(bag.width).toBe(OPEN_BAG.w);
    const places = openBagPlaces();
    expect(places).toHaveLength(9);
    for (const p of places) {
      expect(p.w * 2).toBeGreaterThanOrEqual(56);
      expect(p.h * 2).toBeGreaterThanOrEqual(40);
      expect(p.x + p.w).toBeLessThanOrEqual(OPEN_BAG.w);
      expect(p.y + p.h).toBeLessThanOrEqual(OPEN_BAG.h);
      // the inside is dark where an item lies, no box round it
      expect([C.panelDark, C.night]).toContain(at(bag, p.x + (p.w >> 1), p.y + (p.h >> 1)));
    }
    // the arrows show only when rows lie above or below
    expect(same(openBackpack({ down: true }), bag)).toBe(false);
    expect(optionFocus().width).toBe(OPTION_SIZE + 4);
  });
});
