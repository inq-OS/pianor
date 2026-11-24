import { describe, expect, it } from 'vitest';
import { createBitmap } from '../bitmap';
import { GROUND_MOVES, groundLook, gust, lean, paintLooks, paintStillOnce, SkyMask, StillPart, swing, twinkle } from './motion';

describe('the motion every painted place shares (ft_1_19.AC9, ft_1_14.AC9)', () => {
  it('ft_1_14.AC9 a gust runs the wind\'s way through the looks: where it is strongest moves left when the wind blows left, right when it blows right', () => {
    const strongest = (look: number, way: -1 | 1): number => {
      let best = 0, at = 0;
      for (let x = 0; x < 300; x++) { const g = gust(x, 100, look, 8, way); if (g > best) { best = g; at = x; } }
      return at;
    };
    const step = (way: -1 | 1) => ((strongest(1, way) - strongest(0, way) + 450) % 300) - 150;
    expect(step(-1)).toBeLessThan(0);
    expect(step(1)).toBeGreaterThan(0);
  });

  it('ft_1_14.AC9 a blade leans the wind\'s way, the same in every look while the ground stands still', () => {
    expect(GROUND_MOVES).toBe(false);
    const leans = Array.from({ length: 8 }, (_, look) => lean(50, 100, look, 8, -1));
    for (const l of leans) expect(l).toBeCloseTo(leans[0]!);
    expect(leans[0]).toBeLessThan(0);
    expect(lean(50, 100, 3, 8, 1)).toBeGreaterThan(0);
    expect(groundLook(5)).toBe(0);
  });

  it('ft_1_14.AC9 the gust a moving ground would follow is stronger in some looks than in others, and the loop comes round', () => {
    const gusts = Array.from({ length: 8 }, (_, look) => gust(50, 100, look, 8, -1));
    expect(Math.min(...gusts)).toBeLessThan(Math.max(...gusts) - 0.5);
    expect(gust(50, 100, 8, 8, -1)).toBeCloseTo(gusts[0]!);
  });

  it('keeps one look of a picture in which nothing moves, and every look of one in which something does', () => {
    const mask = new SkyMask(4, 2);
    const flat = (c: number) => ({ width: 4, height: 2, pixels: new Uint8Array(8).fill(c) });
    expect(paintLooks(8, mask, 2, () => flat(5)).frames).toHaveLength(1);
    expect(paintLooks(8, mask, 2, (look) => flat(5 + (look % 2))).frames).toHaveLength(8);
  });

  it('ft_1_19.AC9 the sea\'s swing goes once round a loop, and each glint is lit in some looks and dark in others', () => {
    expect(swing(0, 8)).toBeCloseTo(0);
    expect(swing(2, 8)).toBeCloseTo(1);
    expect(swing(6, 8)).toBeCloseTo(-1);
    for (const seed of [0.1, 0.5, 0.93]) {
      const lit = Array.from({ length: 8 }, (_, look) => twinkle(seed, look, 8)).filter(Boolean).length;
      expect(lit).toBeGreaterThan(0);
      expect(lit).toBeLessThan(8);
    }
  });

  it('ft_1_19.AC9 the sky mask lifts out of each look what stands before the bare sky, in the rows asked for only', () => {
    const w = 6, h = 4, mask = new SkyMask(w, h);
    const { frames, fore } = paintLooks(2, mask, 2, (look) => {
      const b = createBitmap(w, h);
      mask.sky = true;
      for (let i = 0; i < w * h; i++) { b.pixels[i] = 1; mask.put(i); }
      mask.sky = false;
      // a stem before the sky, one column further in the second look, and the ground below
      for (const y of [0, 1, 2, 3]) { b.pixels[y * w + 2 + look] = 5; mask.put(y * w + 2 + look); }
      return b;
    });
    expect(frames).toHaveLength(2);
    expect([fore.x, fore.y]).toEqual([2, 0]);
    expect(fore.frames.map((f) => [...f.pixels])).toEqual([[5, 0, 5, 0], [0, 5, 0, 5]]);
  });

  it('a still part is painted in the first look only and laid again, pixel and marks, in the later ones, the same as painted afresh', () => {
    const w = 5, h = 3;
    const paint = (once: boolean) => {
      paintStillOnce(once);
      const mask = new SkyMask(w, h), part = new StillPart(w * h);
      let calls = 0;
      const { frames, fore } = paintLooks(4, mask, h, (look) => {
        const b = createBitmap(w, h), owner = new Uint16Array(w * h);
        const put = (i: number, c: number): void => { b.pixels[i] = c; mask.put(i); owner[i] = c * 10; part.touch(i); };
        // the sea moves under the ground: a band that steps along each look
        mask.sky = true;
        for (let i = 0; i < w * h; i++) put(i, 1 + ((i + look) % 3));
        mask.sky = false;
        // the ground stands still, over the sea, and paints one pixel twice (the last put stays)
        part.paint(() => [b.pixels, owner, mask.marked], () => {
          calls++;
          put(0, 7); put(6, 8); put(6, 9);
        });
        // what is laid after the part sees the part as painted
        b.pixels[12] = b.pixels[6]! + owner[0]!;
        return b;
      });
      return { frames: frames.map((f) => [...f.pixels]), fore: fore.frames.map((f) => [...f.pixels]), calls };
    };
    let full: ReturnType<typeof paint>;
    try {
      full = paint(false);
    } finally {
      paintStillOnce(true);
    }
    const once = paint(true);
    expect(once.frames).toEqual(full.frames);
    expect(once.fore).toEqual(full.fore);
    expect(full.calls).toBe(4);
    expect(once.calls).toBe(1);
    // the part's pixels stand in every look; the sea round them moves
    expect(once.frames.every((f) => f[0] === 7 && f[6] === 9 && f[12] === 79)).toBe(true);
    expect(once.frames[1]).not.toEqual(once.frames[0]);
  });

  it('a still part is painted afresh in every look while painting it once is off', () => {
    const part = new StillPart(4);
    let calls = 0;
    paintStillOnce(false);
    try {
      for (let look = 0; look < 3; look++) part.paint(() => [new Uint8Array(4)], () => { calls++; });
    } finally {
      paintStillOnce(true);
    }
    expect(calls).toBe(3);
  });
});
