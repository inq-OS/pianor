/**
 * Pure staff layout: turns a Chart and a viewport into positioned glyph data. No drawing, no Phaser.
 * Views (src/game/ui/staff) only draw what this returns. Units are logical pixels, origin top-left.
 *
 * One staff for a one-handed piece, a grand staff (treble above bass, joined by a brace, sharing bar lines and one time axis)
 * for a piece with two played tracks. Supported subset: one or two voices per track (d164: in a bar of two, voice 1 stems up, voice 2 down), whole to sixteenth notes and rests, dotted halves, quarters and eighths (eighths
 * and sixteenths are beamed per beat, `beams.ts`; a lone one has its flags), triplets drawn at their written value with a 3 (core_09.AC50), key signatures and key changes at bar lines (core_09.AC57), one meter, sharps,
 * flats and naturals (docs/notation.md sections 4 and 5). Notes of one track that start together and have one length are a chord: one column of heads
 * (a second is drawn with its upper or lower head on the other side of the stem), one stem and its flags or beams, and its accidentals stacked in columns
 * to the left. Anything else throws `UnsupportedNotationError` (double sharps and flats, a key change inside a bar), so a piece the renderer
 * cannot show faithfully never shows wrongly; the piece linter keeps such pieces out of levels.
 */
import { keyAt, printedAccidentals } from '../chart/key.ts';
import { ledgerLinePositions, staffPosition, type Clef } from '../chart/pitch.ts';
import type { Chart, ChartGrace, ChartNote, ChartRest, ChartTrack, ChartTuplet } from '../chart/schema.ts';
import { tupletOf, writtenDurOf } from '../chart/tuplets.ts';
import { NOTE_TICKS, PPQ, fullBarTicks, noteLengthOf } from '../chart/time.ts';
import { tieLinks } from '../chart/ties.ts';
import { beatTicksOf, planBeams, type BeamInput, type BeamRun } from './beams.ts';
import { noteLabel, type NoteNaming } from '../text/noteName.ts';
import { ACCIDENTAL_BOX, accidentalColumns, accidentalKind, keyChangeSigns, keySignaturePositions, signRooms } from './accidentals.ts';
import type { NoteValue, StaffLayoutOptions, BarSpacing, StaffReserve, NoteGlyph, GraceGlyph, RestGlyph, BeamGlyph, TieGlyph, SlurGlyph, TupletGlyph, EndingGlyph, KeyAccidentalGlyph, StaffInfo, SystemLayout, BarLayout, BarRoom, TimeSignatureLayout, StaffLayout } from './staffTypes.ts';

export type { NoteValue, StaffLayoutOptions, BarSpacing, NoteGlyph, BeamGlyph, TieGlyph, SlurGlyph, TupletGlyph, BarLayout, StaffLayout } from './staffTypes.ts';
export { ACCIDENTAL_BOX, accidentalColumns, accidentalKind, keySignaturePositions, type AccidentalKind } from './accidentals.ts';

export class UnsupportedNotationError extends Error {}

const DRAWN_VALUES: readonly NoteValue[] = ['whole', 'half', 'quarter', 'eighth', 'sixteenth'];

/** The staff space range, in pixels between two staff lines (d010): the layout picks the largest that fits. */
export const MIN_STAFF_SPACE = 8;
export const MAX_STAFF_SPACE = 32;

export function noteValueOf(dur: number): NoteValue {
  const value = noteLengthOf(dur, DRAWN_VALUES);
  if (value) return value;
  throw new UnsupportedNotationError(`unsupported note length of ${dur} ticks (dotted notes other than the dotted half, quarter and eighth, and notes shorter than a sixteenth, are not drawn yet)`);
}

/** The dotted lengths drawn so far, each as the value that carries the dot (core_09.AC37, AC41). */
const DOTTED: readonly { ticks: number; value: NoteValue }[] = [
  { ticks: NOTE_TICKS.dottedHalf, value: 'half' },
  { ticks: NOTE_TICKS.dottedQuarter, value: 'quarter' },
  { ticks: NOTE_TICKS.dottedEighth, value: 'eighth' },
];

/** A note's or rest's drawn shape: its value, and whether it carries a dot (the dotted half, quarter and eighth). */
export function noteShapeOf(dur: number): { value: NoteValue; dotted: boolean } {
  const dotted = DOTTED.find((d) => d.ticks === dur);
  return dotted ? { value: dotted.value, dotted: true } : { value: noteValueOf(dur), dotted: false };
}

const MARGIN_X = 2; // all in staff spaces
const MARGIN_Y = 1;
/** The key signature: its first accidental is centred `KEY_HALF` from the left of `KEY_START` (after the clef), and each one takes `KEY_STEP`. */
const KEY_START = 3.6;
const KEY_HALF = 0.6;
const KEY_STEP = 1.15;
/** The signs of a key change inside a line (core_09.AC57) start this far right of the double bar line, in staff spaces. */
const KEY_CHANGE_LEFT = 0.6;
/** More room a key change leaves when a repeat starts in its bar, for the repeat sign after the signs. */
const KEY_CHANGE_REPEAT = 1.2;
/** The clear gap from the ink of the key signature's last sign to the time signature's digits; without a key it starts at 5 spaces, as before. */
const KEY_TIME_GAP = 0.4;
/** From the time signature to the first bar's inner edge (7 spaces in all with no key, as before). */
const TIME_TO_BARS = 2;
/** Gap between an accidental and the ink to its right, and the distance between two columns of a chord's accidentals. */
const ACCIDENTAL_GAP = 0.2;
const ACCIDENTAL_COLUMN = 1.2;
/** Half the width of a ledger line, in staff spaces (drawn from x - 1.05 to x + 1.05, see `ledgerLines`). */
const LEDGER_HALF = 1.05;
/** How far a notehead reaches to the left, in staff spaces, where its accidental goes: its half width, or the ledger line it sits on. */
function headReach(position: number, halfWidth: number): number {
  return ledgerLinePositions(position).length > 0 ? Math.max(halfWidth, LEDGER_HALF) : halfWidth;
}
const SYSTEM_GAP = 0.8;
/** The short gap between the staves of a grand staff, from the bottom line of one to the top line of the other. */
const SHORT_GAP = 2;
const LABEL_HALF = 0.55; // half the height of a hint label, in staff spaces
/** From one line of a two-line hint label to the next (a chord's name under its notes, core_09.AC59), in staff spaces. */
export const LABEL_LINE = 2 * LABEL_HALF + 0.1;
const SCORE_STEP = 1.4; // between two stacked tempo scores of a chord, in staff spaces
/** How far under the hint labels a dynamic mark sits, in staff spaces (core_09.AC15). */
const DYNAMIC_DROP = 1.6;
const ARROW_ROOM = 1.1; // the cursor arrow beyond the outermost label
const BAR_PAD_LEFT = 1.6;
/** Room after the last note of a bar, before its bar line (the playhead leads by it, see `playheadAt`). */
export const BAR_PAD_RIGHT = 0.8;
const MIN_SLOT = 2.6;
const STEM_POSITIONS = 7;
/** A grace note (core_09.AC32, d121): its head, stem and marks at this share of a normal note's size. */
const GRACE_SCALE = 0.6;
/** Staff spaces between a grace's ink and the ink of its main note (its accidentals or heads), and the clear room kept after the grace's room, from the note before. */
const GRACE_GAP = 0.4;
const GRACE_CLEAR = 0.5;
/** How far a grace's slash reaches either side of its stem, in staff spaces. */
const GRACE_SLASH = 0.3;
/** How far an eighth's flag reaches right of its stem at normal size, in staff spaces (as `StaffView` draws it). */
const FLAG_REACH = 0.85;
/** Gap between a tie and the grace in front of its tied-to note, in staff spaces. */
const GRACE_TIE_GAP = 0.2;
/** Gap between a beam and the ink of a grace that stands under (or over) it, in staff spaces. */
const GRACE_BEAM_GAP = 0.3;
/**
 * A triplet's number (core_09.AC50, d163): its height, the gap from the beam or the ink to it, and the room the rooms keep
 * for it beyond the notes; a bracket's hooks reach this far toward the notes. In staff spaces.
 */
const TUPLET_DIGIT = 1.1;
const TUPLET_GAP = 0.35;
const TUPLET_ROOM = TUPLET_GAP + TUPLET_DIGIT + 0.2;
const TUPLET_HOOK = 0.5;
/** How far a quarter or eighth rest reaches up and down from the middle line, in staff spaces. */
const REST_REACH = 1.5;

/** Where the time signature starts, in staff spaces from the staff's left edge: after the key signature when there is one. */
const timeSignatureX = (fifths: number) => {
  if (fifths === 0) return 5;
  const lastSign = KEY_START + KEY_HALF + KEY_STEP * (Math.abs(fifths) - 1);
  const digitHalf = (GLYPH.timeSignature.digitHeight * 3) / 10; // a digit is 3 cells of a 5-cell height wide, as the view draws it
  return lastSign + ACCIDENTAL_BOX.sharp.width / 2 + KEY_TIME_GAP + digitHalf;
};

/** The room a bar gives its accidentals at `tick`, in staff spaces: each accidental's room opens from its `from` to its `at` (ramp). */
export function accidentalRoomAt(bar: Pick<BarLayout, 'rooms'>, tick: number): number {
  let total = 0;
  for (const r of bar.rooms) {
    const share = r.at === r.from ? (tick >= r.at ? 1 : 0) : Math.min(1, Math.max(0, (tick - r.from) / (r.at - r.from)));
    total += r.room * share;
  }
  return total;
}

/** The heads a chord's stem-down seconds move to the left of its column (true for each displaced head). */
function displacedHeads(positions: readonly number[], up: boolean): Set<number> {
  const fromBase = up ? positions.map((_, i) => i) : positions.map((_, i) => positions.length - 1 - i);
  const displaced = new Set<number>();
  fromBase.forEach((i, k) => {
    const before = fromBase[k - 1];
    if (before !== undefined && !displaced.has(before) && Math.abs(positions[i]! - positions[before]!) === 1) displaced.add(i);
  });
  return displaced;
}

/** One staff of the piece: its track and its notes and rests, with their chart indexes, and the grace notes it draws. */
interface StaffSpec {
  track: ChartTrack;
  notes: { note: ChartNote; index: number }[];
  rests: { rest: ChartRest; index: number }[];
  /** The graces of this track that sit on a note of it: the chart grace index, and the chart index and bar of the main note. */
  graces: { grace: ChartGrace; index: number; main: number; bar: number }[];
  /** The tuplets of this track (core_09.AC49), with their chart index. */
  tuplets: { tuplet: ChartTuplet; index: number }[];
  /** Bars where this track has a second voice (d164): there voice 1's stems point up and voice 2's down, whatever the pitch. */
  twoVoiceBars: ReadonlySet<number>;
}

/** The stem direction two voices give a note of `voice` in `bar` (core_09.AC53): up in voice 1, down in voice 2; undefined in a bar of one voice. */
function voiceStemUp(spec: Pick<StaffSpec, 'twoVoiceBars'>, note: Pick<ChartNote, 'bar' | 'voice'>): boolean | undefined {
  return spec.twoVoiceBars.has(note.bar) ? note.voice === 1 : undefined;
}

/** The accidentals of every drawn staff: which are printed, their chord columns, and the room each tick needs. */
interface AccidentalPlan {
  /** The printed alter of each note (chart note index) that prints an accidental. */
  alterOf: Map<number, number>;
  /** The column of each printed accidental in its chord. */
  columnOf: Map<number, number>;
  /** How far left of the column the first accidental column starts, past the heads of its tick (both voices), in staff spaces. */
  offsetOf: Map<number, number>;
  /** Per bar index: the rooms of its accidental ticks, and their total. */
  roomsOf: Map<number, BarRoom[]>;
  roomTotalOf: Map<number, number>;
  /** The largest `roomTotal` of any bar: a bar needs at least this much more width. */
  maxRoomTotal: number;
  /** Per chart note: how far its chord reaches left of its column, in staff spaces (its accidentals, or its heads and ledger lines). */
  leftOf: Map<number, number>;
  /** The printed alter of each grace (chart grace index) that prints an accidental, as for a note. */
  graceAlterOf: Map<number, number>;
}

/**
 * How far a grace reaches either side of its head, in staff spaces: `left` includes its accidental, which sits left of it.
 * The head, its ledger lines, an acciaccatura's slash and (on an up stem) its flag set the reach to the right; the left
 * reach is taken as at least the right one, which also covers the slash of a grace with its stem down.
 */
