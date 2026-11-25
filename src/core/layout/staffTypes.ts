import type { Dynamic } from '../chart/dynamics';
/**
 * The data `layoutStaff` (`staff.ts`) returns and takes: the options, every positioned glyph, the systems, staves and bars.
 * Pure types; units are logical pixels, origin top-left, unless a field says staff spaces.
 */
import type { Clef } from '../chart/pitch.ts';
import type { NoteNaming } from '../text/noteName.ts';

export type NoteValue = 'whole' | 'half' | 'quarter' | 'eighth' | 'sixteenth';

export interface StaffLayoutOptions {
  viewport: { width: number; height: number };
  /** Draw only this track, as a single staff. By default every played track is drawn (one or two staves). */
  trackId?: string;
  /** Draw every played track, also one without notes (the piece editor: a hand with nothing written yet still has its staff). */
  allPlayTracks?: boolean;
  /**
   * Also draw these tracks, which are not played (the hand that rests in a hand step of learning, ft_1_32 rule 13), on
   * their own staves marked `resting`, so the player sees both hands and the view greys the resting one.
   */
  restingTracks?: readonly string[];
  /** Distance between two staff lines in pixels, or "auto" for the largest size that fits. */
  staffSpace?: number | 'auto';
  /**
   * Reserve room above each chord for its tempo scores, which stack one step per note above it (`NoteGlyph.scoreY`), so a
   * tall stack stays on the page. Only where the scores can show (Tempo mode with the Scores view): elsewhere the room
   * would only make pieces with chords smaller.
   */
  scoreRoom?: boolean;
  maxStaffSpace?: number;
  minStaffSpace?: number;
  /** Bars on every line (system); the last line may hold fewer. By default as many as fit, spread evenly over the lines. */
  barsPerLine?: number;
  /**
   * Keep `barsPerLine` bar widths on a line even when the chart has fewer bars, so a short section of a piece has the bar
   * width of the piece. By default a chart shorter than a line spreads its bars over the whole line.
   */
  keepBarWidth?: boolean;
  /**
   * Lines shown at once, a page: the staff is sized so one page fits the viewport, and the lines of later pages take the
   * same places on the screen. By default every line is shown (one page).
   */
  linesPerPage?: number;
  /**
   * The space between the two staves of a grand staff. "short": two staff spaces, so middle C sits on one ledger line
   * halfway between them, the same place from either staff (treble E, D, C, B, bass A). "wide" (the default): room for the
   * stems, ledger lines and hints of both staves. A single staff ignores it.
   */
  staffGap?: 'wide' | 'short';
  /** How a hint label names a note: B or H (`noteLabel`). Default B. */
  noteNaming?: NoteNaming;
  /**
   * Plan the staff size, the lines and the room above and below each staff as if every staff also had notes this short
   * and at every staff position from `low` to `high`, alone or in a chord up to `widestChord` (the piece editor): a note added inside that reserve never resizes or moves the staff. Only the plan changes; nothing extra is drawn. By default the plan fits the notes there are.
   */
  reserve?: StaffReserve;
  /**
   * Bars as wide as what is in them (the piece editor): one entry per bar. A line holds as many bars as fit, left to
   * right, and is not stretched to the right edge; nothing is centred. Needs a number for `staffSpace` (with "auto" the
   * smallest staff space is used). By default every bar of the piece has the same width.
   */
  spacing?: readonly BarSpacing[];
}

/**
 * One bar's columns for `StaffLayoutOptions.spacing`: the ticks (from the bar's start) where something is drawn, each with
 * the room it takes in staff spaces up to the next column or the bar's end. Ticks between columns sit in proportion between them.
 */
export interface BarSpacing {
  columns: readonly { tick: number; width: number }[];
}

/**
 * What `StaffLayoutOptions.reserve` keeps room for: the shortest note in ticks, the lowest and highest staff positions,
 * and the widest chord inside them in staff positions (7 an octave, 0 single notes only).
 */
export interface StaffReserve {
  shortestTicks: number;
  low: number;
  high: number;
  widestChord: number;
  /**
   * The staff's clef can change between layouts (the trainers, which draw a note below middle C in the bass clef): plan the
   * room of either clef, so the clef never moves the staff.
   */
  anyClef?: boolean;
}

