import { describe, expect, it } from 'vitest';
import { compilePiece } from '../piece/compile';
import { toAbc, toMeta } from './abc';
import { toChart } from './chart';
import { emptyPiece, placeNote, type EditorPiece } from './model';
import { exportPieceFile, importPieceFile } from './pieceFile';
import { repeatAround, toggleRepeatEnd, toggleRepeatStart } from './repeats';

const piece = (): EditorPiece => {
  let p = emptyPiece({ title: 'R', hands: 'RH', beats: 4, bars: 4 });
  for (let bar = 0; bar < 4; bar++) {
    const edit = placeNote(p, { hand: 'RH', bar, start: 0, step: 'C', octave: 4, length: 'whole' });
    if (edit.ok) p = edit.piece;
  }
  return p;
};

describe('repeats in the editor', () => {
  // Covers core_09.AC20.
  it('sets a start and an end on bars, and a second press takes the repeat away', () => {
    const p = toggleRepeatEnd(toggleRepeatStart(piece(), 1), 2);
    expect(p.repeats).toEqual([{ startBar: 1, endBar: 2 }]);
    expect(toggleRepeatEnd(piece(), 1).repeats).toEqual([{ startBar: 0, endBar: 1 }]);
    expect(toggleRepeatStart(p, 1).repeats).toBeUndefined();
    expect(toggleRepeatEnd(p, 2).repeats).toBeUndefined();
  });

  // Covers core_09.AC20.
  it('writes the repeat signs to ABC, and the compiled chart equals the editor chart', () => {
    const p = toggleRepeatEnd(toggleRepeatStart(piece(), 1), 2);
    const abc = toAbc(p);
    expect(abc).toContain('|: C8 | C8 :|');
    const compiled = compilePiece({ abc, meta: JSON.stringify(toMeta(p, { id: 'own-r', level: 1, author: 'A' })) });
    expect(compiled.chart?.repeats).toEqual([{ startBar: 1, endBar: 2 }]);
    expect(toChart(p, { id: 'own-r' }).repeats).toEqual([{ startBar: 1, endBar: 2 }]);
  });

  // Covers core_09.AC20.
  it('a piece with repeats saves and reopens unchanged', () => {
    const p = toggleRepeatEnd(piece(), 2);
    const text = exportPieceFile({ id: 'own-r', author: 'A', contentVersion: 1, piece: p, abc: toAbc(p), meta: JSON.stringify(toMeta(p, { id: 'own-r', level: 1, author: 'A' })) });
    const back = importPieceFile(text);
    expect(back.ok && back.file.piece.repeats).toEqual([{ startBar: 0, endBar: 2 }]);
  });

  it('core_09.AC20 the repeat item puts one repeat from the start bar to the end bar, in either order; the same again takes it away', () => {
    const p = repeatAround(piece(), 2, 1);
    expect(p.repeats).toEqual([{ startBar: 1, endBar: 2 }]);
    expect(repeatAround(p, 1, 2).repeats).toBeUndefined();
    // one bar is a repeat of its own; a repeat it overlaps gives way, one beside it stays
    expect(repeatAround(p, 3, 3).repeats).toEqual([{ startBar: 1, endBar: 2 }, { startBar: 3, endBar: 3 }]);
    expect(repeatAround(p, 0, 1).repeats).toEqual([{ startBar: 0, endBar: 1 }]);
    // bars past the piece's end are held to its last bar
    expect(repeatAround(piece(), 2, 9).repeats).toEqual([{ startBar: 2, endBar: 3 }]);
  });
});
