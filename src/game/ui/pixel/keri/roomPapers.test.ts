import { describe, expect, it } from 'vitest';
import type { Dab } from '../paint/trace';
import { bookBack, bookBoard, bookPages, COVERS, looseSheet, manuscript, penAt, sagging, sheaf, sheetLift, worn, SHEET, type Hang } from './roomPapers';

/** The colour a material lays at (`u`, `v`) of `face`, with the light of its own it keeps; `ny` is how much the place faces up. */
function dab(material: (d: Dab) => void, face: number, u: number, v: number, ny = 1): { r: number; g: number; b: number; emit: number } {
  const d: Dab = { face, u, v, fine: 0.004, r: 0, g: 0, b: 0, emit: 0, x: 0, y: 0, z: 0, nx: 0, ny, nz: 0 };
  material(d);
  return { r: d.r, g: d.g, b: d.b, emit: d.emit };
}

type Pen = NonNullable<ReturnType<typeof penAt>> | 'bare';

/** A page looked at every 4 millimetres: the share of each thing the pen left, and of bare paper. */
function shares(w: number, d: number, seed: number): Record<Pen, number> {
  const n: Record<Pen, number> = { rule: 0, ink: 0, red: 0, bare: 0 };
  let all = 0;
  for (let v = -d / 2 + 0.002; v < d / 2; v += 0.004) for (let u = -w / 2 + 0.002; u < w / 2; u += 0.004) { n[penAt(w, d, seed, u, v) ?? 'bare']++; all++; }
  return { rule: n.rule / all, ink: n.ink / all, red: n.red / all, bare: n.bare / all };
}

const key = (c: { r: number; g: number; b: number }): string => `${c.r.toFixed(3)} ${c.g.toFixed(3)} ${c.b.toFixed(3)}`;
const luma = (c: { r: number; g: number; b: number }): number => 0.3 * c.r + 0.5 * c.g + 0.2 * c.b;

