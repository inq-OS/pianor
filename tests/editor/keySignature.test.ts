// Covers core_09.AC8: the key and the accidentals of an editor piece are written into its ABC and read back by the compiler.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { midiOf, emptyPiece, placeNote, type EditorPiece, type EditorNote } from '../../src/core/editor/model';
import { toAbc, toMeta } from '../../src/core/editor/abc';
import { toChart } from '../../src/core/editor/chart';
import { checkPiece } from '../../src/core/piece/check';
import { parseLevels } from '../../src/core/piece/levelsTable';
import { contentStyles } from '../../tools/piece/styles';

const { levels } = parseLevels(readFileSync(join(__dirname, '../../content/curriculum/levels.json'), 'utf-8'));

function compile(piece: EditorPiece) {
  const result = checkPiece({ styles: contentStyles, folder: null, abc: toAbc(piece), meta: JSON.stringify(toMeta(piece, { id: 'own-k', level: 5, author: 'T' })), levels });
  if (!result.compiled.chart) throw new Error(result.diagnostics.map((d) => d.message).join('; '));
  return result.compiled.chart;
}

const withNotes = (piece: EditorPiece, notes: Partial<EditorNote>[]): EditorPiece => {
  let p = piece;
  for (const n of notes) {
    const edit = placeNote(p, { hand: 'RH', bar: 0, start: 0, length: 'quarter', step: 'C', octave: 4, ...n });
    if (!edit.ok) throw new Error(edit.reason);
    p = edit.piece;
  }
  return p;
};

describe('the key and accidentals in ABC (core_09.AC8)', () => {
  it('writes K: with the key, and a sharp, flat or natural only where a note differs from the key', () => {
    const piece = withNotes({ ...emptyPiece({ title: 'G', hands: 'RH', beats: 4, bars: 1 }), fifths: 1 }, [
      { step: 'F', octave: 4, alter: 1, start: 0 }, // F sharp is the key's own: nothing written
      { step: 'F', octave: 4, alter: 0, start: 480 }, // a natural F: =
      { step: 'C', octave: 5, alter: 1, start: 960 }, // C sharp is not in G: ^
    ]);
    expect(toAbc(piece)).toContain('K:G\n');
    expect(toAbc(piece)).toContain('V:RH\nF2 =F2 ^c2 z2 |]\n');
  });

  it('a natural or a sharp holds for its pitch to the bar line, so a later note with the key\'s alter needs its own mark', () => {
    // in G (F sharp): =F and then F sharp: the second F must be written ^ again, or the compiler reads it as a natural
    const piece = withNotes({ ...emptyPiece({ title: 'G', hands: 'RH', beats: 4, bars: 2 }), fifths: 1 }, [
      { step: 'F', octave: 4, alter: 0, start: 0 },
      { step: 'F', octave: 4, alter: 1, start: 480 },
      { step: 'F', octave: 4, alter: 1, bar: 1, start: 0 }, // a new bar: the key gives F sharp again, nothing written
    ]);
    expect(toAbc(piece)).toContain('V:RH\n=F2 ^F2 z4 | F2 z2 z4 |]\n');
    const chart = compile(piece);
    expect(chart.notes.map((n) => [n.midi, n.spelling.alter])).toEqual([[65, 0], [66, 1], [66, 1]]);
  });

  it('gives the chart the key of the piece and the spelling and sounding pitch of every note', () => {
    const piece = withNotes({ ...emptyPiece({ title: 'Gm', hands: 'RH', beats: 4, bars: 1 }), fifths: -2, mode: 'minor' }, [
      { step: 'B', octave: 4, alter: -1, start: 0 },
      { step: 'B', octave: 4, alter: 0, start: 480 },
      { step: 'E', octave: 4, alter: 0, start: 960 },
    ]);
    expect(toAbc(piece)).toContain('K:Gm\n');
    const chart = compile(piece);
    expect(chart.keyMap).toEqual([{ tick: 0, fifths: -2, mode: 'minor' }]);
    expect(chart.notes.map((n) => [n.midi, n.spelling.step, n.spelling.alter])).toEqual([[70, 'B', -1], [71, 'B', 0], [64, 'E', 0]]);
  });

  it('the chart the compiler makes is the chart the editor draws, for any key and any accidentals (property)', () => {
    const piece = fc.record({
      fifths: fc.integer({ min: -7, max: 7 }),
      mode: fc.constantFrom('major' as const, 'minor' as const),
      placements: fc.array(fc.record({
        bar: fc.integer({ min: 0, max: 1 }), slot: fc.integer({ min: 0, max: 7 }),
        alter: fc.constantFrom(-1 as const, 0 as const, 1 as const),
        step: fc.constantFrom('C' as const, 'D' as const, 'E' as const, 'F' as const, 'G' as const, 'A' as const, 'B' as const),
        octave: fc.integer({ min: 3, max: 5 }),
      }), { maxLength: 12 }),
    }).map(({ fifths, mode, placements }) => {
      let p: EditorPiece = { ...emptyPiece({ title: 'Key', hands: 'RH', beats: 4, bars: 2 }), fifths, mode };
      for (const q of placements) {
        const edit = placeNote(p, { hand: 'RH', bar: q.bar, start: q.slot * 240, length: 'eighth', step: q.step, octave: q.octave, alter: q.alter });
        if (edit.ok) p = edit.piece;
      }
      return p;
    });
    fc.assert(fc.property(piece.filter((p) => p.notes.length > 0), (p) => {
      const compiled = compile(p);
      const drawn = toChart(p, { id: 'own-k' });
      expect(compiled.keyMap).toEqual(drawn.keyMap);
      const shape = (c: typeof drawn) => c.notes.map((n) => [n.tick, n.midi, n.spelling.step, n.spelling.alter, n.spelling.octave]);
      expect(shape(compiled)).toEqual(shape(drawn));
      for (const n of p.notes) expect(drawn.notes.some((c) => c.midi === midiOf(n.step, n.octave) + n.alter)).toBe(true);
    }), { numRuns: 150 });
  });
});
