// Covers ft_0_16.AC1, ft_0_16.AC2.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import handsTogether from '../../../tests/golden/hands-together.chart.json';
import littleSteps from '../../../tests/golden/little-steps.chart.json';
import { chartWith } from '../../../tests/helpers/charts';
import { chartSchema, type Chart } from '../chart';
import { layoutStaff, pageOfNotes, type NoteGlyph, type StaffLayout } from './staff';

/**
 * The staff area of the practice screen: the window minus the pixel-art bars above and below the staff (52 art pixels at
 * the whole-number zoom: 4x at 1366x768 and 1280x720, 3x at 1024x600).
 */
const PRACTICE_AREAS = [
  { width: 1366, height: 768 - 52 * 4 },
  { width: 1280, height: 720 - 52 * 4 },
  { width: 1024, height: 600 - 52 * 3 },
];
const LAPTOP = PRACTICE_AREAS[0]!;

const together = chartSchema.parse(handsTogether);
const steps = chartSchema.parse(littleSteps);

/** One quarter-note melody of `bars` bars in 4/4 on the right hand. */
function melody(bars: number): Chart {
  const scale = [60, 62, 64, 65, 67, 65, 64, 62];
  return chartWith(Array.from({ length: bars * 4 }, (_, i) => ({ tick: i * 480, dur: 480, midi: scale[i % scale.length]! })));
}

/** Everything a note brings, top and bottom, including hint rooms and ledger lines. */
function extent(layout: StaffLayout, n: NoteGlyph): { top: number; bottom: number } {
  const S = layout.staffSpace;
  return {
    top: Math.min(n.y - n.headRy, n.stem && n.stem.up ? n.stem.y2 : Infinity, n.fingerY - 0.55 * S),
    bottom: Math.max(n.y + n.headRy, n.stem && !n.stem.up ? n.stem.y2 : -Infinity, n.labelY + 0.55 * S),
  };
}

describe('a fixed number of bars on a line', () => {
  it('puts exactly that many bars on every line, and the rest on a shorter last line', () => {
    const l = layoutStaff(melody(7), { viewport: LAPTOP, barsPerLine: 2 });
    expect(l.systems.map((s) => s.barCount)).toEqual([2, 2, 2, 1]);
    expect(l.systems.map((s) => s.firstBar)).toEqual([0, 2, 4, 6]);
    expect(l.bars.map((b) => b.system)).toEqual([0, 0, 1, 1, 2, 2, 3]);
  });

  it('gives every bar the same width, on the short last line too', () => {
    const l = layoutStaff(melody(5), { viewport: LAPTOP, barsPerLine: 4 });
    const widths = new Set(l.bars.map((b) => Math.round(b.width * 1000)));
    expect(widths.size).toBe(1);
    expect(l.systems[1]!.right).toBeLessThan(l.systems[0]!.right);
  });

  it('never puts more bars on a line than the piece has', () => {
    const l = layoutStaff(melody(2), { viewport: LAPTOP, barsPerLine: 4 });
    expect(l.systems.map((s) => s.barCount)).toEqual([2]);
  });

  it('says it does not fit when that many bars cannot get wide enough even at the smallest size', () => {
    const l = layoutStaff(melody(16), { viewport: { width: 1024, height: 444 }, barsPerLine: 16 });
    expect(l.fits).toBe(false);
  });
});

