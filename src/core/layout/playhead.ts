import type { Chart } from '../chart';
import { barIndexAtTick } from '../chart';
import { BAR_PAD_RIGHT, accidentalRoomAt, type StaffLayout } from './staff';

/** The running line of Tempo mode: where it stands on the screen, and which page it is on. All in layout pixels. */
export interface Playhead {
  system: number;
  /** The page of that system, so the view can turn to it. */
  page: number;
  x: number;
  y1: number;
  y2: number;
}

/**
 * Where the playhead is at `tick`: across the whole width of its bar in proportion to the time, so it moves at one speed
 * through the bar lines of a line. The notes sit in the bar's inner part (`barInner`), which leaves out a padding at
 * each bar line; a line that ran over the inner part only stood still for no time across that padding and jumped once per
 * bar. To keep the line on the notes it runs `BAR_PAD_RIGHT` staff spaces ahead of the bar's start: it is then 0.8 staff
 * spaces before the first note of a bar, on the note a third into the bar, and at most 1.6 staff spaces past a note at the
 * very end of a bar (1.0 on a beat of 4/4). At the last bar line of a line it waits until the line turns.
 * Before the piece (the count-in, negative ticks) it waits where the piece starts; after it, at the final bar line.
 */
export function playheadAt(layout: StaffLayout, chart: Chart, tick: number): Playhead {
  const first = chart.bars[0]!;
  const last = chart.bars[chart.bars.length - 1]!;
  const clamped = Math.max(first.startTick, Math.min(last.endTick - 1, tick));
  const barIndex = Math.max(0, barIndexAtTick(chart.bars, clamped));
  const span = chart.bars[barIndex]!;
  const bar = layout.bars[barIndex]!;
  const system = layout.systems[bar.system]!;
  const S = layout.staffSpace;
  const fraction = tick >= last.endTick ? 1 : (clamped - span.startTick) / (span.endTick - span.startTick);
  const lineEnd = Math.max(...layout.bars.filter((b) => b.system === bar.system).map((b) => b.x + b.width));
  // the room of the bar's accidentals is left out of the run and added where the notes are (see `xAt` in staff.ts)
  const x = Math.min(lineEnd, bar.x + BAR_PAD_RIGHT * S + fraction * (bar.width - bar.roomTotal * S) + accidentalRoomAt(bar, clamped) * S);
  return { system: bar.system, page: system.page, x, y1: system.topLineY - 1.2 * S, y2: system.bottomLineY + 1.2 * S };
}
