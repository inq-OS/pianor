// Covers core_09.AC8: an own piece saved before the key and the accidentals (record format 1) opens unchanged.
import { describe, expect, it } from 'vitest';
import v1 from '../fixtures/pieceFiles/piece-file.v1.json';
import { toAbc } from '../../src/core/editor/abc';
import { OwnPieces, OWN_PIECE_FORMAT } from '../../src/game/editor/OwnPieces';
import { MemoryStore } from '../../src/io/storage/MemoryStore';

const NOW = () => new Date('1998-10-20T12:00:00.000Z');
const KEY = 'pianor/v1/own-piece/own-fixture-song';

describe('own pieces saved before the key (core_09.AC8)', () => {
  it('a version 1 record opens unchanged: the same notes in key C, the same ABC and meta, and it plays', async () => {
    const store = new MemoryStore();
    await store.set(KEY, JSON.stringify({ schemaVersion: 1, id: v1.id, savedAt: '1998-10-09T12:00:00.000Z', author: v1.author, contentVersion: v1.contentVersion, piece: v1.piece, abc: v1.abc, meta: v1.meta }));
    const own = await OwnPieces.load(store, NOW);
    expect(own.unreadable).toBe(0);
    const record = own.get(v1.id)!;
    expect(record.piece).toEqual({ ...v1.piece, fifths: 0, mode: 'major', notes: v1.piece.notes.map((n) => ({ ...n, alter: 0 })) });
    expect(record.abc).toBe(v1.abc);
    expect(toAbc(record.piece)).toBe(v1.abc);
    expect(record.meta).toBe(v1.meta);
    expect(own.pieces()).toHaveLength(1);
  });

  it('saving it again writes format 2', async () => {
    expect(OWN_PIECE_FORMAT).toBe(2);
    const store = new MemoryStore();
    await store.set(KEY, JSON.stringify({ schemaVersion: 1, id: v1.id, savedAt: '1998-10-09T12:00:00.000Z', author: v1.author, contentVersion: v1.contentVersion, piece: v1.piece, abc: v1.abc, meta: v1.meta }));
    const own = await OwnPieces.load(store, NOW);
    await own.save(own.get(v1.id)!.piece, { id: v1.id, author: v1.author });
    expect(JSON.parse((await store.get(KEY))!)).toMatchObject({ schemaVersion: 2, id: v1.id, contentVersion: 2 });
  });
});
