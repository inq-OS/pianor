/**
 * The piece editor's model: a piece of one or two hands with notes placed by bar and sixteenth, edited only through
 * these functions, which refuse anything the staff cannot draw. Pure and immutable: every edit returns a new piece or a
 * reason it was refused. Natural letters with a sharp, flat or natural each (`alter`), in a key of the piece (`fifths`, `mode`); whole, dotted half, half, dotted quarter, quarter, dotted eighth, eighth and sixteenth notes. Several pitches of one hand can share a start
 * and a length (a chord); any other overlap is refused. Empty time is
 * rest (`restsFor`), so a piece is always made of whole bars.
 */
import { z } from 'zod';
import { keyAlters, type Alter } from '../chart/key';
import { PIECE_HIGH, PIECE_LOW, STEPS, STEP_SEMITONES, type Step } from '../chart/pitch';
import { NOTE_TICKS, PIECE_BPM, PPQ } from '../chart/time';
import { DYNAMICS, type Dynamic } from '../chart/dynamics';
import type { KeyMode } from './key';
import { fittedSlurs, slurShapeProblem, sortSlurs } from './slurRules';

export type EditorHand = 'RH' | 'LH';
export type EditorHands = EditorHand | 'both';
/** Every length the piece maker writes (the sixteenth and the dotted quarter and eighth since core_09.AC55). */
export const EDITOR_LENGTHS = ['whole', 'dottedHalf', 'half', 'dottedQuarter', 'quarter', 'dottedEighth', 'eighth', 'sixteenth'] as const;
export type EditorLength = (typeof EDITOR_LENGTHS)[number];

export const LENGTH_TICKS: Readonly<Record<EditorLength, number>> = {
  whole: NOTE_TICKS.whole, dottedHalf: NOTE_TICKS.dottedHalf, half: NOTE_TICKS.half, dottedQuarter: NOTE_TICKS.dottedQuarter,
  quarter: NOTE_TICKS.quarter, dottedEighth: NOTE_TICKS.dottedEighth, eighth: NOTE_TICKS.eighth, sixteenth: NOTE_TICKS.sixteenth,
};
/** Shortest first: lengthening goes up this list, shortening down. */
export const LENGTHS: readonly EditorLength[] = [...EDITOR_LENGTHS].reverse();
/** The lengths the mouse wheel cycles over an empty place, longest first (the wheel skips the dotted lengths). */
export const WHEEL_LENGTHS: readonly EditorLength[] = ['whole', 'half', 'quarter', 'eighth', 'sixteenth'];
/** Notes start on sixteenths (core_09.AC55). */
export const GRID = PPQ / 4;
/** The keys a piece may use (`PIECE_LOW` to `PIECE_HIGH`). */
/** Longest piece title, in characters. */
export const TITLE_MAX = 60;
export const KEY_LOW = PIECE_LOW;
export const KEY_HIGH = PIECE_HIGH;
export const MAX_BARS = 32;
/** The bar buttons add or take away this many bars, a phrase at a time. */
export const BARS_STEP = 4;
/** The fewest bars the bar buttons go down to. */
export const BARS_MIN = 4;
/** A new blank piece starts with this many bars. */
export const BARS_DEFAULT = 8;

/** Beats per minute (quarter notes) of an editor piece: the default, the range and the step of the BPM buttons. */
export const BPM_DEFAULT = 80;
export const BPM_MIN = PIECE_BPM.min;
export const BPM_MAX = PIECE_BPM.max;
export const BPM_STEP = 5;

export const editorNoteSchema = z.object({
  hand: z.enum(['RH', 'LH']),
  bar: z.int().min(0),
  /** Ticks from the start of the bar (480 a quarter). */
  start: z.int().min(0),
  length: z.enum(EDITOR_LENGTHS),
  step: z.enum(STEPS),
  octave: z.int().min(-1).max(9),
  /** The sharp (1), flat (-1) or natural (0) of this note; a note placed in the key takes the key's alter. */
  alter: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
  /** Tied to the next note of the same pitch (core_09.AC13): one press for the chain; absent or false when untied. */
  tieNext: z.boolean().optional(),
  /** The finger the author set on this note, 1 (thumb) to 5 (little finger); absent when none (ft_1_02d.AC4). */
  finger: z.int().min(1).max(5).optional(),
  /**
   * The finger was written by AUTO, not by the author (ft_1_02d.AC23): AUTO may fit it again around the author's fingers.
   * Absent when the author set the finger, or there is none; a piece from before reads as all its fingers the author's.
   */
  fingerAuto: z.literal(true).optional(),
  /** A dynamic mark written on this note; it holds from here on (core_09.AC14, AC16). */
  dynamic: z.enum(DYNAMICS).optional(),
  /**
   * A pre-note (grace note, eelnoot) written small before this note (core_09.AC35, d121): its letter, octave and alter, and
   * whether it has the slash (an acciaccatura). Absent when none; an own piece from before reads as before.
   */
  grace: z.object({
    step: z.enum(STEPS),
    octave: z.int().min(-1).max(9),
    alter: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
    slash: z.boolean(),
  }).optional(),
});

/** The lengths a placed rest can have: no dotted rests are placed (a dotted length places its plain rest). */
export const REST_LENGTHS = ['whole', 'half', 'quarter', 'eighth', 'sixteenth'] as const;
export type RestLength = (typeof REST_LENGTHS)[number];

/** The length a placed rest gets for a note length: no dotted rests are placed, so a dotted length places its plain rest. */
export function restLengthFor(length: EditorLength): RestLength {
  return length === 'dottedHalf' ? 'half' : length === 'dottedQuarter' ? 'quarter' : length === 'dottedEighth' ? 'eighth' : length;
}