describe('paper as the rooms of the 1991 game paint it (ft_1_18.AC3)', () => {
  // the pages show notes, hand written, crossed out and rewritten
  it('ft_1_18.AC3 a page of the warden\'s music is paper with ruled staves and notes in ink: written on, not blackened', () => {
    for (let seed = 0; seed < 12; seed++) {
      const s = shares(0.5, 0.35, seed);
      expect(s.ink, `page ${seed}`).toBeGreaterThan(0.03);
      expect(s.ink + s.rule, `page ${seed}`).toBeLessThan(0.5);
      expect(s.bare, `page ${seed}`).toBeGreaterThan(0.5);
    }
  });

  it('ft_1_18.AC3 a page has five ruled lines to a stave, and two staves on a sheet of the stacks', () => {
    // down the page at its left margin, where no note is written: the rows of ink are the ruled lines
    let lines = 0, was = false;
    for (let v = -0.175; v < 0.175; v += 0.001) {
      const rule = penAt(0.5, 0.35, 3, -0.5 / 2 + 0.04, v) === 'rule';
      if (rule && !was) lines++;
      was = rule;
    }
    expect(lines).toBe(10);
  });

  it('ft_1_18.AC3 every page carries a bar that was struck out and written again in red ink, and no two pages are alike', () => {
    const pages = Array.from({ length: 12 }, (_, seed) => shares(0.5, 0.35, seed));
    for (const [seed, p] of pages.entries()) expect(p.red, `page ${seed}`).toBeGreaterThan(0.001);
    expect(new Set(pages.map((p) => `${p.ink.toFixed(4)} ${p.red.toFixed(4)}`)).size).toBe(pages.length);
  });

  it('ft_1_18.AC3 a page keeps the light of its own it is given, and has none unless told', () => {
    expect(dab(manuscript(0.4, 0.3, 1, 0.4), 3, 0, 0).emit).toBe(0.4);
    expect(dab(manuscript(0.4, 0.3, 1), 3, 0, 0).emit).toBe(0);
  });

  // slabs with ruled edges had made the books and paper look like blocks of stone
  it('ft_1_18.AC3 bare paper is laid as a brush lays it, in three warm tones, and where a sheet hangs down it is darker and unwritten', () => {
    const page = manuscript(0.5, 0.35, 4);
    const bare = new Set<string>(), hung = new Set<string>();
    for (let v = -0.17; v < 0.17; v += 0.004) for (let u = -0.24; u < 0.24; u += 0.004) {
      if (penAt(0.5, 0.35, 4, u, v) === null) bare.add(key(dab(page, 3, u, v)));
      hung.add(key(dab(page, 3, u, v, 0.5)));
    }
    expect(bare.size).toBe(3);
    for (const c of [...bare].map((k) => k.split(' ').map(Number))) {
      // golden: more red than green, more green than blue
      expect(c[0]).toBeGreaterThan(c[1]!);
      expect(c[1]).toBeGreaterThan(c[2]!);
    }
    // hanging: no pen mark (the same three washes, each gone darker), every tone darker than it lies flat
    expect(hung.size).toBe(3);
    const flat = Math.min(...[...bare].map((k) => luma(Object.fromEntries(k.split(' ').map((v, i) => ['rgb'[i], Number(v)])) as { r: number; g: number; b: number })));
    for (const k of hung) expect(luma(Object.fromEntries(k.split(' ').map((v, i) => ['rgb'[i], Number(v)])) as { r: number; g: number; b: number })).toBeLessThan(flat);
  });

  it('ft_1_18.AC3 a sheet is thin, its edge is worn and never a ruler\'s, and one sheet in three has a corner torn off', () => {
    expect(SHEET).toBeLessThanOrEqual(0.01);
    let torn = 0;
    const wavers: number[] = [];
    for (let seed = 0; seed < 30; seed++) {
      const edge = worn(0.5, 0.35, seed);
      // (along the middle of a side, clear of a torn corner)
      const along = Array.from({ length: 40 }, (_, i) => edge(-0.1 + i * 0.005, -0.17));
      for (const e of along) expect(e).toBeGreaterThanOrEqual(0);
      // it wavers by millimetres along a side
      wavers.push(Math.max(...along) - Math.min(...along));
      expect(Math.max(...along)).toBeLessThan(0.02);
      if ([[-1, -1], [1, -1], [-1, 1], [1, 1]].some(([sx, sz]) => edge(sx! * 0.245, sz! * 0.17) >= 1)) torn++;
    }
    // no side is straight, and most waver by several millimetres
    expect(Math.min(...wavers)).toBeGreaterThan(0.0005);
    expect(wavers.reduce((a, b) => a + b, 0) / wavers.length).toBeGreaterThan(0.003);
    expect(torn).toBeGreaterThan(4);
    expect(torn).toBeLessThan(18);
  });

  it('ft_1_18.AC3 a sheet lies level on its pile, droops where it hangs over the edge, curls up at a corner and follows a slumped pile down', () => {
    const level: Hang = { side: 'none', out: 0, curl: 0, corner: [1, 1] };
    const w = 0.5, d = 0.36;
    // nowhere quite flat, but level within millimetres
    for (const [x, z] of [[0, 0], [0.2, 0.1], [-0.24, -0.17]] as const) expect(Math.abs(sheetLift(w, d, level)(x, z))).toBeLessThan(0.002);
    const hangs = sheetLift(w, d, { ...level, side: 'near', out: 0.1 });
    expect(Math.abs(hangs(0, 0.07))).toBeLessThan(0.002);
    expect(hangs(0, 0.13)).toBeLessThan(-0.008);
    // ever faster: the second half of what hangs falls more than the first
    expect(hangs(0, 0.13) - hangs(0, 0.18)).toBeGreaterThan(hangs(0, 0.08) - hangs(0, 0.13));
    const curls = sheetLift(w, d, { ...level, curl: 0.04, corner: [1, -1] });
    expect(curls(0.25, -0.18)).toBeGreaterThan(0.03);
    expect(Math.abs(curls(-0.25, 0.18))).toBeLessThan(0.002);
    const slumped = sheetLift(w, d, { ...level, slope: { from: 0, run: 0.2, fall: 0.15 } });
    expect(Math.abs(slumped(-0.1, 0))).toBeLessThan(0.002);
    expect(slumped(0.1, 0)).toBeLessThan(-0.03);
    expect(slumped(0.24, 0)).toBeCloseTo(-0.15, 2);
  });

  it('ft_1_18.AC3 a sheaf sags toward its edges as soft paper does, and its side is leaf on leaf in several tones, its top a written page', () => {
    const sag = sagging(0.5, 0.36, 0.012, 3);
    expect(Math.abs(sag(0, 0))).toBeLessThan(0.003);
    for (const [x, z] of [[0.25, 0], [-0.25, 0], [0, 0.18], [0, -0.18]] as const) expect(sag(x, z)).toBeLessThan(-0.008);
    const h = 0.04, pile = sheaf(0.4, 0.3, h, 2);
    const tones = new Set<string>();
    for (let v = h / 2 - 0.0005; v > -h / 2; v -= 0.001) for (const u of [-0.1, 0, 0.1]) tones.add(key(dab(pile, 5, u, v)));
    expect(tones.size).toBeGreaterThanOrEqual(3);
    expect(dab(pile, 3, 0, 0)).toEqual(dab(manuscript(0.4, 0.3, 2), 3, 0, 0));
    expect(dab(looseSheet(0.4, 0.3, 2), 3, 0.05, 0.02)).toEqual(dab(manuscript(0.4, 0.3, 2), 3, 0.05, 0.02));
  });
});

