// Covers ft_1_02c.AC7.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { DRAWER_SIZE, cabinetLayout, libraryDrawers, openDrawerLayout } from './libraryDrawers';

const piece = (title: string) => ({ id: title.toLowerCase().replace(/\W+/g, '-'), title });
const labels = (titles: string[]) => libraryDrawers(titles.map(piece)).map((d) => d.label);
const contents = (titles: string[]) => libraryDrawers(titles.map(piece)).map((d) => d.pieces.map((p) => p.title));

describe('libraryDrawers (ft_1_02c.AC7)', () => {
  it('puts the pieces in one drawer for each first letter, in the order of the Estonian alphabet', () => {
    expect(labels(['Twinkle', 'Ode to Joy', 'Sõrmekõnd', 'Õhtulaul', 'Mist Waltz', 'Šokolaad', 'Zebra'])).toEqual(['M', 'O', 'S', 'Š', 'Z', 'T', 'Õ']);
  });

  it('keeps titles in a drawer in alphabetical order, and never puts two first letters in one drawer', () => {
    expect(contents(['Bee', 'Apple', 'Ant', 'Brook'])).toEqual([['Ant', 'Apple'], ['Bee', 'Brook']]);
  });

  it('gives a title that does not start with a letter a drawer of its own, after the letters', () => {
    expect(labels(['3 Blind Mice', 'Apple'])).toEqual(['A', '#']);
  });

  it('holds five pieces in a drawer', () => {
    expect(DRAWER_SIZE).toBe(5);
    expect(labels(['Ma', 'Mb', 'Mc', 'Md', 'Me'])).toEqual(['M']);
  });

  it('splits a full letter by the second letter, like a library, and labels each drawer with its range', () => {
    const titles = ['Mary', 'March', 'Melody', 'Mist', 'Minuet', 'Moon', 'Morning'];
    expect(contents(titles)).toEqual([['March', 'Mary', 'Melody', 'Minuet', 'Mist'], ['Moon', 'Morning']]);
    expect(labels(titles)).toEqual(['Ma-Mi', 'Mo']);
  });

  it('a drawer of one second letter is labelled with those two letters', () => {
    expect(labels(['Ma1', 'Ma2', 'Ma3', 'Ma4', 'Mb1', 'Mb2', 'Mb3'])).toEqual(['Ma', 'Mb']);
  });

  it('goes to a third letter when one second letter alone holds more than a drawer', () => {
    expect(labels(['Maa', 'Mab', 'Mac', 'Mad', 'Mae', 'Maf'])).toEqual(['Maa-Mae', 'Maf']);
  });

  it('cuts titles that are the same as far as they go into drawers of five', () => {
    const same = Array.from({ length: 7 }, () => 'Echo');
    expect(contents(same).map((d) => d.length)).toEqual([5, 2]);
  });

  it('is empty for no pieces', () => {
    expect(libraryDrawers([])).toEqual([]);
  });

  it('puts every piece in exactly one drawer of at most five, the drawers in order', () => {
    const title = fc.stringMatching(/^[A-Za-zÕÄÖÜõäöü0-9 ]{1,8}$/);
    fc.assert(fc.property(fc.array(title, { maxLength: 40 }), (titles) => {
      const drawers = libraryDrawers(titles.map((t, i) => ({ id: `p${i}`, title: t })));
      const ids = drawers.flatMap((d) => d.pieces.map((p) => p.id)).sort();
      expect(ids).toEqual(titles.map((_, i) => `p${i}`).sort());
      for (const drawer of drawers) {
        expect(drawer.pieces.length).toBeGreaterThan(0);
        expect(drawer.pieces.length).toBeLessThanOrEqual(DRAWER_SIZE);
        expect(drawer.label.length).toBeGreaterThan(0);
      }
    }));
  });
});

describe('cabinetLayout and openDrawerLayout (ft_1_02c.AC7)', () => {
  const inside = (outer: { x: number; y: number; w: number; h: number }, inner: { x: number; y: number; w: number; h: number }) =>
    inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;

  it('puts every drawer front inside the cabinet without two touching, for the screen sizes the game is played at', () => {
    for (const [w, h] of [[320, 157], [320, 180], [300, 140]] as const) {
      const { cabinet, fronts } = cabinetLayout(w, h, 40);
      expect(fronts).toHaveLength(24);
      for (const f of fronts) expect(inside(cabinet, f)).toBe(true);
      for (let i = 1; i < fronts.length; i++) {
        const a = fronts[i - 1]!, b = fronts[i]!;
        if (a.y === b.y) expect(b.x).toBeGreaterThan(a.x + a.w);
      }
      expect(fronts[0]!.h).toBeGreaterThanOrEqual(18);
    }
  });

  it('opens a drawer with room for its five cards, one under another', () => {
    const { drawer, cards } = openDrawerLayout(320, 157, 40);
    expect(cards).toHaveLength(DRAWER_SIZE);
    for (const card of cards) expect(inside(drawer, card)).toBe(true);
    for (let i = 1; i < cards.length; i++) expect(cards[i]!.y).toBeGreaterThan(cards[i - 1]!.y + cards[i - 1]!.h);
  });
});
