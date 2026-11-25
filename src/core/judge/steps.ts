import { tieChain, tieLinks, type Chart } from '../chart';

/** One thing the player must do: press a note, or all notes of a chord (same tick). */
export interface PlayStep {
  index: number;
  tick: number;
  bar: number;
  /** Chart note indices to press. */
  noteIndices: number[];
  /** Notes tied from these, which need no new press and finish with the step. */
  tiedNoteIndices: number[];
  /** Which hands play in this step, from the tracks' `hand`. A step with both RH and LH is a two-hand step. */
  hands: ('RH' | 'LH')[];
}

/** Steps for the play tracks of a chart, in time order. Accompaniment and click tracks are not played by the student. */
export function buildSteps(chart: Chart): PlayStep[] {
  const playTracks = new Set(chart.tracks.filter((t) => t.role === 'play').map((t) => t.id));
  const candidates = chart.notes.flatMap((note, index) => (playTracks.has(note.track) ? [{ note, index }] : []));
  const links = tieLinks(chart, playTracks);

  const byTick = new Map<number, number[]>();
  for (const { note, index } of candidates) {
    if (links.continuations.has(index)) continue;
    const list = byTick.get(note.tick) ?? [];
    list.push(index);
    byTick.set(note.tick, list);
  }

  return [...byTick.entries()]
    .sort(([a], [b]) => a - b)
    .map(([tick, noteIndices], index) => {
      const tied = noteIndices.flatMap((root) => tieChain(links, root));
      const hands = (['RH', 'LH'] as const).filter((hand) =>
        noteIndices.some((i) => chart.tracks.find((t) => t.id === chart.notes[i]!.track)?.hand === hand),
      );
      return { index, tick, bar: chart.notes[noteIndices[0]!]!.bar, noteIndices, tiedNoteIndices: tied, hands };
    });
}

/**
 * Per step, the pitches (MIDI) of the grace notes written before its notes (core_09.AC33, d121): a press of one of them
 * just before the step is neither right nor wrong, so the judge ignores it. Graces of tracks the student does not play are left out.
 */
export function stepGraces(chart: Chart, steps: readonly PlayStep[]): ReadonlySet<number>[] {
  return steps.map((step) => {
    const notes = step.noteIndices.map((i) => chart.notes[i]!);
    const graces = (chart.graces ?? []).filter((g) => g.tick === step.tick && notes.some((n) => n.track === g.track && n.voice === g.voice));
    return new Set(graces.map((g) => g.pitch.midi));
  });
}

/**
 * Per step, the pitches an ornament sign on its notes uses, the note's own and its neighbours (core_09.AC65, d306): the
 * ornament is optional, so a press of one of them while the step or the step after it is awaited is ignored, never wrong.
 */
export function stepOrnaments(chart: Chart, steps: readonly PlayStep[]): ReadonlySet<number>[] {
  return steps.map((step) => {
    const pitches = new Set<number>();
    for (const i of step.noteIndices) {
      const n = chart.notes[i]!;
      const sign = (chart.ornaments ?? []).find((o) => o.track === n.track && o.voice === n.voice && o.tick === n.tick);
      if (!sign) continue;
      pitches.add(n.midi);
      if (sign.upper) pitches.add(sign.upper.midi);
      if (sign.lower) pitches.add(sign.lower.midi);
    }
    return pitches;
  });
}
