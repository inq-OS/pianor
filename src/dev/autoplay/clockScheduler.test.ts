import { describe, expect, it } from 'vitest';
import littleSteps from '../../../tests/fixtures/charts/little-steps.v2.json';
import { chartSchema } from '../../core/chart';
import { composePerformance, playThroughDevice } from '../../io/mock/performance';
import { AudioSongClock } from '../../io/audio/SongClock';
import { ClockScheduler, deviceOnClock, songToDomTime } from './clockScheduler';

// ft_Y_09.AC5: Tempo mode is played on the game's clock, through the scheduler below.
describe('ClockScheduler', () => {
  it('runs each task when the clock reaches its time, in time order, ties in the order added', () => {
    let now = 0;
    const scheduler = new ClockScheduler(() => now);
    const ran: string[] = [];
    scheduler.at(300, () => ran.push('c'));
    scheduler.at(100, () => ran.push('a'));
    scheduler.at(100, () => ran.push('b'));
    scheduler.pump();
    expect(ran).toEqual([]);
    now = 150;
    scheduler.pump();
    expect(ran).toEqual(['a', 'b']);
    expect(scheduler.pending).toBe(1);
    now = 10_000;
    scheduler.pump();
    expect(ran).toEqual(['a', 'b', 'c']);
    expect(scheduler.pending).toBe(0);
  });

  it('follows the clock when it jumps: nothing is lost and nothing runs early', () => {
    let now = 0;
    const scheduler = new ClockScheduler(() => now);
    const ran: number[] = [];
    [100, 200, 300].forEach((at) => scheduler.at(at, () => ran.push(at)));
    now = 250;
    scheduler.pump();
    now = 5000; // the audio clock started and jumped
    scheduler.pump();
    expect(ran).toEqual([100, 200, 300]);
  });

  it('says when it is idle, and forgets what it has not run when cancelled', async () => {
    const scheduler = new ClockScheduler(() => 0);
    await scheduler.idle(); // nothing queued: at once
    const ran: number[] = [];
    scheduler.at(10, () => ran.push(1));
    let idle = false;
    void scheduler.idle().then(() => (idle = true));
    scheduler.cancel();
    await Promise.resolve();
    expect(idle).toBe(true);
    expect(ran).toEqual([]);
  });

  it('really polls the clock by itself', async () => {
    let now = 0;
    const scheduler = new ClockScheduler(() => now, 2);
    const ran: number[] = [];
    scheduler.at(5, () => ran.push(5));
    now = 6;
    await scheduler.idle();
    expect(ran).toEqual([5]);
  });
});

describe('deviceOnClock with playThroughDevice', () => {
  it('sends song-time stamps to the keyboard as DOM time, once each key is due', () => {
    const chart = chartSchema.parse(littleSteps);
    const sent: { kind: string; midi: number; stamp: number | undefined }[] = [];
    const device = {
      isConnected: true,
      press: (midi: number, _velocity?: number, stamp?: number) => void sent.push({ kind: 'on', midi, stamp }),
      release: (midi: number, stamp?: number) => void sent.push({ kind: 'off', midi, stamp }),
    };
    let now = 0;
    const scheduler = new ClockScheduler(() => now);
    const events = composePerformance(chart, { startMs: 1000 });
    playThroughDevice(deviceOnClock(device, (songMs) => songMs - 400), events, scheduler); // the DOM clock is 400 ms behind
    now = 500;
    scheduler.pump();
    expect(sent).toEqual([]);
    now = 1000;
    scheduler.pump();
    expect(sent[0]).toEqual({ kind: 'on', midi: 60, stamp: 600 });
    now = 1e9;
    scheduler.pump();
    expect(sent.filter((s) => s.kind === 'on').map((s) => s.midi)).toEqual(chart.notes.map((n) => n.midi));
  });

  it('does not press while the keyboard is unplugged', () => {
    const sent: number[] = [];
    const device = { isConnected: false, press: (midi: number) => void sent.push(midi), release: () => undefined };
    let now = 0;
    const scheduler = new ClockScheduler(() => now);
    playThroughDevice(deviceOnClock(device, (ms) => ms), [{ atMs: 1, kind: 'on', midi: 60, velocity: 80 }], scheduler);
    now = 10;
    scheduler.pump();
    expect(sent).toEqual([]);
  });
});

describe('songToDomTime', () => {
  // A running context whose output timestamp lags `currentTime` by the output latency, as Chrome's does (more when busy).
  const clockWithLatency = (latencyMs: number) => {
    let dom = 5000;
    const context = {
      state: 'running',
      get currentTime() {
        return (dom - 1000) / 1000;
      },
      getOutputTimestamp: () => ({ contextTime: (dom - 1000 - latencyMs) / 1000, performanceTime: dom }),
    };
    return { clock: new AudioSongClock(context, () => dom), domNow: () => dom, tick: (ms: number) => void (dom += ms) };
  };

  it('a planned song time comes back exactly, whatever the output latency', () => {
    for (const latencyMs of [0, 12, 45, 120]) {
      const { clock, domNow, tick } = clockWithLatency(latencyMs);
      const toDom = songToDomTime(clock, domNow);
      for (const songMs of [3990, 4000, 4136.5]) {
        expect(clock.fromDomTime(toDom(songMs))).toBeCloseTo(songMs, 6);
        tick(7);
      }
    }
  });

  it('the old mapping through nowMs was early by the output latency', () => {
    const { clock, domNow } = clockWithLatency(45);
    const viaNow = (songMs: number) => domNow() - (clock.nowMs() - songMs);
    expect(clock.fromDomTime(viaNow(4000))).toBeCloseTo(4000 - 45, 6);
  });
});
