import { beforeAll, describe, expect, it } from 'vitest';
import { BOAT_KINDS, PORT, PORT_MOORED, portPlan } from '../../../../core/layout/port';
import { SKY_PHASES } from '../../../../core/sky/skyPhase';
import { PALETTE } from '../palette';
import { packPort, unpackPort } from './portPack';
import { PORT_ARCHES, PORT_CLOUDS, PORT_DEEP_FRAMES, PORT_FRAMES, PORT_LANDING, paintPort, portBoats, portDeepStill, portMoorings, portPalette, portRuns, portStill, type PortPicture } from './portPicture';

const plan = portPlan();
const { w: W, h: H } = plan.fine;

describe('the painted harbour (ft_1_19.AC10)', () => {
  const pictures = {} as Record<'day' | 'night', PortPicture>;
  beforeAll(() => {
    for (const phase of ['day', 'night'] as const) pictures[phase] = paintPort(plan, phase);
  }, 120_000);

  it('ft_1_19.AC5 the palette is the game\'s own with Keri\'s runs and the reef\'s and the boats\' after it, the same places at every hour', () => {
    for (const phase of SKY_PHASES) {
      const palette = portPalette(phase);
      expect(palette.slice(0, PALETTE.length)).toEqual([...PALETTE]);
      expect(palette.length).toBeLessThanOrEqual(256);
      expect(palette.length).toBe(portPalette('day').length);
    }
    for (const run of ['coral', 'sponge', 'violet', 'hull', 'red']) expect(portRuns()[run]!.length).toBeGreaterThanOrEqual(5);
  });

  it('ft_1_19.AC10 the view on top in each look of the sea and the one under the water in each of its looks, every pixel painted', () => {
    const { frames, deep } = pictures.day;
    expect(frames).toHaveLength(PORT_FRAMES);
    expect(deep).toHaveLength(PORT_DEEP_FRAMES);
    for (const frame of [...frames, ...deep]) {
      expect([frame.width, frame.height]).toEqual([W, H]);
      expect(frame.pixels.every((p) => p >= PALETTE.length && p < pictures.day.palette.length)).toBe(true);
    }
  });

  it('ft_1_19.AC10 the two views meet: above the water the view under it is the view on top as it stands', () => {
    const { frames, deep } = pictures.day;
    const rows = PORT.water - PORT.dive;
    for (const look of deep) expect(look.pixels.subarray(0, rows * W)).toEqual(frames[0]!.pixels.subarray(PORT.dive * W, PORT.water * W));
  });

  it('ft_1_19.AC10 the quay stands on arches whose tops show above the water: dark under each crown, stone on the piers between', () => {
    const frame = pictures.day.frames[0]!;
    const stone = new Set(portRuns().stone);
    const at = (x: number, y: number): number => frame.pixels[y * W + x]!;
    expect(PORT_ARCHES.length).toBeGreaterThanOrEqual(3);
    for (const [k, arch] of PORT_ARCHES.entries()) {
      const mid = Math.round((arch.l + arch.r) / 2);
      // open under the crown, a few rows over the water; closed by the ring's stones above the crown
      for (let y = PORT.water - arch.up + 6; y < PORT.water - 1; y++) expect(stone.has(at(mid, y))).toBe(false);
      expect(stone.has(at(mid, PORT.water - arch.up - 5))).toBe(true);
      // the pier after it: stone down to the water
      const pier = Math.round((arch.r + (PORT_ARCHES[k + 1]?.l ?? arch.r + 40)) / 2);
      expect(stone.has(at(pier, PORT.water - arch.up - 5))).toBe(true);
    }
    // no two arches alike
    expect(new Set(PORT_ARCHES.map((a) => `${a.r - a.l}:${a.up}`)).size).toBe(PORT_ARCHES.length);
  });

  it('ft_1_19.AC10 the wonders under the water glow at night: the lantern corals and the chest give the deep its light', () => {
    const ember = new Set(portRuns().ember);
    const glow = (phase: 'day' | 'night'): number => portDeepStill(pictures[phase]).pixels.subarray((PORT.water - PORT.dive + 2) * W).filter((p) => ember.has(p)).length;
    expect(glow('night')).toBeGreaterThan(200);
    expect(glow('night')).toBeGreaterThan(glow('day') * 2);
  });

  it('ft_1_19.AC13 what changes its place under the water is cut out to step whole, over looks that change only in tone', () => {
    const { deep, deepThings } = pictures.night;
    expect(deepThings.frames).toHaveLength(PORT_DEEP_FRAMES);
    // the looks of what steps are not all one picture, and each lies inside the view
    expect(new Set(deepThings.frames.map((f) => f.pixels.join())).size).toBeGreaterThan(1);
    expect(deepThings.x).toBeGreaterThanOrEqual(0);
    expect(deepThings.y).toBeGreaterThanOrEqual(PORT.water - PORT.dive);
    expect(deepThings.x + deepThings.frames[0]!.width).toBeLessThanOrEqual(W);
    expect(deepThings.y + deepThings.frames[0]!.height).toBeLessThanOrEqual(H);
    // the wonders' glow is theirs: none of it is left in the looks that blend
    const ember = new Set(portRuns().ember);
    for (const look of deep) expect(look.pixels.subarray((PORT.water - PORT.dive + 2) * W).filter((p) => ember.has(p)).length).toBe(0);
    // and those looks still fill the view, every pixel painted, behind what steps
    for (const look of deep) expect(look.pixels.every((p) => p !== 0)).toBe(true);
  });

  it('ft_1_19.AC10 under the water it is rich: the reef\'s own colours cover a good part of the view, and on top only the iron\'s rust has them', () => {
    const reef = new Set([...portRuns().coral!, ...portRuns().sponge!, ...portRuns().violet!]);
    const under = portDeepStill(pictures.day).pixels.filter((p) => reef.has(p)).length;
    expect(under / (W * H)).toBeGreaterThan(0.05);
    expect(pictures.day.frames[0]!.pixels.filter((p) => reef.has(p)).length / (W * H)).toBeLessThan(0.01);
  });

  it('ft_1_19.AC10 ft_1_19.AC13 every kind of boat has one picture (the game rides it on the swell), its pennant and washing cut out for the wind; moored, the quay laid again over it hides its waterline', () => {
    for (const kind of BOAT_KINDS) {
      const boat = pictures.day.boats[kind];
      expect(boat.frames).toHaveLength(1);
      const frame = boat.frames[0]!;
      expect(frame.pixels.some((p) => p !== 0)).toBe(true);
      for (const part of boat.blown) {
        // each lies inside the boat's frame and is not painted into it
        expect(part.x).toBeGreaterThanOrEqual(0);
        expect(part.y).toBeGreaterThanOrEqual(0);
        expect(part.x + part.bitmap.width).toBeLessThanOrEqual(frame.width);
        expect(part.y + part.bitmap.height).toBeLessThanOrEqual(frame.height);
        expect(part.bitmap.pixels.some((p) => p !== 0)).toBe(true);
      }
    }
    // the houseboat's washing hangs on the wind, and the boats with a mast fly a pennant
    expect(pictures.day.boats.houseboat.blown.filter((b) => b.kind === 'hang').length).toBeGreaterThanOrEqual(4);
    for (const kind of ['sail', 'galleon'] as const) expect(pictures.day.boats[kind].blown.some((b) => b.kind === 'flag')).toBe(true);
    const { front } = pictures.day;
    const covered = (x: number, y: number): boolean => {
      const f = front.frames[0]!, fx = x - front.x, fy = y - front.y;
      return fx >= 0 && fy >= 0 && fx < f.width && fy < f.height && f.pixels[fy * f.width + fx] !== 0;
    };
    for (const m of portMoorings(plan, PORT_MOORED)) expect(covered(m.x + 20, m.y)).toBe(true);
  });

  it('ft_1_19.AC10 the boats painted alone, for a script\'s figures, are the boats the port paints, by day and lit at night', () => {
    for (const phase of ['day', 'night'] as const) expect(portBoats(plan, phase)).toEqual(pictures[phase].boats);
  });

  it('ft_1_19.AC5 at night the sky is the night\'s and the beacon is lit; by day it is not', () => {
    const lit = (p: PortPicture) => p.lamp.frames.some((f) => f.pixels.filter((c) => c !== 0).length > 20);
    expect(lit(pictures.night)).toBe(true);
    expect(lit(pictures.day)).toBe(false);
    expect(PORT_CLOUDS.length).toBeGreaterThanOrEqual(4);
  });

  it('ft_1_19.AC10 the stair ends on a low landing by the water, on round the quay\'s head: stone a little over the waterline, sea beside it', () => {
    const { l, r, top, face } = PORT_LANDING;
    expect(l).toBeLessThan(PORT.head);
    expect(r).toBeGreaterThan(PORT.head + 30);
    // low: a step or two over the water, far under the quay's top
    expect(PORT.water - top).toBeGreaterThanOrEqual(6);
    expect(PORT.water - top).toBeLessThanOrEqual(14);
    const frame = pictures.day.frames[0]!;
    const runs = portRuns(), stone = new Set<number>([...runs.stone!, ...runs.shingle!]), sea = new Set<number>(runs.sea);
    const share = (x0: number, x1: number, y0: number, y1: number, of: Set<number>): number => {
      let n = 0, all = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { all++; if (of.has(frame.pixels[y * W + x]!)) n++; }
      return n / all;
    };
    // its top and its near face are stone, past the head too, where there was water
    expect(share(l + 4, r - 16, top + 2, PORT.water - 1, stone)).toBeGreaterThan(0.75);
    expect(share(PORT.head + 24, r - 16, PORT.water + 1, PORT.water + face - 2, stone)).toBeGreaterThan(0.6);
    // under its foot the near water goes on
    expect(share(l, r, PORT.water + face + 6, PORT.water + face + 16, sea)).toBeGreaterThan(0.8);
    // under the water it stands on a footing with an opening: the view there is still all in the water's blues above the reef
    const deep = pictures.day.deep[0]!;
    const row = (PORT.water - PORT.dive + 12) * W;
    expect([...deep.pixels.subarray(row + l + 4, row + l + 14)].every((c) => sea.has(c))).toBe(true);
  });

  it('ft_1_19.AC10 what lies behind is smooth: the bare sky is one tone along each row, a place at a time down a long run; the open water has no chessboard; the stone keeps its grain', () => {
    const sky = portRuns().sky!;
    expect(sky.length).toBeGreaterThanOrEqual(20);
    const frame = pictures.day.frames[0]!;
    const places: number[] = [];
    for (let y = 0; y < PORT.horizon - 1; y++) {
      const row = frame.pixels.subarray(y * W + 60, y * W + 160);
      expect(new Set(row).size, `row ${y}`).toBe(1);
      places.push(sky.indexOf(row[0]!));
    }
    for (let i = 1; i < places.length; i++) expect(places[i]! - places[i - 1]!, `row ${i}`).toBeGreaterThanOrEqual(0);
    for (let i = 1; i < places.length; i++) expect(places[i]! - places[i - 1]!, `row ${i}`).toBeLessThanOrEqual(1);
    expect(new Set(places).size).toBeGreaterThanOrEqual(18);
    // the open water past the quay's head has no chessboard of two tones (the kit's dither, taken out)
    const sea = new Set<number>(portRuns().sea);
    let boards = 0, blocks = 0;
    for (let y = PORT.horizon + 4; y < PORT.deck; y++) for (let x = PORT.head + 24; x < W - 1; x++) {
      const [p, q, r, t] = [frame.pixels[y * W + x]!, frame.pixels[y * W + x + 1]!, frame.pixels[(y + 1) * W + x]!, frame.pixels[(y + 1) * W + x + 1]!];
      if (![p, q, r, t].every((c) => sea.has(c))) continue;
      blocks++;
      if (p === t && q === r && p !== q) boards++;
    }
    expect(blocks).toBeGreaterThan(2000);
    expect(boards / blocks).toBeLessThan(0.02);
    // the quay's face under the coping is a thing: a row of it holds more than one tone of the stone
    const stone = new Set<number>(portRuns().stone);
    const face = [...frame.pixels.subarray((PORT.deck + 20) * W + 60, (PORT.deck + 20) * W + 160)].filter((c) => stone.has(c));
    expect(new Set(face).size).toBeGreaterThanOrEqual(3);
  });

  it('ft_1_24.AC7 it packs for the trip from the build to the game and unpacks the same', () => {
    const picture = pictures.day;
    const back = unpackPort(JSON.parse(JSON.stringify(packPort(picture))) as ReturnType<typeof packPort>);
    expect(back.palette).toEqual(picture.palette);
    expect(back.deep.map((d) => [...d.pixels])).toEqual(picture.deep.map((d) => [...d.pixels]));
    expect(back.deepThings).toEqual(picture.deepThings);
    expect([...back.boats.launch.frames[0]!.pixels]).toEqual([...picture.boats.launch.frames[0]!.pixels]);
    expect(back.boats.houseboat.blown.map((b) => [b.kind, b.x, b.y, ...b.bitmap.pixels])).toEqual(picture.boats.houseboat.blown.map((b) => [b.kind, b.x, b.y, ...b.bitmap.pixels]));
    expect([...portStill(back, plan, PORT_MOORED).pixels]).toEqual([...portStill(picture, plan, PORT_MOORED).pixels]);
  });
});
