// Covers core_09.AC13.
import { describe, expect, it } from 'vitest';
import { toAbc } from './abc';
import { emptyPiece, type EditorPiece, type NoteRef } from './model';
import { exportPieceFile, importPieceFile, type PieceFile } from './pieceFile';
import { samePitchNotAdjacent, tieAll, tieInto, toggleTie } from './ties';

/** Two bars of 4/4 RH: a half C4 at the end of bar 0, and the next C4 half at the start of bar 1. */
function twoBars(): EditorPiece {
  const piece = emptyPiece({ title: 'Tie', hands: 'RH', beats: 4, bars: 4 });
  return {
    ...piece,
    notes: [
      { hand: 'RH', bar: 0, start: 0, length: 'half', step: 'C', octave: 4, alter: 0 },
      { hand: 'RH', bar: 0, start: 960, length: 'half', step: 'C', octave: 4, alter: 0 },
      { hand: 'RH', bar: 1, start: 0, length: 'half', step: 'C', octave: 4, alter: 0 },
    ],
  };
}

const at = (bar: number, start: number, step: NoteRef['step'] = 'C', octave = 4): NoteRef => ({ hand: 'RH', bar, start, step, octave });

/** A C4 half at bar 0 start 0, then a C4/G3 half chord at bar 0 start 960 and bar 1 start 0 (tied across the bar line). */
function chordBars(extra: EditorPiece['notes'] = []): EditorPiece {
  const piece = emptyPiece({ title: 'Chords', hands: 'RH', beats: 4, bars: 4 });
  const h = (bar: number, start: number, step: 'C' | 'G', octave: number) => ({ hand: 'RH' as const, bar, start, length: 'half' as const, step, octave, alter: 0 as const });
  return { ...piece, notes: [h(0, 0, 'C', 4), h(0, 960, 'C', 4), h(0, 960, 'G', 3), h(1, 0, 'C', 4), h(1, 0, 'G', 3), ...extra] };
}

describe('ties in the editor (core_09.AC13)', () => {
  it('ties the selected note to the next note of the same pitch, across the bar line', () => {
    const r = toggleTie(twoBars(), at(0, 960));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.piece.notes.find((n) => n.bar === 0 && n.start === 960)?.tieNext).toBe(true);
    expect(toAbc(r.piece)).toContain('C4-');
  });

  it('a second press takes the tie away', () => {
    const tied = toggleTie(twoBars(), at(0, 960));
    if (!tied.ok) throw new Error('tie should work');
    const untied = toggleTie(tied.piece, at(0, 960));
    expect(untied.ok && untied.piece.notes.some((n) => n.tieNext)).toBe(false);
  });

  it('refuses a tie with no note of the same pitch after it', () => {
    expect(toggleTie(twoBars(), at(1, 0))).toEqual({ ok: false, reason: 'tie-none' });
    expect(toggleTie(twoBars(), at(0, 0, 'D'))).toEqual({ ok: false, reason: 'no-note' });
  });

  it('ties a chord as a whole: C/G to the next C/G (core_09.AC13)', () => {
    const r = toggleTie(chordBars(), at(0, 960));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.piece.notes.filter((n) => n.bar === 0 && n.start === 960 && n.tieNext)).toHaveLength(2);
    expect(toAbc(r.piece)).toMatch(/\]4-/);
  });

  it('refuses a chord tie when one head has no note to tie into (core_09.AC13)', () => {
    const piece = chordBars();
    const missing = { ...piece, notes: piece.notes.filter((n) => !(n.bar === 1 && n.step === 'G')) };
    expect(toggleTie(missing, at(0, 960))).toEqual({ ok: false, reason: 'tie-none' });
  });

  it('tie all ties every repeated chord that has its match after it, in one press (core_09.AC13)', () => {
    const r = tieAll(chordBars());
    // the lone C4 ties into the C4 chord, and that chord ties into the next one: three tied heads
    expect(r.ok && r.piece.notes.filter((n) => n.tieNext)).toHaveLength(3);
    if (!r.ok) return;
    expect(tieAll(r.piece)).toEqual({ ok: false, reason: 'tie-none' });
  });

  it('a tied piece is saved and reopened unchanged, as a version 3 piece file (core_09.AC13)', () => {
    const tied = toggleTie(twoBars(), at(0, 960));
    if (!tied.ok) throw new Error('tie should work');
    const file: PieceFile = {
      id: 'own-tie-song', author: 'Test', contentVersion: 1, piece: tied.piece,
      abc: toAbc(tied.piece), meta: JSON.stringify({ license: 'NaN', id: 'own-tie-song' }),
    };
    const text = exportPieceFile(file);
    expect(JSON.parse(text).schemaVersion).toBe(3);
    const back = importPieceFile(text);
    expect(back.ok && back.file.piece.notes.find((n) => n.bar === 0 && n.start === 960)?.tieNext).toBe(true);
  });
});

