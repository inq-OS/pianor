/**
 * The slur rules (core_09.AC30, d120), shared by the editor's edits (model.ts, bars.ts) and its output (abc.ts, chart.ts).
 * A slur is one curve over the notes of one hand, from its first onset to a later one. An onset is a bar and a start, so a
 * chord is slurred as a whole, and two slurs of one hand never share a stretch of time. Pure: it imports only types from
 * model.ts, so model.ts can use these rules without a runtime cycle.
 */
import { STEP_SEMITONES } from '../chart/pitch';
import { PPQ } from '../chart/time';
import type { EditorPiece, EditorSlur, Refusal, SlurOnset } from './model';
import { repeatsOf } from './repeats';

type SlurPiece = Pick<EditorPiece, 'beats' | 'bars' | 'notes' | 'repeats' | 'slurs'>;

/** The tick of an onset, from the start of the piece (480 a quarter). */
export function onsetTick(beats: number, onset: SlurOnset): number {
  return onset.bar * beats * PPQ + onset.start;
}

function onsetAt(beats: number, tick: number): SlurOnset {
  const bar = beats * PPQ;
  return { bar: Math.floor(tick / bar), start: tick % bar };
}

/** The first and the last tick of a slur. */
export function slurSpan(beats: number, slur: EditorSlur): [number, number] {
  return [onsetTick(beats, slur.from), onsetTick(beats, slur.to)];
}

/** Slurs in time order: by first onset, the right hand first when both start together (the order the file keeps). */
export function sortSlurs(beats: number, slurs: readonly EditorSlur[]): EditorSlur[] {
  return [...slurs].sort((a, b) => slurSpan(beats, a)[0] - slurSpan(beats, b)[0] || (a.hand === b.hand ? 0 : a.hand === 'RH' ? -1 : 1));
}

/**
 * The slurs that still hold after notes went or bars moved. A slur shrinks to the first and the last onset of its hand that
 * is still inside it: losing its end note shortens it, losing its start note moves its start forward. A slur left with fewer
 * than two onsets is dropped. The rule for every edit that removes a note or a bar (core_09.AC30).
 */
export function fittedSlurs(piece: SlurPiece): EditorSlur[] {
  const kept: EditorSlur[] = [];
  for (const slur of piece.slurs ?? []) {
    const [from, to] = slurSpan(piece.beats, slur);
    const ticks = [...new Set(piece.notes.filter((n) => n.hand === slur.hand).map((n) => onsetTick(piece.beats, n)))]
      .filter((t) => from <= t && t <= to)
      .sort((a, b) => a - b);
    if (ticks.length < 2) continue;
    kept.push({ hand: slur.hand, from: onsetAt(piece.beats, ticks[0]!), to: onsetAt(piece.beats, ticks.at(-1)!) });
  }
  return kept;
}

/**
 * Whether the slur can stand beside the others of its hand (`piece.slurs` are the others): both ends on a note of its hand,
 * the end later than the start, and no other slur of the hand sharing a stretch of time with it (a shared note included,
 * so the ABC marks are never ambiguous). Repeat signs are not looked at here: see `slurProblem`. The refusal, or null.
 */
export function slurShapeProblem(piece: SlurPiece, slur: EditorSlur): Refusal | null {
  const [from, to] = slurSpan(piece.beats, slur);
  const held = (o: SlurOnset) => piece.notes.some((n) => n.hand === slur.hand && n.bar === o.bar && n.start === o.start);
  if (to <= from || !held(slur.from) || !held(slur.to)) return 'slur-target';
  const overlaps = (piece.slurs ?? []).some((o) => {
    if (o.hand !== slur.hand) return false;
    const [a, b] = slurSpan(piece.beats, o);
    return a <= to && from <= b;
  });
  return overlaps ? 'slur-overlap' : null;
}

/**
 * Whether the notes under the slur are all one pitch: that curve is a tie, and the ABC compiler refuses it. Kept out of
 * `slurShapeProblem` because a pitch edit can make a stored slur so, and the piece file must still open (like repeats).
 */
function slurPitchProblem(piece: SlurPiece, slur: EditorSlur): Refusal | null {
  const [from, to] = slurSpan(piece.beats, slur);
  const under = piece.notes.filter((n) => n.hand === slur.hand && onsetTick(piece.beats, n) >= from && onsetTick(piece.beats, n) <= to);
  const pitchSets = new Set<string>();
  for (const t of new Set(under.map((n) => onsetTick(piece.beats, n)))) {
    pitchSets.add(under.filter((n) => onsetTick(piece.beats, n) === t).map((n) => (n.octave + 1) * 12 + STEP_SEMITONES[n.step] + n.alter).sort((a, b) => a - b).join(','));
  }
  return pitchSets.size < 2 ? 'slur-pitch' : null;
}

/** Whether a repeat sign falls inside the slur: the ABC has no slur across one, so the editor refuses it (d120). */
function crossesRepeat(piece: SlurPiece, slur: EditorSlur): boolean {
  // a repeat starts at the boundary before its start bar and ends at the boundary after its end bar
  return repeatsOf(piece).some((r) => [r.startBar, r.endBar + 1].some((boundary) => slur.from.bar < boundary && boundary <= slur.to.bar));
}

/** Whether the slur can be drawn in this piece: its shape, and no repeat sign inside it. The refusal, or null. */
export function slurProblem(piece: SlurPiece, slur: EditorSlur): Refusal | null {
  return slurShapeProblem(piece, slur) ?? (crossesRepeat(piece, slur) ? 'slur-repeat' : null) ?? slurPitchProblem(piece, slur);
}

/**
 * The slurs the ABC and the chart write: the stored slurs that still hold (fitted to the notes, no repeat sign inside, no
 * overlap), in time order. A stored slur that fails is not written, as a tie whose target went is not. Pure.
 */
export function slursOf(piece: SlurPiece): EditorSlur[] {
  const written: EditorSlur[] = [];
  for (const slur of sortSlurs(piece.beats, fittedSlurs(piece))) {
    if (!slurProblem({ ...piece, slurs: written }, slur)) written.push(slur);
  }
  return written;
}
