import { fullBarTicks, type Chart } from '../chart';
import { accidentalRoomAt, barInner, type StaffLayout } from './staff';
import type { PaceMark } from './beat';
import { SCORE_COLOURS } from './scoreColour';
import type { BarLayout } from './staffTypes';

/**
 * The beat lane (core_13 rule 2): a row of faint dots along each line of the staff, above it or between its two staves,
 * where a wave runs at the tempo. A ghost dot stands every thirty-second (a dotted line), a beat dot a little bigger on every click, the first of
 * the bar bigger still, and a note dot under every chord; when the wave passes a dot it nudges it up. Pure: the view only
 * paints it, and it decides nothing.
 */
export type LanePlace = 'above' | 'between' | 'off';

export type LaneDotKind = 'ghost' | 'beat' | 'downbeat';

export interface LaneDot {
  system: number;
  /** Where its centre sits at rest, in layout pixels. */
  x: number;
  y: number;
  /** The drawn chart's tick it stands for. */
  tick: number;
  kind: LaneDotKind;
  /** A note (or chord) starts here: the dot stands under its column. */
  note: boolean;
}

/** Dots a quarter: a ghost every thirty-second, close enough to read as a dotted line. */
const GHOSTS_PER_BEAT = 8;

/**
 * `AX-3 provisional:` the lane above a staff sits this many staff spaces over its top line, and at least `ABOVE_INK` over
 * the highest head, stem or ledger line of the line's top staff where the sheet has room for it; a dot closer than `MERGE` staff spaces to a note's column
 * at the same tick is moved onto that column.
 */
const ABOVE_LINE = 1.5;
const ABOVE_INK = 1;
/** The lane above a staff never goes nearer the top of the staff's area than this, in staff spaces: it stays on the sheet. */
const ABOVE_EDGE = 0.9;
const MERGE = 1.5;

/** The x of `tick` in `bar` (the drawn chart's ticks), as the notes are placed (`xAt` in staff.ts). */
function tickX(layout: StaffLayout, chart: Chart, bar: BarLayout, tick: number): number {
  const S = layout.staffSpace;
  const span = chart.bars[bar.index]!;
  const offset = tick - span.startTick;
  const inner = barInner(bar, S);
  const room = accidentalRoomAt(bar, tick) * S;
  const columns = bar.columns;
  if (columns && columns.length > 0) {
    // bars as wide as their columns: between two columns in proportion, past the last towards the bar's end
    const points = [...columns.map((c) => ({ tick: c.tick, x: c.x })), { tick: span.endTick - span.startTick, x: inner.left + inner.width }];
    for (let i = points.length - 1; i >= 0; i--) {
      const p = points[i]!;
      if (offset < p.tick) continue;
      const next = points[i + 1];
      if (!next || next.tick === p.tick) return p.x;
      return p.x + ((offset - p.tick) / (next.tick - p.tick)) * (next.x - p.x);
    }
    return inner.left;
  }
  const length = span.endTick - span.startTick;
  return inner.left + (offset / length) * (inner.width - bar.roomTotal * S) + room;
}

/** The lane's y on `system`: between its two staves, or above its top staff (also for "between" on a single staff). */
export function laneY(layout: StaffLayout, system: number, place: Exclude<LanePlace, 'off'>): number {
  const S = layout.staffSpace;
  const line = layout.systems[system]!;
  const [top, bottom] = line.staves;
  if (place === 'between' && top && bottom) return (top.bottomLineY + bottom.topLineY) / 2;
  let ink = line.topLineY;
  for (const n of layout.notes) {
    if (n.system !== system || n.staff !== 0) continue;
    ink = Math.min(ink, n.y - n.headRy, ...(n.stem ? [n.stem.y1, n.stem.y2] : []), ...n.ledgerLines.map((l) => l.y));
  }
  return Math.max(ABOVE_EDGE * S, Math.min(line.topLineY - ABOVE_LINE * S, ink - ABOVE_INK * S));
}

/**
 * The lane's dots for `chart` (the chart the staff draws) laid out as `layout`, at `place`; none when it is off. Beats are
 * counted in quarters from the bar's start, as the click counts them; a short first bar (a pick-up) counts back from its end.
 */