function graceSides(alter: number | null, slash: boolean, position: number): { left: number; right: number; reach: number } {
  const headR = GLYPH.head.rx * GRACE_SCALE;
  // as for a normal head, the accidental stands clear of the head's ledger line
  const reach = headReach(position, GLYPH.head.rx) * GRACE_SCALE;
  const flagRight = slash && chordStemUp(position, position) ? headR + FLAG_REACH * GRACE_SCALE : 0;
  const right = Math.max(reach, slash ? headR + GRACE_SLASH : 0, flagRight);
  const accidentalLeft = alter === null ? 0 : reach + (ACCIDENTAL_GAP + ACCIDENTAL_BOX[accidentalKind(alter)].width) * GRACE_SCALE;
  return { left: Math.max(right, accidentalLeft), right, reach };
}

function planAccidentals(chart: Chart, staves: readonly StaffSpec[]): AccidentalPlan {
  const bars = chart.bars;
  const alterOf = new Map<number, number>();
  const columnOf = new Map<number, number>();
  const leftOf = new Map<number, number>();
  const graceAlterOf = new Map<number, number>();
  const offsetOf = new Map<number, number>();
  const roomByTick = new Map<number, { bar: number; room: number }>();
  const onsets = new Set<number>();
  for (const s of staves) {
    for (const { note } of s.notes) onsets.add(note.tick);
    for (const { rest } of s.rests) onsets.add(rest.tick);
    // A grace comes before the notes of its tick in bar order, so it prints its accidental first, as it is read. What is
    // printed is read from the whole staff, both voices in time order: a sign holds on its line to the bar line whatever
    // the stem, so a voice that sounds otherwise than the other voice's last note on that line prints its sign (d164).
    const items = [
      ...s.notes.map(({ note, index }) => ({ index, grace: false, tick: note.tick, midi: note.midi, spelling: note.spelling, bar: note.bar, tieNext: note.tieNext === true })),
      ...s.graces.map(({ grace, index, bar }) => ({ index, grace: true, tick: grace.tick, midi: grace.pitch.midi, spelling: grace.pitch.spelling, bar, tieNext: false })),
    ].sort((a, b) => a.tick - b.tick || Number(b.grace) - Number(a.grace) || a.midi - b.midi);
    const printed = printedAccidentals(items.map((item) => ({
      step: item.spelling.step, octave: item.spelling.octave, alter: item.spelling.alter, tick: item.tick, bar: item.bar, tieNext: item.tieNext,
    })), chart.keyMap);
    const printedOf = new Map<number, number | null>();
    items.forEach((item, i) => {
      const alter = printed[i] ?? null;
      if (!item.grace) printedOf.set(item.index, alter);
      else if (alter !== null) graceAlterOf.set(item.index, alter);
    });
    // The accidentals of one tick stand in columns left of all its heads, of both voices (d164). Each chord points its
    // stem as it is drawn: its beamed run's way, its voice's, or its own.
    const groups = chordGroups(s.notes, s.track.clef);
    const runUp = runDirections(staffBeams(chart, groups, s.track.clef, s.twoVoiceBars), groups);
    const byTick = new Map<number, { note: ChartNote; index: number }[][]>();
    for (const g of groups) byTick.set(g[0]!.note.tick, [...(byTick.get(g[0]!.note.tick) ?? []), g]);
    for (const voiceGroups of byTick.values()) {
      const group = voiceGroups.flat();
      const positions = group.map((e) => staffPosition(e.note.spelling, s.track.clef));
      const alters = group.map((e) => printedOf.get(e.index) ?? null);
      const columns = accidentalColumns(positions.map((position, i) => ({ position, alter: alters[i]! })));
      const maxColumn = Math.max(-1, ...columns);
      const first = group[0]!.note;
      const headRx = first.dur === NOTE_TICKS.whole ? 0.8 : 0.65;
      // a stem-down second puts a head left of the column
      const downSecond = voiceGroups.some((g) => {
        const ps = g.map((e) => staffPosition(e.note.spelling, s.track.clef));
        const up = runUp.get(g[0]!.index) ?? voiceStemUp(s, g[0]!.note) ?? chordStemUp(ps[0]!, ps[ps.length - 1]!);
        return !up && displacedHeads(ps, up).size > 0;
      });
      // how far the heads reach left (with a stem-down second on the left), before any accidental
      const plainLeft = Math.max(...positions.map((p) => headReach(p, headRx))) + (downSecond ? 2 * headRx : 0);
      if (maxColumn < 0) {
        group.forEach((e) => leftOf.set(e.index, plainLeft));
        continue;
      }
      const reach = Math.max(...positions.flatMap((p, i) => (columns[i]! >= 0 ? [headReach(p, headRx)] : [])));
      const leftOffset = reach + (downSecond ? 2 * headRx : 0);
      group.forEach((e, i) => {
        if (columns[i]! >= 0) {
          alterOf.set(e.index, alters[i]!);
          columnOf.set(e.index, columns[i]!);
          offsetOf.set(e.index, leftOffset);
        }
      });
      const room = leftOffset + ACCIDENTAL_GAP + maxColumn * ACCIDENTAL_COLUMN + ACCIDENTAL_BOX.sharp.width;
      group.forEach((e) => leftOf.set(e.index, Math.max(room, plainLeft)));
      roomByTick.set(first.tick, { bar: first.bar, room: Math.max(room, roomByTick.get(first.tick)?.room ?? 0) });
    }
  }
  // A grace's room (core_09.AC32) is all the ink left of its main note's column: the main chord's accidentals or heads
  // (`leftOf`), the gap, the grace with its accidental, and a clear margin. It holds the accidental room of that tick, so
  // it takes the larger of the two, never their sum.
  for (const s of staves) {
    for (const g of s.graces) {
      const { left, right } = graceSides(graceAlterOf.get(g.index) ?? null, g.grace.slash, staffPosition(g.grace.pitch.spelling, s.track.clef));
      const room = leftOf.get(g.main)! + GRACE_GAP + right + left + GRACE_CLEAR;
      const tick = g.grace.tick;
      roomByTick.set(tick, { bar: g.bar, room: Math.max(room, roomByTick.get(tick)?.room ?? 0) });
    }
  }
  const sortedOnsets = [...onsets].sort((a, b) => a - b);
  const roomsOf = new Map<number, BarRoom[]>();
  const roomTotalOf = new Map<number, number>();
  for (const tick of [...roomByTick.keys()].sort((a, b) => a - b)) {
    const { bar, room } = roomByTick.get(tick)!;
    const start = bars[bar]!.startTick;
    const earlier = sortedOnsets.filter((t) => t < tick && t >= start);
    const from = earlier.length > 0 ? earlier[earlier.length - 1]! : start;
    roomsOf.set(bar, [...(roomsOf.get(bar) ?? []), { from, at: tick, room }]);
    roomTotalOf.set(bar, (roomTotalOf.get(bar) ?? 0) + room);
  }
  return { alterOf, columnOf, offsetOf, roomsOf, roomTotalOf, maxRoomTotal: Math.max(0, ...roomTotalOf.values()), leftOf, graceAlterOf };
}

/** The tracks to draw, top staff first. */
function pickTracks(chart: Chart, trackId: string | undefined, allPlayTracks = false, resting: readonly string[] = []): ChartTrack[] {
  if (trackId !== undefined) {
    const track = chart.tracks.find((t) => t.id === trackId);
    if (!track) throw new UnsupportedNotationError(`unknown track "${trackId}"`);
    return [track];
  }
  const played = chart.tracks.filter((t) => (t.role === 'play' || resting.includes(t.id)) && (allPlayTracks || chart.notes.some((n) => n.track === t.id)));
  if (played.length === 0) {
    const any = chart.tracks.find((t) => t.role === 'play');
    if (!any) throw new UnsupportedNotationError('chart has no play track');
    return [any];
  }
  if (played.length > 2) throw new UnsupportedNotationError('more than two staves are not drawn yet');
  // The judge waits for every played track, so every one must be on screen. Treble above bass; otherwise chart order.
  return [...played].sort((a, b) => (a.clef === 'treble' ? 0 : 1) - (b.clef === 'treble' ? 0 : 1));
}

function checkSubset(notes: ChartNote[], rests: ChartRest[], tuplets: readonly { tuplet: ChartTuplet }[]): void {
  for (const { tuplet } of tuplets) {
    if (tuplet.actual !== 3 || tuplet.normal !== 2) throw new UnsupportedNotationError('only triplets (3 in the time of 2) are drawn yet');
  }
  const seen = new Map<string, ChartNote>();
  const pitches = new Set<string>();
  for (const n of notes) {
    if (n.voice > 2) throw new UnsupportedNotationError('more than two voices in one staff are not drawn');
    if (Math.abs(n.spelling.alter) > 1) throw new UnsupportedNotationError('double sharps and flats are not drawn yet');
    const same = seen.get(`${n.voice}/${n.tick}`);
    if (same && same.dur !== n.dur) throw new UnsupportedNotationError('chord notes of different lengths are not drawn yet');
    if (pitches.has(`${n.tick}/${n.midi}`)) throw new UnsupportedNotationError('the same pitch twice at one time is not drawn');
    pitches.add(`${n.tick}/${n.midi}`);
    if (!same) seen.set(`${n.voice}/${n.tick}`, n);
  }
  for (const r of rests) {
    if (r.voice > 2) throw new UnsupportedNotationError('more than two voices in one staff are not drawn');
  }
}

/** The notes of one track and voice that start together, lowest first, groups in time order (voice 1 first). A single note is a group of one. */
function chordGroups<T extends { note: ChartNote }>(entries: readonly T[], clef: Clef): T[][] {
  const byStart = new Map<string, T[]>();
  for (const e of entries) {
    const key = `${e.note.voice}/${e.note.tick}`;
    byStart.set(key, [...(byStart.get(key) ?? []), e]);
  }
  return [...byStart.values()].sort((a, b) => a[0]!.note.tick - b[0]!.note.tick || a[0]!.note.voice - b[0]!.note.voice)
    .map((group) => group.sort((a, b) => staffPosition(a.note.spelling, clef) - staffPosition(b.note.spelling, clef)));
}

/** The stem direction of a chord: up when its lowest head is farther from the middle line than its highest (a tie goes down, as for a note on the middle line). */
const chordStemUp = (low: number, high: number) => 4 - low > high - 4;
/** The stem tip, in staff positions: an octave beyond the head at the far end, or as far as the middle line if that is further. */
const stemTip = (low: number, high: number, up: boolean) => (up ? high + Math.max(STEM_POSITIONS, 4 - high) : low - Math.max(STEM_POSITIONS, low - 4));

/** Space a staff needs above its top line and below its bottom line, in staff spaces, from the notes it will hold. */
interface Rooms {
  above: number;
  below: number;
}

/**
 * Tight rooms: just enough for the clef, the cursor box, stems, ledger lines, finger numbers above and note names below
 * (always reserved, so switching hints on never moves the staff). A piece in a narrow range gets less empty paper, so the
 * notes can be drawn bigger. The cursor arrow is added by the caller, on the outer side of the system.
 */
/** A chord (or reserved note) the rooms must hold: its lowest and highest positions, its size, and its stem direction when known. */
/** Staff spaces an ending's bracket and its number take above the staff (core_09.AC47). */
const ENDING_ROOM = 1.6;

type RoomGroup = { low: number; high: number; size: number; up?: boolean; tuplet?: TupletSide; lines?: number };

function staffRooms(groups: readonly RoomGroup[], clef: Clef, eighths: boolean, scoreRoom: boolean): Rooms {
  let above = clef === 'treble' ? 1.5 : 1.2; // treble clef curls 1.5 above the top line; the cursor box reaches 1.2
  let below = clef === 'treble' ? 1.5 : 1.2;
  for (const { low, high, size, up, tuplet, lines } of groups) {
    // a chord's tempo scores stack above its finger spot, one step per further note
    const stack = scoreRoom ? (size - 1) * SCORE_STEP : 0;
    // A beamed run shares one stem direction (`up`, from the beam plan, core_09.AC40); a reserved note that may be beamed
    // later (the editor's reserve) near the middle line may need its stem either way.
    const directions = up !== undefined ? [up] : eighths && low === high && low >= 2 && low <= 6 ? [true, false] : [chordStemUp(low, high)];
    for (const up of directions) {
      const tip = stemTip(low, high, up) / 2; // height above the bottom line
      // a triplet's number (or bracket) stands beyond the notes on its side (core_09.AC50), and the hints beyond it
      const highest = Math.max(high / 2 + 0.5, up ? tip : -Infinity) + (tuplet === 'above' ? TUPLET_ROOM : 0);
      const lowest = Math.min(low / 2 - 0.5, up ? Infinity : tip) - (tuplet === 'below' ? TUPLET_ROOM : 0);
      above = Math.max(above, highest + 0.7 + LABEL_HALF + stack - 4);
      below = Math.max(below, -(lowest - 0.7 - LABEL_HALF) + ((lines ?? 1) - 1) * LABEL_LINE);
    }
  }
  return { above: above + 0.3, below };
}