/** A rest the author placed: it takes its time like a note, and the next note goes after it. */
export const placedRestSchema = z.object({
  hand: z.enum(['RH', 'LH']),
  bar: z.int().min(0),
  start: z.int().min(0),
  length: z.enum(REST_LENGTHS),
});

/** An onset of a hand: a bar and a start inside it (ticks). A chord has one onset (core_09.AC30). */
const slurOnsetSchema = z.object({ bar: z.int().min(0), start: z.int().min(0) });

/**
 * A slur (core_09.AC30, d120): a curve over the notes of one hand, from its first onset to a later one of the same hand.
 */
export const editorSlurSchema = z.object({
  hand: z.enum(['RH', 'LH']),
  from: slurOnsetSchema,
  to: slurOnsetSchema,
});

export const editorPieceSchema = z.object({
  title: z.string().max(TITLE_MAX),
  hands: z.enum(['RH', 'LH', 'both']),
  /** Quarter notes in a bar: 2/4, 3/4 or 4/4. */
  beats: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  bars: z.int().min(1).max(MAX_BARS),
  /** Beats per minute; absent means BPM_DEFAULT (older pieces and piece files have none). */
  bpm: z.int().min(BPM_MIN).max(BPM_MAX).optional(),
  /** The key: sharps (positive) or flats (negative) in the signature, -7 to 7, and whether the piece is in major or minor. */
  fifths: z.int().min(-7).max(7),
  mode: z.enum(['major', 'minor']),
  notes: z.array(editorNoteSchema),
  /**
   * Rests the author placed; absent in pieces and piece files from before, which read as before. Time that no note
   * and no placed rest takes is rest as well (`restsFor`), so a placed rest only matters where the next note goes.
   */
  rests: z.array(placedRestSchema).optional(),
  /** Repeats (core_09.AC20), written bars played twice; absent in pieces from before, which read as before. */
  repeats: z.array(z.object({ startBar: z.int().min(0), endBar: z.int().min(0) })).optional(),
  /** Slurs (core_09.AC30); absent in pieces from before, which read as before. Kept fitted to the notes (`settleSlurs`). */
  slurs: z.array(editorSlurSchema).optional(),
  /**
   * A pick-up (core_09.AC30): bar 0 holds only this many beats (fewer than the meter's) and the last bar the rest, so the
   * two make one whole bar. A note's `start` counts from the start of its own bar, a short one too. Absent means none, so
   * a piece from before reads as before.
   */
  pickup: z.int().min(1).max(3).optional(),
});

export type EditorNote = z.infer<typeof editorNoteSchema>;
export type EditorGrace = NonNullable<EditorNote['grace']>;
export type PlacedRest = z.infer<typeof placedRestSchema>;
export type EditorSlur = z.infer<typeof editorSlurSchema>;
export type SlurOnset = z.infer<typeof slurOnsetSchema>;
/** Which placed rest: rests of a hand never overlap, so hand, bar and start name it. */
export type RestRef = Pick<PlacedRest, 'hand' | 'bar' | 'start'>;
export type EditorPiece = z.infer<typeof editorPieceSchema>;
/** A note as the editor places it: its alter is the key's when left out. */
export type NoteInput = Omit<EditorNote, 'alter'> & { alter?: Alter | undefined };
/** Which note: notes of one hand overlap only as a chord (same start and length, other pitches), so hand, bar, start and pitch name it. */
export type NoteRef = Pick<EditorNote, 'hand' | 'bar' | 'start' | 'step' | 'octave'>;

export type Refusal =
  | 'bar-line' // it would run past the end of its bar (the staff draws no ties)
  | 'no-room' // another note of the same hand is in the way (a different start or length)
  | 'duplicate' // the same pitch is already there at that start
  | 'range' // not a key a piece may use
  | 'hand' // the piece is not for that hand
  | 'bar' // there is no such bar
  | 'grid' // not on a sixteenth
  | 'no-note' // nothing there to change
  | 'longest' // it is already the longest length this meter allows
  | 'shortest' // it is already a sixteenth
  | 'not-empty' // the meter can change only before any note is written
  | 'meter' // the bars were copied from a piece with another meter
  | 'bars-full' // the piece would go past MAX_BARS
  | 'pickup' // a pick-up needs a free first and last bar, a length shorter than the bar and two bars at least (core_09.AC30)
  | 'tie-none' // no note of the same pitch follows to tie into, for every head of the chord (core_09.AC13)
  | 'slur-none' // no slur holds that note, so there is none to take away (core_09.AC30)
  | 'slur-pitch' // a curve over notes of one pitch is a tie, not a slur (core_09.AC30)
  | 'slur-target' // a slur needs a note of its hand to start on and a later one to end on (core_09.AC30)
  | 'slur-overlap' // it would share a stretch of time with, or nest, another slur of its hand (core_09.AC30)
  | 'slur-repeat' // a repeat sign falls inside it: the ABC has no slur across one (d120)
  | 'grace-pitch' // a pre-note of the note's own pitch is a repeated note, not an ornament (d121)
  | 'grace-chord' // a chord takes no pre-note (d121)
  | 'grace-tie' // the second note of a tie takes no pre-note: it is not struck again (d121)
  | 'grace-none'; // the note has no pre-note to take away (d121)

export type Edit = { ok: true; piece: EditorPiece } | { ok: false; reason: Refusal };

const refuse = (reason: Refusal): Edit => ({ ok: false, reason });

export function emptyPiece(options: { title: string; hands: EditorHands; beats: 2 | 3 | 4; bars: number }): EditorPiece {
  return { title: options.title, hands: options.hands, beats: options.beats, bars: clampBars(options.bars), fifths: 0, mode: 'major', notes: [] };
}

