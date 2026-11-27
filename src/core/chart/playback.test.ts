import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { chartWith, graceAt } from '../../../tests/helpers/charts';
import { chartSchema } from './schema';
import { lastSoundMs, playbackLengthMs, playbackNotes, soundingAt } from './playback';

/** Two bars of 4/4 at 120 bpm: a quarter is 500 ms. */
const melody = () =>
  chartWith([
    { tick: 0, dur: 480, midi: 60 }, { tick: 480, dur: 480, midi: 62 }, { tick: 960, dur: 960, midi: 64 },
    { tick: 1920, dur: 1920, midi: 67 },
  ]);

describe('playbackNotes', () => {
  it('turns notes into start and end times from the tempo', () => {
    const notes = playbackNotes(melody());
    expect(notes.map((n) => [n.midi, n.startMs, n.endMs])).toEqual([
      [60, 0, 500], [62, 500, 1000], [64, 1000, 2000], [67, 2000, 4000],
    ]);
    expect(notes.map((n) => n.noteIndexes)).toEqual([[0], [1], [2], [3]]);
  });

  it('follows a tempo change', () => {
    const chart = chartWith([{ tick: 0, dur: 1920, midi: 60 }, { tick: 1920, dur: 1920, midi: 62 }], {
      tempoMap: [{ tick: 0, bpm: 120 }, { tick: 1920, bpm: 60 }],
    });
    expect(playbackNotes(chart).map((n) => [n.startMs, n.endMs])).toEqual([[0, 2000], [2000, 6000]]);
  });

  it('plays slower or faster with a tempo scale', () => {
    expect(playbackNotes(melody(), { tempoScale: 0.5 }).map((n) => n.startMs)).toEqual([0, 1000, 2000, 4000]);
    expect(playbackLengthMs(melody(), { tempoScale: 2 })).toBe(2000);
  });

  it('joins tied notes into one long note that lights every notehead', () => {
    const chart = chartWith([
      { tick: 0, dur: 960, midi: 60, tieNext: true }, { tick: 960, dur: 960, midi: 60, tieNext: true }, { tick: 1920, dur: 960, midi: 60 },
      { tick: 2880, dur: 960, midi: 62 },
    ]);
    const notes = playbackNotes(chart);
    expect(notes).toHaveLength(2);
    expect(notes[0]).toMatchObject({ midi: 60, startMs: 0, endMs: 3000, noteIndexes: [0, 1, 2] });
    expect(notes[1]).toMatchObject({ midi: 62, startMs: 3000 });
  });

  it('plays every hand and the accompaniment, but not a click track', () => {
    const chart = chartWith(
      [{ tick: 0, dur: 1920, midi: 60 }, { tick: 0, dur: 1920, midi: 48, track: 'lh' }, { tick: 0, dur: 1920, midi: 64, track: 'bk' }, { tick: 0, dur: 1920, midi: 72, track: 'ck' }],
      {
        tracks: [
          { id: 'rh', role: 'play', hand: 'RH', clef: 'treble' }, { id: 'lh', role: 'play', hand: 'LH', clef: 'bass' },
          { id: 'bk', role: 'accompaniment', hand: null, clef: 'treble' }, { id: 'ck', role: 'click', hand: null, clef: 'treble' },
        ],
      },
    );
    expect(playbackNotes(chart).map((n) => n.midi).sort((a, b) => a - b)).toEqual([48, 60, 64]);
  });

  it('uses one velocity for the whole piece, which can be changed', () => {
    expect(new Set(playbackNotes(melody()).map((n) => n.velocity))).toEqual(new Set([80]));
    expect(playbackNotes(melody(), { velocity: 55 })[0]!.velocity).toBe(55);
  });

  it('measures the whole piece, including a final rest, to the end of the last bar', () => {
    expect(playbackLengthMs(melody())).toBe(4000);
    const ends = chartWith([{ tick: 0, dur: 480, midi: 60 }, { tick: 3840, dur: 480, midi: 62 }]);
    expect(playbackLengthMs(ends)).toBe(6000);
  });
});

describe('slurs (core_09.AC26)', () => {
  // Covers core_09.AC26.
  it('holds each slurred note until the next note of its slur, and the last one as written', () => {
    const chart = chartWith(
      [{ tick: 0, dur: 240, midi: 60 }, { tick: 480, dur: 240, midi: 62 }, { tick: 960, dur: 960, midi: 64 }],
      { slurs: [{ track: 'rh', voice: 1, startTick: 0, endTick: 960 }] },
    );
    expect(playbackNotes(chart).map((n) => [n.midi, n.startMs, n.endMs])).toEqual([[60, 0, 500], [62, 500, 1000], [64, 1000, 2000]]);
  });

  it('core_09.AC26 a written rest inside a slur is heard: the hold stops where the rest starts', () => {
    const chart = chartWith(
      [{ tick: 0, dur: 480, midi: 60 }, { tick: 960, dur: 480, midi: 62 }],
      { slurs: [{ track: 'rh', voice: 1, startTick: 0, endTick: 960 }], rests: [{ tick: 480, dur: 480, track: 'rh', voice: 1, bar: 0 }] },
    );
    expect(playbackNotes(chart).map((n) => [n.midi, n.startMs, n.endMs])).toEqual([[60, 0, 500], [62, 1000, 1500]]);
  });

  it('plays unslurred notes as written', () => {
    const chart = chartWith([{ tick: 0, dur: 240, midi: 60 }, { tick: 480, dur: 240, midi: 62 }]);
    expect(playbackNotes(chart).map((n) => [n.startMs, n.endMs])).toEqual([[0, 250], [500, 750]]);
  });
});

