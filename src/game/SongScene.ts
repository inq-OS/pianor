import { cardGrid } from '../core/layout/cardGrid';
import { pageOf } from '../core/layout/paging';
import { rectCentre } from '../core/layout/rect';
import { keyName, meterName, pieceOutline, rowPlay, shownRows, startFolded, type ShownRow } from '../core/song/outline';
import { pieceFactsOf, type ResolvedSong, type RowValue, type SongRow } from '../core/song/resolve';
import type { Song } from '../core/song/schema';
import { keepsLastPartOn, labelOn, setLabelOn, setPartOn } from '../core/song/switches';
import { clipToWidth } from '../core/text/clip';
import { pieceTitle } from '../core/text/pieceTitle';
import { strings, t, type StringKey } from '../core/text/strings';
import { contextOf } from './context';
import { songChartId } from './songCatalogue';
import { startScene } from './scenes';
import { createBitmap, type Bitmap } from './ui/pixel/bitmap';
import { drawnText, measure } from './ui/pixel/font';
import { C } from './ui/pixel/palette';
import { PixelImage, PixelText, pixelStars, type PixelButton } from './ui/pixel/PixelObjects';
import { PixelScene, type ToolbarItem } from './ui/pixel/PixelScene';
import { TOOL_ICONS } from './ui/pixel/toolArt';
import { STAR_FULL } from './ui/pixel/sprites';
import { GRADE_STARS } from '../core/scoring/stars';

/** The book's rows (`MenuScene`): the same height, a smaller one under the strip, the same margins and gutter. */
const CARD_HEIGHT = 32;
const BAND_CARD_ROW = 28;
const CARD_GAP = 2;
const LIST_TOP = 4;
const BOOK_SIDE = 3;
const BOOK_MARGIN = 14;
const BOOK_GUTTER = 18;
/** A switch, a fold triangle and a play button: a finger wide at the usual zoom, as the book's own small buttons. */
const SMALL = 11;
const GAP = 2;
/** The gap between a row's name and its play button. */
const PLAY_GAP = 5;
/** The widest name the strip's Play names. */
const STRIP_NAME = 60;
/** Each level of the outline is set in this far. */
const INDENT = 6;
/** A row that is off is drawn this pale over its whole height; the switch of the last written part on this faded. */
const OFF_FADE = 0.45;
/** The five grade stars, one pixel apart. */
const STARS = GRADE_STARS * (STAR_FULL.width + 1) - 1;
/** How long "One part must stay on." stays. */
const NOTICE_MS = 3000;

/** What the song page is opened with: a song, or a piece with parts and no song (its phrases as the rows, ft_1_36.AC13). */
export type SongData = { songId: string } | { chartId: string };

/** A row of the page: the whole song (or piece) first, then the outline's rows. */
type PageItem = ShownRow | null;

/**
 * The song page (ft_1_36 rule 10), in the piece book's look: the whole song first, then its tree as a numbered outline.
 * A row's switch puts it in the song or takes it out for this player (rule 5), its triangle folds the rows under it, and
 * its play button plays it (rule 6); a press on the rest of a row only selects it. Up and Down walk the rows, Right and
 * Left unfold and fold, Space turns the switch, Enter plays. The strip holds a switch for each label of the song (rule 16)
 * and Play at its right end, naming what it plays. A piece with parts and no song opens here with its phrases as the rows.
 */
export class SongScene extends PixelScene {
  private opened: SongData = { songId: '' };
  private folded = new Set<string>();
  /** The selected row's id, or null for the whole song. */
  private selected: string | null = null;
  private page = 0;
  private notice: string | null = null;
  /** The row the notice stands on (null: the whole song's row). */
  private noticeRow: string | null = null;
  /** The keys walk the rows only after a first key has shown where the selection is, so no key plays by surprise. */
  private keysShown = false;
  private noticeTimer: Phaser.Time.TimerEvent | null = null;
  /** The items of the page, as last drawn, in order: what Up and Down walk. */
  private items: PageItem[] = [];
  private perPage = 6;

  protected override keyboardNavigation = true;

