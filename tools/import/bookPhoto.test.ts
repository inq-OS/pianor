// Covers ft_Y_04.AC24.
import { describe, expect, it } from 'vitest';
import type { PhotoLayout } from '../../src/core/editor/photoOverlay';
import { photoPatches } from '../../src/core/editor/photoOverlay';
import { matchBars, partStrip } from './bookPhoto';
import { pageLayout } from './page';
import { syntheticPage } from './syntheticPage';

const marks = (pageStarts: number[], systemStarts: number[]) => ({ pageStarts, systemStarts, sectionEnds: [], rehearsals: [] });

/** synthetic: a page layout of systems with the given bar counts, 100 pixels a bar. */
function pageOf(systems: number[]): PhotoLayout {
  return { width: 1000, height: 200 * systems.length, systems: systems.map((n, s) => ({ staves: [{ top: s * 200 + 40, bottom: s * 200 + 80 }, { top: s * 200 + 120, bottom: s * 200 + 160 }], bars: Array.from({ length: n }, (_, b) => ({ x1: b * 100, x2: b * 100 + 100 })) })) };
}

describe('the pages behind each part of a book (ft_Y_04.AC24)', () => {
  it('matches bars page by page and system by system, so a bar found twice puts off only its own system', () => {
    // the reading: 8 bars on page 1 (systems of 4 and 4), 6 on page 2 (3 and 3); the finder saw a fifth bar in page 1's first system
    const pages = [pageOf([5, 4]), pageOf([3, 3])];
    const { places, uneven } = matchBars([{ bars: 14, marks: marks([0, 8], [0, 4, 8, 11]) }], pages);
    const at = places[0]!.map((p) => (p ? `${p.page}.${p.system}.${p.x1}` : '-'));
    expect(at).toEqual(['0.0.0', '0.0.100', '0.0.200', '0.0.300', '0.1.0', '0.1.100', '0.1.200', '0.1.300', '1.0.0', '1.0.100', '1.0.200', '1.1.0', '1.1.100', '1.1.200']);
    expect(uneven).toEqual([0]);
  });

  it('with no page marks the bars are matched in order over every page, movements one after another', () => {
    const pages = [pageOf([3]), pageOf([3])];
    const { places, uneven } = matchBars([{ bars: 2, marks: marks([0], [0]) }, { bars: 4, marks: marks([0], [0]) }], pages);
    // two movements both start at their bar 0, which marks as many page starts as pages: matched page by page
    expect(places.map((m) => m.map((p) => p?.page))).toEqual([[0, 0], [1, 1, 1, undefined]]);
    expect(uneven).toEqual([0, 1]);
    const one = matchBars([{ bars: 6, marks: marks([0], [0]) }], pages);
    expect(one.places[0]!.map((p) => p?.page)).toEqual([0, 0, 0, 1, 1, 1]);
    expect(one.uneven).toEqual([]);
  });

  it('a part strip stacks its systems from the pages and maps only its bars, which the overlay lays bar by bar', () => {
    const images = [syntheticPage({ systems: [4, 4] }), syntheticPage({ systems: [4, 4] })];
    const pages = images.map(pageLayout);
    const { places } = matchBars([{ bars: 16, marks: marks([0, 8], [0, 4, 8, 12]) }], pages);
    // bars 7 to 10: the last two of page 1's second system, the first two of page 2's first
    const strip = partStrip(images, pages, places[0]!.slice(6, 10))!;
    expect(strip.layout.systems.map((s) => s.bars.length)).toEqual([2, 2]);
    expect(strip.image.height).toBe(strip.layout.height);
    const first = strip.layout.systems[0]!;
    // the staff lines are where the strip has them: the top line's row is ink across the staff
    const row = Math.round(first.staves[0]!.top);
    const x = Math.round((first.bars[0]!.x1 + first.bars[0]!.x2) / 2);
    expect([row - 1, row, row + 1].some((y) => strip.image.data[y * strip.image.width + x]! < 128)).toBe(true);
    const staff = { trackId: 'rh', topLineY: 0, bottomLineY: 40 };
    const staffLayout = { bars: [0, 1, 2, 3].map((i) => ({ index: i, system: 0, x: i * 100, width: 100 })), systems: [{ page: 0, staves: [staff, { ...staff, trackId: 'lh', topLineY: 80, bottomLineY: 120 }] }] };
    expect(photoPatches(staffLayout as never, strip.layout, { page: 0, shift: 0 })).toHaveLength(8);
    expect(partStrip(images, pages, [undefined])).toBeUndefined();
  });
});
