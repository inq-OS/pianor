import { beforeAll, describe, expect, it } from 'vitest';
import keriJson from '../../../../../content/world/keri.json';
import { beyondCut, keriMapPlan, LIGHTHOUSE_DRAWN, LIGHTHOUSE_METRES } from '../../../../core/layout/keriMap';
import { insideRing, loadWorld } from '../../../../core/world/world';
import type { Bitmap } from '../bitmap';
import { PALETTE } from '../palette';
import { packMap, unpackMap } from './mapPack';
import { mapPalette, paintMap, type MapPicture } from './mapPicture';
import { BEAM_HALF_TURN_MS, drawBeam, type MapBeam } from './beam';

const KERI = loadWorld(keriJson);
const plan = keriMapPlan(KERI);
/** The island as the map draws it (fat Keri, d125): what lies under a pixel is asked of this one. */
const DRAWN = plan.map.world;
const { w: W, h: H } = plan.fine;
const rgb = (c: number): [number, number, number] => [(c >> 16) & 255, (c >> 8) & 255, c & 255];

describe('the painted map of Keri (ft_1_18.AC2)', () => {
  const maps = {} as Record<'day' | 'night', MapPicture>;
  beforeAll(() => {
    for (const phase of ['day', 'night'] as const) maps[phase] = paintMap(plan, phase);
  }, 60_000);
  const colourAt = (map: MapPicture, frame: Bitmap, x: number, y: number) => rgb(map.palette[frame.pixels[Math.round(y) * W + Math.round(x)]!]!);

  it('ft_1_18.AC2 the map\'s palette is the game\'s own with the map\'s shades after it, no colour twice among them', () => {
    const palette = mapPalette();
    expect(palette.slice(0, PALETTE.length)).toEqual(PALETTE);
    expect(palette.length).toBeLessThanOrEqual(256);
    const shades = palette.slice(PALETTE.length);
    expect(shades.length).toBeGreaterThan(50);
    expect(new Set(shades).size).toBe(shades.length);
  });

  it('ft_1_18.AC2 the picture fills its size: sea round the island, blue by day; the land is where the world model has it, green and gold on the meadow', () => {
    const { frames, palette } = maps.day;
    expect(frames).toHaveLength(2);
    for (const frame of frames) {
      expect([frame.width, frame.height]).toEqual([W, H]);
      expect(frame.pixels.every((p) => p > 0 && p < palette.length)).toBe(true);
    }
    // the four corners are deep sea, the same colour: a larger window goes on in it
    const corners = [[0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1]].map(([x, y]) => frames[0]!.pixels[y! * W + x!]);
    expect(new Set(corners).size).toBe(1);
    const [r, g, b] = rgb(palette[corners[0]!]!);
    expect(b).toBeGreaterThan(r + 60);
    expect(b).toBeGreaterThan(g + 40);
    // grass well inside the grass ring is green, the sea north of the island blue: sampled on a grid
    let green = 0, grass = 0, blue = 0, sea = 0;
    // the tower stands far taller than to scale: the meadow behind it is hidden
    const tower = plan.at(KERI.places.lighthouse);
    for (let y = plan.island.y - 20; y < plan.island.y + plan.island.h + 20; y += 3) for (let x = plan.island.x - 20; x < plan.island.x + plan.island.w + 20; x += 3) {
      const p = plan.view.toWorld(x, y);
      const [cr, cg, cb] = colourAt(maps.day, frames[0]!, x, y);
      const near = [[9, 0], [-9, 0], [0, 9], [0, -9]].map(([dx, dy]) => plan.view.toWorld(x + dx!, y + dy!));
      if (!(Math.abs(x - tower.x) < 18 && y < tower.y) && insideRing(DRAWN.grass, p) && near.every((q) => insideRing(DRAWN.grass, q)) && [...DRAWN.buildings, ...(DRAWN.scenes ?? []), DRAWN.places.lighthouse].every((s) => Math.hypot(s.x - p.x, s.y - p.y) > 44) && (DRAWN.landmarks ?? []).every((s) => Math.hypot(s.x - p.x, s.y - p.y) > 28)) {
        grass++;
        // green, or the dry gold of a meadow in summer: never the grey of the shingle or the blue of the sea
        if (cg > cb + 15 && cg > cr * 0.8) green++;
      } else if (!insideRing(DRAWN.coast, p) && near.every((q) => !insideRing(DRAWN.coast, q))) {
        sea++;
        if (cb > cr && cb >= cg) blue++;
      }
    }
    // (less free meadow than there was: the power station, the mast and the helicopter pad stand in the western one)
    expect(grass).toBeGreaterThan(40);
    // paths cross the meadow in pale lines and a flower stands here and there: nearly all of it is green or gold
    expect(green / grass).toBeGreaterThan(0.9);
    expect(sea).toBeGreaterThan(500);
    // the rest is the shore's dark bank just under the land, a boulder in the shallows, and a corner of the name
    expect(blue / sea).toBeGreaterThan(0.9);
  });

  it('ft_1_18.AC2 the lighthouse stands up from its place, red iron over a pale stone foot, taller than any house', () => {
    const { frames } = maps.day;
    const foot = plan.at(KERI.places.lighthouse);
    const column = (y: number) => colourAt(maps.day, frames[0]!, foot.x - 2, y);
    let red = 0, pale = 0, hoops = 0;
    for (let y = Math.round(foot.y) - 70; y < foot.y; y++) {
      const [r, g, b] = column(y);
      if (r > 140 && g < 110 && b < 110) red++;
      if (r > 150 && g > 140 && b > 120) pale++;
      // a rusted iron hoop: dark and brown
      if (r < 130 && r > g + 10 && g > b) hoops++;
    }
    expect(red).toBeGreaterThan(10);
    expect(pale).toBeGreaterThan(10);
    expect(red + pale).toBeGreaterThan(40);
    // the lighthouse has character: hoops of rusted iron round the stone, and the stone in
    // more than a few tones: courses, light in bands, rust under the hoops
    expect(hoops).toBeGreaterThanOrEqual(3);
    const tones = new Set<string>();
    for (let y = Math.round(foot.y) - 45; y < foot.y - 5; y++) for (let dx = -12; dx <= 12; dx++) tones.add(colourAt(maps.day, frames[0]!, foot.x + dx, y).join());
    expect(tones.size).toBeGreaterThan(8);
    // the reference photographs: a fat stone foot, more than half the height, and a slim iron tower on it
    const tall = foot.y - plan.at(KERI.places.lighthouse, LIGHTHOUSE_METRES * LIGHTHOUSE_DRAWN).y;
    const across = (share: number, is: (c: [number, number, number]) => boolean): number => {
      let n = 0;
      for (let x = Math.round(foot.x) - 30; x <= foot.x + 30; x++) if (is(colourAt(maps.day, frames[0]!, x, foot.y - tall * share))) n++;
      return n;
    };
    const isRed = ([r, g, b]: [number, number, number]): boolean => r > 140 && g < 110 && b < 110, isStone = ([r, g, b]: [number, number, number]): boolean => r > 85 && g > 80 && b > 70 && r - b < 70 && r >= g - 4;
    expect(across(0.45, isRed)).toBe(0);
    expect(across(0.45, isStone)).toBeGreaterThan(12);
    expect(across(0.68, isRed)).toBeGreaterThan(5);
    expect(across(0.3, isStone)).toBeGreaterThan(across(0.68, isRed) * 2.5);
  });

  it('ft_1_18.AC2 the island\'s name is painted in gold in its corner, and the houses wear the roofs the photographs show', () => {
    const { frames } = maps.day;
    let gold = 0;
    for (let y = plan.title.y; y < plan.title.y + plan.title.h; y++) for (let x = plan.title.x; x < plan.title.x + plan.title.w; x++) {
      const [r, g, b] = colourAt(maps.day, frames[0]!, x, y);
      if (r > 200 && g > 150 && b < 150 && r > b + 60) gold++;
    }
    expect(gold).toBeGreaterThan(plan.title.w * plan.title.h * 0.08);
    /** How many pixels round a house's roof pass `test`. */
    const roof = (id: string, test: (c: number[]) => boolean): number => {
      const at = plan.at(KERI.buildings.find((b) => b.id === id)!, 12);
      let n = 0;
      for (let dy = -9; dy <= 6; dy++) for (let dx = -10; dx <= 10; dx++) if (test(colourAt(maps.day, frames[0]!, at.x + dx, at.y + dy))) n++;
      return n;
    };
    expect(roof('red-shed', ([r, g, b]) => r! > 130 && g! < 100 && b! < 100)).toBeGreaterThan(12);
    expect(roof('building-3', ([r, g, b]) => b! > r! + 25 && b! > g! && b! > 110)).toBeGreaterThan(12);
    // the warden's tin is painted pale blue (the reference photograph-keri-house-gable)
    expect(roof('warden-house', ([r, g, b]) => b! > r! + 25 && b! > g! && b! > 150)).toBeGreaterThan(12);
  });

  it('ft_1_18.AC2 a house is a crooked cottage, not a box: a roof as high as its wall, dark panes by day and lamplight in the warden\'s windows at night, a hut that stands off the meadow', () => {
    const house = plan.at(KERI.buildings.find((b) => b.id === 'warden-house')!);
    const round = (map: MapPicture, at: { x: number; y: number }, reach: number, test: (c: [number, number, number]) => boolean): number => {
      let n = 0;
      for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach * 2; dx <= reach * 2; dx++) if (test(colourAt(map, map.frames[0]!, at.x + dx, at.y + dy))) n++;
      return n;
    };
    const isRoof = ([r, g, b]: [number, number, number]): boolean => b > r + 25 && b > g && b > 110, isWall = ([r, g, b]: [number, number, number]): boolean => r > 200 && g > 190 && b > 160;
    // over the middle of the house, a little off its door: more rows of roof than of wall
    let roofRows = 0, wallRows = 0;
    for (let y = Math.round(house.y) - 30; y < house.y + 15; y++) {
      const c = colourAt(maps.day, maps.day.frames[0]!, house.x + 14, y);
      if (isRoof(c)) roofRows++; else if (isWall(c)) wallRows++;
    }
    expect(wallRows).toBeGreaterThanOrEqual(3);
    expect(roofRows).toBeGreaterThanOrEqual(wallRows);
    // windows: dark blue glass by day, the lamp's yellow at night
    expect(round(maps.day, house, 16, ([r, g, b]) => r < 70 && b > r + 30 && b > g)).toBeGreaterThan(12);
    expect(round(maps.night, house, 16, ([r, g, b]) => r > 200 && g > 180 && b < 190 && r > b + 40)).toBeGreaterThan(12);
    // the sauna's boards are a sea green, bluer than any meadow green: the hut stands off the grass
    const sauna = plan.at(KERI.buildings.find((b) => b.id === 'hut-middle')!);
    expect(round(maps.day, sauna, 8, ([r, g, b]) => g > r + 20 && b > r + 5 && b > 70)).toBeGreaterThan(8);
  });

  it('ft_1_18.AC2 nothing leads from the terrace to the water: no planks on the sea before it', () => {
    // no path or staircase may lead from the terrace to the waterfront (one had run out
    // over the water on posts)
    const terrace = plan.at(KERI.landmarks!.find((m) => m.kind === 'terrace')!);
    const frame = maps.day.frames[0]!;
    const sea = (x: number, y: number): boolean => !insideRing(DRAWN.coast, plan.view.toWorld(x, y));
    let planks = 0, water = 0;
    for (let y = Math.round(terrace.y) + 6; y < terrace.y + 50; y++) for (let dx = -14; dx <= 14; dx++) {
      // past the shore's bank, which is earth and brown as planks are
      if (!sea(terrace.x + dx, y) || !sea(terrace.x + dx, y - 9)) continue;
      water++;
      const [r, g, b] = colourAt(maps.day, frame, terrace.x + dx, y);
      if (r > g + 12 && g > b + 12 && r - b > 50) planks++;
    }
    expect(water).toBeGreaterThan(200);
    expect(planks).toBe(0);
  });

  it('ft_1_18.AC2 the southern dock: a pale road down to the shore, then a heavy stone quay out over the water, wider than the road; the northern boat slip keeps its rails', () => {
    // the map draws it along the drawn line (`MAP_SHAPE.lines`): the drawn island's path is asked
    const slip = DRAWN.paths.find((p) => p.id === 'slipway')!;
    const pts = slip.points.map(([x, y]) => plan.view.toScreen({ x, y }));
    const head = pts[0]!, end = pts[pts.length - 1]!, long = Math.hypot(end.x - head.x, end.y - head.y);
    const on = (k: number): { x: number; y: number } => ({ x: head.x + ((end.x - head.x) * k) / long, y: head.y + ((end.y - head.y) * k) / long });
    const frame = maps.day.frames[0]!;
    // on the land near its head: the pavement's pale cream
    let cream = 0;
    for (let k = 4; k < 14; k++) for (const dx of [0, 1]) { const [r, g, b] = colourAt(maps.day, frame, on(k).x + dx, on(k).y); if (r > 220 && g > 200 && b > 150) cream++; }
    expect(cream).toBeGreaterThan(6);
    // past the line's end, where the model has sea: the quay's grey stone, wider than the road
    for (const k of [long + 5, long + 10, long + 20]) {
      let stone = 0;
      for (let dx = -5; dx <= 5; dx++) { const [r, g, b] = colourAt(maps.day, frame, on(k).x + dx, on(k).y); if (Math.max(r, g, b) - Math.min(r, g, b) < 30 && r > 100) stone++; }
      expect(stone).toBeGreaterThan(7);
      expect(insideRing(DRAWN.coast, plan.view.toWorld(on(k).x, on(k).y))).toBe(false);
    }
    // the boat slip in the north: brown rails on its sleepers
    const north = DRAWN.paths.find((p) => p.id === 'boat-slip-north')!.points.map(([x, y]) => plan.view.toScreen({ x, y }));
    let brown = 0;
    for (let dy = -3; dy <= 0; dy++) for (let dx = -2; dx <= 3; dx++) {
      const [r, g, b] = colourAt(maps.day, frame, north[1]!.x + dx, north[1]!.y + dy);
      if (r > g && g > b && r < 180) brown++;
    }
    expect(brown).toBeGreaterThan(3);
  });

  it('ft_1_18.AC2 the ways are whole: from the pavement before the warden\'s house to the fork and on to the tower\'s foot, and to the power station, no bush on them', () => {
    const frame = maps.day.frames[0]!;
    const isPath = ([r, g, b]: [number, number, number]): boolean => r > 150 && g > 140 && b > 110 && r >= g;
    for (const id of ['track-to-lighthouse', 'track-to-power-station', 'track-to-north-house']) {
      const pts = DRAWN.paths.find((p) => p.id === id)!.points.map(([x, y]) => plan.view.toScreen({ x, y }));
      let on = 0, all = 0;
      // from its second point on (its first lies under the house as drawn: the painter starts it at the pavement)
      for (let i = 2; i < pts.length; i++) {
        const a = pts[i - 1]!, b = pts[i]!, long = Math.hypot(b.x - a.x, b.y - a.y);
        for (let s = 3; s < long - 3; s += 2) {
          all++;
          const x = a.x + ((b.x - a.x) * s) / long, y = a.y + ((b.y - a.y) * s) / long;
          if ([0, 1, -1].some((dx) => isPath(colourAt(maps.day, frame, x + dx, y)))) on++;
        }
      }
      if (all > 0) expect(on / all, id).toBeGreaterThan(0.8);
    }
    // the power station's way leaves the pavement's west end: pale ground half way between the house and the shed
    const house = plan.at(KERI.buildings.find((b) => b.id === 'warden-house')!), shed = plan.at(KERI.buildings.find((b) => b.id === 'north-shed')!);
    let pale = 0;
    for (let dy = -10; dy <= 10; dy++) if (isPath(colourAt(maps.day, frame, (house.x + shed.x) / 2 - 8, (house.y + shed.y) / 2 + dy))) pale++;
    expect(pale).toBeGreaterThan(0);
  });

  it('ft_1_18.AC2 the Kaleva memorial is painted at its place: pale stones with dark plaques, poles over them, a flag beside', () => {
    const frame = maps.day.frames[0]!;
    const at = plan.at(KERI.landmarks!.find((m) => m.kind === 'memorial')!);
    let stone = 0, dark = 0, blue = 0;
    for (let dy = -24; dy <= 3; dy++) for (let dx = -17; dx <= 13; dx++) {
      const [r, g, b] = colourAt(maps.day, frame, at.x + dx, at.y + dy);
      if (r > 170 && g > 160 && b > 140) stone++;
      if (r < 70 && g < 70 && b < 80) dark++;
      if (b > 150 && b > r + 60) blue++;
    }
    expect(stone).toBeGreaterThan(30);
    expect(dark).toBeGreaterThan(8);
    expect(blue).toBeGreaterThan(2);
  });

  it('ft_1_19.AC2 a scene\'s place is painted on the map: a ring of pale stones with embers that glow at night too, and smoke over it', () => {
    const knoll = KERI.scenes!.find((s) => s.id === 'knoll')!;
    const at = plan.at(knoll);
    for (const phase of ['day', 'night'] as const) {
      let embers = 0, smoke = 0;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -7; dx <= 7; dx++) {
        const [r, g, b] = colourAt(maps[phase], maps[phase].frames[0]!, at.x + dx, at.y + dy);
        if (r > 220 && g > 110 && g < 230 && b < 120) embers++;
      }
      // the smoke is paler than the ground it rises over and has no green in it: grey by day, the moon's blue grey at night
      for (let k = 8; k < 30; k++) for (let dx = 0; dx <= 22; dx++) {
        const [r, g, b] = colourAt(maps[phase], maps[phase].frames[0]!, at.x + dx, at.y - k);
        if (phase === 'day' ? Math.abs(r - g) < 26 && b >= g - 30 && r > 150 : Math.abs(r - g) < 40 && b > g && r > 60) smoke++;
      }
      expect(embers, phase).toBeGreaterThanOrEqual(5);
      // a thin thread (less smoke from the bonfire)
      expect(smoke, phase).toBeGreaterThan(12);
    }
  });

  it('ft_1_18.AC2 the sea moves between the two looks and the land does not', () => {
    const [a, b] = maps.day.frames;
    let land = 0, sea = 0;
    // the painter rounds the coast's corners: land is what lies three pixels or more inside the measured line (the wedge of the north-west tip ends in a sliver the painter gives to the sea)
    // and not the south-east end beyond the sand strip's cut, which the map shows under water
    const inland = (x: number, y: number): boolean => !beyondCut(plan.sand, x, y) && [[0, 0], [-3, 0], [3, 0], [0, -3], [0, 3]].every(([dx, dy]) => insideRing(DRAWN.coast, plan.view.toWorld(x + dx! + 0.5, y + dy! + 0.5)));
    a!.pixels.forEach((p, i) => {
      if (p === b!.pixels[i]) return;
      if (inland(i % W, Math.floor(i / W))) land++;
      else sea++;
    });
    expect(sea).toBeGreaterThan(1500);
    expect(land).toBe(0);
  });

  it('ft_1_18.AC2 the sand strip is sand seen through the water: by day greener and paler than the sea beside it, at night the sea\'s own paler blue, never the meadow\'s gold', () => {
    const { spine } = plan.sand;
    for (const phase of ['day', 'night'] as const) {
      let onBack = 0, paler = 0;
      for (const p of spine.slice(3, -1)) {
        const [r, g, b] = colourAt(maps[phase], maps[phase].frames[0]!, p.x, p.y);
        const [sr, sg, sb] = colourAt(maps[phase], maps[phase].frames[0]!, p.x, p.y + p.half + 16);
        // water lies over it: never a colour with more red than blue in it by night, never redder than green by day
        if (phase === 'day' ? g > r && g > 140 : b > r + 30 && b > g) onBack++;
        if (r + g + b > sr + sg + sb + 60) paler++;
      }
      expect(onBack, phase).toBe(spine.length - 4);
      expect(paler, phase).toBe(spine.length - 4);
    }
  });

  it('ft_1_14.AC8 ft_1_18.AC2 at night the map is dark and the lamp throws a turning beam; by day the lantern only glints', () => {
    const bright = (map: MapPicture): number => {
      let sum = 0;
      for (let i = 0; i < W * H; i += 7) { const [r, g, b] = rgb(map.palette[map.frames[0]!.pixels[i]!]!); sum += r + g + b; }
      return sum;
    };
    expect(bright(maps.day)).toBeGreaterThan(bright(maps.night) * 1.8);
    for (const map of [maps.day, maps.night]) {
      expect(map.beam.x).toBeGreaterThanOrEqual(plan.middle.x);
      expect(map.beam.y).toBeGreaterThanOrEqual(plan.middle.y);
      expect(map.beam.x + map.beam.w).toBeLessThanOrEqual(plan.middle.x + plan.middle.w);
    }
    // the game draws the beam as it runs (`beam.ts`): here at four moments of a half turn, and by day at a glint's two
    const at = (beam: MapBeam, t: number): Bitmap => {
      const pixels = new Uint8Array(beam.w * beam.h);
      drawBeam(beam, t, pixels);
      return { width: beam.w, height: beam.h, pixels };
    };
    const drawn = (b: Bitmap): number => b.pixels.filter((p) => p !== 0).length;
    const night = [0, 1, 2, 3].map((k) => at(maps.night.beam, (k * BEAM_HALF_TURN_MS) / 4)), day = [0, 520].map((t) => at(maps.day.beam, t));
    // the lamp is high in the picture: the steepest arm of the beam is cut at the middle's top
    for (const f of night) expect(drawn(f)).toBeGreaterThan(250);
    for (let i = 1; i < night.length; i++) expect(night[i]!.pixels).not.toEqual(night[i - 1]!.pixels);
    expect(Math.max(...day.map(drawn))).toBeLessThan(10);
    expect(drawn(day[0]!)).toBe(0);
  });

  it('ft_1_18.AC2 three curling clouds of their own shapes, pale by day and dark at night, with clear sky round them', () => {
    const { clouds, palette } = maps.day;
    expect(clouds).toHaveLength(3);
    expect(new Set(clouds.map((c) => `${c.width}x${c.height}`)).size).toBe(3);
    clouds.forEach((cloud, i) => {
      const drawn = cloud.pixels.filter((p) => p !== 0);
      // a curl with a thin tail: most of its box is sky
      expect(drawn.length).toBeGreaterThan(cloud.width * cloud.height * 0.12);
      expect(new Set(drawn).size).toBeGreaterThanOrEqual(3);
      expect(drawn.length).toBeLessThan(cloud.width * cloud.height * 0.85);
      const light = (c: Bitmap, pal: readonly number[]) => c.pixels.reduce((s, p) => (p ? s + rgb(pal[p]!).reduce((a, b) => a + b, 0) : s), 0) / c.pixels.filter((p) => p !== 0).length;
      expect(light(cloud, palette)).toBeGreaterThan(light(maps.night.clouds[i]!, maps.night.palette) * 1.5);
    });
  });

  it('ft_1_18.AC2 the packed map the build hands the game unpacks to the same pictures', () => {
    const packed = packMap(maps.night);
    expect(JSON.stringify(packed).length).toBeLessThan(W * H);
    const back = unpackMap(JSON.parse(JSON.stringify(packed)) as typeof packed);
    expect(back.palette).toEqual(maps.night.palette);
    back.frames.forEach((frame, i) => expect(frame.pixels).toEqual(maps.night.frames[i]!.pixels));
    expect(back.beam).toEqual(maps.night.beam);
    back.clouds.forEach((cloud, i) => expect(cloud).toEqual(maps.night.clouds[i]));
  });
});
