import { describe, expect, it } from 'vitest';
import { SKY_PHASES, type SkyPhase } from '../../../../../core/sky/skyPhase';
import { createBitmap } from '../../bitmap';
import { KERI_HOURS, scenePalette } from '../keriPalette';
import { KIT, KIT_FILLS } from './index';
import { brushOn, KIT_FAMILIES, optionsOf, runOf, type KitBrush, type KitEntry, type KitFillEntry, type KitRuns } from './kit';
import { lamp, lantern } from './lights';
import { boulder, pebble } from './stones';
import { reflection, rings, sea, type SeaGround } from './water';
import { KIT_WOOD, planks, post } from './wood';

/**
 * The rules every type of the painter's kit keeps (d124), whatever it paints: so a scene can place any of them
 * without reading its code, and the sheet can show them all.
 */

/** Every material of the shared palette, and the kit's own wood (a scene that places a wood type names it as its own run). */
const SHARED = scenePalette({ wood: KIT_WOOD });

/** A brush that only writes down what an item painted. */
function recording(phase: SkyPhase, side = -0.35, palette: KitRuns = SHARED): { brush: KitBrush; puts: Map<string, number> } {
  const puts = new Map<string, number>();
  return { puts, brush: { put: (x, y, colour) => void puts.set(`${Math.round(x)},${Math.round(y)}`, colour), run: palette.run, fine: palette.fine, hour: KERI_HOURS[phase], side } };
}

const painted = (item: KitEntry, variant: string, seed: number, phase: SkyPhase = 'day'): Map<string, number> => {
  const { brush, puts } = recording(phase);
  item.paint(brush, 100, 100, variant, seed);
  return puts;
};

describe('the kit\'s list', () => {
  it('names every type family/type, once, in a family the kit has, with its note, its model and its atlas words', () => {
    expect(new Set(KIT.map((item) => item.id)).size).toBe(KIT.length);
    for (const item of KIT) {
      expect(KIT_FAMILIES).toContain(item.family);
      expect(item.id).toMatch(new RegExp(`^${item.family}/[a-z][a-z-]*$`));
      expect(item.note).toMatch(/^[a-z-]+\.md$/);
      expect(item.about.length).toBeGreaterThan(10);
      expect(item.model.length).toBeGreaterThan(5);
      expect(item.atlas.length).toBeGreaterThan(2);
      expect(item.variants.length).toBeGreaterThan(0);
      expect(item.uses.length).toBeGreaterThan(0);
    }
  });
});

describe.each(KIT.flatMap((item) => item.variants.map((variant) => [item.id, variant, item] as const)))('%s, %s', (_id, variant, item) => {
  it('paints something, inside the box it names, at every hour', () => {
    const box = item.box(variant);
    for (const phase of SKY_PHASES) {
      const puts = painted(item, variant, 7, phase);
      expect(puts.size).toBeGreaterThan(4);
      // the pixels out of the box, gathered and compared once (an expect for each pixel took most of the kit's time)
      const out = [...puts.keys()].filter((at) => {
        const [x, y] = at.split(',').map(Number) as [number, number];
        return x < 100 - box.left || x > 100 + box.right || y < 100 - box.up || y > 100 + box.down;
      });
      expect(out, `${phase}: painted out of its box`).toEqual([]);
    }
  });

  it('paints only from the runs it names, the foam and the ink: no private colour', () => {
    const allowed = new Set([...item.uses.flatMap((name) => SHARED.fine[name]), SHARED.run.foam, SHARED.run.ink]);
    expect([...new Set(painted(item, variant, 7).values())].filter((colour) => !allowed.has(colour)), 'palette places of no run it names').toEqual([]);
  });

  it('is the same for the same seed and another thing for another: no two alike', () => {
    const seven = [...painted(item, variant, 7)];
    expect(seven).toEqual([...painted(item, variant, 7)]);
    expect(seven).not.toEqual([...painted(item, variant, 8)]);
  });
});

