// Covers core_09.AC30 (d120: slurs in the editor, the piece file, bar copy and paste, the ABC text and the chart).
import { compilePiece } from '../piece/compile';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import v2 from '../../../tests/fixtures/pieceFiles/piece-file.v2.json';
import { PPQ } from '../chart/time';
import { toAbc, toMeta } from './abc';
import { clearBars, copyBars, cutBars, insertBars, replaceBars } from './bars';
import { toChart } from './chart';
import { emptyPiece, pieceProblem, removeNote, setBars, setPitch, type EditorHand, type EditorNote, type EditorPiece, type NoteRef } from './model';
import { exportPieceFile, importPieceFile, PIECE_FILE_VERSION } from './pieceFile';
import { removeSlur, slurInto, toggleSlur } from './slurs';
import { push, redo, startHistory, undo } from './history';
import { slursOf } from './slurRules';

const n = (hand: EditorHand, bar: number, start: number, step: EditorNote['step'], octave = 4, length: EditorNote['length'] = 'quarter'): EditorNote => ({
  hand, bar, start, length, step, octave, alter: 0,
});

function withNotes(notes: EditorNote[], extra: Partial<EditorPiece> = {}): EditorPiece {
  return { ...emptyPiece({ title: 'Slurs', hands: 'both', beats: 4, bars: 4 }), notes, ...extra };
}

/** Right hand: C D E F (bar 0, quarters), G A (bar 1). Left hand: a whole C3 in bar 0. */
function run(extra: Partial<EditorPiece> = {}): EditorPiece {
  return withNotes([
    n('RH', 0, 0, 'C'), n('RH', 0, 480, 'D'), n('RH', 0, 960, 'E'), n('RH', 0, 1440, 'F'),
    n('RH', 1, 0, 'G'), n('RH', 1, 480, 'A'),
    n('LH', 0, 0, 'C', 3, 'whole'),
  ], extra);
}

const at = (hand: EditorHand, bar: number, start: number, step: NoteRef['step'] = 'C', octave = 4): NoteRef => ({ hand, bar, start, step, octave });

const refOf = (note: EditorNote): NoteRef => ({ hand: note.hand, bar: note.bar, start: note.start, step: note.step, octave: note.octave });

/** The piece an edit makes, or the test fails with the refusal. */
function made(edit: { ok: true; piece: EditorPiece } | { ok: false; reason: string }): EditorPiece {
  if (!edit.ok) throw new Error(`refused: ${edit.reason}`);
  return edit.piece;
}

