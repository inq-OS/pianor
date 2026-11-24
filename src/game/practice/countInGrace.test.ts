// Covers core_09.AC34.
import { describe, expect, it } from 'vitest';
import { chartWith, graceAt } from '../../../tests/helpers/charts';
import { Transport } from '../../core/transport';
import { SCHEDULE_LOOKAHEAD_MS } from '../../io/audio';
import { CountInGrace } from './countInGrace';

// 4/4 at 120 bpm, started at 1000: the count-in's last beat (the grace) is at 2500, bar 1 at 3000
const graced = () => chartWith([{ tick: 0, dur: 480, midi: 60 }, { tick: 480, dur: 480, midi: 64 }], { graces: [graceAt(0, 62)] });
const GRACE_AT = 2500;

function fakePiano() {
  const calls: string[] = [];
  return {
    calls,
    noteOn: (midi: number, _velocity: number, atMs?: number) => void calls.push(`on${midi}@${atMs}`),
    noteOff: (midi: number, atMs?: number) => void calls.push(`off${midi}@${atMs}`),
  };
}

function started(atMs = 1000): Transport {
  const transport = new Transport(graced());
  transport.start(atMs);
  return transport;
}

describe('CountInGrace: the grace is queued only just before its beat (core_09.AC34, d121)', () => {
  it('core_09.AC34 nothing is queued before the lookahead, then it is queued exactly once', () => {
    const transport = started();
    const piano = fakePiano();
    const grace = new CountInGrace();
    for (const now of [1000, 1500, 2000, GRACE_AT - SCHEDULE_LOOKAHEAD_MS - 1]) grace.update(transport, piano, now);
    expect(piano.calls).toEqual([]); // a whole count-in ahead nothing is on the piano that a restart could not take back
    grace.update(transport, piano, GRACE_AT - SCHEDULE_LOOKAHEAD_MS);
    expect(piano.calls).toEqual(['on62@2500', 'off62@3000']);
    for (const now of [2450, 2500, 2900, 3500]) grace.update(transport, piano, now);
    expect(piano.calls).toHaveLength(2);
  });

  it('core_09.AC34 nothing is queued after stop, nor before the start, nor once its time is over', () => {
    const piano = fakePiano();
    const stopped = new CountInGrace();
    stopped.stop();
    stopped.update(started(), piano, GRACE_AT);
    new CountInGrace().update(new Transport(graced()), piano, GRACE_AT); // not started
    new CountInGrace().update(started(), piano, 3000); // a frame that comes after bar 1 never sounds it late
    expect(piano.calls).toEqual([]);
  });

  it('core_09.AC34 a new transport (the session was replaced) gets its own grace; the old one never sounds', () => {
    const piano = fakePiano();
    const grace = new CountInGrace();
    grace.update(started(1000), piano, 1100); // the old session, far ahead of its grace
    grace.update(started(5000), piano, 6400); // replaced: its grace is at 6500
    expect(piano.calls).toEqual(['on62@6500', 'off62@7000']);
  });
});
