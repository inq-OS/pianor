/**
 * Bar-level editing of the piece editor: select bars, copy them, cut them, paste or insert them, repeat them and
 * move their notes. Pure, like model.ts: every edit returns a new piece or a reason it was refused, and one call is one
 * undo step for the screen. A bar is the smallest unit; both hands move together.
 *
 * Insert never wastes space: empty bars at the end of the piece are used up first, so a piece only grows when its real
 * content needs the room (`insertBars`). A cut takes its bars out, so the later bars move back.
 */
import { BARS_MIN, KEY_HIGH, KEY_LOW, MAX_BARS, handsOf, keepInBars, keyAlterOf, wholeFirstBar, placedRests, settleSlurs, soundingMidi, stepped, withRests, withSlurs } from './model';
import type { Edit, EditorHand, EditorNote, EditorPiece, EditorSlur, PlacedRest, Refusal, SlurOnset } from './model';
import { fittedSlurs, slurProblem } from './slurRules';

/** Bars `from` to `to`, both included, counted from 0. */
export interface BarRange {
  from: number;
  to: number;
}

/**
 * Copied bars: their notes and placed rests, with bar numbers counted from the first copied bar (0). Nothing else of the
 * piece is in it, so a clip can be pasted anywhere, in this piece or another one of the same meter.
 */
export interface Clip {
  beats: EditorPiece['beats'];
  hands: EditorHand[];
  bars: number;
  notes: EditorNote[];
  rests: PlacedRest[];
  /** The slurs copied whole (both ends in the bars), with their bar numbers counted from the first copied bar (core_09.AC30). */
  slurs?: EditorSlur[];
}

const refuse = (reason: Refusal): Edit => ({ ok: false, reason });

/** Whether the range names bars of the piece, from before to after. */
export function isValidRange(piece: Pick<EditorPiece, 'bars'>, range: BarRange): boolean {
  return Number.isInteger(range.from) && Number.isInteger(range.to) && range.from >= 0 && range.from <= range.to && range.to < piece.bars;
}

const inRange = (bar: number, range: BarRange) => bar >= range.from && bar <= range.to;

/**
 * The bars of the range, with their notes and rests moved to start at bar 0. The piece is not changed. A slur is copied
 * only when both its ends are in the range: a slur that reaches out of the bars stays behind (core_09.AC30).
 */
export function copyBars(piece: EditorPiece, range: BarRange): Clip {
  const slurs = (piece.slurs ?? [])
    .filter((s) => inRange(s.from.bar, range) && inRange(s.to.bar, range))
    .map((s) => ({ hand: s.hand, from: { bar: s.from.bar - range.from, start: s.from.start }, to: { bar: s.to.bar - range.from, start: s.to.start } }));
  return {
    beats: piece.beats,
    hands: handsOf(piece),
    bars: range.to - range.from + 1,
    notes: piece.notes.filter((n) => inRange(n.bar, range)).map((n) => ({ ...n, bar: n.bar - range.from })),
    rests: placedRests(piece).filter((r) => inRange(r.bar, range)).map((r) => ({ ...r, bar: r.bar - range.from })),
    ...(slurs.length > 0 ? { slurs } : {}),
  };
}

/**
 * Cut: the range is copied, then taken out, so the later bars move back and the piece gets shorter, never below
 * BARS_MIN bars. The clip is what a paste brings back.
 */
export function cutBars(piece: EditorPiece, range: BarRange): { clip: Clip; piece: EditorPiece } {
  return { clip: copyBars(piece, range), piece: removeBars(piece, range) };
}

/**
 * The bars after `range` move back by its length; the range's own notes and rests go, and so does a repeat that starts or
 * ends in it. Used by cut and paste over. A slur that
 * held a note of the range shrinks to the notes that stay, as `fittedSlurs` says, before the bars move (core_09.AC30).
 */
function removeBars(whole: EditorPiece, range: BarRange): EditorPiece {
  // a cut pick-up leaves a piece without one (core_09.AC30)
  const piece = range.from === 0 ? wholeFirstBar(whole) : whole;
  const count = range.to - range.from + 1;
  const shift = (bar: number) => (bar > range.to ? bar - count : bar);
  const notes = piece.notes.filter((n) => !inRange(n.bar, range));
  const rests = placedRests(piece).filter((r) => !inRange(r.bar, range));
  const slurs = fittedSlurs({ ...piece, notes }).map((s) => ({ hand: s.hand, from: { bar: shift(s.from.bar), start: s.from.start }, to: { bar: shift(s.to.bar), start: s.to.start } }));
  const moved = { ...piece, bars: Math.max(BARS_MIN, piece.bars - count), notes: notes.map((n) => ({ ...n, bar: shift(n.bar) })) };
  const kept = movedRepeats(piece, shift, (r) => !inRange(r.startBar, range) && !inRange(r.endBar, range));
  // a cut last bar makes another bar the short one (core_09.AC30)
  return keepInBars(withSlurs(withRests({ ...moved, ...kept }, rests.map((r) => ({ ...r, bar: shift(r.bar) }))), slurs));
}

