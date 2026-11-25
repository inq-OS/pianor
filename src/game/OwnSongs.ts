import { z } from 'zod';
import { newSong } from '../core/song/edit';
import { songSchema, type Song } from '../core/song/schema';
import type { KeyValueStore } from '../core/progression';

/** Own songs live on this device, one key each, next to the own pieces (ft_1_36 rule 14). */
const PREFIX = 'pianor/v1/own-song/';
/** The record format this build writes. */
export const OWN_SONG_FORMAT = 1;

const recordSchema = z.object({ schemaVersion: z.literal(OWN_SONG_FORMAT), savedAt: z.string().min(1), song: songSchema });
type OwnSongRecord = z.infer<typeof recordSchema>;

/** A title as lowercase words joined by dashes, for the song's id. */
function slugOf(title: string): string {
  return title.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30).replace(/-+$/, '');
}

/**
 * The player's own songs (ft_1_36 rules 12 and 14): made in the songs list, edited on the song page, kept on this device
 * (licence `NaN`, never committed). A song only points at its pieces; the pieces stay own pieces.
 */
export class OwnSongs {
  private readonly songs = new Map<string, Song>();
  /** Saved songs that could not be read (kept in storage untouched). */
  unreadable = 0;

  private constructor(private readonly store: KeyValueStore, private readonly now: () => Date) {}

  static async load(store: KeyValueStore, now: () => Date = () => new Date()): Promise<OwnSongs> {
    const own = new OwnSongs(store, now);
    for (const key of await store.keys(PREFIX)) {
      try {
        const raw = await store.get(key);
        const record = recordSchema.safeParse(raw === null ? null : JSON.parse(raw));
        if (record.success) own.songs.set(record.data.song.id, record.data.song);
        else own.unreadable++;
      } catch {
        own.unreadable++;
      }
    }
    return own;
  }

  /** Every own song, by title. */
  list(): Song[] {
    return [...this.songs.values()].sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
  }

  get(id: string): Song | undefined {
    return this.songs.get(id);
  }

  /** A new song with its title, the defaults and one blank named `blankName`, saved at once. */
  async create(title: string, blankName: string): Promise<Song> {
    const song = newSong(this.freeId(title), title, blankName);
    await this.save(song);
    return song;
  }

  /** A new song made by `make` with a free id from its title (an imported book's song, ft_Y_04 slice 6), saved at once. */
  async createFrom(title: string, make: (id: string) => Song): Promise<{ song: Song; saved: boolean }> {
    const song = make(this.freeId(title));
    return { song, saved: await this.save(song) };
  }

  /** Keep a new version of a song; false when the storage refused it (it still holds for this session). */
  async save(song: Song): Promise<boolean> {
    this.songs.set(song.id, song);
    const record: OwnSongRecord = { schemaVersion: OWN_SONG_FORMAT, savedAt: this.now().toISOString(), song };
    try {
      await this.store.set(PREFIX + song.id, JSON.stringify(record));
      return true;
    } catch {
      return false;
    }
  }

  async remove(id: string): Promise<void> {
    this.songs.delete(id);
    await this.store.remove(PREFIX + id);
  }

  private freeId(title: string): string {
    const base = `own-song-${slugOf(title) || 'song'}`;
    let id = base;
    for (let n = 2; this.songs.has(id); n++) id = `${base}-${n}`;
    return id;
  }
}