export function laneDots(layout: StaffLayout, chart: Chart, place: LanePlace): LaneDot[] {
  if (place === 'off') return [];
  const S = layout.staffSpace;
  const step = chart.ppq / GHOSTS_PER_BEAT;
  const full = fullBarTicks(chart.meterMap, chart.ppq);
  const ys = layout.systems.map((s) => laneY(layout, s.index, place));
  // the columns of the notes, one a tick and bar
  const columns = new Map<string, number>();
  for (const n of layout.notes) {
    const note = chart.notes[n.index];
    if (note) columns.set(`${n.bar}:${note.tick}`, n.column);
  }
  const dots: LaneDot[] = [];
  for (const bar of layout.bars) {
    const span = chart.bars[bar.index];
    if (!span) continue;
    const y = ys[bar.system]!;
    // a pick-up counts back from its end, so its last beat is the bar's last
    const pickUp = bar.index === 0 && span.endTick - span.startTick < full;
    const origin = pickUp ? span.endTick - Math.ceil((span.endTick - span.startTick) / chart.ppq) * chart.ppq : span.startTick;
    const own = new Set<number>();
    for (let tick = origin; tick < span.endTick; tick += step) {
      if (tick < span.startTick) continue;
      const beat = (tick - origin) % chart.ppq === 0;
      const kind: LaneDotKind = !beat ? 'ghost' : tick === span.startTick && !pickUp ? 'downbeat' : 'beat';
      const x = tickX(layout, chart, bar, tick);
      const column = columns.get(`${bar.index}:${tick}`);
      if (column !== undefined && Math.abs(column - x) < MERGE * S) {
        dots.push({ system: bar.system, x: column, y, tick, kind, note: true });
        own.add(tick);
      } else dots.push({ system: bar.system, x, y, tick, kind, note: false });
    }
    // notes off the grid (a triplet, a whole note centred in its bar) get a dot of their own
    for (const [key, column] of columns) {
      const [barIndex, tickText] = key.split(':');
      const tick = Number(tickText);
      if (Number(barIndex) !== bar.index || own.has(tick)) continue;
      dots.push({ system: bar.system, x: column, y, tick, kind: 'ghost', note: true });
    }
  }
  // a note dot that landed on a ghost's place takes it
  return dots
    .filter((d) => d.note || !dots.some((o) => o !== d && o.note && o.system === d.system && Math.abs(o.tick - d.tick) < step && Math.abs(o.x - d.x) < 0.5 * S))
    .sort((a, b) => a.system - b.system || a.x - b.x);
}

/** How far the wave reaches either side of its crest, in quarters: a narrow bump, `AX-3 provisional:`. */
export const WAVE_REACH = 0.25;

/** How much the wave at `waveTick` lifts a dot at `dotTick`, 0 to 1: fully at the crest, falling off as a parabola to none `WAVE_REACH` away. */
export function laneLift(dotTick: number, waveTick: number | null, ppq: number): number {
  if (waveTick === null) return 0;
  const d = Math.abs(dotTick - waveTick) / (WAVE_REACH * ppq);
  return d >= 1 ? 0 : 1 - d * d;
}

/**
 * Where the wave is (a drawn tick) `nowMs` after it left `anchor` (a tick and the time it was there), running at `msPerTick`
 * and at most `reachTicks` past the anchor, where it waits for the next key; null with no anchor or pace.
 */
export function waveTick(anchor: { tick: number; atMs: number } | null, msPerTick: number | null, nowMs: number, reachTicks: number): number | null {
  if (!anchor || msPerTick === null || !(msPerTick > 0)) return null;
  const run = Math.max(0, (nowMs - anchor.atMs) / msPerTick);
  return anchor.tick + Math.min(reachTicks, run);
}

/** The colours of a played note's dot against the student's own pace (core_13.AC5): green in step, orange a little off, red far off. */
export const PACE_COLOURS = { even: 0x1f9d55, near: 0xff7a00, far: SCORE_COLOURS.missed } as const;

export function paceColour(mark: Pick<PaceMark, 'side' | 'far'>): number {
  if (mark.side === 'even') return PACE_COLOURS.even;
  return mark.far ? PACE_COLOURS.far : PACE_COLOURS.near;
}
