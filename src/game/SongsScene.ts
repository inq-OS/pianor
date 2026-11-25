import { cardGrid } from '../core/layout/cardGrid';
import { pageOf } from '../core/layout/paging';
import { rectCentre } from '../core/layout/rect';
import { keyName } from '../core/song/outline';
import type { Song } from '../core/song/schema';
import { clipToWidth } from '../core/text/clip';
import { t } from '../core/text/strings';
import { contextOf } from './context';
import { songChartId } from './songCatalogue';
import { startScene } from './scenes';
import { C } from './ui/pixel/palette';
import { drawnText, measure } from './ui/pixel/font';
import { createBitmap } from './ui/pixel/bitmap';
import { PixelImage, PixelText, pixelStars, type PixelButton } from './ui/pixel/PixelObjects';
import { drawPieceInfo } from './menu/PieceInfoCard';
import { PixelScene, type ToolbarItem } from './ui/pixel/PixelScene';
import { TOOL_ICONS } from './ui/pixel/toolArt';

/** A song's row: three lines (title; stars and buttons; bars written and parts), in the book's margins and gutter. */
const CARD_HEIGHT = 44;
const CARD_GAP = 2;
const LIST_TOP = 4;
const BOOK_SIDE = 3;
const BOOK_MARGIN = 14;
const BOOK_GUTTER = 18;
/** The small buttons of a row: a finger wide at the usual zoom, as the book's own. */
const SMALL = 11;
const SMALL_GAP = 3;

/**
 * The songs list (ft_1_36 rule 13), behind the piece book's song bookmark: the same open book, one row a song with what to
 * know before opening it (title, tempo and key; best stars of the whole song, bars written of bars planned, its parts)
 * and its buttons (play the whole song, its stats, its info card). A press on a song's title opens its song page. A song
 * turned off in the library's drawers is not listed.
 */
export class SongsScene extends PixelScene {
  private page = 0;
  /** The song whose info card is open, or null. */
  private infoId: string | null = null;
  private infoClose: PixelButton | null = null;

  protected override keyboardNavigation = true;

  constructor() {
    super('songs');
  }

  init(): void {
    this.page = 0;
    this.infoId = null;
  }

  /** Esc and Back: close an open info card, else back to the piece book. */
  protected override back(): void {
    if (this.infoId !== null) {
      this.showInfo(null);
      return;
    }
    startScene(this, 'menu');
  }

  /** While the info card is open only its Close button is reachable. */
  protected override focusables(): PixelButton[] {
    if (this.infoId !== null) return this.infoClose ? [this.infoClose] : [];
    return super.focusables();
  }

  private showInfo(songId: string | null): void {
    this.infoId = songId;
    this.redraw();
  }

  /** The bookmark back to the pieces, where the song bookmark stood in the piece book. */
  protected override bandActions(): ToolbarItem[] {
    return [{ label: t('menu.allPieces'), icon: TOOL_ICONS.pieces, iconOnly: true, main: true, onClick: () => startScene(this, 'menu') }];
  }

  protected draw(): void {
    const { width, height } = this.px;
    const { songs, profiles } = contextOf(this);
    const all = songs.list();
    const list = all.filter((song) => profiles.isPieceOn(songChartId(song.id)));
    this.sky();
    this.openBook({ x: BOOK_SIDE, y: LIST_TOP - 2, w: width - 2 * BOOK_SIDE, h: height - LIST_TOP + 1 });
    this.inkWriting = true;
    if (list.length === 0) {
      this.label(BOOK_MARGIN, LIST_TOP + 16, all.length > 0 ? t('songs.allOff') : t('songs.none'), C.umberDark, { shadow: false });
      return;
    }
    const row = CARD_HEIGHT;
    const grid = cardGrid({ width, height, top: LIST_TOP + 4, margin: BOOK_MARGIN, rowHeight: row, rowGap: CARD_GAP, columnGap: BOOK_GUTTER });
    const slice = pageOf(list.length, this.page, { singlePageMax: grid.singlePageMax, perPage: grid.perPage });
    this.page = slice.page;
    const capacity = slice.paged ? grid.perPage : grid.singlePageMax;
    list.slice(slice.first, slice.first + slice.count).forEach((song, i) => {
      const { x, y } = rectCentre(grid.pageCell(i, capacity));
      this.songRow(song, x, y - row / 4, grid.cardWidth);
    });
    if (slice.paged) {
      this.pager(slice, (page) => {
        this.page = page;
        this.redraw();
      });
    }
    this.infoClose = null;
    const open = this.infoId === null ? undefined : songs.pieceFor(songChartId(this.infoId));
    if (open) this.infoClose = this.own(drawPieceInfo({ scene: this, root: this.root, width, height, close: () => this.showInfo(null) }, open));
  }

