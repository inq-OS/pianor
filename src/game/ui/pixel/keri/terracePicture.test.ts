import { beforeAll, describe, expect, it } from 'vitest';
import keriJson from '../../../../../content/world/keri.json';
import { LONG_EYE, TERRACE, TOWER, onTower, terraceFloor, terracePlan, terraceProject, terraceShore } from '../../../../core/layout/terrace';
import { SKY_PHASES } from '../../../../core/sky/skyPhase';
import { loadWorld } from '../../../../core/world/world';
import { PALETTE } from '../palette';
import { packTerrace, unpackTerrace } from './terracePack';
import { LAMP_LOOKS, TERRACE_CLOUDS, TERRACE_MOON, TERRACE_WAY, paintTerrace, terracePalette, terraceRuns, type TerracePicture } from './terracePicture';

const KERI = loadWorld(keriJson);
const plan = terracePlan();
const { w: W, h: H } = plan.fine;

describe('the painted terrace (ft_1_19)', () => {
  const pictures = {} as Record<'day' | 'night', TerracePicture>;
  beforeAll(() => {
    for (const phase of ['day', 'night'] as const) pictures[phase] = paintTerrace(KERI, plan, phase);
  }, 120_000);

  /** How much of a box of the picture is painted in the given colours. */
  const share = (frame: TerracePicture['frames'][number], x0: number, x1: number, y0: number, y1: number, of: ReadonlySet<number>): number => {
    let n = 0, all = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { all++; if (of.has(frame.pixels[y * W + x]!)) n++; }
    return n / all;
  };

  it('ft_1_19.AC5 the palette is the game\'s own with Keri\'s runs, the deck\'s wood, the rail\'s white paint and the benches\' red after it, the same places at every hour', () => {
    for (const phase of SKY_PHASES) {
      const palette = terracePalette(phase);
      expect(palette.slice(0, PALETTE.length)).toEqual([...PALETTE]);
      expect(palette.length).toBeLessThanOrEqual(256);
      expect(palette.length).toBe(terracePalette('day').length);
    }
    expect(terraceRuns().wood!.length).toBeGreaterThanOrEqual(6);
    for (const run of ['hull', 'red']) expect(terraceRuns()[run]!.length).toBeGreaterThanOrEqual(5);
  });

  it('ft_1_19.AC1 one picture (the game lights the water), every pixel painted; the deck\'s boards fill the near ground in the wood\'s colours', () => {
    const { frames } = pictures.day;
    expect(frames).toHaveLength(1);
    const frame = frames[0]!;
    expect([frame.width, frame.height]).toEqual([W, H]);
    expect(frame.pixels.every((p) => p >= PALETTE.length && p < pictures.day.palette.length)).toBe(true);
    const runs = terraceRuns();
    const wood = new Set(runs.wood), grey = new Set([...runs.stone!, ...runs.shingle!]);
    // half the real deck is oiled red-brown and half has gone grey: here the terrace is one floor of oiled boards, in
    // the wood's dark tones, and the grey boards are the walk's, out over the beach
    expect(share(frame, 260, 500, 205, 240, wood)).toBeGreaterThan(0.75);
    expect(share(frame, 250, 320, 160, 172, grey)).toBeGreaterThan(0.7);
    expect(frame.pixels.filter((p) => wood.has(p)).length / (W * H)).toBeGreaterThan(0.18);
    // the near boards are darker than the far ones: a dark near band from the things themselves, no laid-on shadow
    const light = (x0: number, x1: number, y0: number, y1: number): number => {
      let sum = 0, n = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const c = pictures.day.palette[frame.pixels[y * W + x]!]!; sum += ((c >> 16) & 255) + ((c >> 8) & 255) + (c & 255); n++; }
      return sum / n;
    };
    expect(light(260, 500, 215, 245)).toBeLessThan(light(250, 320, 160, 172) - 60);
  });

  it('ft_1_19.AC5 the night is navy and lit, not a murk: the open sea keeps off its two darkest tones, and the grill\'s coals lay a warm pool on the boards round them', () => {
    const sea = terraceRuns().sea!;
    const darkest = new Set(sea.slice(0, 2));
    expect(share(pictures.night.frames[0]!, 0, 130, TERRACE.horizon + 6, TERRACE.horizon + 20, darkest)).toBeLessThan(0.2);
    const lit = (p: TerracePicture) => p.coals.frames.map((f) => f.pixels.filter((v) => v).length);
    expect(pictures.night.coals.frames).toHaveLength(LAMP_LOOKS);
    expect(Math.max(...lit(pictures.day))).toBeLessThanOrEqual(1);
    expect(Math.min(...lit(pictures.night))).toBeGreaterThan(150);
    // the pool lies round the grill's foot, under its coals
    const { x, y } = pictures.night.coals;
    const { width, height } = pictures.night.coals.frames[0]!;
    expect(plan.fire.x).toBeGreaterThan(x);
    expect(plan.fire.x).toBeLessThan(x + width);
    expect(y + height).toBeGreaterThan(plan.fire.y + 8);
    expect(Math.max(width, height)).toBeLessThan(200);
    // and what stands by the grill takes its warmth: the nearer bench's end, left of its back board's gulls
    const ember = new Set(terraceRuns().ember);
    const frame = pictures.night.coals.frames[0]!;
    let warm = 0;
    for (let dy = 0; dy < height; dy++) for (let dx = plan.fire.x + 22 - x; dx < Math.min(width, plan.fire.x + 44 - x); dx++) if (dy + y < plan.fire.y + 30 && ember.has(frame.pixels[dy * width + dx]!)) warm++;
    expect(warm).toBeGreaterThan(30);
  });

  it('ft_1_19.AC1 the view is away from the house: open sky over a straight horizon, the sea under it, the shingle between the sea and the boards', () => {
    const frame = pictures.day.frames[0]!;
    const runs = terraceRuns();
    const sky = new Set(runs.sky), sea = new Set(runs.sea), beach = new Set([...runs.shingle!, ...runs.stone!, ...runs.dry!]);
    expect(share(frame, 0, 70, 0, TERRACE.horizon - 1, sky)).toBe(1);
    // the horizon is one straight row from edge to edge, where nothing of the walk stands before it
    for (const x of [4, 40, 60, 400, 440]) {
      expect(sky.has(frame.pixels[(TERRACE.horizon - 2) * W + x]!), `sky over ${x}`).toBe(true);
      expect(sea.has(frame.pixels[(TERRACE.horizon + 2) * W + x]!), `sea under ${x}`).toBe(true);
    }
    // no part of the house is in the picture: its plaster and its roof have no colours here
    expect(runs.plaster).toBeUndefined();
    // the shingle, its stones and its dry grass lie where the plan says land is, beyond the deck's rail right of the walk
    const shore = terraceShore(KERI);
    let land = 0, stony = 0;
    const rail = new Set(runs.wood);
    for (let y = TERRACE.horizon + 1; y < 150; y++) for (let x = 330; x < 400; x++) {
      // (the rail's posts and boards stand before it)
      if (terraceFloor(shore, x, y)!.wet || rail.has(frame.pixels[y * W + x]!)) continue;
      land++;
      if (beach.has(frame.pixels[y * W + x]!)) stony++;
    }
    expect(land).toBeGreaterThan(600);
    expect(stony / land).toBeGreaterThan(0.7);
  });

  it('ft_1_19.AC1 the terrace reaches out over the beach: a walk of grey boards on piles runs from the deck to a head over the water, and no boat stands there (a boat was too much)', () => {
    const frame = pictures.day.frames[0]!;
    const runs = terraceRuns();
    const built = new Set([...runs.hull!, ...runs.wood!, ...runs.stone!, ...runs.shingle!, ...runs.red!]);
    const sea = new Set(runs.sea);
    const shore = terraceShore(KERI);
    // the head's boards, rail and posts are painted where the plan's floor is all water
    let wet = 0;
    for (let y = 124; y < 138; y++) for (let x = 100; x < 200; x++) if (terraceFloor(shore, x, y)!.wet) wet++;
    expect(wet).toBe(14 * 100);
    expect(share(frame, 100, 200, 124, 138, built)).toBeGreaterThan(0.7);
    expect(share(frame, 100, 200, 124, 138, sea)).toBeLessThan(0.1);
    // and the walk's on the way there
    expect(share(frame, 180, 260, 140, 160, built)).toBeGreaterThan(0.8);
    // the lantern hangs over the sea, beyond the water's edge of its column
    let edge = TERRACE.horizon + 1;
    while (terraceFloor(shore, plan.lamp.x, edge)!.wet) edge++;
    expect(plan.lamp.y).toBeLessThan(edge);
  });

  it('ft_1_19.AC1 a watchtower stands on the head (a roofed section, a small watchtower a storey up with a fixed long-eye to scan the horizon): a thatched roof in the sky, a boarded floor a storey up, open between them, and the long-eye\'s brass there', () => {
    const frame = pictures.day.frames[0]!;
    const runs = terraceRuns();
    const silver = new Set([...runs.stone!, ...runs.shingle!]), thatch = new Set(runs.dry), sky = new Set(runs.sky), brass = new Set([...runs.dry!, ...runs.earth!]);
    const at = (a: number, b: number, up: number): { x: number; y: number } => { const p = terraceProject(...onTower(a, b, up)); return { x: Math.round(p.x), y: Math.round(p.y) }; };
    const peak = at(0.5, 0.5, TOWER.peak), eaveL = at(0, 0, TOWER.eave), eaveR = at(1, 0, TOWER.eave), floorL = at(0, 0, TOWER.floor), floorR = at(1, 0, TOWER.floor), railL = at(0, 0, TOWER.floor + TOWER.rail);
    // the roof: thatch between the eave and the peak
    expect(share(frame, eaveL.x + 8, eaveR.x - 8, peak.y + 8, eaveL.y - 3, thatch)).toBeGreaterThan(0.8);
    // the floor's parapet: boards gone silver in the weather, not the deck's oiled brown
    expect(share(frame, floorL.x + 3, floorL.x + 30, railL.y + 3, floorL.y - 2, silver)).toBeGreaterThan(0.8);
    // open between the rail and the eave: the sky shows through
    expect(share(frame, floorL.x + 6, floorR.x - 6, eaveR.y + 6, railL.y - 3, sky)).toBeGreaterThan(0.4);
    // the long-eye: brass by its pivot, in that opening, in a box that stays under the eave's thatch (the same run)
    const pivot = terraceProject(...onTower(LONG_EYE.a, LONG_EYE.b, TOWER.floor + LONG_EYE.high));
    expect(Math.round(pivot.y) - 4).toBeGreaterThan(eaveL.y + 4);
    expect(share(frame, Math.round(pivot.x) - 30, Math.round(pivot.x) + 10, Math.round(pivot.y) - 4, Math.round(pivot.y) + 6, brass)).toBeGreaterThan(0.15);
    // under the floor the tower is open too: the sea shows between its posts
    expect(share(frame, floorL.x + 8, floorR.x - 8, floorL.y + 4, TERRACE.horizon + 14, new Set(runs.sea))).toBeGreaterThan(0.3);
  });

  it('ft_1_19.AC1 what lies behind is smooth: the bare sky is one tone along each row, a place at a time down a long run, and the open water has no chessboard', () => {
    const sky = terraceRuns().sky!;
    expect(sky.length).toBeGreaterThanOrEqual(20);
    const frame = pictures.day.frames[0]!;
    const places: number[] = [];
    for (let y = 0; y < TERRACE.horizon - 1; y++) {
      // the bare sky left of the watchtower
      const row = frame.pixels.subarray(y * W + 4, y * W + 64);
      expect(new Set(row).size, `row ${y}`).toBe(1);
      places.push(sky.indexOf(row[0]!));
    }
    for (let i = 1; i < places.length; i++) expect(Math.abs(places[i]! - places[i - 1]!), `row ${i}`).toBeLessThanOrEqual(1);
    expect(new Set(places).size).toBeGreaterThanOrEqual(12);
    const sea = new Set<number>(terraceRuns().sea);
    let boards = 0, blocks = 0;
    for (let y = TERRACE.horizon + 2; y < TERRACE.horizon + 18; y++) for (let x = 0; x < 130; x++) {
      const [p, q, r, t] = [frame.pixels[y * W + x]!, frame.pixels[y * W + x + 1]!, frame.pixels[(y + 1) * W + x]!, frame.pixels[(y + 1) * W + x + 1]!];
      if (![p, q, r, t].every((c) => sea.has(c))) continue;
      blocks++;
      if (p === t && q === r && p !== q) boards++;
    }
    expect(blocks).toBeGreaterThan(1500);
    expect(boards / blocks).toBeLessThan(0.02);
  });

  it('ft_1_19.AC5 the clouds are their own pictures that drift over the bare sky, and what stands before the sky is cut out to lie over them', () => {
    const { frames, clouds, fore } = pictures.day;
    expect(clouds).toHaveLength(TERRACE_CLOUDS.length);
    expect(clouds.length).toBeGreaterThanOrEqual(4);
    const cloudy = new Set(terraceRuns().cloud);
    expect(frames[0]!.pixels.subarray(0, (TERRACE.horizon - 2) * W).some((p) => cloudy.has(p))).toBe(false);
    for (const cloud of clouds) expect(cloud.bitmap.pixels.some((p) => cloudy.has(p))).toBe(true);
    // the watchtower is in the cut-out, and it stays above the rows the clouds reach
    const cut = fore.frames[0]!;
    expect(cut.pixels.filter((p) => p !== 0).length).toBeGreaterThan(150);
    expect(fore.y + cut.height).toBeLessThanOrEqual(TERRACE.horizon + 4);
    const fx = plan.pennant.x - fore.x, fy = plan.pennant.y + 14 - fore.y;
    expect([...cut.pixels.subarray(fy * cut.width + fx - 6, fy * cut.width + fx + 6)].some((p) => p !== 0)).toBe(true);
  });

  it('ft_1_19.AC13 the pennant on the watchtower\'s staff is cut out for the wind, which blows the way the clouds drift', () => {
    const { blown } = pictures.day;
    expect(blown).toHaveLength(1);
    const flag = blown[0]!;
    expect(flag.kind).toBe('flag');
    expect(TERRACE_WAY).toBe(-1);
    // it streams to the left of the staff's head, its hoist at the staff
    expect(flag.x + flag.bitmap.width).toBeGreaterThanOrEqual(plan.pennant.x - 2);
    expect(flag.x + flag.bitmap.width).toBeLessThanOrEqual(plan.pennant.x + 2);
    expect(Math.abs(flag.y - plan.pennant.y)).toBeLessThan(6);
    const red = new Set(terraceRuns().red);
    expect(flag.bitmap.pixels.some((p) => red.has(p))).toBe(true);
  });

  it('ft_1_19.AC12 the game lights the water: its layers lie under the horizon and drift with the wind', () => {
    const { water } = pictures.day;
    expect(water.horizon).toBe(TERRACE.horizon);
    expect(water.way).toBe(TERRACE_WAY);
    expect(water.layers.y).toBeGreaterThanOrEqual(TERRACE.horizon - 1);
    expect(water.layers.frames[0]!.pixels.filter((p) => p !== 0).length).toBeGreaterThan(400);
    expect(pictures.day.gull).toBeGreaterThanOrEqual(PALETTE.length);
  });

  it('ft_1_19.AC5 the lantern at the watchtower\'s corner is dark by day and glows at night, flickering through its looks; the grill\'s coals glow at night', () => {
    const lit = (p: TerracePicture) => p.lamp.frames.map((f) => f.pixels.filter((v) => v).length);
    expect(pictures.night.lamp.frames).toHaveLength(LAMP_LOOKS);
    expect(Math.max(...lit(pictures.day))).toBeLessThanOrEqual(1);
    expect(Math.min(...lit(pictures.night))).toBeGreaterThan(40);
    expect(new Set(lit(pictures.night)).size).toBeGreaterThan(1);
    const { x, y } = pictures.night.lamp;
    const { width, height } = pictures.night.lamp.frames[0]!;
    expect(plan.lamp.x).toBeGreaterThan(x);
    expect(plan.lamp.x).toBeLessThan(x + width);
    expect(plan.lamp.y).toBeGreaterThan(y);
    expect(plan.lamp.y).toBeLessThan(y + height);
    // its glow and its pool on the head's boards under it, no wider
    expect(Math.max(width, height)).toBeLessThan(120);
    const ember = new Set(terraceRuns().ember);
    const coals = (p: TerracePicture) => share(p.frames[0]!, plan.fire.x - 12, plan.fire.x + 12, plan.fire.y - 6, plan.fire.y + 8, ember);
    expect(coals(pictures.night)).toBeGreaterThan(0.03);
    expect(coals(pictures.night)).toBeGreaterThan(coals(pictures.day));
  });

  it('ft_1_19.AC5 the plaza\'s torches stand unlit by day and burn at night, each a layer of its own in the lamp\'s looks: a flame on its head with a pale heart, and their light warm on the boards (torches at night, as the terrace is like the village plaza)', () => {
    const ember = terraceRuns().ember!, warm = new Set(ember);
    expect(pictures.day.torches).toHaveLength(plan.torches.length);
    expect(pictures.night.torches).toHaveLength(plan.torches.length);
    const lit = new Uint8Array(W * H);
    plan.torches.forEach((at, k) => {
      const day = pictures.day.torches[k]!, night = pictures.night.torches[k]!;
      expect(Math.max(...day.frames.map((f) => f.pixels.filter((v) => v).length))).toBeLessThanOrEqual(1);
      expect(night.frames).toHaveLength(LAMP_LOOKS);
      // by day its head is a charred bundle: nothing of the fire's colours on it
      expect(share(pictures.day.frames[0]!, at.x - 2, at.x + 3, at.y, at.y + 4, warm)).toBe(0);
      const pixel = (f: TerracePicture['frames'][number], x: number, y: number): number => (x < night.x || y < night.y || x >= night.x + f.width || y >= night.y + f.height ? 0 : f.pixels[(y - night.y) * f.width + x - night.x]!);
      const flames = night.frames.map((f) => {
        // the flame's foot is of the fire's colours right across the head, its heart the palest of them
        let foot = 0, pale = 0;
        for (let x = at.x - 1; x <= at.x + 1; x++) for (let y = at.y - 2; y <= at.y; y++) {
          if (warm.has(pixel(f, x, y))) foot++;
          if (pixel(f, x, y) === ember[ember.length - 1]) pale++;
        }
        expect(foot).toBe(9);
        expect(pale).toBeGreaterThan(0);
        // and it stands at least three quarters of its height
        let top = at.y;
        while (top > 0 && [-2, -1, 0, 1, 2].some((dx) => warm.has(pixel(f, at.x + dx, top - 1)))) top--;
        expect(at.y - top).toBeGreaterThanOrEqual(Math.floor(at.tall * 0.7));
        return [...f.pixels].join();
      });
      // it licks: no two looks alike
      expect(new Set(flames).size).toBe(LAMP_LOOKS);
      const f = night.frames[1]!;
      for (let y = 0; y < f.height; y++) for (let x = 0; x < f.width; x++) if (f.pixels[y * f.width + x]) lit[(night.y + y) * W + night.x + x] = 1;
    });
    // their light owns the plaza at night: a good part of the boards is warm (Woodtick's lamps, light-and-heat.md 6)
    const boards = new Set([...terraceRuns().wood!, ...terraceRuns().stone!, ...terraceRuns().shingle!]);
    let floor = 0, warmed = 0;
    for (let y = TERRACE.horizon + 40; y < H; y++) for (let x = 0; x < W; x++) if (boards.has(pictures.night.frames[0]!.pixels[y * W + x]!)) { floor++; if (lit[y * W + x]) warmed++; }
    expect(warmed / floor).toBeGreaterThan(0.08);
    expect(warmed / floor).toBeLessThan(0.5);
  });

  it('ft_1_19.AC5 at night the moon stands in the sky where the game keeps the clouds off it; no shadow is laid over the picture by day', () => {
    const light = (p: TerracePicture, x: number, y: number) => { const c = p.palette[p.frames[0]!.pixels[y * W + x]!]!; return ((c >> 16) & 255) + ((c >> 8) & 255) + (c & 255); };
    expect(light(pictures.night, TERRACE_MOON.x, TERRACE_MOON.y)).toBeGreaterThan(light(pictures.night, TERRACE_MOON.x - 40, TERRACE_MOON.y) + 150);
    expect(TERRACE_MOON.y + TERRACE_MOON.r).toBeLessThan(TERRACE.horizon - 20);
    // the upper corners are open sky by day, as light as the sky's top (art-direction rule 7)
    expect(light(pictures.day, 2, 2)).toBeGreaterThan(300);
    expect(light(pictures.day, W - 3, 2)).toBeGreaterThan(300);
  });

  it('ft_1_19.AC1 it travels packed from the build to the game and comes back the same', () => {
    const back = unpackTerrace(JSON.parse(JSON.stringify(packTerrace(pictures.night))) as ReturnType<typeof packTerrace>);
    expect(back.palette).toEqual(pictures.night.palette);
    expect(back.frames.map((f) => [...f.pixels])).toEqual(pictures.night.frames.map((f) => [...f.pixels]));
    expect(back.clouds.map((c) => [c.x, c.y, c.bitmap.width])).toEqual(pictures.night.clouds.map((c) => [c.x, c.y, c.bitmap.width]));
    expect(back.lamp.frames.map((f) => [...f.pixels])).toEqual(pictures.night.lamp.frames.map((f) => [...f.pixels]));
    expect(back.coals).toEqual(pictures.night.coals);
    expect(back.torches).toEqual(pictures.night.torches);
    expect([...back.fore.frames[0]!.pixels]).toEqual([...pictures.night.fore.frames[0]!.pixels]);
    expect(back.blown.map((b) => [b.kind, b.x, b.y, ...b.bitmap.pixels])).toEqual(pictures.night.blown.map((b) => [b.kind, b.x, b.y, ...b.bitmap.pixels]));
    expect([...back.water.layers.frames[0]!.pixels]).toEqual([...pictures.night.water.layers.frames[0]!.pixels]);
    expect(back.smoke).toEqual(pictures.night.smoke);
    expect(back.gull).toBe(pictures.night.gull);
  });
});