/** The ticks where a staff strikes a chord whose name stands on a second label line (core_09.AC59). */
function twoLineTicks(notes: readonly { note: ChartNote }[], chordNames: StaffLayoutOptions['chordNames']): Set<number> {
  const out = new Set<number>();
  if (chordNames?.show !== 'both') return out;
  const byTick = new Map<number, ChartNote[]>();
  for (const { note } of notes) byTick.set(note.tick, [...(byTick.get(note.tick) ?? []), note]);
  for (const [tick, chord] of byTick) if (chord.length > 1 && chordNames.name(chord.map((n) => n.midi), chord.map((n) => n.spelling)) !== null) out.add(tick);
  return out;
}

interface Plan {
  staffSpace: number;
  barsPerSystem: number;
  systemCount: number;
  /** With `spacing`: the first bar of each line and every bar's width in staff spaces (its padding and accidentals included). */
  spaced?: { lineStarts: number[]; barUnits: number[] };
  /** Systems on a page. */
  perPage: number;
  fits: boolean;
}

interface Request {
  barCount: number;
  barTicks: number;
  shortestTicks: number;
  /** Height of one system in staff spaces (all staves with their rooms). */
  systemUnits: number;
  /** Width before the first bar's inner edge, in staff spaces: the clef, the key and the time signature. */
  preamble: number;
  /** The most room any bar gives its accidentals, in staff spaces. */
  accidentalRoom: number;
  barsPerLine: number | undefined;
  keepBarWidth: boolean;
  linesPerPage: number | undefined;
}

/** Height of `systems` systems in staff spaces, margins included. */
const blockUnits = (systems: number, systemUnits: number) => 2 * MARGIN_Y + systems * systemUnits + (systems - 1) * SYSTEM_GAP;

function planAt(staffSpace: number, r: Request, vp: { width: number; height: number }): Plan {
  const availWidth = vp.width - (2 * MARGIN_X + r.preamble) * staffSpace;
  const minBarWidth = ((r.barTicks / r.shortestTicks) * MIN_SLOT + BAR_PAD_LEFT + BAR_PAD_RIGHT + r.accidentalRoom) * staffSpace;
  const maxBars = Math.floor(availWidth / minBarWidth);
  let barsPerSystem: number;
  let systemCount: number;
  if (r.barsPerLine === undefined) {
    systemCount = Math.ceil(r.barCount / Math.max(1, maxBars));
    barsPerSystem = Math.ceil(r.barCount / systemCount);
  } else {
    barsPerSystem = r.keepBarWidth ? r.barsPerLine : Math.min(r.barsPerLine, r.barCount);
    systemCount = Math.ceil(r.barCount / barsPerSystem);
  }
  const perPage = Math.min(r.linesPerPage ?? systemCount, systemCount);
  const height = blockUnits(perPage, r.systemUnits) * staffSpace;
  return { staffSpace, barsPerSystem, systemCount, perPage, fits: maxBars >= Math.max(1, barsPerSystem) && height <= vp.height };
}

/** A plan for bars as wide as their columns (`spacing`): lines filled left to right at this staff space. */
function planSpaced(staffSpace: number, r: Request, spacing: readonly BarSpacing[], roomTotals: readonly number[], vp: { width: number; height: number }): Plan {
  const availUnits = vp.width / staffSpace - 2 * MARGIN_X - r.preamble;
  const barUnits = Array.from({ length: r.barCount }, (_, i) =>
    BAR_PAD_LEFT + (spacing[i]?.columns ?? []).reduce((sum, c) => sum + c.width, 0) + BAR_PAD_RIGHT + (roomTotals[i] ?? 0));
  const lineStarts: number[] = [];
  let used = Infinity;
  barUnits.forEach((units, i) => {
    if (used + units > availUnits) {
      lineStarts.push(i);
      used = 0;
    }
    used += units;
  });
  const systemCount = Math.max(1, lineStarts.length);
  // a page keeps the places of all its lines, also while fewer lines are written: the first line never moves
  const perPage = r.linesPerPage ?? systemCount;
  const height = blockUnits(perPage, r.systemUnits) * staffSpace;
  return {
    staffSpace, barsPerSystem: Math.max(...lineStarts.map((start, k) => (lineStarts[k + 1] ?? r.barCount) - start)), systemCount, perPage,
    spaced: { lineStarts, barUnits }, fits: barUnits.every((u) => u <= availUnits) && height <= vp.height,
  };
}

/** How far into a spaced bar (`spacing`) a tick sits, in staff spaces: at its column, or in proportion between the columns around it. */
function spacedOffset(columns: BarSpacing['columns'], tick: number, barTicks: number): number {
  let from = { tick: 0, at: 0 };
  let at = 0;
  for (const c of columns) {
    if (tick === c.tick) return at;
    if (tick < c.tick) return from.at + ((tick - from.tick) / Math.max(1, c.tick - from.tick)) * (at - from.at);
    from = { tick: c.tick, at };
    at += c.width;
  }
  return from.at + ((tick - from.tick) / Math.max(1, barTicks - from.tick)) * (at - from.at);
}

/**
 * The part of a bar where its notes go, between the padding after the bar line and before the next: a note `t` ticks into
 * a bar of `n` ticks sits at `left + t / n * width` (unless it fills the bar alone and is centred). Hit testing inverts it.
 */
export function barInner(bar: Pick<BarLayout, 'x' | 'width'>, staffSpace: number): { left: number; width: number } {
  return { left: bar.x + BAR_PAD_LEFT * staffSpace, width: bar.width - (BAR_PAD_LEFT + BAR_PAD_RIGHT) * staffSpace };
}

/** The page that shows these notes (chart note indexes; the first one drawn decides), or null when there is none. */
export function pageOfNotes(layout: StaffLayout, notes: number | readonly number[] | null): number | null {
  const wanted = notes === null ? [] : typeof notes === 'number' ? [notes] : notes;
  for (const index of wanted) {
    const glyph = layout.notes.find((n) => n.index === index);
    if (glyph) return layout.systems[glyph.system]!.page;
  }
  return null;
}

/** Glyph metrics, in staff spaces: where the views' shapes sit relative to the staff lines and the note column. */
const GLYPH = {
  /** The clef's left edge, right of the start bar line. */
  clefX: 0.4,
  /** The treble clef curls 1.5 spaces above the top line to 1.5 below the bottom line. */
  trebleClef: { above: 1.5, width: 2.6, height: 7 },
  /** The bass clef hangs from the top line. */
  bassClef: { width: 3, height: 3.2 },
  /** The brace, left of the start bar line. */
  braceX: 0.2,
  /** Centres of the time signature's two digits below the top line, and their height. */
  timeSignature: { numY: 0.95, denY: 3.05, digitHeight: 1.7 },
  /** Half the width of a notehead (a whole note is wider) and half its height. */
  head: { rxWhole: 0.8, rx: 0.65, ry: 0.5 },
  /** From the right edge of the head to the centre of an augmentation dot. */
  dotGap: 0.45,
  /** From the end of a head (or its dot) to the centre of a finger number beside it. */
  fingerSide: 0.6,
  beamThickness: 0.5,
  /** Between a sixteenth's two beams. */
  beamGap: 0.25,
  /** The length of a partial (second) beam on a lone sixteenth, at most half the way to the next stem. */
  partialBeam: 1.1,
  /** From a rest's centre to the centre of its augmentation dot (the half and quarter rests reach 0.6 to the right). */
  restDotX: 1.0,
  /** From the chord's outermost head or stem tip to the centre of a hint label (letter names, finger). */
  hintGap: 0.7,
  /** The cursor arrow's tip stops this far inside its room. */
  arrowInset: 0.15,
} as const;

/** The size and vertical layout every system shares: the plan, the room above and below each staff, the bars' accidental room. */
interface Frame {
  plan: Plan;
  request: Request;
  above: number[];
  below: number[];
  systemUnits: number;
  barTicks: number;
  /** The chart's bars: a pick-up (and the last bar after one) is shorter than `barTicks`. */
  chartBars: Chart['bars'];
  accidentalPlan: AccidentalPlan;
  spacing: readonly BarSpacing[] | undefined;
  keys: KeyPlan;
  /** Per bar with a key change: the room its signs take at the start of the bar when it is inside a line, in staff spaces. */
  keyRoomOf: Map<number, number>;
}

/** Everything placed per system: staves, clefs, key signatures, bar lines and the bars' x. */
interface Systems {
  systems: SystemLayout[];
  bars: BarLayout[];
  staffLines: StaffLayout['staffLines'];
  barlines: StaffLayout['barlines'];
  braces: StaffLayout['braces'];
  clefs: StaffLayout['clefs'];
  keySignature: KeyAccidentalGlyph[];
  staffLeft: number;
}

/** The keys the staff draws (core_09.AC57): the first, and each change of signature with the bar it starts. */
interface KeyPlan {
  first: number;
  /** Per bar where the signature changes: the signature before and after. */
  changes: Map<number, { from: number; to: number }>;
  /** Every signature the piece uses. */
  all: number[];
  /** The signature in force in a bar. */
  atBar(bar: number): number;
}

/** A change of mode alone (C major to A minor) keeps the signature, so the staff draws nothing for it. */
function keyPlanOf(chart: Chart): KeyPlan {
  const first = chart.keyMap[0]!.fifths;
  const changes = new Map<number, { from: number; to: number }>();
  let now = first;
  for (const entry of chart.keyMap.slice(1)) {
    if (entry.fifths === now) continue;
    const bar = chart.bars.find((b) => b.startTick === entry.tick);
    if (!bar) throw new UnsupportedNotationError('a key change inside a bar is not drawn (a key changes at a bar line)');
    changes.set(bar.index, { from: now, to: entry.fifths });
    now = entry.fifths;
  }
  const atBar = (bar: number) => keyAt(chart.keyMap, chart.bars[bar]?.startTick ?? 0).fifths;
  return { first, changes, all: [...new Set([first, ...[...changes.values()].map((c) => c.to)])], atBar };
}

function staffSpecs(chart: Chart, tracks: readonly ChartTrack[]): StaffSpec[] {
  const staves = tracks.map((track) => {
    const notes = chart.notes.map((note, index) => ({ note, index })).filter((e) => e.note.track === track.id);
    // A grace belongs to the lowest note of its track and voice that starts on its tick; one that starts on no such note
    // (a sliced chart can keep one) is not drawn (core_09.AC32).
    const graces = (chart.graces ?? []).flatMap((grace, index) => {
      if (grace.track !== track.id) return [];
      const mains = notes.filter((e) => e.note.tick === grace.tick && e.note.voice === grace.voice).sort((a, b) => a.note.midi - b.note.midi);
      return mains.length > 0 ? [{ grace, index, main: mains[0]!.index, bar: mains[0]!.note.bar }] : [];
    });
    const rests = chart.rests.map((rest, index) => ({ rest, index })).filter((e) => e.rest.track === track.id);
    const twoVoiceBars = new Set([...notes.map((e) => e.note), ...rests.map((e) => e.rest)].filter((e) => e.voice === 2).map((e) => e.bar));
    const tuplets = (chart.tuplets ?? []).map((tuplet, index) => ({ tuplet, index })).filter((e) => e.tuplet.track === track.id);
    return { track, notes, rests, graces, twoVoiceBars, tuplets };
  });
  for (const s of staves) checkSubset(s.notes.map((e) => e.note), s.rests.map((e) => e.rest), s.tuplets);
  return staves;
}

/** Every note and chord the reserve keeps room for: each position from `low` to `high`, alone or with a higher one up to `widestChord` away. */
function reserveGroups(reserve: StaffReserve): { low: number; high: number; size: number }[] {
  const groups: { low: number; high: number; size: number }[] = [];
  for (let low = reserve.low; low <= reserve.high; low++) {
    for (let high = low; high <= Math.min(reserve.high, low + reserve.widestChord); high++) groups.push({ low, high, size: 1 });
  }
  return groups;
}

