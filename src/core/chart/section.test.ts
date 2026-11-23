// Covers core_03.AC1, core_03.AC3.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import littleSteps from '../../../tests/fixtures/charts/little-steps.v2.json';
import { chartWith } from '../../../tests/helpers/charts';
import { chartSchema } from './schema.ts';
import { buildSteps } from '../judge/steps';
import { isSection, sectionHasNotes, sliceChart } from './section.ts';

const chart = chartSchema.parse(littleSteps); // four bars of 4/4 at 70 bpm, 11 notes, one phrase

describe('sliceChart', () => {
  it('core_09.AC25 titles a section of a piece with a pick-up by its printed bars (the pick-up is 0); the id keeps its index name', () => {
    const up = chartSchema.parse({ ...structuredClone(littleSteps), bars: chart.bars.map((b, i) => (i === 0 ? { ...b, endTick: 480 } : { ...b, startTick: b.startTick - 1440, endTick: b.endTick - 1440 })), notes: [] });
    expect(sliceChart(up, 1, 2)).toMatchObject({ id: 'little-steps#bars-2-3', title: 'Little Steps (bars 1 to 2)' });
    expect(sliceChart(up, 0, 0).title).toBe('Little Steps (bar 0)');
  });

  it('makes bars 2 to 3 a chart of two bars starting at tick 0, with its notes moved and renumbered', () => {
    const section = sliceChart(chart, 1, 2);
    expect(section.bars).toEqual([{ index: 0, startTick: 0, endTick: 1920 }, { index: 1, startTick: 1920, endTick: 3840 }]);
    const original = chart.notes.filter((n) => n.bar === 1 || n.bar === 2);
    expect(section.notes.map((n) => [n.midi, n.tick, n.bar])).toEqual(original.map((n) => [n.midi, n.tick - 1920, n.bar - 1]));
    expect(section).toMatchObject({ id: 'little-steps#bars-2-3', title: 'Little Steps (bars 2 to 3)', ppq: 480 });
    expect(isSection(section)).toBe(true);
    expect(isSection(chart)).toBe(false);
  });

  it('the whole piece as a section is the piece with another id', () => {
    const whole = sliceChart(chart, 0, chart.bars.length - 1);
    expect(whole.notes).toEqual(chart.notes);
    expect(whole.bars).toEqual(chart.bars);
    expect(whole.range).toEqual(chart.range);
  });

  it('keeps the tempo and meter in force, and moves a later change back', () => {
    const tempo = chartSchema.parse({ ...chart, tempoMap: [{ tick: 0, bpm: 70 }, { tick: 1920, bpm: 90 }, { tick: 5760, bpm: 50 }] });
    expect(sliceChart(tempo, 1, 3).tempoMap).toEqual([{ tick: 0, bpm: 90 }, { tick: 3840, bpm: 50 }]);
    expect(sliceChart(tempo, 0, 0).tempoMap).toEqual([{ tick: 0, bpm: 70 }]);
    expect(sliceChart(tempo, 2, 2).tempoMap).toEqual([{ tick: 0, bpm: 90 }]);
  });

  it('cuts the phrases to the section and drops those outside it', () => {
    const phrased = chartSchema.parse({ ...chart, phrases: [{ name: 'A', startBar: 0, endBar: 1 }, { name: 'B', startBar: 2, endBar: 3 }] });
    expect(sliceChart(phrased, 1, 2).phrases).toEqual([{ name: 'A', startBar: 0, endBar: 0 }, { name: 'B', startBar: 1, endBar: 1 }]);
    expect(sliceChart(phrased, 3, 3).phrases).toEqual([{ name: 'B', startBar: 0, endBar: 0 }]);
  });

  it('ends a tie that runs out of the section, and keeps one inside it', () => {
    const tied = chartWith([
      { tick: 0, dur: 1920, midi: 60, tieNext: true }, { tick: 1920, dur: 1920, midi: 60, tieNext: true }, { tick: 3840, dur: 1920, midi: 62 },
    ]);
    expect(sliceChart(tied, 0, 1).notes.map((n) => n.tieNext)).toEqual([true, undefined]);
    expect(sliceChart(tied, 1, 1).notes.map((n) => n.tieNext)).toEqual([undefined]);
  });

  it('names a one-bar section by its bar', () => {
    expect(sliceChart(chart, 2, 2)).toMatchObject({ id: 'little-steps#bars-3-3', title: 'Little Steps (bar 3)' });
  });

  it('refuses a section outside the piece or the wrong way round', () => {
    expect(() => sliceChart(chart, -1, 1)).toThrow(/a section is bars/);
    expect(() => sliceChart(chart, 2, 1)).toThrow(/a section is bars/);
    expect(() => sliceChart(chart, 0, 4)).toThrow(/a section is bars/);
    expect(() => sliceChart(chart, 0.5, 1)).toThrow(/a section is bars/);
  });

  it('any section is a valid chart with exactly the notes of its bars, in the same order', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 3 }), fc.integer({ min: 0, max: 3 }), (a, b) => {
        const [first, last] = [Math.min(a, b), Math.max(a, b)];
        const section = sliceChart(chart, first, last);
        expect(chartSchema.safeParse(section).success).toBe(true);
        expect(section.notes.map((n) => n.midi)).toEqual(chart.notes.filter((n) => n.bar >= first && n.bar <= last).map((n) => n.midi));
        expect(section.bars).toHaveLength(last - first + 1);
        expect(section.notes.every((n) => n.tick >= 0 && n.tick < section.bars.at(-1)!.endTick)).toBe(true);
      }),
    );
  });
});