export interface NoteGlyph {
  /** Index into `chart.notes`. */
  index: number;
  system: number;
  /** Which staff of the system: 0 is the top one. */
  staff: number;
  bar: number;
  /** Head centre (a head of a second beside the stem is moved half a head width to the side of the chord's column). */
  x: number;
  /** The x of the chord's column (equal to `x` for a single note); hints and the cursor sit here. */
  column: number;
  y: number;
  /** Diatonic steps above the bottom line of its staff (see `staffPosition`). */
  position: number;
  value: NoteValue;
  filled: boolean;
  /** The dot of a dotted note, right of the head in the space (a head on a line has it in the space above), or null. */
  dot: { x: number; y: number } | null;
  headRx: number;
  headRy: number;
  /** A chord has one stem, on the head where it starts (the lowest for stem up, the highest for stem down); its other heads have none. */
  stem: { x: number; y1: number; y2: number; up: boolean } | null;
  /** An eighth or sixteenth that is not beamed: draw `flags` flags at the end of its stem. */
  flag: boolean;
  /** How many flags: 1 for an unbeamed eighth, 2 for an unbeamed sixteenth, else 0 (core_09.AC41). */
  flags: number;
  /** An eighth or sixteenth joined to the rest of its beat by a beam (see `StaffLayout.beams`). */
  beamed: boolean;
  /** The accidental printed for this note (1 sharp, -1 flat, 0 natural), left of its head, or null when none is printed (docs/notation.md section 4). */
  accidental: { alter: number; x: number; y: number } | null;
  /** Left edge of the accidentals of this note's chord (the cursor box reaches it), or null when the chord prints none. */
  accidentalLeft: number | null;
  ledgerLines: { y: number; x1: number; x2: number }[];
  /** Note name hint, drawn under the note when enabled. A chord's names are all on its lowest head, low to high; its other heads have ''. */
  label: string;
  /** Finger hint of the chord's highest head, drawn beside it when enabled. */
  finger: number | null;
  /** The finger of this head itself, for every head of a chord (shown when the chord-fingers setting is on). */
  headFinger: number | null;
  /** Centre x of this head's finger: right of the head, past its ledger line or dot, level with the head at `y`. */
  fingerX: number;
  labelY: number;
  fingerY: number;
  /** A dynamic mark this note starts (core_09.AC15): its letters, and where they sit below the hint labels, or null. */
  dynamic: { text: Dynamic; x: number; y: number } | null;
  /** Where the tempo score of this note is written (the view's 'number' mode): a chord's scores stack upward, highest note nearest the chord. */
  scoreY: number;
}

export interface RestGlyph {
  /** Index into `chart.rests`. */
  index: number;
  system: number;
  staff: number;
  bar: number;
  x: number;
  /** Whole rest: y of the line it hangs from. Half rest: y of the line it sits on. Quarter rest: vertical centre. */
  y: number;
  value: NoteValue;
  /** The dot of a dotted rest (dotted half or dotted quarter), right of the rest in the space above the middle line, or null (core_09.AC37). */
  dot: { x: number; y: number } | null;
  /** The ledger line a whole or half rest hangs from or sits on when the other voice moved it out of the staff (d164); absent inside it. */
  ledgerLines?: { y: number; x1: number; x2: number }[];
}

/**
 * A grace note (core_09.AC32, d121): a small head before its main note, drawn at `scale` of a normal head, with its own
 * stem, a flag and a slash when it is an acciaccatura, its ledger lines and a small accidental. Units: logical pixels.
 * `left` and `right` are the ink the grace takes either side of `x`, accidental included, so a view or a test can keep clear of it.
 */
export interface GraceGlyph {
  /** Index into `chart.graces`. */
  index: number;
  /** Index into `chart.notes` of the main note it goes before. */
  main: number;
  system: number;
  staff: number;
  bar: number;
  /** Head centre, and the y of its line or space (the clef's pitch-to-y rule, as for a note). */
  x: number;
  y: number;
  /** Diatonic steps above the bottom line of its staff (see `staffPosition`). */
  position: number;
  /** Share of a normal note's size that the head, stem and marks are drawn at. */
  scale: number;
  headRx: number;
  headRy: number;
  /** Always present: a grace has a stem, placed by the rule for a single head of its pitch. */
  stem: { x: number; y1: number; y2: number; up: boolean };
  /** A slashed grace (acciaccatura) has a flag at the end of its stem. */
  flag: boolean;
  /** The slash across the stem of an acciaccatura, from (x1, y1) to (x2, y2), or null. */
  slash: { x1: number; y1: number; x2: number; y2: number } | null;
  ledgerLines: { y: number; x1: number; x2: number }[];
  /** The accidental printed small, left of the head (alter 1 sharp, -1 flat, 0 natural), or null. */
  accidental: { alter: number; x: number; y: number } | null;
  /** The grace's leftmost and rightmost ink: its accidental or head, its ledger lines and its slash. */
  left: number;
  right: number;
  /** Note name hint letter, drawn small under the head when the note-name hints are on. */
  label: string;
  labelY: number;
}

