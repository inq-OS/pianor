import { cardGrid } from '../core/layout/cardGrid';
import { pageOf } from '../core/layout/paging';
import { rectCentre } from '../core/layout/rect';
import { keyName } from '../core/song/outline';
import type { Song } from '../core/song/schema';
import { clipToWidth, wholeIfCut } from '../core/text/clip';
import { t } from '../core/text/strings';
import { contextOf } from './context';
import { songChartId } from './songCatalogue';
import { startScene } from './scenes';
import { C } from './ui/pixel/palette';
import { drawnText, measure } from './ui/pixel/font';
import { createBitmap } from './ui/pixel/bitmap';
import { PixelImage, PixelText, pixelStars, type PixelButton } from './ui/pixel/PixelObjects';
import { drawPieceInfo } from './menu/PieceInfoCard';
import { openTextField } from './ui/textField';
import { PixelScene, type ToolbarItem } from './ui/pixel/PixelScene';
import { TOOL_ICONS } from './ui/pixel/toolArt';

/** A song's row: three lines (title; stars and buttons; bars written and parts), in the book's margins and gutter. */
const CARD_HEIGHT = 44;
const CARD_GAP = 2;
const LIST_TOP = 4;
const BOOK_SIDE = 3;
const BOOK_MARGIN = 14;
const BOOK_GUTTER = 18;
/** A row is set this far in from its page's cell. */
const ROW_INSET = 3;
/** The small buttons of a row: a finger wide at the usual zoom, as the book's own. */
const SMALL = 11;
const SMALL_GAP = 3;
/** The new song's title field, in layout cells: a line of big letters. */
const FIELD_HEIGHT = 14;

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
  /** The new song's title field is open. */
  private naming = false;

  protected override keyboardNavigation = true;

  constructor() {
    super('songs');
  }

  init(): void {
    this.page = 0;
    this.infoId = null;
    this.naming = false;
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
    const row = CARD_HEIGHT;
    const grid = cardGrid({ width, height, top: LIST_TOP + 4, margin: BOOK_MARGIN, rowHeight: row, rowGap: CARD_GAP, columnGap: BOOK_GUTTER });
    // the first row makes a new song (rule 12), then the songs that are on
    const rows: (Song | null)[] = [null, ...list];
    const slice = pageOf(rows.length, this.page, { singlePageMax: grid.singlePageMax, perPage: grid.perPage });
    this.page = slice.page;
    const capacity = slice.paged ? grid.perPage : grid.singlePageMax;
    rows.slice(slice.first, slice.first + slice.count).forEach((song, i) => {
      const { x, y } = rectCentre(grid.pageCell(i, capacity));
      // set in from the page's cell, so the row stays on the paper (as the piece book's cards do)
      if (song) this.songRow(song, x, y - row / 4, grid.cardWidth - 2 * ROW_INSET);
      else this.newSongRow(x, y, grid.cardWidth - 2 * ROW_INSET);
    });
    if (list.length === 0) {
      const { x, y } = rectCentre(grid.pageCell(1, capacity));
      this.label(x - grid.cardWidth / 2 + 6, y - 4, all.length > 0 ? t('songs.allOff') : t('songs.none'), C.umberDark, { shadow: false });
    }
    // the piece book's pager: its page numbers and turned-up corners
    if (slice.paged) {
      this.bookPager(slice, { x: BOOK_SIDE, y: LIST_TOP - 2, w: width - 2 * BOOK_SIDE, h: height - LIST_TOP + 1 }, (page) => {
        this.page = page;
        this.redraw();
      });
    }
    this.infoClose = null;
    const open = this.infoId === null ? undefined : songs.pieceFor(songChartId(this.infoId));
    if (open) this.infoClose = this.own(drawPieceInfo({ scene: this, root: this.root, width, height, close: () => this.showInfo(null) }, open, 'song'));
  }

  /**
   * "+ New song" (rule 12): a press asks the title in a field on this row; Enter makes the song with the defaults and one
   * blank, kept on this device, and opens its song page. Esc, or an empty title, makes nothing.
   */
  private newSongRow(x: number, y: number, width: number): void {
    const button = this.button({
      x, y, width: width - 4, height: CARD_HEIGHT - 6, label: t('songs.new'), look: 'ink', align: 'left', labelWidth: width - 12,
      onClick: () => {
        // one field at a time: a second press keeps the one open
        if (this.naming) return;
        this.naming = true;
        const r = button.rect;
        openTextField(
          { scene: this, root: this.root, scale: this.px.scale, x: r.x, y: r.y + (r.height - FIELD_HEIGHT) / 2, w: r.width, h: FIELD_HEIGHT },
          {
            value: '', label: t('song.titleLabel'), maxLength: 60,
            onCancel: () => {
              this.naming = false;
            },
            onDone: (title) => {
              this.naming = false;
              if (title === '') return;
              void contextOf(this).ownSongs.create(title, t('song.newPart', { n: 1 })).then((song) => startScene(this, 'song', { songId: song.id }));
            },
          },
        );
      },
    });
    const rule = createBitmap(width - 4, 1);
    rule.pixels.fill(C.umberLight);
    this.root.add(new PixelImage(this, x - width / 2 + 2, y + CARD_HEIGHT / 2 - 2, rule).setName('rowRule').setAlpha(0.6));
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
      // a cut title's whole words in its tooltip
      ...wholeIfCut(title, song.title),
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
    const line = `${t('songs.written', { written: resolved.barsWritten, planned: resolved.bars })}, ${(parts === 1 ? t('songs.onePart') : t('songs.parts', { count: parts }))}`;
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
