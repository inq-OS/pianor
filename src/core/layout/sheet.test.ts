// Covers ft_0_05.AC4.
import { describe, expect, it } from 'vitest';
import littleSteps from '../../../tests/fixtures/charts/little-steps.v2.json';
import { chartSchema } from '../chart';
import { layoutStaff } from './staff';
import { edgeReach, SHEET, sheetForStaff, sheetPlan, staffInk } from './sheet';

/** Ink that leaves every side all the room a strip can want. */
const ROOMY = { left: 20, right: 620, top: 20, bottom: 228 };

describe('the sheet of parchment under a staff (d119)', () => {
  it('shows the widest strip of desk on every side when the staff keeps its margins, and turns its corner', () => {
    expect(sheetPlan(640, 248, ROOMY)).toEqual({ width: 640, height: 248, desk: { left: SHEET.side, right: SHEET.side, top: SHEET.ends, bottom: SHEET.ends }, turn: SHEET.turn });
  });

  it('narrows a strip so the torn edge stays clear of the ink (practice: the arrow under the staff leaves 8 pixels)', () => {
    const plan = sheetPlan(640, 108, { left: 17, right: 623, top: 10, bottom: 100 });
    expect(plan.desk).toEqual({ left: SHEET.side, right: SHEET.side, top: 4, bottom: 3 });
    for (const [strip, room] of [[plan.desk.top, 10], [plan.desk.bottom, 8]] as const) expect(edgeReach(strip) + SHEET.clear).toBeLessThanOrEqual(room);
  });

  it('runs off a side where the ink leaves no room for an edge, and turns no corner there', () => {
    const plan = sheetPlan(640, 248, { ...ROOMY, left: 3, right: 638 });
    expect(plan.desk).toMatchObject({ left: 0, right: 0, top: SHEET.ends });
    expect(plan.turn).toBe(0);
    expect(sheetPlan(640, 248, { ...ROOMY, bottom: 246 })).toMatchObject({ desk: { bottom: 0, right: SHEET.side }, turn: 0 });
  });

  it('gives a staff moved in by `staffInset` its widest sides, also with a brace that hangs left of its lines', () => {
    // the piece maker at the target screen: its brace is under 3 fine pixels from the side of its layout
    const left = SHEET.staffInset + 2.6;
    expect(sheetPlan(640, 248, { ...ROOMY, left, right: 640 - left }).desk).toMatchObject({ left: SHEET.side, right: SHEET.side });
  });

  it('turns no corner on a sheet too small for one', () => {
    expect(sheetPlan(640, SHEET.turnRoom * SHEET.turn - 1, { left: 20, right: 620, top: 12, bottom: 32 })).toMatchObject({ desk: { bottom: SHEET.ends }, turn: 0 });
  });

  it('a torn edge reaches further than its strip, and not at all where there is none', () => {
    expect(edgeReach(0)).toBe(0);
    expect(edgeReach(SHEET.side)).toBeGreaterThan(SHEET.side);
  });
});

describe('the ink a sheet keeps clear of (d119)', () => {
  const chart = chartSchema.parse(littleSteps);
  // practice at the target screen: the staff's area is 1920 x 324 screen pixels, 3 to the fine pixel
  const layout = layoutStaff(chart, { viewport: { width: 1920, height: 324 } });

  it('is the staff\'s lines and clef, with the room for bar numbers above and the cursor\'s arrow below', () => {
    const ink = staffInk(layout);
    const S = layout.staffSpace;
    const system = layout.systems[0]!;
    expect(ink.left).toBe(Math.min(...layout.staffLines.map((l) => l.x1)));
    expect(ink.right).toBe(Math.max(...layout.staffLines.map((l) => l.x2)));
    expect(ink.top).toBeLessThanOrEqual(system.topLineY - 2 * S);
    expect(ink.top).toBeLessThanOrEqual(Math.min(...layout.clefs.map((c) => c.y)));
    // the arrow under a single staff points up from its tip's row: nothing is drawn below it
    expect(ink.bottom).toBe(system.cursorTipY);
  });

  it('does not move when a note is written far above the staff: the sheet stays while the piece maker writes', () => {
    const high = { ...layout, notes: layout.notes.map((n) => ({ ...n, y: n.y - 500 })) };
    expect(staffInk(high)).toEqual(staffInk(layout));
  });

  it('reaches above an arrow that points down at the upper staff of a grand staff, and under it', () => {
    const tipY = 5;
    const twoStaves = { ...layout, systems: layout.systems.map((s) => ({ ...s, staves: [{ ...s.staves[0]!, arrow: { tipY, direction: 'down' as const } }, ...s.staves] })) };
    expect(staffInk(twoStaves).top).toBe(tipY);
    const low = { ...layout, systems: layout.systems.map((s) => ({ ...s, staves: [{ ...s.staves[0]!, arrow: { tipY: layout.height - 2, direction: 'down' as const } }] })) };
    expect(staffInk(low).bottom).toBeGreaterThan(layout.height - 2);
  });

  it('reaches left of a grand staff\'s brace', () => {
    const grand = { ...layout, braces: [{ system: 0, x: layout.staffLines[0]!.x1, y1: 10, y2: 90 }] };
    expect(staffInk(grand).left).toBeLessThan(staffInk(layout).left - layout.staffSpace);
  });

  it('is the whole area for a layout with no staff', () => {
    expect(staffInk({ ...layout, staffLines: [], braces: [], clefs: [], systems: [] })).toEqual({ left: 0, right: layout.width, top: 0, bottom: layout.height });
  });

  it('gives practice a sheet with desk on all four sides and a turned corner', () => {
    const plan = sheetForStaff(layout, 3);
    expect(plan).toMatchObject({ width: 640, height: 108, turn: SHEET.turn });
    expect(plan.desk.left).toBe(SHEET.side);
    expect(plan.desk.right).toBe(SHEET.side);
    expect(plan.desk.top).toBeGreaterThanOrEqual(SHEET.least);
    expect(plan.desk.bottom).toBeGreaterThanOrEqual(SHEET.least);
  });

  it('covers the wider ground of a staff moved in from the sides, and counts the ink from the ground\'s side', () => {
    const before = SHEET.staffInset * 3;
    const narrow = layoutStaff(chart, { viewport: { width: 1920 - 2 * before, height: 324 } });
    const plan = sheetForStaff(narrow, 3, { before, width: 1920 });
    expect(plan.width).toBe(640);
    expect(plan.desk).toMatchObject({ left: SHEET.side, right: SHEET.side });
    // the same staff at the very side of its own area leaves less room than with the ground around it
    const tight = { ...narrow, staffLines: narrow.staffLines.map((l) => ({ ...l, x1: 9 })) };
    expect(sheetForStaff(tight, 3).desk.left).toBe(0);
    expect(sheetForStaff(tight, 3, { before, width: 1920 }).desk.left).toBe(SHEET.side);
  });
});