/** A fill's patch for the tests, and how far past it a fill may reach (a blade at the region's side or its lower edge leans out of it; the scene cuts it). */
const PATCH = { w: 180, h: 110, over: 16, under: 14 } as const;

const filled = (fill: KitFillEntry, variant: string, seed: number, phase: SkyPhase = 'day'): Map<string, number> => {
  const { brush, puts } = recording(phase);
  fill.paint(brush, PATCH.w, PATCH.h, variant, seed);
  return puts;
};

describe('the kit\'s fills', () => {
  it('each is named family/type, once, with its note, its model and its atlas words, and none shares a name with a placed type', () => {
    const ids = [...KIT, ...KIT_FILLS].map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const fill of KIT_FILLS) {
      expect(KIT_FAMILIES).toContain(fill.family);
      expect(fill.id).toMatch(new RegExp(`^${fill.family}/[a-z][a-z-]*$`));
      expect(fill.note).toMatch(/^[a-z-]+\.md$/);
      expect(fill.variants.length).toBeGreaterThan(0);
      expect(fill.uses.length).toBeGreaterThan(0);
    }
  });
});

describe.each(KIT_FILLS.flatMap((fill) => fill.variants.map((variant) => [fill.id, variant, fill] as const)))('%s, %s', (_id, variant, fill) => {
  it('paints something, inside its region (or just past its sides and lower edge), at every hour', () => {
    for (const phase of SKY_PHASES) {
      const puts = filled(fill, variant, 7, phase);
      expect(puts.size).toBeGreaterThan(4);
      const out = [...puts.keys()].filter((at) => {
        const [x, y] = at.split(',').map(Number) as [number, number];
        return x < -PATCH.over || x >= PATCH.w + PATCH.over || y < 0 || y >= PATCH.h + PATCH.under;
      });
      expect(out, `${phase}: painted out of its patch`).toEqual([]);
    }
  });

  it('paints only from the runs it names, the foam and the ink: no private colour', () => {
    const allowed = new Set([...fill.uses.flatMap((name) => SHARED.fine[name]), SHARED.run.foam, SHARED.run.ink]);
    expect([...new Set(filled(fill, variant, 7).values())].filter((colour) => !allowed.has(colour)), 'palette places of no run it names').toEqual([]);
  });

  it('is the same for the same seed and another for another', () => {
    const seven = [...filled(fill, variant, 7)];
    expect(seven).toEqual([...filled(fill, variant, 7)]);
    expect(seven).not.toEqual([...filled(fill, variant, 8)]);
  });
});

describe('placing a type from a scene', () => {
  it('takes a variant by name and options over it', () => {
    expect(optionsOf(boulder)).toEqual({ wide: 34, high: 30, wet: false, dark: 0 });
    expect(optionsOf(boulder, 'in-water', { wide: 20 })).toEqual({ wide: 20, high: 30, wet: true, dark: 0 });
    expect(() => optionsOf(boulder, 'floating')).toThrow(/stones\/boulder has no variant "floating".*middle/);
  });

  it('says which material is missing when the scene\'s palette left it out', () => {
    const few = scenePalette({}, ['grass']);
    const { brush } = recording('day', 1, few);
    expect(() => boulder.paint(brush, 50, 50, optionsOf(boulder), 1)).toThrow(/stones\/boulder paints with "stone".*use/);
    expect(runOf(SHARED.run, 'stone', 'x')).toBe(SHARED.run.stone);
  });

  it('a brush on a bitmap carries the scene\'s loop and wind to what moves, and neither when the scene stands still', () => {
    const bitmap = createBitmap(8, 8);
    const still = brushOn(bitmap, SHARED, 'day', 1);
    expect(still.sway).toBeUndefined();
    expect(still.lean).toBeUndefined();
    const windy = brushOn(bitmap, SHARED, 'day', 1, { sway: (p) => p, lean: (x, y) => x + y });
    expect(windy.sway?.(0.5)).toBe(0.5);
    expect(windy.lean?.(2, 3)).toBe(5);
  });

  it('a brush on a bitmap cuts what falls outside it', () => {
    const bitmap = createBitmap(40, 30);
    boulder.paint(brushOn(bitmap, SHARED, 'day', -1), 0, 29, optionsOf(boulder, 'big'), 3);
    expect(bitmap.pixels.some((p) => p !== 0)).toBe(true);
  });
});

