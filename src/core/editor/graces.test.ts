// Covers core_09.AC35.
import { describe, expect, it } from 'vitest';
import { compilePiece } from '../piece/compile';
import { toAbc, toMeta } from './abc';
import { moveBars } from './bars';
import { toChart } from './chart';
import { graceItem, graceFromKey, graceFromPlace, graceWritten, removeGrace, setGrace } from './graces';
import { canRedo, canUndo, push, redo, startHistory, undo } from './history';
import { emptyPiece, findNote, pieceProblem, placeNote, setKey, setPitch, stepPitch, type Edit, type EditorNote, type EditorPiece, type NoteRef } from './model';
import { toggleTie } from './ties';

const ok = (edit: Edit): EditorPiece => {
  if (!edit.ok) throw new Error(`refused: ${edit.reason}`);
  return edit.piece;
};
const note = (over: Partial<EditorNote> = {}): EditorNote => ({ hand: 'RH', bar: 0, start: 0, length: 'quarter', step: 'E', octave: 4, alter: 0, ...over });
const ref = (over: Partial<NoteRef> = {}): NoteRef => ({ hand: 'RH', bar: 0, start: 0, step: 'E', octave: 4, ...over });
const base = (notes: Partial<EditorNote>[] = [{}], piece = emptyPiece({ title: 'Grace', hands: 'RH', beats: 4, bars: 2 })): EditorPiece =>
  notes.reduce<EditorPiece>((p, n) => ok(placeNote(p, note(n))), piece);
const D4 = { step: 'D' as const, octave: 4, alter: 0 as const, slash: true };
const compiled = (p: EditorPiece) => compilePiece({ abc: toAbc(p), meta: JSON.stringify(toMeta(p, { id: 'own-grace', level: 1, author: 'A' })) });