  constructor() {
    super('song');
  }

  init(data: SongData): void {
    this.opened = data;
    this.selected = null;
    this.page = 0;
    this.notice = null;
    this.noticeRow = null;
    this.keysShown = false;
    this.noticeTimer = null;
    this.folded = startFolded(this.outline()?.rows ?? []);
    // a player's first song page says once what a tick does (rule 10): on the first part's row, beside its box, until a switch is pressed
    const profiles = contextOf(this).profiles;
    const first = 'songId' in data && !profiles.songTickTold ? this.outline()?.rows[0] : undefined;
    if (first) {
      this.notice = t('song.tickHint');
      this.noticeRow = first.id;
      void profiles.markSongTickTold();
    }
  }

  protected override back(): void {
    startScene(this, 'songId' in this.opened ? 'songs' : 'menu');
  }

  private get song(): Song | undefined {
    return 'songId' in this.opened ? contextOf(this).songs.find(this.opened.songId) : undefined;
  }

  /** The outline: the song's with the player's switches, or a lone piece's phrases. */
  private outline(): ResolvedSong | null {
    const context = contextOf(this);
    if ('songId' in this.opened) {
      const song = this.song;
      return song ? context.songs.resolved(song) : null;
    }
    const piece = context.pieces.find(this.opened.chartId);
    return piece ? pieceOutline(piece.chart.id, pieceFactsOf(piece.chart)) : null;
  }

  private get off(): readonly string[] {
    return 'songId' in this.opened ? contextOf(this).profiles.songPartsOff(this.opened.songId) : [];
  }