/** The ticks of a whole bar of the piece's meter. A pick-up and the last bar after it are shorter (`barLength`). */
export function barTicks(piece: Pick<EditorPiece, 'beats'>): number {
  return piece.beats * PPQ;
}

type BarShape = Pick<EditorPiece, 'beats' | 'bars' | 'pickup'>;

/** The ticks of the pick-up, 0 for none (core_09.AC30). */
export function pickupTicks(piece: Pick<EditorPiece, 'pickup'>): number {
  return (piece.pickup ?? 0) * PPQ;
}

/** The ticks bar `bar` holds: a whole bar, or with a pick-up, the pick-up's beats in bar 0 and the rest in the last bar. */
export function barLength(piece: BarShape, bar: number): number {
  const pickup = pickupTicks(piece);
  if (pickup === 0) return barTicks(piece);
  if (bar === 0) return pickup;
  return bar === piece.bars - 1 ? barTicks(piece) - pickup : barTicks(piece);
}

/** How far into a whole bar a bar's first tick falls: a pick-up holds a whole bar's last beats (0 for any other bar). */
export function barOffset(piece: BarShape, bar: number): number {
  return bar === 0 && pickupTicks(piece) > 0 ? barTicks(piece) - pickupTicks(piece) : 0;
}

/** Where bar `bar` starts in the piece, in ticks: after the pick-up and the whole bars before it. */
export function barStartTick(piece: BarShape, bar: number): number {
  const pickup = pickupTicks(piece);
  return bar === 0 ? 0 : pickup > 0 ? pickup + (bar - 1) * barTicks(piece) : bar * barTicks(piece);
}

/** The tick in the piece of `start` ticks into `bar`. */
export function tickOf(piece: BarShape, bar: number, start: number): number {
  return barStartTick(piece, bar) + start;
}

/** The place `end` ticks into `bar`: the next bar's start when it reaches the bar line (it may be past the last bar). */
export function placeAfter(piece: BarShape, bar: number, end: number): { bar: number; start: number } {
  return end >= barLength(piece, bar) ? { bar: bar + 1, start: end - barLength(piece, bar) } : { bar, start: end };
}

/** The lengths a bar of this meter can hold, shortest first. */
export function lengthsFor(piece: Pick<EditorPiece, 'beats'>): EditorLength[] {
  return LENGTHS.filter((l) => LENGTH_TICKS[l] <= barTicks(piece));
}

export function midiOf(step: Step, octave: number): number {
  return (octave + 1) * 12 + STEP_SEMITONES[step];
}

/** The key of a piece: the alter each letter has in its signature (C in G is natural, F is sharp). */
export function keyAlterOf(piece: Pick<EditorPiece, 'fifths'>, step: Step): Alter {
  return keyAlters(piece.fifths)[step];
}

/** The pitch a note sounds at, MIDI: its letter and octave, and its alter. */
export function soundingMidi(note: Pick<EditorNote, 'step' | 'octave' | 'alter'>): number {
  return midiOf(note.step, note.octave) + note.alter;
}

export function handsOf(piece: Pick<EditorPiece, 'hands'>): EditorHand[] {
  return piece.hands === 'both' ? ['RH', 'LH'] : [piece.hands];
}

const sameRef = (n: NoteRef, ref: NoteRef) => n.hand === ref.hand && n.bar === ref.bar && n.start === ref.start && n.step === ref.step && n.octave === ref.octave;
const sameChord = (n: NoteRef, ref: Pick<NoteRef, 'hand' | 'bar' | 'start'>) => n.hand === ref.hand && n.bar === ref.bar && n.start === ref.start;
const ordered = (notes: EditorNote[]) => [...notes].sort((a, b) => a.bar - b.bar || a.start - b.start || (a.hand === b.hand ? 0 : a.hand === 'RH' ? -1 : 1) || soundingMidi(a) - soundingMidi(b));
const clampBars = (bars: number) => Math.max(1, Math.min(MAX_BARS, Math.round(bars)));

/** The rests the author placed (none in an older piece). */
export function placedRests(piece: Pick<EditorPiece, 'rests'>): PlacedRest[] {
  return piece.rests ?? [];
}

const sameRest = (r: RestRef, ref: RestRef) => r.hand === ref.hand && r.bar === ref.bar && r.start === ref.start;
const orderedRests = (rests: PlacedRest[]) => [...rests].sort((a, b) => a.bar - b.bar || a.start - b.start || (a.hand === b.hand ? 0 : a.hand === 'RH' ? -1 : 1));

/** What takes time in one bar of a hand: every note and every placed rest, as start and end ticks. */
function spansIn(piece: EditorPiece, hand: EditorHand, bar: number): { start: number; end: number }[] {
  return [
    ...piece.notes.filter((n) => n.hand === hand && n.bar === bar),
    ...placedRests(piece).filter((r) => r.hand === hand && r.bar === bar),
  ].map((e) => ({ start: e.start, end: e.start + LENGTH_TICKS[e.length] }));
}

/** The note of `hand` sounding at `tick` of `bar` (start included, end excluded), or null; of a chord the one with `pitch`, else the first. */
export function noteAt(piece: EditorPiece, hand: EditorHand, bar: number, tick: number, pitch?: Pick<EditorNote, 'step' | 'octave'>): EditorNote | null {
  return piece.notes.find((n) => n.hand === hand && n.bar === bar && n.start <= tick && tick < n.start + LENGTH_TICKS[n.length]
    && (!pitch || (n.step === pitch.step && n.octave === pitch.octave))) ?? null;
}

export function findNote(piece: EditorPiece, ref: NoteRef): EditorNote | null {
  return piece.notes.find((n) => sameRef(n, ref)) ?? null;
}

