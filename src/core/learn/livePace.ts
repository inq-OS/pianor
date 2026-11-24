import type { Chart } from '../chart';
import { fullBarTicks, MS_PER_MINUTE, msPerBeat } from '../chart';
import type { JudgeEvent } from '../judge/types';
import { paceMark, paceOff, type PaceMark } from '../layout/beat';
import { onsetsOf, runTempo } from './tempo';

/**
 * The live pace of a learning run (core_13 rule 9, ft_1_32 rule 8): the student's own pace, never a given one. The pace is the
 * run's own once three keys are played (its usual gap, as the run's evenness is judged), and before that the piece's
 * baseline tempo when it has one. Each key's gap is held against it: even, early or late, and far off when the run's verdict
 * would not count it as even. Pure.
 */
export interface LearnPace {
  /** Beats of a whole bar, counted in quarters as the click counts them. */
  beats: number;
  /** A quarter note at the student's pace, in ms; null before a pace is known. */
  beatMs: number | null;
  /** The latest key played: its tick in the chart played, its place in beats from its bar's first beat, its time, and its mark against the pace. */
  press: { tick: number; place: number; atMs: number; mark: PaceMark | null } | null;
}

/** A mark is placed at most this many beats from its dot, so a long stop does not send it far. */
const MARK_REACH = 1;

/** The beats of a whole bar of `chart`, in quarters (as `metronomeFor` counts them). */
function barBeats(chart: Chart): number {
  return Math.max(1, Math.round(fullBarTicks(chart.meterMap, chart.ppq) / chart.ppq));
}

/** Where `tick` falls in its bar, in quarters; a short first bar (a pick-up) is counted back from its end. */
function placeInBar(chart: Chart, bar: number, tick: number, beats: number): number {
  const span = chart.bars[bar];
  if (!span) return 0;
  const full = beats * chart.ppq;
  const short = span.endTick - span.startTick < full;
  return short && bar === 0 ? beats - (span.endTick - tick) / chart.ppq : (tick - span.startTick) / chart.ppq;
}

/**
 * The pace for a run so far: `chart` the chart the judge plays, `events` its events, `baselineBpm` the piece's
 * baseline tempo (null before the first measured run).
 */
export function learnPace(chart: Chart, events: readonly JudgeEvent[], baselineBpm: number | null): LearnPace {
  const beats = barBeats(chart);
  const points = onsetsOf(chart, events);
  const last = points[points.length - 1];
  const ownBpm = runTempo(chart, events)?.bpm ?? null;
  const bpm = ownBpm ?? (baselineBpm !== null && baselineBpm > 0 ? baselineBpm : null);
  const beatMs = bpm === null ? null : msPerBeat(bpm);
  if (!last) return { beats, beatMs, press: null };
  const place = placeInBar(chart, last.bar, last.tick, beats);
  const before = points[points.length - 2];
  let mark: PaceMark | null = null;
  if (bpm !== null && before && last.writtenMs > before.writtenMs && last.timeMs > before.timeMs) {
    // the pace as played against written time: 2 is half the written tempo
    const pace = chart.tempoMap[0]!.bpm / bpm;
    const off = paceOff(last.writtenMs - before.writtenMs, last.timeMs - before.timeMs, pace);
    const writtenBeats = (last.tick - before.tick) / chart.ppq;
    const shift = Math.max(-MARK_REACH, Math.min(MARK_REACH, off * writtenBeats));
    mark = { ...paceMark(off), at: place + shift };
  }
  return { beats, beatMs, press: { tick: last.tick, place, atMs: last.timeMs, mark } };
}

/**
 * The click at the student's pace in a learning run, when the player turned it on (core_13.AC6): from the first whole beat
 * after the latest key, on its bar's grid, at the pace of `learnPace`; started afresh at every key, so it follows the
 * student. null before a pace is known.
 */
export function paceClick(pace: LearnPace): { bpm: number; beatsPerBar: number; startAtMs: number; firstBeat: number } | null {
  const press = pace.press;
  if (pace.beatMs === null || !press) return null;
  const next = Math.floor(press.place + 1e-6) + 1;
  // beats a minute from ms a beat
  return { bpm: Math.round((MS_PER_MINUTE / pace.beatMs) * 100) / 100, beatsPerBar: pace.beats, startAtMs: press.atMs + (next - press.place) * pace.beatMs, firstBeat: next % pace.beats };
}
