import { describe, expect, it } from 'vitest';
import { SMOKE_FRAME_MS, SMOKE_LOOP_MS, THREAD, smokeFrames, smokeThread } from './smoke';

const TONES = { light: 11, mid: 12, root: 13, shade: 14 };
const FOOT = { x: 200, y: 150 };

/** The thread at a moment as rows: each row's drawn columns. */
function rows(timeMs: number, wind: number): Map<number, number[]> {
  const out = new Map<number, number[]>();
  smokeThread(timeMs, wind, -1, FOOT, TONES, (x, y) => out.set(y, [...(out.get(y) ?? []), x]));
  return out;
}

describe('smoke as one thin thread, here over the knoll\'s embers (ft_1_19.AC9)', () => {
  it('ft_1_19.AC9 it rises from the embers as one unbroken line, one or two pixels wide where it does not swing, and breaks up only toward its top', () => {
    for (const time of [0, 1300, 5200]) {
      const r = rows(time, 1);
      // no gap in its lower third
      for (let k = 0; k < THREAD.rise * 0.3; k++) expect(r.has(FOOT.y - 3 - k), `row ${k} at ${time} ms`).toBe(true);
      // thin: never more than a few pixels in a row, and one just over the embers
      for (const xs of r.values()) expect(new Set(xs).size).toBeLessThanOrEqual(5);
      expect(r.get(FOOT.y - 3)).toHaveLength(1);
      // pieces missing near its top
      let missing = 0;
      for (let k = Math.round(THREAD.rise * 0.6); k <= THREAD.rise; k++) if (!r.has(FOOT.y - 3 - k)) missing++;
      expect(missing).toBeGreaterThan(3);
    }
  });

  it('ft_1_19.AC9 ft_1_06.AC12 the wind bends its top east (to the viewer\'s left): more in more wind, and in a calm it rises over the embers', () => {
    const top = (wind: number): number => {
      let sum = 0, n = 0;
      for (const time of [0, 1000, 2000, 3000]) for (const [y, xs] of rows(time, wind)) if (FOOT.y - y > THREAD.rise * 0.5) { sum += xs[0]!; n++; }
      return sum / n - FOOT.x;
    };
    expect(Math.abs(top(0))).toBeLessThan(4);
    expect(top(1)).toBeLessThan(-8);
    expect(top(3)).toBeLessThan(top(1) - 20);
  });

  it('ft_1_19.AC9 its waves run up it: the loop comes round without a jump, and the frames differ', () => {
    const at = (t: number) => JSON.stringify([...rows(t, 2)]);
    expect(at(SMOKE_LOOP_MS)).toEqual(at(0));
    expect(at(SMOKE_FRAME_MS)).not.toEqual(at(0));
  });

  it('ft_1_06.AC12 where the wind blows to the right in a view, the thread bends right', () => {
    const o = smokeFrames(2, 1, FOOT, TONES);
    expect(o.x).toBeGreaterThan(FOOT.x - 24);
    expect(o.x + o.frames[0]!.width).toBeGreaterThan(FOOT.x + 1.5 * THREAD.drift);
  });

  it('ft_1_19.AC9 its frames lie in one box over the embers, in its own tones only', () => {
    const o = smokeFrames(2, -1, FOOT, TONES);
    expect(o.frames).toHaveLength(SMOKE_LOOP_MS / SMOKE_FRAME_MS);
    expect(o.y + o.frames[0]!.height).toBeLessThanOrEqual(FOOT.y);
    expect(o.y).toBeGreaterThanOrEqual(FOOT.y - THREAD.rise - 4);
    expect(o.x).toBeLessThan(FOOT.x - 1.5 * THREAD.drift);
    const tones = new Set(o.frames.flatMap((f) => [...f.pixels]));
    expect([...tones].sort()).toEqual([0, 11, 12, 13, 14]);
  });
  it('ft_1_19.AC9 a lower thread (a grill\'s wisp) is the same thread drawn smaller: it ends at its own height and winds and bends less', () => {
    const rise = 46;
    const span = (r?: number): { top: number; left: number; right: number } => {
      let top = Infinity, left = Infinity, right = -Infinity;
      for (let t = 0; t < SMOKE_LOOP_MS; t += 500) smokeThread(t, 2, -1, FOOT, TONES, (x, y) => { top = Math.min(top, y); left = Math.min(left, x); right = Math.max(right, x); }, r);
      return { top, left, right };
    };
    const low = span(rise), tall = span();
    expect(low.top).toBeGreaterThanOrEqual(FOOT.y - 3 - rise);
    expect(tall.top).toBeLessThan(FOOT.y - THREAD.rise + 12);
    expect(low.right - low.left).toBeLessThan((tall.right - tall.left) * 0.6);
    const o = smokeFrames(2, -1, FOOT, TONES, rise);
    expect(o.y).toBeGreaterThanOrEqual(FOOT.y - rise - 4);
  });
});
