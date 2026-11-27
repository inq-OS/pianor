import type { Chart } from '../chart';
import { MS_PER_MINUTE, fullBarTicks, msPerBeat, msToTick, pickupTicks, tickToMs } from '../chart';

export interface TransportOptions {
  /** Speed as a percent of the piece's own tempo; 100 is as written, more than 100 is faster. Default 100. */
  tempoPercent?: number;
  /** Whole bars counted in before tick 0, and with a pick-up also the beats it lacks (core_09.AC23). Default 1. */
  countInBars?: number;
}

/** What the browser metronome needs to click along (`Metronome.start`). */
export interface MetronomePlan {
  bpm: number;
  beatsPerBar: number;
  startAtMs: number;
  /** The number of the first click, counted from the start, when the click joins later (`metronomeFrom`); 0 when left out. */
  firstBeat?: number;
  /** Click only this many beats, then stop (the count-in only); every beat when left out. */
  beats?: number;
  /** Beats (their clock times) that are not clicked: a grace note sounds there instead (d121). Absent: every beat clicks. */
  silentAtMs?: number[];
}

/** A grace note the count-in sounds in place of its last tick (d121): its pitch and its clock times. */
export interface CountInGrace {
  midi: number;
  atMs: number;
  endMs: number;
}

/** The clicks for a chart at a tempo percent: quarter-note beats at the first tempo of the piece, and the beats in a bar. */
export function metronomeFor(chart: Chart, tempoPercent = 100): { bpm: number; beatsPerBar: number } {
  // a whole bar, not bars[0], which is short in a piece with a pick-up (core_09.AC22)
  return { bpm: (chart.tempoMap[0]!.bpm * tempoPercent) / 100, beatsPerBar: Math.max(1, Math.round(fullBarTicks(chart.meterMap, chart.ppq) / chart.ppq)) };
}

/**
 * Song time for the tempo modes (`docs/features/core_01-tempo-mode.md`): where on the clock each tick of a chart falls
 * once the player has started. Pure: it is told the clock's time and never reads a clock itself.
 * Starting is a moment on the audio clock (the first key press, or a Start button); then one bar is counted in and tick 0
 * follows. The tempo percent stretches or squeezes every distance, count-in included.
 * A piece with a pick-up (d120, core_09.AC23) is counted in from a downbeat: the whole bars and then the beats the pick-up
 * lacks, so a one-beat pick-up in 4/4 is the fourth beat of the count. The click's grid always has a bar line where the
 * pick-up's whole bar would start, also with no count-in, so beat 1 of every full bar is the accented click.
 */
export class Transport {
  readonly tempoPercent: number;
  readonly countInBars: number;
  private startedAtMs: number | null = null;
  /** The following clock (core_01.AC12): where the piece was last pinned to the clock; null while it runs as started. */
  private pin: { chartMs: number; atMs: number } | null = null;
  private rateNow = 1;

  constructor(private readonly chart: Chart, options: TransportOptions = {}) {
    const percent = options.tempoPercent ?? 100;
    if (!(percent > 0) || !Number.isFinite(percent)) throw new Error('tempoPercent must be a positive number');
    this.tempoPercent = percent;
    this.countInBars = Math.max(0, Math.floor(options.countInBars ?? 1));
  }

  get started(): boolean {
    return this.startedAtMs !== null;
  }

  /** Begin at clock time `atMs`. Returns false (and changes nothing) when it has already begun. */
  start(atMs: number): boolean {
    if (this.startedAtMs !== null) return false;
    this.startedAtMs = atMs;
    return true;
  }

  /**
   * Begin so that `tick` sounds at clock time `atMs` (core_01.AC10: the first note starts the piece where it was played, a
   * pickup keeping its beat). Returns false (and changes nothing) when it has already begun.
   */
  startAtTick(tick: number, atMs: number): boolean {
    return this.start(atMs - this.countInMs - tickToMs(this.chart.tempoMap, tick, this.chart.ppq) / this.speed);
  }

  reset(): void {
    this.startedAtMs = null;
    this.pin = null;
    this.rateNow = 1;
  }

