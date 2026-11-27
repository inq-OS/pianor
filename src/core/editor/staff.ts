/**
 * The editor's staff: bars as wide as what is written in them, at a staff size that only the screen and the piece's
 * hands, meter and key decide, so writing a note never resizes the staff or moves the clef. Where a note can go, a shadow
 * note shows it. Time that nothing takes is not drawn as rests while writing; the piece as played has them. Pure.
 */
import { naturalAtPosition, type Clef } from '../chart/pitch';
import type { Chart } from '../chart/schema';
import { NOTE_TICKS } from '../chart/time';
import { layoutStaff, type BarSpacing, type StaffLayout, type StaffLayoutOptions } from '../layout/staff';
import { toChart } from './chart';
import type { ActionTarget } from './hitTest';
import { keyNames } from './key';
import { barTicks, handsOf, LENGTH_TICKS, placedRests, slotsFor, tickOf, type EditorHand, type EditorPiece } from './model';

/**
 * The staff positions every staff keeps room for: one ledger line below and above, C4 to A5 on the treble staff and E2
 * to C4 on the bass staff. A note further out still gets its room, and then the staff makes room for it.
 */
export const RESERVE_LOW = -2;
export const RESERVE_HIGH = 10;
/**
 * The widest chord inside those positions that never moves the staff: an octave, what a hand spans. A chord's stem starts
 * at its far head, so a wider chord can still push the staff down or up.
 */
export const RESERVE_CHORD = 7;
/** The largest staff space the editor draws (pixels between two lines). */
const MAX_STAFF_SPACE = 24;
/**
 * The smallest: a grand staff takes about 30 staff spaces, so the smallest view (320x180 at 1x, a staff area of 90 rows)
 * only holds it at 3 pixels between lines; at 4x the same rows give 12.
 */
const MIN_STAFF_SPACE = 3;
/** Two lines on a page only when the staff can stay at least this big; otherwise one larger line. */
const TWO_LINES_MIN = 12;
/** What a place for a note (a shadow) is as wide as: a quarter, the length most notes have. */
const SLOT_TICKS = NOTE_TICKS.quarter;

/** The room a column takes, in staff spaces, for the time until the next one: an eighth 2.6, a quarter 3.8, a half 5, a whole 6.2. */
export function columnWidth(ticks: number): number {
  return 2.6 + 1.2 * Math.log2(Math.max(1, ticks / NOTE_TICKS.eighth));
}

/**
 * The columns of every bar: each start of a note, a placed rest or a place for a note (on any staff), as wide as the time
 * to the next column, but never wider than what starts there; free time after a place for a note takes no room.
 */
export function editorSpacing(piece: EditorPiece): BarSpacing[] {
  const hands = handsOf(piece);
  return Array.from({ length: piece.bars }, (_, bar) => {
    // per tick, the shortest thing that starts there
    const shortest = new Map<number, number>();
    const add = (tick: number, ticks: number) => shortest.set(tick, Math.min(shortest.get(tick) ?? Infinity, ticks));
    for (const hand of hands) {
      for (const n of piece.notes) if (n.hand === hand && n.bar === bar) add(n.start, LENGTH_TICKS[n.length]);
      for (const r of placedRests(piece)) if (r.hand === hand && r.bar === bar) add(r.start, LENGTH_TICKS[r.length]);
      for (const slot of slotsFor(piece, hand, bar)) add(slot, SLOT_TICKS);
    }
    const ticks = [...shortest.keys()].sort((a, b) => a - b);
    return { columns: ticks.map((tick, i) => ({ tick, width: columnWidth(Math.min(shortest.get(tick)!, (ticks[i + 1] ?? Infinity) - tick)) })) };
  });
}

