import { describe, expect, it } from 'vitest';
import { FakeTimers } from '../../../tests/helpers/fakeAudio';
import { chartWith } from '../../../tests/helpers/charts';
import { playbackNotes } from '../../core/chart';
import type { PianoSound, SongClock } from '../../io/audio';
import { ChartPlayer } from './ChartPlayer';

class RecordingPiano implements PianoSound {
  loaded = true;
  failed = 0;
  ready = Promise.resolve();
  readonly calls: { type: 'on' | 'off' | 'all'; midi?: number; at?: number; velocity?: number }[] = [];
  noteOn(midi: number, velocity: number, atMs?: number) { this.calls.push({ type: 'on', midi, velocity, ...(atMs === undefined ? {} : { at: atMs }) }); }
  noteOff(midi: number, atMs?: number) { this.calls.push({ type: 'off', midi, ...(atMs === undefined ? {} : { at: atMs }) }); }
  allNotesOff() { this.calls.push({ type: 'all' }); }
  setVolume() {}
  readonly sound = 'full' as const;
  setSound() { return Promise.resolve(); }
  get ons() { return this.calls.filter((c) => c.type === 'on'); }
}

function rig() {
  const timers = new FakeTimers();
  const piano = new RecordingPiano();
  const clock: SongClock = { nowMs: () => timers.now, fromDomTime: (t) => t };
  const player = new ChartPlayer(piano, clock, timers);
  const run = (ms: number) => timers.advance(ms);
  return { timers, piano, player, run };
}

/** Quarter notes C D E F at 120 bpm: one every 500 ms. */
const steps = () => playbackNotes(chartWith([
  { tick: 0, dur: 480, midi: 60 }, { tick: 480, dur: 480, midi: 62 }, { tick: 960, dur: 480, midi: 64 }, { tick: 1440, dur: 480, midi: 65 },
]));

describe('ChartPlayer', () => {
  it('starts after a short lead-in and places every note on the audio clock at its own time', () => {
    const { piano, player, run } = rig();
    player.start(steps(), 2000);
    run(3000);
    expect(piano.ons.map((c) => [c.midi, c.at])).toEqual([[60, 200], [62, 700], [64, 1200], [65, 1700]]);
    expect(piano.ons.every((c) => c.velocity === 80)).toBe(true);
  });

  it('releases each note a little before the next one, so repeated notes sound again', () => {
    const { piano, player, run } = rig();
    player.start(steps(), 2000);
    run(3000);
    const offs = piano.calls.filter((c) => c.type === 'off');
    expect(offs.map((c) => c.midi)).toEqual([60, 62, 64, 65]);
    offs.forEach((off, i) => {
      const on = piano.ons[i]!;
      expect(off.at!).toBeGreaterThan(on.at! + 100);
      expect(off.at!).toBeLessThan(on.at! + 500);
    });
  });

  it('schedules only a little ahead: stopping early leaves the rest unscheduled', () => {
    const { piano, player, run } = rig();
    player.start(steps(), 2000);
    run(100);
    expect(piano.ons.map((c) => c.midi)).toEqual([60]); // 62 is 700 ms away, beyond the lookahead
    player.stop();
    run(5000);
    expect(piano.ons.map((c) => c.midi)).toEqual([60]);
    expect(piano.calls.at(-1)).toEqual({ type: 'all' });
  });

  it('says where it is in the piece, negative during the lead-in, and null when not playing', () => {
    const { player, run } = rig();
    expect(player.elapsedMs()).toBeNull();
    player.start(steps(), 2000);
    expect(player.elapsedMs()).toBe(-200);
    run(1200);
    expect(player.elapsedMs()).toBe(1000);
    expect(player.isPlaying).toBe(true);
  });

  it('finishes by itself after the last bar, tells the listener once, and goes quiet', () => {
    const { player, piano, timers, run } = rig();
    let ended = 0;
    player.start(steps(), 2000, () => ended++);
    run(2100);
    expect(player.isPlaying).toBe(true);
    run(200);
    expect(ended).toBe(1);
    expect(player.isPlaying).toBe(false);
    expect(player.elapsedMs()).toBeNull();
    expect(piano.calls.at(-1)).toEqual({ type: 'all' });
    expect(timers.pending).toBe(0);
    run(5000);
    expect(ended).toBe(1);
  });

  it('starting again replaces the piece that was playing, without telling the old listener it ended', () => {
    const { player, run } = rig();
    let first = 0;
    let second = 0;
    player.start(steps(), 2000, () => first++);
    run(500);
    player.start(steps(), 2000, () => second++);
    run(3000);
    expect(first).toBe(0);
    expect(second).toBe(1);
  });

  it('plays at the velocity it is given', () => {
    const { piano, player, run } = rig();
    player.start(playbackNotes(chartWith([{ tick: 0, dur: 480, midi: 60 }]), { velocity: 40 }), 500);
    run(1000);
    expect(piano.ons[0]!.velocity).toBe(40);
  });

  it('keeps a long piece within the sampler voice limit by scheduling in small steps', () => {
    const { piano, player, run } = rig();
    const many = playbackNotes(chartWith(Array.from({ length: 64 }, (_, i) => ({ tick: i * 480, dur: 480, midi: 60 + (i % 5) }))));
    player.start(many, 32000);
    run(40000);
    expect(piano.ons).toHaveLength(64);
  });
});
