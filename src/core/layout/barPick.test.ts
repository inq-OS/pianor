import { describe, expect, it } from 'vitest';
import littleSteps from '../../../tests/fixtures/charts/little-steps.v2.json';
import { chartSchema } from '../chart';
import { barAtPoint } from './barPick';
import { layoutStaff } from './staff';

const chart = chartSchema.parse(littleSteps);
const wide = layoutStaff(chart, { viewport: { width: 1366, height: 600 } });
const paged = layoutStaff(chart, { viewport: { width: 700, height: 300 }, barsPerLine: 2, linesPerPage: 1 });

describe('barAtPoint', () => {
  it('finds each bar by a point in the middle of it, on the staff', () => {
    for (const bar of wide.bars) {
      const system = wide.systems[bar.system]!;
      expect(barAtPoint(wide, bar.x + bar.width / 2, (system.topLineY + system.bottomLineY) / 2)).toBe(bar.index);
    }
  });

  it('is generous above and below the lines, and null beyond that and left of the first bar', () => {
    const bar = wide.bars[1]!;
    const system = wide.systems[bar.system]!;
    const x = bar.x + bar.width / 2;
    expect(barAtPoint(wide, x, system.topLineY - 2 * wide.staffSpace)).toBe(1);
    expect(barAtPoint(wide, x, system.bottomLineY + 2 * wide.staffSpace)).toBe(1);
    expect(barAtPoint(wide, x, system.topLineY - 5 * wide.staffSpace)).toBeNull();
    expect(barAtPoint(wide, wide.bars[0]!.x - 1, (system.topLineY + system.bottomLineY) / 2)).toBeNull();
  });

  it('gives a bar line to the bar that starts there, and the reach edge still counts', () => {
    const bar = wide.bars[1]!;
    const system = wide.systems[bar.system]!;
    const mid = (system.topLineY + system.bottomLineY) / 2;
    expect(barAtPoint(wide, bar.x, mid)).toBe(1);
    expect(barAtPoint(wide, bar.x + bar.width / 2, system.topLineY - 3 * wide.staffSpace)).toBe(1);
    expect(barAtPoint(wide, bar.x + bar.width / 2, system.bottomLineY + 3 * wide.staffSpace)).toBe(1);
  });

  it('only finds the bars of the page asked for: the lines of every page use the same places on the screen', () => {
    const second = paged.bars[2]!; // on the second page
    const system = paged.systems[second.system]!;
    const point = [second.x + second.width / 2, (system.topLineY + system.bottomLineY) / 2] as const;
    expect(barAtPoint(paged, ...point, 1)).toBe(2);
    expect(barAtPoint(paged, ...point, 0)).toBe(0); // the same place on page 1 is bar 1
    expect(barAtPoint(paged, ...point, 2)).toBeNull(); // there is no page 3
  });
});
