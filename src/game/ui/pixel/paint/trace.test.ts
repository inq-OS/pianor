import { describe, expect, it } from 'vitest';
import { Bent, Box, type Skin } from './trace';

const skin = (): Skin => ({ nx: 0, ny: 0, nz: 0, u: 0, v: 0, face: -1 });
const none = (): void => undefined;

/** Where a ray straight down from 1 m over (`x`, `z`) meets a shape, as a height; NaN when it misses. */
function under(shape: { hit: Box['hit'] }, x: number, z: number): number {
  const t = shape.hit(x, 1, z, 0, -1, 0, 0.001, 10);
  return t < 0 ? NaN : 1 - t;
}

describe('a bent sheet in the ray caster (the room\'s papers, ft_1_18.AC3)', () => {
  it('ft_1_18.AC3 a sheet that does not rise or fall is met where a box of its size is, on every side', () => {
    const flat = new Bent([0.3, 0.5, -0.2], [0.2, 0.15], 0.4, 0.02, () => 0, none);
    const box = new Box([0.3, 0.49, -0.2], [0.2, 0.01, 0.15], 0.4, none);
    const rays = [[0.3, 1, -0.2, 0, -1, 0], [0.25, 1, -0.1, 0.1, -1, 0.05], [-1, 0.495, -0.2, 1, 0, 0.02], [0.3, 0.492, 1, 0.01, 0, -1], [0.3, 0, -0.2, 0.05, 1, 0], [2, 1, 2, 0, -1, 0]] as const;
    for (const [ox, oy, oz, dx, dy, dz] of rays) {
      expect(flat.hit(ox, oy, oz, dx, dy, dz, 0.001, 10), `${ox} ${oy} ${oz}`).toBeCloseTo(box.hit(ox, oy, oz, dx, dy, dz, 0.001, 10), 4);
    }
  });

  it('ft_1_18.AC3 a sheet follows its lift: it droops where it hangs over an edge, and its skin faces as it slopes', () => {
    // level over the pile, then falling by the square of how far it hangs out past 0.1
    const droop = (lx: number): number => (lx > 0.1 ? -4 * (lx - 0.1) ** 2 : 0);
    const sheet = new Bent([0, 0.6, 0], [0.25, 0.15], 0, 0.005, droop, none);
    expect(under(sheet, 0, 0)).toBeCloseTo(0.6, 4);
    expect(under(sheet, 0.2, 0)).toBeCloseTo(0.6 - 0.04, 4);
    expect(under(sheet, 0.3, 0)).toBeNaN();
    const s = skin();
    sheet.skin(0, 0.6, 0, s);
    expect([s.face, s.ny]).toEqual([3, 1]);
    expect([s.u, s.v]).toEqual([0, 0]);
    sheet.skin(0.2, 0.56, 0.05, s);
    // on the droop it faces up and out, the way the paper falls
    expect(s.face).toBe(3);
    expect(s.nx).toBeGreaterThan(0.5);
    expect(s.ny).toBeGreaterThan(0.5);
    expect(Math.hypot(s.nx, s.ny, s.nz)).toBeCloseTo(1, 6);
    // from below, its under side
    const t = sheet.hit(0, 0, 0, 0, 1, 0, 0.001, 10);
    expect(t).toBeCloseTo(0.595, 4);
    sheet.skin(0, t, 0, s);
    expect([s.face, s.ny]).toEqual([2, -1]);
  });

  it('ft_1_18.AC3 a ray that starts on a sheet does not meet the same sheet again, and one that comes in at a cut edge meets the edge', () => {
    const curl = (lx: number, lz: number): number => 0.05 * Math.max(0, lx / 0.2 + lz / 0.2 - 1) ** 2;
    const sheet = new Bent([0, 0.5, 0], [0.2, 0.2], 0, 0.02, curl, none);
    // from a place on its top, upward: nothing
    expect(sheet.hit(0, 0.5, 0, 0.3, 1, 0.1, 0.001, 10)).toBe(-1);
    // level, into its edge at half its thickness
    const t = sheet.hit(-1, 0.49, 0, 1, 0, 0, 0.001, 10);
    expect(t).toBeCloseTo(0.8, 6);
    const s = skin();
    sheet.skin(-0.2, 0.49, 0, s);
    expect([s.face, s.nx, s.v]).toEqual([0, -1, expect.closeTo(0, 6)]);
    // its curled corner stands higher than its middle
    expect(under(sheet, 0.19, 0.19)).toBeGreaterThan(under(sheet, 0, 0) + 0.03);
  });
  it('ft_1_18.AC3 a sheet with a worn edge ends inside its rectangle: a ray past the edge goes by, and one into the edge meets it where the paper begins', () => {
    const flat = (): number => 0;
    // the paper ends 5 centimetres inside the rectangle on every side
    const sheet = new Bent([0, 0.5, 0], [0.2, 0.2], 0, 0.02, flat, none, () => 0.05);
    // straight down: on the paper it is met, in the worn margin it is not
    expect(sheet.hit(0.1, 1, 0, 0, -1, 0, 0.001, 10)).toBeCloseTo(0.5, 4);
    expect(sheet.hit(0.18, 1, 0, 0, -1, 0, 0.001, 10)).toBe(-1);
    expect(sheet.hit(0, 1, -0.17, 0, -1, 0, 0.001, 10)).toBe(-1);
    // level, at half its thickness: it goes through the margin and meets the paper's own edge, within a step of it
    const t = sheet.hit(-1, 0.49, 0, 1, 0, 0, 0.001, 10);
    expect(t).toBeGreaterThan(0.849);
    expect(t).toBeLessThan(0.856);
    const s = skin();
    sheet.skin(-1 + t, 0.49, 0, s);
    expect([s.face, s.nx]).toEqual([0, -1]);
    // slanting down through the margin: it leaves the sheet's thickness before the paper begins, and misses
    expect(sheet.hit(-0.19, 0.51, 0, 0.2, -1, 0, 0.001, 10)).toBe(-1);
  });
});