/** The range empties: its notes and rests go, and the bars stay. Slurs shrink or go with their notes (core_09.AC30). */
export function clearBars(piece: EditorPiece, range: BarRange): EditorPiece {
  return settleSlurs(withRests(
    { ...piece, notes: piece.notes.filter((n) => !inRange(n.bar, range)) },
    placedRests(piece).filter((r) => !inRange(r.bar, range)),
  ));
}

/** The piece's repeat signs moved by `shift` (a repeat around an insert gets longer), without the ones `keep` drops; none stays none. */
function movedRepeats(piece: EditorPiece, shift: (bar: number) => number, keep: (r: { startBar: number; endBar: number }) => boolean = () => true): Pick<EditorPiece, 'repeats'> {
  if (!piece.repeats) return {};
  return { repeats: piece.repeats.filter(keep).map((r) => ({ startBar: shift(r.startBar), endBar: shift(r.endBar) })) };
}

/** The last bar with a note or a placed rest, or -1 for an empty piece. */
function lastContentBar(notes: EditorNote[], rests: PlacedRest[]): number {
  return Math.max(-1, ...notes.map((n) => n.bar), ...rests.map((r) => r.bar));
}

/**
 * Inserts the clip `times` times in a row before bar `at` (at the piece's end when `at` is its bar count). Bars after it
 * move forward. The piece gets as long as its content needs, but never shorter than it was: empty bars at the end are
 * used up before the piece grows.
 */
export function insertBars(before: EditorPiece, at: number, clip: Clip, times = 1): Edit {
  // bars put in before a pick-up make it a whole bar (core_09.AC30)
  const piece = at === 0 ? wholeFirstBar(before) : before;
  if (clip.beats !== piece.beats) return refuse('meter');
  const hands = handsOf(piece);
  if (clip.notes.some((n) => !hands.includes(n.hand)) || clip.rests.some((r) => !hands.includes(r.hand))) return refuse('hand');
  if (!Number.isInteger(at) || at < 0 || at > piece.bars) return refuse('bar');
  const count = clip.bars * times;
  const shift = (bar: number) => (bar >= at ? bar + count : bar);
  const copies = Array.from({ length: times }, (_, t) => t * clip.bars);
  const notes = [
    ...piece.notes.map((n) => ({ ...n, bar: shift(n.bar) })),
    ...copies.flatMap((offset) => clip.notes.map((n) => ({ ...n, bar: at + offset + n.bar }))),
  ];
  const rests = [
    ...placedRests(piece).map((r) => ({ ...r, bar: shift(r.bar) })),
    ...copies.flatMap((offset) => clip.rests.map((r) => ({ ...r, bar: at + offset + r.bar }))),
  ];
  // a moved repeat keeps its bars: the piece grows for it like for a note
  const repeats = movedRepeats(piece, shift);
  const lastRepeatBar = Math.max(-1, ...(repeats.repeats ?? []).map((r) => r.endBar));
  const bars = Math.max(piece.bars, lastContentBar(notes, rests) + 1, lastRepeatBar + 1);
  if (bars > MAX_BARS) return refuse('bars-full');
  // the piece's slurs move with their notes; a copied slur is pasted only where it fits (no shared time, no repeat sign), so
  // a paste never breaks a slur that was there, and the notes are always pasted (core_09.AC30)
  const shiftOnset = (o: SlurOnset): SlurOnset => ({ bar: shift(o.bar), start: o.start });
  let next = withSlurs(withRests({ ...piece, bars, notes, ...repeats }, rests), (piece.slurs ?? []).map((s) => ({ hand: s.hand, from: shiftOnset(s.from), to: shiftOnset(s.to) })));
  for (const offset of copies) {
    for (const s of clip.slurs ?? []) {
      const slur: EditorSlur = { hand: s.hand, from: { bar: at + offset + s.from.bar, start: s.from.start }, to: { bar: at + offset + s.to.bar, start: s.to.start } };
      if (!slurProblem(next, slur)) next = withSlurs(next, [...(next.slurs ?? []), slur]);
    }
  }
  // bars put in after the short last bar make another bar the short one (core_09.AC30)
  return { ok: true, piece: keepInBars(next) };
}