/** Whether `candidate` can stand in `piece` (ignoring the note `replacing`, when it replaces that one). */
function check(piece: EditorPiece, candidate: EditorNote, replacing: NoteRef | null): Refusal | null {
  if (!handsOf(piece).includes(candidate.hand)) return 'hand';
  if (candidate.bar < 0 || candidate.bar >= piece.bars) return 'bar';
  if (candidate.start < 0 || candidate.start % GRID !== 0 || candidate.start >= barLength(piece, candidate.bar)) return 'grid';
  const midi = soundingMidi(candidate);
  if (midi < KEY_LOW || midi > KEY_HIGH) return 'range';
  const end = candidate.start + LENGTH_TICKS[candidate.length];
  if (end > barLength(piece, candidate.bar)) return 'bar-line';
  // its pre-note is a key of the EZ-220 too, and another key than the note's own (d121)
  if (candidate.grace) {
    const grace = soundingMidi(candidate.grace);
    if (grace < KEY_LOW || grace > KEY_HIGH) return 'range';
    if (grace === midi) return 'grace-pitch';
  }
  let problem: Refusal | null = null;
  for (const n of piece.notes) {
    if (n.hand !== candidate.hand || n.bar !== candidate.bar || (replacing && sameRef(n, replacing))) continue;
    // the same letter, or the same sounding pitch (E sharp and F), at the same start is one note twice
    if (n.start === candidate.start && (soundingMidi(n) === midi || (n.step === candidate.step && n.octave === candidate.octave))) return 'duplicate';
    // a chord: the same start and length, another pitch; any other overlap is in the way
    const chord = n.start === candidate.start && n.length === candidate.length;
    if (!chord && n.start < end && candidate.start < n.start + LENGTH_TICKS[n.length]) problem = 'no-room';
  }
  // a placed rest is never part of a chord
  if (placedRests(piece).some((r) => r.hand === candidate.hand && r.bar === candidate.bar && r.start < end && candidate.start < r.start + LENGTH_TICKS[r.length])) return 'no-room';
  return problem;
}

/** Whether a placed rest can stand in `piece`: the hand, the bar, the grid, the bar line, and no note or rest in its time. */
function checkRest(piece: EditorPiece, rest: PlacedRest, replacing: RestRef | null): Refusal | null {
  if (!handsOf(piece).includes(rest.hand)) return 'hand';
  if (rest.bar < 0 || rest.bar >= piece.bars) return 'bar';
  if (rest.start < 0 || rest.start % GRID !== 0 || rest.start >= barLength(piece, rest.bar)) return 'grid';
  const end = rest.start + LENGTH_TICKS[rest.length];
  if (end > barLength(piece, rest.bar)) return 'bar-line';
  const others = { ...piece, rests: placedRests(piece).filter((r) => !(replacing && sameRest(r, replacing))) };
  return spansIn(others, rest.hand, rest.bar).some((e) => e.start < end && rest.start < e.end) ? 'no-room' : null;
}

/**
 * Whether a whole piece, as read from outside (an imported file), obeys every rule the editor enforces note by note:
 * a hand the piece has, a bar of the piece, the grid, the keyboard's range, inside the bar line, no two notes at once in a hand unless they are a chord.
 * Returns the first problem or null.
 */
export function pieceProblem(piece: EditorPiece): Refusal | null {
  if (piece.pickup !== undefined && (piece.pickup >= piece.beats || piece.bars < 2)) return 'pickup';
  for (const [i, note] of piece.notes.entries()) {
    const others = { ...piece, notes: piece.notes.filter((_, j) => j !== i) };
    const problem = check(others, note, null);
    if (problem) return problem;
  }
  for (const [i, rest] of placedRests(piece).entries()) {
    const problem = checkRest({ ...piece, rests: placedRests(piece).filter((_, j) => j !== i) }, rest, null);
    if (problem) return problem;
  }
  // a slur's ends are notes of its hand and it does not share time with another slur of the hand. A repeat sign is not an
  // import problem: the output leaves such a slur out, and a piece may get a repeat after its slur was drawn.
  const slurs = piece.slurs ?? [];
  for (const [i, slur] of slurs.entries()) {
    const problem = slurShapeProblem({ ...piece, slurs: slurs.filter((_, j) => j !== i) }, slur);
    if (problem) return problem;
  }
  return null;
}

function replace(piece: EditorPiece, ref: NoteRef, change: (n: EditorNote) => EditorNote): Edit {
  const old = findNote(piece, ref);
  if (!old) return refuse('no-note');
  const next = change(old);
  const problem = check(piece, next, ref);
  if (problem) return refuse(problem);
  return { ok: true, piece: { ...piece, notes: ordered(piece.notes.map((n) => (sameRef(n, ref) ? next : n))) } };
}

/** Place a note. Without an alter it takes the key's spelling of its letter (core_09.AC8). */
export function placeNote(piece: EditorPiece, input: NoteInput): Edit {
  const note: EditorNote = { ...input, alter: input.alter ?? keyAlterOf(piece, input.step) };
  const problem = check(piece, note, null);
  if (problem) return refuse(problem);
  return { ok: true, piece: { ...piece, notes: ordered([...piece.notes, note]) } };
}

/**
 * The length a note gets when it is placed at `start` of `bar`: the `selected` length when it fits, otherwise the longest
 * length that fits from there to the next note of the hand (or the bar line). The selected length is never exceeded, in
 * an empty bar too. A place with no room (inside a note) returns `selected`, so placing it is refused as before.
 */