/** Rooms per staff and the staff size: the largest that fits the viewport, or the one asked for. */
function planFrame(chart: Chart, staves: readonly StaffSpec[], keys: KeyPlan, options: StaffLayoutOptions): Frame {
  const barCount = chart.bars.length;
  const barTicks = fullBarTicks(chart.meterMap, chart.ppq); // not bars[0]: a pick-up is short (core_09.AC22)
  const reserve = options.reserve;
  const durations = staves.flatMap((s) => [
    ...s.notes.map((e) => e.note.dur),
    ...s.rests.filter((e) => e.rest.dur !== barTicks).map((e) => e.rest.dur),
  ]).concat(reserve ? [reserve.shortestTicks] : []);
  const shortest = durations.length > 0 ? Math.min(...durations) : barTicks;

  // Rooms per staff. The cursor arrow goes on the outer side: below a single staff, above the top and below the bottom
  // staff of a grand staff, never into the gap between the staves.
  const grand = staves.length > 1;
  // the reserve stands in as a note at each of its positions and a chord across any two of them up to its widest: a
  // chord's stem starts at its far head, so it reaches further than a single note's
  const reserved = reserve ? reserveGroups(reserve) : [];
  const rooms = staves.map((s) => {
    const graceGroups = s.graces.map(({ grace }) => {
      const position = staffPosition(grace.pitch.spelling, s.track.clef);
      return { low: position, high: position, size: 1 };
    });
    const groups = chordGroups(s.notes, s.track.clef);
    const upOf = runDirections(staffBeams(chart, groups, s.track.clef, s.twoVoiceBars), groups);
    const upOfGroup = (g: readonly { note: ChartNote; index: number }[]) => upOf.get(g[0]!.index) ?? voiceStemUp(s, g[0]!.note) ?? chordStemUpOf(g, s.track.clef);
    const sides = tupletSides(chart, groups, upOfGroup);
    // a chord named on a second line under its notes needs a second line of room (core_09.AC59)
    const twoLines = twoLineTicks(s.notes, options.chordNames);
    const own = staffRooms(
      groups.map((g): RoomGroup => {
        const side = sides.get(tupletIndexOf(chart, g[0]!.note));
        return { low: staffPosition(g[0]!.note.spelling, s.track.clef), high: staffPosition(g[g.length - 1]!.note.spelling, s.track.clef), size: g.length, up: upOfGroup(g), ...(side ? { tuplet: side } : {}), ...(twoLines.has(g[0]!.note.tick) ? { lines: 2 } : {}) };
      }).concat(reserved, graceGroups),
      // the treble clef curls further out than the bass clef, so a staff of either clef plans for it
      reserve?.anyClef === true ? 'treble' : s.track.clef, reserve !== undefined && reserve.shortestTicks < PPQ, options.scoreRoom === true);
    // every signature and key change of the piece, on the clefs this staff may have
    const clefs: Clef[] = reserve?.anyClef === true ? ['treble', 'bass'] : [s.track.clef];
    const signRoom = clefs.flatMap((clef) => [
      ...keys.all.map((f) => signRooms(keySignaturePositions(f, clef))),
      ...[...keys.changes.values()].map((c) => signRooms(keyChangeSigns(c.from, c.to, clef))),
    ]);
    // a rest moved out of the staff by the other voice (d164) keeps its ink, and a name under it, on the paper
    const restsOut = s.rests.filter((e) => s.twoVoiceBars.has(e.rest.bar)).map(({ rest }) => {
      const value = rest.dur === barTicks ? 'whole' as const : noteShapeOf(writtenDurOf(chart, rest)).value;
      const at = restPosition(s, rest, value);
      return { low: at + restInk(value).low, high: at + restInk(value).high };
    });
    const restAbove = Math.max(0, ...restsOut.map((r) => (r.high > 8 ? r.high / 2 - 4 + 0.5 : 0)));
    const restBelow = Math.max(0, ...restsOut.map((r) => (r.low < 0 ? -r.low / 2 + 0.5 + GLYPH.hintGap + 2 * LABEL_HALF : 0)));
    return { above: Math.max(own.above, restAbove, ...signRoom.map((k) => k.above)), below: Math.max(own.below, restBelow, ...signRoom.map((k) => k.below)) };
  });
  const accidentalPlan = planAccidentals(chart, staves);
  // A key change's signs stand at the start of its bar, before its notes (core_09.AC57); a repeat that starts there follows them.
  const keyRoomOf = new Map<number, number>();
  for (const [bar, c] of keys.changes) {
    const repeat = chart.repeats?.some((r) => r.startBar === bar) === true;
    keyRoomOf.set(bar, KEY_CHANGE_LEFT + keyChangeSigns(c.from, c.to, 'treble').length * KEY_STEP + (repeat ? KEY_CHANGE_REPEAT : 0));
  }
  const roomWithKey = (bar: number) => (accidentalPlan.roomTotalOf.get(bar) ?? 0) + (keyRoomOf.get(bar) ?? 0);
  const last = staves.length - 1;
  const above = rooms.map((r, i) => r.above + (grand && i === 0 ? ARROW_ROOM : 0));
  // the bracket and the 1. of an ending stand over the top staff (core_09.AC47): room for both over what it already keeps
  if (chart.repeats?.some((r) => r.endings)) above[0] = Math.max(above[0]! + ENDING_ROOM, 2 + ENDING_ROOM);
  const below = rooms.map((r, i) => r.below + (i === last ? ARROW_ROOM : 0));
  if (grand && options.staffGap === 'short') {
    // the short gap: one staff space under the top staff and one over the bottom one, middle C on the line between
    below[0] = SHORT_GAP / 2;
    above[1] = SHORT_GAP / 2;
  }
  const systemUnits = staves.reduce((sum, _, i) => sum + above[i]! + 4 + below[i]!, 0);

  const vp = options.viewport;
  const maxS = options.maxStaffSpace ?? MAX_STAFF_SPACE;
  const minS = options.minStaffSpace ?? MIN_STAFF_SPACE;
  const request: Request = {
    barCount, barTicks, shortestTicks: shortest, systemUnits,
    // a line may start in any key of the piece, so every line keeps room for the widest
    preamble: Math.max(...keys.all.map(timeSignatureX)) + TIME_TO_BARS,
    accidentalRoom: Math.max(0, ...Array.from({ length: barCount }, (_, i) => roomWithKey(i))),
    barsPerLine: options.barsPerLine === undefined ? undefined : Math.max(1, Math.floor(options.barsPerLine)),
    keepBarWidth: options.keepBarWidth === true,
    linesPerPage: options.linesPerPage === undefined ? undefined : Math.max(1, Math.floor(options.linesPerPage)),
  };
  let plan: Plan;
  if (options.spacing) {
    const roomTotals = Array.from({ length: barCount }, (_, i) => roomWithKey(i));
    plan = planSpaced(typeof options.staffSpace === 'number' ? options.staffSpace : minS, request, options.spacing, roomTotals, vp);
  } else if (typeof options.staffSpace === 'number') {
    plan = planAt(options.staffSpace, request, vp);
  } else {
    plan = planAt(minS, request, vp);
    for (let s = maxS; s >= minS; s--) {
      const candidate = planAt(s, request, vp);
      if (candidate.fits) {
        plan = candidate;
        break;
      }
    }
  }
  return { plan, request, above, below, systemUnits, barTicks, chartBars: chart.bars, accidentalPlan, spacing: options.spacing, keys, keyRoomOf };
}

/** The staves of one system, top to bottom from `top`, with their lines, clefs and key signatures. */
function layoutSystemStaves(staves: readonly StaffSpec[], frame: Frame, fifths: number, at: { system: number; top: number; left: number; right: number }, out: Systems): StaffInfo[] {
  const S = frame.plan.staffSpace;
  const { above, below } = frame;
  const { system: s, left: staffLeft, right } = at;
  const grand = staves.length > 1;
  const infos: StaffInfo[] = [];
  let cursorY = at.top;
  staves.forEach((staff, i) => {
    const topLineY = cursorY + above[i]! * S;
    const bottomLineY = topLineY + 4 * S;
    const arrow: StaffInfo['arrow'] = grand && i === 0
      ? { tipY: topLineY - (above[i]! - GLYPH.arrowInset) * S, direction: 'down' }
      : { tipY: bottomLineY + (below[i]! - GLYPH.arrowInset) * S, direction: 'up' };
    infos.push({ index: i, trackId: staff.track.id, clef: staff.track.clef, topLineY, bottomLineY, arrow, ...(staff.track.role === 'play' ? {} : { resting: true }) });
    cursorY = bottomLineY + below[i]! * S;
    for (let line = 0; line < 5; line++) out.staffLines.push({ system: s, staff: i, y: bottomLineY - line * S, x1: staffLeft, x2: right });
    out.clefs.push(staff.track.clef === 'treble'
      ? { system: s, staff: i, clef: 'treble', x: staffLeft + GLYPH.clefX * S, y: topLineY - GLYPH.trebleClef.above * S, w: GLYPH.trebleClef.width * S, h: GLYPH.trebleClef.height * S }
      : { system: s, staff: i, clef: 'bass', x: staffLeft + GLYPH.clefX * S, y: topLineY, w: GLYPH.bassClef.width * S, h: GLYPH.bassClef.height * S });
    // The key signature follows the clef on every staff and system (docs/notation.md section 5).
    keySignaturePositions(fifths, staff.track.clef).forEach(({ alter, position }, k) => out.keySignature.push({
      system: s, staff: i, alter, x: staffLeft + (KEY_START + KEY_HALF + k * KEY_STEP) * S, y: bottomLineY - (position * S) / 2,
    }));
  });
  return infos;
}

/** Systems (lines) and pages: where each staff, bar and bar line goes. */
function layoutSystems(staves: readonly StaffSpec[], frame: Frame, vp: StaffLayoutOptions['viewport']): Systems {
  const { plan, request, systemUnits, accidentalPlan } = frame;
  const S = plan.staffSpace;
  const barCount = request.barCount;
  const systemHeight = systemUnits * S;
  // A page is centred like a whole piece; every page uses the places of a full page, so lines never move between pages.
  const totalHeight = blockUnits(plan.perPage, systemUnits) * S;
  const offsetY = Math.max(0, (vp.height - totalHeight) / 2) + MARGIN_Y * S;
  const staffLeft = MARGIN_X * S;
  const staffRight = vp.width - MARGIN_X * S;
  // A bar's share of a line: 1 for a whole bar, less for a pick-up and the short last bar after it (d120, core_09.AC24).
  const shareOf = (index: number) => Math.min(1, (frame.chartBars[index]!.endTick - frame.chartBars[index]!.startTick) / frame.barTicks);
  // A bar's width: the same for every whole bar, or (with `spacing`) its own. A short bar is as wide as its share of a whole
  // one, and the whole bars of its line take what it leaves, so the line keeps its length and every bar of it the same
  // pixels per tick: the playhead crosses a pick-up at the piece's speed, and a pick-up of one beat is a quarter bar wide.
  const widthOf = (index: number, unit: number) => (plan.spaced ? plan.spaced.barUnits[index]! * S : unit * shareOf(index));
  const last = staves.length - 1;

  const out: Systems = { systems: [], bars: [], staffLines: [], barlines: [], braces: [], clefs: [], keySignature: [], staffLeft };
  for (let s = 0; s < plan.systemCount; s++) {
    const firstBar = plan.spaced ? plan.spaced.lineStarts[s]! : s * plan.barsPerSystem;
    const count = plan.spaced ? (plan.spaced.lineStarts[s + 1] ?? barCount) - firstBar : Math.min(plan.barsPerSystem, barCount - firstBar);
    const page = Math.floor(s / plan.perPage);
    const top = offsetY + (s % plan.perPage) * (systemHeight + SYSTEM_GAP * S);
    // A line shows the key it starts in, and its bars start after that key's own room (core_09.AC57): the plan kept room
    // for the widest key of the piece, so a line in a smaller key gives its bars what it leaves.
    const lineKey = frame.keys.atBar(firstBar);
    const contentLeft = staffLeft + (timeSignatureX(lineKey) + TIME_TO_BARS) * S;
    const barWidth = (staffRight - contentLeft) / plan.barsPerSystem;
    let shares = 0;
    for (let k = 0; k < count; k++) shares += shareOf(firstBar + k);
    const unit = (barWidth * count) / shares;
    let right = contentLeft;
    for (let k = 0; k < count; k++) right += widthOf(firstBar + k, unit);

    const infos = layoutSystemStaves(staves, frame, lineKey, { system: s, top, left: staffLeft, right }, out);
    const topLineY = infos[0]!.topLineY;
    const bottomLineY = infos[last]!.bottomLineY;
    out.systems.push({ index: s, page, firstBar, barCount: count, staves: infos, topLineY, bottomLineY, cursorTipY: infos[last]!.arrow.tipY, left: staffLeft, right });

    out.barlines.push({ system: s, x: staffLeft, y1: topLineY, y2: bottomLineY, kind: 'start' });
    if (staves.length > 1) out.braces.push({ system: s, x: staffLeft - GLYPH.braceX * S, y1: topLineY, y2: bottomLineY });
    let x = contentLeft;
    for (let k = 0; k < count; k++) {
      const index = firstBar + k;
      const width = widthOf(index, unit);
      const rooms = accidentalPlan.roomsOf.get(index) ?? [];
      const roomTotal = accidentalPlan.roomTotalOf.get(index) ?? 0;
      // A key change inside a line draws its signs after the bar line and moves the bar's notes past them; at a line start
      // the line's own signature shows the key, and the bar keeps its room for the notes.
      const change = k > 0 ? frame.keys.changes.get(index) : undefined;
      const keyRoom = change ? frame.keyRoomOf.get(index)! : 0;
      const start = frame.chartBars[index]!.startTick;
      out.bars.push({ index, system: s, x, width, rooms: keyRoom > 0 ? [{ from: start, at: start, room: keyRoom }, ...rooms] : rooms, roomTotal: roomTotal + keyRoom });
      if (change) {
        infos.forEach((st, i) => keyChangeSigns(change.from, change.to, st.clef).forEach(({ alter, position }, j) => out.keySignature.push({
          system: s, staff: i, alter, x: x + (KEY_CHANGE_LEFT + KEY_HALF + j * KEY_STEP) * S, y: st.bottomLineY - (position * S) / 2, bar: index,
        })));
      }
      x += width;
      const isLast = index === barCount - 1;
      // a double bar line closes the bar before a key change (docs/notation.md section 5)
      out.barlines.push({ system: s, x, y1: topLineY, y2: bottomLineY, kind: isLast ? 'final' : frame.keys.changes.has(index + 1) ? 'double' : 'single' });
    }
  }
  return out;
}

