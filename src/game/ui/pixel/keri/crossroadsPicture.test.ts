import { beforeAll, describe, expect, it } from 'vitest';
import keriJson from '../../../../../content/world/keri.json';
import { crossroadsEye, crossroadsPlace, crossroadsPlan, onPicture, toCrossroads } from '../../../../core/layout/crossroads';
import { SKY_PHASES } from '../../../../core/sky/skyPhase';
import { loadWorld } from '../../../../core/world/world';
import { PALETTE } from '../palette';
import { packCrossroads, unpackCrossroads } from './crossroadsPack';
import { CROSSROADS_CLOUDS, crossroadsPalette, crossroadsRuns, paintCrossroads, type CrossroadsPicture } from './crossroadsPicture';

const KERI = loadWorld(keriJson);
const plan = crossroadsPlan();
const { w: W, h: H } = plan.fine;

describe('the painted crossroads', () => {
  const pictures = {} as Record<'day' | 'night', CrossroadsPicture>;
  // one hour a hook, each with its own two minutes: both in one hook ran past them on a CI runner
  beforeAll(() => {
    pictures.day = paintCrossroads(KERI, plan, 'day');
  }, 120_000);
  beforeAll(() => {
    pictures.night = paintCrossroads(KERI, plan, 'night');
  }, 120_000);
  const runOf = (name: string): ReadonlySet<number> => new Set(crossroadsRuns()[name]);

  it('ft_1_19.AC5 its palette is the game\'s own with Keri\'s runs and its own after it, the same places at every hour, within a byte', () => {
    for (const phase of SKY_PHASES) {
      const palette = crossroadsPalette(phase);
      expect(palette.slice(0, PALETTE.length)).toEqual([...PALETTE]);
      expect(palette.length).toBeLessThanOrEqual(256);
      expect(palette.length).toBe(crossroadsPalette('day').length);
    }
  });

  it('ft_1_19.AC1 it is the band\'s size, in one look (its sea is lit and its gulls flown by the game), the sky bare where the clouds drift', () => {
    const p = pictures.day;
    expect(p.frames).toHaveLength(1);
    for (const f of p.frames) expect([f.width, f.height]).toEqual([W, H]);
    // every pixel is painted, none left clear
    expect(p.frames[0]!.pixels.every((c) => c >= PALETTE.length)).toBe(true);
    // the clouds are their own pictures, one for each spec, and the top of the sky is bare sky
    expect(p.clouds).toHaveLength(CROSSROADS_CLOUDS.length);
    const sky = runOf('sky');
    let bare = 0;
    for (let x = 0; x < W; x++) if (sky.has(p.frames[0]!.pixels[2 * W + x]!)) bare++;
    expect(bare / W).toBeGreaterThan(0.9);
    // the ground stands still for now, so with the sea lit by the game there is no second look
  });

  it('ft_1_19.AC1 the fork\'s slabs show in the middle, in the summer grass round them', () => {
    const p = pictures.day.frames[0]!;
    const fork = onPicture(toCrossroads(crossroadsEye(KERI), crossroadsPlace(KERI)));
    // the slabs' concrete is the stone's greys and the smoke's cool pale (the picked cobbled look)
    const stone = runOf('stone'), smoke = runOf('smoke'), green = runOf('grass'), dry = runOf('dry');
    let slab = 0, grass = 0;
    for (let dy = 4; dy < 14; dy++) for (let dx = -6; dx <= 6; dx++) {
      const c = p.pixels[Math.round(fork.y + dy) * W + Math.round(fork.x + dx)]!;
      if (stone.has(c) || smoke.has(c)) slab++;
    }
    expect(slab).toBeGreaterThan(40);
    // the open field left of the stem, between the near foliage at the corner and the path
    for (let y = H - 58; y < H - 38; y++) for (let x = 140; x < 220; x++) if (green.has(p.pixels[y * W + x]!) || dry.has(p.pixels[y * W + x]!)) grass++;
    expect(grass / 1600).toBeGreaterThan(0.5);
  });

  it('ft_1_19.AC1 the lighthouse stands in the sky right of the fork: its iron above the horizon, and lit at night', () => {
    const lighthouse = onPicture(toCrossroads(crossroadsEye(KERI), KERI.places.lighthouse));
    const iron = runOf('iron');
    const column = (p: CrossroadsPicture) => Array.from({ length: plan.horizon }, (_, y) => p.frames[0]!.pixels[y * W + Math.round(lighthouse.x)]!);
    expect(column(pictures.day).filter((c) => iron.has(c)).length).toBeGreaterThan(10);
    // the lamp burns at night: a colour of the embers' run in the lantern
    const ember = runOf('ember');
    const lit = (p: CrossroadsPicture) => {
      let n = 0;
      for (let y = 0; y < plan.horizon - 40; y++) for (let x = Math.round(lighthouse.x) - 8; x < lighthouse.x + 8; x++) if (ember.has(p.frames[0]!.pixels[y * W + x]!)) n++;
      return n;
    };
    expect(lit(pictures.day)).toBe(0);
    expect(lit(pictures.night)).toBeGreaterThan(5);
  });

  it('ft_1_19.AC1 no shadow is laid over its corners: the lower corners are grass and the upper ones sky (d111)', () => {
    const p = pictures.day.frames[0]!;
    const sky = runOf('sky'), ink = new Set([crossroadsRuns().near![0]]);
    for (const x of [1, W - 2]) expect(sky.has(p.pixels[1 * W + x]!)).toBe(true);
    let dark = 0;
    for (let y = H - 6; y < H; y++) for (let x = 0; x < W; x++) if (ink.has(p.pixels[y * W + x])) dark++;
    expect(dark / (6 * W)).toBeLessThan(0.3);
  });

  it('ft_1_19.AC1 it packs for the build and unpacks to the same picture', () => {
    const p = pictures.night;
    const back = unpackCrossroads(JSON.parse(JSON.stringify(packCrossroads(p))));
    expect(back.palette).toEqual(p.palette);
    back.frames.forEach((f, i) => expect(f.pixels).toEqual(p.frames[i]!.pixels));
    expect(back.clouds.map((c) => [c.x, c.y])).toEqual(p.clouds.map((c) => [c.x, c.y]));
    expect(back.fore.frames.length).toBe(p.fore.frames.length);
  });
});