describe('grace notes (core_09.AC34, d121)', () => {
  const graced = (graces: unknown[], extra: Record<string, unknown> = {}) =>
    chartWith([{ tick: 0, dur: 480, midi: 60 }, { tick: 480, dur: 480, midi: 62 }, { tick: 960, dur: 960, midi: 64 }], { graces, ...extra });

  // Covers core_09.AC34.
  it('core_09.AC34 sounds each grace 60 ms before its main onset, ending at the onset, and leaves the main notes as they were', () => {
    const notes = playbackNotes(graced([graceAt(960, 65)]));
    expect(notes.map((n) => [n.midi, n.startMs, n.endMs])).toEqual([[60, 0, 500], [62, 500, 1000], [65, 940, 1000], [64, 1000, 2000]]);
    const grace = notes.find((n) => n.midi === 65)!;
    expect(grace).toMatchObject({ grace: true, noteIndexes: [], velocity: 80 }); // no chart note to light; the main note's loudness
    expect(notes.filter((n) => n.midi !== 65)).toEqual(playbackNotes(graced([])));
  });

  it('core_09.AC34 the lead stays 60 ms at any tempo, and a grace on the first note starts before 0', () => {
    expect(playbackNotes(graced([graceAt(960, 65)]), { tempoScale: 0.5 }).find((n) => n.grace)).toMatchObject({ startMs: 1940, endMs: 2000 });
    expect(playbackNotes(graced([graceAt(0, 62)]), { velocity: 50 })[0]).toMatchObject({ midi: 62, startMs: -60, endMs: 0, velocity: 50, grace: true });
  });

  it('core_09.AC34 a grace sounds only where its track is heard (never on a click track)', () => {
    const chart = chartWith([{ tick: 0, dur: 480, midi: 60 }, { tick: 480, dur: 480, midi: 62, track: 'bk' }], {
      graces: [graceAt(480, 64, 'bk')],
      tracks: [
        { id: 'rh', role: 'play', hand: 'RH', clef: 'treble' },
        { id: 'bk', role: 'click', hand: null, clef: 'treble' },
      ],
    });
    expect(playbackNotes(chart).map((n) => n.midi)).toEqual([60]);
  });

  it('core_09.AC34 soundingAt never lights a grace', () => {
    const notes = playbackNotes(graced([graceAt(960, 65)]));
    expect(soundingAt(notes, 950)).toEqual([1]);
  });
});

describe('soundingAt', () => {
  const notes = playbackNotes(melody());

  it('lists the notes that are sounding at a time, start included and end excluded', () => {
    expect(soundingAt(notes, 0)).toEqual([0]);
    expect(soundingAt(notes, 499)).toEqual([0]);
    expect(soundingAt(notes, 500)).toEqual([1]);
    expect(soundingAt(notes, 1500)).toEqual([2]);
    expect(soundingAt(notes, 4000)).toEqual([]);
    expect(soundingAt(notes, -5)).toEqual([]);
  });

  it('lists the notes of both hands together', () => {
    const chart = chartWith([{ tick: 0, dur: 1920, midi: 60 }, { tick: 0, dur: 960, midi: 48, track: 'lh' }]);
    expect(soundingAt(playbackNotes(chart), 100).sort()).toEqual([0, 1]);
    expect(soundingAt(playbackNotes(chart), 1500)).toEqual([0]);
  });
});

describe('properties', () => {
  const pitches = [60, 62, 64, 65, 67];
  const chartArb = fc.array(fc.tuple(fc.constantFrom(...pitches), fc.constantFrom(480, 960, 1920)), { minLength: 1, maxLength: 12 }).map((items) => {
    let tick = 0;
    const notes = items.map(([midi, dur]) => {
      const note = { tick, dur, midi };
      tick += dur;
      return note;
    });
    return chartSchema.parse(chartWith(notes));
  });

  it('plays every note once, in time order, with positive lengths', () => {
    fc.assert(
      fc.property(chartArb, (chart) => {
        const notes = playbackNotes(chart);
        expect(notes.flatMap((n) => n.noteIndexes).sort((a, b) => a - b)).toEqual(chart.notes.map((_, i) => i));
        notes.forEach((n, i) => {
          expect(n.endMs).toBeGreaterThan(n.startMs);
          if (i > 0) expect(n.startMs).toBeGreaterThanOrEqual(notes[i - 1]!.startMs);
        });
        expect(notes.at(-1)!.endMs).toBeLessThanOrEqual(playbackLengthMs(chart));
      }),
    );
  });
});

describe('lastSoundMs', () => {
  it('ft_1_02a.AC17 ends where the last written note stops sounding, not at the end of the empty bars after it', () => {
    // two quarters in the first of eight bars: Listen ends after one second, not after sixteen
    const chart = chartWith([{ tick: 0, dur: 480, midi: 60 }, { tick: 480, dur: 480, midi: 62 }], { bars: Array.from({ length: 8 }, (_, i) => ({ index: i, startTick: i * 1920, endTick: (i + 1) * 1920 })) });
    expect(lastSoundMs(playbackNotes(chart))).toBe(1000);
    expect(playbackLengthMs(chart)).toBe(16000);
    expect(lastSoundMs([])).toBe(0);
  });
});
