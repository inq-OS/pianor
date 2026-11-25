// Covers ft_1_36.AC14.
import { describe, expect, it } from 'vitest';
import { newSong } from '../../src/core/song/edit';
import { OwnSongs, OWN_SONG_FORMAT } from '../../src/game/OwnSongs';
import { MemoryStore } from '../../src/io/storage/MemoryStore';

const NOW = () => new Date('1998-10-08T12:00:00.000Z');

describe('own songs on this device (ft_1_36 rules 12 and 14)', () => {
  it('ft_1_36.AC14 a new song is kept under a free id, read back after a reload, and removed', async () => {
    const store = new MemoryStore();
    const own = await OwnSongs.load(store, NOW);
    const first = await own.create('My Song', 'Part');
    const second = await own.create('My Song', 'Part');
    expect(first.id).toBe('own-song-my-song');
    expect(second.id).toBe('own-song-my-song-2');
    expect(own.list().map((s) => s.title)).toEqual(['My Song', 'My Song']);

    const again = await OwnSongs.load(store, NOW);
    expect(again.get(first.id)?.nodes).toHaveLength(1);

    await again.save({ ...first, title: 'Renamed' });
    expect((await OwnSongs.load(store, NOW)).get(first.id)?.title).toBe('Renamed');

    await again.remove(second.id);
    expect((await OwnSongs.load(store, NOW)).list().map((s) => s.id)).toEqual([first.id]);
  });

  it('ft_1_36.AC14 a record that does not read is left in storage untouched and counted', async () => {
    const store = new MemoryStore();
    await store.set('pianor/v1/own-song/own-song-bad', '{"schemaVersion":99}');
    await store.set('pianor/v1/own-song/own-song-ok', JSON.stringify({ schemaVersion: OWN_SONG_FORMAT, savedAt: NOW().toISOString(), song: newSong('own-song-ok', 'Ok', 'Part') }));
    const own = await OwnSongs.load(store, NOW);
    expect(own.unreadable).toBe(1);
    expect(own.list().map((s) => s.id)).toEqual(['own-song-ok']);
    expect(await store.get('pianor/v1/own-song/own-song-bad')).toBe('{"schemaVersion":99}');
  });
});
