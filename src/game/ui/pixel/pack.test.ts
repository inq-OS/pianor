import { describe, expect, it } from 'vitest';
import { loadedOnce, packPixels, unpackBitmap } from './pack';
import { bayer, hash2 } from './paint/noise';

const roundTrip = (pixels: Uint8Array): Uint8Array => unpackBitmap(packPixels(pixels), pixels.length, 1).pixels;

describe('packing a painted picture into text and back (ft_1_18.AC3)', () => {
  it('ft_1_18.AC3 every picture comes back as it went in: nothing, one pixel, noise, long runs and far repeats', () => {
    const noise = Uint8Array.from({ length: 5000 }, (_, i) => Math.floor(hash2(i, 7, 1) * 115));
    const flat = new Uint8Array(70000).fill(9);
    const repeat = new Uint8Array(140000);
    for (let i = 0; i < repeat.length; i++) repeat[i] = noise[i % 3000]!;
    // a repeat further back than the packer reaches: it is written out again
    const far = new Uint8Array(140000);
    far.set(noise.subarray(0, 600));
    far.set(noise.subarray(0, 600), 139000);
    for (const pixels of [new Uint8Array(0), Uint8Array.of(5), Uint8Array.of(1, 1), noise, flat, repeat, far]) expect(roundTrip(pixels)).toEqual(pixels);
  });

  it('ft_1_18.AC3 a dithered picture packs to a fraction of its size, as text a script can hold', () => {
    const w = 640, h = 248;
    const pixels = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) pixels[y * w + x] = 54 + Math.floor(x / 80) + (bayer(x, y) > (y / h) ? 1 : 0);
    const text = packPixels(pixels);
    expect(text).toMatch(/^[A-Za-z0-9+/]*=*$/);
    expect(text.length).toBeLessThan(pixels.length / 8);
    const back = unpackBitmap(text, w, h);
    expect([back.width, back.height]).toEqual([w, h]);
    expect(back.pixels).toEqual(pixels);
  });

  it('ft_1_18.AC3 text that does not hold a picture of the size asked for is refused', () => {
    expect(() => unpackBitmap(packPixels(new Uint8Array(10)), 3, 3)).toThrow();
  });
});

describe('loading the pictures of each hour when a scene opens (ft_1_24.AC7)', () => {
  const loaders = (calls: string[], fail = new Set<string>()) => ({
    day: () => { calls.push('load D'); return fail.has('day') ? Promise.reject(new Error('offline')) : Promise.resolve({ default: 'D' }); },
    night: () => { calls.push('load N'); return Promise.resolve({ default: 'N' }); },
  });

  it('ft_1_24.AC7 a picture is not there until it is loaded, then unpacked once and the same one after', async () => {
    const calls: string[] = [];
    const pictures = loadedOnce(loaders(calls), (packed) => { calls.push(`unpack ${packed}`); return { packed }; });
    expect(pictures.ready('day')).toBeNull();
    const day = await pictures.load('day');
    expect(pictures.ready('day')).toBe(day);
    expect(await pictures.load('day')).toBe(day);
    expect(pictures.ready('night')).toBeNull();
    expect(calls).toEqual(['load D', 'unpack D']);
  });

  it('ft_1_24.AC7 asking twice while it loads loads it once', async () => {
    const calls: string[] = [];
    const pictures = loadedOnce(loaders(calls), (packed) => ({ packed }));
    const [a, b] = await Promise.all([pictures.load('night'), pictures.load('night')]);
    expect(a).toBe(b);
    expect(calls).toEqual(['load N']);
  });

  it('ft_1_24.AC7 a load that failed is tried again the next time', async () => {
    const calls: string[] = [];
    const fail = new Set(['day']);
    const pictures = loadedOnce(loaders(calls, fail), (packed) => ({ packed }));
    await expect(pictures.load('day')).rejects.toThrow('offline');
    fail.clear();
    expect(await pictures.load('day')).toEqual({ packed: 'D' });
    expect(calls).toEqual(['load D', 'load D']);
  });
});
