import { describe, expect, it } from 'vitest';
import { C } from './palette';
import { STAND_ART, chordBoard, listeningEar, noteInSight, scaleSteps } from './standArt';

const count = (pixels: Uint8Array, colour: number) => pixels.filter((p) => p === colour).length;

describe("the stand's pictures (ft_1_08.AC11)", () => {
  it('ft_1_08.AC11 each picture fills its 64 x 48 fine pixels with a fat thing and clear round it', () => {
    for (const picture of [listeningEar(), noteInSight(), scaleSteps(), chordBoard()]) {
      expect([picture.width, picture.height]).toEqual([STAND_ART.w, STAND_ART.h]);
      const drawn = picture.pixels.length - count(picture.pixels, C.clear);
      expect(drawn).toBeGreaterThan(picture.pixels.length * 0.35);
      expect(count(picture.pixels, C.clear)).toBeGreaterThan(0);
    }
  });

  it('ft_1_08.AC11 the ear is skin with sound running into it, the sight a brass ring with red cross hairs round a black note', () => {
    const ear = listeningEar().pixels, sight = noteInSight().pixels;
    for (const colour of [C.skin, C.skinShade, C.goldLight, C.gold]) expect(count(ear, colour)).toBeGreaterThan(10);
    for (const colour of [C.gold, C.red, C.ink, C.downShade]) expect(count(sight, colour)).toBeGreaterThan(10);
  });

  it('ft_1_08.AC11 the rim of each thing is its own colour gone dark, never a black line round all of it', () => {
    for (const picture of [listeningEar(), noteInSight(), scaleSteps(), chordBoard()]) {
      const { width, height, pixels } = picture;
      let edge = 0, black = 0;
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const c = pixels[y * width + x]!;
        if (c === C.clear) continue;
        const open = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => pixels[(y + dy!) * width + x + dx!] === C.clear || x + dx! < 0 || x + dx! >= width || y + dy! < 0 || y + dy! >= height);
        if (!open) continue;
        edge++;
        if (c === C.ink) black++;
      }
      expect(black / edge).toBeLessThan(0.25);
    }
  });

  it('ft_1_08.AC11 the same picture every time', () => {
    expect(listeningEar().pixels).toEqual(listeningEar().pixels);
    expect(noteInSight().pixels).toEqual(noteInSight().pixels);
    expect(scaleSteps().pixels).toEqual(scaleSteps().pixels);
  });
});