export function autoLength(piece: EditorPiece, hand: EditorHand, bar: number, start: number, selected: EditorLength): EditorLength {
  // a note added to a chord shares the chord's length
  const chord = piece.notes.find((n) => n.hand === hand && n.bar === bar && n.start === start);
  if (chord) return chord.length;
  // notes and placed rests both take time
  const spans = spansIn(piece, hand, bar);
  const next = spans.filter((e) => e.start > start).reduce((least, e) => Math.min(least, e.start), barLength(piece, bar));
  const room = next - start;
  if (spans.some((e) => e.start <= start && start < e.end)) return selected;
  const fits = lengthsFor(piece).filter((l) => LENGTH_TICKS[l] <= room && LENGTH_TICKS[l] <= LENGTH_TICKS[selected]);
  return fits[fits.length - 1] ?? 'sixteenth';
}

/** A sharp (1), flat (-1) or natural (0) on one note: the others, and the key, stay as they are. */
export function setAlter(piece: EditorPiece, ref: NoteRef, alter: Alter): Edit {
  return replace(piece, ref, (n) => ({ ...n, alter }));
}

/** The accidental item's next sign: sharp, then flat, then natural, then sharp again. */
export function nextAlter(alter: Alter): Alter {
  return alter === 1 ? -1 : alter === -1 ? 0 : 1;
}

/** Sets or clears (undefined) the dynamic mark of the selected note only (core_09.AC16). */
export function setDynamic(piece: EditorPiece, ref: NoteRef, dynamic: Dynamic | undefined): Edit {
  return replace(piece, ref, (n) => {
    const rest: EditorNote = { ...n };
    delete rest.dynamic;
    return dynamic === undefined ? rest : { ...rest, dynamic };
  });
}

/**
 * Sets or clears (undefined) the pre-note of one note, checked by the note rules (keyboard range, not its own pitch). Where
 * a pre-note may go at all (not on a chord or a tie's second note) is decided in `graces.ts` (core_09.AC35, d121).
 */
export function replaceGrace(piece: EditorPiece, ref: NoteRef, grace: EditorGrace | undefined): Edit {
  return replace(piece, ref, (n) => {
    const rest: EditorNote = { ...n };
    delete rest.grace;
    return grace === undefined ? rest : { ...rest, grace };
  });
}

/** The next mark in the order pp, p, mp, mf, f, ff, then none (for the one-button cycle in the editor). */
export function nextDynamic(current: Dynamic | undefined): Dynamic | undefined {
  const i = current === undefined ? -1 : DYNAMICS.indexOf(current);
  return DYNAMICS[i + 1];
}

/** The key of the piece. The notes keep their own alters: a key change only changes what the signature shows. */
export function setKey(piece: EditorPiece, fifths: number, mode: KeyMode): EditorPiece {
  return { ...piece, fifths, mode };
}

export function setPitch(piece: EditorPiece, ref: NoteRef, step: Step, octave: number): Edit {
  return replace(piece, ref, (n) => ({ ...n, step, octave }));
}

/**
 * One staff position up or down: the next letter, B to C going up with the octave. The key signature decides the
 * sharp or flat, so the note's letter is all that changes.
 */
export function stepPitch(piece: EditorPiece, ref: NoteRef, direction: 1 | -1): Edit {
  const note = findNote(piece, ref);
  if (!note) return refuse('no-note');
  const { step, octave } = stepped(note, direction);
  return replace(piece, ref, (n) => ({ ...n, step, octave, alter: keyAlterOf(piece, step) }));
}

export function stepped(note: Pick<EditorNote, 'step' | 'octave'>, direction: 1 | -1): Pick<EditorNote, 'step' | 'octave'> {
  const index = STEPS.indexOf(note.step) + direction;
  return { step: STEPS[(index + STEPS.length) % STEPS.length]!, octave: note.octave + Math.floor(index / STEPS.length) };
}

/** The notes of the chord at `ref`: the notes of its hand and bar that start there, lowest first (one note is a chord of one). */
export function chordOf(piece: EditorPiece, ref: Pick<NoteRef, 'hand' | 'bar' | 'start'>): EditorNote[] {
  return piece.notes.filter((n) => sameChord(n, ref));
}

/** Every note of the chord `ref` is in, one staff position up or down as `stepPitch` does: all of them move, or none. */
export function stepChord(piece: EditorPiece, ref: NoteRef, direction: 1 | -1): Edit {
  if (!findNote(piece, ref)) return refuse('no-note');
  let next: EditorPiece = { ...piece, notes: piece.notes.filter((n) => !sameChord(n, ref)) };
  for (const member of chordOf(piece, ref)) {
    // the new letter takes the key's sharp or flat (ft_1_02d.AC7), as a note placed there would
    const edit = placeNote(next, { ...member, ...stepped(member, direction), alter: undefined });
    if (!edit.ok) return edit;
    next = edit.piece;
  }
  return { ok: true, piece: next };
}

/** Sets the finger of one note (ft_1_02d.AC4), or clears it with null; it becomes the author's (ft_1_02d.AC23). Only this note changes: each head of a chord has its own. */
export function setFinger(piece: EditorPiece, ref: NoteRef, finger: 1 | 2 | 3 | 4 | 5 | null): Edit {
  return replace(piece, ref, (n) => {
    const next: EditorNote = { ...n };
    delete next.fingerAuto;
    if (finger === null) delete next.finger;
    else next.finger = finger;
    return next;
  });
}

/** Sets the length of the note, and of every other note of its chord, which share one length. */
export function setLength(piece: EditorPiece, ref: NoteRef, length: EditorLength): Edit {
  if (!findNote(piece, ref)) return refuse('no-note');
  const members = piece.notes.filter((n) => sameChord(n, ref));
  let rest: EditorPiece = { ...piece, notes: piece.notes.filter((n) => !sameChord(n, ref)) };
  for (const member of members) {
    const edit = placeNote(rest, { ...member, length });
    if (!edit.ok) return edit;
    rest = edit.piece;
  }
  return { ok: true, piece: rest };
}

