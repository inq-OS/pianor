// Covers ft_0_02.AC3.
import { describe, expect, it } from 'vitest';
import littleSteps from '../../../tests/fixtures/charts/little-steps.v2.json';
import { chartSchema, levelsFileSchema, pieceMetaSchema } from './schema';
import { parseChart } from './migrate';
import { spellingToMidi, type Spelling } from './pitch';

type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const clone = () => structuredClone(littleSteps) as Json;

describe('chartSchema', () => {
  it('accepts the little-steps fixture (the example in docs/authoring/au01-piece-files.md)', () => {
    expect(chartSchema.safeParse(littleSteps).success).toBe(true);
  });

  it('defaults rests to an empty list', () => {
    const c = clone();
    delete c.rests;
    expect(chartSchema.parse(c).rests).toEqual([]);
  });

  const bad: [string, (c: Json) => void, RegExp][] = [
    ['midi that disagrees with the spelling', (c) => { c.notes[0].midi = 61; }, /midi does not match/],
    ['unknown track', (c) => { c.notes[0].track = 'nope'; }, /unknown track/],
    ['wrong bar index on a note', (c) => { c.notes[3].bar = 2; }, /bar should be/],
    ['note past the last bar', (c) => { c.notes[10].dur = 4000; }, /past the last bar/],
    ['note outside the range', (c) => { c.range.high = 62; }, /outside chart range/],
    ['gap between bars', (c) => { c.bars[1].startTick = 2000; }, /contiguous/],
    ['tempo map not starting at 0', (c) => { c.tempoMap[0].tick = 10; }, /start at tick 0/],
    ['meter change inside a bar', (c) => { c.meterMap.push({ tick: 100, num: 3, den: 4 }); }, /bar line/],
    ['phrase beyond the bars', (c) => { c.phrases[0].endBar = 9; }, /phrase outside/],
    ['phrases that cross', (c) => { c.phrases = [{ name: 'A', startBar: 0, endBar: 2 }, { name: 'B', startBar: 1, endBar: 3 }]; }, /"A" and "B" cross/],
    ['finger 6', (c) => { c.notes[0].finger = 6; }, /./],
    ['dynamic that is not one of pp p mp mf f ff (core_09.AC14)', (c) => { c.notes[0].dynamic = 'fff'; }, /./],
    ['wrong ppq', (c) => { c.ppq = 96; }, /./],
    ['duplicate track ids', (c) => { c.tracks.push({ ...c.tracks[0] }); }, /unique/],
  ];
  it.each(bad)('rejects %s', (_name, mutate, message) => {
    const c = clone();
    mutate(c);
    const result = chartSchema.safeParse(c);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.map((i) => i.message).join('|')).toMatch(message);
  });

  it('accepts each of the six dynamic marks on a note (core_09.AC14)', () => {
    for (const dynamic of ['pp', 'p', 'mp', 'mf', 'f', 'ff']) {
      const c = clone();
      c.notes[0].dynamic = dynamic;
      expect(chartSchema.safeParse(c).success).toBe(true);
    }
  });

  it('validates rests like notes', () => {
    const rest = { tick: 0, dur: 480, track: 'rh', voice: 1, bar: 0 };
    const c = clone();
    c.rests = [rest];
    expect(chartSchema.safeParse(c).success).toBe(true);
    for (const patch of [{ track: 'nope' }, { dur: 99999 }, { bar: 2 }]) {
      c.rests = [{ ...rest, ...patch }];
      expect(chartSchema.safeParse(c).success).toBe(false);
    }
  });

  it('accepts a note and a rest that end exactly on the last bar line', () => {
    const c = clone();
    const end = c.bars.at(-1).endTick as number;
    const last = c.notes.at(-1);
    last.dur = end - last.tick;
    c.rests = [{ tick: end - 480, dur: 480, track: 'lh', voice: 1, bar: c.bars.length - 1 }];
    if (!c.tracks.some((t: Json) => t.id === 'lh')) c.rests[0].track = c.tracks[0].id;
    expect(chartSchema.safeParse(c).error?.issues).toBeUndefined();
  });

  it('rejects a range with low above high', () => {
    const c = clone();
    c.range = { low: 70, high: 60 };
    expect(chartSchema.safeParse(c).success).toBe(false);
  });

  it('rejects tempo ticks that do not increase', () => {
    const c = clone();
    c.tempoMap = [{ tick: 0, bpm: 70 }, { tick: 0, bpm: 80 }];
    expect(chartSchema.safeParse(c).success).toBe(false);
  });

  it('accepts C# and Db as different spellings of the same key', () => {
    const c = clone();
    c.notes[0] = { ...c.notes[0], midi: 61, spelling: { step: 'C', alter: 1, octave: 4 } };
    expect(chartSchema.safeParse(c).success).toBe(true);
    c.notes[0] = { ...c.notes[0], midi: 61, spelling: { step: 'D', alter: -1, octave: 4 } };
    expect(chartSchema.safeParse(c).success).toBe(true);
  });

  it('never throws on garbage, it reports errors', () => {
    for (const junk of [null, 42, 'x', [], {}, { schemaVersion: 1 }, { schemaVersion: 'one' }]) {
      expect(parseChart(junk).ok).toBe(false);
    }
  });
});

