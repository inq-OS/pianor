import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { IdleDetector } from './idle';

/** 4/4 at PPQ 480: a bar is 4 quarters. Times are ticks, passed in by the test (no real clock). */
const BAR = 1920;

describe('IdleDetector', () => {
  it('gives no bites while the player keeps within one bar of the last key press', () => {
    const idle = new IdleDetector({ barTicks: BAR });
    idle.press(0);
    expect(idle.advance(BAR)).toBe(0);
  });

  it('bites once per bar, on the first click of the bar, once more than one bar has passed', () => {
    const idle = new IdleDetector({ barTicks: BAR });
    idle.press(0);
    expect(idle.advance(3839)).toBe(0); // bar 2 starts at 3840; idle began after 1920
    expect(idle.advance(3840)).toBe(1);
    expect(idle.advance(5759)).toBe(0); // beats inside a bar do not bite
    expect(idle.advance(5760)).toBe(1);
  });

  it('counts each bar once, however the time is split into calls', () => {
    const idle = new IdleDetector({ barTicks: BAR });
    idle.press(0);
    let total = 0;
    for (let t = 0; t <= 20000; t += 37) total += idle.advance(t);
    total += idle.advance(20000);
    // Bars start at k * 1920; the bites are for k = 2 ... floor(20000 / 1920) = 10: nine bites.
    expect(total).toBe(9);
  });

  it('restarts the idle timer on each key press', () => {
    const idle = new IdleDetector({ barTicks: BAR });
    idle.press(0);
    expect(idle.advance(3840)).toBe(1);
    expect(idle.press(4000)).toBe(0); // nothing due before the press
    expect(idle.advance(7679)).toBe(0); // idle again only after 4000 + 1920 = 5920
    expect(idle.advance(7680)).toBe(1); // bar 4 starts at 7680
  });

  it('returns the bites due before a key press', () => {
    const idle = new IdleDetector({ barTicks: BAR });
    idle.press(0);
    expect(idle.press(5000)).toBe(1); // bar 2 at 3840 came before the press
  });

  it('rejects a bar that is not a positive tick count', () => {
    expect(() => new IdleDetector({ barTicks: 0 })).toThrow(RangeError);
    expect(() => new IdleDetector({ barTicks: -1 })).toThrow(RangeError);
  });

  it('rejects time going backwards', () => {
    const idle = new IdleDetector({ barTicks: BAR });
    idle.advance(1000);
    expect(() => idle.advance(500)).toThrow(RangeError);
    expect(idle.advance(1000)).toBe(0); // the same time twice is not going backwards
  });

  it('never returns a negative count (property)', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 3000 }), { minLength: 1, maxLength: 40 }), (steps) => {
        const idle = new IdleDetector({ barTicks: BAR });
        let now = 0;
        for (const step of steps) {
          now += step;
          expect(idle.advance(now)).toBeGreaterThanOrEqual(0);
        }
      }),
    );
  });
});
