// Covers ft_1_02b.AC1, ft_1_02b.AC2, core_09.AC36.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import v1 from '../../../tests/fixtures/pieceFiles/piece-file.v1.json';
import v2 from '../../../tests/fixtures/pieceFiles/piece-file.v2.json';
import { t } from '../text/strings';
import { toAbc, toMeta } from './abc';
import { bpmOf, emptyPiece, placeNote, setBpm, type EditorLength, type EditorPiece } from './model';

const ok = (edit: ReturnType<typeof placeNote>): EditorPiece => {
  if (!edit.ok) throw new Error(`refused: ${edit.reason}`);
  return edit.piece;
};
import { setGrace } from './graces';
import { exportPieceFile, importPieceFile, OWN_ID, pieceFileName, PIECE_FILE_VERSION, type PieceFile } from './pieceFile';

function fileOf(piece: EditorPiece, over: Partial<PieceFile> = {}): PieceFile {
  const id = over.id ?? 'own-test';
  const author = over.author ?? 'Mia';
  return { id, author, contentVersion: 1, piece, abc: toAbc(piece), meta: JSON.stringify(toMeta(piece, { id, level: 1, author }), null, 2), ...over };
}

const steps = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const;
const lengths: EditorLength[] = ['eighth', 'quarter', 'half', 'dottedHalf', 'whole'];

/** Any piece the editor can make: random placements on an empty piece, the refused ones skipped. */
const pieces: fc.Arbitrary<EditorPiece> = fc.record({
  title: fc.string({ maxLength: 60 }),
  hands: fc.constantFrom('RH' as const, 'LH' as const, 'both' as const),
  beats: fc.constantFrom(2 as const, 3 as const, 4 as const),
  bars: fc.integer({ min: 1, max: 8 }),
  placements: fc.array(
    fc.record({
      hand: fc.constantFrom('RH' as const, 'LH' as const), bar: fc.integer({ min: 0, max: 7 }), slot: fc.integer({ min: 0, max: 7 }),
      length: fc.constantFrom(...lengths), pitch: fc.integer({ min: 0, max: 20 }),
    }),
    { maxLength: 30 },
  ),
}).map(({ placements, ...options }) => {
  let piece = emptyPiece(options);
  for (const p of placements) {
    const edit = placeNote(piece, { hand: p.hand, bar: p.bar, start: p.slot * 240, length: p.length, step: steps[p.pitch % 7]!, octave: 3 + Math.floor(p.pitch / 7) });
    if (edit.ok) piece = edit.piece;
  }
  return piece;
});

/** A valid piece file's text with some fields replaced (the ABC and meta of a one-note piece). */
function exportLike(over: Record<string, unknown>): string {
  const piece = ok(placeNote(emptyPiece({ title: 'G', hands: 'RH', beats: 4, bars: 1 }), { hand: 'RH', bar: 0, start: 0, length: 'quarter', step: 'E', octave: 4 }));
  return JSON.stringify({ ...JSON.parse(exportPieceFile(fileOf(piece))), ...over });
}