describe('slurs in the editor (core_09.AC30)', () => {
  describe('drawing and taking away', () => {
    it('core_09.AC30 draws a slur from the selected note to a later note of the same hand', () => {
      const r = slurInto(run(), at('RH', 0, 0), at('RH', 0, 480, 'D'));
      expect(r).toEqual({ ok: true, piece: expect.anything() });
      if (!r.ok) return;
      expect(r.piece.slurs).toEqual([{ hand: 'RH', from: { bar: 0, start: 0 }, to: { bar: 0, start: 480 } }]);
    });

    it('core_09.AC30 a slur may cross a bar line', () => {
      const r = made(slurInto(run(), at('RH', 0, 1440, 'F'), at('RH', 1, 0, 'G')));
      expect(r.slurs).toEqual([{ hand: 'RH', from: { bar: 0, start: 1440 }, to: { bar: 1, start: 0 } }]);
    });

    it('core_09.AC30 refuses a slur to a note of the other hand', () => {
      expect(slurInto(run(), at('RH', 0, 0), at('LH', 0, 0, 'C', 3))).toEqual({ ok: false, reason: 'slur-target' });
    });

    it('core_09.AC30 refuses a slur to an earlier note, and to the same onset (a chord)', () => {
      expect(slurInto(run(), at('RH', 0, 480, 'D'), at('RH', 0, 0))).toEqual({ ok: false, reason: 'slur-target' });
      const chord = run({ notes: [...run().notes, n('RH', 0, 0, 'G')] });
      expect(slurInto(chord, at('RH', 0, 0), at('RH', 0, 0, 'G'))).toEqual({ ok: false, reason: 'slur-target' });
    });

    it('core_09.AC30 refuses a slur that overlaps or nests another slur of the same hand, a shared note included', () => {
      const first = made(slurInto(run(), at('RH', 0, 0), at('RH', 0, 960, 'E')));
      expect(slurInto(first, at('RH', 0, 480, 'D'), at('RH', 0, 1440, 'F'))).toEqual({ ok: false, reason: 'slur-overlap' });
      expect(slurInto(first, at('RH', 0, 960, 'E'), at('RH', 0, 1440, 'F'))).toEqual({ ok: false, reason: 'slur-overlap' });
    });

    it('core_09.AC30 a slur drawn again from the same note moves its end (the old end is forgotten)', () => {
      const short = made(slurInto(run(), at('RH', 0, 0), at('RH', 0, 480, 'D')));
      const long = made(slurInto(short, at('RH', 0, 0), at('RH', 0, 960, 'E')));
      expect(long.slurs).toEqual([{ hand: 'RH', from: { bar: 0, start: 0 }, to: { bar: 0, start: 960 } }]);
    });

    it('core_09.AC30 refuses a slur that crosses a repeat sign', () => {
      const repeated = run({ repeats: [{ startBar: 1, endBar: 1 }] });
      expect(slurInto(repeated, at('RH', 0, 960, 'E'), at('RH', 1, 0, 'G'))).toEqual({ ok: false, reason: 'slur-repeat' });
    });

    it('core_09.AC30 toggleSlur slurs the selected note to the next note of its hand, skipping the other hand', () => {
      const r = made(toggleSlur(run(), at('RH', 0, 0)));
      expect(r.slurs).toEqual([{ hand: 'RH', from: { bar: 0, start: 0 }, to: { bar: 0, start: 480 } }]);
    });

    it('core_09.AC30 toggleSlur on a note inside a slur takes that slur away; a second press slurs again', () => {
      const on = made(toggleSlur(run(), at('RH', 0, 0)));
      const off = made(toggleSlur(on, at('RH', 0, 480, 'D')));
      expect(off.slurs).toBeUndefined();
      expect(made(toggleSlur(off, at('RH', 0, 0))).slurs).toHaveLength(1);
    });

    it('core_09.AC30 undo brings a slur back after it was taken away, and redo takes it away again', () => {
      let history = startHistory(run());
      history = push(history, made(toggleSlur(history.present, at('RH', 0, 0))));
      history = push(history, made(removeSlur(history.present, at('RH', 0, 480, 'D'))));
      expect(history.present.slurs).toBeUndefined();
      history = undo(history);
      expect(history.present.slurs).toHaveLength(1);
      history = redo(history);
      expect(history.present.slurs).toBeUndefined();
    });

    it('core_09.AC30 refuses toggleSlur on the last note of its hand, and removeSlur with no slur there', () => {
      expect(toggleSlur(run(), at('RH', 1, 480, 'A'))).toEqual({ ok: false, reason: 'slur-target' });
      expect(removeSlur(run(), at('RH', 0, 0))).toEqual({ ok: false, reason: 'slur-none' });
      expect(removeSlur(run(), at('RH', 0, 0, 'D'))).toEqual({ ok: false, reason: 'no-note' });
    });
  });

  describe('a slur whose notes go away (the rule: it shrinks to the notes that stay, and is dropped with fewer than two)', () => {
    const slurred = () => made(slurInto(run(), at('RH', 0, 0), at('RH', 0, 960, 'E')));

    it('core_09.AC30 losing the end note shrinks the slur to the last note that stays', () => {
      const r = made(removeNote(slurred(), at('RH', 0, 960, 'E')));
      expect(r.slurs).toEqual([{ hand: 'RH', from: { bar: 0, start: 0 }, to: { bar: 0, start: 480 } }]);
    });

    it('core_09.AC30 losing the start note shrinks the slur forward', () => {
      const r = made(removeNote(slurred(), at('RH', 0, 0)));
      expect(r.slurs).toEqual([{ hand: 'RH', from: { bar: 0, start: 480 }, to: { bar: 0, start: 960 } }]);
    });

    it('core_09.AC30 a slur left with one note is dropped', () => {
      const two = made(slurInto(run(), at('RH', 0, 0), at('RH', 0, 480, 'D')));
      expect(made(removeNote(two, at('RH', 0, 480, 'D'))).slurs).toBeUndefined();
    });

    it('core_09.AC30 fewer bars shrink a slur that reaches the bars that go, and drop one that is left with a note', () => {
      const reaching = made(slurInto(run(), at('RH', 0, 0), at('RH', 1, 480, 'A')));
      expect(setBars(reaching, 1).slurs).toEqual([{ hand: 'RH', from: { bar: 0, start: 0 }, to: { bar: 0, start: 1440 } }]);
      const lastBar = made(slurInto(run(), at('RH', 1, 0, 'G'), at('RH', 1, 480, 'A')));
      expect(setBars(lastBar, 1).slurs).toBeUndefined();
    });

    it('core_09.AC30 cut takes the bars out with the slur on their notes; the clip keeps it for a paste', () => {
      const cut = cutBars(slurred(), { from: 0, to: 0 });
      expect(cut.piece.slurs).toBeUndefined();
      expect(cut.clip.slurs).toEqual([{ hand: 'RH', from: { bar: 0, start: 0 }, to: { bar: 0, start: 960 } }]);
      expect(clearBars(slurred(), { from: 0, to: 0 }).slurs).toBeUndefined();
    });
  });

  describe('bars: copy, paste and insert', () => {
    it('core_09.AC30 copies a slur only when both its ends are in the copied bars, moved to start at bar 0', () => {
      const across = made(slurInto(run(), at('RH', 0, 1440, 'F'), at('RH', 1, 0, 'G')));
      expect(copyBars(across, { from: 0, to: 0 }).slurs).toBeUndefined();
      expect(copyBars(across, { from: 0, to: 1 }).slurs).toEqual([{ hand: 'RH', from: { bar: 0, start: 1440 }, to: { bar: 1, start: 0 } }]);
      expect(copyBars(across, { from: 1, to: 1 }).slurs).toBeUndefined();
      const inBarOne = made(slurInto(run(), at('RH', 1, 0, 'G'), at('RH', 1, 480, 'A')));
      expect(copyBars(inBarOne, { from: 1, to: 1 }).slurs).toEqual([{ hand: 'RH', from: { bar: 0, start: 0 }, to: { bar: 0, start: 480 } }]);
    });

    it('core_09.AC30 inserting bars before a slur moves the slur with its notes', () => {
      const s = made(slurInto(run(), at('RH', 0, 0), at('RH', 0, 480, 'D')));
      const r = made(insertBars(s, 0, copyBars(run(), { from: 1, to: 1 })));
      expect(r.slurs).toEqual([{ hand: 'RH', from: { bar: 1, start: 0 }, to: { bar: 1, start: 480 } }]);
    });

    it('core_09.AC30 inserting a clip brings its slur along', () => {
      const source = made(slurInto(run(), at('RH', 0, 0), at('RH', 0, 480, 'D')));
      const clip = copyBars(source, { from: 0, to: 0 });
      const r = made(insertBars(emptyPiece({ title: 'Empty', hands: 'both', beats: 4, bars: 4 }), 0, clip));
      expect(r.slurs).toEqual([{ hand: 'RH', from: { bar: 0, start: 0 }, to: { bar: 0, start: 480 } }]);
    });

    it('core_09.AC30 a pasted slur that would overlap a slur already there is dropped; the notes are still pasted', () => {
      const base = made(slurInto(run(), at('RH', 0, 1440, 'F'), at('RH', 1, 0, 'G')));
      const clipSource = made(slurInto(run(), at('RH', 1, 0, 'G'), at('RH', 1, 480, 'A')));
      const r = made(insertBars(base, 1, copyBars(clipSource, { from: 1, to: 1 })));
      expect(r.notes.filter((x) => x.hand === 'RH')).toHaveLength(8);
      expect(r.slurs).toEqual([{ hand: 'RH', from: { bar: 0, start: 1440 }, to: { bar: 2, start: 0 } }]);
    });

    it('core_09.AC30 pasting over bars drops a slur that lived only in them and keeps the piece length', () => {
      const s = made(slurInto(run(), at('RH', 0, 0), at('RH', 0, 480, 'D')));
      const clip = copyBars(run(), { from: 1, to: 1 });
      const r = made(replaceBars(s, { from: 0, to: 0 }, clip));
      expect(r.bars).toBe(4);
      expect(r.slurs).toBeUndefined();
    });
  });

  describe('output: the ABC text and the chart', () => {
    it('core_09.AC30 writes ( before the first note and ) after the last note of a slur', () => {
      const text = toAbc(made(slurInto(run(), at('RH', 0, 0), at('RH', 0, 480, 'D'))));
      expect(text).toContain('(C2 D2)');
    });

    it('core_09.AC30 a slur across a bar line is written across the bar line', () => {
      const text = toAbc(made(slurInto(run(), at('RH', 0, 1440, 'F'), at('RH', 1, 0, 'G'))));
      expect(text).toContain('(F2');
      expect(text).toContain('G2)');
    });

    it('core_09.AC30 the editor chart carries the slur from its first onset to its last, in its hand', () => {
      const s = made(slurInto(run(), at('RH', 0, 1440, 'F'), at('RH', 1, 0, 'G')));
      expect(toChart(s, { id: 'own-slur' }).slurs).toEqual([{ track: 'rh', voice: 1, startTick: 1440, endTick: 1920 }]);
      expect(toChart(run(), { id: 'own-slur' }).slurs).toBeUndefined();
    });

    it('core_09.AC30 the chart the ABC compiler makes of the editor ABC has the same slurs', () => {
      for (const s of [
        made(slurInto(run(), at('RH', 0, 1440, 'F'), at('RH', 1, 0, 'G'))),
        made(slurInto(run(), at('RH', 0, 0), at('RH', 0, 480, 'D'))),
      ]) {
        const compiled = compilePiece({ abc: toAbc(s), meta: JSON.stringify(toMeta(s, { id: 'own-slur', level: 1, author: 'A' })) });
        expect(compiled.chart?.slurs).toEqual(toChart(s, { id: 'own-slur' }).slurs);
      }
    });
  });

  describe('the piece file', () => {
    it('core_09.AC30 a piece with slurs is saved and read back with them', () => {
      const p = made(slurInto(run(), at('RH', 0, 1440, 'F'), at('RH', 1, 0, 'G')));
      const id = 'own-slur';
      const text = exportPieceFile({ id, author: 'Mia', contentVersion: 1, piece: p, abc: toAbc(p), meta: JSON.stringify(toMeta(p, { id, level: 1, author: 'Mia' }), null, 2) });
      expect(JSON.parse(text).piece.slurs).toEqual(p.slurs);
      const back = importPieceFile(text);
      expect(back.ok && back.file.piece.slurs).toEqual(p.slurs);
    });

    it('core_09.AC30 a piece file saved before slurs opens unchanged, and is saved again without a slurs field and at the same version', () => {
      const text = JSON.stringify(v2);
      const read = importPieceFile(text);
      expect(read.ok).toBe(true);
      if (!read.ok) return;
      expect('slurs' in read.file.piece).toBe(false);
      expect(read.file.piece).toEqual(v2.piece);
      const again = JSON.parse(exportPieceFile(read.file));
      expect('slurs' in again.piece).toBe(false);
      expect(again.schemaVersion).toBe(PIECE_FILE_VERSION);
      expect(PIECE_FILE_VERSION).toBe(3);
    });

    it('core_09.AC30 refuses a piece file whose slur has no note at one end', () => {
      const p = { ...run(), slurs: [{ hand: 'RH' as const, from: { bar: 0, start: 240 }, to: { bar: 0, start: 480 } }] };
      expect(pieceProblem(p)).toBe('slur-target');
      expect(pieceProblem(made(slurInto(run(), at('RH', 0, 0), at('RH', 0, 480, 'D'))))).toBeNull();
    });
  });

  describe('property: random edits keep every slur on notes of its hand, one per stretch, and the chart matches', () => {
    type Kind = 'toggle' | 'into' | 'remove' | 'bars' | 'cut' | 'paste' | 'insert';
    const step = fc.record({
      kind: fc.constantFrom<Kind>('toggle', 'into', 'remove', 'bars', 'cut', 'paste', 'insert'),
      i: fc.nat({ max: 40 }),
      j: fc.nat({ max: 40 }),
    });

    /** One random edit: a refused one leaves the piece as it was. */
    function apply(piece: EditorPiece, s: { kind: Kind; i: number; j: number }): EditorPiece {
      if (piece.notes.length === 0) return piece;
      const a = refOf(piece.notes[s.i % piece.notes.length]!);
      const b = refOf(piece.notes[s.j % piece.notes.length]!);
      const bar = s.i % piece.bars;
      const other = s.j % piece.bars;
      const keep = (edit: { ok: true; piece: EditorPiece } | { ok: false; reason: string }) => (edit.ok ? edit.piece : piece);
      switch (s.kind) {
        case 'toggle': return keep(toggleSlur(piece, a));
        case 'into': return keep(slurInto(piece, a, b));
        case 'remove': return keep(removeNote(piece, a));
        case 'bars': return setBars(piece, 1 + (s.j % 4));
        case 'cut': return cutBars(piece, { from: bar, to: bar }).piece;
        case 'paste': return keep(replaceBars(piece, { from: bar, to: bar }, copyBars(piece, { from: other, to: other })));
        case 'insert': return keep(insertBars(piece, bar, copyBars(piece, { from: other, to: other })));
      }
    }

    function expectSound(p: EditorPiece) {
      const tick = (o: { bar: number; start: number }) => o.bar * p.beats * PPQ + o.start;
      for (const s of p.slurs ?? []) {
        expect(tick(s.to)).toBeGreaterThan(tick(s.from));
        expect(p.notes.some((x) => x.hand === s.hand && x.bar === s.from.bar && x.start === s.from.start)).toBe(true);
        expect(p.notes.some((x) => x.hand === s.hand && x.bar === s.to.bar && x.start === s.to.start)).toBe(true);
      }
      const all = p.slurs ?? [];
      for (const [x, a] of all.entries()) {
        for (const b of all.slice(x + 1)) {
          if (a.hand !== b.hand) continue;
          expect(tick(a.from) <= tick(b.to) && tick(b.from) <= tick(a.to)).toBe(false);
        }
      }
      expect(pieceProblem(p)).toBeNull();
    }

    it('core_09.AC30 every stored slur stays sound, and the ABC and the chart show the written ones (property)', () => {
      fc.assert(fc.property(fc.array(step, { maxLength: 25 }), (steps) => {
        let piece = run();
        for (const s of steps) {
          piece = apply(piece, s);
          expectSound(piece);
        }
        const written = slursOf(piece);
        expect(toChart(piece, { id: 'own-prop' }).slurs?.length ?? 0).toBe(written.length);
        expect((toAbc(piece).match(/\(/g) ?? []).length).toBe(written.length);
        expect((toAbc(piece).match(/\)/g) ?? []).length).toBe(written.length);
      }), { numRuns: 300 });
    });
  });
});

