/**
 * What a point on the editor's staff means: the note under it, or the place where a note would go (staff, pitch
 * and time snapped to the nearest eighth). Pure: it reads the same layout the view draws, so a click lands where it looks.
 */
import { naturalAtPosition, type Clef, type Step } from '../chart/pitch';
import type { Chart } from '../chart/schema';
import { barInner, type StaffLayout } from '../layout/staff';
import { autoLength, chordOf, findNote, GRID, keyAlterOf, LENGTH_TICKS, noteAt, placedRests, restLengthFor, type EditorHand, type EditorLength, type EditorNote, type EditorPiece, type NoteRef, type PlacedRest, type RestRef } from './model';

export type Hit =
  | { kind: 'note'; noteIndex: number }
  /** The clef and key signature of a staff: a press there opens the key choice (core_09.AC8). */
  | { kind: 'key'; staff: number; system: number }
  /** The time signature at the start of the first line: a press there opens the time choice. */
  | { kind: 'time' }
  | {
      kind: 'place';
      /** Which staff of the system: 0 is the top one. */
      staff: number;
      trackId: string;
      clef: Clef;
      bar: number;
      /** Ticks from the start of the bar, on the eighth grid. */
      start: number;
      /** Diatonic steps above the bottom line. */
      position: number;
      step: Step;
      octave: number;
    };

/** Positions far above or below the staff are clamped: about four ledger lines either way. */
const LOWEST = -9;
const HIGHEST = 17;

export function hitTest(layout: StaffLayout, chart: Chart, point: { x: number; y: number }, page = 0): Hit | null {
  const S = layout.staffSpace;
  const shown = layout.systems.filter((s) => s.page === page);
  // a note head first, a little wider than drawn so a student's click finds it, but never taller than half a step: a
  // click nearer the next line or space is that place, so a second goes in as a chord (ft_1_02d.AC51)
  for (const n of layout.notes) {
    if (layout.systems[n.system]?.page !== page) continue;
    if (Math.abs(point.x - n.x) <= n.headRx * 1.3 && Math.abs(point.y - n.y) < S / 4) return { kind: 'note', noteIndex: n.index };
  }
  // the system: each owns the band half-way to its neighbours
  const system = shown.find((s, i) => {
    const top = i === 0 ? -Infinity : (shown[i - 1]!.bottomLineY + s.topLineY) / 2;
    const bottom = i === shown.length - 1 ? Infinity : (s.bottomLineY + shown[i + 1]!.topLineY) / 2;
    return point.y >= top && point.y < bottom;
  });
  if (!system) return null;
  const staves = system.staves;
  const staff = staves.length === 1 || point.y < (staves[0]!.bottomLineY + staves[1]!.topLineY) / 2 ? staves[0]! : staves[1]!;
  const bar = layout.bars.find((b) => b.system === system.index && point.x >= b.x && point.x < b.x + b.width);
  // left of the first bar: the time signature (on the first line only), else the clef and the key signature
  const firstBar = layout.bars.find((b) => b.system === system.index);
  if (firstBar && point.x >= system.left && point.x < firstBar.x) {
    const time = layout.timeSignatures.find((ts) => ts.system === system.index);
    if (time && point.x >= time.x - S / 2) return { kind: 'time' };
    return { kind: 'key', staff: staff.index, system: system.index };
  }
  if (!bar) return null;
  const chartBar = chart.bars[bar.index]!;
  const ticks = chartBar.endTick - chartBar.startTick;
  const inner = barInner(bar, S);
  const snapped = Math.round((((point.x - inner.left) / inner.width) * ticks) / GRID) * GRID;
  // bars as wide as their columns (the editor): the nearest column is the place
  const column = bar.columns?.length ? bar.columns.reduce((best, c) => (Math.abs(point.x - c.x) < Math.abs(point.x - best.x) ? c : best)) : undefined;
  const start = column?.tick ?? Math.max(0, Math.min(ticks - GRID, snapped));
  const position = Math.max(LOWEST, Math.min(HIGHEST, Math.round((staff.bottomLineY - point.y) / (S / 2))));
  const { step, octave } = naturalAtPosition(position, staff.clef);
  return { kind: 'place', staff: staff.index, trackId: staff.trackId, clef: staff.clef, bar: bar.index, start, position, step, octave };
}

