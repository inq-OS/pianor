import { describe, expect, it } from 'vitest';
import { FakeTimers } from '../../../tests/helpers/fakeAudio';
import { chartWith } from '../../../tests/helpers/charts';
import type { PianoSound, SongClock } from '../../io/audio';
import { ListenAlong } from './ListenAlong';

class CountingPiano implements PianoSound {
  loaded = true;
  failed = 0;
  ready = Promise.resolve();
  ons: { midi: number; at: number | undefined }[] = [];
  silenced = 0;
  noteOn(midi: number, _velocity: number, atMs?: number) { this.ons.push({ midi, at: atMs }); }
  noteOff() {}
  allNotesOff() { this.silenced += 1; }
  setVolume() {}
  readonly sound = 'full' as const;
  setSound() { return Promise.resolve(); }
}

function rig() {
  const timers = new FakeTimers();
  const piano = new CountingPiano();
  const clock: SongClock = { nowMs: () => timers.now, fromDomTime: (t) => t };
  return { timers, piano, along: new ListenAlong(piano, clock, timers) };
}

/** Quarter notes C D E at 120 bpm (500 ms each), then the bar's last beat is a rest. */
const piece = () => chartWith([{ tick: 0, dur: 480, midi: 60 }, { tick: 480, dur: 480, midi: 62 }, { tick: 960, dur: 480, midi: 64 }]);

describe('ListenAlong (kuula on the piano screen)', () => {
  it('plays the piece from its first note at the tempo percent the player chose', () => {
    const { timers, piano, along } = rig();
    along.start(piece(), 50, () => {});
    timers.advance(5000);
    // 50 percent: a quarter is 1000 ms; the first note after the player's 200 ms lead-in
    expect(piano.ons.map((n) => [n.midi, n.at])).toEqual([[60, 200], [62, 1200], [64, 2200]]);
  });

  it('lights the notes as they sound and reports a change only once', () => {
    const { timers, along } = rig();
    along.start(piece(), 100, () => {});
    expect(along.changed()).toEqual([]); // the lead-in: nothing sounds yet, the cursor goes off
    expect(along.changed()).toBeUndefined();
    timers.advance(200 + 10);
    expect(along.changed()).toEqual([0]);
    expect(along.changed()).toBeUndefined();
    timers.advance(500);
    expect(along.changed()).toEqual([1]);
    timers.advance(1000); // the rest at the end of the bar
    expect(along.changed()).toEqual([]);
  });

  it('lights the sounding notes again after the staff was drawn anew', () => {
    const { timers, along } = rig();
    along.start(piece(), 100, () => {});
    timers.advance(300);
    expect(along.changed()).toEqual([0]);
    along.relight();
    expect(along.changed()).toEqual([0]);
  });

  it('ends at the end of the last bar and says so once', () => {
    const { timers, along } = rig();
    let ended = 0;
    along.start(piece(), 100, () => (ended += 1));
    timers.advance(2100);
    expect(ended).toBe(0);
    expect(along.isPlaying).toBe(true);
    timers.advance(1000);
    expect(ended).toBe(1);
    expect(along.isPlaying).toBe(false);
    expect(along.changed()).toBeUndefined();
  });

  it('stops at once, silences the piano and does not report an end', () => {
    const { timers, piano, along } = rig();
    let ended = 0;
    along.start(piece(), 100, () => (ended += 1));
    timers.advance(600);
    along.stop();
    timers.advance(5000);
    expect(ended).toBe(0);
    expect(along.isPlaying).toBe(false);
    expect(piano.silenced).toBeGreaterThan(0);
  });

  it('starts again from the first note when started while playing (a reset)', () => {
    const { timers, piano, along } = rig();
    along.start(piece(), 100, () => {});
    timers.advance(1300);
    piano.ons = [];
    along.start(piece(), 100, () => {});
    timers.advance(500);
    expect(piano.ons[0]).toEqual({ midi: 60, at: 1300 + 200 });
  });
});