describe('chart graces (core_09.AC31)', () => {
  // A grace on the first note of the fixture (C4 at tick 0 in the right hand), pitched a step above it.
  const grace = (c: Json, patch: Json = {}) => {
    const note = c.notes[0];
    const spelling: Spelling = { step: 'D', alter: 0, octave: 4 };
    return { track: note.track, voice: note.voice, tick: note.tick, pitch: { midi: spellingToMidi(spelling), spelling }, slash: true, ...patch };
  };

  // Covers core_09.AC31.
  it('accepts a grace on the start of a note of its track and voice, and no schema version change', () => {
    const c = clone();
    c.graces = [grace(c)];
    expect(c.schemaVersion).toBe(2);
    expect(chartSchema.safeParse(c).success).toBe(true);
    const plain = clone();
    expect(chartSchema.parse(plain).graces).toBeUndefined();
  });

  // Covers core_09.AC31.
  const bad: [string, (c: Json) => void, RegExp][] = [
    ['a grace whose tick is not a note start', (c) => { c.graces = [grace(c, { tick: 100 })]; }, /note start/],
    ['a grace on a track that has no note there', (c) => { c.graces = [grace(c, { track: 'nope' })]; }, /note start/],
    ['a second grace on one note', (c) => { c.graces = [grace(c), grace(c, { slash: false })]; }, /one grace/],
    ['a grace with the main note pitch', (c) => { c.graces = [grace(c, { pitch: { midi: 60, spelling: { step: 'C', alter: 0, octave: 4 } } })]; }, /same pitch/],
    ['a grace midi that disagrees with its spelling', (c) => { c.graces = [grace(c, { pitch: { midi: 70, spelling: { step: 'D', alter: 0, octave: 4 } } })]; }, /midi does not match/],
  ];
  it.each(bad)('rejects %s', (_name, mutate, message) => {
    const c = clone();
    mutate(c);
    const result = chartSchema.safeParse(c);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.map((i) => i.message).join('|')).toMatch(message);
  });
});

describe('pieceMetaSchema', () => {
  const meta = {
    id: 'little-steps', title: 'Little Steps', level: 1, status: 'draft', hands: ['RH'],
    phrases: [{ name: 'Steps', bars: [1, 4] }], tags: ['c-position'], source: 'original',
    license: 'CC0-1.0', generator: { kind: 'manual' },
  };

  it('accepts the docs/authoring/au01-piece-files.md example and fills schemaVersion', () => {
    expect(pieceMetaSchema.parse(meta).schemaVersion).toBe(1);
  });

  it('requires source and license, a valid id and a known status', () => {
    for (const patch of [{ source: '' }, { license: undefined }, { id: 'Little Steps' }, { status: 'published' }]) {
      expect(pieceMetaSchema.safeParse({ ...meta, ...patch }).success).toBe(false);
    }
  });

  it('takes an optional difficulty, a whole number of half stars from 1 to 50 (d157), and keeps it', () => {
    expect(pieceMetaSchema.parse(meta).difficulty).toBeUndefined();
    expect(pieceMetaSchema.parse({ ...meta, difficulty: 3 }).difficulty).toBe(3);
    expect(pieceMetaSchema.parse({ ...meta, difficulty: 50 }).difficulty).toBe(50);
    for (const difficulty of [0, 51, 2.5, '3']) expect(pieceMetaSchema.safeParse({ ...meta, difficulty }).success).toBe(false);
  });
});

describe('levelsFileSchema', () => {
  it('accepts a level row', () => {
    const file = {
      schemaVersion: 1,
      levels: [{
        level: 1, name: 'C position, right hand', hands: ['RH'], clefs: ['treble'],
        range: { low: 60, high: 67 }, noteValues: ['whole', 'half', 'quarter'], rests: false,
        meters: [{ num: 4, den: 4 }], maxLeapSteps: 1, accidentals: false,
        fingerings: { RH: { C4: 1, D4: 2, E4: 3, F4: 4, G4: 5 } },
      }],
    };
    expect(levelsFileSchema.safeParse(file).success).toBe(true);
  });
});
