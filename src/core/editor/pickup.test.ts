// Covers core_09.AC30 (the editor's pick-up length): a short first bar, the last bar holding the rest of it.
import { describe, expect, it } from 'vitest';
import { buildBars } from '../chart/time';
import { compilePiece } from '../piece/compile';
import { toAbc, toMeta } from './abc';
import { copyBars, cutBars, insertBars } from './bars';
import { toChart } from './chart';
import { fromChart } from './fromChart';
import {
  barLength, emptyPiece, pieceProblem, placeNote, placeRest, restsFor, setBars, setBeats, setPickup, slotsFor, tickOf,
  type EditorPiece, type NoteInput,
} from './model';
import { nextLength } from './nextLength';
import { drawnWhileWriting, editorStaff } from './staff';
import { cursorOf } from './playEntry';
import { timeStops } from './keyCursor';
import { exportPieceFile, importPieceFile } from './pieceFile';
import { tieTargetOf } from './ties';

const made = (edit: { ok: true; piece: EditorPiece } | { ok: false; reason: string }): EditorPiece => {
  if (!edit.ok) throw new Error(edit.reason);
  return edit.piece;
};
const place = (p: EditorPiece, notes: NoteInput[]) => notes.reduce((acc, n) => made(placeNote(acc, n)), p);
const q = (bar: number, start: number, step: NoteInput['step'], length: NoteInput['length'] = 'quarter'): NoteInput => ({ hand: 'RH', bar, start, step, octave: 4, length });

/** 4/4 with a one-beat pick-up: G, then C E D C, then a dotted half C to end. */
const tune = (): EditorPiece => {
  const p = made(setPickup(emptyPiece({ title: 'Pick', hands: 'RH', beats: 4, bars: 3 }), 1));
  return place(p, [q(0, 0, 'G'), q(1, 0, 'C'), q(1, 480, 'E'), q(1, 960, 'D'), q(1, 1440, 'C'), q(2, 0, 'C', 'dottedHalf')]);
};