/** Where notes and rests go across a bar, given the systems already placed. */
interface Placer {
  S: number;
  /** The hint label naming (B or H), from the player's settings. */
  naming: NoteNaming;
  /** Chord names in the labels (core_09.AC59), or undefined for the notes only. */
  chordNames: StaffLayoutOptions['chordNames'];
  chart: Chart;
  barTicks: number;
  bars: readonly BarLayout[];
  systems: readonly SystemLayout[];
  accidentalPlan: AccidentalPlan;
  /** A note's or rest's x in its bar; `centred` for an event alone in a bar it fills. */
  xAt(bar: BarLayout, tick: number, centred: boolean): number;
  /** Bars where something is shorter than the bar, on any staff: nothing in them is centred. */
  open: ReadonlySet<number>;
}

const yOf = (staff: StaffInfo, position: number, S: number) => staff.bottomLineY - (position * S) / 2;

function makePlacer(chart: Chart, staves: readonly StaffSpec[], frame: Frame, placed: Systems, naming: NoteNaming, chordNames: StaffLayoutOptions['chordNames']): Placer {
  const S = frame.plan.staffSpace;
  const { barTicks } = frame;
  // A bar is "open" when something in it is shorter than the bar, on any staff. Only in a bar where every event on every
  // staff fills the whole bar is the event centred (a whole note in 4/4): a whole note under two half notes must sit
  // under the first half note, not under the second, or the student reads the hands as playing at different times.
  const open = new Set<number>();
  for (const s of staves) {
    for (const { note } of s.notes) if (note.dur !== barTicks) open.add(note.bar);
    for (const { rest } of s.rests) if (rest.dur !== barTicks) open.add(rest.bar);
  }
  // A note's x: its share of the bar's width, plus the room its accidentals took before it (accidentalRoomAt), so the spacing grows by the accidentals' width.
  const spacing = frame.spacing;
  const xAt = (bar: BarLayout, tick: number, centred: boolean) => {
    const inner = barInner(bar, S);
    const room = accidentalRoomAt(bar, tick) * S;
    const offset = tick - chart.bars[bar.index]!.startTick;
    // bars as wide as their columns: nothing is centred, and each column has its own room
    // a pick-up's notes spread over its own beats, not over a whole bar (core_09.AC24)
    const span = chart.bars[bar.index]!;
    const length = Math.min(barTicks, span.endTick - span.startTick);
    if (spacing) return inner.left + spacedOffset(spacing[bar.index]?.columns ?? [], offset, length) * S + room;
    const width = inner.width - bar.roomTotal * S;
    if (centred) return inner.left + width / 2 + room;
    return inner.left + (offset / length) * width + room;
  };
  if (spacing) {
    for (const bar of placed.bars) {
      const startTick = chart.bars[bar.index]!.startTick;
      bar.columns = (spacing[bar.index]?.columns ?? []).map((c) => ({ tick: c.tick, x: xAt(bar, startTick + c.tick, false) }));
    }
  }
  return { S, naming, chordNames, chart, barTicks, bars: placed.bars, systems: placed.systems, accidentalPlan: frame.accidentalPlan, xAt, open };
}

/** The stem direction a chord gets on its own: from its lowest and highest heads. */
function chordStemUpOf(group: readonly { note: ChartNote }[], clef: Clef): boolean {
  return chordStemUp(staffPosition(group[0]!.note.spelling, clef), staffPosition(group[group.length - 1]!.note.spelling, clef));
}

/**
 * The beamed runs of one staff's chord groups (core_09.AC40, `beams.ts`): beats counted from each bar's start, and from
 * the end of a pick-up bar, which is played as the last beats of a whole bar.
 */
function staffBeams(chart: Chart, groups: readonly (readonly { note: ChartNote }[])[], clef: Clef, twoVoiceBars: ReadonlySet<number>): BeamRun[] {
  const full = fullBarTicks(chart.meterMap, chart.ppq);
  const barOf = (tick: number) => {
    const bar = chart.bars.find((b) => tick >= b.startTick && tick < b.endTick) ?? chart.bars[chart.bars.length - 1]!;
    const pickup = bar.index === 0 && bar.endTick - bar.startTick < full;
    return { index: bar.index, beatOrigin: pickup ? bar.endTick - full : bar.startTick };
  };
  // Each voice is beamed on its own (d164); in a bar of two voices its beams take the voice's stem direction.
  const runs: BeamRun[] = [];
  for (const voice of [1, 2]) {
    const of = groups.flatMap((g, i) => (g[0]!.note.voice === voice ? [i] : []));
    if (of.length === 0) continue;
    const inputs = of.map((i): BeamInput => {
      const g = groups[i]!;
      const note = g[0]!.note;
      const tuplet = tupletIndexOf(chart, note);
      const base = { tick: note.tick, dur: note.dur, positions: g.map((e) => staffPosition(e.note.spelling, clef)) };
      return tuplet < 0 ? base : { ...base, written: writtenDurOf(chart, note), tuplet };
    });
    for (const run of planBeams(inputs, beatTicksOf(chart.meterMap[0]!.den), barOf)) {
      const members = run.members.map((m) => of[m]!);
      const secondary = run.secondary.map((b) => ('from' in b ? { from: of[b.from]!, to: of[b.to]! } : { at: of[b.at]!, toward: b.toward }));
      const up = voiceStemUp({ twoVoiceBars }, groups[members[0]!]![0]!.note) ?? run.up;
      runs.push({ ...run, members, up, secondary });
    }
  }
  return runs;
}

/** The chart index of the tuplet a note belongs to, or -1 (core_09.AC49). */
function tupletIndexOf(chart: Chart, note: ChartNote): number {
  const t = tupletOf(chart, note);
  return t ? chart.tuplets!.indexOf(t) : -1;
}

type TupletSide = 'above' | 'below';

/**
 * Which side each tuplet's number goes on, by chart tuplet index (core_09.AC50, d163): the side of its stems when all its
 * notes' stems point down, above otherwise (a beamed triplet's stems always agree). AX-3 provisional.
 */
function tupletSides<G extends readonly { note: ChartNote; index: number }[]>(chart: Chart, groups: readonly G[], upOf: (group: G) => boolean): Map<number, TupletSide> {
  const down = new Map<number, boolean>();
  for (const g of groups) {
    const t = tupletIndexOf(chart, g[0]!.note);
    if (t >= 0) down.set(t, (down.get(t) ?? true) && !upOf(g));
  }
  return new Map([...down].map(([t, d]) => [t, d ? 'below' : 'above']));
}

/** The stem direction of every chord in a beamed run, keyed by the chart index of the chord's first note. */
function runDirections(runs: readonly BeamRun[], groups: readonly (readonly { index: number }[])[]): Map<number, boolean> {
  const upOf = new Map<number, boolean>();
  for (const run of runs) for (const m of run.members) upOf.set(groups[m]![0]!.index, run.up);
  return upOf;
}

/** The glyphs of one chord (or single note): heads, stem, dot, accidentals, ledger lines and hint labels. */
function chordGlyphs(
  p: Placer,
  group: readonly { note: ChartNote; index: number }[],
  staffIndex: number,
  clef: Clef,
  beam: { stemUp: boolean | undefined; beamed: (index: number) => boolean },
  shift = 0,
  dotPast = 0,
): NoteGlyph[] {
  const { S, accidentalPlan, naming } = p;
  const first = group[0]!;
  // a triplet note is drawn at its written value (an eighth triplet as eighths), never from its 160 ticks (core_09.AC50)
  const { value, dotted } = noteShapeOf(writtenDurOf(p.chart, first.note));
  const bar = p.bars[first.note.bar]!;
  const staff = p.systems[bar.system]!.staves[staffIndex]!;
  const positions = group.map((e) => staffPosition(e.note.spelling, clef));
  const low = positions[0]!;
  const high = positions[positions.length - 1]!;
  const up = beam.stemUp ?? chordStemUp(low, high);
  const column = p.xAt(bar, first.note.tick, first.note.dur === p.barTicks && !p.open.has(bar.index)) + shift;
  const headRx = (value === 'whole' ? GLYPH.head.rxWhole : GLYPH.head.rx) * S;
  const headRy = GLYPH.head.ry * S;
  // From the end where the stem starts: a head a second from the one before it goes to the other side of the stem.
  const fromBase = up ? group.map((_, i) => i) : group.map((_, i) => group.length - 1 - i);
  const displaced = displacedHeads(positions, up);
  const base = fromBase[0]!;
  const dotShift = Math.max(up && displaced.size > 0 ? 2 * headRx : 0, dotPast);
  // The accidentals of the chord, left of its heads: each in its column, the chord's left edge (the leftmost head, or a stem-down second) is the anchor.
  // from the column to the leftmost head of the tick, or to the ledger line of an accidental's head when that reaches
  // further; a shifted voice-1 chord keeps its accidentals left of the other voice's heads (d164)
  const chordAccidentals = group.map((e, i) => {
    const alter = accidentalPlan.alterOf.get(e.index);
    if (alter === undefined) return null;
    const col = accidentalPlan.columnOf.get(e.index)!;
    const x = column - shift - accidentalPlan.offsetOf.get(e.index)! * S - (ACCIDENTAL_GAP + col * ACCIDENTAL_COLUMN + ACCIDENTAL_BOX[accidentalKind(alter)].width / 2) * S;
    return { alter, x, y: yOf(staff, positions[i]!, S) };
  });
  const lefts = chordAccidentals.flatMap((a) => (a ? [a.x - (ACCIDENTAL_BOX[accidentalKind(a.alter)].width * S) / 2] : []));
  const accidentalLeft = lefts.length > 0 ? Math.min(...lefts) : null;
  const members: NoteGlyph[] = group.map(({ note, index }, i) => {
    const position = positions[i]!;
    const x = column + (displaced.has(i) ? (up ? 2 : -2) * headRx : 0);
    const y = yOf(staff, position, S);
    let stem: NoteGlyph['stem'] = null;
    if (value !== 'whole' && i === base) {
      const stemX = up ? column + headRx : column - headRx;
      stem = { x: stemX, y1: y, y2: yOf(staff, stemTip(low, high, up), S), up };
    }
    const beamed = beam.beamed(index);
    const flags = beamed || stem === null ? 0 : value === 'sixteenth' ? 2 : value === 'eighth' ? 1 : 0;
    const dot = dotted ? { x: column + dotShift + headRx + GLYPH.dotGap * S, y: position % 2 === 0 ? y - S / 2 : y } : null;
    // beside the head, past its dot or its ledger line, level with it; in a stem-up chord with a second, the head
    // beside it is displaced to the right, so a finger on the other head goes past that head too
    const beside = dot ? dot.x : x + Math.max(headRx, LEDGER_HALF * S);
    const pastNeighbour = up && displaced.size > 0 ? column + 3 * headRx : -Infinity;
    const fingerX = Math.max(beside, pastNeighbour) + GLYPH.fingerSide * S;
    return {
      index, system: bar.system, staff: staffIndex, bar: note.bar, x, column, y, position, value,
      filled: value === 'quarter' || value === 'eighth' || value === 'sixteenth',
      dot,
      headRx, headRy, stem, flag: flags > 0, flags, beamed,
      accidental: chordAccidentals[i] ?? null, accidentalLeft,
      ledgerLines: ledgerLinePositions(position).map((lp) => ({ y: yOf(staff, lp, S), x1: x - LEDGER_HALF * S, x2: x + LEDGER_HALF * S })),
      label: group.length === 1 ? noteLabel(note.spelling, naming) : '',
      finger: group.length === 1 || i === group.length - 1 ? note.finger ?? null : null,
      headFinger: note.finger ?? null,
      fingerX,
      labelY: 0,
      labelLines: 1,
      fingerY: 0,
      dynamic: null,
      scoreY: 0,
    };
  });
  // a chord's names are joined with a slash (C#/E/G), so a sharp or flat does not run into the next name
  if (group.length > 1) members[0]!.label = group.map((e) => noteLabel(e.note.spelling, naming)).join('/');
  return members;
}

