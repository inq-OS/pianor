// Covers ft_1_12.AC7.
import { describe, expect, it } from 'vitest';
import { chartWith } from '../../../tests/helpers/charts';
import type { Chart } from '../chart';
import { PLAYED_OFFSET, playedMark } from './playedMark';
import { layoutStaff, type StaffLayout } from './staff';

const lay = (chart: Chart): StaffLayout => layoutStaff(chart, { viewport: { width: 1366, height: 600 }, barsPerLine: 2 });

// right hand C5 B4 A4 G4, left hand C3 at the start
const chart = chartWith([
  { tick: 0, dur: 480, midi: 72 }, { tick: 480, dur: 480, midi: 71 }, { tick: 960, dur: 480, midi: 69 }, { tick: 1440, dur: 480, midi: 67 },
  { tick: 0, dur: 1920, midi: 48, track: 'lh' },
]);
const layout = lay(chart);
const S = layout.staffSpace;
const glyph = (index: number) => layout.notes.find((n) => n.index === index)!;

describe('the key that was played, on the staff (ft_1_12.AC7)', () => {
  it('ft_1_12.AC7: sits just right of the awaited note\'s column on its staff, half a space per step away from it', () => {
    const awaited = glyph(1); // B4
    const mark = playedMark(layout, chart, [1], 69)!; // A4: one step lower
    expect(mark).toMatchObject({ system: awaited.system, x: awaited.column + PLAYED_OFFSET * awaited.headRx, rx: awaited.headRx, ry: awaited.headRy });
    expect(mark.y).toBeCloseTo(awaited.y + S / 2);
    expect(mark.spelling).toEqual({ step: 'A', alter: 0, octave: 4 });
    expect(mark.accidental).toBeNull();
  });

  it('ft_1_12.AC7: is drawn on the staff of the nearest awaited note, so a low key in a chord of both hands goes to the bass staff', () => {
    const mark = playedMark(layout, chart, [0, 4], 50)!; // D3 while C5 and C3 are awaited
    expect(mark.y).toBeCloseTo(glyph(4).y - S / 2);
  });

  it('ft_1_12.AC7: gets ledger lines off the staff and a sharp for a black key (a flat in a flat key)', () => {
    const high = playedMark(layout, chart, [0], 84)!; // C6, two ledger lines above the treble staff
    expect(high.ledgerLines).toHaveLength(2);
    for (const line of high.ledgerLines) expect(line.x2 - line.x1).toBeGreaterThan(2 * high.rx);
    const black = playedMark(layout, chart, [1], 70)!;
    expect(black.spelling).toEqual({ step: 'A', alter: 1, octave: 4 });
    expect(black.accidental).toBe(1);
    const flat = playedMark(layout, { ...chart, keyMap: [{ tick: 0, fifths: -1, mode: 'major' }] }, [1], 70)!;
    expect(flat.spelling).toEqual({ step: 'B', alter: -1, octave: 4 });
    expect(flat.accidental).toBeNull(); // the key signature already flattens B
  });

  it('ft_1_12.AC7: is null when nothing is awaited or the note is not on the shown layout', () => {
    expect(playedMark(layout, chart, [], 60)).toBeNull();
    expect(playedMark(layout, chart, [99], 60)).toBeNull();
  });
});
