/** Tick math. Core time is in ticks (PPQ per quarter note), never frames. */

export const PPQ = 480;

/** Ticks of each note length the project names, longest first: the one table of note values. */
export const NOTE_TICKS = {
  whole: 4 * PPQ,
  dottedHalf: 3 * PPQ,
  half: 2 * PPQ,
  dottedQuarter: 1.5 * PPQ,
  quarter: PPQ,
  dottedEighth: 0.75 * PPQ,
  eighth: PPQ / 2,
  sixteenth: PPQ / 4,
} as const;
export type NoteLength = keyof typeof NOTE_TICKS;

/** The name of the length `ticks` long among `allowed` (all named lengths by default), or undefined. */
export function noteLengthOf<L extends NoteLength>(ticks: number, allowed: readonly L[] = Object.keys(NOTE_TICKS) as L[]): L | undefined {
  return allowed.find((length) => NOTE_TICKS[length] === ticks);
}

/** Milliseconds in a minute: BPM is beats per minute, so a beat lasts `MS_PER_MINUTE / bpm`. */
export const MS_PER_MINUTE = 60_000;
/** Milliseconds in a second: the one place the ms-to-seconds factor is written. */
export const MS_PER_SECOND = 1000;

/**
 * The tempo range of a piece, in quarter-note beats per minute: the one source of truth for every BPM limit. The editor's BPM
 * field and the click keys use it as it is; the metronome's safety clamp is worked out from it (`METRONOME_BPM`).
 * Raised from 200 to 500. Frozen migration schemas keep their own old literals on purpose (d064).
 */
export const PIECE_BPM = { min: 30, max: 500 } as const;

/** Milliseconds between quarter-note beats at `bpm`. */
export function msPerBeat(bpm: number): number {
  return MS_PER_MINUTE / bpm;
}

export interface Meter {
  readonly num: number;
  readonly den: number;
}

export interface MeterChange extends Meter {
  readonly tick: number;
}

export interface TempoChange {
  readonly tick: number;
  readonly bpm: number;
}

export interface BarSpan {
  readonly index: number;
  readonly startTick: number;
  readonly endTick: number;
}

/** Length of one bar in ticks. 4/4 is 1920, 3/4 is 1440, 6/8 is 1440. */
export function ticksPerBar(meter: Meter, ppq = PPQ): number {
  return (ppq * 4 * meter.num) / meter.den;
}

/**
 * The length of one whole bar of a piece, from its (first) meter, never from `bars[0]`, which is short when the piece starts
 * with a pick-up (d120, core_09.AC22).
 */
export function fullBarTicks(meterMap: readonly MeterChange[], ppq = PPQ): number {
  const meter = meterMap[0];
  if (!meter) throw new Error('meterMap must not be empty');
  return ticksPerBar(meter, ppq);
}

/** The length of a piece's pick-up in ticks: a first bar shorter than a whole bar, when more bars follow; else 0 (d120, core_09.AC22). */
export function pickupTicks(bars: readonly BarSpan[], meterMap: readonly MeterChange[], ppq = PPQ): number {
  const first = bars[0];
  if (!first || bars.length < 2) return 0;
  const length = first.endTick - first.startTick;
  return length < fullBarTicks(meterMap, ppq) ? length : 0;
}

/**
 * The number a printed score gives a piece's first bar (d120, core_09.AC25): 0 for a pick-up, so the first full bar is 1,
 * else 1. Every bar number shown to people is `printedBar`, never the chart's 0-based index plus one.
 */
export function firstPrintedBar(chart: { readonly bars: readonly BarSpan[]; readonly meterMap: readonly MeterChange[]; readonly ppq?: number }): 0 | 1 {
  return pickupTicks(chart.bars, chart.meterMap, chart.ppq ?? PPQ) > 0 ? 0 : 1;
}

/** The printed number of chart bar `index` (0-based): the index itself with a pick-up, else the index plus one (core_09.AC25). */
export function printedBar(chart: Parameters<typeof firstPrintedBar>[0], index: number): number {
  return index + firstPrintedBar(chart);
}

/** Bars (0-based index) for `barCount` bars following a meter map. Meter changes must fall on bar lines. */
export function buildBars(meterMap: readonly MeterChange[], barCount: number, ppq = PPQ): BarSpan[] {
  const bars: BarSpan[] = [];
  let tick = 0;
  let meterIndex = 0;
  for (let index = 0; index < barCount; index++) {
    while (meterIndex + 1 < meterMap.length && meterMap[meterIndex + 1]!.tick <= tick) meterIndex++;
    const meter = meterMap[meterIndex];
    if (!meter) throw new Error('meterMap must not be empty');
    const endTick = tick + ticksPerBar(meter, ppq);
    bars.push({ index, startTick: tick, endTick });
    tick = endTick;
  }
  return bars;
}

/** Index of the bar containing `tick`, or -1 when outside all bars. Binary search; `bars` must be sorted. */
export function barIndexAtTick(bars: readonly BarSpan[], tick: number): number {
  let lo = 0;
  let hi = bars.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const bar = bars[mid]!;
    if (tick < bar.startTick) hi = mid - 1;
    else if (tick >= bar.endTick) lo = mid + 1;
    else return mid;
  }
  return -1;
}

/** Milliseconds from tick 0 to `tick`, following the tempo map (bpm counts quarter notes). */
export function tickToMs(tempoMap: readonly TempoChange[], tick: number, ppq = PPQ): number {
  if (tempoMap.length === 0) throw new Error('tempoMap must not be empty');
  let ms = 0;
  for (let i = 0; i < tempoMap.length; i++) {
    const seg = tempoMap[i]!;
    if (seg.tick >= tick) break;
    const next = tempoMap[i + 1];
    const end = next && next.tick < tick ? next.tick : tick;
    ms += ((end - seg.tick) * MS_PER_MINUTE) / (seg.bpm * ppq);
  }
  return ms;
}

/** Inverse of `tickToMs`, rounded to the nearest tick. */
export function msToTick(tempoMap: readonly TempoChange[], ms: number, ppq = PPQ): number {
  if (tempoMap.length === 0) throw new Error('tempoMap must not be empty');
  let elapsed = 0;
  for (let i = 0; i < tempoMap.length; i++) {
    const seg = tempoMap[i]!;
    const msPerTick = MS_PER_MINUTE / (seg.bpm * ppq);
    const next = tempoMap[i + 1];
    const segMs = next ? (next.tick - seg.tick) * msPerTick : Infinity;
    if (ms - elapsed < segMs) return Math.round(seg.tick + (ms - elapsed) / msPerTick);
    elapsed += segMs;
  }
  throw new Error('unreachable');
}