/** A dotted length and the plain lengths either side of it on the wheel: longer is the next plain length up, shorter its own plain value. */
const DOTTED_NEIGHBOURS: Partial<Record<EditorLength, { longer: EditorLength; shorter: EditorLength }>> = {
  dottedHalf: { longer: 'whole', shorter: 'half' },
  dottedQuarter: { longer: 'half', shorter: 'quarter' },
  dottedEighth: { longer: 'quarter', shorter: 'eighth' },
};

/**
 * One step along WHEEL_LENGTHS from `length`, longer or shorter; it stops at the ends (no wrap). The dotted lengths are not
 * on the wheel, but a note that has one still steps to its neighbours: the dotted half to the whole or the half.
 */
export function cycleLength(length: EditorLength, toward: 'longer' | 'shorter'): EditorLength {
  const dotted = DOTTED_NEIGHBOURS[length];
  if (dotted) return dotted[toward];
  const index = WHEEL_LENGTHS.indexOf(length);
  const next = toward === 'longer' ? index - 1 : index + 1;
  return WHEEL_LENGTHS[Math.min(WHEEL_LENGTHS.length - 1, Math.max(0, next))]!;
}

/**
 * The lengths lengthening and shortening step through: the plain ones and the dotted half, as before core_09.AC55, so a
 * middle click or Shift + right still takes a quarter to a half. A dotted quarter or eighth steps to the next one along.
 */
export const STEP_LENGTHS: readonly EditorLength[] = ['sixteenth', 'eighth', 'quarter', 'half', 'dottedHalf', 'whole'];

/** One step longer along STEP_LENGTHS, if the bar and the next note leave room. */
export function lengthen(piece: EditorPiece, ref: NoteRef): Edit {
  const note = findNote(piece, ref);
  if (!note) return refuse('no-note');
  const allowed = lengthsFor(piece);
  const next = STEP_LENGTHS.find((l) => allowed.includes(l) && LENGTH_TICKS[l] > LENGTH_TICKS[note.length]);
  return next ? setLength(piece, ref, next) : refuse('longest');
}

/** Alt + Enter on a note: the longest length it can have, up to the next note or the bar line. */
export function longestFit(piece: EditorPiece, ref: NoteRef): Edit {
  const note = findNote(piece, ref);
  if (!note) return refuse('no-note');
  for (const l of lengthsFor(piece).filter((x) => LENGTH_TICKS[x] > LENGTH_TICKS[note.length]).reverse()) {
    const edit = setLength(piece, ref, l);
    if (edit.ok) return edit;
  }
  return refuse('longest');
}

/** One step shorter along STEP_LENGTHS, down to the sixteenth. */
export function shorten(piece: EditorPiece, ref: NoteRef): Edit {
  const note = findNote(piece, ref);
  if (!note) return refuse('no-note');
  const next = [...STEP_LENGTHS].reverse().find((l) => LENGTH_TICKS[l] < LENGTH_TICKS[note.length]);
  return next ? setLength(piece, ref, next) : refuse('shortest');
}

export function removeNote(piece: EditorPiece, ref: NoteRef): Edit {
  if (!findNote(piece, ref)) return refuse('no-note');
  return { ok: true, piece: settleSlurs({ ...piece, notes: piece.notes.filter((n) => !sameRef(n, ref)) }) };
}

/** Place a rest of its own: the next note of the hand goes after it. */
export function placeRest(piece: EditorPiece, rest: PlacedRest): Edit {
  const problem = checkRest(piece, rest, null);
  if (problem) return refuse(problem);
  return { ok: true, piece: { ...piece, rests: orderedRests([...placedRests(piece), rest]) } };
}

export function removeRest(piece: EditorPiece, ref: RestRef): Edit {
  if (!placedRests(piece).some((r) => sameRest(r, ref))) return refuse('no-note');
  return { ok: true, piece: { ...piece, rests: placedRests(piece).filter((r) => !sameRest(r, ref)) } };
}

/** The plain rest lengths, shortest first: a placed rest steps through these (no dotted rests are placed). */
const REST_STEPS: readonly RestLength[] = [...REST_LENGTHS].reverse();

/** Sets the length of a placed rest, if the bar and the next note or rest leave room. */
function setRestLength(piece: EditorPiece, ref: RestRef, length: RestLength): Edit {
  const rest = placedRests(piece).find((r) => sameRest(r, ref));
  if (!rest) return refuse('no-note');
  const next = { ...rest, length };
  const problem = checkRest(piece, next, ref);
  if (problem) return refuse(problem);
  return { ok: true, piece: { ...piece, rests: orderedRests([...placedRests(piece).filter((r) => !sameRest(r, ref)), next]) } };
}

/** Ctrl + wheel on a placed rest, as `lengthen` on a note: one plain rest length longer, if the meter and the room allow. */
export function lengthenRest(piece: EditorPiece, ref: RestRef): Edit {
  const rest = placedRests(piece).find((r) => sameRest(r, ref));
  if (!rest) return refuse('no-note');
  const bar = barTicks(piece);
  const next = REST_STEPS.find((l) => LENGTH_TICKS[l] <= bar && LENGTH_TICKS[l] > LENGTH_TICKS[rest.length]);
  return next ? setRestLength(piece, ref, next) : refuse('longest');
}

/** One plain rest length shorter, down to the sixteenth, as `shorten` on a note. */
export function shortenRest(piece: EditorPiece, ref: RestRef): Edit {
  const rest = placedRests(piece).find((r) => sameRest(r, ref));
  if (!rest) return refuse('no-note');
  const next = [...REST_STEPS].reverse().find((l) => LENGTH_TICKS[l] < LENGTH_TICKS[rest.length]);
  return next ? setRestLength(piece, ref, next) : refuse('shortest');
}

