// Covers ft_0_07.AC2.
import { describe, expect, it } from 'vitest';
import { FakeContext } from '../../../tests/helpers/fakeAudio';
import { AudioSongClock } from './SongClock';

describe('AudioSongClock', () => {
  it('is the audio clock in milliseconds while the context is running', () => {
    const ctx = new FakeContext();
    const clock = new AudioSongClock(ctx, () => 99999);
    ctx.currentTime = 2.5;
    expect(clock.nowMs()).toBe(2500);
  });

  it('maps DOM timestamps onto the audio clock using the context output timestamp', () => {
    const ctx = new FakeContext();
    ctx.currentTime = 10;
    ctx.outputTimestamp = { contextTime: 9.9, performanceTime: 5000 };
    const clock = new AudioSongClock(ctx);
    // a key pressed 30 ms after the reference point is 30 ms after contextTime 9.9
    expect(clock.fromDomTime(5030)).toBeCloseTo(9930, 6);
    // and an earlier one maps earlier
    expect(clock.fromDomTime(4990)).toBeCloseTo(9890, 6);
  });

  it('keeps differences between DOM timestamps exactly (so rhythm is measured correctly)', () => {
    const ctx = new FakeContext();
    ctx.outputTimestamp = { contextTime: 3, performanceTime: 1000 };
    const clock = new AudioSongClock(ctx);
    expect(clock.fromDomTime(1500) - clock.fromDomTime(1200)).toBeCloseTo(300, 9);
  });

  it('falls back to the DOM clock before audio runs, and when there is no output timestamp', () => {
    let dom = 1000;
    const ctx = new FakeContext();
    ctx.state = 'suspended';
    const clock = new AudioSongClock(ctx, () => dom);
    dom = 1250;
    expect(clock.nowMs()).toBe(250);
    expect(clock.fromDomTime(1200)).toBe(200);

    ctx.state = 'running';
    ctx.currentTime = 5;
    ctx.outputTimestamp = {};
    dom = 7000;
    expect(clock.nowMs()).toBe(5000);
    expect(clock.fromDomTime(6900)).toBe(4900);
  });

  it('ignores an empty output timestamp (performanceTime 0 means not ready yet)', () => {
    const ctx = new FakeContext();
    ctx.currentTime = 1;
    ctx.outputTimestamp = { contextTime: 0, performanceTime: 0 };
    const clock = new AudioSongClock(ctx, () => 500);
    expect(clock.fromDomTime(450)).toBe(950);
  });
});
