// Covers core_13.AC1, core_13.AC5, core_13.AC7.
import { describe, expect, it } from 'vitest';
import { clickRing, ringPoint } from '../../../core/layout/beat';
import { BEAT_RING_SIZE, paceColour, paintBeatRing } from './beatRingArt';
import { C } from './palette';

const at = (pixels: Uint8Array, place: number, beats: number, radius = 11.5): number => {
  const centre = (BEAT_RING_SIZE - 1) / 2;
  const p = ringPoint(place, beats, radius);
  return pixels[Math.round(centre + p.y) * BEAT_RING_SIZE + Math.round(centre + p.x)]!;
};

describe('paintBeatRing', () => {
  it('core_13.AC1 paints the dot of the click just heard blue and the others grey, the first beat in ink', () => {
    const pixels = new Uint8Array(BEAT_RING_SIZE * BEAT_RING_SIZE);
    paintBeatRing(clickRing({ beatInBar: 2, atMs: 0, intervalMs: 500 }, 4, 0), pixels);
    expect(at(pixels, 2, 4)).toBe(C.blue);
    expect(at(pixels, 1, 4)).toBe(C.lock);
    expect(at(pixels, 0, 4)).toBe(C.ink);
  });

  it('core_13.AC5 colours a key and its mark by the pace kept: green in step, orange a little off, red far off', () => {
    expect(paceColour({ side: 'even', far: false })).toBe(C.leaf);
    expect(paceColour({ side: 'early', far: false })).toBe(C.orange);
    expect(paceColour({ side: 'late', far: true })).toBe(C.red);
    const pixels = new Uint8Array(BEAT_RING_SIZE * BEAT_RING_SIZE);
    paintBeatRing({ beats: 4, lit: 1, glow: 1, hand: 1, mark: { side: 'early', far: true, at: 0.5 } }, pixels);
    expect(at(pixels, 1, 4)).toBe(C.red);
    expect(at(pixels, 0.5, 4, 6)).toBe(C.red);
    expect(at(pixels, 2.5, 4)).toBe(C.red); // the whole circle, not only the dot
    paintBeatRing({ beats: 4, lit: 1, glow: 1, hand: 1, mark: { side: 'even', far: false, at: 1 } }, pixels);
    expect(at(pixels, 2.5, 4)).toBe(C.lock);
  });
});

describe('paintBeatRing at any size', () => {
  it('core_13.AC7 scales the ring to the room it is given on the parchment', () => {
    const size = 96;
    const pixels = new Uint8Array(size * size);
    paintBeatRing(clickRing({ beatInBar: 1, atMs: 0, intervalMs: 500 }, 4, 0), pixels, size);
    const centre = (size - 1) / 2;
    const p = ringPoint(1, 4, 11.5 * 3);
    expect(pixels[Math.round(centre + p.y) * size + Math.round(centre + p.x)]).toBe(C.blue);
  });
});
