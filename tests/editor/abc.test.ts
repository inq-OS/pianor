// Covers ft_1_02a.AC2, ft_1_02a.AC7, ft_1_02a.AC8. ft_1_02d.AC1, core_09.AC35, core_09.AC55.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { abcPitch } from '../../src/core/chart/pitch';
import { cleanTitle, toAbc, toMeta } from '../../src/core/editor/abc';
import { toChart } from '../../src/core/editor/chart';
import { setGrace } from '../../src/core/editor/graces';
import { toggleTie } from '../../src/core/editor/ties';
import { EDITOR_LENGTHS, emptyPiece, setBpm, setFinger, LENGTH_TICKS, type Edit, midiOf, placeNote, placeRest, restLengthFor, type EditorLength, type EditorNote, type EditorPiece } from '../../src/core/editor/model';
import { layoutStaff } from '../../src/core/layout/staff';
import { checkPiece } from '../../src/core/piece/check';
import { parseLevels } from '../../src/core/piece/levelsTable';
import { contentStyles } from '../../tools/piece/styles';

const { levels } = parseLevels(readFileSync(join(__dirname, '../../content/curriculum/levels.json'), 'utf-8'));
const meta = (piece: EditorPiece, level = 3) => JSON.stringify(toMeta(piece, { id: 'own-test', level, author: 'Mia' }));
const check = (piece: EditorPiece, level = 3) => checkPiece({ styles: contentStyles, folder: null, abc: toAbc(piece), meta: meta(piece, level), levels });
const ok = (edit: Edit): EditorPiece => {
  if (!edit.ok) throw new Error(`refused: ${edit.reason}`);
  return edit.piece;
};

function build(piece: EditorPiece, notes: Partial<EditorNote>[]): EditorPiece {
  let p = piece;
  for (const n of notes) {
    const edit = placeNote(p, { hand: 'RH', bar: 0, start: 0, length: 'quarter', step: 'C', octave: 4, ...n });
    if (!edit.ok) throw new Error(edit.reason);
    p = edit.piece;
  }
  return p;
}