/**
 * Pasted over: the range's bars are replaced by the clip (removed, then inserted at the range's start). The piece keeps
 * its length, so pasting over empty bars does not make it shorter.
 */
export function replaceBars(piece: EditorPiece, range: BarRange, clip: Clip): Edit {
  const inserted = insertBars(removeBars(piece, range), range.from, clip);
  if (!inserted.ok) return inserted;
  // the same number of bars in as out: no bar moves, so the repeat signs stay where they were
  const same = clip.bars === range.to - range.from + 1 && piece.repeats ? { repeats: piece.repeats } : {};
  return { ok: true, piece: { ...inserted.piece, bars: Math.max(inserted.piece.bars, piece.bars), ...same } };
}

/**
 * One staff step (`unit` "step", as the wheel and the arrows do, with the key's spelling) or one octave, up or down, for
 * every note of the range. All or nothing: a note that would leave the keyboard refuses the whole move, so the selection
 * keeps its shape. A note's pre-note moves with it by the same unit, and refuses the move the same way (core_09.AC35).
 */
export function moveBars(piece: EditorPiece, range: BarRange, direction: 1 | -1, unit: 'step' | 'octave'): Edit {
  const moved: EditorNote[] = [];
  for (const note of piece.notes) {
    if (!inRange(note.bar, range)) {
      moved.push(note);
      continue;
    }
    const next = unit === 'step' ? stepped(note, direction) : { step: note.step, octave: note.octave + direction };
    const candidate: EditorNote = { ...note, ...next, alter: unit === 'step' ? keyAlterOf(piece, next.step) : note.alter };
    if (candidate.octave < -1 || candidate.octave > 9) return refuse('range');
    const midi = soundingMidi(candidate);
    if (midi < KEY_LOW || midi > KEY_HIGH) return refuse('range');
    if (note.grace) {
      // the pre-note moves with its note by the same unit, so the ornament keeps its shape (core_09.AC35)
      const grace = note.grace;
      const gNext = unit === 'step' ? stepped(grace, direction) : { step: grace.step, octave: grace.octave + direction };
      const gMoved = { ...grace, ...gNext, alter: unit === 'step' ? keyAlterOf(piece, gNext.step) : grace.alter };
      const gMidi = soundingMidi(gMoved);
      if (gMoved.octave < -1 || gMoved.octave > 9 || gMidi < KEY_LOW || gMidi > KEY_HIGH) return refuse('range');
      // a step move gives both the key's alter, so a pre-note on its note's letter can land on the note's own key
      if (gMidi === midi) return refuse('grace-pitch');
      candidate.grace = gMoved;
    }
    moved.push(candidate);
  }
  const seen = new Set<string>();
  for (const n of moved) {
    const key = `${n.hand}|${n.bar}|${n.start}|${n.step}|${n.octave}`;
    if (seen.has(key)) return refuse('duplicate');
    seen.add(key);
  }
  return { ok: true, piece: { ...piece, notes: moved } };
}

/**
 * Where a paste goes. After a fresh copy or paste, with the selection still on those bars, the clip is inserted
 * right after the selection, so repeated pastes build a piece up. With another selection the selected bars are replaced.
 * With none, the clip goes before the last clicked bar, or at the end when nothing was clicked. `range` is the pasted
 * bars, which become the selection.
 */
export function pasteAt(
  piece: EditorPiece,
  selection: BarRange | null,
  fresh: boolean,
  lastClicked: number | null,
  clip: Clip,
): { edit: Edit; range: BarRange | null } {
  let edit: Edit;
  let from: number;
  if (selection && fresh) {
    from = selection.to + 1;
    edit = insertBars(piece, from, clip, 1);
  } else if (selection) {
    from = selection.from;
    edit = replaceBars(piece, selection, clip);
  } else {
    from = lastClicked ?? piece.bars;
    edit = insertBars(piece, from, clip, 1);
  }
  return { edit, range: edit.ok ? { from, to: from + clip.bars - 1 } : null };
}

/**
 * Empty bars put in before bar `at`: the later bars move forward, using up the empty bars at the
 * end first, so the piece only gets longer when its content needs the room. Refused past MAX_BARS.
 */
export function insertBlankBars(piece: EditorPiece, at: number, count: number): Edit {
  return insertBars(piece, at, { beats: piece.beats, hands: handsOf(piece), bars: count, notes: [], rests: [] });
}
