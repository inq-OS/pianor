import { describe, expect, it } from 'vitest';
import { grain } from './grain';

describe('grain: the scatter of scanned paint (MI2 atlas, mi2-manner point 1)', () => {
  const run = [10, 11, 12, 13, 14];
  const flat = (): Uint8Array => new Uint8Array(64 * 32).fill(12);

  it('ft_1_19.AC5 moves pixels of a run to near tones of it, both ways, and leaves the most where they were', () => {
    const px = flat();
    grain(px, 64, [run], { seed: 7 });
    const counts = new Map<number, number>();
    for (const v of px) counts.set(v, (counts.get(v) ?? 0) + 1);
    expect([...counts.keys()].sort()).toEqual([10, 11, 12, 13, 14]);
    expect(counts.get(12)! / px.length).toBeGreaterThan(0.35);
    expect((counts.get(10)! + counts.get(14)!) / px.length).toBeLessThan(0.15);
    expect(counts.get(11)! / px.length).toBeGreaterThan(0.1);
    expect(counts.get(13)! / px.length).toBeGreaterThan(0.1);
  });

  it('ft_1_19.AC5 makes lone pixels and short level dashes, not a checkerboard', () => {
    const px = flat();
    grain(px, 64, [run], { seed: 3 });
    let lone = 0, checker = 0;
    for (let y = 1; y < 31; y++) for (let x = 1; x < 63; x++) {
      const v = px[y * 64 + x]!;
      const n = [px[y * 64 + x - 1], px[y * 64 + x + 1], px[(y - 1) * 64 + x], px[(y + 1) * 64 + x]];
      if (n.every((u) => u !== v)) lone++;
      if (px[y * 64 + x + 1] !== v && px[(y + 1) * 64 + x] !== v && px[(y + 1) * 64 + x + 1] === v) checker++;
    }
    expect(lone / (62 * 30)).toBeGreaterThan(0.08);
    expect(checker / (62 * 30)).toBeLessThan(0.1);
  });

  it('ft_1_19.AC5 leaves colours of no run, the ends of a run past its end, and kept pixels alone; the same seed gives the same grain', () => {
    const px = new Uint8Array(64 * 8).fill(99);
    grain(px, 64, [run], { seed: 1 });
    expect(px.every((v) => v === 99)).toBe(true);
    const ends = new Uint8Array(64 * 8).fill(10);
    grain(ends, 64, [run], { seed: 1 });
    expect(ends.every((v) => v >= 10 && v <= 12)).toBe(true);
    const kept = flat();
    grain(kept, 64, [run], { seed: 5, keep: () => true });
    expect(kept.every((v) => v === 12)).toBe(true);
    const a = flat(), b = flat();
    grain(a, 64, [run], { seed: 9 });
    grain(b, 64, [run], { seed: 9 });
    expect(a).toEqual(b);
  });

  it('ft_1_19.AC5 a run with a longer dash lays its grain in level strokes', () => {
    const short = flat(), long = flat();
    grain(short, 64, [run], { seed: 4 });
    grain(long, 64, [{ run, dash: 3 }], { seed: 4 });
    const breaks = (px: Uint8Array): number => { let n = 0; for (let i = 1; i < px.length; i++) if (i % 64 && px[i] !== px[i - 1]) n++; return n; };
    expect(breaks(long)).toBeLessThan(breaks(short) * 0.6);
  });
});