describe('stones: what the docks\' recipe asks (artists-notes/stones.md)', () => {
  const tones = (puts: Map<string, number>): Set<number> => new Set(puts.values());

  it('a boulder is lit in a few flat bands of the stone, not a smooth ramp', () => {
    const stone = new Set(SHARED.fine.stone);
    const used = [...tones(painted(KIT[0]!, 'big', 5))].filter((c) => stone.has(c));
    // four bands, each with or without the pale rim: never the whole run
    expect(used.length).toBeGreaterThanOrEqual(3);
    expect(used.length).toBeLessThanOrEqual(8);
    expect(used.length).toBeLessThan(stone.size);
  });

  it('its lit side follows the light', () => {
    const light = SHARED.fine.stone.slice(-Math.ceil(SHARED.fine.stone.length / 2));
    const lit = (side: number): number => {
      const { brush, puts } = recording('day', side);
      boulder.paint(brush, 100, 100, optionsOf(boulder, 'big'), 5);
      let left = 0, right = 0;
      for (const [at, colour] of puts) {
        if (!light.includes(colour)) continue;
        if (Number(at.split(',')[0]) < 100) left++;
        else right++;
      }
      return right - left;
    };
    expect(lit(1)).toBeGreaterThan(lit(-1));
  });

  it('one near the viewer is painted from the dark end of the stone only', () => {
    const order = SHARED.fine.stone;
    const lightest = (variant: string): number => Math.max(...[...tones(painted(KIT[0]!, variant, 5))].map((c) => order.indexOf(c)));
    expect(lightest('foreground')).toBeLessThan(lightest('middle'));
  });

  it('one in the water has a wet, weedy foot and foam round it; one on land has neither', () => {
    expect(tones(painted(KIT[0]!, 'in-water', 5)).has(SHARED.run.foam)).toBe(true);
    expect(tones(painted(KIT[0]!, 'in-water', 5)).has(SHARED.run.bush[0]!)).toBe(true);
    expect(tones(painted(KIT[0]!, 'middle', 5)).has(SHARED.run.foam)).toBe(false);
  });

  it('the foam comes and goes with the scene\'s loop', () => {
    const at = (sway: number): string[] => {
      const { brush, puts } = recording('day');
      boulder.paint({ ...brush, sway: () => sway }, 100, 100, optionsOf(boulder, 'in-water'), 5);
      return [...puts].filter(([, c]) => c === SHARED.run.foam).map(([k]) => k);
    };
    expect(at(1)).not.toEqual(at(-1));
  });

  it('a pebble is four flat tones at most, light on top and dark under', () => {
    const { brush, puts } = recording('day');
    pebble.paint(brush, 100, 100, optionsOf(pebble, 'cobble'), 3);
    expect(tones(puts).size).toBeLessThanOrEqual(4);
    const order = SHARED.run.stone;
    const row = (y: number): number[] => [...puts].filter(([k]) => Number(k.split(',')[1]) === y).map(([, c]) => order.indexOf(c));
    const ys = [...puts.keys()].map((k) => Number(k.split(',')[1]));
    const mean = (v: number[]): number => v.reduce((a, b) => a + b, 0) / v.length;
    expect(mean(row(Math.min(...ys) + 1))).toBeGreaterThan(mean(row(Math.max(...ys))));
  });
});
describe('lights: what the docks\' recipe after Woodtick asks (artists-notes/light-and-heat.md)', () => {
  const embers = new Set(SHARED.fine.ember);
  /** A stone plane: its darkest tone in a seam down the middle, a lit tone either side; the sea below row 140. */
  const scene = (phase: SkyPhase): { brush: KitBrush; puts: Map<string, number> } => {
    const { brush, puts } = recording(phase);
    const stone = SHARED.run.stone;
    return {
      puts,
      brush: {
        ...brush,
        under: (x, y) => (y >= 140 ? { colour: SHARED.run.sea[2]!, thing: false } : x >= 90 && x <= 130 && y >= 95 ? { colour: x === 110 ? stone[0]! : stone[3]!, thing: true } : { colour: 0, thing: false }),
      },
    };
  };

  it('a lamp burns at dusk and night and lays nothing but its lantern by day and at dawn', () => {
    for (const phase of ['day', 'dawn'] as const) {
      const { brush, puts } = scene(phase);
      lamp.paint(brush, 100, 100, optionsOf(lamp), 1);
      expect([...puts.values()].some((c) => embers.has(c) && c !== SHARED.run.ember[4] && c !== SHARED.run.ember[5]), phase).toBe(false);
    }
    for (const phase of ['dusk', 'night'] as const) {
      const { brush, puts } = scene(phase);
      lamp.paint(brush, 100, 100, optionsOf(lamp, undefined, { lantern: false }), 1);
      expect(puts.size, phase).toBeGreaterThan(20);
    }
  });

  it('it warms what is lit already and leaves the seams dark; a halo over the bare sky; dashes only on the water', () => {
    const { brush, puts } = scene('night');
    lamp.paint(brush, 100, 100, optionsOf(lamp, undefined, { lantern: false, water: 40 }), 1);
    const at = (x: number, y: number): number | undefined => puts.get(`${x},${y}`);
    expect(at(110, 104)).toBeUndefined();
    expect([...puts].some(([k]) => k.startsWith('108,') && Number(k.split(',')[1]) >= 95 && Number(k.split(',')[1]) < 120)).toBe(true);
    // the halo: over the bare sky above the lantern, near it
    expect([...puts].some(([k]) => Number(k.split(',')[1]) < 95)).toBe(true);
    // on the water: only below row 140, and only warm
    const water = [...puts].filter(([k]) => Number(k.split(',')[1]) > 140);
    expect(water.length).toBeGreaterThan(5);
    for (const [, c] of water) expect(embers.has(c)).toBe(true);
  });

  it('a lantern\'s glass is pale by day and lit at night', () => {
    const glass = (phase: SkyPhase): Set<number> => {
      const { brush, puts } = recording(phase);
      lantern.paint(brush, 100, 100, optionsOf(lantern), 0);
      return new Set(puts.values());
    };
    expect(glass('day').has(SHARED.run.ember[5]!)).toBe(false);
    expect(glass('night').has(SHARED.run.ember[5]!)).toBe(true);
  });
});