describe('books as the library of the 1991 game paints them (ft_1_18.AC3)', () => {
  // books are more than plain blocks, as the 1991 game draws them
  it('ft_1_18.AC3 a book\'s cloth is a warm dull colour, never a pure one, and no two of the room\'s cloths are alike', () => {
    for (const c of COVERS) {
      expect(c[0]).toBeGreaterThan(c[2]);
      expect((Math.max(...c) - Math.min(...c)) / Math.max(...c)).toBeLessThan(0.8);
      expect(Math.max(...c)).toBeLessThan(0.75);
    }
    expect(new Set(COVERS.map((c) => key({ r: c[0], g: c[1], b: c[2] }))).size).toBe(COVERS.length);
  });

  it('ft_1_18.AC3 a book has a pale block of pages between two boards of cloth with a frame pressed in, and raised bands across its rounded back', () => {
    const cover = COVERS[0]!, w = 0.25, d = 0.18;
    const board = bookBoard(w, d, cover, 5);
    // the board's top: the frame is a lighter line a little in from its edge
    const across = Array.from({ length: 60 }, (_, i) => dab(board, 3, -w / 2 + (i + 0.5) * w / 120, d * 0.3).r);
    expect(Math.max(...across) / Math.min(...across)).toBeGreaterThan(1.2);
    // its edges are darker than its top, its under side darkest
    expect(dab(board, 5, 0, 0).r).toBeLessThan(cover[0]);
    expect(dab(board, 2, 0, 0).r).toBeLessThan(dab(board, 5, 0, 0).r);
    // the pages are paler than any cloth, leaf by leaf
    const pages = bookPages(5);
    const leaves = Array.from({ length: 40 }, (_, i) => dab(pages, 4, 0.01, -0.02 + i * 0.001));
    for (const leaf of leaves) for (const c of COVERS) expect(luma(leaf)).toBeGreaterThan(luma({ r: c[0], g: c[1], b: c[2] }));
    expect(new Set(leaves.map(key)).size).toBeGreaterThan(1);
    // the back: three bands lighter than the cloth between them
    const back = bookBack(w, cover);
    const along = Array.from({ length: 200 }, (_, i) => dab(back, 0, 0, (i + 0.5) * w / 200).r);
    const tones = [...new Set(along)].sort((a, b) => a - b);
    expect(tones.length).toBe(2);
    expect(tones[1]! / tones[0]!).toBeGreaterThan(1.3);
    let bands = 0;
    along.forEach((r, i) => { if (r === tones[1] && along[i - 1] !== tones[1]) bands++; });
    expect(bands).toBe(3);
  });
});
