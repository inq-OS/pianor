import type { Chart } from '../core/chart/schema';
import { pieceFactsOf, resolveSong, type ResolvedSong } from '../core/song/resolve';
import { songSchema, walkSong, type Song } from '../core/song/schema';
import { compareTitles } from '../core/text/titleOrder';
import { songChart, songIdOfChart, type SongChart } from '../core/song/songChart';
import type { Piece } from './pieceList';

/** What the song catalogue is built from (`src/main.ts`). */
export interface SongCatalogueSources {
  /** The song files of this build, unparsed (`content/songs/<id>/song.json`). */
  files: readonly unknown[];
  /** Offer draft songs (the dev server). */
  showDrafts: boolean;
  /** The pieces the game offers: a song's pieces are found here, so a piece this build left out is a missing part. */
  piece: (id: string) => Piece | undefined;
  /** The parts of a song the active player turned off (ft_1_36 rule 5). */
  partsOff: (songId: string) => readonly string[];
  /** The player's own songs on this device (ft_1_36 rule 12); none by default. */
  own?: () => readonly Song[];
}

/** The chart id of a whole song (ft_1_36 rule 9): its records are kept under it. */
export { songChartId } from '../core/song/songChart';

/**
 * The songs the game offers (ft_1_36), built once by the composition root: each read through its schema (a song file that
 * does not parse is left out), drafts only with `showDrafts`, in title order. The whole song plays as one chart joined
 * from the parts the active player has on, found by its chart id like any piece.
 */
export class SongCatalogue {
  private readonly sources: SongCatalogueSources;
  private songs: Song[] | null = null;
  /** The joined chart of each song, kept while the player's switches are the same (the practice screen keeps one chart). */
  private joined = new Map<string, { key: string; song: Song; charts: (Chart | undefined)[]; chart: SongChart | null }>();

  constructor(sources: SongCatalogueSources) {
    this.sources = sources;
  }

  list(): Song[] {
    const own = this.sources.own?.() ?? [];
    return [...this.bundled(), ...own].sort((a, b) => compareTitles(a.title, b.title) || a.id.localeCompare(b.id));
  }

  /** Whether the song is the player's own, which the song page edits (a bundled song is read only, rule 12). */
  isOwn(songId: string): boolean {
    return (this.sources.own?.() ?? []).some((s) => s.id === songId);
  }

  private bundled(): Song[] {
    this.songs ??= this.sources.files
      .flatMap((raw) => {
        const parsed = songSchema.safeParse(raw);
        return parsed.success ? [parsed.data] : [];
      })
      .filter((s) => this.sources.showDrafts || s.status === 'approved')
      .sort((a, b) => a.title.localeCompare(b.title));
    return [...this.songs];
  }

  find(songId: string): Song | undefined {
    return this.list().find((s) => s.id === songId);
  }

  /** The ids of every piece that stands in a song: they are not listed on their own in the piece book (rule 13). */
  pieceIds(): Set<string> {
    return new Set(this.list().flatMap((s) => walkSong(s.nodes).flatMap(({ node }) => (node.kind === 'piece' ? [node.piece] : []))));
  }

  private chartOf = (id: string): Chart | undefined => this.sources.piece(id)?.chart;

  /** The song's outline with the active player's switches. */
  resolved(song: Song): ResolvedSong {
    return resolveSong(song, (id) => {
      const chart = this.chartOf(id);
      return chart ? pieceFactsOf(chart) : undefined;
    }, new Set(this.sources.partsOff(song.id)));
  }

  /** The whole song joined from the parts that are on (rule 7), or null when nothing written is on. */
  joinedChart(song: Song): SongChart | null {
    const off = this.sources.partsOff(song.id);
    const key = JSON.stringify(off);
    // an own song or one of its pieces edited since is joined again
    const charts = walkSong(song.nodes).flatMap(({ node }) => (node.kind === 'piece' ? [this.chartOf(node.piece)] : []));
    const kept = this.joined.get(song.id);
    if (kept?.key === key && kept.song === song && kept.charts.length === charts.length && kept.charts.every((c, i) => c === charts[i])) return kept.chart;
    const chart = songChart(song, this.chartOf, new Set(off));
    this.joined.set(song.id, { key, song, charts, chart });
    return chart;
  }

  /** The whole song as a piece the practice screen plays, by its chart id (`song:<id>`); undefined for any other id. */
  pieceFor(chartId: string): Piece | undefined {
    const songId = songIdOfChart(chartId);
    const song = songId === null ? undefined : this.find(songId);
    const joined = song ? this.joinedChart(song) : null;
    if (!song || !joined) return undefined;
    return { chart: joined.chart, status: song.status, level: joined.chart.level, unlockLevel: joined.chart.level, source: song.source };
  }
}