/**
 * The name of the chord one staff strikes on a tick (core_09.AC59), in the label that names its notes: instead of them
 * (`name`) where the namer knows the chord, or on a second line under them (`both`). A single note is never named.
 */
function nameTheChord(p: Placer, members: readonly NoteGlyph[]): void {
  const holder = members.find((m) => m.label !== '');
  if (!p.chordNames || !holder || members.length < 2) return;
  const notes = members.map((m) => p.chart.notes[m.index]!);
  const name = p.chordNames.name(notes.map((n) => n.midi), notes.map((n) => n.spelling));
  if (name === null) return;
  if (p.chordNames.show === 'name') holder.label = name;
  else {
    holder.label = `${holder.label}\n${name}`;
    holder.labelLines = 2;
  }
}

/**
 * A name that falls among the ledger lines over the staff, under a high note (`highest` its staff position, `topY` the
 * staff's top line), stands centred in the space between two of them, so no ledger line runs through its letters
 * (ft_0_05.AC3); it moves at most half a staff space, up toward its note or down. Elsewhere it stays where it is.
 */
function clearOfLedgers(labelY: number, highest: number, topY: number, S: number): number {
  const highestLedger = highest - (highest % 2); // ledger lines stand on the even positions above the top line (8)
  const at = 8 + (topY - labelY) / (S / 2);
  if (highestLedger < 10 || at <= 8 || at >= highestLedger) return labelY;
  const space = 2 * Math.floor(at / 2) + 1;
  return topY - ((space - 8) * S) / 2;
}

/** Hint labels sit beyond the stems and heads of the whole chord, wherever the stems ended up: names under it, the top finger above it. */
function placeHints(members: readonly NoteGlyph[], S: number, tuplet?: { top: number; bottom: number }): void {
  // every stem counts: a chord has one, a tick of two voices one per voice (d164); a triplet's number or bracket on this
  // chord's side pushes the hints out past it (core_09.AC50)
  const stems = members.flatMap((m) => (m.stem ? [m.stem] : []));
  const lowest = Math.max(...members.map((m) => m.y + m.headRy), ...stems.map((st) => (st.up ? -Infinity : st.y2)), tuplet?.bottom ?? -Infinity);
  const highest = Math.min(...members.map((m) => m.y - m.headRy), ...stems.map((st) => (st.up ? st.y2 : Infinity)), tuplet?.top ?? Infinity);
  const top = members[0]!;
  const labelY = clearOfLedgers(lowest + GLYPH.hintGap * S, Math.max(...members.map((m) => m.position)), top.y + ((top.position - 8) * S) / 2, S);
  for (const m of members) {
    m.labelY = labelY;
    m.fingerY = highest - GLYPH.hintGap * S;
  }
  // Scores stack one step above the last, highest note first, so no two numbers of a chord share a spot.
  [...members].sort((a, b) => b.position - a.position).forEach((m, k) => { m.scoreY = m.fingerY - k * SCORE_STEP * S; });
}

/**
 * Where two voices start together a second apart, the stem-up chord (voice 1) stands one head to the right of the
 * stem-down one, so the heads sit side by side and the stems stay clear (core_09.AC53): pixels, keyed by the group's first note.
 */
function secondShifts(groups: readonly (readonly { note: ChartNote; index: number }[])[], clef: Clef, S: number): { shift: Map<number, number>; dotPast: Map<number, number> } {
  const shift = new Map<number, number>();
  const dotPast = new Map<number, number>();
  const byTick = new Map<number, (readonly { note: ChartNote; index: number }[])[]>();
  for (const g of groups) byTick.set(g[0]!.note.tick, [...(byTick.get(g[0]!.note.tick) ?? []), g]);
  for (const [one, two] of byTick.values()) {
    if (!one || !two) continue;
    const ps = (g: readonly { note: ChartNote }[]) => g.map((e) => staffPosition(e.note.spelling, clef));
    const pair = ps(one).flatMap((a) => ps(two).filter((b) => Math.abs(a - b) === 1).map((b) => a - b))[0];
    if (pair === undefined) continue;
    // the lower head of the second goes right: voice 2 under voice 1 (the stems meet in one line), voice 1 when they cross
    const [moved, stays] = pair > 0 ? [two, one] : [one, two];
    const rx = moved[0]!.note.dur === NOTE_TICKS.whole ? GLYPH.head.rxWhole : GLYPH.head.rx;
    shift.set(moved[0]!.index, 2 * rx * S);
    // a dot of the head that stays goes past the moved head
    dotPast.set(stays[0]!.index, 2 * rx * S);
  }
  return { shift, dotPast };
}

/** The notes, beams and grace notes of one staff. */
function layoutStaffNotes(p: Placer, staffSpec: StaffSpec, staffIndex: number, rests: readonly RestGlyph[]): { notes: NoteGlyph[]; beams: BeamGlyph[]; graces: GraceGlyph[]; tuplets: TupletGlyph[] } {
  const { S, chart } = p;
  const clef = staffSpec.track.clef;
  // Eighths and sixteenths of one beat are beamed in runs (core_09.AC40); any other eighth or sixteenth gets its flags.
  const groups = chordGroups(staffSpec.notes, clef);
  const runs = staffBeams(chart, groups, clef, staffSpec.twoVoiceBars);
  const upOf = runDirections(runs, groups);
  const inRun = new Set(runs.flatMap((run) => run.members.flatMap((m) => groups[m]!.map((e) => e.index))));
  const beamed = (index: number) => inRun.has(index);
  const seconds = secondShifts(groups, clef, S);

  const notes: NoteGlyph[] = [];
  const chords = groups.map((group) => {
    const stemUp = upOf.get(group[0]!.index) ?? voiceStemUp(staffSpec, group[0]!.note);
    const members = chordGlyphs(p, group, staffIndex, clef, { stemUp, beamed }, seconds.shift.get(group[0]!.index) ?? 0, seconds.dotPast.get(group[0]!.index) ?? 0);
    notes.push(...members);
    return members;
  });
  // The tied-to note is drawn but names itself and shows no finger: the tie already says it is the same key (core_09.AC10).
  const { continuations } = tieLinks(chart, new Set([staffSpec.track.id]));
  for (const g of notes) if (continuations.has(g.index)) {
    g.label = '';
    g.finger = null;
    g.headFinger = null;
  }

  const graces = layoutStaffGraces(p, staffSpec, staffIndex, notes);

  // A beam is horizontal and joins the stem tips of its run: every stem takes the end of the one that reaches furthest
  // (AX-3 provisional: flat beams keep the pixel ink clean). A sixteenth's second beam lies inside the first. A grace that
  // stands between the stems keeps the beams clear of its ink: they move past it and the stems grow to meet them (core_09.AC32).
  const beams: BeamGlyph[] = [];
  const glyphs = new Map(notes.map((g) => [g.index, g]));
  const thickness = GLYPH.beamThickness * S;
  const gap = GLYPH.beamGap * S;
  for (const run of runs) {
    const stems = run.members.map((m) => groups[m]!.map((e) => glyphs.get(e.index)!).find((g) => g.stem !== null)!);
    const stemOf = new Map(run.members.map((m, k) => [m, stems[k]!]));
    const first = stems[0]!;
    const last = stems[stems.length - 1]!;
    const up = run.up;
    const depth = thickness + (run.secondary.length > 0 ? thickness + gap : 0);
    const between = graces.filter((g) => g.system === first.system && g.left < last.stem!.x && g.right > first.stem!.x);
    const tip = up
      ? Math.min(...stems.map((g) => g.stem!.y2), ...between.map((g) => graceInk(g, S).top - GRACE_BEAM_GAP * S - depth))
      : Math.max(...stems.map((g) => g.stem!.y2), ...between.map((g) => graceInk(g, S).bottom + GRACE_BEAM_GAP * S + depth));
    for (const g of stems) g.stem!.y2 = tip;
    const secondY = up ? tip + thickness + gap : tip - thickness - gap;
    const secondary = run.secondary.map((b) => {
      if ('from' in b) return { x1: stemOf.get(b.from)!.stem!.x, x2: stemOf.get(b.to)!.stem!.x, y: secondY };
      const k = run.members.indexOf(b.at);
      const x = stems[k]!.stem!.x;
      const neighbour = stems[b.toward === 'right' ? k + 1 : k - 1];
      const length = Math.min(GLYPH.partialBeam * S, neighbour ? Math.abs(neighbour.stem!.x - x) / 2 : GLYPH.partialBeam * S);
      return b.toward === 'right' ? { x1: x, x2: x + length, y: secondY } : { x1: x - length, x2: x, y: secondY };
    });
    beams.push({
      system: first.system, staff: staffIndex, notes: run.members.flatMap((m) => groups[m]!.map((e) => e.index)),
      x1: first.stem!.x, x2: last.stem!.x, y: tip, thickness, up, secondary,
    });
  }
  const tuplets = layoutStaffTuplets(p, staffSpec, notes, rests, beams);
  const tupletInk = new Map(tuplets.flatMap((t) => t.notes.map((n) => [n, t.above ? { top: t.top, bottom: -Infinity } : { top: Infinity, bottom: t.bottom }] as const)));
  // The hints of one tick go over both voices, as for one chord (d164): the names, joined on the lowest note, under the
  // lowest ink of the tick, the top finger and the scores above its highest, so none lands on the other voice's head.
  const byTick = new Map<number, NoteGlyph[]>();
  for (const members of chords) {
    const tick = chart.notes[members[0]!.index]!.tick;
    byTick.set(tick, [...(byTick.get(tick) ?? []), ...members]);
  }
  for (const [tick, members] of byTick) {
    if (members.length > 0 && chords.filter((c) => chart.notes[c[0]!.index]!.tick === tick).length > 1) {
      const sorted = [...members].sort((a, b) => a.position - b.position);
      const named = sorted.filter((g) => !continuations.has(g.index));
      const names = named.map((g) => noteLabel(chart.notes[g.index]!.spelling, p.naming));
      const top = sorted[sorted.length - 1]!;
      for (const g of sorted) {
        g.label = '';
        if (g !== top) g.finger = null;
      }
      // the names go on the lowest head that has one (a tied-to head names nothing)
      if (named.length > 0) named[0]!.label = names.join('/');
      top.finger = continuations.has(top.index) ? null : chart.notes[top.index]!.finger ?? null;
    }
    nameTheChord(p, members);
    // the triplet marks of every chord of the tick (core_09.AC50)
    const inks = members.flatMap((m) => tupletInk.get(m.index) ?? []);
    const ink = inks.length > 0 ? { top: Math.min(...inks.map((i) => i.top)), bottom: Math.max(...inks.map((i) => i.bottom)) } : undefined;
    placeHints(members, S, ink);
  }
  // A dynamic mark sits under the hint labels of its note (core_09.AC15); the chord's mark is on its lowest note only.
  for (const g of notes) {
    const dynamic = chart.notes[g.index]!.dynamic;
    if (dynamic !== undefined) g.dynamic = { text: dynamic, x: g.column, y: g.labelY + ((g.labelLines - 1) * LABEL_LINE + DYNAMIC_DROP) * S };
  }
  return { notes, beams, graces, tuplets };
}

/**
 * The triplets of one staff (core_09.AC50, d163). One that is exactly a beamed run gets a small 3 centred on the beam's
 * outer side; any other (a quarter triplet, one holding a rest) a bracket over its notes and rests, hooked toward them, with
 * the 3 in a gap at its middle. Above, unless all its stems point down (`tupletSides`). `top` and `bottom` bound its ink.
 */
