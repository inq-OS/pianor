import { describe, expect, it } from 'vitest';
import { createBitmap } from './bitmap';
import { LiveWaterPlayer, liveWaterAt } from './liveWater';
import { LIVE, LiveRecorder, SURF_EDGE, SURF_HIDDEN, type LiveWater } from './paint/live';

const W = 120, H = 60, HORIZON = 4, FOAM = 9;

/** A plain bay: every other row a stroke row, a glint patch, a post's band, the surf along the foot. */
function bay(): { water: LiveWater; picture: Uint8Array } {
  const picture = new Uint8Array(W * H).fill(3);
  const live = new LiveRecorder(W, H, () => picture, HORIZON, 1, FOAM);
  live.on = true;
  for (let y = HORIZON + 2; y < H - 12; y += 2) for (let x = 0; x < W; x++) live.stroke(x, y, 4, y < 20 ? 2 : 0);
  for (let y = 10; y < 14; y++) for (let x = 60; x < 70; x++) live.glint(x, y, 8, ((x >> 2) * 0.37) % 1);
  for (let y = 30; y < 40; y++) for (let x = 20; x < 40; x++) live.ring(x, y, Math.hypot(x - 30, y - 35) / 6, 0.3, 6, 5);
  for (let x = 0; x < W; x++) live.surf(x, H - 2);
  // a post painted over the water after it was recorded
  for (let y = 0; y < H; y++) picture[y * W + 50] = 1;
  return { water: live.seal({ ...createBitmap(W, H), pixels: picture }), picture };
}

function lit(water: LiveWater, t: number, gust = 2700, seed = 0): Uint8Array {
  const player = new LiveWaterPlayer(water, seed);
  const out = new Uint8Array(player.w * player.h);
  player.paint(t, gust, out);
  return out;
}

describe('ft_1_19.AC11 live water (paint/live.ts, liveWater.ts: some pixels are dynamic and generated at random)', () => {
  it('the recorder drops every pixel something was painted over after it was recorded, and keeps a hidden surf edge as hidden', () => {
    const { water } = bay();
    const { x, y } = water.layers;
    const w = water.layers.frames[0]!.width;
    const at = (layer: number, px: number, py: number) => water.layers.frames[layer]!.pixels[(py - y) * w + (px - x)];
    expect(at(LIVE.up, 50, 10)).toBe(0);
    expect(at(LIVE.up, 49, 10)).toBe(4);
    expect(at(LIVE.surf, 50, H - 2)).toBe(SURF_HIDDEN);
    expect(at(LIVE.surf, 49, H - 2)).toBe(SURF_EDGE);
  });

  it('records nothing while it is off (in the looks after the first)', () => {
    const live = new LiveRecorder(W, H, () => new Uint8Array(W * H), HORIZON, 1, FOAM);
    live.stroke(5, 5, 4);
    expect(live.seal(createBitmap(W, H)).layers.frames[0]!.width).toBe(1);
  });

  it('lights only pixels the field allows, in their own colours, and the same time and seed give the same water', () => {
    const { water } = bay();
    const a = lit(water, 5000), b = lit(water, 5000);
    expect(a).toEqual(b);
    const frames = water.layers.frames;
    const allowed = new Set([4, 2, 8, 6, 5, FOAM]);
    a.forEach((c, i) => {
      if (!c) return;
      expect(allowed.has(c)).toBe(true);
      const any = [LIVE.up, LIVE.glint, LIVE.ringAt, LIVE.surf].some((l) => frames[l]!.pixels[i] !== 0);
      expect(any).toBe(true);
    });
    expect(a.some((c) => c === 4)).toBe(true);
  });

  it('changes a little at a time: from one step to the next (66 ms) only a small share of the field changes, never all of it', () => {
    const { water } = bay();
    const fieldPixels = water.layers.frames[0]!.width * water.layers.frames[0]!.height;
    let most = 0;
    for (let t = 0; t < 20000; t += 66) {
      const a = lit(water, t), b = lit(water, t + 66);
      let changed = 0;
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) changed++;
      most = Math.max(most, changed / fieldPixels);
    }
    expect(most).toBeGreaterThan(0);
    expect(most).toBeLessThan(0.06);
  });

  it('never shows the same moment twice in a row of loops: the water a gust later is not the water now', () => {
    const { water } = bay();
    expect(lit(water, 3000)).not.toEqual(lit(water, 3000 + 2700));
    expect(lit(water, 3000)).not.toEqual(lit(water, 3000 + 2 * 2700));
  });

  it('another seed (another day) lights another sea', () => {
    const { water } = bay();
    expect(lit(water, 4000, 2700, 1)).not.toEqual(lit(water, 4000, 2700, 2));
  });

  it('liveWaterAt lays the field where it lies in the picture', () => {
    const { water } = bay();
    const at = liveWaterAt(water, 0, 2700);
    expect([at.x, at.y]).toEqual([water.layers.x, water.layers.y]);
    expect(at.bitmap.width * at.bitmap.height).toBe(at.bitmap.pixels.length);
  });
});
