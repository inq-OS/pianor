import { describe, expect, it } from 'vitest';
import { SKY_PHASES } from '../../../../core/sky/skyPhase';
import { PALETTE } from '../palette';
import { lchOf } from '../paint/lab';
import { APART, KERI_HOURS, MAX_STEP, PALETTE_ROOM, scenePalette, tone } from './keriPalette';

const rgb = (hex: number): [number, number, number] => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
const bright = (hex: number): number => { const [r, g, b] = rgb(hex); return 0.3 * r + 0.5 * g + 0.2 * b; };

describe('Keri\'s shared palette (ft_1_19, d111)', () => {
  const shared = scenePalette();
  const runs = Object.entries(shared.run).map(([name, at]) => [name, typeof at === 'number' ? [at] : at] as const);

  it('ft_1_19.AC5 a scene\'s palette is the game\'s own colours, then Keri\'s runs, at the same places at every hour', () => {
    for (const phase of SKY_PHASES) {
      const palette = shared.at(phase);
      expect(palette.slice(0, PALETTE.length)).toEqual([...PALETTE]);
      expect(palette.length).toBe(shared.count);
    }
    expect(shared.count).toBeLessThanOrEqual(PALETTE_ROOM);
    // Every place after the game's own colours belongs to exactly one run: a whole run, or a thing of one or two colours.
    const { ink, foam, moon, star } = shared.run;
    const places = [...Object.values(shared.fine).flat(), ink, foam, ...moon, ...star].sort((a, b) => a - b);
    expect(places).toEqual(Array.from({ length: shared.count - PALETTE.length }, (_, i) => PALETTE.length + i));
  });

  it('ft_1_19.AC5 the materials have their names: grass, stone, shingle, sea, sky and the rest', () => {
    for (const name of ['sky', 'cloud', 'sea', 'moon', 'star', 'grass', 'dry', 'far', 'shingle', 'stone', 'earth', 'ash', 'bush', 'near', 'stem', 'bloom', 'rose', 'smoke', 'ember'] as const) {
      expect(shared.run[name].length, name).toBeGreaterThanOrEqual(2);
    }
    expect(shared.run.ink).toBeGreaterThanOrEqual(PALETTE.length);
    expect(shared.run.foam).toBeGreaterThanOrEqual(PALETTE.length);
  });

  it('ft_1_19.AC5 a run goes from dark to light at every hour, so a tone means the same at each', () => {
    // The flowers are handfuls of colours, not runs of one.
    for (const phase of SKY_PHASES) for (const [name, at] of runs.filter(([n]) => n !== 'bloom' && n !== 'rose' && n !== 'moon' && n !== 'star' && n !== 'cloud')) {
      const light = at.map((i) => bright(shared.at(phase)[i]!));
      for (let i = 1; i < light.length; i++) expect(light[i]!, `${name} at ${phase}`).toBeGreaterThan(light[i - 1]!);
    }
    // A cloud is listed from its lit top down.
    for (const phase of SKY_PHASES) expect(bright(shared.at(phase)[shared.run.cloud[0]!]!)).toBeGreaterThan(bright(shared.at(phase)[shared.run.cloud[3]!]!));
  });

  it('ft_1_19.AC5 the hour lights the land: the day leaves it as it is, the night darkens it and turns it blue; embers keep their own light', () => {
    const { grass, stone, ember } = shared.run;
    const day = shared.at('day'), night = shared.at('night');
    for (const i of [...grass, ...stone]) {
      expect(bright(night[i]!)).toBeLessThan(bright(day[i]!));
      const [r, , b] = rgb(night[i]!);
      expect(b).toBeGreaterThan(r);
    }
    // The middle of a run goes deep: a mid grass of the day keeps under 60 percent of its lightness at night.
    const mid = grass[Math.floor(grass.length / 2)]!;
    expect(lchOf(night[mid]!).l).toBeLessThan(lchOf(day[mid]!).l * 0.6);
    for (const phase of SKY_PHASES) expect(ember.map((i) => shared.at(phase)[i])).toEqual(ember.map((i) => day[i]));
    // A fire shows most when the light is least.
    expect(KERI_HOURS.night.glow).toBeGreaterThan(KERI_HOURS.dusk.glow);
    expect(KERI_HOURS.dusk.glow).toBeGreaterThan(KERI_HOURS.day.glow);
    expect(SKY_PHASES.filter((phase) => KERI_HOURS[phase].night)).toEqual(['night']);
  });

  it('ft_1_19.AC5 the night keeps a run long, as the 1991 nights reach from near black to a moonlit plane (d123)', () => {
    // A flat multiply squeezed the night into the dark end (a spread of about 35 L*); MI2's nights spread 60 to 77.
    const spread = (name: 'grass' | 'stone' | 'shingle' | 'bush', phase: 'day' | 'night'): number => {
      const [dark, light] = [shared.run[name][0]!, shared.run[name].at(-1)!].map((i) => lchOf(shared.at(phase)[i]!).l);
      return light! - dark!;
    };
    for (const name of ['grass', 'stone', 'shingle', 'bush'] as const) expect(spread(name, 'night'), name).toBeGreaterThan(spread(name, 'day') * 0.65);
    // Dusk lays warm light and cool shade: the light end of the grass leans warmer than its dark end.
    const dusk = shared.at('dusk');
    const warmth = (hex: number): number => { const [r, , b] = rgb(hex); return r - b; };
    expect(warmth(dusk[shared.run.grass.at(-1)!]!)).toBeGreaterThan(warmth(dusk[shared.run.grass[0]!]!));
  });

  it('ft_1_19.AC5 a scene that names the materials it paints with gets only those, and the room it saves (d123)', () => {
    const few = scenePalette({ boat: [0x5a1010, 0xe04030] }, ['grass', 'stone']);
    expect(Object.keys(few.run).filter((name) => name in shared.run && !(name in few.run))).toEqual([]);
    expect('shingle' in few.run).toBe(false);
    expect('shingle' in few.fine).toBe(false);
    expect(few.run.ink).toBeGreaterThanOrEqual(PALETTE.length);
    expect(few.count).toBeLessThan(shared.count);
    for (const phase of SKY_PHASES) {
      expect(few.fine.grass.map((i) => few.at(phase)[i])).toEqual(shared.fine.grass.map((i) => shared.at(phase)[i]));
      expect(few.at(phase).length).toBe(few.count);
    }
    expect(() => scenePalette({ stone: [0x101010] }, ['grass'])).toThrow(/shared palette/);
  });

  it('ft_1_19.AC5 a scene\'s own colours come after Keri\'s, move no shared run and are lit by the hour like the rest', () => {
    const boat = scenePalette({ boat: [0x5a1010, 0xa02020, 0xe04030], door: [0x204080] });
    for (const [name] of runs) expect(boat.run[name as 'grass'], name).toEqual(shared.run[name as 'grass']);
    for (const name of Object.keys(shared.fine) as (keyof typeof shared.fine)[]) expect(boat.fine[name], name).toEqual(shared.fine[name]);
    // the boat's three reds are far apart, so each two get colours between them; the door is one colour
    expect(boat.fine.boat[0]).toBe(shared.count);
    expect(boat.fine.boat.length).toBeGreaterThan(3);
    expect(boat.fine.boat).toEqual(boat.fine.boat.map((_, i) => shared.count + i));
    expect(boat.run.boat.every((place) => boat.fine.boat.includes(place))).toBe(true);
    expect(boat.run.door).toEqual([shared.count + boat.fine.boat.length]);
    expect(boat.count).toBe(shared.count + boat.fine.boat.length + 1);
    for (const phase of SKY_PHASES) {
      expect(boat.at(phase).length).toBe(boat.count);
      expect(boat.at(phase).slice(0, shared.count)).toEqual(shared.at(phase));
    }
    expect(boat.run.boat.map((i) => boat.at('day')[i])).toEqual([0x5a1010, 0xa02020, 0xe04030]);
    for (const i of boat.run.boat) expect(bright(boat.at('night')[i]!)).toBeLessThan(bright(boat.at('day')[i]!) * 0.6);
  });

  it('ft_1_19.AC5 a whole run has colours between its named tones, so no step of lightness is over MAX_STEP at any hour (d111)', () => {
    for (const [name, whole] of Object.entries(shared.fine)) {
      const tones = shared.run[name as 'grass'];
      // the named tones are in the whole run, in their order, its ends among them
      expect(whole.filter((place) => tones.includes(place)), name).toEqual([...tones]);
      expect([whole[0], whole[whole.length - 1]], name).toEqual([tones[0], tones[tones.length - 1]]);
      if (APART.has(name)) { expect(whole, name).toEqual([...tones]); continue; }
      for (const phase of SKY_PHASES) {
        const light = whole.map((place) => lchOf(shared.at(phase)[place]!).l);
        for (let i = 1; i < light.length; i++) expect(Math.abs(light[i]! - light[i - 1]!), `${name} at ${phase}, step ${i}`).toBeLessThanOrEqual(MAX_STEP + 0.5);
      }
    }
    // the day's named tones are the colours as written: the colours between change none of them
    expect(shared.run.grass.map((place) => shared.at('day')[place])).toEqual([0x123a22, 0x1e5a2c, 0x2f7a36, 0x4e9a3e, 0x86c050, 0xc0e070]);
    // long runs of small steps: the large materials have ten colours or more
    for (const name of ['sky', 'sea', 'grass', 'stone', 'bush'] as const) expect(shared.fine[name].length, name).toBeGreaterThanOrEqual(10);
  });

  it('ft_1_19.AC5 a scene may ask for a smoother sky: its run has no step of lightness over what was asked, and the other runs keep their length', () => {
    const smooth = scenePalette({}, ['stone'], { sky: 3 }), plain = scenePalette({}, ['stone']);
    expect(smooth.fine.sky.length).toBeGreaterThan(plain.fine.sky.length * 1.8);
    for (const phase of SKY_PHASES) {
      const light = smooth.fine.sky.map((place) => lchOf(smooth.at(phase)[place]!).l);
      for (let i = 1; i < light.length; i++) expect(Math.abs(light[i]! - light[i - 1]!), `sky at ${phase}, step ${i}`).toBeLessThanOrEqual(3.5);
    }
    // the named tones are the hour's own still, and nothing else grew
    expect(smooth.run.sky.map((place) => smooth.at('day')[place])).toEqual([...KERI_HOURS.day.sky]);
    for (const name of ['cloud', 'sea', 'stone', 'ember'] as const) expect(smooth.fine[name].length, name).toBe(plain.fine[name].length);
    // a step over MAX_STEP is no smoother sky: the run stays as it is
    expect(scenePalette({}, ['stone'], { sky: 20 }).fine.sky.length).toBe(plain.fine.sky.length);
  });

  it('ft_1_19.AC5 an own run may not take a shared name, and the palette may not outgrow a byte', () => {
    expect(() => scenePalette({ grass: [0x00ff00] })).toThrow(/grass/);
    expect(() => scenePalette({ sky: [0x0000ff] })).toThrow(/sky/);
    const room = PALETTE_ROOM - shared.count;
    expect(scenePalette({ many: Array.from({ length: room }, (_, i) => i) }).count).toBe(PALETTE_ROOM);
    expect(() => scenePalette({ many: Array.from({ length: room + 1 }, (_, i) => i) })).toThrow(/256/);
  });

  it('ft_1_19.AC5 a tone picks a run\'s colour: the ends at 0 and 1, and with a spread only neighbours mix', () => {
    const run = [10, 11, 12, 13, 14];
    expect(tone(run, 0, 3, 5)).toBe(10);
    expect(tone(run, 1, 3, 5)).toBe(14);
    expect(tone(run, 0.5, 3, 5)).toBe(12);
    expect(tone(run, -2, 0, 0)).toBe(10);
    expect(tone(run, 7, 0, 0)).toBe(14);
    const mixed = new Set<number>();
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) mixed.add(tone(run, 0.375, x, y, 1));
    expect([...mixed].sort()).toEqual([11, 12]);
  });
});