function layoutStaffTuplets(p: Placer, staffSpec: StaffSpec, notes: readonly NoteGlyph[], rests: readonly RestGlyph[], beams: readonly BeamGlyph[]): TupletGlyph[] {
  const { S, chart } = p;
  const height = TUPLET_DIGIT * S;
  return staffSpec.tuplets.flatMap(({ tuplet, index }): TupletGlyph[] => {
    const inside = (e: { track: string; voice: number; tick: number }) => e.track === tuplet.track && e.voice === tuplet.voice && e.tick >= tuplet.startTick && e.tick <= tuplet.endTick;
    const members = notes.filter((g) => inside(chart.notes[g.index]!));
    const restMembers = rests.filter((r) => inside(chart.rests[r.index]!));
    const first = members[0] ?? restMembers[0];
    if (!first) return [];
    const ids = members.map((g) => g.index);
    const beam = restMembers.length === 0 ? beams.find((b) => b.notes.length === ids.length && ids.every((n) => b.notes.includes(n))) : undefined;
    const base = { index, system: first.system, staff: first.staff, notes: ids, rests: restMembers.map((r) => r.index) };
    if (beam) {
      const y = beam.up ? beam.y - (TUPLET_GAP * S + height / 2) : beam.y + TUPLET_GAP * S + height / 2;
      return [{ ...base, above: beam.up, number: { x: (beam.x1 + beam.x2) / 2, y, height }, bracket: null, top: y - height / 2, bottom: y + height / 2 }];
    }
    const stems = members.flatMap((g) => (g.stem ? [g.stem] : []));
    const above = !(stems.length > 0 && stems.every((st) => !st.up));
    const xs = [...members.flatMap((g) => [g.x - g.headRx, g.x + g.headRx]), ...restMembers.flatMap((r) => [r.x - 0.6 * S, r.x + 0.6 * S])];
    const edge = above
      ? Math.min(...members.map((g) => (g.stem?.up ? g.stem.y2 : g.y - g.headRy)), ...restMembers.map((r) => r.y - REST_REACH * S)) - TUPLET_GAP * S - height / 2
      : Math.max(...members.map((g) => (g.stem && !g.stem.up ? g.stem.y2 : g.y + g.headRy)), ...restMembers.map((r) => r.y + REST_REACH * S)) + TUPLET_GAP * S + height / 2;
    const x1 = Math.min(...xs);
    const x2 = Math.max(...xs);
    return [{
      ...base, above, number: { x: (x1 + x2) / 2, y: edge, height },
      bracket: { x1, x2, y: edge, hook: (above ? 1 : -1) * TUPLET_HOOK * S },
      top: edge - height / 2, bottom: edge + height / 2,
    }];
  });
}

/** The highest and lowest ink of a grace: its head, its stem and flag, and its accidental. */
function graceInk(g: GraceGlyph, S: number): { top: number; bottom: number } {
  const box = g.accidental ? ACCIDENTAL_BOX[accidentalKind(g.accidental.alter)] : null;
  return {
    top: Math.min(g.y - g.headRy, g.stem.y2, box ? g.y - box.up * g.scale * S : Infinity),
    bottom: Math.max(g.y + g.headRy, g.stem.y2, box ? g.y + box.down * g.scale * S : -Infinity),
  };
}

/**
 * The grace notes of one staff (core_09.AC32): each stands left of its main note's column, past the main note's accidentals
 * and heads, at the scale of a grace; it reaches `GRACE_GAP` from that ink. Its stem, flag, slash, ledger lines and
 * accidental follow the rules of a single head of its pitch.
 */
function layoutStaffGraces(p: Placer, staffSpec: StaffSpec, staffIndex: number, notes: readonly NoteGlyph[]): GraceGlyph[] {
  const { S, naming, accidentalPlan } = p;
  const clef = staffSpec.track.clef;
  const k = GRACE_SCALE;
  return staffSpec.graces.map(({ grace, index, main }) => {
    const mainGlyph = notes.find((n) => n.index === main)!;
    const bar = p.bars[mainGlyph.bar]!;
    const staff = p.systems[bar.system]!.staves[staffIndex]!;
    const position = staffPosition(grace.pitch.spelling, clef);
    const alter = accidentalPlan.graceAlterOf.get(index) ?? null;
    const sides = graceSides(alter, grace.slash, position);
    const headRx = GLYPH.head.rx * k * S;
    const headRy = GLYPH.head.ry * k * S;
    const x = mainGlyph.column - (accidentalPlan.leftOf.get(main)! + GRACE_GAP + sides.right) * S;
    const y = yOf(staff, position, S);
    const up = chordStemUp(position, position);
    const stemX = up ? x + headRx : x - headRx;
    // the stem is the same length as a single head's, at the grace's scale
    const stemEnd = y + (yOf(staff, stemTip(position, position, up), S) - y) * k;
    const slash = grace.slash
      ? { x1: stemX - GRACE_SLASH * S, y1: (y + stemEnd) / 2 + GRACE_SLASH * S, x2: stemX + GRACE_SLASH * S, y2: (y + stemEnd) / 2 - GRACE_SLASH * S }
      : null;
    const accidental = alter === null ? null : {
      alter,
      x: x - (sides.reach + (ACCIDENTAL_GAP + ACCIDENTAL_BOX[accidentalKind(alter)].width / 2) * k) * S,
      y,
    };
    const lowest = Math.max(y + headRy, !up ? stemEnd : -Infinity);
    return {
      index, main, system: bar.system, staff: staffIndex, bar: mainGlyph.bar, x, y, position, scale: k, headRx, headRy,
      stem: { x: stemX, y1: y, y2: stemEnd, up }, flag: grace.slash, slash,
      ledgerLines: ledgerLinePositions(position).map((lp) => ({ y: yOf(staff, lp, S), x1: x - LEDGER_HALF * k * S, x2: x + LEDGER_HALF * k * S })),
      accidental,
      left: x - sides.left * S, right: x + sides.right * S,
      label: noteLabel(grace.pitch.spelling, naming),
      labelY: lowest + GLYPH.hintGap * k * S,
    };
  });
}

/**
 * The tie curves of one staff (core_09.AC10). A curve bows away from its note's stem (below a note with no stem when it is
 * under the middle line, above it otherwise). A tie that crosses a line break becomes two half curves, one per line.
 * A tie ends before a grace that stands in front of its tied-to note, so the curve never crosses the grace (core_09.AC32).
 */
function layoutStaffTies(p: Placer, staffSpec: StaffSpec, staffIndex: number, notes: readonly NoteGlyph[], graces: readonly GraceGlyph[]): TieGlyph[] {
  const { S, chart } = p;
  const links = tieLinks(chart, new Set([staffSpec.track.id]));
  const glyphs = new Map(notes.map((g) => [g.index, g]));
  const graceOf = new Map(graces.map((g) => [g.main, g]));
  const height = S * 0.6;
  const lineEdges = (system: number) => {
    const onLine = p.bars.filter((b) => b.system === system);
    return { left: Math.min(...onLine.map((b) => b.x)), right: Math.max(...onLine.map((b) => b.x + b.width)) };
  };
  const ties: TieGlyph[] = [];
  for (const [from, to] of links.next) {
    const a = glyphs.get(from);
    const b = glyphs.get(to);
    if (!a || !b) continue;
    // Bow away from the stem: a note with its stem up is tied below. With two voices a tie goes on the stem side, voice 1's above and voice 2's below (d164).
    const up = voiceStemUp(staffSpec, chart.notes[from]!) ?? (a.stem ? !a.stem.up : a.position >= 4);
    const startX = a.x + a.headRx * 1.1;
    const grace = graceOf.get(to);
    const endX = grace ? Math.min(b.x - b.headRx * 1.1, grace.left - GRACE_TIE_GAP * S) : b.x - b.headRx * 1.1;
    const startY = a.y + (up ? -1 : 1) * a.headRy * 1.2;
    const endY = b.y + (up ? -1 : 1) * b.headRy * 1.2;
    if (a.system === b.system) {
      ties.push({ system: a.system, staff: staffIndex, from, to, x1: startX, x2: endX, y: startY, up, height });
    } else {
      ties.push({ system: a.system, staff: staffIndex, from, to: null, x1: startX, x2: lineEdges(a.system).right, y: startY, up, height });
      ties.push({ system: b.system, staff: staffIndex, from: null, to, x1: lineEdges(b.system).left, x2: endX, y: endY, up, height });
    }
  }
  return ties;
}

/** The clear space between a slur and the heads, stems and marks it passes, and its default bow, in staff spaces (core_09.AC27). */
const SLUR_CLEAR = 0.5;
/** Half the width of a rest's ledger line, in staff spaces: a little wider than the whole and half rest blocks. */
const REST_LEDGER_HALF = 1.1;
const SLUR_BOW = 1.6;
/** How far a slur's word sits beyond the curve (or beyond the heads of a slur that bows down), in staff spaces. */
const SLUR_WORD_GAP = 0.9;

/** A point the slur's curve must pass above (bowing up) or below (bowing down). */
interface SlurPoint {
  x: number;
  y: number;
}

/** The points a note's ink puts in the way of a slur on the side it bows to (core_09.AC27). */
function slurPointsOf(g: NoteGlyph, up: boolean, S: number): SlurPoint[] {
  const clear = SLUR_CLEAR * S;
  if (up) {
    const points: SlurPoint[] = [{ x: g.x, y: g.y - g.headRy - clear }];
    if (g.stem?.up) points.push({ x: g.stem.x, y: g.stem.y2 - clear });
    return points;
  }
  // below: the heads, the note name under the head, a dynamic mark under that, and a stem that points down
  const points: SlurPoint[] = [{ x: g.x, y: g.y + g.headRy + clear }, { x: g.column, y: g.labelY + ((g.labelLines - 1) * LABEL_LINE + LABEL_HALF) * S + clear }];
  if (g.stem && !g.stem.up) points.push({ x: g.stem.x, y: g.stem.y2 + clear });
  if (g.dynamic) points.push({ x: g.dynamic.x, y: g.dynamic.y + LABEL_HALF * S + clear });
  return points;
}

/**
 * The y of a slur's control point, for a curve from (x1, y1) to (x2, y2) that passes the points between its ends on the side
 * it bows to. The curve's x runs linearly along t (its control point is midway), so each point fixes a bound on the control y.
 * The default bow is as flat as the points allow.
 */
function slurControlY(x1: number, y1: number, x2: number, y2: number, points: readonly SlurPoint[], up: boolean, S: number): number {
  let controlY = (y1 + y2) / 2 + (up ? -1 : 1) * SLUR_BOW * S;
  for (const { x, y } of points) {
    const t = (x - x1) / (x2 - x1);
    if (!(t > 0 && t < 1)) continue;
    const onEnds = (1 - t) * (1 - t) * y1 + t * t * y2;
    const weight = 2 * (1 - t) * t;
    const bound = (y - onEnds) / weight;
    controlY = up ? Math.min(controlY, bound) : Math.max(controlY, bound);
  }
  return controlY;
}

/**
 * The slurs of one staff (core_09.AC27, d120), in chart order. A slur bows on the side away from its stems when they all point
 * one way (above the notes when they point both ways or there are none and the notes lie above the middle line). A slur that
 * crosses a line break becomes two half curves, one per line.
 */
