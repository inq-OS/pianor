import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { chartWith } from '../../../tests/helpers/charts';
import { chartSchema, type Chart } from '../chart';
import { UnsupportedNotationError, layoutStaff, noteValueOf, type StaffLayout } from './staff';

const VIEWPORTS = [
  { width: 1366, height: 768 },
  { width: 1280, height: 720 },
  { width: 1024, height: 600 },
];
const lay = (chart: Chart, width = 1366, height = 768): StaffLayout => layoutStaff(chart, { viewport: { width, height } });

/** One 4/4 bar: C/2 D/2 E F2 */
const bar = (pitches: readonly number[], tick = 0) => [
  { tick, dur: 240, midi: pitches[0]! },
  { tick: tick + 240, dur: 240, midi: pitches[1]! },
  { tick: tick + 480, dur: 480, midi: pitches[2]! },
  { tick: tick + 960, dur: 960, midi: pitches[3]! },
];

describe('eighth notes', () => {
  it('are a note length now, and so is the sixteenth (core_09.AC41); a plain value is never dotted and thirty-seconds are not drawn', () => {
    expect(noteValueOf(240)).toBe('eighth');
    expect(noteValueOf(120)).toBe('sixteenth');
    expect(() => noteValueOf(60)).toThrow(UnsupportedNotationError);
    expect(() => noteValueOf(720)).toThrow(UnsupportedNotationError);
    expect(() => noteValueOf(1440)).toThrow(/dotted|unsupported/i);
  });

  it('have a filled head and a stem like a quarter note', () => {
    const l = lay(chartWith(bar([60, 62, 64, 65])));
    const [a] = l.notes;
    expect(a).toMatchObject({ value: 'eighth', filled: true });
    expect(a!.stem).not.toBeNull();
  });
});

describe('a pair of eighths on a beat', () => {
  const chart = chartWith(bar([60, 62, 64, 65]));
  const l = lay(chart);
  const [first, second, quarter, half] = l.notes as [StaffLayout['notes'][0], StaffLayout['notes'][0], StaffLayout['notes'][0], StaffLayout['notes'][0]];

  it('is joined by one beam and carries no flags', () => {
    expect(l.beams).toHaveLength(1);
    expect(first.beamed && second.beamed).toBe(true);
    expect(first.flag || second.flag).toBe(false);
    expect(quarter.beamed || half.beamed).toBe(false);
  });

  it('has stems that point the same way and end on the beam', () => {
    expect(first.stem!.up).toBe(second.stem!.up);
    expect(first.stem!.y2).toBeCloseTo(second.stem!.y2);
    const beam = l.beams[0]!;
    expect(beam.up).toBe(first.stem!.up);
    expect(beam.y).toBeCloseTo(first.stem!.y2);
  });

  it('has a beam that runs from the first stem to the second, with a thickness a student can see', () => {
    const beam = l.beams[0]!;
    expect(beam.x1).toBeCloseTo(first.stem!.x);
    expect(beam.x2).toBeCloseTo(second.stem!.x);
    expect(beam.x2).toBeGreaterThan(beam.x1);
    expect(beam.thickness).toBeGreaterThanOrEqual(l.staffSpace * 0.4);
    expect(beam.system).toBe(first.system);
    expect(beam.staff).toBe(first.staff);
  });

  it('sits the beam on the side of the stem tips: below the tips for stems up, above them for stems down', () => {
    const low = lay(chartWith(bar([60, 62, 64, 65]))); // below the middle line: stems up
    expect(low.beams[0]!.up).toBe(true);
    expect(low.notes[0]!.stem!.y2).toBeLessThan(low.notes[0]!.y);
    const high = lay(chartWith(bar([71, 72, 64, 65]))); // above: stems down
    expect(high.beams[0]!.up).toBe(false);
    expect(high.notes[0]!.stem!.y2).toBeGreaterThan(high.notes[0]!.y);
  });

  it('is horizontal and takes the longer stem of the two, so both heads keep a full stem', () => {
    const uneven = lay(chartWith(bar([60, 64, 62, 60]))); // C4 then E4: different stem tips
    const [a, b] = uneven.notes as [StaffLayout['notes'][0], StaffLayout['notes'][0]];
    expect(a.stem!.y2).toBeCloseTo(b.stem!.y2);
    const natural = (note: StaffLayout['notes'][0]) => Math.abs(note.stem!.y1 - note.stem!.y2);
    expect(natural(a)).toBeGreaterThanOrEqual(3.5 * uneven.staffSpace - 1e-6);
    expect(natural(b)).toBeGreaterThanOrEqual(3.5 * uneven.staffSpace - 1e-6);
  });

  it('puts the second note half a beat after the first on the time axis', () => {
    const quarterGap = lay(chartWith([{ tick: 0, dur: 480, midi: 60 }, { tick: 480, dur: 480, midi: 62 }, { tick: 960, dur: 960, midi: 64 }]));
    const eighthGap = second.x - first.x;
    const beat = quarterGap.notes[1]!.x - quarterGap.notes[0]!.x;
    expect(eighthGap).toBeGreaterThan(0);
    expect(eighthGap).toBeLessThan(beat);
  });
});

