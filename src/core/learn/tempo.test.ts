// Covers ft_1_32.AC7.
import { describe, expect, it } from 'vitest';
import { chartWith } from '../../../tests/helpers/charts';
import { WaitMode } from '../judge/wait';
import type { JudgeEvent } from '../judge/types';
import { baselineBpm, baselinePercent, runTempo } from './tempo';

// two bars of quarter notes: C D E F | G A B C
const midis = [60, 62, 64, 65, 67, 69, 71, 72];
const chart = chartWith(midis.map((midi, i) => ({ tick: i * 480, dur: 480, midi })));

/** Play the chart's notes at the clock times given (ms). */
function played(times: readonly number[]): JudgeEvent[] {
  const mode = new WaitMode(chart);
  return times.flatMap((timeMs, i) => mode.handle({ kind: 'on', midi: midis[i]!, velocity: 80, timeMs, source: 'test' }));
}
const even = (beatMs: number) => midis.map((_, i) => 1000 + i * beatMs);

describe('runTempo', () => {
  it('reads the player\'s own pace from the key times: a quarter note every 1000 ms is 60 BPM, steady, no halt', () => {
    expect(runTempo(chart, played(even(1000)))).toMatchObject({ bpm: 60, steadiness: 1, halts: 0, steady: true, spread: 0, robust: 0, drift: 0 });
    expect(runTempo(chart, played(even(500)))!.bpm).toBe(120);
  });

  it('is not thrown by one long stop: the pace is the usual gap, and the stop is a halt', () => {
    const times = even(1000).map((t, i) => (i >= 4 ? t + 3000 : t));
    expect(runTempo(chart, played(times))).toMatchObject({ bpm: 60, halts: 1, steady: false });
  });

  it('calls a run unsteady when too many gaps are far from its own pace', () => {
    const times = [0, 1000, 1500, 2500, 3000, 4000, 4500, 5500].map((t) => t + 1000);
    expect(runTempo(chart, played(times))).toMatchObject({ halts: 0, steady: false });
  });

  it('forgives small wobble', () => {
    const times = even(1000).map((t, i) => t + (i % 2 === 0 ? 60 : -60));
    expect(runTempo(chart, played(times))).toMatchObject({ steady: true, halts: 0 });
  });

  it('does not read a written tempo change as unevenness: gaps are held against the chart\'s tempo map', () => {
    // the second bar is written at half the tempo; played exactly as written, at half speed throughout
    const slower = chartWith(midis.map((midi, i) => ({ tick: i * 480, dur: 480, midi })), { tempoMap: [{ tick: 0, bpm: 120 }, { tick: 1920, bpm: 60 }] });
    const mode = new WaitMode(slower);
    const times = [0, 1000, 2000, 3000, 4000, 6000, 8000, 10000];
    const events = times.flatMap((timeMs, i) => mode.handle({ kind: 'on', midi: midis[i]!, velocity: 80, timeMs, source: 'test' }));
    expect(runTempo(slower, events)).toMatchObject({ bpm: 60, steadiness: 1, halts: 0, steady: true, spread: 0, robust: 0, drift: 0 });
  });

  it('gives the standard deviation of the gaps around the run\'s own pace (ft_1_32.AC8)', () => {
    // gaps of 900 and 1100 ms in turn, the last one 900: the usual gap is 900 (4 of 7), the others 22% longer
    const times = [0, 900, 2000, 2900, 4000, 4900, 6000, 6900].map((t) => t + 1000);
    const tempo = runTempo(chart, played(times))!;
    expect(tempo.spread).toBeCloseTo(Math.sqrt((3 * (2 / 9) ** 2) / 7), 6);
    expect(tempo.robust).toBe(0); // more than half the gaps are the usual one
    expect(tempo.halts).toBe(0);
  });

  it('shows a stop in the standard deviation and keeps it out of the robust spread', () => {
    const times = even(1000).map((t, i) => t + (i % 2 === 0 ? 40 : -40) + (i >= 4 ? 3000 : 0));
    const tempo = runTempo(chart, played(times))!;
    expect(tempo.halts).toBe(1);
    expect(tempo.spread).toBeGreaterThan(1);
    expect(tempo.robust).toBeLessThan(0.2);
  });

  it('reads rushing as a drift above zero and slowing down as one below, and a stop does not bend it', () => {
    // each gap 5% shorter than the one before: the last of 7 gaps is 0.95^6 of the first, the tempo 36% up
    const gaps = Array.from({ length: 7 }, (_, i) => 1000 * 0.95 ** i);
    const rushing = gaps.reduce<number[]>((times, gap) => [...times, times.at(-1)! + gap], [1000]);
    expect(runTempo(chart, played(rushing))!.drift).toBeCloseTo(0.95 ** -6 - 1, 6);
    const slowing = [...gaps].reverse().reduce<number[]>((times, gap) => [...times, times.at(-1)! + gap], [1000]);
    expect(runTempo(chart, played(slowing))!.drift).toBeCloseTo(0.95 ** 6 - 1, 6);
    const stopped = even(1000).map((t, i) => (i >= 4 ? t + 3000 : t));
    expect(runTempo(chart, played(stopped))!.drift).toBeCloseTo(0, 6);
  });

  it('leaves two keys at the same instant out and keeps every measure finite', () => {
    const times = even(1000).map((t, i) => (i === 3 ? t - 1000 : t)); // the fourth key at the third's time
    const tempo = runTempo(chart, played(times))!;
    expect(tempo.bpm).toBe(60);
    for (const value of [tempo.spread, tempo.robust, tempo.drift]) expect(Number.isFinite(value)).toBe(true);
  });

  it('gives each bar\'s pace against the run\'s own: a bar played half as slow again reads 1.5 (ft_1_32.AC9)', () => {
    // bar 1 at a quarter a second, bar 2 at a quarter every 1.5 s; the gap from bar 1's last note belongs to bar 1
    const times = [0, 1000, 2000, 3000, 4000, 5500, 7000, 8500].map((t) => t + 1000);
    const tempo = runTempo(chart, played(times))!;
    expect(tempo.bars).toEqual([1, 1.5]);
    expect(tempo.hands).toBeUndefined(); // one hand plays
  });

  it('gives each hand\'s own spread when both hands play: the wobbling hand shows, the even one does not (ft_1_32.AC9)', () => {
    // right hand on every beat, even; left hand on the half beats between, early and late in turn
    const notes = [0, 1, 2, 3, 4, 5].flatMap((i) => [{ tick: i * 480, dur: 240, midi: 72, track: 'rh' }, { tick: i * 480 + 240, dur: 240, midi: 48, track: 'lh' }]);
    const two = chartWith(notes);
    const mode = new WaitMode(two);
    const offsets = [0, 150, -150, 150, -150, 0];
    const events = notes.flatMap((note, n) => {
      const beat = Math.floor(n / 2);
      const timeMs = 1000 + beat * 1000 + (note.track === 'lh' ? 500 + offsets[beat]! : 0);
      return mode.handle({ kind: 'on', midi: note.midi, velocity: 80, timeMs, source: 'test' });
    });
    const tempo = runTempo(two, events)!;
    expect(tempo.hands!.RH).toBe(0);
    expect(tempo.hands!.LH).toBeGreaterThan(0.1);
  });

  it('has nothing to say about fewer than three notes', () => {
    expect(runTempo(chart, played([0, 1000]))).toBeNull();
  });
});

describe('baselineBpm', () => {
  it('is the middle of the measured paces, rounded down to 5; null with none', () => {
    expect(baselineBpm([63, 58, 71])).toBe(60);
    expect(baselineBpm([63, 58])).toBe(60);
    expect(baselineBpm([44])).toBe(40);
    expect(baselineBpm([])).toBeNull();
  });
});

describe('baselinePercent (core_01.AC13)', () => {
  it('core_01.AC13 is the baseline against the written tempo, and nothing before a pace was counted', () => {
    expect(baselinePercent([63, 58, 71], 120)).toBe(50);
    expect(baselinePercent([92], 70)).toBe(129);
    expect(baselinePercent([], 120)).toBeNull();
    expect(baselinePercent([60], 0)).toBeNull();
  });
});
