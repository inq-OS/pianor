// Covers ft_0_05.AC4.
import { describe, expect, it } from 'vitest';
import { STAFF_INK } from '../../../../core/layout/scoreColour';
import { edgeReach, SHEET, sheetPlan, type SheetPlan } from '../../../../core/layout/sheet';
import { contrast, lchOf } from './lab';
import { paintParchment, PARCHMENT_PALETTE, PARCHMENT_PAPER, PARCHMENT_RUNS, WRITING_FLOOR, WRITING_FROM } from './parchment';

/** The piece maker's area at the target screen, with all the room a sheet can want. */
const ROOMY: SheetPlan = sheetPlan(640, 248, { left: 20, right: 620, top: 20, bottom: 228 });
const skin = new Set(PARCHMENT_RUNS.skin), desk = new Set(PARCHMENT_RUNS.desk);
const at = (bitmap: { width: number; pixels: Uint8Array }, x: number, y: number): number => bitmap.pixels[y * bitmap.width + x]!;

describe('the sheet of parchment under a staff (d119)', () => {
  const sheet = paintParchment(ROOMY);

  it('paints every pixel of its area, from its two runs only, the same on every call', () => {
    expect(sheet.width).toBe(640);
    expect(sheet.height).toBe(248);
    expect([...new Set(sheet.pixels)].every((place) => skin.has(place) || desk.has(place))).toBe(true);
    expect(paintParchment(ROOMY).pixels).toEqual(sheet.pixels);
    expect(PARCHMENT_PALETTE.length).toBeLessThanOrEqual(256);
  });

  it('keeps the skin pale where notes are written: the staff\'s ink reads on every pixel there (AX-0)', () => {
    const floor = PARCHMENT_RUNS.skin[Math.floor(WRITING_FLOOR * (PARCHMENT_RUNS.skin.length - 1))]!;
    const inX = Math.ceil(edgeReach(SHEET.side)) + WRITING_FROM, inY = Math.ceil(edgeReach(SHEET.ends)) + WRITING_FROM;
    let darkest = Infinity;
    for (let y = inY; y < sheet.height - inY; y++) {
      for (let x = inX; x < sheet.width - inX; x++) {
        // the turned corner and its crease are no place for notes
        if (sheet.width - x + (sheet.height - y) < 4 * SHEET.turn + inX + inY) continue;
        const place = at(sheet, x, y);
        expect(skin.has(place)).toBe(true);
        darkest = Math.min(darkest, place);
      }
    }
    expect(darkest).toBeGreaterThanOrEqual(floor);
    // 7 to 1 is the mark for small print; the staff's thin lines get more
    expect(contrast(PARCHMENT_PALETTE[floor]!, STAFF_INK)).toBeGreaterThan(7);
    expect(lchOf(PARCHMENT_PALETTE[floor]!).l).toBeGreaterThan(70);
  });

  it('shows the desk along every side that has a strip, and the skin in the middle', () => {
    const middleY = 124, middleX = 320;
    for (const [x, y] of [[0, middleY], [sheet.width - 1, middleY], [middleX, 0], [middleX, sheet.height - 1]] as const) expect(desk.has(at(sheet, x, y))).toBe(true);
    expect(skin.has(at(sheet, middleX, middleY))).toBe(true);
  });

  it('a torn edge stays inside the reach its plan counts on, so it never comes nearer the ink than planned', () => {
    const reach = Math.ceil(edgeReach(SHEET.side));
    for (let y = 0; y < sheet.height; y++) {
      if (y < edgeReach(SHEET.ends) || y >= sheet.height - edgeReach(SHEET.ends) - 2 * SHEET.turn) continue;
      expect(skin.has(at(sheet, reach, y))).toBe(true);
      expect(skin.has(at(sheet, sheet.width - 1 - reach, y))).toBe(true);
    }
  });

  it('runs off a side with no strip: the skin reaches the area\'s side there, and no corner is turned', () => {
    const plan = sheetPlan(640, 120, { left: 2, right: 638, top: 3, bottom: 118 });
    expect(plan).toMatchObject({ desk: { left: 0, right: 0, top: 0, bottom: 0 }, turn: 0 });
    const ground = paintParchment(plan);
    expect([...new Set(ground.pixels)].every((place) => skin.has(place))).toBe(true);
  });

  it('turns its lower right corner up: the desk shows where the corner lay', () => {
    const cornerX = sheet.width - ROOMY.desk.right, cornerY = sheet.height - ROOMY.desk.bottom;
    expect(ROOMY.turn).toBe(SHEET.turn);
    expect(desk.has(at(sheet, cornerX - 2, cornerY - 2))).toBe(true);
    // and the flap lies on the sheet, a tone paler than the body
    expect(skin.has(at(sheet, cornerX - SHEET.turn + 2, cornerY - SHEET.turn + 2))).toBe(true);
  });

  it('names the flat colour of its body from its own skin', () => {
    expect(PARCHMENT_RUNS.skin.map((place) => PARCHMENT_PALETTE[place])).toContain(PARCHMENT_PAPER);
    expect(contrast(PARCHMENT_PAPER, STAFF_INK)).toBeGreaterThan(10);
  });
});
