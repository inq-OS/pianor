// Covers ft_0_16.AC2.
import { describe, expect, it } from 'vitest';
import handsTogether from '../../../tests/golden/hands-together.chart.json';
import littleSteps from '../../../tests/golden/little-steps.chart.json';
import { chartWith } from '../../../tests/helpers/charts';
import { chartSchema, sliceChart } from '../chart';
import { layoutStaff } from './staff';
import { DEFAULT_STAFF_SETTINGS, READABLE_STAFF_SPACE, layoutForSettings, layoutSection, staffSettingsSchema, type StaffSettings } from './staffSettings';

/** The practice screen's staff area at 1366x768 (the window minus 52 art pixels of bars at 4x). */
const LAPTOP = { width: 1366, height: 768 - 52 * 4 };
const together = chartSchema.parse(handsTogether);
const steps = chartSchema.parse(littleSteps);

describe('staff settings', () => {
  it('default: two lines on the screen, bars per line chosen automatically', () => {
    expect(DEFAULT_STAFF_SETTINGS).toEqual({ lines: 2, barsPerLine: 'auto' });
  });

  it('auto gives a one-hand piece 2 bars on a line and a two-hand piece 4: the biggest notes, and more bars on a tie', () => {
    const one = layoutForSettings(steps, { viewport: LAPTOP }, { lines: 1, barsPerLine: 'auto' });
    expect(one.systems[0]!.barCount).toBe(2);
    expect(one.linesPerPage).toBe(1);
    const two = layoutForSettings(together, { viewport: LAPTOP }, { lines: 1, barsPerLine: 'auto' });
    expect(two.systems[0]!.barCount).toBe(4);
    for (const bars of [2, 4]) {
      const other = layoutStaff(together, { viewport: LAPTOP, barsPerLine: bars, linesPerPage: 1 });
      expect(two.staffSpace).toBeGreaterThanOrEqual(other.staffSpace);
    }
  });

  it('auto never draws smaller notes than either choice would', () => {
    const eighths = chartWith(Array.from({ length: 32 }, (_, i) => ({ tick: i * 240, dur: 240, midi: [60, 62, 64, 65][i % 4]! })));
    for (const piece of [steps, together, eighths]) {
      for (const lines of [1, 2] as const) {
        const auto = layoutForSettings(piece, { viewport: LAPTOP }, { lines, barsPerLine: 'auto' });
        for (const bars of [2, 4] as const) {
          expect(auto.staffSpace).toBeGreaterThanOrEqual(layoutForSettings(piece, { viewport: LAPTOP }, { lines, barsPerLine: bars }).staffSpace);
        }
      }
    }
  });

  it('core_09.AC44 auto gives a piece of sixteenths one bar on a line when two bars would draw it smaller than 20 px between lines', () => {
    const sixteenths = chartWith(Array.from({ length: 64 }, (_, i) => ({ tick: i * 120, dur: 120, midi: [60, 62, 64, 65][i % 4]! })));
    const two = layoutForSettings(sixteenths, { viewport: LAPTOP }, { lines: 1, barsPerLine: 2 });
    expect(two.staffSpace).toBeLessThan(READABLE_STAFF_SPACE);
    const auto = layoutForSettings(sixteenths, { viewport: LAPTOP }, { lines: 1, barsPerLine: 'auto' });
    expect(auto.systems[0]!.barCount).toBe(1);
    expect(auto.fits).toBe(true);
    expect(auto.staffSpace).toBeGreaterThanOrEqual(READABLE_STAFF_SPACE);
    // a piece of eighths keeps its two bars, whatever the size
    const eighths = chartWith(Array.from({ length: 32 }, (_, i) => ({ tick: i * 240, dur: 240, midi: [60, 62, 64, 65][i % 4]! })));
    expect(layoutForSettings(eighths, { viewport: { width: 1024, height: 600 - 52 * 3 } }, { lines: 1, barsPerLine: 'auto' }).systems[0]!.barCount).toBeGreaterThanOrEqual(2);
  });

  it('a chosen number of lines and bars is used as it is', () => {
    const l = layoutForSettings(steps, { viewport: LAPTOP }, { lines: 2, barsPerLine: 2 });
    expect(l.linesPerPage).toBe(2);
    expect(l.systems.map((s) => s.barCount)).toEqual([2, 2]);
    expect(layoutForSettings(together, { viewport: LAPTOP }, { lines: 1, barsPerLine: 2 }).systems[0]!.barCount).toBe(2);
  });

  it('"all" lines with auto bars is the whole piece fitted as before', () => {
    const all = layoutForSettings(together, { viewport: LAPTOP }, { lines: 'all', barsPerLine: 'auto' });
    expect(all).toEqual(layoutStaff(together, { viewport: LAPTOP }));
    expect(all.pageCount).toBe(1);
  });

  it('"all" lines with a chosen number of bars keeps every line on one page', () => {
    const all = layoutForSettings(together, { viewport: LAPTOP }, { lines: 'all', barsPerLine: 2 });
    expect(all.pageCount).toBe(1);
    expect(all.systems.length).toBe(Math.ceil(together.bars.length / 2));
    expect(all.systems.every((s) => s.barCount === 2)).toBe(true);
  });

  it('the save format accepts only the offered choices', () => {
    expect(staffSettingsSchema.parse({ lines: 2, barsPerLine: 4 })).toEqual({ lines: 2, barsPerLine: 4 });
    expect(staffSettingsSchema.parse({ lines: 'all', barsPerLine: 'auto' })).toEqual({ lines: 'all', barsPerLine: 'auto' });
    for (const bad of [{ lines: 3, barsPerLine: 2 }, { lines: 1, barsPerLine: 3 }, { lines: 1 }, {}]) expect(staffSettingsSchema.safeParse(bad).success).toBe(false);
  });
});

