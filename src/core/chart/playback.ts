import type { Chart } from './schema.ts';
import { tieChain, tieLinks } from './ties.ts';
import { tickToMs } from './time.ts';

/** One sounding note of a chart, with tied notes joined into one. Times are song time from the first tick, in ms. */
export interface PlaybackNote {
  midi: number;
  startMs: number;
  endMs: number;
  velocity: number;
  /** Chart notes this sound is made of (the first, then the notes tied into it), so a view can light them all. A grace note has none. */
  noteIndexes: number[];
  /** A grace note (d121): it is no chart note, so nothing on the staff lights for it. */
  grace?: true;
}

/** Computer playback sounds a grace note this long (ms, whatever the tempo) before its main note, up to that note's onset (d121). */
export const GRACE_LEAD_MS = 60;

/** The loudness of computer playback when none is given (MIDI velocity). */
export const PLAYBACK_VELOCITY = 80;

export interface PlaybackOptions {
  /** MIDI velocity for every note (grace notes too), 1 to 127. Default 80. */
  velocity?: number;
  /** 1 is the chart tempo, 0.5 half speed. Default 1. */
  tempoScale?: number;
}

/**
 * What a listener hears: every note of every track except click tracks, with ties joined, in time order.
 * Used to play a piece back (the preview tool now, accompaniment and demos later); it has no rules of its own.
 * Each grace note sounds `GRACE_LEAD_MS` before its main note and stops at that note's onset; the main note's time is as written.
 */
export function playbackNotes(chart: Chart, options: PlaybackOptions = {}): PlaybackNote[] {
  const { velocity = PLAYBACK_VELOCITY, tempoScale = 1 } = options;
  const heard = new Set(chart.tracks.filter((t) => t.role !== 'click').map((t) => t.id));
  const links = tieLinks(chart, heard);
  const candidates = chart.notes.flatMap((note, index) => (heard.has(note.track) ? [{ note, index }] : []));
  const holds = slurHolds(chart);

  const ms = (tick: number) => tickToMs(chart.tempoMap, tick, chart.ppq) / tempoScale;
  const notes: PlaybackNote[] = candidates
    .filter(({ index }) => !links.continuations.has(index))
    .map(({ note, index }) => {
      const noteIndexes = [index, ...tieChain(links, index)];
      const last = chart.notes[noteIndexes.at(-1)!]!;
      const endTick = Math.max(last.tick + last.dur, ...noteIndexes.map((i) => holds.get(i) ?? 0));
      return { midi: note.midi, startMs: ms(note.tick), endMs: ms(endTick), velocity, noteIndexes };
    });
  const graces: PlaybackNote[] = (chart.graces ?? [])
    .filter((g) => heard.has(g.track))
    .map((g) => ({ midi: g.pitch.midi, startMs: ms(g.tick) - GRACE_LEAD_MS, endMs: ms(g.tick), velocity, noteIndexes: [], grace: true }));
  return [...notes, ...graces].sort((a, b) => a.startMs - b.startMs || a.midi - b.midi);
}

/**
 * Per slurred note (all but the last onset of its slur), the onset of the next note of that slur (core_09.AC26).
 * Legato holds the sound until then.
 */
function slurHolds(chart: Chart): Map<number, number> {
  const holds = new Map<number, number>();
  for (const slur of chart.slurs ?? []) {
    const inSlur = chart.notes.flatMap((n, i) => (n.track === slur.track && n.voice === slur.voice && n.tick >= slur.startTick && n.tick <= slur.endTick ? [{ n, i }] : []));
    const onsets = [...new Set(inSlur.map(({ n }) => n.tick))].sort((a, b) => a - b);
    for (const { n, i } of inSlur) {
      const next = onsets.find((t) => t > n.tick);
      // a written rest between the notes is heard: the legato hold stops where the rest starts
      const rest = chart.rests.filter((r) => r.track === n.track && r.voice === n.voice && r.tick >= n.tick + n.dur).map((r) => r.tick).sort((a, b) => a - b)[0];
      if (next !== undefined) holds.set(i, rest !== undefined && rest < next ? rest : next);
    }
  }
  return holds;
}

/** Time from the start to the end of the last bar, so a final rest is heard too. */
export function playbackLengthMs(chart: Chart, options: PlaybackOptions = {}): number {
  const { tempoScale = 1 } = options;
  return tickToMs(chart.tempoMap, chart.bars.at(-1)!.endTick, chart.ppq) / tempoScale;
}

/** When the last of `notes` stops sounding (ms), 0 for none: the piece maker's Listen ends there, not after its empty bars. */
export function lastSoundMs(notes: readonly PlaybackNote[]): number {
  return notes.reduce((end, n) => Math.max(end, n.endMs), 0);
}

/** Chart notes sounding at `ms` (a note sounds from its start up to, not including, its end). */
export function soundingAt(notes: readonly PlaybackNote[], ms: number): number[] {
  return notes.filter((n) => n.startMs <= ms && ms < n.endMs).flatMap((n) => n.noteIndexes);
}