/**
 * The places a note (or rest) of `hand` can go in `bar`, in ticks: the start of every stretch of time that no note
 * and no placed rest takes. That is the start of an empty bar, the end of the last note or rest when the bar is not full,
 * and the start of a gap between them. The author writes in order: one place per gap, not every eighth of it.
 */
export function slotsFor(piece: EditorPiece, hand: EditorHand, bar: number): number[] {
  const spans = spansIn(piece, hand, bar).sort((a, b) => a.start - b.start);
  const slots: number[] = [];
  let at = 0;
  for (const span of spans) {
    if (span.start > at) slots.push(at);
    at = Math.max(at, span.end);
  }
  if (at < barLength(piece, bar)) slots.push(at);
  return slots;
}

/**
 * More bars keep every note; fewer bars drop the notes and rests in the bars that go (undo brings them back). With a
 * pick-up the last bar is short, so what a new last bar cannot hold goes too; a piece of one bar has no pick-up.
 */
export function setBars(piece: EditorPiece, bars: number): EditorPiece {
  const count = clampBars(bars);
  const shaped = count < 2 ? withoutPickup(piece) : piece;
  const fits = (e: { bar: number; start: number; length: EditorLength }) => e.bar < count && e.start + LENGTH_TICKS[e.length] <= barLength({ ...shaped, bars: count }, e.bar);
  return settleSlurs(withRests({ ...shaped, bars: count, notes: piece.notes.filter(fits) }, placedRests(piece).filter(fits)));
}

/** The piece with no pick-up field (a piece from before has none). */
function withoutPickup(piece: EditorPiece): EditorPiece {
  const rest = { ...piece };
  delete rest.pickup;
  return rest;
}

/**
 * The pick-up of the piece (core_09.AC30): `beats` of the meter's (1 to one less than the meter), or 0 for none. What
 * the first bar holds stays where it sounds, at the end of a whole bar: a written first bar whose notes start only in its
 * last beats becomes a pick-up of those beats. Refused when a note
 * of the first bar would start before the pick-up or the last bar holds more than its share; a piece needs two bars.
 */
export function setPickup(piece: EditorPiece, beats: number): Edit {
  if (beats === (piece.pickup ?? 0)) return { ok: true, piece };
  if (!Number.isInteger(beats) || beats < 0 || beats >= piece.beats || (beats > 0 && piece.bars < 2)) return refuse('pickup');
  const target = beats === 0 ? withoutPickup(piece) : { ...piece, pickup: beats };
  const by = barOffset(piece, 0) - barOffset(target, 0);
  const moved = <T extends { bar: number; start: number }>(e: T): T => (e.bar === 0 ? { ...e, start: e.start + by } : e);
  if ([...piece.notes, ...placedRests(piece)].some((e) => moved(e).start < 0)) return refuse('pickup');
  const out = withRests({ ...target, notes: piece.notes.map(moved) }, placedRests(piece).map(moved));
  const next = piece.slurs ? { ...out, slurs: piece.slurs.map((s) => ({ ...s, from: moved(s.from), to: moved(s.to) })) } : out;
  return insideBars(next) ? { ok: true, piece: next } : refuse('pickup');
}

/** Whether every note and placed rest is inside its bar, a short pick-up or last bar too (core_09.AC30). */
function insideBars(piece: EditorPiece): boolean {
  return [...piece.notes, ...placedRests(piece)].every((e) => e.bar < piece.bars && e.start + LENGTH_TICKS[e.length] <= barLength(piece, e.bar));
}

/**
 * The piece without its pick-up, the pick-up's notes and rests kept where they sound: at the end of a whole bar 0, as
 * `fromChart` puts an unpaired short first bar (core_09.AC30). Bars that go before the pick-up make it a whole bar.
 */
export function wholeFirstBar(piece: EditorPiece): EditorPiece {
  if (piece.pickup === undefined) return piece;
  const offset = barTicks(piece) - pickupTicks(piece);
  const moved = <T extends { bar: number; start: number }>(e: T): T => (e.bar === 0 ? { ...e, start: e.start + offset } : e);
  const out = withRests({ ...withoutPickup(piece), notes: piece.notes.map(moved) }, placedRests(piece).map(moved));
  return piece.slurs ? { ...out, slurs: piece.slurs.map((s) => ({ ...s, from: moved(s.from), to: moved(s.to) })) } : out;
}

/**
 * The piece after bars moved behind its pick-up (a cut, an insert, a paste), so that every note stays inside its bar
 * (core_09.AC30): as it is while its last bar still holds only what it may; else with one more, empty, short last bar;
 * else, at MAX_BARS, without its pick-up (`wholeFirstBar`). Nothing is lost; the parent can clear a bar.
 */
export function keepInBars(piece: EditorPiece): EditorPiece {
  if (piece.pickup === undefined || (piece.bars >= 2 && insideBars(piece))) return piece;
  const longer = { ...piece, bars: piece.bars + 1 };
  if (piece.bars >= 2 && longer.bars <= MAX_BARS && insideBars(longer)) return longer;
  return wholeFirstBar(piece);
}

/** The piece with these placed rests, leaving a piece without any as it was (no empty list on an older piece). */
export function withRests(piece: EditorPiece, rests: PlacedRest[]): EditorPiece {
  return piece.rests === undefined && rests.length === 0 ? piece : { ...piece, rests };
}

/** The piece with these slurs in time order; a piece with none has no slurs field (as `repeats`), so it reads as before. */
export function withSlurs(piece: EditorPiece, slurs: EditorSlur[]): EditorPiece {
  const rest = { ...piece };
  delete rest.slurs;
  return slurs.length > 0 ? { ...rest, slurs: sortSlurs(piece.beats, slurs) } : rest;
}

