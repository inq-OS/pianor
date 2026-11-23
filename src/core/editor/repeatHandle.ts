/**
 * The drag-repeat handle of the bar selection (ft_1_02d rule 9, AC24): a small grip at the right edge of the selection's
 * last bar. Dragged right, it shows how many copies of the selection go in after it, in whole selection lengths; let go,
 * they are inserted (`insertBars` in `bars.ts`, paste's rules). Pure: it reads the layout the view draws, so the grip is
 * where it looks.
 */
import type { StaffLayout } from '../layout/staff';
import type { BarRange } from './bars';
import { barBoxes } from './staff';

type Box = { x1: number; x2: number; y1: number; y2: number };

/** The grip's size in staff spaces: a little wider and taller for the pointer than it is drawn. */
const HANDLE_WIDTH = 1;
const HANDLE_HEIGHT = 2;
const GRAB = 0.5;

/** The grip as drawn, centred on the right edge of the selection's last bar; null when that bar is not on `page`. */
export function repeatHandleBox(layout: StaffLayout, range: BarRange, page: number): Box | null {
  const last = barBoxes(layout, { from: range.to, to: range.to })[0];
  if (!last || last.page !== page) return null;
  const S = layout.staffSpace;
  const middle = (last.y1 + last.y2) / 2;
  return { x1: last.x2 - (HANDLE_WIDTH * S) / 2, x2: last.x2 + (HANDLE_WIDTH * S) / 2, y1: middle - (HANDLE_HEIGHT * S) / 2, y2: middle + (HANDLE_HEIGHT * S) / 2 };
}

/** Whether `point` (staff coordinates) grabs the grip. */
export function onRepeatHandle(layout: StaffLayout, range: BarRange, page: number, point: { x: number; y: number }): boolean {
  const box = repeatHandleBox(layout, range, page);
  if (!box) return false;
  const grab = GRAB * layout.staffSpace;
  return point.x >= box.x1 - grab && point.x <= box.x2 + grab && point.y >= box.y1 - grab && point.y <= box.y2 + grab;
}

/**
 * How many copies of the selection a drag to `point` (staff coordinates, on `page`) asks for: the bars it reaches past the
 * selection's end, in selection lengths rounded up, so a drag into the next length shows one more copy. Past a line's last
 * bar it counts that bar, and past the piece's last bar it goes on by that bar's width. 0 on the selection, before it, or
 * off every line.
 */
export function repeatCopies(layout: StaffLayout, range: BarRange, page: number, point: { x: number; y: number }): number {
  const length = range.to - range.from + 1;
  const boxes = layout.bars.map((_, i) => barBoxes(layout, { from: i, to: i })[0]);
  const onLine = boxes.flatMap((box, i) => (box && box.page === page && point.y >= box.y1 && point.y <= box.y2 ? [{ box, i }] : []));
  if (onLine.length === 0) return 0;
  const under = onLine.find(({ box }) => point.x >= box.x1 && point.x < box.x2);
  let bar: number;
  if (under) bar = under.i;
  else {
    const last = onLine.at(-1)!;
    if (point.x < onLine[0]!.box.x1) return 0; // left of the line's first bar: the clef and key
    // beyond a line's last bar: that bar, and past the piece's last bar on by its width
    bar = last.i === layout.bars.length - 1 ? last.i + Math.ceil((point.x - last.box.x2) / (last.box.x2 - last.box.x1)) : last.i;
  }
  const past = bar - range.to;
  return past > 0 ? Math.ceil(past / length) : 0;
}
