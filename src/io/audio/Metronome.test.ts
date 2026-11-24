// Covers ft_0_07.AC2, core_13.AC1.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { FakeContext, FakeTimers } from '../../../tests/helpers/fakeAudio';
import type { BeatInfo } from '../audio';
import { Metronome } from './Metronome';

function setup(options: { lookaheadMs?: number; tickMs?: number } = {}) {
  const ctx = new FakeContext();
  const timers = new FakeTimers();
  const metronome = new Metronome(ctx.asAudioContext(), { timers, ...options });
  const beats: BeatInfo[] = [];
  metronome.onBeat((b) => beats.push(b));
  /** Run time forward with the audio clock following the timers. */
  const run = (ms: number) => timers.advance(ms, (now) => { ctx.currentTime = now / 1000; });
  return { ctx, timers, metronome, beats, run };
}

describe('Metronome', () => {
  it('clicks on a perfect grid of beats at the tempo, starting where asked', () => {
    const { ctx, metronome, run } = setup();
    metronome.start({ bpm: 120, beatsPerBar: 4, startAtMs: 1000 });
    run(4000);
    const times = ctx.oscillators.map((o) => o.startedAt! * 1000);
    // beats up to the look-ahead horizon are scheduled: 120 ms past 4000 ms reaches the beat at 4000 but not 4500
    expect(times).toEqual([1000, 1500, 2000, 2500, 3000, 3500, 4000]);
  });

  it('accents the first beat of each bar with a higher click', () => {
    const { ctx, metronome, run } = setup();
    metronome.start({ bpm: 120, beatsPerBar: 3, startAtMs: 500 });
    run(3000);
    const freqs = ctx.oscillators.slice(0, 6).map((o) => o.frequency.value);
    expect(freqs).toEqual([1600, 1000, 1000, 1600, 1000, 1000]);
  });

  it('core_01.AC10 joins a bar part-way: the first click is the beat it is given, and the next bar is accented', () => {
    const { ctx, metronome, beats, run } = setup();
    metronome.start({ bpm: 120, beatsPerBar: 4, startAtMs: 500, firstBeat: 3 });
    run(2000);
    expect(ctx.oscillators.slice(0, 3).map((o) => o.frequency.value)).toEqual([1000, 1600, 1000]);
    expect(beats[0]).toMatchObject({ index: 3, bar: 0, beatInBar: 3, atMs: 500 });
  });

  it('reports each beat about when it sounds, with bar and beat numbers', () => {
    const { metronome, beats, run } = setup();
    metronome.start({ bpm: 60, beatsPerBar: 2, startAtMs: 0 });
    run(3100);
    expect(beats.map((b) => [b.index, b.bar, b.beatInBar, b.atMs])).toEqual([[0, 0, 0, 0], [1, 0, 1, 1000], [2, 1, 0, 2000], [3, 1, 1, 3000]]);
  });

  it('core_13.AC1 reports with each beat the time to the next, for the beat ring', () => {
    const { metronome, beats, run } = setup();
    metronome.start({ bpm: 120, beatsPerBar: 4, startAtMs: 0 });
    run(600);
    expect(beats.map((b) => b.intervalMs)).toEqual([500, 500]);
  });

  // Covers core_09.AC34.
  it('core_09.AC34 leaves a silent beat unclicked but still counts and reports it (a count-in grace, d121)', () => {
    const { ctx, metronome, beats, run } = setup();
    metronome.start({ bpm: 120, beatsPerBar: 4, startAtMs: 1000, beats: 4, silentAtMs: [2500] });
    run(4000);
    expect(ctx.oscillators.map((o) => o.startedAt! * 1000)).toEqual([1000, 1500, 2000]);
    expect(beats.map((b) => b.atMs)).toEqual([1000, 1500, 2000, 2500]);
  });

  it('keeps the grid exact however long it runs: no drift against the song clock (property)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 40, max: 200 }), fc.integer({ min: 1, max: 6 }), fc.integer({ min: 0, max: 5000 }), (bpm, beatsPerBar, start) => {
        const { ctx, metronome, run } = setup();
        metronome.start({ bpm, beatsPerBar, startAtMs: start });
        run(60000);
        const interval = 60000 / bpm;
        ctx.oscillators.forEach((o, i) => {
          expect(Math.abs(o.startedAt! * 1000 - (start + i * interval))).toBeLessThan(1e-6);
        });
        expect(ctx.oscillators.length).toBeGreaterThanOrEqual(Math.floor((60000 - start) / interval));
      }),
    );
  });

  it('schedules ahead of time so a late timer does not move a beat', () => {
    const { ctx, timers, metronome } = setup({ lookaheadMs: 120, tickMs: 25 });
    metronome.start({ bpm: 120, beatsPerBar: 4, startAtMs: 200 });
    expect(ctx.oscillators).toHaveLength(0); // the beat at 200 ms is beyond the 120 ms look-ahead
    ctx.currentTime = 0.15; // the timer was late: 150 ms have passed
    timers.advance(25, () => undefined);
    expect(ctx.oscillators.map((o) => o.startedAt! * 1000)).toEqual([200]);
    ctx.currentTime = 0.65; // late again
    timers.advance(25, () => undefined);
    expect(ctx.oscillators.map((o) => o.startedAt! * 1000)).toEqual([200, 700]); // still exactly on the grid
  });

  it('changes tempo from the next beat on without breaking the grid', () => {
    const { ctx, metronome, run } = setup();
    metronome.start({ bpm: 60, beatsPerBar: 4, startAtMs: 0 });
    run(2100);
    metronome.setBpm(120);
    run(3000);
    const times = ctx.oscillators.map((o) => o.startedAt! * 1000);
    expect(times.slice(0, 3)).toEqual([0, 1000, 2000]);
    const gaps = times.slice(3).map((t, i) => t - times[i + 2]!);
    expect(gaps.slice(1, 5).every((g) => Math.abs(g - 500) < 1e-9)).toBe(true);
  });

  it('stops: no more clicks, no more timers, no late beat callbacks', () => {
    const { ctx, timers, metronome, beats, run } = setup();
    metronome.start({ bpm: 120, beatsPerBar: 4, startAtMs: 100 });
    run(1000);
    metronome.stop();
    const clicks = ctx.oscillators.length;
    const reported = beats.length;
    expect(metronome.running).toBe(false);
    expect(timers.pending).toBe(0);
    run(5000);
    expect(ctx.oscillators).toHaveLength(clicks);
    expect(beats).toHaveLength(reported);
  });

  it('restarting starts a fresh count from beat 0', () => {
    const { beats, metronome, run } = setup();
    metronome.start({ bpm: 120, beatsPerBar: 4, startAtMs: 0 });
    run(1200);
    metronome.start({ bpm: 120, beatsPerBar: 4, startAtMs: 2000 });
    run(900);
    expect(beats.at(-1)).toMatchObject({ index: 0, atMs: 2000 });
  });

  it('starts shortly after now when no start time is given, and clamps silly tempos and bar sizes', () => {
    const { ctx, timers, metronome, run } = setup();
    ctx.currentTime = 10;
    timers.now = 10000;
    metronome.start({ bpm: 5000, beatsPerBar: 0 });
    run(500);
    expect(ctx.oscillators[0]!.startedAt! * 1000).toBeGreaterThan(10000);
    expect(ctx.oscillators[1]!.startedAt! * 1000 - ctx.oscillators[0]!.startedAt! * 1000).toBeCloseTo(60, 6); // 1000 bpm max (METRONOME_BPM)
    expect(ctx.oscillators.every((o) => o.frequency.value === 1600)).toBe(true); // 1 beat per bar: always the accent
  });

  it('frees click nodes when they finish', () => {
    const { ctx, metronome, run } = setup();
    metronome.start({ bpm: 120, beatsPerBar: 4, startAtMs: 0 });
    run(100);
    const osc = ctx.oscillators[0]!;
    osc.onended?.();
    expect(osc.disconnected).toBe(true);
  });

  it('connects clicks to the destination through a gain', () => {
    const { ctx, metronome, run } = setup();
    metronome.start({ bpm: 120, beatsPerBar: 4, startAtMs: 0 });
    run(100);
    const gain = ctx.gains[0]!;
    expect(ctx.oscillators[0]!.connections).toContain(gain);
    expect(gain.connections).toContain(ctx.destination);
  });

  it('clicks only `beats` times when asked, then stops by itself (a count-in with no click after it)', () => {
    const { ctx, timers, metronome, beats, run } = setup();
    metronome.start({ bpm: 120, beatsPerBar: 4, startAtMs: 100, beats: 4 });
    run(5000);
    expect(ctx.oscillators.map((o) => o.startedAt! * 1000)).toEqual([100, 600, 1100, 1600]);
    expect(beats).toHaveLength(4);
    expect(metronome.running).toBe(false);
    expect(timers.pending).toBe(0);
  });
});
