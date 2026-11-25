// Covers ft_Y_04.AC20, ft_Y_04.AC21.
import { describe, expect, it } from 'vitest';
import { joinParts, MAX_PART_BARS, PART_BARS, partsOf, proposeStarts, splitPart, type Layout } from './songParts';

/** synthetic: a score of `bars` bars, systems of `perSystem` bars, pages of `perPage` systems, with the given marks. */
function layout(bars: number, opts: Partial<Layout> & { perSystem?: number; perPage?: number } = {}): Layout {
  const perSystem = opts.perSystem ?? 4;
  const perPage = opts.perPage ?? 5;
  const systemStarts = Array.from({ length: Math.ceil(bars / perSystem) }, (_, k) => k * perSystem);
  return {
    bars,
    mustStarts: opts.mustStarts ?? [],
    ...(opts.inRepeat ? { inRepeat: opts.inRepeat } : {}),
    ...(opts.tiedInto ? { tiedInto: opts.tiedInto } : {}),
    marks: {
      pageStarts: opts.marks?.pageStarts ?? systemStarts.filter((_, k) => k % perPage === 0),
      systemStarts: opts.marks?.systemStarts ?? systemStarts,
      sectionEnds: opts.marks?.sectionEnds ?? [],
      rehearsals: opts.marks?.rehearsals ?? [],
    },
  };
}

const lengths = (starts: readonly number[], bars: number) => starts.map((s, i) => (starts[i + 1] ?? bars) - s);

describe('a long score cut into song parts (ft_Y_04.AC20)', () => {
  it('a score that fits one part stays one part', () => {
    expect(proposeStarts(layout(12))).toEqual([0]);
    expect(proposeStarts(layout(PART_BARS))).toEqual([0]);
  });

  it('cuts after double bar lines, repeat signs and at rehearsal marks first', () => {
    const l = layout(40, { marks: { pageStarts: [0], systemStarts: [0, 4, 8, 12, 16, 20, 24, 28, 32, 36], sectionEnds: [7, 23], rehearsals: [{ bar: 16, text: 'Trio' }] } });
    expect(proposeStarts(l)).toEqual([0, 8, 16, 24]);
  });

  it('a long stretch is cut in equal parts of at most 16 bars, each cut on a system start when one is near', () => {
    const l = layout(48, { perSystem: 5 });
    const starts = proposeStarts(l);
    expect(starts.length).toBe(3);
    expect(lengths(starts, 48).every((n) => n <= PART_BARS + 4)).toBe(true);
    for (const s of starts.slice(1)) expect(l.marks.systemStarts).toContain(s);
  });

  it('a page start is a better cut than a system start, and a section end better than both', () => {
    const l = layout(30, { perSystem: 3, marks: { pageStarts: [0, 15], systemStarts: [0, 3, 6, 9, 12, 15, 18, 21, 24, 27], sectionEnds: [], rehearsals: [] } });
    expect(proposeStarts(l)).toEqual([0, 15]);
    const withSection = { ...l, marks: { ...l.marks, sectionEnds: [13] } };
    expect(proposeStarts(withSection)).toEqual([0, 14]);
  });

  it('a key or meter change always starts a part, even a short one; a short stretch otherwise joins its neighbour', () => {
    const l = layout(26, { mustStarts: [24], marks: { pageStarts: [0], systemStarts: [0, 8, 16, 24], sectionEnds: [1], rehearsals: [] } });
    // the section end after bar 2 would leave a 2-bar part: it joins the next one; the meter change at bar 25 stays
    expect(proposeStarts(l)).toEqual([0, 12, 24]);
  });

  it('never makes a part longer than the piece maker holds, whatever the marks', () => {
    for (const bars of [1, 17, 33, 64, 100, 257]) {
      const starts = proposeStarts(layout(bars, { perSystem: 7, perPage: 3 }));
      expect(starts[0]).toBe(0);
      expect(lengths(starts, bars).every((n) => n >= 1 && n <= MAX_PART_BARS)).toBe(true);
      expect([...starts].sort((a, b) => a - b)).toEqual(starts);
    }
  });

  it('never cuts inside a repeat when another bar is in reach, and avoids a bar a tie or slur reaches into', () => {
    // even cut of 24 bars at 12; systems every 4 bars would pick 12, but bars 10 to 13 are inside a repeat
    const l = layout(24, { inRepeat: [10, 11, 12, 13] });
    expect(proposeStarts(l)).toEqual([0, 14]);
    // a tie into a system start makes it as good as a plain bar; on plain bars the tie's bar loses to its neighbours
    expect(proposeStarts(layout(24, { perSystem: 12, tiedInto: [12] }))).toEqual([0, 12]);
    expect(proposeStarts(layout(24, { perSystem: 24, tiedInto: [12] }))).toEqual([0, 11]);
  });

  it('a part that starts at a rehearsal mark is named by it', () => {
    const l = layout(32, { marks: { pageStarts: [0], systemStarts: [0, 8, 16, 24], sectionEnds: [], rehearsals: [{ bar: 0, text: 'A' }, { bar: 16, text: 'Trio' }] } });
    expect(partsOf(l, proposeStarts(l))).toEqual([
      { firstBar: 0, lastBar: 15, name: 'A' },
      { firstBar: 16, lastBar: 31, name: 'Trio' },
    ]);
  });
});

describe('joining and splitting the proposed parts (ft_Y_04.AC21)', () => {
  const l = layout(48, { perSystem: 4, mustStarts: [40] });

  it('Join takes the next part into this one, unless a key or meter change starts it or the two are too long together', () => {
    expect(joinParts(l, [0, 8, 16, 40], 0)).toEqual([0, 16, 40]);
    expect(joinParts(l, [0, 8, 16, 40], 2)).toBeNull();
    expect(joinParts(l, [0, 16, 32, 40], 1)).toEqual([0, 16, 40]);
    expect(joinParts(layout(48), [0, 16, 40], 0)).toBeNull();
    expect(joinParts(l, [0, 40], 0)).toBeNull();
    expect(joinParts(l, [0, 8, 16, 40], 3)).toBeNull();
  });

  it('Split cuts a part at its best place near the middle, a system start when there is one; a one-bar part does not split', () => {
    expect(splitPart(l, [0, 16, 40], 0)).toEqual([0, 8, 16, 40]);
    expect(splitPart(l, [0, 16, 40], 1)).toEqual([0, 16, 28, 40]);
    expect(splitPart(layout(1), [0], 0)).toBeNull();
    expect(splitPart(layout(3, { perSystem: 4 }), [0], 0)).toEqual([0, 1]);
  });
});