/** The beam over a pair of eighths: a horizontal bar of `thickness` between the two stems, hanging from the tips (stems up) or rising to them (stems down). */
export interface BeamGlyph {
  system: number;
  staff: number;
  /** Chart notes it joins (every head of every chord in the run), in time order. */
  notes: number[];
  x1: number;
  x2: number;
  /** y of the stem tips, where the beam's outer edge is. */
  y: number;
  thickness: number;
  up: boolean;
  /** The second beams of sixteenths, inside the first: full ones between two sixteenths, short partial ones on a lone one; `y` is the outer edge as for the first (core_09.AC40). */
  secondary: { x1: number; x2: number; y: number }[];
}

/**
 * A tie curve (core_09.AC10): from the head of the note it leaves to the head of the note it enters, bowing away from the
 * stem. A tie across a line break is two half curves: one with `to: null` ends at the line's right edge, one with
 * `from: null` starts at the next line's left edge. Units: logical pixels; `y` is the head's y, `height` the bow.
 */
export interface TieGlyph {
  system: number;
  staff: number;
  /** Chart note index the curve leaves, or null when it started on the line before. */
  from: number | null;
  /** Chart note index the curve enters, or null when it goes on to the next line. */
  to: number | null;
  x1: number;
  x2: number;
  y: number;
  /** The curve bows above the heads (true) or below them. */
  up: boolean;
  height: number;
}
/**
 * A slur (core_09.AC27, d120): a curve from the head of its first note to the head of its last, drawn on the side away from
 * the stems when they all point one way and above the notes otherwise. It is a quadratic curve from (x1, y1) through
 * (midway, controlY) to (x2, y2). A slur across a line break is two halves, as a tie is: `to: null` ends at the line's right
 * edge, `from: null` starts at the next line's left edge. `label` is where its word goes, the centre x and the baseline y
 * just beyond the curve (above it when the slur bows up; above the heads when it bows down).
 */
export interface SlurGlyph {
  system: number;
  staff: number;
  /** Chart note index the slur starts at, or null when it started on the line before. */
  from: number | null;
  /** Chart note index the slur ends at, or null when it goes on to the next line. */
  to: number | null;
  x1: number;
  x2: number;
  y1: number;
  y2: number;
  controlY: number;
  /** The curve bows above the notes (true) or below them. */
  up: boolean;
  label: { x: number; y: number };
}

/**
 * A triplet (core_09.AC50, d163): a small `3` centred at `number` (its digit `height` tall), on the beam's outer side when
 * the triplet is one beamed run, else in the gap at the middle of a `bracket` over its notes and rests whose ends hook
 * `hook` pixels toward them (positive: down, for a bracket above). `top` and `bottom` bound its ink.
 */
export interface EndingGlyph {
  number: 1 | 2;
  system: number;
  x1: number;
  x2: number;
  y: number;
  hookLeft: boolean;
  hookRight: boolean;
  label: boolean;
}

export interface TupletGlyph {
  /** The chart tuplet index. */
  index: number;
  system: number;
  staff: number;
  /** Chart note and rest indices it holds, in time order. */
  notes: number[];
  rests: number[];
  above: boolean;
  number: { x: number; y: number; height: number };
  bracket: { x1: number; x2: number; y: number; hook: number } | null;
  top: number;
  bottom: number;
}

/** One accidental of a key signature, drawn after the clef on a staff at the start of every system (docs/notation.md section 5). */
export interface KeyAccidentalGlyph {
  system: number;
  staff: number;
  /** A sharp or flat of the signature, or a natural that cancels one at a key change (core_09.AC57). */
  alter: 1 | -1 | 0;
  x: number;
  y: number;
  /** Set on the signs of a key change drawn at the start of this bar inside a line (core_09.AC57); absent after the clef. */
  bar?: number;
}

