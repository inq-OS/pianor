/**
 * Which notes of one staff are beamed together, and how (core_09.AC40, d155). Pure: the staff layout turns the plan into
 * glyphs. The rules follow common engraving (VexFlow's beam rules were the reference, d155, no code taken):
 *
 * - Eighths, dotted eighths and sixteenths (single notes or chords) are beamed in runs inside one beat of the meter's
 *   beat unit (a quarter in 2/4, 3/4 and 4/4), with no rest or longer note between them; a run of one keeps its flags.
 *   AX-3 provisional: beams group by the beat, so every beat the student counts is one visible group.
 * - One stem direction for the whole run: up when the mean of all its heads is below the middle line, down otherwise
 *   (the rule the beamed pair had before).
 * - A sixteenth carries a second beam: joined to a sixteenth beside it in the run, otherwise a short partial beam that
 *   points into the beat (right from a note on an eighth division of the beat, left from one after it, right from the
 *   run's first note, left from its last).
 * - A triplet (core_09.AC50, d163) is beamed by its written value (an eighth triplet as eighths) and is a group of its own:
 *   its notes join no note outside it, so an eighth triplet in one beat is one run.
 */
import { PPQ } from '../chart/time.ts';

/** One chord (or single note) of a staff, in time order: its tick, length and the staff positions of its heads. */
export interface BeamInput {
  tick: number;
  /** The played length, in ticks: where the next note starts. */
  dur: number;
  positions: readonly number[];
  /** The written length when it differs from `dur` (a triplet's member, core_09.AC50): it decides beams and flags. */
  written?: number;
  /** The tuplet it belongs to (any id), so the notes of one tuplet are a group of their own. */
  tuplet?: number;
}

/** A second beam between two neighbouring members of a run, or a partial one on one member pointing left or right. */
export type SecondaryBeam = { from: number; to: number } | { at: number; toward: 'left' | 'right' };

export interface BeamRun {
  /** Indices into the inputs, in time order; at least two. */
  members: number[];
  up: boolean;
  secondary: SecondaryBeam[];
}

/** The ticks of one beat of the meter: a quarter for x/4, a half for x/2 (the meters the compiler takes). */
export function beatTicksOf(den: number): number {
  return (4 * PPQ) / den;
}

const beamable = (dur: number) => dur === PPQ / 2 || dur === (3 * PPQ) / 4 || dur === PPQ / 4;
const hasSecondBeam = (dur: number) => dur === PPQ / 4;
const writtenOf = (input: BeamInput) => input.written ?? input.dur;

/**
 * The beamed runs of one staff. `barOf(tick)` gives the bar a tick is in as its start tick and the tick its beats count
 * from (a pick-up bar counts back from its end, so its notes fall on the beats they are played on).
 */
export function planBeams(inputs: readonly BeamInput[], beatTicks: number, barOf: (tick: number) => { index: number; beatOrigin: number }): BeamRun[] {
  const runs: number[][] = [];
  let run: number[] = [];
  let key = '';
  const close = () => {
    if (run.length > 1) runs.push(run);
    run = [];
    key = '';
  };
  inputs.forEach((input, i) => {
    if (!beamable(input.written ?? input.dur)) {
      close();
      return;
    }
    const bar = barOf(input.tick);
    const beat = Math.floor((input.tick - bar.beatOrigin) / beatTicks);
    const endBeat = Math.floor((input.tick + input.dur - 1 - bar.beatOrigin) / beatTicks);
    const here = `${bar.index}/${beat}/${input.tuplet ?? ''}`;
    const previous = run.length > 0 ? inputs[run[run.length - 1]!]! : null;
    const joins = previous !== null && here === key && previous.tick + previous.dur === input.tick && endBeat === beat;
    if (!joins) close();
    if (endBeat !== beat) return; // a note that runs over the beat stands alone, flagged
    run.push(i);
    key = here;
  });
  close();
  return runs.map((members) => {
    const heads = members.flatMap((m) => inputs[m]!.positions);
    const up = heads.reduce((sum, p) => sum + p, 0) / heads.length < 4;
    return { members, up, secondary: secondaryBeams(members, inputs, beatTicks, barOf) };
  });
}

function secondaryBeams(members: readonly number[], inputs: readonly BeamInput[], beatTicks: number, barOf: (tick: number) => { beatOrigin: number }): SecondaryBeam[] {
  const out: SecondaryBeam[] = [];
  members.forEach((m, k) => {
    if (!hasSecondBeam(writtenOf(inputs[m]!))) return;
    const next = members[k + 1];
    if (next !== undefined && hasSecondBeam(writtenOf(inputs[next]!))) out.push({ from: m, to: next });
    const prev = members[k - 1];
    const joinedBefore = prev !== undefined && hasSecondBeam(writtenOf(inputs[prev]!));
    const joinedAfter = next !== undefined && hasSecondBeam(writtenOf(inputs[next]!));
    if (joinedBefore || joinedAfter) return;
    const offset = (inputs[m]!.tick - barOf(inputs[m]!.tick).beatOrigin) % beatTicks;
    const toward = k === 0 ? 'right' : k === members.length - 1 ? 'left' : offset % (PPQ / 2) === 0 ? 'right' : 'left';
    out.push({ at: m, toward });
  });
  return out;
}