describe('a pre-note on an editor note (core_09.AC35, d121)', () => {
  it('core_09.AC35 setGrace puts one grace on the note, removeGrace takes it away, and the rest of the note stays', () => {
    const p = ok(setGrace(base(), ref(), D4));
    expect(findNote(p, ref())).toEqual({ ...note(), grace: D4 });
    const back = ok(removeGrace(p, ref()));
    expect(back).toEqual(base());
    expect('grace' in findNote(back, ref())!).toBe(false);
    expect(removeGrace(base(), ref())).toEqual({ ok: false, reason: 'grace-none' });
    expect(setGrace(base(), ref({ step: 'F' }), D4)).toEqual({ ok: false, reason: 'no-note' });
  });

  it('core_09.AC35 refuses a grace of the note\'s own pitch, outside the keyboard, on a chord, or on the second note of a tie', () => {
    expect(setGrace(base(), ref(), { ...D4, step: 'E' })).toEqual({ ok: false, reason: 'grace-pitch' });
    // F flat sounds as E: the same key, so the same pitch
    expect(setGrace(base(), ref(), { step: 'F', octave: 4, alter: -1, slash: true })).toEqual({ ok: false, reason: 'grace-pitch' });
    expect(setGrace(base(), ref(), { ...D4, octave: 1 })).toEqual({ ok: false, reason: 'range' });
    expect(setGrace(base(), ref(), { ...D4, octave: 8 })).toEqual({ ok: false, reason: 'range' });
    const chord = base([{}, { step: 'G' }]);
    expect(setGrace(chord, ref(), D4)).toEqual({ ok: false, reason: 'grace-chord' });
    const tied = ok(toggleTie(base([{}, { start: 480 }]), ref()));
    expect(setGrace(tied, ref({ start: 480 }), D4)).toEqual({ ok: false, reason: 'grace-tie' });
    // the first note of the tie may have one
    expect(setGrace(tied, ref(), D4).ok).toBe(true);
  });

  it('core_09.AC35 a pitch change onto the grace\'s pitch is refused, so a note and its grace never sound alike', () => {
    const p = ok(setGrace(base(), ref(), D4));
    expect(setPitch(p, ref(), 'D', 4)).toEqual({ ok: false, reason: 'grace-pitch' });
    expect(stepPitch(p, ref(), -1)).toEqual({ ok: false, reason: 'grace-pitch' });
    expect(findNote(ok(stepPitch(p, ref(), 1)), ref({ step: 'F' }))!.grace).toEqual(D4);
  });

  it('core_09.AC35 the band item: on a note with no grace it arms the pick, on a note with one it removes it, on nothing it says so', () => {
    expect(graceItem(base(), ref())).toEqual({ kind: 'arm' });
    const p = ok(setGrace(base(), ref(), D4));
    expect(graceItem(p, ref())).toEqual({ kind: 'edit', edit: { ok: true, piece: base() } });
    expect(graceItem(base(), ref({ step: 'C' }))).toEqual({ kind: 'edit', edit: { ok: false, reason: 'no-note' } });
    // a chord or a tie's second note cannot take one: the item says why at once, without arming
    expect(graceItem(base([{}, { step: 'G' }]), ref())).toEqual({ kind: 'edit', edit: { ok: false, reason: 'grace-chord' } });
  });

  it('core_09.AC35 the pitch picked becomes the grace: a key is spelled in the key of the piece, a staff place takes the key\'s alter, slashed by default', () => {
    const p = base();
    expect(findNote(ok(graceFromKey(p, ref(), 62)), ref())!.grace).toEqual({ step: 'D', octave: 4, alter: 0, slash: true });
    // in D major F is sharp: key 66 is F sharp, a click on F's line is F sharp too
    const inD = setKey(base(), 2, 'major');
    expect(findNote(ok(graceFromKey(inD, ref(), 66)), ref())!.grace).toEqual({ step: 'F', octave: 4, alter: 1, slash: true });
    expect(findNote(ok(graceFromPlace(inD, ref(), 'F', 4)), ref())!.grace).toEqual({ step: 'F', octave: 4, alter: 1, slash: true });
    // a black key in C is spelled as the editor spells a played key (a sharp)
    expect(findNote(ok(graceFromKey(p, ref(), 63)), ref())!.grace).toMatchObject({ octave: 4, slash: true });
    expect(graceFromKey(p, ref(), 64)).toEqual({ ok: false, reason: 'grace-pitch' });
  });

  it('core_09.AC35 undo takes the grace away and redo brings it back', () => {
    let h = startHistory(base());
    h = push(h, ok(setGrace(h.present, ref(), D4)));
    expect(findNote(h.present, ref())!.grace).toEqual(D4);
    h = undo(h);
    expect(findNote(h.present, ref())!.grace).toBeUndefined();
    expect(canUndo(h)).toBe(false);
    h = redo(h);
    expect(findNote(h.present, ref())!.grace).toEqual(D4);
    expect(canRedo(h)).toBe(false);
  });

  it('core_09.AC35 the ABC holds {/g} before the note ({g} when not slashed), and compiles to the editor chart\'s graces', () => {
    let p = base([{}, { start: 480, step: 'G' }]);
    p = ok(setGrace(p, ref(), D4));
    p = ok(setGrace(p, ref({ start: 480, step: 'G' }), { step: 'A', octave: 4, alter: 0, slash: false }));
    const abc = toAbc(p);
    expect(abc).toContain('{/D}E2 {A}G2');
    const chart = toChart(p, { id: 'own-grace' });
    expect(chart.graces).toEqual([
      { track: 'rh', voice: 1, tick: 0, pitch: { midi: 62, spelling: { step: 'D', alter: 0, octave: 4 } }, slash: true },
      { track: 'rh', voice: 1, tick: 480, pitch: { midi: 69, spelling: { step: 'A', alter: 0, octave: 4 } }, slash: false },
    ]);
    const result = compiled(p);
    expect(result.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(result.chart?.graces).toEqual(chart.graces);
    expect(result.chart?.notes).toEqual(chart.notes);
  });

  it('core_09.AC35 a grace\'s accidental holds to the bar line, as the compiler reads it: the main note after it is spelled again', () => {
    // C sharp grace before a C: the C must be written with a natural
    let p = base([{ step: 'C' }]);
    p = ok(setGrace(p, ref({ step: 'C' }), { step: 'C', octave: 4, alter: 1, slash: true }));
    expect(toAbc(p)).toContain('{/^C}=C2');
    expect(compiled(p).chart?.notes.map((n) => n.midi)).toEqual([60]);
    expect(compiled(p).chart?.graces?.map((g) => g.pitch.midi)).toEqual([61]);
  });

  it('core_09.AC35 a grace that a later edit made unwritable (the note joined a chord, or a tie now enters it) is kept but not written', () => {
    let p = ok(setGrace(base([{}, { start: 480, step: 'G' }]), ref({ start: 480, step: 'G' }), D4));
    const chord = ok(placeNote(p, note({ start: 480, step: 'B' })));
    expect(graceWritten(chord, findNote(chord, ref({ start: 480, step: 'G' }))!)).toBe(false);
    expect(toAbc(chord)).not.toContain('{');
    expect(toChart(chord, { id: 'own-grace' }).graces).toBeUndefined();
    expect(pieceProblem(chord)).toBeNull();
    // taken out of the chord again, the grace is written again
    p = ok(placeNote(ok(setGrace(base([{ step: 'G' }, { start: 480, step: 'G' }]), ref({ start: 480, step: 'G' }), D4)), note({ start: 960 })));
    const tied = ok(toggleTie(p, ref({ step: 'G' })));
    expect(toAbc(tied)).not.toContain('{');
    expect(compiled(tied).diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  });

  it('core_09.AC35 a piece with no grace writes the same ABC and chart as before (no graces field)', () => {
    const p = base([{}, { start: 480, step: 'G' }]);
    expect(toAbc(p)).not.toContain('{');
    expect('graces' in toChart(p, { id: 'own-grace' })).toBe(false);
  });

  it('core_09.AC35 moving bars moves each pre-note with its note, by the same step or octave, and refuses a pre-note off the keyboard', () => {
    const p = ok(setGrace(base([{ step: 'C' }]), ref({ step: 'C' }), D4));
    const up = ok(moveBars(p, { from: 0, to: 0 }, 1, 'step'));
    expect(findNote(up, ref({ step: 'D' }))!.grace).toEqual({ ...D4, step: 'E' });
    expect(pieceProblem(up)).toBeNull();
    expect(toAbc(up)).toContain('{/E}D');
    const octave = ok(moveBars(p, { from: 0, to: 0 }, 1, 'octave'));
    expect(findNote(octave, ref({ step: 'C', octave: 5 }))!.grace).toEqual({ ...D4, octave: 5 });
    expect(pieceProblem(octave)).toBeNull();
    expect(toAbc(octave)).toContain('{/d}c');
    // C6 with D6 before it: an octave up puts the note on C7, the keyboard's top key, and the pre-note above it
    const top = ok(setGrace(base([{ step: 'C', octave: 6 }]), ref({ step: 'C', octave: 6 }), { ...D4, octave: 6 }));
    expect(moveBars(top, { from: 0, to: 0 }, 1, 'octave')).toEqual({ ok: false, reason: 'range' });
  });

  it('core_09.AC35 a step move that would put a pre-note on its own note\'s key is refused; an octave move keeps both alters', () => {
    const p = ok(setGrace(base([{ step: 'C' }]), ref({ step: 'C' }), { step: 'C', octave: 4, alter: 1, slash: true }));
    expect(moveBars(p, { from: 0, to: 0 }, 1, 'step')).toEqual({ ok: false, reason: 'grace-pitch' });
    const octave = ok(moveBars(p, { from: 0, to: 0 }, 1, 'octave'));
    expect(pieceProblem(octave)).toBeNull();
    expect(toAbc(octave)).toContain('{/^c}=c');
  });
});