  /** One song: its title (opens the song page) with its tempo and key, and under it the stars, the bars written of planned, the parts and the buttons. */
  private songRow(song: Song, x: number, y: number, width: number): void {
    const { songs, profiles } = contextOf(this);
    const resolved = songs.resolved(song);
    const parts = resolved.rows.filter((r) => r.depth === 0).length;
    const facts = `${t('song.tempo', { bpm: song.bpm })} ${keyName(song.key)}`;
    const factsWidth = measure(drawnText(facts));
    const room = width - factsWidth - 16;
    const title = clipToWidth(song.title, room, (text) => measure(drawnText(text)));
    const button = this.button({
      x: x - (factsWidth + 6) / 2, y, width: width - factsWidth - 6, height: CARD_HEIGHT / 2, label: title, look: 'ink', align: 'left', labelWidth: room,
      onClick: () => startScene(this, 'song', { songId: song.id }),
    });
    const { x: left, y: top } = button.rect;
    const right = left + width - 5;
    // a thin rule under the row, so each song reads as one block
    const rule = createBitmap(width - 4, 1);
    rule.pixels.fill(C.umberLight);
    this.root.add(new PixelImage(this, left + 2, top + CARD_HEIGHT - 2, rule).setName('rowRule').setAlpha(0.6));
    const factsText = new PixelText(this, right - factsWidth, top + 4, facts, { color: C.umberDark }).setName('songFacts');
    this.root.add(factsText);
    const record = profiles.recordFor(songChartId(song.id));
    const stars = pixelStars(this, this.root, left + 6, top + 19, record?.bestGrade ?? 0, { gap: 1, ink: true });
    const line = `${t('songs.written', { written: resolved.barsWritten, planned: resolved.bars })}, ${t('songs.parts', { count: parts })}`;
    const written = new PixelText(this, left + 6, top + 31, clipToWidth(line, width - 12, (text) => measure(drawnText(text))), { color: C.umberDark }).setName('songWritten');
    this.root.add(written);
    button.attach(factsText, written, ...stars);
    this.button({
      x: right - SMALL / 2 - 2 * (SMALL + SMALL_GAP), y: top + 23, width: SMALL, height: SMALL, label: t('song.play', { name: song.title }), look: 'ink', inkBox: true, icon: TOOL_ICONS.play, iconOnly: true,
      disabled: songs.joinedChart(song) === null,
      onClick: () => startScene(this, 'practice', { chartId: songChartId(song.id), fromSong: 'songs' }),
    });
    this.button({
      x: right - SMALL / 2 - SMALL - SMALL_GAP, y: top + 23, width: SMALL, height: SMALL, label: t('stats.button'), look: 'ink', inkBox: true,
      onClick: () => startScene(this, 'results', { chartId: songChartId(song.id), fromSong: 'songs' }),
    });
    // the song's info card, as a piece's (rule 13): tempo and what its written parts hold; none before a part is written
    this.button({
      x: right - SMALL / 2, y: top + 23, width: SMALL, height: SMALL, label: t('info.button'), look: 'ink', inkBox: true,
      disabled: songs.joinedChart(song) === null,
      onClick: () => this.showInfo(song.id),
    });
  }
}