/** Every bar full of eighths: the widest a bar of this meter can be, which the staff size leaves room for. */
function fullBars(piece: EditorPiece): BarSpacing[] {
  const eighths = barTicks(piece) / NOTE_TICKS.eighth;
  const columns = Array.from({ length: eighths }, (_, i) => ({ tick: i * NOTE_TICKS.eighth, width: columnWidth(NOTE_TICKS.eighth) }));
  return Array.from({ length: piece.bars }, () => ({ columns }));
}

type Viewport = StaffLayoutOptions['viewport'];

const frameOptions = (viewport: Viewport): StaffLayoutOptions => ({
  viewport, allPlayTracks: true, reserve: { shortestTicks: NOTE_TICKS.eighth, low: RESERVE_LOW, high: RESERVE_HIGH, widestChord: RESERVE_CHORD },
});

/**
 * The staff size and the lines on a page for a piece on this screen: the largest staff where a bar full of eighths fits a
 * line and two lines fit the height, or, when two lines would make it small, one larger line. Only the hands, meter and key
 * of the piece count (it is decided without its notes), so writing never changes it.
 */
export function editorFrame(piece: EditorPiece, viewport: Viewport): { staffSpace: number; linesPerPage: number } {
  const frame = toChart({ ...piece, notes: [], rests: [] }, { id: 'frame' });
  const spacing = fullBars(piece);
  const largest = (lines: number) => {
    for (let s = MAX_STAFF_SPACE; s >= MIN_STAFF_SPACE; s--) {
      if (layoutStaff(frame, { ...frameOptions(viewport), staffSpace: s, spacing, linesPerPage: lines }).fits) return s;
    }
    return null;
  };
  const two = largest(2);
  if (two !== null && two >= TWO_LINES_MIN) return { staffSpace: two, linesPerPage: 2 };
  return { staffSpace: largest(1) ?? MIN_STAFF_SPACE, linesPerPage: 1 };
}

/** The staff the editor draws and hit-tests for `piece`, whose chart is `chart` (`toChart`). */
export function editorStaff(piece: EditorPiece, chart: Chart, viewport: Viewport): StaffLayout {
  return layoutStaff(chart, { ...frameOptions(viewport), ...editorFrame(piece, viewport), spacing: editorSpacing(piece) });
}

/**
 * The staff as the editor shows it: only the rests the author placed. The rests that fill free time are in the chart (the
 * piece is played with them) but not drawn while writing: free time is where the next note goes.
 */
export function drawnWhileWriting(layout: StaffLayout, chart: Chart, piece: EditorPiece): StaffLayout {
  // the chart's ticks: a pick-up makes bar 0 short (core_09.AC30)
  const placed = new Set(placedRests(piece).map((r) => `${r.hand.toLowerCase()}:${tickOf(piece, r.bar, r.start)}:${LENGTH_TICKS[r.length]}`));
  return { ...layout, rests: layout.rests.filter((g) => {
    const rest = chart.rests[g.index]!;
    return placed.has(`${rest.track}:${rest.tick}:${rest.dur}`);
  }) };
}

/** The tonic's staff position nearest the middle line (positions 1 to 7 hold each letter once). */
function tonicPosition(piece: Pick<EditorPiece, 'fifths' | 'mode'>, clef: Clef): number {
  const names = keyNames(piece.fifths);
  const letter = (piece.mode === 'minor' ? names.minor : names.major)[0];
  for (let p = 1; p <= 7; p++) if (naturalAtPosition(p, clef).step === letter) return p;
  return 4;
}

export interface Shadow {
  hand: EditorHand;
  bar: number;
  /** Ticks from the start of the bar. */
  start: number;
  staff: number;
  /** The page of the staff it is on. */
  page: number;
  x: number;
  y: number;
  /** The staff position it is drawn at: the tonic of the key. */
  position: number;
}

