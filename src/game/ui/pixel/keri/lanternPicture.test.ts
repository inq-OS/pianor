import { beforeAll, describe, expect, it } from 'vitest';
import keriJson from '../../../../../content/world/keri.json';
import { lanternPlan } from '../../../../core/layout/lantern';
import { SKY_PHASES } from '../../../../core/sky/skyPhase';
import { loadWorld } from '../../../../core/world/world';
import { PALETTE } from '../palette';
import { packLantern, unpackLantern } from './lanternPack';
import { LANTERN_CLOUDS, LANTERN_FRAMES, LIGHT_LOOKS, lanternPalette, lanternRuns, paintLantern, type LanternPicture } from './lanternPicture';

const KERI = loadWorld(keriJson);
const plan = lanternPlan();
const { w: W, h: H } = plan.fine;

describe('the painted lantern over Keri, the main menu\'s picture (ft_1_07)', () => {
  const pictures = {} as Record<'day' | 'night', LanternPicture>;
  beforeAll(() => {
    for (const phase of ['day', 'night'] as const) pictures[phase] = paintLantern(KERI, plan, phase);
  }, 120_000);

  it('the palette is the game\'s own with Keri\'s runs and the lantern\'s iron after it, the same places at every hour', () => {
    for (const phase of SKY_PHASES) {
      const palette = lanternPalette(phase);
      expect(palette.slice(0, PALETTE.length)).toEqual([...PALETTE]);
      expect(palette.length).toBeLessThanOrEqual(256);
      expect(palette.length).toBe(lanternPalette('day').length);
    }
    expect(lanternRuns().iron!.length).toBeGreaterThanOrEqual(5);
  });

  it('one picture in each look of the sea, every pixel painted, the lantern in its iron and grand: a large share of the picture', () => {
    const { frames } = pictures.day;
    expect(frames).toHaveLength(LANTERN_FRAMES);
    for (const frame of frames) {
      expect([frame.width, frame.height]).toEqual([W, H]);
      expect(frame.pixels.every((p) => p >= PALETTE.length && p < pictures.day.palette.length)).toBe(true);
    }
    const iron = new Set(lanternRuns().iron);
    const used = frames[0]!.pixels.filter((p) => iron.has(p)).length;
    expect(used / (W * H)).toBeGreaterThan(0.05);
  });

  it('the island lies under the horizon left of the lantern: meadow, shingle and the sea round it', () => {
    const frame = pictures.day.frames[0]!;
    const runs = lanternRuns();
    const share = (run: readonly number[], x0: number, x1: number, y0: number, y1: number) => {
      const set = new Set(run);
      let n = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (set.has(frame.pixels[y * W + x]!)) n++;
      return n / ((x1 - x0) * (y1 - y0));
    };
    const left = plan.lantern.x - plan.lantern.ring;
    expect(share(runs.grass!, 0, left, plan.horizon, H)).toBeGreaterThan(0.02);
    // the shingle round it; since the meadow stands on its bank (at least 3 if not 4 metres higher than the waterline) the bank's dark scrub covers some of what was shingle
    expect(share(runs.shingle!, 0, left, plan.horizon, H)).toBeGreaterThan(0.05);
    expect(share(runs.bush!, 0, left, plan.horizon, H)).toBeGreaterThan(0.02);
    expect(share(runs.sea!, 0, left, plan.horizon, H)).toBeGreaterThan(0.2);
    // nothing of the land stands in the sky's upper half
    expect(share([...runs.grass!, ...runs.shingle!], 0, left, 0, plan.horizon >> 1)).toBe(0);
  });

  it('the looks move the sea, never the sky; the clouds are their own pictures that drift over the bare sky', () => {
    const [a, b] = pictures.day.frames;
    let sky = 0, below = 0;
    for (let i = 0; i < W * H; i++) {
      if (a!.pixels[i] === b!.pixels[i]) continue;
      if (i < (plan.horizon - 2) * W) sky++;
      else below++;
    }
    // most of the sea is lit by the game now (`paint/live.ts`); the looks still roll its swell
    expect(below).toBeGreaterThan(100);
    expect(sky).toBe(0);
    expect(pictures.day.clouds).toHaveLength(LANTERN_CLOUDS.length);
    const cloudy = new Set(lanternRuns().cloud);
    expect(a!.pixels.slice(0, (plan.horizon - 2) * W).some((p) => cloudy.has(p))).toBe(false);
  });

  it('the light is a small glint on the lens by day and burns at night, with its beam out over the island, flickering through its looks', () => {
    const lit = (p: LanternPicture) => p.light.frames.map((f) => f.pixels.filter((v) => v).length);
    expect(pictures.day.light.frames).toHaveLength(LIGHT_LOOKS);
    expect(Math.max(...lit(pictures.day))).toBeLessThan(120);
    expect(Math.min(...lit(pictures.night))).toBeGreaterThan(1500);
    expect(new Set(lit(pictures.night)).size).toBeGreaterThan(1);
    // the light sits where the plan has it
    const { light } = pictures.night;
    expect(plan.light.x).toBeGreaterThan(light.x);
    expect(plan.light.x).toBeLessThan(light.x + light.frames[0]!.width);
    expect(plan.light.y).toBeGreaterThan(light.y);
    expect(plan.light.y).toBeLessThan(light.y + light.frames[0]!.height);
  });

  it('packed for the build and unpacked in the game, the picture is the same', () => {
    const back = unpackLantern(JSON.parse(JSON.stringify(packLantern(pictures.night))) as ReturnType<typeof packLantern>);
    expect(back.palette).toEqual(pictures.night.palette);
    expect(back.frames.map((f) => [...f.pixels])).toEqual(pictures.night.frames.map((f) => [...f.pixels]));
    expect([...back.light.frames[1]!.pixels]).toEqual([...pictures.night.light.frames[1]!.pixels]);
    expect(back.clouds.map((c) => [c.x, c.y])).toEqual(pictures.night.clouds.map((c) => [c.x, c.y]));
  });
});