describe('ABC from the editor', () => {
  it('names keys the ABC way: C is middle C, commas down, apostrophes up', () => {
    expect([abcPitch('C', 4), abcPitch('C', 5), abcPitch('C', 6), abcPitch('G', 3), abcPitch('C', 2)]).toEqual(['C', 'c', "c'", 'G,', 'C,,']);
  });

  it('keeps a title on one line without the comment sign, and never empty', () => {
    expect(cleanTitle('  Rain %on\nthe window ')).toBe('Rain on the window');
    expect(cleanTitle('   ')).toBe('My piece');
  });

  it('compiles and lints exactly like the same piece written by hand', () => {
    // C D E F | G2 F2 (as half notes) | rest for a bar
    const piece = build(emptyPiece({ title: 'Little Climb', hands: 'RH', beats: 4, bars: 3 }), [
      { start: 0, step: 'C' }, { start: 480, step: 'D' }, { start: 960, step: 'E' }, { start: 1440, step: 'F' },
      { bar: 1, start: 0, step: 'G', length: 'half' }, { bar: 1, start: 960, step: 'F', length: 'half' },
    ]);
    const byHand = 'X:1\nT:Little Climb\nM:4/4\nL:1/4\nQ:1/4=80\nK:C\nV:RH clef=treble\nV:RH\nC D E F | G2 F2 | Z |]\n';
    const fromEditor = check(piece);
    const written = checkPiece({ styles: contentStyles, folder: null, abc: byHand, meta: meta(piece), levels });
    expect(fromEditor.compiled.chart).toEqual(written.compiled.chart);
    expect(fromEditor.diagnostics.map((d) => [d.severity, d.message])).toEqual(written.diagnostics.map((d) => [d.severity, d.message]));
    expect(fromEditor.fitsLevels).toEqual(written.fitsLevels);
  });

  it('writes both hands as two voices on their clefs, with whole-bar rests for a resting hand', () => {
    let piece = emptyPiece({ title: 'Two', hands: 'both', beats: 3, bars: 2 });
    piece = build(piece, [{ start: 0, length: 'half' }, { hand: 'LH', bar: 1, start: 0, length: 'quarter', step: 'C', octave: 3 }]);
    const abc = toAbc(piece);
    expect(abc).toContain('M:3/4');
    expect(abc).toContain('V:RH clef=treble\nV:LH clef=bass');
    expect(abc).toContain('V:RH\nC4 z2 | Z |]');
    expect(abc).toContain('V:LH\nZ | C,2 z2 z2 |]'); // in 3/4 a rest from beat 2 is two quarter rests (a half rest starts on beat 1 or 3)
    const result = check(piece, 4);
    expect(result.compiled.chart?.tracks.map((t) => [t.id, t.clef])).toEqual([['rh', 'treble'], ['lh', 'bass']]);
  });

  it('makes the meta of an own piece: approved by the person who saved it, playable from level 1, licence NaN', () => {
    const m = toMeta(emptyPiece({ title: 'Mine', hands: 'LH', beats: 4, bars: 2 }), { id: 'own-mine', level: 2, author: 'Mia' });
    expect(m).toMatchObject({ id: 'own-mine', title: 'Mine', level: 2, unlockLevel: 1, status: 'approved', hands: ['LH'], license: 'NaN', source: 'written in Pianor by Mia', generator: { kind: 'editor' } });
    expect(toMeta(emptyPiece({ title: 'Mine', hands: 'LH', beats: 4, bars: 2 }), { id: 'own-mine', level: 2, author: '  ' }).source).toBe('written in Pianor by a player');
  });

  it('any piece the editor can make compiles, and its chart has exactly the editor\'s notes, ties and pre-notes (property) (core_09.AC35, core_09.AC55)', () => {
    const lengths: readonly EditorLength[] = EDITOR_LENGTHS;
    const steps = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
    fc.assert(fc.property(
      fc.constantFrom<2 | 3 | 4>(2, 3, 4), fc.constantFrom('RH' as const, 'LH' as const, 'both' as const),
      fc.array(fc.record({ hand: fc.constantFrom('RH' as const, 'LH' as const), bar: fc.integer({ min: 0, max: 2 }), slot: fc.integer({ min: 0, max: 15 }), length: fc.constantFrom(...lengths), pitch: fc.integer({ min: 0, max: 27 }), rest: fc.integer({ min: 0, max: 4 }),
        // a pre-note on the note just placed (d121): this many steps away (0 is none), with its own accidental and slash; then perhaps a tie
        grace: fc.integer({ min: -3, max: 3 }), graceAlter: fc.constantFrom<-1 | 0 | 1>(-1, 0, 1), slash: fc.boolean(), tie: fc.boolean() }), { maxLength: 24 }),
      (beats, hands, wanted) => {
        let piece = emptyPiece({ title: 'Random', hands, beats, bars: 3 });
        for (const w of wanted) {
          // one in five is a rest the author placed
          const edit = w.rest === 0
            ? placeRest(piece, { hand: w.hand, bar: w.bar, start: w.slot * 120, length: restLengthFor(w.length) })
            : placeNote(piece, { hand: w.hand, bar: w.bar, start: w.slot * 120, length: w.length, step: steps[w.pitch % 7]!, octave: 2 + Math.floor(w.pitch / 7) });
          if (edit.ok) piece = edit.piece;
          if (!edit.ok || w.rest === 0) continue;
          const ref = { hand: w.hand, bar: w.bar, start: w.slot * 120, step: steps[w.pitch % 7]!, octave: 2 + Math.floor(w.pitch / 7) };
          if (w.grace !== 0) {
            const g = w.pitch + w.grace;
            const graced = setGrace(piece, ref, { step: steps[((g % 7) + 7) % 7]!, octave: 2 + Math.floor(g / 7), alter: w.graceAlter, slash: w.slash });
            if (graced.ok) piece = graced.piece;
          }
          // a tie into the note before it, when there is one of the same pitch: a pre-note may now sit on a tie's second note
          if (w.tie) {
            const before = piece.notes.find((n) => n.hand === w.hand && n.step === ref.step && n.octave === ref.octave && n.bar * beats * 480 + n.start + LENGTH_TICKS[n.length] === w.bar * beats * 480 + ref.start);
            const tied = before ? toggleTie(piece, before) : null;
            if (tied?.ok) piece = tied.piece;
          }
        }
        const result = check(piece, 5);
        if (piece.notes.length === 0) {
          // the compiler refuses a piece with no notes, so the editor asks for notes before saving
          expect(result.compiled.diagnostics.map((d) => d.message)).toContain('the piece has no notes');
          return;
        }
        expect(result.compiled.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
        const chart = result.compiled.chart!;
        const bar = beats * 480;
        const expected = piece.notes.map((n) => ({ track: n.hand.toLowerCase(), tick: n.bar * bar + n.start, dur: LENGTH_TICKS[n.length], midi: midiOf(n.step, n.octave) }))
          .sort((a, b) => a.track.localeCompare(b.track) || a.tick - b.tick || a.midi - b.midi);
        const actual = chart.notes.map((n) => ({ track: n.track, tick: n.tick, dur: n.dur, midi: n.midi })).sort((a, b) => a.track.localeCompare(b.track) || a.tick - b.tick || a.midi - b.midi);
        expect(actual).toEqual(expected);
        expect(chart.bars).toHaveLength(3);
        // the chart the editor draws while writing is exactly the chart the game will play, its graces included (core_09.AC35)
        expect(toChart(piece, { id: 'own-test', level: 5 })).toEqual(chart);
      },
    ), { numRuns: 300 });
  });
});

describe('the chart the editor draws', () => {
  it('a chord with one head whose target is gone is not tied, in the chart or the ABC', () => {
    const base = emptyPiece({ title: 'Chord tie', hands: 'RH', beats: 4, bars: 2 });
    const h = (step: 'E' | 'C', start: number, tieNext: boolean) => ({ hand: 'RH' as const, bar: 0, start, length: 'quarter' as const, step, octave: 4, alter: 0 as const, ...(tieNext ? { tieNext } : {}) });
    // a chord of E and C tied to the next E and C, then the C's target is gone: only the E is left after the chord
    const partial = { ...base, notes: [h('E', 0, true), h('C', 0, true), h('E', 480, false)] };
    const chart = toChart(partial, { id: 'own-chord' });
    expect(chart.notes.map((n) => n.tieNext ?? false)).toEqual([false, false, false]);
    expect(toAbc(partial)).not.toContain('-');
    // the whole chord tied to a whole target chord: every head carries the tie
    const whole = { ...base, notes: [h('E', 0, true), h('C', 0, true), h('E', 480, false), h('C', 480, false)] };
    expect(toChart(whole, { id: 'own-chord' }).notes.map((n) => n.tieNext ?? false)).toEqual([true, true, false, false]);
    expect(toAbc(whole)).toContain('-');
    // the chart the editor draws equals the chart the compiler makes, for the tied and the partly tied chord
    for (const piece of [whole, partial]) {
      const compiled = check(piece, 5);
      expect(compiled.compiled.chart).toEqual(toChart(piece, { id: 'own-test', level: 5 }));
    }
  });

  it('shows a tie the ABC writes, and not one whose target is gone', () => {
    const base = emptyPiece({ title: 'Tie', hands: 'RH', beats: 4, bars: 2 });
    const e = (start: number, tieNext?: boolean) => ({ hand: 'RH' as const, bar: 0, start, length: 'quarter' as const, step: 'E' as const, octave: 4, alter: 0 as const, ...(tieNext ? { tieNext } : {}) });
    const tied = toChart({ ...base, notes: [e(0, true), e(480)] }, { id: 'own-tie' });
    expect(tied.notes.map((n) => n.tieNext ?? false)).toEqual([true, false]);
    const stale = toChart({ ...base, notes: [e(0, true), e(960)] }, { id: 'own-tie' });
    expect(stale.notes.map((n) => n.tieNext ?? false)).toEqual([false, false]);
  });

  it('exists for an empty piece too (whole-bar rests on every hand), which the compiler would refuse', () => {
    const chart = toChart(emptyPiece({ title: 'Empty', hands: 'both', beats: 3, bars: 2 }), { id: 'own-empty' });
    expect(chart.notes).toEqual([]);
    expect(chart.rests.map((r) => [r.track, r.bar, r.dur])).toEqual([['rh', 0, 1440], ['lh', 0, 1440], ['rh', 1, 1440], ['lh', 1, 1440]]);
    expect(chart.tracks.map((t) => [t.id, t.clef])).toEqual([['rh', 'treble'], ['lh', 'bass']]);
  });
});

describe('the dotted half (ft_1_02d.AC1)', () => {
  it('is written as 6 eighths, compiles to 1440 ticks in 3/4 and is drawn with a dot', () => {
    const piece = build(emptyPiece({ title: 'Waltz', hands: 'RH', beats: 3, bars: 2 }), [{ length: 'dottedHalf' }, { bar: 1, length: 'dottedHalf', step: 'E' }]);
    expect(toAbc(piece)).toContain('C6');
    const result = check(piece, 5);
    expect(result.compiled.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const chart = result.compiled.chart!;
    expect(chart.notes.map((n) => n.dur)).toEqual([1440, 1440]);
    const layout = layoutStaff(chart, { viewport: { width: 1280, height: 720 } });
    expect(layout.notes.map((n) => [n.value, n.dot !== null])).toEqual([['half', true], ['half', true]]);
  });
});

describe('chords (ft_1_02a.AC7)', () => {
  const chordPiece = () => build(emptyPiece({ title: 'Chords', hands: 'both', beats: 4, bars: 2 }), [
    { step: 'G', length: 'half' }, { step: 'C', length: 'half' }, { step: 'E', length: 'half' },
    { start: 960, step: 'D', length: 'half' },
    { hand: 'LH', octave: 3, step: 'C', length: 'whole' }, { hand: 'LH', octave: 2, step: 'G', length: 'whole' },
  ]);

  it('is written as an ABC chord, lowest pitch first, and compiles to one chart note per pitch (ft_1_02a.AC7)', () => {
    const piece = chordPiece();
    expect(toAbc(piece)).toContain('V:RH\n[CEG]4 D4 | Z |]');
    expect(toAbc(piece)).toContain('V:LH\n[G,,C,]8 | Z |]');
    const result = check(piece, 5);
    expect(result.compiled.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const chart = result.compiled.chart!;
    expect(chart.notes.map((n) => [n.track, n.tick, n.dur, n.midi])).toEqual(
      toChart(piece, { id: 'own-test', level: 5 }).notes.map((n) => [n.track, n.tick, n.dur, n.midi]),
    );
    expect(toChart(piece, { id: 'own-test', level: 5 })).toEqual(chart);
  });

  it('round-trips: the notes the compiler reads back are exactly the editor piece\'s notes (ft_1_02a.AC7)', () => {
    const piece = chordPiece();
    const chart = check(piece, 5).compiled.chart!;
    const back = chart.notes.map((n) => ({ hand: n.track.toUpperCase(), bar: n.bar, start: n.tick - chart.bars[n.bar]!.startTick, length: n.dur, step: n.spelling.step, octave: n.spelling.octave }));
    const expected = piece.notes.map((n) => ({ hand: n.hand, bar: n.bar, start: n.start, length: LENGTH_TICKS[n.length], step: n.step, octave: n.octave }));
    const key = (n: { hand: string; bar: number; start: number; step: string; octave: number }) => `${n.hand}${n.bar}/${n.start}/${n.octave}${n.step}`;
    expect(back.map(key).sort()).toEqual(expected.map(key).sort());
    expect(back.map((n) => n.length).sort()).toEqual(expected.map((n) => n.length).sort());
  });

  it('chord-free pieces are written exactly as before (ft_1_02a.AC8)', () => {
    const piece = build(emptyPiece({ title: 'Plain', hands: 'RH', beats: 4, bars: 1 }), [{ start: 0 }, { start: 480, step: 'D' }]);
    expect(toAbc(piece)).toContain('V:RH\nC2 D2 z4 |]');
  });
});

describe('the BPM of an own piece (ft_1_02d.AC5)', () => {
  const base = () => build(emptyPiece({ title: 'Tempo', hands: 'RH', beats: 4, bars: 2 }), [{ length: 'whole' }, { bar: 1, length: 'whole', step: 'D' }]);

  it('own piece keeps its BPM through ABC and chart', () => {
    for (const bpm of [30, 66, 80, 135, 200]) {
      const piece = setBpm(base(), bpm);
      expect(toAbc(piece)).toContain(`Q:1/4=${bpm}\n`);
      const compiled = check(piece, 5).compiled;
      expect(compiled.chart!.tempoMap).toEqual([{ tick: 0, bpm }]);
      expect(toChart(piece, { id: 'own-test', level: 5 })).toEqual(compiled.chart);
    }
  });

  it('a piece with no BPM plays at 80, as before', () => {
    const piece = base();
    expect(piece.bpm).toBeUndefined();
    expect(toAbc(piece)).toContain('Q:1/4=80\n');
    expect(toChart(piece, { id: 'own-test' }).tempoMap).toEqual([{ tick: 0, bpm: 80 }]);
  });
});

describe('fingers from the editor (ft_1_02d.AC4)', () => {
  it('writes the finger as !n! before its note, and the chart carries it', () => {
    const base = build(emptyPiece({ title: 'Finger', hands: 'RH', beats: 4, bars: 2 }), [{ start: 0, step: 'C' }, { start: 480, step: 'D' }]);
    const fingered = ok(setFinger(base, { hand: 'RH', bar: 0, start: 0, step: 'C', octave: 4 }, 1));
    expect(toAbc(fingered)).toContain('!1!C2 D2');
    expect(toChart(fingered, { id: 'own-finger' }).notes.map((n) => n.finger)).toEqual([1, undefined]);
  });

  it('writes a fingering before each head of a chord, inside the brackets, and the file round trip keeps it', () => {
    const base = build(emptyPiece({ title: 'Chord finger', hands: 'RH', beats: 4, bars: 4 }), [{ start: 0, step: 'C' }, { start: 0, step: 'E' }]);
    const fingered = ok(setFinger(ok(setFinger(base, { hand: 'RH', bar: 0, start: 0, step: 'C', octave: 4 }, 1)), { hand: 'RH', bar: 0, start: 0, step: 'E', octave: 4 }, 3));
    expect(toAbc(fingered)).toContain('[!1!C!3!E]2');
    const compiled = check(fingered, 5);
    // the level's chord rule may flag the chord; the test is about the fingers, which the compiled chart must carry
    expect(compiled.compiled.chart).toEqual(toChart(fingered, { id: 'own-test', level: 5 }));
    expect(compiled.compiled.chart?.notes.map((n) => n.finger)).toEqual([1, 3]);
  });
});
