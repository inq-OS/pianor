// Covers ft_0_02.AC2.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { MS_PER_MINUTE, NOTE_TICKS, PPQ, barIndexAtTick, buildBars, firstPrintedBar, fullBarTicks, printedBar, msPerBeat, pickupTicks, msToTick, noteLengthOf, tickToMs, ticksPerBar } from './time';

describe('ticksPerBar', () => {
  it('computes common meters at 480 ppq', () => {
    expect(ticksPerBar({ num: 4, den: 4 })).toBe(1920);
    expect(ticksPerBar({ num: 3, den: 4 })).toBe(1440);
    expect(ticksPerBar({ num: 2, den: 4 })).toBe(960);
    expect(ticksPerBar({ num: 6, den: 8 })).toBe(1440);
  });
});

describe('buildBars and barIndexAtTick', () => {
  it('builds contiguous bars and follows a meter change', () => {
    const bars = buildBars([{ tick: 0, num: 4, den: 4 }, { tick: 3840, num: 3, den: 4 }], 4);
    expect(bars.map((b) => b.endTick - b.startTick)).toEqual([1920, 1920, 1440, 1440]);
    expect(bars[3]!.endTick).toBe(3840 + 2880);
  });

  it('finds the bar for a tick, treating endTick as exclusive', () => {
    const bars = buildBars([{ tick: 0, num: 4, den: 4 }], 3);
    expect(barIndexAtTick(bars, 0)).toBe(0);
    expect(barIndexAtTick(bars, 1919)).toBe(0);
    expect(barIndexAtTick(bars, 1920)).toBe(1);
    expect(barIndexAtTick(bars, 5760)).toBe(-1);
  });

  it('every tick inside the piece maps to a bar that contains it (property)', () => {
    const bars = buildBars([{ tick: 0, num: 4, den: 4 }, { tick: 3840, num: 3, den: 4 }], 8);
    const total = bars[7]!.endTick;
    fc.assert(
      fc.property(fc.integer({ min: 0, max: total - 1 }), (tick) => {
        const bar = bars[barIndexAtTick(bars, tick)]!;
        expect(tick).toBeGreaterThanOrEqual(bar.startTick);
        expect(tick).toBeLessThan(bar.endTick);
      }),
    );
  });
});

describe('empty maps', () => {
  it('refuse to guess a tempo or meter', () => {
    expect(() => tickToMs([], 10)).toThrow(/tempoMap/);
    expect(() => msToTick([], 10)).toThrow(/tempoMap/);
    expect(() => buildBars([], 2)).toThrow(/meterMap/);
  });
});

describe('tick and millisecond conversion', () => {
  it('120 bpm: a quarter note is 500 ms', () => {
    expect(tickToMs([{ tick: 0, bpm: 120 }], 480)).toBe(500);
    expect(msToTick([{ tick: 0, bpm: 120 }], 500)).toBe(480);
  });

  it('follows tempo changes', () => {
    const map = [{ tick: 0, bpm: 120 }, { tick: 960, bpm: 60 }];
    expect(tickToMs(map, 960)).toBe(1000);
    expect(tickToMs(map, 1440)).toBe(2000);
    expect(msToTick(map, 2000)).toBe(1440);
  });

  it('round-trips ticks through milliseconds (property)', () => {
    const map = [{ tick: 0, bpm: 70 }, { tick: 1920, bpm: 95 }, { tick: 5000, bpm: 50 }];
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 20000 }), (tick) => {
        expect(msToTick(map, tickToMs(map, tick))).toBe(tick);
      }),
    );
  });

  it('is monotonic (property)', () => {
    const map = [{ tick: 0, bpm: 70 }, { tick: 1920, bpm: 95 }];
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 20000 }), fc.integer({ min: 1, max: 500 }), (tick, d) => {
        expect(tickToMs(map, tick + d)).toBeGreaterThan(tickToMs(map, tick));
      }),
    );
  });
});

describe('msPerBeat', () => {
  it('is a minute divided by the beats in it', () => {
    expect(MS_PER_MINUTE).toBe(60_000);
    expect(msPerBeat(60)).toBe(1000);
    expect(msPerBeat(120)).toBe(500);
  });
});

describe('note lengths', () => {
  it('names a length among all or among the allowed ones', () => {
    expect(noteLengthOf(PPQ)).toBe('quarter');
    expect(noteLengthOf(1.5 * PPQ)).toBe('dottedQuarter');
    expect(noteLengthOf(1.5 * PPQ, ['quarter', 'half'])).toBeUndefined();
    expect(noteLengthOf(100)).toBeUndefined();
    expect(NOTE_TICKS.whole).toBe(4 * PPQ);
  });
});

describe('fullBarTicks and pickupTicks (core_09.AC22)', () => {
  const meter = [{ tick: 0, num: 3, den: 4 }];
  it('core_09.AC22 a whole bar comes from the meter, and a short first bar is the pick-up', () => {
    expect(fullBarTicks(meter)).toBe(1440);
    const withPickup = [{ index: 0, startTick: 0, endTick: 480 }, { index: 1, startTick: 480, endTick: 1920 }, { index: 2, startTick: 1920, endTick: 2880 }];
    expect(pickupTicks(withPickup, meter)).toBe(480);
    expect(pickupTicks(buildBars(meter, 3), meter)).toBe(0);
    // one short bar alone is no pick-up: nothing follows it
    expect(pickupTicks([{ index: 0, startTick: 0, endTick: 480 }], meter)).toBe(0);
    expect(() => fullBarTicks([])).toThrow();
  });
});

describe('printed bar numbers (core_09.AC25, d120)', () => {
  const meter = [{ tick: 0, num: 4, den: 4 }];
  const withPickup = [{ index: 0, startTick: 0, endTick: 480 }, { index: 1, startTick: 480, endTick: 2400 }, { index: 2, startTick: 2400, endTick: 3840 }];

  it('core_09.AC25 a pick-up is printed as bar 0 and the first full bar as 1; without one the first bar is 1', () => {
    expect(firstPrintedBar({ bars: withPickup, meterMap: meter })).toBe(0);
    expect([0, 1, 2].map((i) => printedBar({ bars: withPickup, meterMap: meter }, i))).toEqual([0, 1, 2]);
    const plain = buildBars(meter, 3);
    expect(firstPrintedBar({ bars: plain, meterMap: meter })).toBe(1);
    expect([0, 1, 2].map((i) => printedBar({ bars: plain, meterMap: meter }, i))).toEqual([1, 2, 3]);
  });
});
