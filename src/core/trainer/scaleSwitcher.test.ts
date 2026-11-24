// Covers ft_1_29.AC3.
import { describe, expect, it } from 'vitest';
import { chartSchema } from '../chart/schema.ts';
import { noteName } from '../chart/pitch.ts';
import type { NoteEvent } from '../judge/types.ts';
import { ShapeRound } from './shapeTrainer.ts';
import { SWITCHER_BARS, SWITCHER_CIRCLE, switcherChart } from './scaleSwitcher.ts';

let clock = 0;
const on = (midi: number): NoteEvent => ({ kind: 'on', midi, velocity: 90, timeMs: (clock += 200), source: 'test' });

describe('switcherChart (ft_1_29.AC3)', () => {
  it('first goes round the circle of fifths a bar at a time, C, G, D and on, then picks keys at random', () => {
    const { keys } = switcherChart('seed', 'RH');
    expect(keys).toHaveLength(SWITCHER_BARS);
    expect(keys.slice(0, SWITCHER_CIRCLE)).toEqual([0, 1, 2, 3, 4, 5].slice(0, SWITCHER_CIRCLE));
    for (let i = 1; i < keys.length; i++) expect(keys[i]).not.toBe(keys[i - 1]);
    for (const k of keys) expect(Math.abs(k)).toBeLessThanOrEqual(6);
    expect(switcherChart('seed', 'RH').keys).toEqual(keys);
    expect(switcherChart('other', 'RH').keys.slice(SWITCHER_CIRCLE)).not.toEqual(keys.slice(SWITCHER_CIRCLE));
  });

  it("each bar is the scale of its key in eighths, up in one bar and down in the next, spelled with that key's signs", () => {
    const { chart } = switcherChart('seed', 'RH');
    chartSchema.parse(chart);
    const bar = (b: number) => chart.notes.filter((n) => n.bar === b).map((n) => noteName(n.spelling));
    expect(bar(0)).toEqual(['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5']);
    expect(bar(1)).toEqual(['G5', 'F#5', 'E5', 'D5', 'C5', 'B4', 'A4', 'G4']);
    expect(bar(2)).toEqual(['D4', 'E4', 'F#4', 'G4', 'A4', 'B4', 'C#5', 'D5']);
    expect(chart.notes.every((n) => n.dur === chart.ppq / 2)).toBe(true);
    expect(chart.bars).toHaveLength(SWITCHER_BARS);
  });

  it('the left hand plays it on the bass staff', () => {
    const { chart } = switcherChart('seed', 'LH');
    expect(chart.tracks[0]).toMatchObject({ hand: 'LH', clef: 'bass' });
    expect(noteName(chart.notes[0]!.spelling)).toBe('C3');
  });

  it("after each bar the next awaited note belongs to the next bar's scale", () => {
    const { chart } = switcherChart('seed', 'RH');
    const round = new ShapeRound(chart);
    for (const note of chart.notes.filter((n) => n.bar === 0)) round.press(on(note.midi));
    const awaited = round.play().awaiting.map((i) => chart.notes[i]!);
    expect(awaited).toHaveLength(1);
    expect(awaited[0]!.bar).toBe(1);
    // G major: the F of the old bar is now wrong, F# is right
    expect(round.press(on(77)).verdict).toBe('wrong');
  });
});