  /**
   * Up and Down walk the rows (turning the page at its end), Right and Left unfold and fold, Space switches, Enter plays,
   * Page Up and Page Down turn the page. The first key only shows the selection. A key that does nothing on the rows (Up on
   * the first, Down on the last, Left or Right on a row that does not fold) goes to the focus ring, which reaches the strip,
   * the pager and the corners; while the ring is shown, the keys are its own until a press on a row.
   */
  protected override screenKey(e: KeyboardEvent): boolean {
    const outline = this.outline();
    if (!outline || this.focusedButton) return false;
    const ours = ['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', ' ', 'Enter', 'PageUp', 'PageDown'];
    if (!ours.includes(e.key)) return false;
    if (!this.keysShown) {
      this.keysShown = true;
      this.redraw();
      return true;
    }
    const at = this.items.findIndex((item) => (item === null ? this.selected === null : item.row.id === this.selected));
    const row = this.selectedRow(outline);
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp':
      case 'PageDown':
      case 'PageUp': {
        const step = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : e.key === 'PageDown' ? this.perPage : -this.perPage;
        const next = Math.max(0, Math.min(this.items.length - 1, at + step));
        if (next === at) return e.key.startsWith('Page');
        const item = this.items[next]!;
        this.select(item === null ? null : item.row.id, Math.floor(next / this.perPage));
        return true;
      }
      case 'ArrowRight':
      case 'ArrowLeft':
        if (!row || !outline.rows.some((r) => r.parent === row.id)) return false;
        this.fold(row.id, e.key === 'ArrowLeft');
        return true;
      case ' ':
        if (row && !e.repeat) this.toggle(outline, row);
        return true;
      case 'Enter':
        if (!e.repeat) this.play(outline, row);
        return true;
      default:
        return false;
    }
  }

  private selectedRow(outline: ResolvedSong): SongRow | undefined {
    return this.selected === null ? undefined : outline.rows.find((r) => r.id === this.selected);
  }

  private select(id: string | null, page = this.page): void {
    this.selected = id;
    this.keysShown = true;
    this.page = page;
    this.redraw();
  }

  private fold(id: string, folded: boolean): void {
    if (folded) this.folded.add(id);
    else this.folded.delete(id);
    this.redraw();
  }

  /** A press on a row's switch (rule 5): the last written part on stays on, and says why. */
  private toggle(outline: ResolvedSong, row: SongRow): void {
    if (row.kind === 'phrase' || !('songId' in this.opened)) return;
    const step = setPartOn(outline.rows, this.off, row.id, !row.switchOn);
    if (!step.changed) {
      this.say(t('song.lastPart'), row.id);
      return;
    }
    this.saveOff(step.off);
  }

  /** A label's switch in the strip (rule 16): every part with that label on or off at once. */
  private toggleLabel(outline: ResolvedSong, label: string): void {
    const on = labelOn(outline.rows, this.off, label);
    const step = setLabelOn(outline.rows, this.off, label, !on);
    if (step.changed) this.saveOff(step.off);
    // turning off, a part with the label may have been kept on as the last written part: the notice stands on it
    const kept = on ? outline.rows.find((r) => r.labels.includes(label) && !step.off.includes(r.id)) : undefined;
    if (!kept) return;
    const at = kept ? this.items.findIndex((item) => item?.row.id === kept.id) : -1;
    if (at >= 0) this.page = Math.floor(at / this.perPage);
    this.say(t('song.lastPart'), at >= 0 ? kept.id : null);
  }

  private saveOff(off: readonly string[]): void {
    if (!('songId' in this.opened)) return;
    if (this.notice === t('song.tickHint')) this.notice = null;
    void contextOf(this).profiles.setSongPartsOff(this.opened.songId, off).then(() => {
      if (this.scene.isActive()) this.redraw();
    });
    this.redraw();
  }

  private say(notice: string, row: string | null): void {
    this.notice = notice;
    this.noticeRow = row;
    this.noticeTimer?.remove();
    this.noticeTimer = this.time.delayedCall(NOTICE_MS, () => {
      this.notice = null;
      this.redraw();
    });
    this.redraw();
  }

  /** Plays the row (rule 6), or the whole song or piece with no row selected. */
  private play(outline: ResolvedSong, row: SongRow | undefined): void {
    const context = contextOf(this);
    const song = this.song;
    if (!row) {
      if (song) {
        if (context.songs.joinedChart(song)) startScene(this, 'practice', { fromSong: this.opened, chartId: songChartId(song.id) });
      } else if ('chartId' in this.opened) startScene(this, 'practice', { fromSong: this.opened, chartId: this.opened.chartId });
      return;
    }
    const what = rowPlay(row, outline.rows);
    if (!what) return;
    if (what.kind === 'piece') startScene(this, 'practice', { fromSong: this.opened, chartId: what.piece });
    else if (what.kind === 'phrase') startScene(this, 'practice', { fromSong: this.opened, chartId: what.piece, section: { first: what.first, last: what.last } });
    else if (what.kind === 'group' && song) {
      // a group is a section of the whole song: it earns no XP (rule 9)
      const part = context.songs.joinedChart(song)?.parts.find((p) => p.node === what.node);
      if (part) startScene(this, 'practice', { fromSong: this.opened, chartId: songChartId(song.id), section: { first: part.startBar, last: part.endBar } });
    }
  }

  /** The labels of the song's parts, in the order of the ready-made list first: a switch each in the strip (rule 16). */
  private labels(outline: ResolvedSong): string[] {
    const words = [...new Set(outline.rows.flatMap((r) => r.labels))];
    return words;
  }

  protected override bandActions(): ToolbarItem[] {
    const outline = this.outline();
    if (!outline) return [];
    const row = this.selectedRow(outline);
    const name = clipToWidth(row ? row.name : (this.song?.title ?? outline.title), STRIP_NAME, fits);
    const playable = row ? rowPlay(row, outline.rows) !== null : true;
    const labels = 'songId' in this.opened ? this.labels(outline) : [];
    return [
      ...labels.map((label): ToolbarItem => ({
        label: labelText(label), active: labelOn(outline.rows, this.off, label), onClick: () => this.toggleLabel(outline, label),
      })),
      // named, never the picture alone: the strip draws an item with a picture as the picture only (rule 10)
      { label: t('song.play', { name }), main: true, disabled: !playable, onClick: () => this.play(outline, row) },
    ];
  }

  protected draw(): void {
    const { width, height } = this.px;
    const outline = this.outline();
    this.sky();
    this.openBook({ x: BOOK_SIDE, y: LIST_TOP - 2, w: width - 2 * BOOK_SIDE, h: height - LIST_TOP + 1 });
    this.inkWriting = true;
    if (!outline) return;
    const rowHeight = this.bandShown ? BAND_CARD_ROW : CARD_HEIGHT;
    const grid = cardGrid({ width, height, top: LIST_TOP + 4, margin: BOOK_MARGIN, rowHeight, rowGap: CARD_GAP, columnGap: BOOK_GUTTER });
    this.items = [null, ...shownRows(outline.rows, this.folded)];
    // as many rows a page as the piece book shows, so the two read alike
    const slice = pageOf(this.items.length, this.page, { singlePageMax: grid.perPage, perPage: grid.perPage });
    this.page = slice.page;
    this.perPage = grid.perPage;
    this.items.slice(slice.first, slice.first + slice.count).forEach((item, i) => {
      const { x, y } = rectCentre(grid.pageCell(i, this.perPage));
      const left = x - grid.cardWidth / 2;
      const top = y - rowHeight / 2;
      if (item === null) this.wholeRow(outline, left, top, grid.cardWidth);
      else this.nodeRow(outline, item, left, top, grid.cardWidth);
    });
    if (slice.paged) {
      this.pager(slice, (page) => {
        this.page = page;
        this.redraw();
      });
    }
  }

  /** The first row: the whole song (or piece), its bars, tempo, key and meter, its best stars and its play button. */
  private wholeRow(outline: ResolvedSong, left: number, top: number, width: number): void {
    const { profiles } = contextOf(this);
    const song = this.song;
    const piece = 'chartId' in this.opened ? contextOf(this).pieces.find(this.opened.chartId) : undefined;
    const title = song ? song.title : piece ? pieceTitle(piece.chart) : outline.title;
    this.lit(left, top, width, this.selected === null);
    const chartId = song ? songChartId(song.id) : 'chartId' in this.opened ? this.opened.chartId : '';
    const name = this.button({
      x: left + (width - SMALL - GAP) / 2, y: top + CARD_HEIGHT / 4, width: width - SMALL - GAP, height: CARD_HEIGHT / 2, look: 'ink', align: 'left',
      label: clipToWidth(title, width - SMALL - 16, fits), labelWidth: width - SMALL - 12, onClick: () => this.select(null),
    });
    name.setActive(this.selected === null);
    this.playButton(left + width - SMALL / 2 - 2, top + CARD_HEIGHT / 4, t('song.play', { name: title }), true, () => this.play(outline, undefined));
    const line = top + 19;
    if (this.notice && this.noticeRow === null) {
      this.root.add(new PixelText(this, left + 6, line, this.notice, { color: C.redDark }).setName('songNotice'));
      return;
    }
    let x = left + 6;
    x = this.text(x, line, t('song.barRange', { first: 1, last: outline.bars }), C.umberDark) + 5;
    this.text(x, line, `${t('song.tempo', { bpm: outline.values.bpm })} ${keyName(outline.values.key)} ${meterName(outline.values.meter)}`, C.umberDark);
    pixelStars(this, this.root, left + width - 2 - STARS, line, profiles.recordFor(chartId)?.bestGrade ?? 0, { gap: 1, ink: true });
  }

  /** A notice on a row, from under its switch so a whole sentence fits the row. */
  private rowNotice(notice: string, line: number, left: number, width: number): void {
    this.root.add(new PixelText(this, left + 4, line, clipToWidth(notice, width - 6, fits), { color: C.redDark }).setName('songNotice'));
  }

  /** One row of the outline (rule 10). */
  private nodeRow(outline: ResolvedSong, item: ShownRow, left: number, top: number, width: number): void {
    const { row } = item;
    const inSong = 'songId' in this.opened;
    this.lit(left, top, width, this.selected === row.id);
    const faded: { setAlpha(a: number): unknown }[] = [];
    let x = left + 2 + row.depth * INDENT;
    const mid = top + CARD_HEIGHT / 4;
    // the switch: a box, ticked while the part is in the song
    if (inSong && row.kind !== 'phrase') {
      const last = keepsLastPartOn(outline.rows, this.off, row.id);
      const box = this.button({
        x: x + SMALL / 2, y: mid, width: SMALL, height: SMALL, look: 'ink', inkBox: true, label: t(row.switchOn ? 'song.switchOn' : 'song.switchOff'),
        ...(row.switchOn ? { icon: TOOL_ICONS.tick, iconOnly: true } : { icon: createBitmap(1, 1), iconOnly: true }),
        onClick: () => this.toggle(outline, row),
      });
      if (last) box.setAlpha(OFF_FADE);
      x += SMALL + GAP + 1;
    }
    // the fold triangle, answering over the row's whole height
    if (item.folds) {
      this.button({
        x: x + SMALL / 2, y: top + CARD_HEIGHT / 2, width: SMALL, height: CARD_HEIGHT - 2, look: 'ink',
        label: t(item.hidden > 0 ? 'song.unfold' : 'song.fold'), icon: item.hidden > 0 ? TOOL_ICONS.folded : TOOL_ICONS.unfolded, iconOnly: true,
        onClick: () => this.fold(row.id, item.hidden === 0),
      });
    }
    x += SMALL + GAP;
    // the name: number, mark of a link or a blank, name and labels; a press selects the row
    const mark = row.kind === 'link' ? TOOL_ICONS.link : row.kind === 'blank' ? TOOL_ICONS.blank : null;
    const right = left + width - 2;
    // a wide gap before the play button, so a press near the end of a name never starts play (rule 6)
    const nameRight = right - SMALL - PLAY_GAP;
    const hidden = item.hidden > 0 ? ` ${t('song.hidden', { count: item.hidden })}` : '';
    const room = nameRight - x - 8 - (mark ? mark.width + 2 : 0);
    const label = clipToWidth(`${row.number} ${row.name}${hidden}`, room, fits);
    const nameButton = this.button({
      x: (x + nameRight) / 2, y: mid, width: nameRight - x, height: CARD_HEIGHT / 2, look: 'ink', align: 'left',
      label, labelWidth: nameRight - x - 6, ...(mark ? { icon: mark } : {}),
      onClick: () => this.select(row.id),
    });
    nameButton.setActive(this.selected === row.id);
    faded.push(nameButton);
    // the labels, as small tabs after the name while they fit
    let tx = x + 6 + (mark ? mark.width + 2 : 0) + fits(label) + 4;
    for (const word of row.labels) {
      const text = labelText(word);
      if (tx + fits(text) + 4 > nameRight) break;
      tx = this.tab(tx, top + 3, text, faded);
    }
    if (rowPlay(row, outline.rows)) this.playButton(right - SMALL / 2, mid, t('song.play', { name: row.name }), true, () => this.play(outline, row));
    // the line under it: song bars, tempo, key and meter (an own value on a red chip beside the crossed-out one it
    // replaces); a follower's value only while it fits, an own value always
    const line = top + 19;
    if (this.notice && this.noticeRow === row.id) {
      // the notice stands on the row it is about, in place of its values
      this.rowNotice(this.notice, line, left, width);
      if (!row.on) faded.forEach((o) => o.setAlpha(OFF_FADE));
      return;
    }
    let vx = x + 4;
    if (row.bars > 0) vx = this.text(vx, line, t('song.barRange', { first: row.startBar, last: row.endBar }), C.umberDark, faded) + 5;
    if (row.kind !== 'phrase') {
      vx = this.value(vx, line, row.bpm, (v) => t('song.tempo', { bpm: v }), faded, right);
      vx = this.value(vx, line, row.key, keyName, faded, right);
      vx = this.value(vx, line, row.meter, meterName, faded, right);
    }
    // a piece's best stars, at the line's end while they fit
    if ((row.kind === 'piece' || row.kind === 'link') && row.piece && vx + STARS <= right) {
      faded.push(...pixelStars(this, this.root, right - STARS, line, contextOf(this).profiles.recordFor(row.piece)?.bestGrade ?? 0, { gap: 1, ink: true }));
    }
    if (!row.on) faded.forEach((o) => o.setAlpha(OFF_FADE));
  }

  /** The selected row is lit: a pale band behind it over its whole height, drawn before what is written on it. */
  /** A row's ground: a thin rule under it, so each row reads as one block, and the gold band while it is selected. */
  private lit(left: number, top: number, width: number, selected: boolean): void {
    const rule = createBitmap(width - 4, 1);
    rule.pixels.fill(C.umberLight);
    this.root.add(new PixelImage(this, left + 2, top + CARD_HEIGHT - 3, rule).setName('rowRule').setAlpha(0.6));
    if (!selected) return;
    const band = createBitmap(width, CARD_HEIGHT - 4);
    band.pixels.fill(C.goldLight);
    this.root.add(new PixelImage(this, left, top, band).setName('selectedRow').setAlpha(0.6));
  }

  private playButton(x: number, y: number, label: string, enabled: boolean, onClick: () => void): PixelButton {
    return this.button({ x, y, width: SMALL, height: SMALL, look: 'ink', inkBox: true, icon: TOOL_ICONS.play, iconOnly: true, label, disabled: !enabled, onClick });
  }

  /** Text at (x, y); returns where it ends. */
  private text(x: number, y: number, value: string, color: number, faded?: { setAlpha(a: number): unknown }[]): number {
    const text = new PixelText(this, x, y, value, { color });
    this.root.add(text);
    faded?.push(text);
    return x + text.width;
  }

  /**
   * A value of a row (rule 3): a follower's in pale ink; an own value in red ink on a chip, beside its parent's crossed
   * out. Returns where it ends.
   */
  private value<T>(x: number, y: number, value: RowValue<T>, format: (v: T) => string, faded: { setAlpha(a: number): unknown }[], right: number): number {
    if (!value.own) return x + fits(format(value.value)) > right ? x : this.text(x, y, format(value.value), C.umberLight, faded) + 5;
    const before = format(value.parent);
    const end = this.text(x, y, before, C.umberLight, faded);
    const strike = createBitmap(Math.max(1, end - x + 2), 1);
    strike.pixels.fill(C.redDark);
    const struck = new PixelImage(this, x - 1, y + 3, strike).setName('struck');
    this.root.add(struck);
    faded.push(struck);
    return this.chip(end + 3, y, format(value.value), faded) + 5;
  }

  /** A small chip with red ink (an own value). */
  private chip(x: number, y: number, value: string, faded: { setAlpha(a: number): unknown }[]): number {
    const text = new PixelText(this, x + 2, y, value, { color: C.redDark }).setName('ownValue');
    const box = outlineBox(text.width + 4, 11, C.redDark);
    const image = new PixelImage(this, x, y - 2, box);
    this.root.add(image);
    this.root.add(text);
    faded.push(image, text);
    return x + box.width;
  }

  /** A label as a small tab (rule 16). */
  private tab(x: number, y: number, value: string, faded: { setAlpha(a: number): unknown }[]): number {
    const text = new PixelText(this, x + 2, y, value, { color: C.umberDark }).setName('labelTab');
    const box = outlineBox(text.width + 4, 11, C.umberLight);
    const image = new PixelImage(this, x, y - 2, box);
    this.root.add(image);
    this.root.add(text);
    faded.push(image, text);
    return x + box.width + 3;
  }
}

const fits = (text: string): number => measure(drawnText(text));

/** A label's name: the ready-made list's own string, or the author's word as written. */
function labelText(word: string): string {
  const key = `song.label.${word}`;
  return key in strings ? t(key as StringKey) : word;
}

/** A one-pixel outline of `w` by `h` in `colour`. */
function outlineBox(w: number, h: number, colour: number): Bitmap {
  const box = createBitmap(w, h);
  for (let i = 0; i < w; i++) box.pixels[i] = box.pixels[(h - 1) * w + i] = colour;
  for (let j = 0; j < h; j++) box.pixels[j * w] = box.pixels[j * w + w - 1] = colour;
  return box;
}