  /** How fast the piece runs against its tempo percent: 1 until the clock follows the player (`follow`). */
  get rate(): number {
    return this.rateNow;
  }

  /**
   * The following clock (core_01.AC12): from now on `tick` sounds at clock time `atMs`, and the piece runs on from there at
   * `rate` times its tempo percent. Every other tick moves with it, the ones already past too, so the playhead and the
   * windows of the judge stay on one line. The count-in and the click's grid do not move. Nothing before the start.
   */
  follow(tick: number, atMs: number, rate = this.rateNow): void {
    if (this.startedAtMs === null) return;
    if (!(rate > 0) || !Number.isFinite(rate) || !Number.isFinite(atMs)) throw new Error('follow needs a clock time and a positive rate');
    this.pin = { chartMs: tickToMs(this.chart.tempoMap, tick, this.chart.ppq), atMs };
    this.rateNow = rate;
  }

  /** Length of the count-in on the clock, in ms. */
  get countInMs(): number {
    return this.ticksToMs(this.countInTicks);
  }

  /** Clock time of tick 0, or null before the start. */
  get songStartMs(): number | null {
    return this.startedAtMs === null ? null : this.startedAtMs + this.countInMs;
  }

  /** Clock time at which `tick` sounds, or null before the start. */
  timeOfTick(tick: number): number | null {
    const start = this.songStartMs;
    if (start === null) return null;
    const chartMs = tickToMs(this.chart.tempoMap, tick, this.chart.ppq);
    return this.pin ? this.pin.atMs + (chartMs - this.pin.chartMs) / (this.speed * this.rateNow) : start + chartMs / this.speed;
  }

  /** Clock time at the end of the chart's last bar (where a looped section's next lap begins), or null before the start. */
  get endMs(): number | null {
    return this.timeOfTick(this.chart.bars[this.chart.bars.length - 1]!.endTick);
  }

  /** The tick under clock time `timeMs`: negative during the count-in, null before the start. */
  tickAt(timeMs: number): number | null {
    const start = this.songStartMs;
    if (start === null) return null;
    const chartMs = this.pin ? this.pin.chartMs + (timeMs - this.pin.atMs) * this.speed * this.rateNow : (timeMs - start) * this.speed;
    if (chartMs >= 0) return msToTick(this.chart.tempoMap, chartMs, this.chart.ppq);
    return Math.round((chartMs * this.firstBpm * this.chart.ppq) / MS_PER_MINUTE);
  }

  /**
   * Which beat of the count-in `timeMs` is in (0-based), how many beats it has (a part beat before a pick-up that starts off
   * the beat counts as one) and which beat of its bar that is (0-based: what is said, 1 2 3 4 | 1 2 3); null outside the count-in.
   */
  countIn(timeMs: number): { beat: number; beats: number; inBar: number } | null {
    const started = this.startedAtMs;
    if (started === null || this.countInBars === 0) return null;
    const into = timeMs - started;
    if (into < 0 || into >= this.countInMs) return null;
    const beat = Math.floor(into / msPerBeat(this.firstBpm * this.speed));
    return { beat, beats: this.countInBeats, inBar: beat % this.beatsPerBar };
  }

  /**
   * The metronome that clicks the count-in and the piece (or with `countInOnly` the count-in alone), or null before the start.
   * When the count-in ends on a grace note (`countInGraces`), that beat is silent: the grace takes its place.
   */
  metronome(options: { countInOnly?: boolean } = {}): MetronomePlan | null {
    if (this.startedAtMs === null) return null;
    // the grid starts on a downbeat: the count-in's start, or with no count-in the bar line before a pick-up (core_09.AC23)
    const gridStartMs = this.countInBars === 0 ? this.startedAtMs - this.ticksToMs(this.leadTicks) : this.startedAtMs;
    const plan: MetronomePlan = { bpm: this.firstBpm * this.speed, beatsPerBar: this.beatsPerBar, startAtMs: gridStartMs };
    if (options.countInOnly) plan.beats = this.countInBeats;
    const graces = this.countInGraces();
    if (graces.length > 0) plan.silentAtMs = [graces[0]!.atMs];
    return plan;
  }