/** A shadow note at every place a note can go, drawn at the tonic of the key. */
export function shadowsFor(piece: EditorPiece, layout: StaffLayout): Shadow[] {
  const shadows: Shadow[] = [];
  for (const bar of layout.bars) {
    const system = layout.systems[bar.system]!;
    for (const staff of system.staves) {
      const hand: EditorHand = staff.trackId === 'lh' ? 'LH' : 'RH';
      const position = tonicPosition(piece, staff.clef);
      for (const start of slotsFor(piece, hand, bar.index)) {
        const x = bar.columns?.find((c) => c.tick === start)?.x;
        if (x === undefined) continue;
        shadows.push({ hand, bar: bar.index, start, staff: staff.index, page: system.page, x, y: staff.bottomLineY - (position * layout.staffSpace) / 2, position });
      }
    }
  }
  return shadows;
}

/** The page a bar is on. */
export function pageOfBar(layout: StaffLayout, bar: number): number {
  const at = layout.bars[bar];
  return at ? layout.systems[at.system]!.page : 0;
}

/** The first bar on `page` (Page Up and Down put the keyboard cursor there); 0 when the page has none. */
export function firstBarOfPage(layout: StaffLayout, page: number): number {
  const bar = layout.bars.findIndex((b) => layout.systems[b.system]!.page === page);
  return Math.max(0, bar);
}

/**
 * The box to highlight for an action's target (`targetOf`): on its hand's staff, from half-way to the column before its
 * start (or the bar's start) to half-way to the first column after its time (or the bar's end), a staff space beyond the lines. Null without columns (bars of equal width).
 */
export function targetBox(layout: StaffLayout, target: Pick<ActionTarget, 'hand' | 'bar' | 'start' | 'end'>): { x1: number; x2: number; y1: number; y2: number; page: number } | null {
  const bar = layout.bars[target.bar];
  const system = bar ? layout.systems[bar.system] : undefined;
  const staff = system?.staves.find((s) => s.trackId === target.hand.toLowerCase());
  if (!bar || !system || !staff) return null;
  const S = layout.staffSpace;
  const columns = bar.columns ?? [];
  const inside = columns.filter((c) => c.tick >= target.start && c.tick < target.end);
  if (inside.length === 0) return null;
  const before = columns.filter((c) => c.tick < target.start).at(-1);
  const after = columns.find((c) => c.tick >= target.end);
  const x1 = before ? (before.x + inside[0]!.x) / 2 : bar.x;
  const x2 = after ? (inside.at(-1)!.x + after.x) / 2 : bar.x + bar.width;
  return { x1, x2, y1: staff.topLineY - S, y2: staff.bottomLineY + S, page: system.page };
}

/**
 * The boxes that highlight selected bars: one per bar, from the bar's left to its right edge and from the top staff
 * line to the bottom one of its system (both hands), a staff space beyond the lines. Bars missing from the layout are
 * skipped.
 */
export function barBoxes(layout: StaffLayout, range: { from: number; to: number }): Array<{ x1: number; x2: number; y1: number; y2: number; page: number }> {
  const boxes: Array<{ x1: number; x2: number; y1: number; y2: number; page: number }> = [];
  const S = layout.staffSpace;
  for (let i = range.from; i <= range.to; i += 1) {
    const bar = layout.bars[i];
    const system = bar ? layout.systems[bar.system] : undefined;
    if (!bar || !system || system.staves.length === 0) continue;
    const top = Math.min(...system.staves.map((s) => s.topLineY));
    const bottom = Math.max(...system.staves.map((s) => s.bottomLineY));
    boxes.push({ x1: bar.x, x2: bar.x + bar.width, y1: top - S, y2: bottom + S, page: system.page });
  }
  return boxes;
}

/**
 * What the repeat item's next click would make (d286, ft_1_02d.AC27): the bars lit, from the picked start bar (or the bar
 * under the pointer while none is picked) to the bar under the pointer, either way round, and where its two signs go: the
 * start sign at the left side of its first bar, the end sign at the right side of its last, each only on the page it is on.
 */