describe('the pick-up length in the piece maker', () => {
  it('core_09.AC30 a piece without a pick-up keeps its whole bars, as before', () => {
    const p = emptyPiece({ title: 'Old', hands: 'RH', beats: 3, bars: 4 });
    expect(p.pickup).toBeUndefined();
    expect([0, 1, 3].map((b) => barLength(p, b))).toEqual([1440, 1440, 1440]);
    expect(toChart(p, { id: 'old' }).bars).toEqual(buildBars([{ tick: 0, num: 3, den: 4 }], 4));
  });

  it('core_09.AC30 the pick-up is set only where the first and last bars hold what they may, shorter than the bar, on two bars or more', () => {
    const p = emptyPiece({ title: 'P', hands: 'RH', beats: 3, bars: 4 });
    expect(made(setPickup(p, 2)).pickup).toBe(2);
    expect(setPickup(p, 3)).toEqual({ ok: false, reason: 'pickup' });
    expect(setPickup({ ...p, bars: 1 }, 1)).toEqual({ ok: false, reason: 'pickup' });
    expect(setPickup(place(p, [q(0, 0, 'C')]), 1)).toEqual({ ok: false, reason: 'pickup' });
    expect(setPickup(place(p, [q(3, 0, 'C', 'dottedHalf')]), 1)).toEqual({ ok: false, reason: 'pickup' });
    expect(made(setPickup(place(p, [q(3, 0, 'C')]), 1)).pickup).toBe(1);
    // a middle bar may hold notes; none takes the field away
    const set = made(setPickup(place(p, [q(1, 0, 'C')]), 1));
    expect('pickup' in made(setPickup(set, 0))).toBe(false);
    // a meter no longer than the pick-up drops it
    expect(made(setBeats(made(setPickup(emptyPiece({ title: 'P', hands: 'RH', beats: 4, bars: 4 }), 3)), 2)).pickup).toBeUndefined();
  });

  it('core_09.AC30 a written first bar whose notes are in its last beats becomes a pick-up, its notes where they sound', () => {
    const p = place(emptyPiece({ title: 'P', hands: 'RH', beats: 4, bars: 3 }), [q(0, 960, 'E', 'eighth'), q(0, 1440, 'G'), q(1, 0, 'C')]);
    expect(setPickup(p, 1)).toEqual({ ok: false, reason: 'pickup' });
    const two = made(setPickup(p, 2));
    expect(two.notes.filter((n) => n.bar === 0).map((n) => n.start)).toEqual([0, 480]);
    expect(toChart(two, { id: 'p' }).notes.map((n) => n.tick)).toEqual([0, 480, 960]);
    // and back: none puts them at the end of a whole bar again
    expect(made(setPickup(two, 0)).notes).toEqual(p.notes);
  });

  it('core_09.AC30 the pick-up holds only its beats and the last bar the rest of its bar', () => {
    const p = made(setPickup(emptyPiece({ title: 'P', hands: 'RH', beats: 4, bars: 3 }), 1));
    expect([0, 1, 2].map((b) => barLength(p, b))).toEqual([480, 1920, 1440]);
    expect(placeNote(p, q(0, 0, 'C', 'half'))).toEqual({ ok: false, reason: 'bar-line' });
    expect(placeNote(p, q(0, 480, 'C'))).toEqual({ ok: false, reason: 'grid' });
    expect(placeNote(p, q(2, 0, 'C', 'whole'))).toEqual({ ok: false, reason: 'bar-line' });
    expect(slotsFor(p, 'RH', 0)).toEqual([0]);
    expect(slotsFor(place(p, [q(2, 0, 'C', 'dottedHalf')]), 'RH', 2)).toEqual([]);
    expect(tickOf(p, 1, 0)).toBe(480);
    expect(tickOf(p, 2, 240)).toBe(2640);
    // the short bars are filled with rests, never a whole-bar rest (the compiler refuses one in a pick-up)
    expect(restsFor(p, 'RH').filter((r) => r.bar !== 1)).toEqual([
      { bar: 0, start: 0, length: 'quarter' },
      { bar: 2, start: 0, length: 'half' }, { bar: 2, start: 960, length: 'quarter' },
    ]);
    expect(pieceProblem(p)).toBeNull();
    expect(pieceProblem({ ...p, pickup: 4 })).toBe('pickup');
  });

  it('core_09.AC30 the chart the piece maker draws equals the compiled one, with a short first and last bar', () => {
    const p = tune();
    const compiled = compilePiece({ abc: toAbc(p), meta: JSON.stringify(toMeta(p, { id: 'own-pick', level: 1, author: 'A' })) });
    expect(compiled.diagnostics).toEqual([]);
    const chart = toChart(p, { id: 'own-pick' });
    expect(chart.bars).toEqual([{ index: 0, startTick: 0, endTick: 480 }, { index: 1, startTick: 480, endTick: 2400 }, { index: 2, startTick: 2400, endTick: 3840 }]);
    expect(compiled.chart?.bars).toEqual(chart.bars);
    expect(compiled.chart?.notes).toEqual(chart.notes);
    expect(compiled.chart?.rests).toEqual(chart.rests);
  });

  it('core_09.AC30 a rest-filled pick-up of a hand with no notes in it compiles too', () => {
    const p = place(made(setPickup(emptyPiece({ title: 'P', hands: 'both', beats: 3, bars: 3 }), 2)), [
      q(0, 0, 'G'), q(0, 480, 'A'), q(1, 0, 'C', 'dottedHalf'), q(2, 0, 'C'), { ...q(1, 0, 'C', 'dottedHalf'), hand: 'LH', octave: 3 },
    ]);
    const compiled = compilePiece({ abc: toAbc(p), meta: JSON.stringify(toMeta(p, { id: 'own-pick2', level: 1, author: 'A' })) });
    expect(compiled.diagnostics).toEqual([]);
    const chart = toChart(p, { id: 'own-pick2' });
    expect(compiled.chart?.rests).toEqual(chart.rests);
    expect(compiled.chart?.notes).toEqual(chart.notes);
  });

  it('core_09.AC30 a tie and the next guessed length cross the pick-up bar line', () => {
    const p = place(made(setPickup(emptyPiece({ title: 'P', hands: 'RH', beats: 4, bars: 3 }), 1)), [{ ...q(0, 0, 'G'), tieNext: true }, q(1, 0, 'G')]);
    expect(tieTargetOf(p, p.notes[0]!)).toEqual(p.notes[1]);
    expect(nextLength(p, { bar: 0, start: 0, length: 'quarter' })).toBe('quarter');
    // the last bar of three beats holds no whole note: the guess gives way to what fits
    expect(nextLength(p, { bar: 1, start: 0, length: 'whole' })).toBe('dottedHalf');
    // a full pick-up sends the next played key to bar 2, and the key cursor stops only inside the pick-up's beat
    expect(cursorOf(place(made(setPickup(emptyPiece({ title: 'P', hands: 'RH', beats: 4, bars: 3 }), 1)), [q(0, 0, 'G')]), 'RH')).toEqual({ bar: 1, start: 0 });
    expect(timeStops(made(setPickup(emptyPiece({ title: 'P', hands: 'RH', beats: 4, bars: 3 }), 1)), 'RH', 0, 'eighth')).toEqual([0, 240]);
  });

  it('core_09.AC30 a rest placed after the pick-up is drawn while writing', () => {
    const p = made(placeRest(made(setPickup(emptyPiece({ title: 'P', hands: 'RH', beats: 4, bars: 3 }), 1)), { hand: 'RH', bar: 1, start: 0, length: 'quarter' }));
    const chart = toChart(p, { id: 'own-rest' });
    const drawn = drawnWhileWriting(editorStaff(p, chart, { width: 640, height: 360 }), chart, p);
    expect(drawn.rests.map((g) => chart.rests[g.index]!.tick)).toEqual([480]);
  });

  it('core_09.AC30 a compiled pick-up comes back into the piece maker as a pick-up', () => {
    const p = tune();
    const compiled = compilePiece({ abc: toAbc(p), meta: JSON.stringify(toMeta(p, { id: 'own-pick', level: 1, author: 'A' })) });
    const back = fromChart(compiled.chart!);
    expect(back.ok && back.piece.pickup).toBe(1);
    expect(back.ok && back.piece.notes).toEqual(p.notes);
    expect(back.ok && back.problems).toEqual([]);
  });

  it('core_09.AC30 a piece with a pick-up is saved and read back with it', () => {
    const p = tune();
    const id = 'own-pick';
    const text = exportPieceFile({ id, author: 'Mia', contentVersion: 1, piece: p, abc: toAbc(p), meta: JSON.stringify(toMeta(p, { id, level: 1, author: 'Mia' })) });
    const back = importPieceFile(text);
    expect(back.ok && back.file.piece).toEqual(p);
  });

  it('core_09.AC30 bars that move keep every note in its bar', () => {
    const p = tune();
    // fewer bars: a new short last bar drops what it cannot hold (undo brings it back)
    expect(setBars(p, 2).notes.filter((n) => n.bar === 1).map((n) => n.start)).toEqual([0, 480, 960]);
    // cutting the pick-up leaves a piece without one, its notes kept at the end of a whole bar
    const cut = cutBars(p, { from: 0, to: 0 }).piece;
    expect(cut.pickup).toBeUndefined();
    // a paste after the short last bar adds an empty short bar, so the pick-up stays
    const pasted = made(insertBars(p, 3, copyBars(p, { from: 1, to: 1 })));
    expect(pasted.pickup).toBe(1);
    expect(pasted.bars).toBe(5);
    expect(pieceProblem(pasted)).toBeNull();
    // a paste before the pick-up makes it a whole bar, its note where it sounds
    const before = made(insertBars(p, 0, copyBars(p, { from: 1, to: 1 })));
    expect(before.pickup).toBeUndefined();
    expect(before.notes.find((n) => n.bar === 1)?.start).toBe(1440);
    expect(pieceProblem(before)).toBeNull();
  });
});