/** One staff inside a system. */
export interface StaffInfo {
  index: number;
  trackId: string;
  /** A track drawn for reading only, not played (`restingTracks`): the view draws its notes grey. */
  resting?: true;
  clef: Clef;
  topLineY: number;
  bottomLineY: number;
  /**
   * Cursor arrow for notes on this staff: below the staff pointing up, or (for the upper staff of a grand staff)
   * above it pointing down, so it never lands between the staves. Reserved outside every note name and finger number.
   */
  arrow: { tipY: number; direction: 'up' | 'down' };
}

export interface SystemLayout {
  index: number;
  /** The page it is shown on (see `StaffLayoutOptions.linesPerPage`). */
  page: number;
  firstBar: number;
  barCount: number;
  staves: StaffInfo[];
  /** Top line of the first staff. */
  topLineY: number;
  /** Bottom line of the last staff. */
  bottomLineY: number;
  /** Arrow tip of the last staff (where the single-staff cursor arrow sits). */
  cursorTipY: number;
  left: number;
  right: number;
}

export interface BarLayout {
  index: number;
  system: number;
  x: number;
  width: number;
  /** Room the bar's accidentals take, one entry per accidental tick (see `accidentalRoomAt`). */
  rooms: readonly BarRoom[];
  /** The room of all `rooms`, in staff spaces: the notes of the bar share the rest of its width. */
  roomTotal: number;
  /** With `StaffLayoutOptions.spacing`: where each column of the bar is drawn (ticks from the bar's start), for hit testing. */
  columns?: readonly { tick: number; x: number }[];
}

/** Room for the accidentals of one tick: it opens between `from` (the previous onset in the bar, or the bar start) and `at` (the tick), in staff spaces. */
export interface BarRoom {
  from: number;
  at: number;
  room: number;
}

export interface TimeSignatureLayout {
  system: number;
  staff: number;
  num: number;
  den: number;
  x: number;
  yNum: number;
  yDen: number;
  digitHeight: number;
}

export interface StaffLayout {
  staffSpace: number;
  /** Tie curves, in chart order of the note they leave (none for a piece without ties). */
  ties: TieGlyph[];
  /** Slur curves, in chart order of the note they start at (none for a piece without slurs, core_09.AC27). */
  slurs: SlurGlyph[];
  /** Triplet numbers and brackets, in chart order (none for a piece without triplets, core_09.AC50). */
  tuplets: TupletGlyph[];
  /** False when the piece (one page of it) cannot be shown at this size inside the viewport. */
  fits: boolean;
  /** Lines on a full page. Every line of a page has its own place on the screen; page 2 reuses the places of page 1. */
  linesPerPage: number;
  pageCount: number;
  /** Clef of the first (top) staff. */
  clef: Clef;
  width: number;
  height: number;
  systems: SystemLayout[];
  bars: BarLayout[];
  staffLines: { system: number; staff: number; y: number; x1: number; x2: number }[];
  /** Bar lines run through all staves of a system. */
  barlines: { system: number; x: number; y1: number; y2: number; kind: 'start' | 'single' | 'double' | 'final' }[];
  /** Repeat signs at bar lines (core_09.AC19): `start` (thick, thin, dots after) or `end` (dots, thin, thick); `dotYs` per staff. */
  repeatSigns?: { system: number; x: number; y1: number; y2: number; side: 'start' | 'end'; dotYs: number[] }[];
  /**
   * First and second endings (core_09.AC47): a bracket over the ending's bars, above the staff and its notes, one piece per
   * line it reaches. `label` ("1." or "2.") and the left hook on the first piece; the right hook closes the first ending's
   * last piece, the second ending stays open. Absent when the chart has none.
   */
  endings?: EndingGlyph[];
  /** The brace that joins the two staves of a grand staff, one per system; empty for a single staff. */
  braces: { system: number; x: number; y1: number; y2: number }[];
  clefs: { system: number; staff: number; clef: Clef; x: number; y: number; w: number; h: number }[];
  /** The key signature on every staff of every system, after the clef. Empty in C. */
  keySignature: KeyAccidentalGlyph[];
  /** Time signature of the first staff in the first system. */
  timeSignature: TimeSignatureLayout;
  /** The time signature on every staff of the first system. */
  timeSignatures: TimeSignatureLayout[];
  notes: NoteGlyph[];
  /** Grace notes in chart order (core_09.AC32, d121). They are not notes: bars, beats and `notes` do not count them. */
  graces: GraceGlyph[];
  rests: RestGlyph[];
  beams: BeamGlyph[];
}