describe('pages of lines', () => {
  it('one line at a time: every line is its own page and sits in the same place on the screen', () => {
    const l = layoutStaff(melody(7), { viewport: LAPTOP, barsPerLine: 2, linesPerPage: 1 });
    expect(l.linesPerPage).toBe(1);
    expect(l.pageCount).toBe(4);
    expect(l.systems.map((s) => s.page)).toEqual([0, 1, 2, 3]);
    expect(new Set(l.systems.map((s) => s.topLineY)).size).toBe(1);
    expect(l.fits).toBe(true);
  });

  it('two lines at a time: lines 1 and 2 on the first page, 3 and 4 on the second, in the same two places', () => {
    const l = layoutStaff(melody(7), { viewport: LAPTOP, barsPerLine: 2, linesPerPage: 2 });
    expect(l.pageCount).toBe(2);
    expect(l.systems.map((s) => s.page)).toEqual([0, 0, 1, 1]);
    expect(l.systems[2]!.topLineY).toBe(l.systems[0]!.topLineY);
    expect(l.systems[3]!.topLineY).toBe(l.systems[1]!.topLineY);
    expect(l.systems[1]!.topLineY).toBeGreaterThan(l.systems[0]!.bottomLineY);
  });

  it('sizes the staff for one page, not the whole piece, so the notes get bigger', () => {
    const whole = layoutStaff(melody(8), { viewport: LAPTOP, barsPerLine: 2 });
    const paged = layoutStaff(melody(8), { viewport: LAPTOP, barsPerLine: 2, linesPerPage: 1 });
    expect(paged.staffSpace).toBeGreaterThan(whole.staffSpace);
  });

  it('is centred in the viewport like a whole piece, also when the last page holds fewer lines', () => {
    const l = layoutStaff(melody(6), { viewport: LAPTOP, barsPerLine: 2, linesPerPage: 2 });
    expect(l.pageCount).toBe(2);
    expect(l.systems[2]!.topLineY).toBe(l.systems[0]!.topLineY);
  });

  it('without these options lays out as before: one page holding every line', () => {
    const before = layoutStaff(melody(8), { viewport: LAPTOP });
    expect(before.pageCount).toBe(1);
    expect(before.linesPerPage).toBe(before.systems.length);
    expect(before.systems.every((s) => s.page === 0)).toBe(true);
  });

  it('keeps every note of every page inside the viewport, lines apart from each other (property)', () => {
    const pitch = fc.integer({ min: 57, max: 81 }).filter((m) => [0, 2, 4, 5, 7, 9, 11].includes(m % 12));
    fc.assert(
      fc.property(
        fc.array(pitch, { minLength: 4, maxLength: 40 }), fc.constantFrom(2, 4), fc.constantFrom(1, 2), fc.constantFrom(...PRACTICE_AREAS),
        (midis, barsPerLine, linesPerPage, vp) => {
          const chart = chartWith(midis.map((midi, i) => ({ tick: i * 480, dur: 480, midi })));
          const l = layoutStaff(chart, { viewport: vp, barsPerLine, linesPerPage });
          expect(l.fits).toBe(true);
          for (const n of l.notes) {
            const e = extent(l, n);
            expect(e.top).toBeGreaterThanOrEqual(0);
            expect(e.bottom).toBeLessThanOrEqual(vp.height);
            expect(n.x + n.headRx).toBeLessThanOrEqual(vp.width);
          }
          for (const s of l.systems) expect(s.page).toBe(Math.floor(s.index / linesPerPage));
        },
      ),
    );
  });
});

describe('the page a note is on', () => {
  const l = layoutStaff(melody(4), { viewport: LAPTOP, barsPerLine: 2, linesPerPage: 1 });

  it('is the page of the line that holds it', () => {
    expect(pageOfNotes(l, 0)).toBe(0);
    expect(pageOfNotes(l, 7)).toBe(0);
    expect(pageOfNotes(l, 8)).toBe(1);
    expect(pageOfNotes(l, [15])).toBe(1);
  });

  it('is null when no note is awaited, or the note is not drawn', () => {
    expect(pageOfNotes(l, null)).toBeNull();
    expect(pageOfNotes(l, [])).toBeNull();
    expect(pageOfNotes(l, 999)).toBeNull();
  });
});

describe('sizes on the screens we support (one-line staff acceptance)', () => {
  it('one line of a two-hand piece: 20 px or more between staff lines at 1366x768', () => {
    for (const barsPerLine of [2, 4]) {
      const l = layoutStaff(together, { viewport: LAPTOP, barsPerLine, linesPerPage: 1 });
      expect(l.fits).toBe(true);
      expect(l.staffSpace, `${barsPerLine} bars`).toBeGreaterThanOrEqual(20);
    }
  });

  it('one line of 2 bars of a one-hand piece: 28 px or more at 1366x768', () => {
    const l = layoutStaff(steps, { viewport: LAPTOP, barsPerLine: 2, linesPerPage: 1 });
    expect(l.staffSpace).toBeGreaterThanOrEqual(28);
  });

  it('fits without overlap at 1366x768, 1280x720 and 1024x600, one hand and two hands, one or two lines', () => {
    for (const vp of PRACTICE_AREAS) {
      for (const chart of [steps, together]) {
        for (const linesPerPage of [1, 2]) {
          for (const barsPerLine of [2, 4]) {
            const l = layoutStaff(chart, { viewport: vp, barsPerLine, linesPerPage });
            const where = `${chart.id} ${vp.width}x${vp.height} ${linesPerPage}x${barsPerLine}`;
            expect(l.fits, where).toBe(true);
            for (const n of l.notes) {
              const e = extent(l, n);
              expect(e.top, where).toBeGreaterThanOrEqual(0);
              expect(e.bottom, where).toBeLessThanOrEqual(vp.height);
            }
            // within a page, a line ends above the next one begins
            for (const s of l.systems) {
              const below = l.systems.find((o) => o.page === s.page && o.index === s.index + 1);
              if (below) expect(below.staves[0]!.arrow.tipY, where).toBeGreaterThan(s.cursorTipY);
            }
          }
        }
      }
    }
  });
});
