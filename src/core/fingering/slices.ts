/**
 * From the notes of one hand to the slices the search works on (ft_1_30): notes struck at the same tick make one slice,
 * lowest key first. Keeps where each note went, so the found fingers can be written back. Pure.
 */
import type { Finger } from './costs';
import type { FingerSlice } from './search';

/** A note of one hand, in absolute ticks. */
export interface HandNote {
  midi: number;
  start: number;
  end: number;
  finger?: Finger | undefined;
  /** Held into the next note of the same key (not struck again). */
  tieNext?: boolean | undefined;
  /** The finger the level's hand position names for this note, if any. */
  preferred?: Finger | undefined;
}

export interface HandSlices {
  slices: FingerSlice[];
  /** For each note given, in the given order: its slice and its place among that slice's keys. */
  places: { slice: number; key: number }[];
}

export function handSlices(notes: readonly HandNote[]): HandSlices {
  const order = notes.map((_, i) => i).sort((a, b) => notes[a]!.start - notes[b]!.start || notes[a]!.midi - notes[b]!.midi);
  const slices: FingerSlice[] = [];
  const members: number[][] = [];
  for (const i of order) {
    const n = notes[i]!;
    const last = members.at(-1);
    if (last && notes[last[0]!]!.start === n.start) last.push(i);
    else members.push([i]);
  }
  const places = new Array<{ slice: number; key: number }>(notes.length);
  members.forEach((group, s) => {
    const prev = members[s - 1];
    group.forEach((i, key) => (places[i] = { slice: s, key }));
    const list = group.map((i) => notes[i]!);
    slices.push({
      pitches: list.map((n) => n.midi),
      start: list[0]!.start,
      end: Math.max(...list.map((n) => n.end)),
      fixed: list.map((n) => n.finger),
      preferred: list.map((n) => n.preferred),
      tied: list.map((n) => prev !== undefined && prev.some((p) => notes[p]!.tieNext === true && notes[p]!.midi === n.midi && notes[p]!.end === n.start)),
    });
  });
  return { slices, places };
}