describe('slurs over one pitch (core_09.AC30)', () => {
  it('core_09.AC30 a slur over notes of one pitch is refused (it is a tie), so the ABC always compiles', () => {
    const p = made(slurInto(run(), at('RH', 0, 0), at('RH', 0, 480, 'D')));
    expect(p.slurs).toHaveLength(1);
    const same = { ...run(), notes: run().notes.map((n) => (n.hand === 'RH' && n.bar === 0 ? { ...n, step: 'C' as const, octave: 4, alter: 0 as const } : n)) };
    const r = slurInto(same, at('RH', 0, 0), at('RH', 0, 480, 'C'));
    expect(r.ok).toBe(false);
    expect(toAbc(same)).not.toContain('(');
  });
});

describe('a pitch edit under a slur (core_09.AC30)', () => {
  it('core_09.AC30 turning a slur into one pitch keeps the piece valid and savable; the slur is just not written', () => {
    const p = made(slurInto(run(), at('RH', 0, 0), at('RH', 0, 480, 'D')));
    const c = made(setPitch(p, at('RH', 0, 480, 'D'), 'C', 4));
    expect(pieceProblem(c)).toBeNull();
    expect(toAbc(c)).not.toContain('(');
    const id = 'own-slur';
    const text = exportPieceFile({ id, author: 'Mia', contentVersion: 1, piece: c, abc: toAbc(c), meta: JSON.stringify(toMeta(c, { id, level: 1, author: 'Mia' }), null, 2) });
    expect(importPieceFile(text).ok).toBe(true);
  });
});

describe('a stored slur that is not drawn (core_09.AC30)', () => {
  it('core_09.AC30 a slur the staff does not show does not block a new one', () => {
    const p = made(slurInto(run(), at('RH', 0, 0), at('RH', 0, 480, 'D')));
    const c = made(setPitch(p, at('RH', 0, 480, 'D'), 'C', 4));
    expect(slursOf(c)).toHaveLength(0);
    const r = slurInto(c, at('RH', 0, 0), at('RH', 0, 960, 'E'));
    expect(r.ok).toBe(true);
  });
});