/** The piece with its slurs fitted to the notes it has now, after notes or bars went (core_09.AC30, `fittedSlurs`). */
export function settleSlurs(piece: EditorPiece): EditorPiece {
  return withSlurs(piece, fittedSlurs(piece));
}

/**
 * One press of a bar button: up by BARS_STEP (clamped to MAX_BARS), or down by BARS_STEP but never below BARS_MIN.
 * A press that cannot move the piece in its direction returns the same piece, so the screen can skip it.
 */
export function stepBars(piece: EditorPiece, direction: 1 | -1): EditorPiece {
  const target = direction > 0 ? Math.min(MAX_BARS, piece.bars + BARS_STEP) : Math.max(BARS_MIN, piece.bars - BARS_STEP);
  if ((target - piece.bars) * direction <= 0) return piece;
  return setBars(piece, target);
}

/**
 * The piece as the editor opens it: always on both staves. The editor has no hand choice; an own piece saved for
 * one hand keeps all its notes, which are in that hand, and the other staff is empty. Saving still keeps only the hands
 * that have notes (`playedPiece`).
 */
export function onBothStaves(piece: EditorPiece): EditorPiece {
  return piece.hands === 'both' ? piece : { ...piece, hands: 'both' };
}

/**
 * The piece as it is played and saved: only the hands that have notes. The editor shows every hand of the piece (both
 * staves of a new piece), but a hand left empty is not part of the piece: it does not make the piece two-handed for the
 * level check, and the player is not shown an empty staff. The editor piece itself keeps its hands, to edit again.
 */
export function playedPiece(piece: EditorPiece): EditorPiece {
  const withNotes = handsOf(piece).filter((h) => piece.notes.some((n) => n.hand === h));
  if (withNotes.length === 0) return piece;
  return { ...piece, hands: withNotes.length === 2 ? 'both' : withNotes[0]! };
}

/** The meter changes only while there are no notes: changing it under notes would move them across bar lines. */
export function setBeats(piece: EditorPiece, beats: 2 | 3 | 4): Edit {
  if ((piece.notes.length > 0 || placedRests(piece).length > 0) && beats !== piece.beats) return refuse('not-empty');
  // a pick-up is shorter than its bar: one as long as the new bar goes (core_09.AC30)
  return { ok: true, piece: { ...((piece.pickup ?? 0) >= beats ? withoutPickup(piece) : piece), beats } };
}

/** The tempo of the piece: its own, or the default when it has none. */
export function bpmOf(piece: Pick<EditorPiece, 'bpm'>): number {
  return piece.bpm ?? BPM_DEFAULT;
}

/** Sets the tempo, rounded and clamped to BPM_MIN..BPM_MAX. */
export function setBpm(piece: EditorPiece, bpm: number): EditorPiece {
  return { ...piece, bpm: Math.max(BPM_MIN, Math.min(BPM_MAX, Math.round(bpm))) };
}

/** One press of a BPM button: BPM_STEP up or down, stopping at the ends; the same piece when it cannot move. */
export function stepBpm(piece: EditorPiece, direction: 1 | -1): EditorPiece {
  const next = Math.max(BPM_MIN, Math.min(BPM_MAX, bpmOf(piece) + direction * BPM_STEP));
  return next === bpmOf(piece) ? piece : setBpm(piece, next);
}

export function setTitle(piece: EditorPiece, title: string): EditorPiece {
  return { ...piece, title: title.slice(0, TITLE_MAX) };
}

export interface EditorRest {
  bar: number;
  start: number;
  /** "bar" is a whole-bar rest, whatever the meter. */
  length: EditorLength | 'bar';
}

/**
 * The rests of one hand: a whole bar with no note of the hand is one whole-bar rest; otherwise each gap is filled with
 * the longest plain rest that starts on a multiple of its own length and fits (a sixteenth or an eighth up to the next
 * beat). A pick-up and the short last bar after it get no whole-bar rest (the compiler refuses one there), and a pick-up
 * counts its multiples from the start of the whole bar it ends (core_09.AC30).
 */
export function restsFor(piece: EditorPiece, hand: EditorHand): EditorRest[] {
  const rests: EditorRest[] = [];
  for (let b = 0; b < piece.bars; b++) {
    const bar = barLength(piece, b);
    const offset = barOffset(piece, b);
    // in time order: the edit functions keep notes sorted, but an imported piece file may list them in any order
    const notes = piece.notes.filter((n) => n.hand === hand && n.bar === b).sort((x, y) => x.start - y.start);
    const placed = placedRests(piece).filter((r) => r.hand === hand && r.bar === b);
    if (notes.length === 0 && placed.length === 0 && bar === barTicks(piece)) {
      rests.push({ bar: b, start: 0, length: 'bar' });
      continue;
    }
    let at = 0;
    const fill = (until: number) => {
      while (at < until) {
        // no dotted rests are written: the plain ones read more easily
        const length = [...REST_LENGTHS].find((l) => (at + offset) % LENGTH_TICKS[l] === 0 && at + LENGTH_TICKS[l] <= until) ?? 'sixteenth';
        rests.push({ bar: b, start: at, length });
        at += LENGTH_TICKS[length];
      }
    };
    // a placed rest is written as it was placed; a chord's notes share one span
    const events = [...notes.map((n) => ({ ...n, rest: false })), ...placed.map((r) => ({ ...r, rest: true }))].sort((x, y) => x.start - y.start);
    for (const e of events) {
      fill(e.start);
      if (e.rest) rests.push({ bar: b, start: e.start, length: e.length });
      at = Math.max(at, e.start + LENGTH_TICKS[e.length]);
    }
    fill(bar);
  }
  return rests;
}
