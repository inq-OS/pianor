// Covers ft_Y_04.AC23.
import { describe, expect, it } from 'vitest';
import { pageLayout } from './page';
import { syntheticPage } from './syntheticPage';

const bars = (layout: ReturnType<typeof pageLayout>) => layout.systems.map((s) => s.bars.length);

describe('the staves, systems and bars of a level page (ft_Y_04.AC23)', () => {
  it('finds each piano system with its two staves and its bars, past note heads, stems, beams, ledger lines and a title', () => {
    const layout = pageLayout(syntheticPage({ systems: [4, 5, 3, 6] }));
    expect(layout.systems.map((s) => s.staves.length)).toEqual([2, 2, 2, 2]);
    expect(bars(layout)).toEqual([4, 5, 3, 6]);
    const first = layout.systems[0]!;
    expect(first.staves[0]!.bottom - first.staves[0]!.top).toBeCloseTo(64, 0);
    for (const s of layout.systems) for (let k = 1; k < s.bars.length; k++) expect(s.bars[k]!.x1).toBeCloseTo(s.bars[k - 1]!.x2, 0);
  });

  it('a double bar line at a system end makes no bar of its own; a one-staff page has one staff a system', () => {
    expect(bars(pageLayout(syntheticPage({ systems: [4, 4], doubleAfter: 0 })))).toEqual([4, 4]);
    const one = pageLayout(syntheticPage({ systems: [3, 4, 5], staves: 1 }));
    expect(one.systems.map((s) => s.staves.length)).toEqual([1, 1, 1]);
    expect(bars(one)).toEqual([3, 4, 5]);
  });

  it('works at small and large staff spaces, and a page with no staff has no systems', () => {
    expect(bars(pageLayout(syntheticPage({ systems: [4, 4], space: 9, width: 900 })))).toEqual([4, 4]);
    expect(bars(pageLayout(syntheticPage({ systems: [5], space: 30, width: 3000 })))).toEqual([5]);
    expect(pageLayout(syntheticPage({ systems: [] })).systems).toEqual([]);
  });
});