describe('a section keeps the size of the whole piece', () => {
  // sixteen bars of quarter notes, so the whole piece needs several lines and a section needs few
  const long = chartWith(Array.from({ length: 64 }, (_, i) => ({ tick: i * 480, dur: 480, midi: [60, 62, 64, 65, 67][i % 5]! })));
  const all: StaffSettings[] = [DEFAULT_STAFF_SETTINGS, { lines: 2, barsPerLine: 2 }, { lines: 1, barsPerLine: 4 }, { lines: 'all', barsPerLine: 'auto' }, { lines: 'all', barsPerLine: 2 }];

  it('draws a section with the staff space and bars per line of the whole piece, so the clef and notes do not change size', () => {
    for (const settings of all) {
      const whole = layoutForSettings(long, { viewport: LAPTOP }, settings);
      for (const [first, last] of [[0, 0], [2, 5], [10, 15]] as const) {
        const section = layoutSection(sliceChart(long, first, last), whole, { viewport: LAPTOP }, settings);
        expect(section.staffSpace).toBe(whole.staffSpace);
        expect(section.systems[0]!.barCount).toBe(Math.min(whole.systems[0]!.barCount, last - first + 1));
        // a section shorter than a line keeps the bar width: its line ends early, like the last line of a piece
        expect(section.bars).toHaveLength(last - first + 1);
        expect(section.bars[0]!.width).toBeCloseTo(whole.bars[0]!.width, 6);
        expect(section.fits).toBe(true);
      }
    }
  });

  it('is needed: laid out alone, a short section of a piece shown in full would grow', () => {
    const settings: StaffSettings = { lines: 'all', barsPerLine: 'auto' };
    const whole = layoutForSettings(long, { viewport: LAPTOP }, settings);
    expect(layoutForSettings(sliceChart(long, 2, 3), { viewport: LAPTOP }, settings).staffSpace).toBeGreaterThan(whole.staffSpace);
  });
});
