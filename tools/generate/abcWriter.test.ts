import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { PPQ } from '../../src/core/chart';
import { compilePiece } from '../../src/core/piece/compile';
import { abcPitchOfMidi, writeAbc } from './abcWriter';
import type { Draft, Slot } from './model';

const meta = (hands: string[]) =>
  JSON.stringify({ id: 'writer-test', title: 'Writer Test', level: 5, status: 'draft', hands, phrases: [{ name: 'All', bars: [1, 4] }], tags: [], source: 'test', license: 'CC0-1.0', generator: { kind: 'test' } });

const note = (midi: number, beats: number): Slot => ({ midi, beats });
const rest = (beats: number): Slot => ({ midi: null, beats });

const draft = (voices: Draft['voices'], meter = { num: 4, den: 4 }): Draft => ({
  title: 'Writer Test', comment: 'made by a test', meter, bpm: 72, voices, phrases: [{ name: 'All', bars: [1, 4] }], tags: [],
});

describe('abcPitchOfMidi', () => {
  it('writes middle C as C, the octave above as c and the ones below with commas', () => {
    expect(abcPitchOfMidi(60)).toBe('C');
    expect(abcPitchOfMidi(67)).toBe('G');
    expect(abcPitchOfMidi(71)).toBe('B');
    expect(abcPitchOfMidi(72)).toBe('c');
    expect(abcPitchOfMidi(76)).toBe('e');
    expect(abcPitchOfMidi(84)).toBe("c'");
    expect(abcPitchOfMidi(59)).toBe('B,');
    expect(abcPitchOfMidi(48)).toBe('C,');
    expect(abcPitchOfMidi(36)).toBe('C,,');
  });

  it('refuses a note that needs an accidental', () => {
    expect(() => abcPitchOfMidi(61)).toThrow(/accidental/);
  });
});

describe('writeAbc', () => {
  it('writes a header, one line of music and a closing bar', () => {
    const abc = writeAbc(draft([{ hand: 'RH', bars: [[note(60, 1), note(62, 1), note(64, 2)], [note(65, 4)]] }]), () => undefined);
    expect(abc.split('\n')).toEqual([
      'X:1', 'T:Writer Test', 'M:4/4', 'L:1/4', 'Q:1/4=72', 'K:C', '% made by a test', 'C D E2 | F4 |]', '',
    ]);
  });

  it('writes eighths, rests, whole-bar rests and fingerings', () => {
    const abc = writeAbc(
      draft([{ hand: 'RH', bars: [[note(60, 0.5), note(62, 0.5), rest(1), note(64, 2)], [rest(4)]] }]),
      (hand, midi) => (hand === 'RH' && midi === 60 ? 1 : undefined),
    );
    expect(abc).toContain('!1!C/2 D/2 z E2 | Z |]');
  });

  it('writes both hands as two voices, the right hand first, with clefs', () => {
    const abc = writeAbc(
      draft([
        { hand: 'LH', bars: [[rest(4)], [note(48, 4)]] },
        { hand: 'RH', bars: [[note(60, 4)], [rest(4)]] },
      ]),
      () => undefined,
    );
    expect(abc).toContain('V:RH clef=treble\nV:LH clef=bass\nV:RH\nC4 | Z |]\nV:LH\nZ | C,4 |]\n');
  });

  it('is read back by the compiler as exactly what was written (property)', () => {
    const naturals = [48, 50, 52, 53, 55, 57, 59, 60, 62, 64, 65, 67, 69, 71, 72];
    const barArb = fc.constantFrom(4, 3, 2).chain((beats) =>
      fc.array(fc.tuple(fc.constantFrom(0.5, 1, 2), fc.constantFrom(...naturals), fc.boolean()), { minLength: 1, maxLength: 12 }).map((items) => {
        const slots: Slot[] = [];
        let left = beats;
        for (const [len, midi, isRest] of items) {
          if (len > left) continue;
          slots.push(isRest ? rest(len) : note(midi, len));
          left -= len;
        }
        for (; left >= 1; left -= 1) slots.push(rest(1));
        if (left > 0) slots.push(rest(left));
        return { beats, slots };
      }),
    );
    fc.assert(
      fc.property(barArb, ({ beats, slots }) => {
        fc.pre(slots.some((slot) => slot.midi !== null)); // a piece of only rests is not a piece
        const abc = writeAbc(draft([{ hand: 'RH', bars: [slots, slots, slots, slots] }], { num: beats, den: 4 }), () => undefined);
        const compiled = compilePiece({ abc, meta: meta(['RH']) });
        expect(compiled.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
        const expected: { tick: number; dur: number; midi: number }[] = [];
        let tick = 0;
        for (let bar = 0; bar < 4; bar++) {
          for (const s of slots) {
            if (s.midi !== null) expected.push({ tick, dur: s.beats * PPQ, midi: s.midi });
            tick += s.beats * PPQ;
          }
        }
        expect(compiled.chart!.notes.map((n) => ({ tick: n.tick, dur: n.dur, midi: n.midi }))).toEqual(expected);
        expect(compiled.chart!.bars).toHaveLength(4);
      }),
    );
  });

  it('is read back as two tracks with the right hands and clefs', () => {
    const abc = writeAbc(
      draft([
        { hand: 'RH', bars: [[note(60, 4)], [rest(4)], [note(64, 4)], [rest(4)]] },
        { hand: 'LH', bars: [[rest(4)], [note(48, 4)], [rest(4)], [note(52, 4)]] },
      ]),
      () => undefined,
    );
    const compiled = compilePiece({ abc, meta: meta(['RH', 'LH']) });
    expect(compiled.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(compiled.chart!.tracks.map((t) => [t.id, t.hand, t.clef])).toEqual([['rh', 'RH', 'treble'], ['lh', 'LH', 'bass']]);
    expect(compiled.chart!.notes.map((n) => [n.track, n.midi])).toEqual([['rh', 60], ['lh', 48], ['rh', 64], ['lh', 52]]);
  });
});
