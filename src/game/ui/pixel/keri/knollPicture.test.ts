import { beforeAll, describe, expect, it } from 'vitest';
import keriJson from '../../../../../content/world/keri.json';
import { KNOLL_FIRE, KNOLL_PLATEAU, knollCrest, knollPlan, knollShore } from '../../../../core/layout/knoll';
import { SKY_PHASES } from '../../../../core/sky/skyPhase';
import { loadWorld } from '../../../../core/world/world';
import { PALETTE } from '../palette';
import { scenePalette } from './keriPalette';
import { packKnoll, unpackKnoll } from './knollPack';
import { EMBER_LOOKS, KNOLL_CLOUDS, KNOLL_FRAMES, KNOLL_LOGS, KNOLL_SMOKE, knollPalette, logSpine, paintKnoll, type KnollPicture } from './knollPicture';
import { liveWaterAt } from '../liveWater';
import { GUST_MS } from '../windMotion';

const KERI = loadWorld(keriJson);
const plan = knollPlan();
const { w: W, h: H } = plan.fine;
type Rgb = [number, number, number];
const rgb = (c: number): Rgb => [(c >> 16) & 255, (c >> 8) & 255, c & 255];

describe('the painted knoll with the bonfire place (ft_1_19.AC9)', () => {
  const pictures = {} as Record<'day' | 'night', KnollPicture>;
  beforeAll(() => {
    for (const phase of ['day', 'night'] as const) pictures[phase] = paintKnoll(KERI, plan, phase);
  }, 120_000);
  const colourAt = (p: KnollPicture, x: number, y: number, frame = 0) => rgb(p.palette[p.frames[frame]!.pixels[Math.round(y) * W + Math.round(x)]!]!);
  /** The share of the pixels of a box that pass `test`. */
  const share = (p: KnollPicture, box: { x: number; y: number; w: number; h: number }, test: (c: Rgb) => boolean): number => {
    let n = 0;
    for (let y = box.y; y < box.y + box.h; y++) for (let x = box.x; x < box.x + box.w; x++) if (test(colourAt(p, x, y))) n++;
    return n / (box.w * box.h);
  };
  const green = ([r, g, b]: Rgb) => g > b + 12 && g > r * 0.75;
  const blue = ([r, g, b]: Rgb) => b > r + 20 && b >= g;

  it('ft_1_19.AC9 the knoll\'s palette is the game\'s own with the knoll\'s colours after it; by day no colour is there twice', () => {
    for (const phase of SKY_PHASES) {
      const palette = knollPalette(phase);
      expect(palette.slice(0, PALETTE.length)).toEqual([...PALETTE]);
      expect(palette.length).toBeLessThanOrEqual(256);
      expect(palette.length).toBe(knollPalette('day').length);
    }
    const shades = knollPalette('day').slice(PALETTE.length);
    expect(shades.length).toBeGreaterThan(40);
    expect(new Set(shades).size).toBe(shades.length);
  });

  it('ft_1_19.AC9 it is pixel art of Keri\'s runs, not a rendered picture: what shades off does so through a whole run, between neighbours only (d111)', () => {
    const { fine } = scenePalette();
    for (const phase of ['day', 'night'] as const) {
      const used = new Set<number>();
      for (const frame of pictures[phase].frames) frame.pixels.forEach((p) => used.add(p));
      expect(Math.min(...used)).toBeGreaterThanOrEqual(PALETTE.length);
      // long runs: the sky, the sea and the grass are painted in most of their colours, not in four or five
      for (const name of ['sky', 'sea', 'grass'] as const) expect(fine[name].filter((place) => used.has(place)).length, `${name} at ${phase}`).toBeGreaterThanOrEqual(9);
    }
    // by day the sky shades off evenly down to the horizon: a row holds one of its colours, or two that are neighbours
    const frame = pictures.day.frames[0]!;
    const seen = new Set<number>();
    for (let y = 0; y < plan.horizon - 1; y++) {
      const row = new Set<number>();
      for (let x = 0; x < W; x++) { const at = fine.sky.indexOf(frame.pixels[y * W + x]!); if (at >= 0) row.add(at); }
      expect(row.size, `row ${y}`).toBeGreaterThanOrEqual(1);
      expect(Math.max(...row) - Math.min(...row), `row ${y}`).toBeLessThanOrEqual(1);
      row.forEach((at) => seen.add(at));
    }
    expect(seen.size).toBeGreaterThanOrEqual(9);
  });

  it('ft_1_19.AC1 ft_1_19.AC9 the picture fills its size in each look: sky, a wide sea across the whole picture, the green plateau below', () => {
    const { frames } = pictures.day;
    // one look: the sea is lit by the game (`paint/live.ts`) and the gulls are flown by it (`flock.ts`); the ground stands still
    expect(frames).toHaveLength(1);
    for (const frame of frames) {
      expect([frame.width, frame.height]).toEqual([W, H]);
      expect(frame.pixels.every((p) => p > 0 && p < pictures.day.palette.length)).toBe(true);
    }
    // the sky's top is blue by day
    expect(share(pictures.day, { x: 200, y: 0, w: 300, h: 8 }, blue)).toBeGreaterThan(0.7);
    // the sea: blue from the horizon down for at least 24 rows, at the left, in the middle and at the right
    for (const x of [220, 300, 500]) expect(share(pictures.day, { x, y: plan.horizon + 1, w: 40, h: 24 }, blue), `sea at ${x}`).toBeGreaterThan(0.75);
    // the sea ends at the plateau's lip where it stands before the shore, and where the world model's shore is past the cut
    const shore = knollShore(KERI);
    for (const x of [540, 600]) {
      const edge = Math.round(shore[x]!.water);
      expect(edge).toBeLessThan(knollCrest(x));
      expect(share(pictures.day, { x: x - 6, y: edge - 22, w: 12, h: 8 }, blue), `sea over the shore at ${x}`).toBeGreaterThan(0.6);
      expect(share(pictures.day, { x: x - 6, y: edge + 3, w: 12, h: 6 }, blue), `land under it at ${x}`).toBeLessThan(0.2);
    }
    // the plateau is green under its lip and down to the picture's foot
    expect(share(pictures.day, { x: 150, y: Math.ceil(knollCrest(150)) + 6, w: 50, h: 30 }, green)).toBeGreaterThan(0.6);
    expect(share(pictures.day, { x: 400, y: Math.ceil(knollCrest(450)) + 14, w: 50, h: 30 }, green)).toBeGreaterThan(0.6);
    expect(share(pictures.day, { x: 200, y: 190, w: 240, h: 50 }, green)).toBeGreaterThan(0.7);
  });

  it('ft_1_19.AC9 the plateau\'s lip stands before the sea: over it the sea, under it the grass, from the roses to where it cuts off', () => {
    // the knoll is a plateau: one could sit on its edge and hang one's feet over it
    for (let x = 220; x < KNOLL_PLATEAU.shoulder.x - 4; x += 20) {
      if (Math.abs(x - KNOLL_FIRE.x) < KNOLL_FIRE.rx + 16) continue;
      const crest = knollCrest(x);
      expect(share(pictures.day, { x: x - 3, y: Math.floor(crest) - 20, w: 6, h: 6 }, blue), `over the crest at ${x}`).toBeGreaterThan(0.5);
      expect(share(pictures.day, { x: x - 3, y: Math.ceil(crest) + 4, w: 6, h: 6 }, blue), `under the crest at ${x}`).toBe(0);
    }
    expect(KNOLL_PLATEAU.top.y).toBeGreaterThan(plan.horizon);
  });

  it('ft_1_19.AC9 the grass is alive: blades of many tones beside each other all over the hill, never a flat ground with tufts on it', () => {
    // the ground had been flat with tufts springing out of it, all or nothing with
    // nothing in between. Measured on the reference's grass: a colour runs 1.3 to 1.6 pixels before it changes.
    const frame = pictures.day.frames[0]!;
    for (const box of [{ x: 150, y: 150, w: 60, h: 24 }, { x: 420, y: 170, w: 60, h: 24 }, { x: 260, y: 200, w: 60, h: 24 }, { x: 250, y: 140, w: 60, h: 12 }]) {
      const tones = new Set<number>();
      let runs = 0;
      for (let y = box.y; y < box.y + box.h; y++) for (let x = box.x; x < box.x + box.w; x++) {
        const c = frame.pixels[y * W + x]!;
        tones.add(c);
        if (x === box.x || c !== frame.pixels[y * W + x - 1]) runs++;
      }
      expect(tones.size, `tones at ${box.x}, ${box.y}`).toBeGreaterThanOrEqual(8);
      expect((box.w * box.h) / runs, `a colour's run at ${box.x}, ${box.y}`).toBeLessThan(2);
    }
    // the ground swells: down the hill the light does not fall evenly, it rises again at a swell's top
    const light = (y: number): number => {
      let sum = 0;
      for (let x = 120; x < 240; x++) sum += colourAt(pictures.day, x, y).reduce((a, b) => a + b, 0);
      return sum / 120;
    };
    let rises = 0;
    for (let y = 150; y < 236; y += 4) if (light(y + 4) > light(y) + 4) rises++;
    expect(rises).toBeGreaterThanOrEqual(2);
  });

  it('ft_1_19.AC9 the land carries on to the left and does not drop off; tall dog roses close the left side; below the cut on the right is rocky shore', () => {
    // the left side continues and does not drop off, with dog roses in front of it (corner cover), while the lower
    // land in the right-back is rocky shore; the dog rose is at least 3 m high
    const land = ([, g, b]: Rgb) => g > b + 12;
    // (not under the trunk, which stands over the lip from x 95 to 140)
    for (const x of [160, 190, 220]) {
      const crest = Math.ceil(knollCrest(x));
      expect(crest, `the crest at ${x}`).toBeLessThan(KNOLL_PLATEAU.top.y + 12);
      expect(share(pictures.day, { x: Math.max(0, x - 5), y: crest + 3, w: 10, h: 24 }, land), `green under the lip at ${x}`).toBeGreaterThan(0.85);
    }
    // the roses stand taller than the viewer: at the left edge they reach over the horizon into the sky
    const leaves = new Set([scenePalette().run.near[1], ...scenePalette().run.bush]);
    let leafy = 0;
    for (let y = plan.horizon - 14; y < plan.horizon; y++) for (let x = 0; x < 24; x++) if (leaves.has(pictures.day.frames[0]!.pixels[y * W + x])) leafy++;
    expect(leafy / (24 * 14)).toBeGreaterThan(0.8);
    // the roses: pink flowers in the lower left corner and nowhere else
    const rose = new Set(scenePalette().run.rose);
    const flowers = (x0: number, x1: number): number => {
      let n = 0;
      for (let y = 0; y < H; y++) for (let x = x0; x < x1; x++) if (rose.has(pictures.day.frames[0]!.pixels[y * W + x]!)) n++;
      return n;
    };
    expect(flowers(0, 240)).toBeGreaterThan(60);
    expect(flowers(240, W)).toBe(0);
    // right-back, below the cut: grey stone between the water's edge and the bank's top (dark earth), no meadow
    const shore = knollShore(KERI);
    const grey = ([r, g, b]: Rgb) => Math.abs(r - g) < 30 && Math.abs(g - b) < 36 && r > 70;
    const x = 600, from = Math.round(shore[x]!.water) + 8, to = Math.floor(knollCrest(x - 10)) - 14;
    expect(to - from).toBeGreaterThan(12);
    expect(share(pictures.day, { x: x - 10, y: from, w: 40, h: to - from }, grey)).toBeGreaterThan(0.8);
  });

  it('ft_1_19.AC9 the bonfire place: grey stones round dark ash, and embers that glow by day and by night in three strengths', () => {
    const box = { x: KNOLL_FIRE.x - KNOLL_FIRE.rx - 8, y: KNOLL_FIRE.y - KNOLL_FIRE.ry - 10, w: KNOLL_FIRE.rx * 2 + 16, h: KNOLL_FIRE.ry * 2 + 14 };
    // by day the stones are grey: neither green nor blue
    expect(share(pictures.day, box, ([r, g, b]) => Math.abs(r - g) < 24 && Math.abs(g - b) < 30 && r > 70)).toBeGreaterThan(0.2);
    for (const phase of ['day', 'night'] as const) {
      const { embers, palette } = pictures[phase];
      expect(embers.frames).toHaveLength(EMBER_LOOKS.length);
      const [first] = embers.frames;
      // the embers and their warm pool lie round the plan's fire: the ring and the trodden ground about it, no further
      expect(embers.x).toBeLessThan(plan.fire.x);
      expect(embers.x + first!.width).toBeGreaterThan(plan.fire.x);
      expect(embers.y).toBeLessThanOrEqual(plan.fire.y);
      expect(embers.y + first!.height).toBeGreaterThanOrEqual(plan.fire.y);
      expect(embers.x).toBeGreaterThanOrEqual(box.x - 40);
      expect(embers.x + first!.width).toBeLessThanOrEqual(box.x + box.w + 40);
      const glowing = (frame: typeof first) => frame!.pixels.filter((p) => {
        if (p === 0) return false;
        const [r, g, b] = rgb(palette[p]!);
        return r > 180 && g > 60 && b < 140 && r > b + 80;
      }).length;
      for (const frame of embers.frames) expect(glowing(frame), phase).toBeGreaterThan(12);
      // each strength is brighter than the one before
      const light = (frame: typeof first) => frame!.pixels.reduce((sum, p) => sum + (p === 0 ? 0 : rgb(palette[p]!).reduce((a, b) => a + b, 0)), 0);
      expect(light(embers.frames[1])).toBeGreaterThan(light(embers.frames[0]));
      expect(light(embers.frames[2])).toBeGreaterThan(light(embers.frames[1]));
    }
    // by night the embers light the stones round them more than by day
    const lit = (p: KnollPicture) => p.embers.frames[1]!.pixels.filter((c) => c !== 0).length;
    expect(lit(pictures.night)).toBeGreaterThan(lit(pictures.day) * 1.5);
  });

  it('ft_1_19.AC1 the left side is closed by placed things (dry stems, tall dog roses), never by a laid-on shadow; the right side is left open to the sea', () => {
    const sky = (c: Rgb) => blue(c) || (c[0] > 150 && c[1] > 160 && c[2] > 180);
    // upper left: the dry stems and their seed heads
    expect(1 - share(pictures.day, { x: 0, y: 0, w: 70, h: 64 }, sky)).toBeGreaterThan(0.08);
    // lower left: the roses' leaves, dark as a near thing is (the art review: a day with no dark wings)
    const dark = ([r, g, b]: Rgb) => r + g + b < 260;
    expect(share(pictures.day, { x: 0, y: H - 60, w: 70, h: 60 }, dark)).toBeGreaterThan(0.6);
    // the right side is open (it is not a strict rule to have something there; it can be left
    // open, a nice sea scene): sky to the corner, the sea to the edge, grass below
    expect(share(pictures.day, { x: W - 60, y: 0, w: 60, h: 64 }, sky)).toBeGreaterThan(0.97);
    expect(share(pictures.day, { x: W - 60, y: 88, w: 60, h: 20 }, blue)).toBeGreaterThan(0.8);
    // below: the plateau's side and the shingle under it, no sea
    expect(share(pictures.day, { x: W - 60, y: H - 60, w: 60, h: 60 }, (c) => !blue(c))).toBeGreaterThan(0.9);
    // and the picture's edges are as light as its middle: nothing is laid over them
    const light = (box: { x: number; y: number; w: number; h: number }) => {
      let sum = 0;
      for (let y = box.y; y < box.y + box.h; y++) for (let x = box.x; x < box.x + box.w; x++) sum += colourAt(pictures.day, x, y).reduce((a, b) => a + b, 0);
      return sum / (box.w * box.h);
    };
    expect(light({ x: 150, y: 0, w: 80, h: 8 })).toBeGreaterThan(light({ x: 280, y: 0, w: 80, h: 8 }) * 0.85);
    // the sea stays open: right of the stems nothing stands before the horizon
    expect(share(pictures.day, { x: 150, y: plan.horizon + 2, w: W - 150, h: 10 }, blue)).toBeGreaterThan(0.8);
  });

  it('ft_1_19.AC9 the trodden ground round the fire is no circle, and logs to sit on lie round it, clear of the beings\' places', () => {
    // the trodden ground round the bonfire is no perfect circle, with a few logs
    // people sit on
    const earth = new Set(scenePalette().run.earth);
    const frame = pictures.day.frames[0]!;
    // how far the bare earth reaches from the fire in the directions toward the viewer, as a share of an even oval
    const reach = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 2.9].map((angle) => {
      let last = 0;
      for (let k = 0.7; k < 2.4; k += 0.02) {
        const x = Math.round(KNOLL_FIRE.x + Math.cos(angle) * 66 * k), y = Math.round(KNOLL_FIRE.y + 3 + Math.sin(angle) * 15 * k);
        if (earth.has(frame.pixels[y * W + x]!)) last = k;
        else if (k - last > 0.3) break;
      }
      return last;
    });
    // an even oval's reach would be the same all round; this one's differs by half and more
    expect(Math.max(...reach) / Math.max(0.5, Math.min(...reach))).toBeGreaterThan(1.5);
    // the logs are found trunks, not made ones (the first logs looked as if they came out of a factory): each bent,
    // thinner at its tip, no two of one length or bend; wood along each one's middle; none where a being stands
    const wood = new Set([...scenePalette().run.earth, ...scenePalette().run.shingle]);
    expect(KNOLL_LOGS.length).toBeGreaterThanOrEqual(3);
    const lengths = KNOLL_LOGS.map((l) => Math.hypot(l.b[0] - l.a[0], l.b[1] - l.a[1]));
    lengths.forEach((long, i) => lengths.slice(0, i).forEach((other) => expect(Math.abs(long - other)).toBeGreaterThan(2)));
    expect(new Set(KNOLL_LOGS.map((l) => l.bend)).size).toBe(KNOLL_LOGS.length);
    for (const log of KNOLL_LOGS) {
      expect(Math.abs(log.bend), `bend of the log at ${log.a[0]}`).toBeGreaterThanOrEqual(2);
      expect(log.taper, `taper of the log at ${log.a[0]}`).toBeLessThan(0.7);
      // its middle line leaves the straight line between its ends
      const mid = logSpine(log, 0.5);
      expect(Math.hypot(mid.x - (log.a[0] + log.b[0]) / 2, mid.y - (log.a[1] + log.b[1]) / 2)).toBeGreaterThanOrEqual(2);
    }
    for (const log of KNOLL_LOGS.filter((l) => !l.back)) {
      let on = 0;
      for (let k = 2; k <= 8; k++) {
        const at = logSpine(log, k / 10);
        if (wood.has(frame.pixels[Math.round(at.y) * W + Math.round(at.x)]!)) on++;
      }
      expect(on, `log at ${log.a[0]}`).toBeGreaterThanOrEqual(5);
      for (const { feet } of plan.spots) {
        const x0 = Math.min(log.a[0], log.b[0]) - log.r, x1 = Math.max(log.a[0], log.b[0]) + log.r, y0 = Math.min(log.a[1], log.b[1]) - log.r, y1 = Math.max(log.a[1], log.b[1]) + log.r;
        expect(feet.x + 8 < x0 || feet.x - 8 > x1 || feet.y + 3 < y0 || feet.y - 3 > y1, `log at ${log.a[0]} and the being at ${feet.x}`).toBe(true);
      }
    }
  });

  it('ft_1_19.AC8 where the beings stand the ground is clear: short grass under a being\'s feet, no bush, boulder or tall clump', () => {
    for (const { feet } of plan.spots) {
      const here = share(pictures.day, { x: feet.x - 8, y: feet.y - 3, w: 16, h: 6 }, ([r, g, b]) => g > b + 8 && r + g + b > 200);
      expect(here).toBeGreaterThan(0.7);
    }
  });

  it('ft_1_19.AC9 ft_1_19.AC5 the sea moves as the game lights it, from moment to moment, while the ground and the fire place stand still', () => {
    const { frames, embers, water } = pictures.day;
    const wide = embers.frames[0]!.width;
    const atFire = (x: number, y: number): boolean => {
      const ex = x - embers.x, ey = y - embers.y;
      return ex >= 0 && ex < wide && ey >= 0 && ey < embers.frames[0]!.height && embers.frames.some((f) => f.pixels[ey * wide + ex] !== 0);
    };
    for (const t of [0, 700, 1400]) {
      const a = liveWaterAt(water, t, GUST_MS[1]!), b = liveWaterAt(water, t + 700, GUST_MS[1]!);
      let fire = 0, sea = 0, ground = 0;
      a.bitmap.pixels.forEach((p, i) => {
        if (p === b.bitmap.pixels[i]) return;
        const x = a.x + (i % a.bitmap.width), y = a.y + Math.floor(i / a.bitmap.width);
        if (atFire(x, y)) fire++;
        if (y > plan.horizon + 2 && y < plan.horizon + 30) sea++;
        // the near ground, well below the sea and the shore: the grass stands still for now
        if (y > plan.horizon + 60) ground++;
      });
      expect(sea, `the sea at ${t} ms`).toBeGreaterThan(300);
      expect(ground, `the ground at ${t} ms`).toBe(0);
      expect(fire, `the fire place at ${t} ms`).toBe(0);
    }
    expect(frames).toHaveLength(1);
  });
  it('ft_1_19.AC1 a tree that is not on Keri overhangs the plateau from the left: a dark crown over the upper left, clear of the fire\'s smoke and the sea', () => {
    // a tree like the one in the first 1991 game's picture overhangs the knoll from the
    // left (no such tree stands on Keri)
    const sky = (c: Rgb) => blue(c) || (c[0] > 150 && c[1] > 160 && c[2] > 180);
    const leaf = (c: Rgb) => green(c) || c[0] + c[1] + c[2] < 200;
    // the crown fills the upper left, out to the long limb's end, with the sky showing between its tiers
    const crown = { x: 0, y: 4, w: 240, h: 44 };
    expect(share(pictures.day, crown, leaf)).toBeGreaterThan(0.6);
    expect(share(pictures.day, crown, sky)).toBeGreaterThan(0.02);
    // it stops short of the column the smoke rises in, and the sky to the right of it stays open
    expect(share(pictures.day, { x: KNOLL_FIRE.x - 8, y: 0, w: 16, h: plan.horizon - 2 }, sky)).toBeGreaterThan(0.9);
    // dark against the night sky as against the day's: it reads by its outline first
    const dark = ([r, g, b]: Rgb) => r + g + b < 160;
    expect(share(pictures.night, { x: 40, y: 20, w: 160, h: 24 }, dark)).toBeGreaterThan(0.5);
  });

  it('ft_1_19.AC9 the clouds are their own pictures over a bare sky, and what stands before the sky is laid over them in each look', () => {
    const { frames, clouds, fore, palette } = pictures.day;
    expect(clouds).toHaveLength(KNOLL_CLOUDS.length);
    clouds.forEach((c, i) => {
      expect([c.x, c.y]).toEqual([...KNOLL_CLOUDS[i]!.at]);
      expect(c.bitmap.pixels.some((p) => p !== 0)).toBe(true);
    });
    // no cloud tone is painted into the sky of a look: they drift over it in the game
    const cloudTones = new Set(clouds.flatMap((c) => [...c.bitmap.pixels].filter((p) => p !== 0)));
    for (const frame of frames) {
      let inSky = 0;
      for (let i = 0; i < W * (plan.horizon - 2); i++) if (cloudTones.has(frame.pixels[i]!)) inSky++;
      expect(inSky).toBe(0);
    }
    // the front layer: a look for each look, holding the stems' seed heads in the upper left corner, each pixel as the look has it
    expect(fore.frames).toHaveLength(1);
    fore.frames.forEach((f, k) => {
      let n = 0;
      f.pixels.forEach((p, i) => {
        if (p === 0) return;
        n++;
        const x = fore.x + (i % f.width), y = fore.y + Math.floor(i / f.width);
        expect(p).toBe(frames[k]!.pixels[y * W + x]);
      });
      expect(n).toBeGreaterThan(200);
    });
    expect(fore.x).toBeLessThan(40);
    expect(fore.y + fore.frames[0]!.height).toBeLessThanOrEqual(plan.horizon + 1);
    expect(Math.max(...clouds.map((c) => c.y + c.bitmap.height))).toBeLessThanOrEqual(plan.horizon);
    expect(palette.length).toBeGreaterThan(0);
  });

  it('ft_1_14.AC8 ft_1_19.AC5 at night the knoll is dark under the moon and the stars, and the embers are its brightest warm thing', () => {
    const bright = (p: KnollPicture): number => {
      let sum = 0;
      for (let i = 0; i < W * H; i += 7) { const [r, g, b] = rgb(p.palette[p.frames[0]!.pixels[i]!]!); sum += r + g + b; }
      return sum;
    };
    expect(bright(pictures.day)).toBeGreaterThan(bright(pictures.night) * 2);
    expect(share(pictures.night, { x: 200, y: 190, w: 240, h: 50 }, ([r, g, b]) => r + g + b < 260)).toBeGreaterThan(0.85);
    // the moon and stars: pale pixels in the night's sky, none by day
    const pale = ([r, g, b]: Rgb) => r > 200 && g > 200 && b > 170;
    expect(share(pictures.night, { x: 300, y: 4, w: 200, h: 44 }, pale)).toBeGreaterThan(0.01);
    const warm = ([r, g, b]: Rgb) => r > 200 && g > 80 && b < 90;
    expect(share(pictures.night, { x: 0, y: KNOLL_FIRE.y + KNOLL_FIRE.ry + 8, w: W, h: H - KNOLL_FIRE.y - KNOLL_FIRE.ry - 8 }, warm)).toBe(0);
    expect(pictures.night.embers.frames[1]!.pixels.some((p) => p !== 0 && warm(rgb(pictures.night.palette[p]!)))).toBe(true);
  });

  it('ft_1_19.AC9 the smoke\'s tones are the palette\'s pale greys at every hour', () => {
    for (const p of [pictures.day, pictures.night]) expect(p.smoke).toEqual(KNOLL_SMOKE);
    const light = (c: number) => rgb(pictures.day.palette[c]!).reduce((a, b) => a + b, 0);
    expect(light(KNOLL_SMOKE.light)).toBeGreaterThan(light(KNOLL_SMOKE.mid));
    expect(light(KNOLL_SMOKE.mid)).toBeGreaterThan(light(KNOLL_SMOKE.shade));
  });

  it('ft_1_19.AC9 the packed knoll the build hands the game unpacks to the same pictures', () => {
    const packed = packKnoll(pictures.night);
    // grass made of blades packs worse than flat ground: under half a character for a pixel of each look
    expect(JSON.stringify(packed).length).toBeLessThan((W * H * KNOLL_FRAMES) / 2);
    const back = unpackKnoll(JSON.parse(JSON.stringify(packed)) as typeof packed);
    expect(back.palette).toEqual(pictures.night.palette);
    back.frames.forEach((frame, i) => expect(frame.pixels).toEqual(pictures.night.frames[i]!.pixels));
    expect([back.embers.x, back.embers.y]).toEqual([pictures.night.embers.x, pictures.night.embers.y]);
    back.embers.frames.forEach((frame, i) => expect(frame).toEqual(pictures.night.embers.frames[i]));
    expect(back.fore).toEqual(pictures.night.fore);
    expect(back.clouds).toEqual(pictures.night.clouds);
    expect(back.smoke).toEqual(pictures.night.smoke);
  });
});