function layoutStaffSlurs(p: Placer, staffSpec: StaffSpec, staffIndex: number, notes: readonly NoteGlyph[]): SlurGlyph[] {
  const { S, chart } = p;
  const trackSlurs = (chart.slurs ?? []).filter((s) => s.track === staffSpec.track.id);
  if (trackSlurs.length === 0) return [];
  const lineEdges = (system: number) => {
    const onLine = p.bars.filter((b) => b.system === system);
    return { left: Math.min(...onLine.map((b) => b.x)), right: Math.max(...onLine.map((b) => b.x + b.width)) };
  };
  const out: SlurGlyph[] = [];
  for (const slur of trackSlurs) {
    const tickOf = (g: NoteGlyph) => chart.notes[g.index]!.tick;
    const members = notes.filter((g) => chart.notes[g.index]!.voice === slur.voice && tickOf(g) >= slur.startTick && tickOf(g) <= slur.endTick);
    const starts = members.filter((g) => tickOf(g) === slur.startTick);
    const ends = members.filter((g) => tickOf(g) === slur.endTick);
    if (starts.length === 0 || ends.length === 0) continue;
    const between = members.filter((g) => tickOf(g) > slur.startTick && tickOf(g) < slur.endTick);
    // All stems one way: the slur goes on the head side. Mixed stems, or none and the notes above the middle line: above.
    const stems = members.flatMap((g) => (g.stem ? [g.stem.up] : []));
    const meanPosition = members.reduce((sum, g) => sum + g.position, 0) / members.length;
    // With two voices in the bar the slur goes on the stem side: voice 1's above, voice 2's below (d164).
    const voiced = members.some((g) => staffSpec.twoVoiceBars.has(g.bar));
    const up = voiced ? slur.voice === 1 : stems.length === 0 ? meanPosition >= 4 : !stems.every((s) => s);
    // A chord's slur leaves from the head on its own side: the highest for a slur above, the lowest below.
    const pick = (group: readonly NoteGlyph[]) => group.reduce((best, g) => ((up ? g.y < best.y : g.y > best.y) ? g : best));
    const a = pick(starts);
    const b = pick(ends);
    const startX = a.x + a.headRx * 1.1;
    const startY = a.y + (up ? -1 : 1) * a.headRy * 1.2;
    const endX = b.x - b.headRx * 1.1;
    const endY = b.y + (up ? -1 : 1) * b.headRy * 1.2;
    const pointsOn = (system: number) => between.filter((g) => g.system === system).flatMap((g) => slurPointsOf(g, up, S));
    const halves = a.system === b.system
      ? [{ system: a.system, from: a.index, to: b.index, x1: startX, x2: endX, y1: startY, y2: endY }]
      : [
        { system: a.system, from: a.index, to: null, x1: startX, x2: lineEdges(a.system).right, y1: startY, y2: startY },
        { system: b.system, from: null, to: b.index, x1: lineEdges(b.system).left, x2: endX, y1: endY, y2: endY },
      ];
    for (const half of halves) {
      const controlY = slurControlY(half.x1, half.y1, half.x2, half.y2, pointsOn(half.system), up, S);
      // The word: above the curve's highest point, or (a slur that bows down) above the highest head or stem on its line.
      let top: number;
      if (up) {
        top = Number.POSITIVE_INFINITY;
        for (let i = 0; i <= 20; i++) {
          const t = i / 20;
          top = Math.min(top, (1 - t) * (1 - t) * half.y1 + 2 * (1 - t) * t * controlY + t * t * half.y2);
        }
      } else {
        top = Math.min(half.y1, half.y2, ...members.filter((g) => g.system === half.system).map((g) => (g.stem?.up ? g.stem.y2 : g.y - g.headRy)));
      }
      out.push({
        system: half.system, staff: staffIndex, from: half.from, to: half.to,
        x1: half.x1, x2: half.x2, y1: half.y1, y2: half.y2, controlY, up,
        label: { x: (half.x1 + half.x2) / 2, y: top - SLUR_WORD_GAP * S },
      });
    }
  }
  return out;
}

/**
 * A rest's staff position. Whole rests hang from the fourth line (position 6); half rests sit on, and quarter and shorter
 * rests centre on, the middle line. In a bar of two voices voice 1's rests go up to the top line and voice 2's down to the
 * bottom ones (core_09.AC53), and further out when a head of the other voice starts on their tick (d164).
 */
function restPosition(spec: StaffSpec, rest: ChartRest, value: NoteValue): number {
  const plain = value === 'whole' ? 6 : 4;
  if (!spec.twoVoiceBars.has(rest.bar)) return plain;
  const heads = spec.notes.filter((e) => e.note.tick === rest.tick && e.note.voice !== rest.voice).map((e) => staffPosition(e.note.spelling, spec.track.clef));
  const onLine = (p: number, up: boolean) => (value === 'whole' || value === 'half' ? (up ? Math.ceil(p / 2) * 2 : Math.floor(p / 2) * 2) : p);
  if (rest.voice === 1) {
    // the rest's lowest ink stays a step above the other voice's highest head
    const need = heads.length === 0 ? -Infinity : Math.max(...heads) + (value === 'whole' ? 3 : value === 'half' ? 2 : 4);
    return onLine(Math.max(8, need), true);
  }
  const need = heads.length === 0 ? Infinity : Math.min(...heads) - (value === 'whole' ? 2 : value === 'half' ? 3 : 4);
  return onLine(Math.min(value === 'whole' ? 2 : 0, need), false);
}

/** How far a rest's ink reaches below and above its position, in staff positions. */
const restInk = (value: NoteValue) => (value === 'whole' ? { low: -1, high: 0 } : value === 'half' ? { low: 0, high: 1 } : { low: -3, high: 3 });

function layoutStaffRests(p: Placer, staffSpec: StaffSpec, staffIndex: number): RestGlyph[] {
  return staffSpec.rests.map(({ rest, index }) => {
    const bar = p.bars[rest.bar]!;
    const staff = p.systems[bar.system]!.staves[staffIndex]!;
    const { value, dotted } = rest.dur === p.barTicks ? { value: 'whole' as const, dotted: false } : noteShapeOf(writtenDurOf(p.chart, rest));
    const x = p.xAt(bar, rest.tick, rest.dur === p.barTicks);
    const position = restPosition(staffSpec, rest, value);
    const y = yOf(staff, position, p.S);
    // a whole or half rest out of the staff touches a ledger line, so the two can still be told apart (d164)
    const ledger = (value === 'whole' || value === 'half') && (position < 0 || position > 8) ? [{ y, x1: x - REST_LEDGER_HALF * p.S, x2: x + REST_LEDGER_HALF * p.S }] : null;
    // a dotted rest's dot: right of the rest, in the space above the middle line (core_09.AC37)
    const dot = dotted ? { x: x + GLYPH.restDotX * p.S, y: y - p.S / 2 } : null;
    return { index, system: bar.system, staff: staffIndex, bar: rest.bar, x, y, value, dot, ...(ledger ? { ledgerLines: ledger } : {}) };
  });
}

export function layoutStaff(chart: Chart, options: StaffLayoutOptions): StaffLayout {
  const vp = options.viewport;
  const tracks = pickTracks(chart, options.trackId, options.allPlayTracks, options.restingTracks);
  if (chart.meterMap.length !== 1) throw new UnsupportedNotationError('meter changes are not drawn yet');
  const keys = keyPlanOf(chart);
  const fifths = keys.first;
  const meter = chart.meterMap[0]!;

  const staves = staffSpecs(chart, tracks);
  const frame = planFrame(chart, staves, keys, options);
  const { plan } = frame;
  const S = plan.staffSpace;
  const placed = layoutSystems(staves, frame, vp);

  const timeSignatures: TimeSignatureLayout[] = placed.systems[0]!.staves.map((st) => ({
    system: 0, staff: st.index, num: meter.num, den: meter.den,
    x: placed.staffLeft + timeSignatureX(fifths) * S,
    yNum: st.topLineY + GLYPH.timeSignature.numY * S, yDen: st.topLineY + GLYPH.timeSignature.denY * S, digitHeight: GLYPH.timeSignature.digitHeight * S,
  }));

  const placer = makePlacer(chart, staves, frame, placed, options.noteNaming ?? 'B', options.chordNames);
  const perStaff = staves.map((staffSpec, staffIndex) => {
    const rests = layoutStaffRests(placer, staffSpec, staffIndex);
    const notesAndBeams = layoutStaffNotes(placer, staffSpec, staffIndex, rests);
    const { graces } = notesAndBeams;
    return {
      ...notesAndBeams,
      ties: layoutStaffTies(placer, staffSpec, staffIndex, notesAndBeams.notes, graces),
      slurs: layoutStaffSlurs(placer, staffSpec, staffIndex, notesAndBeams.notes),
      rests,
    };
  });
  // A lowered voice-2 rest under voice 1's notes (d164): the names (and a dynamic under them) go below the rest.
  for (const st of perStaff) {
    for (const r of st.rests) {
      const rest = chart.rests[r.index]!;
      if (rest.voice !== 2) continue;
      const clear = r.y + (REST_REACH + GLYPH.hintGap) * S;
      for (const g of st.notes) {
        if (chart.notes[g.index]!.tick !== rest.tick || g.labelY >= clear) continue;
        if (g.dynamic) g.dynamic.y += clear - g.labelY;
        g.labelY = clear;
      }
    }
  }
  // Keep the glyph lists in chart order, which is what the judge and the views index by.
  const noteGlyphs = perStaff.flatMap((st) => st.notes).sort((a, b) => a.index - b.index);
  const graceGlyphs = perStaff.flatMap((st) => st.graces).sort((a, b) => a.index - b.index);
  const restGlyphs = perStaff.flatMap((st) => st.rests).sort((a, b) => a.index - b.index);
  const beams = perStaff.flatMap((st) => st.beams);
  const ties = perStaff.flatMap((st) => st.ties);
  const slurs = perStaff.flatMap((st) => st.slurs);
  const tuplets = perStaff.flatMap((st) => st.tuplets).sort((a, b) => a.index - b.index);

  const { systems, bars, staffLines, barlines, braces, clefs, keySignature } = placed;
  const repeatSigns = repeatSignsOf(chart, systems, bars, keySignature, S);
  const endings = endingsOf(chart, systems, bars, noteGlyphs, S);
  return {
    ...(repeatSigns.length > 0 ? { repeatSigns } : {}),
    ...(endings.length > 0 ? { endings } : {}),
    staffSpace: S, fits: plan.fits, linesPerPage: plan.perPage, pageCount: Math.ceil(plan.systemCount / plan.perPage), clef: staves[0]!.track.clef, width: vp.width, height: vp.height,
    systems, bars, staffLines, barlines, braces, clefs, keySignature, timeSignature: timeSignatures[0]!, timeSignatures, notes: noteGlyphs, graces: graceGlyphs, rests: restGlyphs, beams, ties, slurs, tuplets,
  };
}

/**
 * The brackets of first and second endings (core_09.AC47): one piece per line over the ending's bars, 2 staff spaces above
 * the top line or a staff space above the highest head, stem or finger of those bars on the top staff, whichever is higher.
 */
function endingsOf(chart: Chart, systems: readonly SystemLayout[], bars: readonly BarLayout[], notes: readonly NoteGlyph[], S: number): EndingGlyph[] {
  const out: EndingGlyph[] = [];
  for (const r of chart.repeats ?? []) {
    if (!r.endings) continue;
    for (const [number, span] of [[1, r.endings.first], [2, r.endings.second]] as const) {
      const inSpan = bars.filter((b) => b.index >= span.startBar && b.index <= span.endBar);
      const lines = [...new Set(inSpan.map((b) => b.system))];
      lines.forEach((system, k) => {
        const here = inSpan.filter((b) => b.system === system);
        const indices = new Set(here.map((b) => b.index));
        const top = systems[system]!.topLineY;
        const tops = notes.filter((n) => n.system === system && n.staff === 0 && indices.has(n.bar)).map((n) => Math.min(
          n.y - n.headRy, n.stem ? Math.min(n.stem.y1, n.stem.y2) : Infinity, n.finger !== null ? n.fingerY - S : Infinity,
        ));
        const y = Math.min(top - 2 * S, Math.min(...tops) - S);
        const last = here[here.length - 1]!;
        out.push({ number, system, x1: here[0]!.x, x2: last.x + last.width, y, hookLeft: k === 0, hookRight: number === 1 && k === lines.length - 1, label: k === 0 });
      });
    }
  }
  return out;
}

/** Where the repeat signs go (core_09.AC19): a start at its first bar's left edge (after the clef and key at a line start), an end at its last bar's right edge. */
function repeatSignsOf(chart: Chart, systems: readonly SystemLayout[], bars: readonly BarLayout[], keySignature: readonly KeyAccidentalGlyph[], S: number): NonNullable<StaffLayout['repeatSigns']> {
  const out: NonNullable<StaffLayout['repeatSigns']> = [];
  const sign = (bar: BarLayout | undefined, side: 'start' | 'end') => {
    if (!bar) return;
    const system = systems[bar.system]!;
    const dotYs = system.staves.flatMap((st) => [st.topLineY + 1.5 * S, st.topLineY + 2.5 * S]);
    // a repeat that starts at a key change inside a line follows the change's signs (core_09.AC57)
    const signs = keySignature.filter((k) => k.bar === bar.index).map((k) => k.x);
    const start = signs.length > 0 ? Math.max(...signs) + (KEY_STEP / 2 + 0.2) * S : bar.x;
    out.push({ system: bar.system, x: side === 'start' ? start : bar.x + bar.width, y1: system.topLineY, y2: system.bottomLineY, side, dotYs });
  };
  for (const r of chart.repeats ?? []) {
    if (r.startBar > 0) sign(bars.find((b) => b.index === r.startBar), 'start');
    sign(bars.find((b) => b.index === r.endBar), 'end');
  }
  return out;
}