export function repeatPreview(layout: StaffLayout, startBar: number | null, bar: number, page: number): { boxes: ReturnType<typeof barBoxes>; signs: { side: 'start' | 'end'; x: number; y1: number; y2: number }[] } {
  const start = startBar ?? bar;
  const all = barBoxes(layout, { from: Math.min(start, bar), to: Math.max(start, bar) });
  const signs: { side: 'start' | 'end'; x: number; y1: number; y2: number }[] = [];
  const first = all[0];
  const last = all.at(-1);
  if (first?.page === page) signs.push({ side: 'start', x: first.x1, y1: first.y1, y2: first.y2 });
  if (last?.page === page) signs.push({ side: 'end', x: last.x2, y1: last.y1, y2: last.y2 });
  return { boxes: all.filter((b) => b.page === page), signs };
}

/**
 * The bar a repeat sign goes to when the pointer is near a bar line (d286, ft_1_02d.AC31): the sign snaps to the nearest bar
 * line of the line of music the pointer is on. A start sign takes the bar that line starts, an end sign the bar it ends; null
 * off the bars of the page.
 */
export function snapBar(layout: StaffLayout, page: number, point: { x: number; y: number }, side: 'start' | 'end'): number | null {
  const boxes = layout.bars.map((_, i) => ({ bar: i, box: barBoxes(layout, { from: i, to: i })[0] })).filter((b) => b.box?.page === page);
  // the line of music under the pointer: the one whose boxes hold its height, else the nearest
  const gap = (box: { y1: number; y2: number }) => (point.y < box.y1 ? box.y1 - point.y : point.y > box.y2 ? point.y - box.y2 : 0);
  let best: { bar: number; distance: number; gap: number } | null = null;
  for (const { bar, box } of boxes) {
    if (!box) continue;
    const distance = Math.abs((side === 'start' ? box.x1 : box.x2) - point.x);
    const g = gap(box);
    if (!best || g < best.gap || (g === best.gap && distance < best.distance)) best = { bar, distance, gap: g };
  }
  return best?.bar ?? null;
}

/**
 * Where the key's name (C, Em) shows while the pointer is on a key signature (ft_1_02d.AC32): over the middle of the
 * signature's sharps or flats, or of the clef when the key has none, a staff space and a half above the top line.
 */
export function keyNameSpot(layout: StaffLayout, system: number): { x: number; y: number } | null {
  const line = layout.systems[system];
  if (!line) return null;
  const signs = layout.keySignature.filter((k) => k.system === system);
  const clefs = layout.clefs.filter((c) => c.system === system);
  const xs = signs.length > 0 ? signs.map((k) => k.x) : clefs.map((c) => c.x + c.w / 2);
  const x = xs.length > 0 ? (Math.min(...xs) + Math.max(...xs)) / 2 : line.left;
  return { x, y: line.topLineY - layout.staffSpace * 1.5 };
}

/**
 * The bars a lasso rectangle touches on a page, from the first to the last, as a bar range; null when it touches
 * none. A bar's box is the one its highlight uses (`barBoxes`), so the lasso picks what it will light up.
 */
export function barsInRect(layout: StaffLayout, page: number, rect: { x1: number; y1: number; x2: number; y2: number }): { from: number; to: number } | null {
  const left = Math.min(rect.x1, rect.x2);
  const right = Math.max(rect.x1, rect.x2);
  const top = Math.min(rect.y1, rect.y2);
  const bottom = Math.max(rect.y1, rect.y2);
  let from = -1;
  let to = -1;
  for (let i = 0; i < layout.bars.length; i += 1) {
    const box = barBoxes(layout, { from: i, to: i })[0];
    if (!box || box.page !== page) continue;
    if (box.x2 < left || box.x1 > right || box.y2 < top || box.y1 > bottom) continue;
    if (from < 0) from = i;
    to = i;
  }
  return from < 0 ? null : { from, to };
}
