import { describe, expect, it } from 'vitest';
import { KERI_HOURS, scenePalette } from '../keriPalette';
import { bush, rose, roseFlower, roseRun, roseTone, stem } from './bushes';
import { optionsOf, type KitBrush } from './kit';

/** What the bushes recipe asks (projects/painter/artists-notes/bushes-and-foliage.md), beyond the kit's rules. */

const SHARED = scenePalette();

function recording(side = 0.4, lean?: number): { brush: KitBrush; puts: Map<string, number> } {
  const puts = new Map<string, number>();
  const brush: KitBrush = { put: (x, y, c) => void puts.set(`${Math.round(x)},${Math.round(y)}`, c), run: SHARED.run, fine: SHARED.fine, hour: KERI_HOURS.day, side };
  return { puts, brush: lean === undefined ? brush : { ...brush, lean: () => lean } };
}

describe('bushes/bush', () => {
  it('its lit side follows the light', () => {
    const lit = (side: number): number => {
      const { brush, puts } = recording(side);
      bush.paint(brush, 100, 100, optionsOf(bush, 'round'), 4);
      const light = SHARED.run.bush.slice(3);
      let score = 0;
      for (const [at, c] of puts) if (light.includes(c)) score += Number(at.split(',')[0]) < 100 ? -1 : 1;
      return score;
    };
    expect(lit(1)).toBeGreaterThan(lit(-1));
  });
});

describe('bushes/rose', () => {
  it('stands highest at its left end and falls to the ground at its right', () => {
    const { brush, puts } = recording();
    rose.paint(brush, 200, 300, optionsOf(rose, 'low'), 2);
    const topAt = (x: number): number => Math.min(...[...puts.keys()].filter((k) => Number(k.split(',')[0]) === x).map((k) => Number(k.split(',')[1])));
    expect(topAt(150)).toBeLessThan(topAt(240));
  });

  it('stands tall: its top keeps its full height over half its width before it falls (the crossroads, 3 m)', () => {
    const topAt = (variant: string, share: number): number => {
      const { brush, puts } = recording();
      const o = optionsOf(rose, variant);
      rose.paint(brush, 300, 400, o, 3);
      const x = Math.round(300 - o.wide / 2 + o.wide * share);
      return Math.min(...[...puts.keys()].filter((k) => Number(k.split(',')[0]) === x).map((k) => Number(k.split(',')[1])));
    };
    expect(400 - topAt('tall', 0.45)).toBeGreaterThan(optionsOf(rose, 'tall').high * 0.85);
    expect(400 - topAt('corner', 0.45)).toBeLessThan(optionsOf(rose, 'corner').high * 0.8);
  });

  it('has flowers or hips among its leaves, each with leaves all round it', () => {
    const { brush, puts } = recording();
    rose.paint(brush, 120, 250, optionsOf(rose), 0);
    const petals = new Set(SHARED.run.rose);
    expect([...puts.values()].filter((c) => petals.has(c)).length).toBeGreaterThan(10);
  });

  it('hands out its look in pieces for a thicket a scene shapes its own way', () => {
    const { brush, puts } = recording();
    expect(roseRun(brush)).toHaveLength(5);
    expect(roseTone(0.5, 10, 10)).toBeGreaterThanOrEqual(0);
    expect(roseTone(0.5, 10, 10)).toBeLessThanOrEqual(1);
    roseFlower(brush, 10, 10, true, false);
    expect(puts.size).toBe(2);
    roseFlower(brush, 20, 10, false, true);
    expect(puts.get('20,10')).toBe(SHARED.run.bloom[1]);
  });
});

describe('bushes/stem', () => {
  it('its head bends the wind\'s way', () => {
    const head = (lean?: number): number => {
      const { brush, puts } = recording(0.4, lean);
      stem.paint(brush, 100, 300, optionsOf(stem, 'short'), 1);
      const top = Math.min(...[...puts.keys()].map((k) => Number(k.split(',')[1])));
      const xs = [...puts.keys()].filter((k) => Number(k.split(',')[1]) < top + 6).map((k) => Number(k.split(',')[0]));
      return xs.reduce((a, b) => a + b, 0) / xs.length;
    };
    expect(head(0.5)).toBeGreaterThan(head());
  });
});