describe('water: what the docks\' recipe after the Phatt dock asks (artists-notes/water.md)', () => {
  /** A sea 200 by 120 under a horizon at row 2, its shore 4 m from the lower edge, a post standing in it. */
  const bay = (stands: SeaGround['stands'] = []): SeaGround => ({
    width: 200, height: 120, horizon: 2, glint: -999, stands,
    place: (x, y) => {
      if (y <= 2 || y >= 120 || x < 0 || x >= 200) return null;
      const gz = 640 / (y - 2);
      return gz > 3 ? { shore: gz - 3, gx: x / 40, gz } : null;
    },
  });
  const order = (c: number): number => SHARED.fine.sea.indexOf(c);

  it('the sea is darkest in a broad far band under the horizon, then steps up through a brighter body toward the viewer', () => {
    const { brush, puts } = recording('day');
    sea.paint(brush, bay(), sea.options, 0);
    const mean = (y: number): number => {
      const row = [...puts].filter(([k]) => Number(k.split(',')[1]) === y).map(([, c]) => order(c)).filter((k) => k >= 0);
      return row.reduce((a, b) => a + b, 0) / row.length;
    };
    expect(mean(20)).toBeLessThan(mean(60));
    expect(mean(60)).toBeLessThanOrEqual(mean(100));
  });

  it('the bands round a post are the sea\'s own pale tones, never the foam\'s white, and slide on as the loop goes', () => {
    const at = (beat: number): Map<string, number> => {
      const { brush, puts } = recording('day');
      rings.paint({ ...brush, beat }, bay([{ x: 100, y: 70, r: 3, leg: true }]), rings.options, 0);
      return puts;
    };
    const still = at(0);
    expect(still.size).toBeGreaterThan(50);
    expect([...still.values()].includes(SHARED.run.foam)).toBe(false);
    for (const c of still.values()) expect(order(c)).toBeGreaterThanOrEqual(0);
    expect([...at(0.5)]).not.toEqual([...still]);
  });

  it('no band closes round a boulder: it opens on its upstream side', () => {
    const { brush, puts } = recording('day');
    rings.paint(brush, bay([{ x: 100, y: 70, r: 10, leg: false }]), rings.options, 0);
    const upstream = [...puts.keys()].filter((k) => Number(k.split(',')[0]) < 100 - 10 && Math.abs(Number(k.split(',')[1]) - 70) < 3);
    expect(upstream.length).toBe(0);
  });

  it('a reflection lies only on the bare water, near-black', () => {
    const { brush, puts } = recording('day');
    const shore = (x: number) => x > 104;
    reflection.paint({ ...brush, under: (x) => ({ colour: SHARED.run.sea[2]!, thing: shore(x) }) }, 100, 100, optionsOf(reflection, 'thick'), 3);
    expect(puts.size).toBeGreaterThan(5);
    for (const [k, c] of puts) {
      expect(shore(Number(k.split(',')[0]))).toBe(false);
      expect([SHARED.run.near[0], SHARED.run.wood[0]]).toContain(c);
    }
  });
});