describe('exporting and importing a piece file', () => {
  it('ft_1_02b.AC1 export then import gives the same piece: the editor piece, the ABC text and the meta text (property)', () => {
    fc.assert(fc.property(pieces, fc.string({ maxLength: 40 }), (piece, author) => {
      const file = fileOf(piece, { author });
      const result = importPieceFile(exportPieceFile(file));
      expect(result).toEqual({ ok: true, file });
      if (result.ok) {
        expect(result.file.abc).toBe(file.abc);
        expect(result.file.meta).toBe(file.meta);
        expect(JSON.parse(result.file.meta).license).toBe('NaN');
      }
    }), { numRuns: 100 });
  });

  it('writes a readable file that says what it is and which version it is', () => {
    const text = exportPieceFile(fileOf(emptyPiece({ title: 'Song', hands: 'RH', beats: 4, bars: 2 })));
    expect(text.endsWith('\n')).toBe(true);
    expect(JSON.parse(text)).toMatchObject({ kind: 'pianor-piece', schemaVersion: PIECE_FILE_VERSION, id: 'own-test' });
    expect(pieceFileName('own-song')).toBe('own-song.pianor-piece.json');
  });

  it('reads the committed version 1 file (synthetic fixture) as version 2: key C, every note natural (core_09.AC8)', () => {
    const text = JSON.stringify(v1, null, 2) + '\n';
    const result = importPieceFile(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.file.id).toBe('own-fixture-song');
    expect(result.file.piece.notes.length).toBeGreaterThan(0);
    expect(result.file.piece).toMatchObject({ fifths: 0, mode: 'major' });
    expect(result.file.piece.notes.every((n) => n.alter === 0)).toBe(true);
    // the ABC it was made with is still what the piece makes (the key C writes no accidental)
    expect(result.file.abc).toBe(toAbc(result.file.piece));
    expect(result.file.abc).toBe(v1.abc);
    // written again as the current version, with the same piece (core_09.AC13)
    expect(exportPieceFile(result.file)).toBe(JSON.stringify({ ...v2, schemaVersion: 3 }, null, 2) + '\n');
  });

  it('a dynamic mark is saved and reopened unchanged (core_09.AC16)', () => {
    const base = ok(placeNote(emptyPiece({ title: 'Dyn', hands: 'RH', beats: 4, bars: 2 }), { hand: 'RH', bar: 0, start: 0, length: 'quarter', step: 'C', octave: 4, alter: 0 }));
    const marked = { ...base, notes: base.notes.map((n) => ({ ...n, dynamic: 'mf' as const })) };
    const file = { id: 'own-dyn', author: 'Mia', contentVersion: 1, piece: marked, abc: toAbc(marked), meta: JSON.stringify(toMeta(marked, { id: 'own-dyn', level: 1, author: 'Mia' }), null, 2) };
    const result = importPieceFile(exportPieceFile(file));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.file.piece.notes[0]!.dynamic).toBe('mf');
  });

  it('a committed version 2 file reads as the same piece and is written again as version 3 (core_09.AC8, core_09.AC13)', () => {
    const text = JSON.stringify(v2, null, 2) + '\n';
    const result = importPieceFile(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(exportPieceFile(result.file)).toBe(JSON.stringify({ ...v2, schemaVersion: 3 }, null, 2) + '\n');
    expect(result.file.piece.notes.some((n) => n.tieNext)).toBe(false);
    // a file from before the BPM field has none, and plays at 80
    expect(result.file.piece.bpm).toBeUndefined();
    expect(bpmOf(result.file.piece)).toBe(80);
  });

  it('core_09.AC36 a pre-note survives export and import as an optional grace field, with no file version bump (d121)', () => {
    const base = ok(placeNote(emptyPiece({ title: 'Grace', hands: 'RH', beats: 4, bars: 2 }), { hand: 'RH', bar: 0, start: 0, length: 'quarter', step: 'E', octave: 4 }));
    const graced = ok(setGrace(base, { hand: 'RH', bar: 0, start: 0, step: 'E', octave: 4 }, { step: 'D', octave: 4, alter: 0, slash: true }));
    const text = exportPieceFile(fileOf(graced, { id: 'own-grace' }));
    expect(JSON.parse(text)).toMatchObject({ schemaVersion: 3, piece: { notes: [{ step: 'E', grace: { step: 'D', octave: 4, alter: 0, slash: true } }] } });
    expect(PIECE_FILE_VERSION).toBe(3);
    const result = importPieceFile(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.file.piece).toEqual(graced);
    expect(result.file.abc).toContain('{/D}E2');
    expect(toAbc(result.file.piece)).toBe(result.file.abc);
  });

  it('core_09.AC36 an own piece saved before pre-notes opens unchanged: no grace on any note, the same ABC, and a file without graces is written as before', () => {
    const result = importPieceFile(JSON.stringify(v2, null, 2) + '\n');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.file.piece.notes.every((n) => !('grace' in n))).toBe(true);
    expect(toAbc(result.file.piece)).toBe(v2.abc);
    expect(exportPieceFile(result.file)).not.toContain('grace');
  });

  it('core_09.AC36 a file whose grace has its note\'s own pitch, or lies outside the keyboard, is refused as invalid', () => {
    const graced = (grace: unknown) => exportLike({ piece: { title: 'G', hands: 'RH', beats: 4, bars: 1, fifths: 0, mode: 'major', notes: [{ hand: 'RH', bar: 0, start: 0, length: 'quarter', step: 'E', octave: 4, alter: 0, grace }] } });
    expect(importPieceFile(graced({ step: 'E', octave: 4, alter: 0, slash: true }))).toMatchObject({ ok: false, reason: 'invalid' });
    expect(importPieceFile(graced({ step: 'C', octave: 1, alter: 0, slash: true }))).toMatchObject({ ok: false, reason: 'invalid' });
    expect(importPieceFile(graced({ step: 'D', octave: 4, alter: 0 }))).toMatchObject({ ok: false, reason: 'invalid' });
    expect(importPieceFile(graced({ step: 'D', octave: 4, alter: 0, slash: false })).ok).toBe(true);
  });

  it('a BPM survives export and import, and an out-of-range one is refused', () => {
    const piece = setBpm(emptyPiece({ title: 'Song', hands: 'RH', beats: 4, bars: 2 }), 112);
    const text = exportPieceFile(fileOf(piece));
    const result = importPieceFile(text);
    expect(result.ok && result.file.piece.bpm).toBe(112);
    const bad = JSON.parse(text);
    bad.piece.bpm = 501;
    expect(importPieceFile(JSON.stringify(bad)).ok).toBe(false);
  });

  it('a piece at 500 BPM, the highest, survives export and import with no file version bump', () => {
    const piece = setBpm(emptyPiece({ title: 'Fast', hands: 'RH', beats: 4, bars: 2 }), 500);
    const text = exportPieceFile(fileOf(piece));
    expect(JSON.parse(text).schemaVersion).toBe(PIECE_FILE_VERSION);
    expect(PIECE_FILE_VERSION).toBe(3);
    const result = importPieceFile(text);
    expect(result.ok && result.file.piece.bpm).toBe(500);
  });
});