describe('pick two notes (core_09.AC13 follow-up)', () => {
  it('ties the chord of the first note into the chord of the second when they are the next chord', () => {
    const r = tieInto(chordBars(), at(0, 960), { hand: 'RH', bar: 1, start: 0, step: 'C', octave: 4 });
    expect(r.ok && r.piece.notes.filter((n) => n.bar === 0 && n.start === 960 && n.tieNext)).toHaveLength(2);
  });

  it('refuses a pick when one head of the chord has no note to go to', () => {
    const piece = chordBars();
    const missing = { ...piece, notes: piece.notes.filter((n) => !(n.bar === 1 && n.step === 'G')) };
    expect(tieInto(missing, at(0, 960), { hand: 'RH', bar: 1, start: 0, step: 'C', octave: 4 })).toEqual({ ok: false, reason: 'tie-none' });
  });

  it('refuses a pick into the other hand', () => {
    const piece = chordBars();
    piece.notes.push({ hand: 'LH', bar: 1, start: 0, length: 'half', step: 'C', octave: 4, alter: 0 });
    expect(tieInto(piece, at(0, 960), { hand: 'LH', bar: 1, start: 0, step: 'C', octave: 4 })).toEqual({ ok: false, reason: 'tie-none' });
  });

  it('refuses a second note that is not where the tie goes', () => {
    expect(tieInto(chordBars(), at(0, 960), { hand: 'RH', bar: 0, start: 0, step: 'C', octave: 4 })).toEqual({ ok: false, reason: 'tie-none' });
  });
});

describe('a stale tie is not written (core_09.AC13)', () => {
  it('writes no tie after the note it tied into is deleted', () => {
    const tied = toggleTie(twoBars(), at(0, 960));
    if (!tied.ok) throw new Error('tie should work');
    const without = { ...tied.piece, notes: tied.piece.notes.filter((n) => n.bar !== 1) };
    expect(toAbc(without)).not.toContain('-');
  });

  it('refuses a tie across a repeat sign (ABC has none)', () => {
    const piece = { ...twoBars(), repeats: [{ startBar: 0, endBar: 0 }] };
    expect(toggleTie(piece, at(0, 960))).toEqual({ ok: false, reason: 'tie-none' });
    expect(toAbc(piece)).not.toContain('-');
  });

  it('tie all says why nothing is tied: a same-pitch note that is not right after its note', () => {
    const base = emptyPiece({ title: 'Adjacent', hands: 'RH', beats: 4, bars: 2 });
    const quarter = (start: number, step: 'B' | 'C' = 'B') => ({ hand: 'RH' as const, bar: 0, start, length: 'quarter' as const, step, octave: 4, alter: 0 as const });
    expect(samePitchNotAdjacent({ ...base, notes: [quarter(0), quarter(480)] })).toBe(false);
    // a rest between the two B's: the same pitch is there, only not right after the first
    expect(samePitchNotAdjacent({ ...base, notes: [quarter(0), quarter(960)] })).toBe(true);
    expect(samePitchNotAdjacent({ ...base, notes: [quarter(0), quarter(480, 'C')] })).toBe(false);
  });
});
