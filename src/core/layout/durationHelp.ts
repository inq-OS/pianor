/**
 * The note duration helper (ft_1_11): it shows how long each note sounds. Each hand has its own setting (Off, A, B, A+B):
 * A puts a faint copy of the head on every beat the note is still held, so the student can count "one,
 * two" over a half note; B runs a thin band from the note head to where the sound stops, painted only in the white between
 * two staff lines. The notation itself is not changed (AX-0): the marks are drawn under the staff lines and the notes. Pure:
 * the view only draws what this returns.
 */
import { z } from 'zod';
import type { Chart } from '../chart/schema.ts';
import { tieLinks } from '../chart/ties.ts';
import { accidentalRoomAt, barInner, type StaffLayout } from './staff.ts';

/** Which marks one hand gets: none, A the ghost heads, B the band, or both. */
export const DURATION_MARK_CHOICES = ['off', 'ghost', 'band', 'both'] as const;
export const durationMarkSchema = z.enum(DURATION_MARK_CHOICES);
export type DurationMark = z.infer<typeof durationMarkSchema>;

/**
 * The marks of each hand (the same setting for either hand). Saved per player (`settings.durationHelp`, optional:
 * an old save reads as both hands off, d069.3).
 */
export const durationHelpSchema = z.object({ RH: durationMarkSchema, LH: durationMarkSchema });
export type DurationHelp = z.infer<typeof durationHelpSchema>;
export type Hand = keyof DurationHelp;
export const DEFAULT_DURATION_HELP: DurationHelp = { RH: 'off', LH: 'off' };

/** A strip of the band, in layout pixels, on one system. */
export interface DurationBand {
  system: number;
  /** The chart note it belongs to. */
  note: number;
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

/** A faint head on a beat the note is still held. */
export interface DurationGhost {
  system: number;
  note: number;
  x: number;
  y: number;
  rx: number;
  ry: number;
}

export interface DurationMarks {
  bands: DurationBand[];
  ghosts: DurationGhost[];
}

/** How the band ends: this far (staff spaces) before the next onset, so it never touches the next head. */
const END_GAP = 0.25;
/** At a bar's end the band runs this far (staff spaces) past the notes' part of the bar, close to the bar line. */
const BAR_END_REACH = 0.05;
/** The band of a note in a space: this share of a staff space high, through the middle of the space. */
const BAND_SHARE = 0.3;
/** Kept free on each side of a staff line (staff spaces), so the band never covers a line. */
const LINE_CLEARANCE = 0.12;

/**
 * The marks for `layout` (made from `chart`) that `help` asks for, hand by hand: the band of a note (two strips for a note on
 * a line) and its ghost heads. A track's hand is its `hand`, or its clef when it has none (treble right, bass left). `layout`
 * must not use `spacing` (the piece editor); the practice and battle staffs do not.
 */
export function durationMarks(layout: StaffLayout, chart: Chart, help: DurationHelp): DurationMarks {
  const marks: DurationMarks = { bands: [], ghosts: [] };
  if (help.RH === 'off' && help.LH === 'off') return marks;
  const handOf = new Map(chart.tracks.map((t): [string, Hand] => [t.id, t.hand ?? (t.clef === 'bass' ? 'LH' : 'RH')]));
  const S = layout.staffSpace;
  const meter = chart.meterMap[0];
  // one beat is the unit of the time signature's bottom number: a quarter in 3/4 and 4/4, an eighth in 6/8
  const beat = (chart.ppq * 4) / (meter?.den ?? 4);
  const xAt = (barIndex: number, tick: number) => {
    const bar = layout.bars[barIndex]!;
    const span = chart.bars[barIndex]!;
    const inner = barInner(bar, S);
    return inner.left + ((tick - span.startTick) / (span.endTick - span.startTick)) * (inner.width - bar.roomTotal * S) + accidentalRoomAt(bar, tick) * S;
  };
  // tied notes are one sound: the band runs on into the tied head, over a bar line too, with no gap
  const ties = tieLinks(chart, new Set(chart.tracks.map((t) => t.id)));
  const tiedFrom = new Map([...ties.next].map(([from, into]): [number, number] => [into, from]));
  const glyphOf = new Map(layout.notes.map((g) => [g.index, g]));
  const clearance = Math.max(1, Math.round(S * LINE_CLEARANCE));
  const thickness = Math.max(2, Math.round(S * BAND_SHARE));
  for (const glyph of layout.notes) {
    const note = chart.notes[glyph.index]!;
    const mark = help[handOf.get(note.track) ?? 'RH'];
    if (mark === 'off') continue;
    const style = { band: mark === 'band' || mark === 'both', ghosts: mark === 'ghost' || mark === 'both' };
    const span = chart.bars[glyph.bar]!;
    const bar = layout.bars[glyph.bar]!;
    const inner = barInner(bar, S);
    const end = Math.min(note.tick + note.dur, span.endTick);
    // a note that fills a bar on its own is drawn in the bar's middle, not at its time: its band spans the bar, with no ghosts
    const centred = Math.abs(glyph.column - xAt(glyph.bar, note.tick)) > S / 2;
    const into = glyphOf.get(ties.next.get(glyph.index) ?? -1);
    const from = glyphOf.get(tiedFrom.get(glyph.index) ?? -1);
    // tied in from the bar before: from this bar's start (the bar line, or after the clef on a new line, where the tie curve starts)
    const x1 = from !== undefined && from.bar !== glyph.bar ? bar.x : centred ? inner.left : glyph.x;
    const x2 = into?.bar === glyph.bar ? into.x
      : into !== undefined ? bar.x + bar.width
        : end >= span.endTick ? inner.left + inner.width + BAR_END_REACH * S : xAt(glyph.bar, end) - END_GAP * S;
    if (style.band && x2 > x1) {
      const strip = (y1: number, y2: number) => marks.bands.push({ system: glyph.system, note: glyph.index, x1, x2, y1, y2 });
      if (glyph.position % 2 !== 0) {
        strip(glyph.y - thickness / 2, glyph.y + thickness / 2);
      } else {
        // a note on a line: a thin strip on each side of the line, which stays clean
        const half = Math.max(1, Math.round(thickness / 2));
        strip(glyph.y - clearance - half, glyph.y - clearance);
        strip(glyph.y + clearance, glyph.y + clearance + half);
      }
    }
    if (style.ghosts && !centred) {
      const first = span.startTick + Math.floor((note.tick - span.startTick) / beat + 1) * beat;
      for (let tick = first; tick < end; tick += beat) {
        marks.ghosts.push({ system: glyph.system, note: glyph.index, x: xAt(glyph.bar, tick), y: glyph.y, rx: glyph.headRx, ry: glyph.headRy });
      }
    }
  }
  return marks;
}