describe('wood: what the docks\' recipe after the Phatt dock asks (artists-notes/wood.md)', () => {
  it('a post is near-black on its shade side, and its cut top is cream, the palest thing on it', () => {
    const { brush, puts } = recording('day', -1);
    post.paint(brush, 100, 100, optionsOf(post), 4);
    const colours = new Set(puts.values());
    expect(colours.has(SHARED.run.wood[0]!)).toBe(true);
    expect(colours.has(SHARED.run.dry[3]!)).toBe(true);
    // the cut top lies above the pole's own body
    const top = Math.min(...[...puts].filter(([, c]) => c === SHARED.run.dry[3]).map(([k]) => Number(k.split(',')[1])));
    expect(top).toBeLessThan(100 - post.options.high + post.options.thick);
  });

  it('one in the water laps its foot with foam that comes and goes; one on land has none', () => {
    const foam = (o: Parameters<typeof post.paint>[3], sway: number): boolean => {
      const { brush, puts } = recording('day');
      post.paint({ ...brush, sway: () => sway }, 100, 100, o, 4);
      return [...puts.values()].includes(SHARED.run.foam);
    };
    expect(foam(optionsOf(post, 'in-water'), -1)).toBe(true);
    expect(foam(optionsOf(post), 1)).toBe(false);
  });

  it('a deck\'s planks are warm wood, each with a pale top edge and a near-black gap', () => {
    const { brush, puts } = recording('day');
    const deck = KIT_FILLS.find((f) => f.id === planks.id)!;
    deck.paint(brush, 180, 110, 'deck', 1);
    const colours = [...puts.values()];
    for (const c of colours) expect(SHARED.fine.wood.includes(c)).toBe(true);
    expect(colours.filter((c) => c === SHARED.run.wood[5]).length).toBeGreaterThan(20);
    expect(colours.filter((c) => c === SHARED.run.wood[0]).length).toBeGreaterThan(colours.length / 20);
  });
});
