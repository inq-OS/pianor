import type { StaffLayout } from './staffTypes';

/**
 * Where the sheet of parchment lies under a staff (d119): the staff's area is a desk, and the sheet is a torn skin on
 * it with a strip of the desk's wood showing along each side. All in fine art pixels (d110). The painter
 * (`src/game/ui/pixel/paint/parchment.ts`) only paints this plan; the staff view (`StaffView`) asks for it.
 *
 * The staff's ink decides how much desk can show: a torn edge never comes nearer to the staff (its lines, braces and
 * clefs, and the room it keeps for bar numbers above and the cursor's arrow below) than `SHEET.clear`. Where a staff
 * reaches too near a side of its area, the strip there narrows, and under `SHEET.least` the sheet runs off that side
 * with no edge in sight, as if the bar beside it held it down. Notes are never made smaller for the sheet.
 */
export const SHEET = {
  /** The desk showing at the left and right of the sheet, on average: the widest strip. */
  side: 8,
  /** The desk showing above and below the sheet, on average: the widest strip. Rows are dearer than columns. */
  ends: 5,
  /** A strip narrower than this is not worth an edge: the sheet runs off that side. */
  least: 2,
  /** The least room between the innermost reach of a torn edge and the staff's ink. */
  clear: 3,
  /** How far a torn edge strays from its strip's width, as a share of the strip (to either side), and one more pixel for a nick. */
  stray: 0.6,
  nick: 1,
  /** The side of the corner turned up at the lower right; a sheet lower or narrower than `turnRoom` times this has none. */
  turn: 9,
  turnRoom: 5,
  /**
   * How far a staff whose own margin is too small for a strip (the piece maker's: many small bars, a brace at the
   * screen's side) is moved in from the left and the right of its area, so its sheet shows its torn sides. Never from
   * the top or the bottom: a grand staff needs every row.
   */
  staffInset: 12,
} as const;

export interface SheetPlan {
  /** The whole area, desk included. */
  width: number;
  height: number;
  /** The desk's strip on each side, on average; 0 where the sheet runs off the area. */
  desk: { left: number; right: number; top: number; bottom: number };
  /** The side of the turned corner at the lower right; 0 for none. */
  turn: number;
}

/** The furthest a torn edge reaches into the area from a side whose strip is `strip` wide. */
export function edgeReach(strip: number): number {
  return strip === 0 ? 0 : strip * (1 + SHEET.stray / 2) + SHEET.nick;
}

/** The widest strip, up to `most`, whose torn edge stays `SHEET.clear` away from ink that starts `room` in from the side. */
function stripFor(room: number, most: number): number {
  for (let strip = most; strip >= SHEET.least; strip--) if (edgeReach(strip) + SHEET.clear <= room) return strip;
  return 0;
}

/**
 * The sheet for an area of `width` x `height`, under a staff whose ink lies inside the box `ink` (its sides counted
 * from the area's left and top).
 */
export function sheetPlan(width: number, height: number, ink: { left: number; right: number; top: number; bottom: number }): SheetPlan {
  const desk = {
    left: stripFor(ink.left, SHEET.side),
    right: stripFor(width - ink.right, SHEET.side),
    top: stripFor(ink.top, SHEET.ends),
    bottom: stripFor(height - ink.bottom, SHEET.ends),
  };
  const turns = desk.right > 0 && desk.bottom > 0 && width >= SHEET.turnRoom * SHEET.turn && height >= SHEET.turnRoom * SHEET.turn;
  return { width, height, desk, turn: turns ? SHEET.turn : 0 };
}

/** What the view draws left of a brace's place: its width in staff spaces, and half its stroke (`StaffView`). */
const BRACE_REACH = 1.1 + 0.11;
/** The room a staff keeps above its top line for bar numbers and under its bottom line for note names, in staff spaces. */
const ROOM = 2;
/** The height of the cursor's arrow, in staff spaces (`StaffView`): it is drawn from its `tipY` away from the staff's notes. */
const ARROW = 0.9;

/**
 * The box a staff's standing ink lies in, in the layout's own pixels: its lines, braces and clefs, the room for bar
 * numbers above the first line and for note names under the last, and the cursor's arrows. Notes are not counted:
 * the box, and with it the sheet, stays as it is while notes are written (the piece maker), and a note far outside
 * the staff may lie on the sheet's darker rim. An empty layout has its whole area as its box.
 */
export function staffInk(layout: Pick<StaffLayout, 'staffSpace' | 'width' | 'height' | 'staffLines' | 'braces' | 'clefs' | 'systems'>): { left: number; right: number; top: number; bottom: number } {
  const S = layout.staffSpace;
  if (layout.staffLines.length === 0) return { left: 0, right: layout.width, top: 0, bottom: layout.height };
  const arrows = layout.systems.flatMap((s) => s.staves.map((staff) => staff.arrow));
  return {
    left: Math.min(...layout.staffLines.map((l) => l.x1), ...layout.braces.map((b) => b.x - BRACE_REACH * S)),
    right: Math.max(...layout.staffLines.map((l) => l.x2)),
    top: Math.min(...layout.clefs.map((c) => c.y), ...layout.systems.map((s) => s.topLineY - ROOM * S), ...arrows.map((a) => (a.direction === 'down' ? a.tipY : a.tipY - ARROW * S))),
    bottom: Math.max(...layout.clefs.map((c) => c.y + c.h), ...layout.systems.map((s) => s.bottomLineY + ROOM * S), ...arrows.map((a) => (a.direction === 'up' ? a.tipY : a.tipY + ARROW * S))),
  };
}

/**
 * The sheet under a staff drawn at `fine` screen pixels to the fine art pixel. By default it covers the layout's own
 * area. A staff moved in from the sides of its area (`SHEET.staffInset`) names that wider area as `ground`: its width
 * and how far left of the layout it starts, in screen pixels.
 */
export function sheetForStaff(layout: Parameters<typeof staffInk>[0], fine: number, ground: { before: number; width: number } = { before: 0, width: layout.width }): SheetPlan {
  const ink = staffInk(layout);
  const left = (ink.left + ground.before) / fine, right = (ink.right + ground.before) / fine;
  return sheetPlan(Math.ceil(ground.width / fine), Math.ceil(layout.height / fine), { left, right, top: ink.top / fine, bottom: ink.bottom / fine });
}
