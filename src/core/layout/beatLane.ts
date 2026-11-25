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
  /** The staves (0 the top one) with a note starting here; empty for a dot with no note. */
  staves: number[];
  /** It stands on the lane's grid (every thirty-second); a note off it has a dot of its own. */
  grid: boolean;
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
export function laneDots(layout: StaffLayout, chart: Chart, place: LanePlace, offset = 0): LaneDot[] {
  if (place === 'off') return [];
  const S = layout.staffSpace;
  const step = chart.ppq / GHOSTS_PER_BEAT;
  const full = fullBarTicks(chart.meterMap, chart.ppq);
  // moved by the player `offset` staff spaces down (up when negative), and never off the sheet's top
  const ys = layout.systems.map((s) => Math.max(ABOVE_EDGE * S, laneY(layout, s.index, place) + offset * S));
  // the columns of the notes, one a tick and bar, and the staves they are on
  const columns = new Map<string, number>();
  const stavesAt = new Map<string, Set<number>>();
  for (const n of layout.notes) {
    const note = chart.notes[n.index];
    if (!note) continue;
    const key = `${n.bar}:${note.tick}`;
    columns.set(key, n.column);
    stavesAt.set(key, (stavesAt.get(key) ?? new Set()).add(n.staff));
  }
  const stavesOf = (bar: number, tick: number) => [...(stavesAt.get(`${bar}:${tick}`) ?? [])].sort();
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
        dots.push({ system: bar.system, x: column, y, tick, kind, note: true, staves: stavesOf(bar.index, tick), grid: true });
        own.add(tick);
      } else dots.push({ system: bar.system, x, y, tick, kind, note: false, staves: [], grid: true });
    }
    // notes off the grid (a triplet, a whole note centred in its bar) get a dot of their own
    for (const [key, column] of columns) {
      const [barIndex, tickText] = key.split(':');
      const tick = Number(tickText);
      if (Number(barIndex) !== bar.index || own.has(tick)) continue;
      dots.push({ system: bar.system, x: column, y, tick, kind: 'ghost', note: true, staves: stavesOf(bar.index, tick), grid: false });
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
export function laneLift(dotTick: number, waveTick: number | null, ppq: number, reach = WAVE_REACH): number {
  if (waveTick === null || !(reach > 0)) return 0;
  const d = Math.abs(dotTick - waveTick) / (reach * ppq);
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

/**
 * How one lane looks, as the player tunes it (core_13 rule 10): where it runs (`place`, moved `offset` staff spaces down,
 * up when negative), how strong each kind of dot is (0 hides it, 1 full), and the wave's height in staff spaces and its
 * reach either side of the crest in quarters, and whether the notes blink as the wave passes.
 */
export interface LaneLook {
  place: Exclude<LanePlace, 'off'>;
  offset: number;
  dots: { ghost: number; beat: number; top: number; bottom: number };
  wave: { height: number; reach: number };
  /** Opt-in: each note the lane has a dot for lights up as the wave's crest passes it (core_13 rule 10). */
  blink?: boolean | undefined;
}

/** `AX-3 provisional:` at most this many lanes, and the ranges a player can tune within. */
export const LANE_LIMITS = { lanes: 3, offset: 6, height: 1.5, reach: 1 } as const;

/** The lane every player has until they tune it: every dot at full strength, the wave as the first slice drew it. */
export function defaultLaneLook(place: Exclude<LanePlace, 'off'> = 'between'): LaneLook {
  return { place, offset: 0, dots: { ghost: 1, beat: 1, top: 1, bottom: 1 }, wave: { height: 0.8, reach: WAVE_REACH } };
}

/**
 * How `dot` is drawn in `look`: as a note dot as strong as the strongest staff it stands for, else as its beat (the bar's
 * first: `downbeat`) or ghost, whichever is stronger; `strength` 0 to 1, 0 leaves it out. A note dot off the grid (a
 * triplet, a whole note centred in its bar) has no beat or ghost to fall back to.
 */
export function dotLook(dot: LaneDot, look: LaneLook): { role: LaneDotKind | 'note'; strength: number } {
  const grid = dot.grid ? (dot.kind === 'ghost' ? look.dots.ghost : look.dots.beat) : 0;
  const note = dot.note ? Math.max(0, ...dot.staves.map((s) => (s === 0 ? look.dots.top : look.dots.bottom))) : 0;
  // a beat keeps its size when it is the stronger, so the click's dots stay a row of their own
  if (note > grid) return { role: 'note', strength: note };
  return { role: dot.kind, strength: grid };
}

/** `AX-3 provisional:` the lane is moved in quarter staff spaces. */
export const LANE_OFFSET_STEP = 0.25;

/**
 * The steps a player picks from in the lane's bubble (core_13 rule 10), from the most to the least: how strong a kind of
 * dot is (0 hides it), how high the wave lifts and how wide it is. `AX-3 provisional:` the steps.
 */
export const LANE_STEPS = {
  strength: [1, 0.6, 0.3, 0],
  height: [1.5, 1.2, 0.8, 0.4],
  reach: [1, 0.5, WAVE_REACH, 0.15],
} as const;

/** `offset` in the lane's steps and within the limits a player can move it. */
export function clampLaneOffset(offset: number): number {
  return Math.max(-LANE_LIMITS.offset, Math.min(LANE_LIMITS.offset, Math.round(offset / LANE_OFFSET_STEP) * LANE_OFFSET_STEP));
}

/**
 * Where a lane added by a click at `y` (layout pixels) on `system` runs: from the nearer of its places (between the two
 * staves, or above), moved to the click.
 */
export function laneAt(layout: StaffLayout, system: number, y: number): { place: Exclude<LanePlace, 'off'>; offset: number } {
  const S = layout.staffSpace;
  const two = (layout.systems[system]?.staves.length ?? 0) > 1;
  const places: Exclude<LanePlace, 'off'>[] = two ? ['between', 'above'] : ['above'];
  let best = places[0]!;
  for (const place of places) if (Math.abs(y - laneY(layout, system, place)) < Math.abs(y - laneY(layout, system, best))) best = place;
  return { place: best, offset: clampLaneOffset((y - laneY(layout, system, best)) / S) + 0 };
}
