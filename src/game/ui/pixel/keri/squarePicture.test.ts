import { beforeAll, describe, expect, it } from 'vitest';
import { squarePlan } from '../../../../core/layout/square';
import { SKY_PHASES } from '../../../../core/sky/skyPhase';
import { PALETTE } from '../palette';
import { packSquare, unpackSquare } from './squarePack';
import { SQUARE_CLOUDS, SQUARE_LAMP_LOOKS, paintSquare, squarePalette, squareRuns, type SquarePicture } from './squarePicture';

const plan = squarePlan();
const { w: W, h: H } = plan.fine;

describe('the painted village square (ft_1_19)', () => {
  const pictures = {} as Record<'day' | 'night', SquarePicture>;
  beforeAll(() => {
    for (const phase of ['day', 'night'] as const) pictures[phase] = paintSquare(plan, phase);
  }, 120_000);

  it('ft_1_19.AC5 the palette is the game\'s own with Keri\'s runs and the houses\' colours after it, the same places at every hour', () => {
    for (const phase of SKY_PHASES) {
      const palette = squarePalette(phase);
      expect(palette.slice(0, PALETTE.length)).toEqual([...PALETTE]);
      expect(palette.length).toBeLessThanOrEqual(256);
      expect(palette.length).toBe(squarePalette('day').length);
    }
    for (const run of ['plaster', 'tin', 'boards', 'red']) expect(squareRuns()[run]!.length).toBeGreaterThanOrEqual(5);
  });

  it('ft_1_19.AC1 one picture, every pixel painted; the two houses on the left do not share a roof\'s colour', () => {
    const frame = pictures.day.frames[0]!;
    expect([frame.width, frame.height]).toEqual([W, H]);
    expect(frame.pixels.every((p) => p >= PALETTE.length && p < pictures.day.palette.length)).toBe(true);
    const count = (run: readonly number[], x0: number, x1: number, y0: number, y1: number): number => {
      const tones = new Set(run);
      let n = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (tones.has(frame.pixels[y * W + x]!)) n++;
      return n;
    };
    const { tin, red } = squareRuns();
    // the side building's roof, upper left, is blue tin; the cinema house's, past its corner, is red
    expect(count(tin!, 0, 120, 0, 90)).toBeGreaterThan(count(red!, 0, 120, 0, 90) * 4);
    expect(count(red!, 160, 260, 94, 122)).toBeGreaterThan(count(tin!, 160, 260, 94, 122) * 4);
  });

  it('ft_1_19.AC1 the pier\'s box holds the pier: stone lies in it over the sea', () => {
    const frame = pictures.day.frames[0]!;
    const stone = new Set(squareRuns().stone);
    const { pier } = plan;
    let n = 0;
    for (let y = pier.y; y < pier.y + pier.h; y++) for (let x = pier.x; x < pier.x + pier.w; x++) if (stone.has(frame.pixels[y * W + x]!)) n++;
    expect(n).toBeGreaterThan(200);
  });

  it('ft_1_19.AC5 the clouds are their own pictures that drift over a bare sky', () => {
    expect(pictures.day.clouds).toHaveLength(SQUARE_CLOUDS.length);
    const cloudy = new Set(squareRuns().cloud);
    const top = pictures.day.frames[0]!.pixels.slice(0, (plan.horizon - 2) * W);
    expect(top.some((p) => cloudy.has(p))).toBe(false);
  });

  it('ft_1_19.AC5 the lantern and the cinema\'s doors are dark by day and glow at night, flickering through their looks', () => {
    const lit = (picture: SquarePicture): number => picture.lamp.frames.reduce((n, f) => n + f.pixels.filter((p) => p !== 0).length, 0);
    expect(pictures.night.lamp.frames).toHaveLength(SQUARE_LAMP_LOOKS);
    expect(lit(pictures.night)).toBeGreaterThan(300);
    expect(lit(pictures.day)).toBeLessThan(10);
    const [a, b] = pictures.night.lamp.frames;
    expect(a!.pixels.some((p, i) => p !== b!.pixels[i])).toBe(true);
  });

  it('ft_1_19.AC1 the hour changes the colours, not the drawing: the houses stand where they stood', () => {
    // the ink of the side building's eave is the same row by day and at night
    const ink = (picture: SquarePicture, x: number): number => {
      const tin = squareRuns().tin!;
      for (let y = 0; y < H; y++) if (picture.frames[0]!.pixels[y * W + x] === tin[0]) return y;
      return -1;
    };
    expect(ink(pictures.night, 80)).toBe(ink(pictures.day, 80));
    expect(ink(pictures.day, 80)).toBeGreaterThan(0);
  });

  it('ft_1_19.AC1 it travels packed from the build to the game and comes back the same', () => {
    const back = unpackSquare(JSON.parse(JSON.stringify(packSquare(pictures.night))) as ReturnType<typeof packSquare>);
    expect(back.palette).toEqual(pictures.night.palette);
    expect(back.frames[0]!.pixels).toEqual(pictures.night.frames[0]!.pixels);
    expect(back.lamp.frames).toHaveLength(pictures.night.lamp.frames.length);
    expect(back.clouds).toHaveLength(pictures.night.clouds.length);
    expect(back.gull).toBe(pictures.night.gull);
  });
});
