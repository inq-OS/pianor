// Covers ft_0_08.AC1 (the steps and wrong-note reasons the judge works from).
import { describe, expect, it } from 'vitest';
import littleSteps from '../../../tests/fixtures/charts/little-steps.v2.json';
import { chartSchema } from '../chart';
import { chartWith } from '../../../tests/helpers/charts';
import { buildSteps } from './steps';
import { classifyWrongNote } from './classify';

describe('buildSteps', () => {
  it('makes one step per note on the little-steps fixture, with bars', () => {
    const chart = chartSchema.parse(littleSteps);
    const steps = buildSteps(chart);
    expect(steps).toHaveLength(11);
    expect(steps.map((s) => s.bar)).toEqual([0, 0, 0, 0, 1, 1, 2, 2, 2, 2, 3]);
    expect(steps.every((s) => s.noteIndices.length === 1)).toBe(true);
  });

  it('groups notes on the same tick into one chord step, across play tracks', () => {
    const chart = chartWith([
      { tick: 0, dur: 960, midi: 60 }, { tick: 0, dur: 960, midi: 48, track: 'lh' }, { tick: 960, dur: 960, midi: 64 },
    ]);
    const steps = buildSteps(chart);
    expect(steps).toHaveLength(2);
    expect(steps[0]!.noteIndices).toHaveLength(2);
  });

  it('leaves accompaniment tracks out', () => {
    const chart = chartWith([{ tick: 0, dur: 480, midi: 60 }, { tick: 480, dur: 480, midi: 62, track: 'bk' }]);
    expect(buildSteps(chart)).toHaveLength(1);
  });

  it('does not ask for a new press on a tied continuation, and links it to the first note', () => {
    const chart = chartWith([
      { tick: 0, dur: 1920, midi: 60, tieNext: true }, { tick: 1920, dur: 1920, midi: 60, tieNext: true },
      { tick: 3840, dur: 480, midi: 60 }, { tick: 4320, dur: 480, midi: 62 },
    ]);
    const steps = buildSteps(chart);
    expect(steps).toHaveLength(2);
    expect(steps[0]!.tiedNoteIndices).toEqual([1, 2]);
    expect(steps[0]!.bar).toBe(0);
  });

  it('keeps steps in time order even if notes are listed out of order', () => {
    const chart = chartWith([{ tick: 480, dur: 480, midi: 62 }, { tick: 0, dur: 480, midi: 60 }]);
    expect(buildSteps(chart).map((s) => s.tick)).toEqual([0, 480]);
  });
});

describe('classifyWrongNote', () => {
  it('same letter in another octave is wrong-octave', () => {
    expect(classifyWrongNote(72, [60])).toMatchObject({ reason: 'wrong-octave', direction: 'higher', expectedMidi: 60 });
    expect(classifyWrongNote(48, [60])).toMatchObject({ reason: 'wrong-octave', direction: 'lower' });
  });

  it('the key right next to it is a neighbour, black or white', () => {
    expect(classifyWrongNote(61, [60])).toMatchObject({ reason: 'neighbour-key', direction: 'higher' }); // C#
    expect(classifyWrongNote(62, [60])).toMatchObject({ reason: 'neighbour-key', direction: 'higher' }); // next white key
    expect(classifyWrongNote(59, [60])).toMatchObject({ reason: 'neighbour-key', direction: 'lower' }); // B
    expect(classifyWrongNote(64, [65])).toMatchObject({ reason: 'neighbour-key', direction: 'lower' }); // E vs F
  });

  it('anything else is a wrong letter', () => {
    expect(classifyWrongNote(64, [60])).toMatchObject({ reason: 'wrong-letter', direction: 'higher' });
    expect(classifyWrongNote(55, [60])).toMatchObject({ reason: 'wrong-letter', direction: 'lower' });
    expect(classifyWrongNote(63, [60])).toMatchObject({ reason: 'wrong-letter' }); // D# is two keys from C
  });

  it('compares with the closest awaited note when several are awaited', () => {
    expect(classifyWrongNote(62, [60, 72])).toMatchObject({ expectedMidi: 60 });
    expect(classifyWrongNote(70, [60, 72])).toMatchObject({ expectedMidi: 72 });
  });
});