  /**
   * The grace notes of the piece's first note (d121, core_09.AC34): when it starts the piece on tick 0, its grace
   * is the count-in's last beat (in 4/4: tick, tick, tick, grace, then bar 1), sounding from that beat to the first note.
   * Empty before the start, with no count-in, and when the first note has no grace. AX-3 provisional: the grace takes the
   * last beat's place instead of adding a beat. A grace group (core_09.AC61) plays its notes one after another in that beat.
   */
  countInGraces(): CountInGrace[] {
    const start = this.songStartMs;
    if (start === null || this.countInBars === 0) return [];
    const playTracks = new Set(this.chart.tracks.filter((t) => t.role === 'play').map((t) => t.id));
    const played = this.chart.notes.filter((n) => playTracks.has(n.track));
    if (played.length === 0 || Math.min(...played.map((n) => n.tick)) !== 0) return [];
    // the last click of the count-in on the metronome's own grid, so the two always agree
    const atMs = this.startedAtMs! + (this.countInBeats - 1) * msPerBeat(this.firstBpm * this.speed);
    // a grace group shares that beat out evenly, in its written order (core_09.AC61)
    const firsts = (this.chart.graces ?? []).filter((g) => g.tick === 0 && playTracks.has(g.track));
    return firsts.map((g) => {
      const group = firsts.filter((o) => o.track === g.track && o.voice === g.voice);
      const slot = (start - atMs) / group.length;
      const k = group.indexOf(g);
      return { midi: g.pitch.midi, atMs: atMs + k * slot, endMs: k === group.length - 1 ? start : atMs + (k + 1) * slot };
    });
  }

  /** The time of the first click at or after `nowMs` on the beat grid of the count-in, or null before the start: for a click switched on mid-piece. */
  nextClickMs(nowMs: number): number | null {
    const plan = this.metronome();
    if (plan === null) return null;
    const beatMs = msPerBeat(plan.bpm);
    return plan.startAtMs + Math.max(0, Math.ceil((nowMs - plan.startAtMs) / beatMs)) * beatMs;
  }

  /**
   * The metronome joining at the first beat at or after `nowMs` (a click switched on mid-piece, or a piece started by its
   * first note, core_01.AC10, whose own beat is already past): that beat's time and number, so the bar's first beat is
   * still the accented one. Null before the start.
   */
  metronomeFrom(nowMs: number): MetronomePlan | null {
    const plan = this.metronome();
    const startAtMs = this.nextClickMs(nowMs);
    if (plan === null || startAtMs === null) return null;
    const firstBeat = Math.round((startAtMs - plan.startAtMs) / msPerBeat(plan.bpm));
    return { ...plan, startAtMs, ...(firstBeat > 0 ? { firstBeat } : {}) };
  }

  private get speed(): number {
    return this.tempoPercent / 100;
  }

  private get firstBpm(): number {
    return this.chart.tempoMap[0]!.bpm;
  }

  /** A whole bar (core_09.AC22): the count-in is whole bars even when the piece starts with a pick-up. */
  private get barTicks(): number {
    return fullBarTicks(this.chart.meterMap, this.chart.ppq);
  }

  private get beatsPerBar(): number {
    return Math.max(1, Math.round(this.barTicks / this.chart.ppq));
  }

  /** The ticks from the bar line before a pick-up to tick 0: the beats the pick-up lacks; 0 without a pick-up. */
  private get leadTicks(): number {
    const pickup = pickupTicks(this.chart.bars, this.chart.meterMap, this.chart.ppq);
    return pickup > 0 ? this.barTicks - pickup : 0;
  }

  /** Whole bars, then the beats a pick-up lacks (core_09.AC23); none at all with no count-in bars. */
  private get countInTicks(): number {
    return this.countInBars === 0 ? 0 : this.barTicks * this.countInBars + this.leadTicks;
  }

  /** The clicks of the count-in: a part beat before a pick-up that starts off the beat is clicked as a whole one. */
  private get countInBeats(): number {
    return Math.ceil(this.countInTicks / this.chart.ppq);
  }

  private ticksToMs(ticks: number): number {
    return (ticks * MS_PER_MINUTE) / (this.firstBpm * this.chart.ppq) / this.speed;
  }
}