describe('a file that cannot be used is refused with a reason, never a throw', () => {
  const good = exportPieceFile(fileOf(emptyPiece({ title: 'Song', hands: 'RH', beats: 4, bars: 2 })));
  const edit = (patch: Record<string, unknown>) => JSON.stringify({ ...JSON.parse(good), ...patch });
  const refusal = (text: string, options?: Parameters<typeof importPieceFile>[1]) => {
    const r = importPieceFile(text, options);
    if (r.ok) throw new Error('expected a refusal');
    return r;
  };

  it('ft_1_02b.AC2 text that is not JSON, JSON that is not a piece file, and a file from a newer Pianor', () => {
    expect(refusal('{ nope')).toMatchObject({ reason: 'not-json', message: t('editor.import.not-json') });
    expect(refusal('')).toMatchObject({ reason: 'not-json' });
    for (const text of ['null', '42', '[]', '{}', JSON.stringify({ kind: 'something-else', schemaVersion: 1 })]) {
      expect(refusal(text), text).toMatchObject({ reason: 'not-a-piece-file' });
    }
    expect(refusal(edit({ schemaVersion: 0 }))).toMatchObject({ reason: 'not-a-piece-file' });
    expect(refusal(edit({ schemaVersion: 1.5 }))).toMatchObject({ reason: 'not-a-piece-file' });
    expect(refusal(edit({ schemaVersion: '1' }))).toMatchObject({ reason: 'not-a-piece-file' });
    const newer = refusal(edit({ schemaVersion: PIECE_FILE_VERSION + 1, somethingNew: true }));
    expect(newer).toMatchObject({ reason: 'newer-version', message: t('editor.import.newer-version') });
  });

  it('ft_1_02b.AC2 a piece file with damaged content', () => {
    expect(refusal(edit({ piece: { title: 'x' } })).reason).toBe('invalid');
    expect(refusal(edit({ abc: '' })).reason).toBe('invalid');
    expect(refusal(edit({ meta: '{ nope' })).reason).toBe('invalid');
    expect(refusal(edit({ meta: '[]' })).reason).toBe('invalid');
    expect(refusal(edit({ author: 7 })).reason).toBe('invalid');
    expect(refusal(edit({ contentVersion: 0 })).reason).toBe('invalid');
    expect(refusal(edit({ meta: JSON.stringify({ id: 'own-other', license: 'NaN' }) })).reason).toBe('invalid');
  });

  it('ft_1_02b.AC2 a piece the editor itself would not allow: a note outside the keyboard, off the grid, past the bar line, overlapping or in a hand the piece does not have (review finding)', () => {
    const note = { hand: 'RH', bar: 0, start: 0, length: 'quarter', step: 'C', octave: 4, alter: 0 };
    const withNotes = (notes: unknown[], title = 'Song') => edit({ piece: { title, hands: 'RH', beats: 4, bars: 2, fifths: 0, mode: 'major', notes } });
    expect(importPieceFile(withNotes([note])).ok).toBe(true);
    expect(refusal(withNotes([{ ...note, octave: 9 }])).reason).toBe('invalid'); // MIDI 120, above the EZ-220
    expect(refusal(withNotes([{ ...note, start: 100 }])).reason).toBe('invalid'); // off the grid
    expect(refusal(withNotes([{ ...note, start: 1920 }])).reason).toBe('invalid'); // outside the bar
    expect(refusal(withNotes([{ ...note, bar: 5 }])).reason).toBe('invalid'); // outside the piece
    expect(refusal(withNotes([{ ...note, start: 1440, length: 'half' }])).reason).toBe('invalid'); // past the bar line
    expect(refusal(withNotes([note, { ...note, step: 'D', length: 'half' }])).reason).toBe('invalid'); // overlapping notes of one hand (a different length)
    expect(refusal(withNotes([note, note])).reason).toBe('invalid'); // the same pitch twice
    expect(importPieceFile(withNotes([note, { ...note, step: 'E' }])).ok).toBe(true); // a chord is allowed
    expect(refusal(withNotes([{ ...note, hand: 'LH' }])).reason).toBe('invalid'); // a hand the piece does not have
  });

  it('ft_1_02b.AC2 only own pieces: a licence other than NaN, or an id that is not an own id, is refused', () => {
    expect(refusal(edit({ meta: JSON.stringify({ id: 'own-test', license: 'CC0-1.0' }) }))).toMatchObject({ reason: 'not-own' });
    expect(refusal(edit({ id: 'little-steps' }))).toMatchObject({ reason: 'not-own' });
    expect(refusal(edit({ id: '../own-x' }))).toMatchObject({ reason: 'not-own' });
    expect(OWN_ID.test('own-little-climb-2')).toBe(true);
    expect(OWN_ID.test('own-')).toBe(false);
  });

  it('ft_1_02b.AC2 refuses an id that belongs to a bundled piece, so it can never overwrite one', () => {
    expect(refusal(good, { reservedIds: ['own-test', 'little-steps'] })).toMatchObject({ reason: 'reserved-id', message: t('editor.import.reserved-id') });
    expect(importPieceFile(good, { reservedIds: new Set(['little-steps']) }).ok).toBe(true);
    expect(importPieceFile(good, { reservedIds: [] }).ok).toBe(true);
  });

  it('never throws, whatever the text is (property)', () => {
    fc.assert(fc.property(fc.string(), fc.jsonValue(), (text, json) => {
      expect(() => importPieceFile(text)).not.toThrow();
      expect(() => importPieceFile(JSON.stringify(json))).not.toThrow();
    }));
  });
});
