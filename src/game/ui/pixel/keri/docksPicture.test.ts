import { beforeAll, describe, expect, it } from 'vitest';
import keriJson from '../../../../../content/world/keri.json';
import { docksPlan } from '../../../../core/layout/docks';
import { SKY_PHASES } from '../../../../core/sky/skyPhase';
import { loadWorld } from '../../../../core/world/world';
import { PALETTE } from '../palette';
import { packDocks, unpackDocks } from './docksPack';
import { DOCKS_CLOUDS, DOCKS_FRAMES, LAMP_LOOKS, docksPalette, docksRuns, paintDocks, type DocksPicture } from './docksPicture';

const KERI = loadWorld(keriJson);
const plan = docksPlan();
const { w: W, h: H } = plan.fine;

describe('the painted docks (ft_1_19)', () => {
  const pictures = {} as Record<'day' | 'night', DocksPicture>;
  beforeAll(() => {
    for (const phase of ['day', 'night'] as const) pictures[phase] = paintDocks(KERI, plan, phase);
  }, 120_000);

  it('ft_1_19.AC5 the palette is the game\'s own with Keri\'s runs and the jetty\'s wood after it, the same places at every hour', () => {
    for (const phase of SKY_PHASES) {
      const palette = docksPalette(phase);
      expect(palette.slice(0, PALETTE.length)).toEqual([...PALETTE]);
      expect(palette.length).toBeLessThanOrEqual(256);
      expect(palette.length).toBe(docksPalette('day').length);
    }
    expect(docksRuns().wood!.length).toBeGreaterThanOrEqual(6);
  });

  it('ft_1_19.AC1 one picture in each look of the sea, every pixel painted, the jetty in the wood\'s colours', () => {
    const { frames } = pictures.day;
    expect(frames).toHaveLength(DOCKS_FRAMES);
    for (const frame of frames) {
      expect([frame.width, frame.height]).toEqual([W, H]);
      expect(frame.pixels.every((p) => p >= PALETTE.length && p < pictures.day.palette.length)).toBe(true);
    }
    const wood = new Set(docksRuns().wood);
    const used = frames[0]!.pixels.filter((p) => wood.has(p)).length;
    expect(used / (W * H)).toBeGreaterThan(0.04);
  });

  it('ft_1_19.AC5 the looks move the sea and the surf, never the sky; the clouds are their own pictures that drift over the bare sky', () => {
    const [a, b] = pictures.day.frames;
    let sky = 0, below = 0;
    for (let i = 0; i < W * H; i++) {
      if (a!.pixels[i] === b!.pixels[i]) continue;
      if (i < (plan.horizon - 2) * W) sky++;
      else below++;
    }
    // most of the sea is lit by the game now (`paint/live.ts`); the looks still roll its swell
    expect(below).toBeGreaterThan(100);
    // nothing above the horizon changes: the gulls are flown by the game (`flock.ts`)
    expect(sky).toBeLessThan(40);
    expect(pictures.day.clouds).toHaveLength(DOCKS_CLOUDS.length);
    const cloudy = new Set(docksRuns().cloud);
    const top = a!.pixels.slice(0, (plan.horizon - 2) * W);
    expect(top.some((p) => cloudy.has(p))).toBe(false);
  });

  it('ft_1_19.AC5 the lamp at the jetty\'s end is dark by day and glows at night, flickering through its looks', () => {
    const lit = (p: DocksPicture) => p.lamp.frames.map((f) => f.pixels.filter((v) => v).length);
    expect(pictures.night.lamp.frames).toHaveLength(LAMP_LOOKS);
    expect(Math.max(...lit(pictures.day))).toBeLessThanOrEqual(1);
    expect(Math.min(...lit(pictures.night))).toBeGreaterThan(40);
    expect(new Set(lit(pictures.night)).size).toBeGreaterThan(1);
    // the glow lies round the lantern, warming the tower beside it: the lantern is inside it, and it reaches no further
    // than a lamp's pool
    const { x, y } = pictures.night.lamp;
    const { width, height } = pictures.night.lamp.frames[0]!;
    expect(plan.lamp.x).toBeGreaterThan(x);
    expect(plan.lamp.x).toBeLessThan(x + width);
    expect(plan.lamp.y).toBeGreaterThan(y);
    expect(plan.lamp.y).toBeLessThan(y + height);
    expect(Math.max(width, height)).toBeLessThan(90);
  });

  it('ft_1_19.AC1 no shadow is laid over the picture: its corners are as light as the things painted there (art-direction rule 7)', () => {
    // the upper corners are open sky by day, as light as the sky's top
    const frame = pictures.day.frames[0]!;
    const palette = pictures.day.palette;
    const light = (i: number) => { const c = palette[frame.pixels[i]!]!; return ((c >> 16) & 255) + ((c >> 8) & 255) + (c & 255); };
    expect(light(2 * W + 2)).toBeGreaterThan(300);
    expect(light(2 * W + W - 3) + light(2 * W + W - 60)).toBeGreaterThan(300);
  });

  it('ft_1_19.AC1 it travels packed from the build to the game and comes back the same', () => {
    const back = unpackDocks(JSON.parse(JSON.stringify(packDocks(pictures.night))) as ReturnType<typeof packDocks>);
    expect(back.palette).toEqual(pictures.night.palette);
    expect(back.frames.map((f) => [...f.pixels])).toEqual(pictures.night.frames.map((f) => [...f.pixels]));
    expect(back.clouds.map((c) => [c.x, c.y, c.bitmap.width])).toEqual(pictures.night.clouds.map((c) => [c.x, c.y, c.bitmap.width]));
    expect(back.lamp.frames.map((f) => [...f.pixels])).toEqual(pictures.night.lamp.frames.map((f) => [...f.pixels]));
  });
});