describe('sliceChart with grace notes (core_09.AC32)', () => {
  const grace = (tick: number, midi: number) => ({ track: 'rh', voice: 1, tick, pitch: { midi, spelling: { step: 'D', alter: 0, octave: 4 } }, slash: true });
  // C4 quarters in bars 1 and 2; a D4 grace before the first note of each bar
  const graced = chartWith([0, 480, 1920, 2400].map((tick) => ({ tick, dur: 480, midi: 60 })), { graces: [grace(0, 62), grace(1920, 62)] });

  it('keeps the graces of the section, moved with their main notes, and drops the others (core_09.AC32)', () => {
    expect(sliceChart(graced, 1, 1).graces).toEqual([grace(0, 62)]);
    expect(sliceChart(graced, 0, 0).graces).toEqual([grace(0, 62)]);
    expect(sliceChart(graced, 0, 1).graces).toEqual(graced.graces);
  });

  it('keeps a chart without graces without the field (core_09.AC32)', () => {
    expect(sliceChart(chartWith([{ tick: 0, dur: 480, midi: 60 }]), 0, 0)).not.toHaveProperty('graces');
  });
});

describe('sliceChart with slurs (core_09.AC26)', () => {
  const slur = (startTick: number, endTick: number) => ({ track: 'rh', voice: 1, startTick, endTick });
  // C4 quarters in bars 1 to 3; one slur in bar 1, one from bar 2 into bar 3
  const slurred = chartWith([0, 480, 1920, 2400, 3840, 4320].map((tick) => ({ tick, dur: 480, midi: 60 })), { slurs: [slur(0, 480), slur(2400, 3840)] });

  it('core_09.AC26 a section of a piece with slurs is a valid chart: a slur inside it is moved, one it cuts is left out', () => {
    expect(sliceChart(slurred, 0, 0).slurs).toEqual([slur(0, 480)]);
    expect(sliceChart(slurred, 1, 1).slurs).toEqual([]);
    expect(sliceChart(slurred, 1, 2).slurs).toEqual([slur(480, 1920)]);
    expect(sliceChart(slurred, 2, 2).slurs).toEqual([]);
    expect(sliceChart(slurred, 0, 2).slurs).toEqual(slurred.slurs);
  });

  it('keeps a chart without slurs without the field (core_09.AC26)', () => {
    expect(sliceChart(chartWith([{ tick: 0, dur: 480, midi: 60 }]), 0, 0)).not.toHaveProperty('slurs');
  });
});

describe('sectionHasNotes', () => {
  // bar 0: a note, bar 1: nothing (rests), bar 2: only the accompaniment, bar 3: a left-hand note
  const chart = chartWith([
    { tick: 0, dur: 1920, midi: 60 },
    { tick: 3840, dur: 1920, midi: 48, track: 'bk' },
    { tick: 5760, dur: 1920, midi: 48, track: 'lh' },
  ]);

  it('is false for a section with nothing for the player to press, so it is refused instead of never finishing', () => {
    expect(sectionHasNotes(chart, 1, 1)).toBe(false);
    expect(sectionHasNotes(chart, 1, 2)).toBe(false); // the accompaniment is not played by the student
  });

  it('is true when any bar of the section has a note of either hand, and agrees with the judge steps', () => {
    expect(sectionHasNotes(chart, 0, 1)).toBe(true);
    expect(sectionHasNotes(chart, 2, 3)).toBe(true);
    for (let first = 0; first < chart.bars.length; first++) {
      for (let last = first; last < chart.bars.length; last++) {
        expect(sectionHasNotes(chart, first, last), `bars ${first} to ${last}`).toBe(buildSteps(sliceChart(chart, first, last)).length > 0);
      }
    }
  });
});
