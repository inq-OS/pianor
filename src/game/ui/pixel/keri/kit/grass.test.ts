import { describe, expect, it } from 'vitest';
import { KERI_HOURS, scenePalette } from '../keriPalette';
import { blades, blooms, clump, gravel, moss, slopePatch, swells } from './grass';
import { optionsOf, type KitBrush, type KitGround } from './kit';

/** What the grass recipe asks (projects/painter/artists-notes/grass.md), beyond the kit's rules every type keeps. */

const SHARED = scenePalette();

function recording(lean?: number): { brush: KitBrush; puts: Map<string, number> } {
  const puts = new Map<string, number>();
  const brush: KitBrush = { put: (x, y, c) => void puts.set(`${Math.round(x)},${Math.round(y)}`, c), run: SHARED.run, fine: SHARED.fine, hour: KERI_HOURS.day, side: 0.4 };
  return { puts, brush: lean === undefined ? brush : { ...brush, lean: () => lean } };
}

const count = (puts: Map<string, number>, run: readonly number[]): number => [...puts.values()].filter((c) => run.includes(c)).length;

describe('grass/swells', () => {
  it('lays bare earth where the ground is trodden and grass round it', () => {
    const { brush, puts } = recording();
    const ground = slopePatch(200, 100);
    swells.paint(brush, ground, optionsOf(swells), 0);
    expect(SHARED.fine.earth).toContain(puts.get('100,50'));
    expect(SHARED.fine.grass).toContain(puts.get('20,80'));
  });

  it('is lighter at its top edge than toward the viewer', () => {
    const { brush, puts } = recording();
    swells.paint(brush, slopePatch(200, 120), optionsOf(swells), 0);
    const light = (y: number): number => {
      const row = Array.from({ length: 40 }, (_, x) => SHARED.fine.grass.indexOf(puts.get(`${x},${y}`)!)).filter((k) => k >= 0);
      return row.reduce((a, b) => a + b, 0) / row.length;
    };
    expect(light(10)).toBeGreaterThan(light(115));
  });
});

describe('grass/blades', () => {
  const run = (variant: string, ground: KitGround = slopePatch(200, 100)): Map<string, number> => {
    const { brush, puts } = recording();
    blades.paint(brush, ground, optionsOf(blades, variant), 0);
    return puts;
  };

  it('the dry variant is more gold than the meadow', () => {
    expect(count(run('dry'), SHARED.fine.dry)).toBeGreaterThan(count(run('meadow'), SHARED.fine.dry));
  });

  it('grows nothing on the trodden earth', () => {
    const puts = run('meadow');
    expect(puts.has('100,50')).toBe(false);
  });

  it('hardly grows where the ground is covered (a stone, a cushion)', () => {
    const ground = slopePatch(200, 100);
    for (let y = 0; y < 100; y++) for (let x = 0; x < 200; x++) ground.cover(x, y);
    // rows well above the region's lower edge, where every blade is rooted inside it
    const high = (puts: Map<string, number>): number => [...puts.keys()].filter((k) => Number(k.split(',')[1]) < 80).length;
    expect(high(run('meadow', ground))).toBeLessThan(high(run('meadow')) * 0.2);
  });
});

describe('the other fills', () => {
  it('moss covers the ground it lies on, so blades grow round it', () => {
    const ground = slopePatch(200, 100);
    moss.paint(recording().brush, ground, optionsOf(moss), 0);
    let covered = 0;
    for (let y = 0; y < 100; y++) for (let x = 0; x < 200; x++) if (ground.bare(x, y)) covered++;
    expect(covered).toBeGreaterThan(20);
  });

  it('thick gravel and rich blooms lay more than the plain ones, never on the trodden place', () => {
    const lay = (paint: (brush: KitBrush) => void): Map<string, number> => {
      const { brush, puts } = recording();
      paint(brush);
      return puts;
    };
    const stones = (variant: string): Map<string, number> => lay((b) => gravel.paint(b, slopePatch(240, 140), optionsOf(gravel, variant), 0));
    const flowers = (variant: string): Map<string, number> => lay((b) => blooms.paint(b, slopePatch(240, 140), optionsOf(blooms, variant), 0));
    expect(stones('thick').size).toBeGreaterThan(stones('patches').size);
    expect(flowers('rich').size).toBeGreaterThan(flowers('meadow').size);
    expect(stones('thick').has('120,70')).toBe(false);
  });
});

describe('grass/clump', () => {
  it('bends the wind\'s way where the scene\'s gust leans it, and stands straight without wind', () => {
    const tips = (lean?: number): number => {
      const { brush, puts } = recording(lean);
      clump.paint(brush, 100, 100, optionsOf(clump, 'near'), 3);
      const top = Math.min(...[...puts.keys()].map((k) => Number(k.split(',')[1])));
      const xs = [...puts.keys()].filter((k) => Number(k.split(',')[1]) < top + 8).map((k) => Number(k.split(',')[0]));
      return xs.reduce((a, b) => a + b, 0) / xs.length;
    };
    expect(tips(0.4)).toBeGreaterThan(tips());
    expect(tips(-0.4)).toBeLessThan(tips());
  });

  it('near the viewer it is dark at its foot; far off it is pale', () => {
    const tones = (variant: string): Set<number> => {
      const { brush, puts } = recording();
      clump.paint(brush, 100, 100, optionsOf(clump, variant), 3);
      return new Set(puts.values());
    };
    expect(tones('near').has(SHARED.run.near[0]!)).toBe(true);
    expect([...tones('far')].every((c) => SHARED.fine.far.includes(c))).toBe(true);
  });
});