/** Where a note at `start` ticks into `bar` and `position` on `staff` is drawn: the inverse of `hitTest`, for the preview note. */
export function pointOf(layout: StaffLayout, chart: Chart, place: { bar: number; start: number; staff: number; position: number }): { x: number; y: number } | null {
  const bar = layout.bars[place.bar];
  const system = bar ? layout.systems[bar.system] : undefined;
  const staff = system?.staves[place.staff];
  if (!bar || !staff) return null;
  const chartBar = chart.bars[place.bar]!;
  const inner = barInner(bar, layout.staffSpace);
  const column = bar.columns?.find((c) => c.tick === place.start);
  return { x: column?.x ?? inner.left + (place.start / (chartBar.endTick - chartBar.startTick)) * inner.width, y: staff.bottomLineY - (place.position * layout.staffSpace) / 2 };
}

/**
 * What a click on an empty-looking place of the staff does: select the note already there, or add a note (which makes a
 * chord on an occupied start; on a rest the author placed, `over` names that rest, which the note takes the place of),
 * or in rest mode add a rest.
 */
export type PlaceClick =
  | { kind: 'select'; ref: NoteRef }
  | { kind: 'add'; note: EditorNote; over?: RestRef }
  | { kind: 'addRest'; rest: PlacedRest };

/** Writing notes or rests: the Note / Pause switch of the editor. */
export type EntryMode = 'note' | 'rest';

/**
 * The decision for a click on a `place`: a note of the same hand with the same start and pitch is selected; otherwise a
 * note is added, with the chord's length when other notes start there, else the automatic length for `selected`. Whether the
 * add fits is left to `placeNote`, which refuses with a reason (a partial overlap is `no-room`).
 */
export function placeClick(piece: EditorPiece, place: Extract<Hit, { kind: 'place' }>, selected: EditorLength, mode: EntryMode = 'note'): PlaceClick {
  const hand: EditorHand = place.trackId === 'lh' ? 'LH' : 'RH';
  const ref: NoteRef = { hand, bar: place.bar, start: place.start, step: place.step, octave: place.octave };
  if (findNote(piece, ref)) return { kind: 'select', ref };
  const at = { hand, bar: place.bar, start: place.start };
  if (mode === 'rest') {
    // no dotted rests are placed: a dotted length places its plain rest
    const length = autoLength(piece, hand, place.bar, place.start, selected);
    return { kind: 'addRest', rest: { ...at, length: restLengthFor(length) } };
  }
  // a note put on a rest the author placed takes its place, with the room that rest leaves
  const over = placedRests(piece).find((r) => r.hand === hand && r.bar === place.bar && r.start === place.start);
  const base = over ? { ...piece, rests: placedRests(piece).filter((r) => r !== over) } : piece;
  // a new note is spelled with the key of the piece (core_09.AC8)
  const note = { ...ref, length: autoLength(base, hand, place.bar, place.start, selected), alter: keyAlterOf(piece, place.step) };
  return over ? { kind: 'add', note, over: at } : { kind: 'add', note };
}

/**
 * What an action at a point changes, which the editor highlights: over a note, or anywhere in the
 * column of a chord on its staff, the whole chord (the wheel and Ctrl + wheel change all its notes); on a rest the author
 * placed, that rest; on a free place, the time the note or rest a click writes would take. Null inside a note of the hand,
 * where a click is refused. `start` and `end` are ticks from the start of the bar.
 */
export interface ActionTarget {
  hand: EditorHand;
  bar: number;
  start: number;
  end: number;
  /** The chord's notes, lowest first; empty when there is no note there. */
  notes: NoteRef[];
}

export function targetOf(piece: EditorPiece, at: NoteRef | Extract<Hit, { kind: 'place' }>, selected: EditorLength, mode: EntryMode = 'note'): ActionTarget | null {
  const hand: EditorHand = 'kind' in at ? (at.trackId === 'lh' ? 'LH' : 'RH') : at.hand;
  const where = { hand, bar: at.bar, start: at.start };
  const chord = chordOf(piece, where);
  if (chord.length > 0) {
    return { ...where, end: at.start + LENGTH_TICKS[chord[0]!.length], notes: chord.map(({ hand: h, bar, start, step, octave }) => ({ hand: h, bar, start, step, octave })) };
  }
  if (!('kind' in at)) return null;
  const rest = placedRests(piece).find((r) => r.hand === hand && r.bar === at.bar && r.start === at.start);
  if (rest) return { ...where, end: at.start + LENGTH_TICKS[rest.length], notes: [] };
  if (noteAt(piece, hand, at.bar, at.start)) return null;
  const click = placeClick(piece, at, selected, mode);
  const length = click.kind === 'add' ? click.note.length : click.kind === 'addRest' ? click.rest.length : selected;
  return { ...where, end: at.start + LENGTH_TICKS[length], notes: [] };
}
