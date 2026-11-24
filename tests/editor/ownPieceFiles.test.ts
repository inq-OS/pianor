// Covers ft_1_02b.AC1, ft_1_02b.AC2.
// Export and import through OwnPieces and its store; the piece file format alone is tested in src/core/editor/pieceFile.test.ts.
import { describe, expect, it } from 'vitest';
import { emptyPiece, placeNote, type EditorPiece } from '../../src/core/editor/model';
import { OwnPieces } from '../../src/game/editor/OwnPieces';
import { MemoryStore } from '../../src/io/storage/MemoryStore';

const NOW = () => new Date('1998-10-09T12:00:00.000Z');

function song(title = 'Little Climb'): EditorPiece {
  let p = emptyPiece({ title, hands: 'RH', beats: 4, bars: 4 });
  for (const [bar, start, step, length] of [[0, 0, 'C', 'quarter'], [0, 480, 'D', 'quarter'], [0, 960, 'E', 'half'], [1, 0, 'G', 'whole'], [2, 0, 'E', 'half'], [2, 960, 'D', 'half'], [3, 0, 'C', 'whole']] as const) {
    const edit = placeNote(p, { hand: 'RH', bar, start, length, step, octave: 4 });
    if (!edit.ok) throw new Error(edit.reason);
    p = edit.piece;
  }
  return p;
}

describe('own pieces moved between devices as files', () => {
  it('ft_1_02b.AC1 a piece exported on one device is the same piece on another: notes, ABC, meta and licence NaN', async () => {
    const one = await OwnPieces.load(new MemoryStore(), NOW);
    await one.save(song(), { author: 'Mia' });
    const file = one.exportFile('own-little-climb')!;
    expect(file.name).toBe('own-little-climb.pianor-piece.json');

    const two = await OwnPieces.load(new MemoryStore(), NOW);
    const imported = await two.importFile(file.text, { reservedIds: ['little-steps'] });
    expect(imported).toEqual({ ok: true, id: 'own-little-climb', title: 'Little Climb', saved: true });
    const a = one.get('own-little-climb')!;
    const b = two.get('own-little-climb')!;
    expect(b.piece).toEqual(a.piece);
    expect(b.abc).toBe(a.abc);
    expect(b.meta).toBe(a.meta);
    expect(b.author).toBe('Mia');
    expect(JSON.parse(b.meta)).toMatchObject({ license: 'NaN', status: 'approved' });
    expect(two.pieces()).toHaveLength(1);
  });

  it('an import is a new piece: it never replaces one that is there, and a file with no export is null', async () => {
    const own = await OwnPieces.load(new MemoryStore(), NOW);
    await own.save(song(), { author: 'Mia' });
    const file = own.exportFile('own-little-climb')!;
    expect(await own.importFile(file.text)).toMatchObject({ ok: true, id: 'own-little-climb-2' });
    expect(own.list().map((r) => r.id)).toEqual(['own-little-climb', 'own-little-climb-2']);
    expect(own.get('own-little-climb')?.contentVersion).toBe(1);
    expect(own.exportFile('own-nothing')).toBeNull();
  });

  it('ft_1_02a.AC15 an imported piece whose title is taken, by an own piece or a piece of the game, in any case, gets a free one', async () => {
    const own = await OwnPieces.load(new MemoryStore(), NOW);
    await own.save(song(), { author: 'Mia' });
    const file = own.exportFile('own-little-climb')!;
    expect(await own.importFile(file.text)).toMatchObject({ ok: true, title: 'Little Climb 2' });
    expect(own.get('own-little-climb-2')?.piece.title).toBe('Little Climb 2');
    const other = await OwnPieces.load(new MemoryStore(), NOW);
    expect(await other.importFile(file.text, { takenTitles: ['LITTLE CLIMB'] })).toMatchObject({ ok: true, title: 'Little Climb 2' });
  });

  it('ft_1_02b.AC2 refuses a bad file with a message and changes nothing; a bundled id cannot be claimed', async () => {
    const store = new MemoryStore();
    const own = await OwnPieces.load(store, NOW);
    await own.save(song(), { author: 'Mia' });
    const good = own.exportFile('own-little-climb')!.text;
    const before = own.list();
    expect(await own.importFile('not json')).toMatchObject({ ok: false, reason: 'not-json', message: expect.stringContaining('not a piece file') });
    expect(await own.importFile(good, { reservedIds: ['own-little-climb'] })).toMatchObject({ ok: false, reason: 'reserved-id' });
    expect(own.list()).toEqual(before);
    expect(await store.keys('pianor/v1/own-piece/')).toHaveLength(1);
  });

  it('a piece file with no notes is not added (a piece needs notes)', async () => {
    const one = await OwnPieces.load(new MemoryStore(), NOW);
    await one.save(song(), { author: 'Mia' });
    const text = one.exportFile('own-little-climb')!.text;
    const empty = JSON.stringify({ ...JSON.parse(text), piece: { ...JSON.parse(text).piece, notes: [] } });
    const two = await OwnPieces.load(new MemoryStore(), NOW);
    expect(await two.importFile(empty)).toMatchObject({ ok: false, reason: 'empty' });
    expect(two.list()).toEqual([]);
  });
});