describe('a single eighth', () => {
  it('gets a flag, not a beam, when no eighth follows it half a beat later', () => {
    const l = lay(chartWith([{ tick: 0, dur: 240, midi: 60 }, { tick: 480, dur: 480, midi: 62 }, { tick: 960, dur: 960, midi: 64 }]));
    expect(l.notes[0]).toMatchObject({ flag: true, beamed: false });
    expect(l.beams).toHaveLength(0);
  });

  it('a pair that starts on a later beat is beamed too, and an eighth that starts off the beat is flagged', () => {
    const second = lay(chartWith([{ tick: 0, dur: 480, midi: 60 }, { tick: 480, dur: 240, midi: 62 }, { tick: 720, dur: 240, midi: 64 }, { tick: 960, dur: 960, midi: 65 }]));
    expect(second.notes[1]!.beamed && second.notes[2]!.beamed).toBe(true);
    expect(second.beams).toHaveLength(1);
    const offBeat = lay(chartWith([{ tick: 240, dur: 240, midi: 60 }, { tick: 480, dur: 240, midi: 62 }, { tick: 960, dur: 960, midi: 64 }]));
    expect(offBeat.notes[0]!.flag).toBe(true);
    expect(offBeat.notes[1]!.flag).toBe(true);
    expect(offBeat.beams).toHaveLength(0);
  });

  it('is flagged when a quarter or a rest follows it', () => {
    const chart = chartWith([{ tick: 0, dur: 240, midi: 60 }, { tick: 480, dur: 480, midi: 62 }, { tick: 960, dur: 960, midi: 64 }], {
      rests: [{ tick: 240, dur: 240, track: 'rh', voice: 1, bar: 0 }],
    });
    const l = lay(chart);
    expect(l.notes[0]).toMatchObject({ flag: true, beamed: false });
    expect(l.rests[0]).toMatchObject({ value: 'eighth' });
  });

  it('does not mark half, quarter and whole notes', () => {
    const l = lay(chartWith([{ tick: 0, dur: 1920, midi: 60 }]));
    expect(l.notes[0]).toMatchObject({ flag: false, beamed: false });
    expect(l.beams).toEqual([]);
  });
});

describe('an eighth rest', () => {
  it('sits on the middle line like a quarter rest', () => {
    const chart = chartWith([{ tick: 0, dur: 480, midi: 60 }, { tick: 720, dur: 240, midi: 62 }, { tick: 960, dur: 960, midi: 64 }], {
      rests: [{ tick: 480, dur: 240, track: 'rh', voice: 1, bar: 0 }],
    });
    const l = lay(chart);
    const system = l.systems[0]!;
    const middle = (system.staves[0]!.topLineY + system.staves[0]!.bottomLineY) / 2;
    expect(l.rests[0]).toMatchObject({ value: 'eighth' });
    expect(l.rests[0]!.y).toBeCloseTo(middle);
  });
});

describe('pieces with eighths', () => {
  const eighthBar = fc.constantFrom([60, 62, 64, 65], [67, 65, 64, 62], [72, 71, 69, 67], [64, 65, 67, 69]);

  it('fit on every supported screen, drawn without overlap, in two or more bars (property)', () => {
    fc.assert(
      fc.property(fc.array(eighthBar, { minLength: 2, maxLength: 8 }), fc.constantFrom(...VIEWPORTS), (bars, vp) => {
        const notes = bars.flatMap((pitches, i) => bar(pitches, i * 1920));
        const chart = chartSchema.parse(chartWith(notes));
        const l = lay(chart, vp.width, vp.height);
        expect(l.fits).toBe(true);
        expect(l.notes).toHaveLength(notes.length);
        expect(l.beams).toHaveLength(bars.length);
        for (const n of l.notes) {
          expect(n.x - n.headRx).toBeGreaterThanOrEqual(0);
          expect(n.x + n.headRx).toBeLessThanOrEqual(vp.width);
        }
        // notes of one bar never overlap on the time axis: heads at least a head wide apart
        for (let i = 1; i < l.notes.length; i++) {
          const a = l.notes[i - 1]!;
          const b = l.notes[i]!;
          if (a.system === b.system) expect(b.x - a.x).toBeGreaterThan(a.headRx * 1.2);
        }
      }),
    );
  });

  it('leave less room for bars than quarters do, so the notes stay readable instead of crowding', () => {
    const quarters = chartWith(Array.from({ length: 16 }, (_, i) => ({ tick: i * 480, dur: 480, midi: 60 + (i % 5) })).map((n) => ({ ...n, midi: [60, 62, 64, 65, 67][(n.midi - 60) % 5]! })));
    const eighths = chartWith(Array.from({ length: 8 }, (_, i) => bar([60, 62, 64, 65], i * 1920)).flat());
    expect(lay(eighths).staffSpace).toBeLessThanOrEqual(lay(quarters).staffSpace);
  });
});
