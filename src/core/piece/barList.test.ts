// Covers core_08.AC8.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { chartWith } from '../../../tests/helpers/charts';
import { PPQ } from '../chart/time';
import { formatBarList, parseBarList } from './barList';

const fourBars = chartWith([0, 1, 2, 3].map((b) => ({ tick: b * 4 * PPQ, dur: 4 * PPQ, midi: 60 })));
const withPickup = { ...fourBars, bars: [{ index: 0, startTick: 0, endTick: PPQ }, ...fourBars.bars.slice(1).map((b, i) => ({ ...b, index: i + 1 }))] };

describe('parseBarList', () => {
  it('reads printed bar numbers into 0-based ranges, in the order written', () => {
    expect(parseBarList('1-2, 4', fourBars)).toEqual({ ranges: [{ first: 0, last: 1 }, { first: 3, last: 3 }] });
    expect(parseBarList('3 1-2 3', fourBars)).toEqual({ ranges: [{ first: 2, last: 2 }, { first: 0, last: 1 }, { first: 2, last: 2 }] });
  });

  it('numbers a pick-up as bar 0', () => {
    expect(parseBarList('0-1', withPickup)).toEqual({ ranges: [{ first: 0, last: 1 }] });
    expect(parseBarList('0', fourBars)).toEqual({ error: '0: this piece has bars 1 to 4' });
  });

  it('says what is wrong with a list it cannot read', () => {
    expect(parseBarList('', fourBars)).toEqual({ error: 'write bars like 1-4, 9-12' });
    expect(parseBarList('2-x', fourBars)).toEqual({ error: '"2-x" is not a bar or a range like 3-6' });
    expect(parseBarList('3-1', fourBars)).toEqual({ error: '3-1: the second bar comes before the first' });
    expect(parseBarList('2-5', fourBars)).toEqual({ error: '2-5: this piece has bars 1 to 4' });
  });

  it('reads back what formatBarList writes (property)', () => {
    const range = fc.tuple(fc.integer({ min: 0, max: 3 }), fc.integer({ min: 0, max: 3 })).map(([a, b]) => ({ first: Math.min(a, b), last: Math.max(a, b) }));
    fc.assert(
      fc.property(fc.array(range, { minLength: 1, maxLength: 5 }), fc.boolean(), (ranges, pickup) => {
        const chart = pickup ? withPickup : fourBars;
        expect(parseBarList(formatBarList(ranges, chart), chart)).toEqual({ ranges });
      }),
    );
  });
});
