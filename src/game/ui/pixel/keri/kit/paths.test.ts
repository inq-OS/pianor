import { describe, expect, it } from 'vitest';
import { KERI_HOURS, scenePalette } from '../keriPalette';
import { optionsOf, type KitBrush } from './kit';
import { concrete, sand, slabPatch, slabs, trail, trailPatch } from './paths';

/** What the paths recipe asks (projects/painter/artists-notes/paths.md), beyond the kit's rules. */

const SHARED = scenePalette();

function recording(side = 0.4): { brush: KitBrush; puts: Map<string, number> } {
  const puts = new Map<string, number>();
  const brush: KitBrush = { put: (x, y, c) => void puts.set(`${Math.round(x)},${Math.round(y)}`, c), run: SHARED.run, fine: SHARED.fine, hour: KERI_HOURS.day, side };
  return { puts, brush };
}

const W = 200, H = 110;

describe('paths/slabs', () => {
  it('lays dark seams between the slabs, in the run\'s darkest grey (rule 7)', () => {
    const { brush, puts } = recording();
    const ground = slabPatch(W, H);
    slabs.paint(brush, ground, optionsOf(slabs, 'worn'), 3);
    const run = concrete(brush);
    let seams = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (ground.laid(x, y) === 2) seams++;
    expect(seams).toBeGreaterThan(20);
    expect([...puts.values()].filter((c) => c === run[0]).length).toBeGreaterThan(20);
  });

  it('is mottled: many tones of its run, never one even colour (rule 6)', () => {
    const { brush, puts } = recording();
    slabs.paint(brush, slabPatch(W, H), optionsOf(slabs, 'worn'), 3);
    const run = concrete(brush);
    const used = new Set([...puts.values()].filter((c) => run.includes(c)));
    expect(used.size).toBeGreaterThanOrEqual(5);
  });

  it('is lighter on the side the light comes from', () => {
    const lightRight = (side: number): number => {
      const { brush, puts } = recording(side);
      slabs.paint(brush, slabPatch(W, H), optionsOf(slabs, 'worn'), 3);
      const run = concrete(brush);
      let score = 0;
      for (const [at, c] of puts) {
        const i = run.indexOf(c);
        if (i > 0) score += (Number(at.split(',')[0]) < W / 2 ? -1 : 1) * i;
      }
      return score;
    };
    expect(lightRight(1)).toBeGreaterThan(lightRight(-1));
  });
});

describe('paths/trail', () => {
  it('is pale where feet go and darker toward its edges (rule 9)', () => {
    const { brush, puts } = recording();
    const ground = trailPatch(W, H);
    trail.paint(brush, ground, optionsOf(trail, 'footpath'), 3);
    const run = sand(brush);
    const mean = (pick: (off: number) => boolean): number => {
      const tones: number[] = [];
      for (const [at, c] of puts) {
        const [x, y] = at.split(',').map(Number) as [number, number];
        const place = ground.place(x, y), i = run.indexOf(c);
        if (place && i >= 0 && pick(place.off)) tones.push(i);
      }
      return tones.reduce((a, b) => a + b, 0) / tones.length;
    };
    expect(mean((off) => off < 0.1)).toBeGreaterThan(mean((off) => off > 0.25) + 1);
  });

  it('has its small stones along one edge only (rule 10)', () => {
    const { brush, puts } = recording();
    const ground = trailPatch(W, H);
    trail.paint(brush, ground, optionsOf(trail, 'footpath'), 3);
    const stones = new Set([SHARED.fine.stone[7], SHARED.fine.stone[8]]);
    const sides = [...puts].filter(([, c]) => stones.has(c)).map(([at]) => {
      const [x, y] = at.split(',').map(Number) as [number, number];
      return ground.place(x, y)?.side ?? 0;
    });
    expect(sides.length).toBeGreaterThan(5);
    expect(sides.every((s) => s > 0)).toBe(true);
  });

  it('fades into the grass toward its far end (rule 11)', () => {
    const { brush, puts } = recording();
    const ground = trailPatch(W, H);
    trail.paint(brush, ground, optionsOf(trail, 'footpath'), 3);
    const share = (y0: number, y1: number): number => {
      let on = 0, near = 0;
      for (let y = y0; y < y1; y++) for (let x = 0; x < W; x++) {
        const place = ground.place(x, y);
        if (!place || place.off > 0.15) continue;
        near++;
        if (puts.has(`${x},${y}`)) on++;
      }
      return on / near;
    };
    expect(share(0, 8)).toBeLessThan(share(H - 20, H) - 0.2);
  });
});
