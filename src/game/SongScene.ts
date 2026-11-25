import { cardGrid } from '../core/layout/cardGrid';
import { pageOf } from '../core/layout/paging';
import { rectCentre } from '../core/layout/rect';
import { keyName, meterName, pieceOutline, rowPlay, shownRows, startFolded, type ShownRow } from '../core/song/outline';
import { pieceFactsOf, type ResolvedSong, type RowValue, type SongRow } from '../core/song/resolve';
import { walkSong, type Song, type SongNode, type SongValues } from '../core/song/schema';
import { addNode, freeNodeId, moveNode, removeNode, renameNode, setValue, NEW_BLANK_BARS, type MoveKind } from '../core/song/edit';
import { canRedo, canUndo, push, redo, startHistory, undo, type History } from '../core/editor/history';
import { openTextField } from './ui/textField';
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
import { PixelScene, type MenuItem, type ToolbarItem } from './ui/pixel/PixelScene';
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
/** A choice of the bubble's Add and Move, in layout cells. */
const CHOICE_CELL = { w: 64, h: 12 };
/** A value's choice: wide enough for Follow the song on one line. */
const VALUE_CELL = { w: 112, h: 12 };
/**
 * The values slots 2 to 4 offer (rule 12), beside Follow the song: `AX-3 provisional:` a short list of the tempos, keys and
 * meters a beginner's song is written in (the piece maker writes 2/4, 3/4 and 4/4); a value set otherwise is offered too.
 */
const TEMPOS: readonly number[] = [60, 70, 80, 90, 100, 110, 120];
const KEYS: readonly SongValues['key'][] = [
  { fifths: 0, mode: 'major' }, { fifths: 1, mode: 'major' }, { fifths: 2, mode: 'major' }, { fifths: -1, mode: 'major' }, { fifths: -2, mode: 'major' },
  { fifths: 0, mode: 'minor' }, { fifths: 1, mode: 'minor' }, { fifths: -1, mode: 'minor' },
];
const METERS: readonly SongValues['meter'][] = [{ num: 2, den: 4 }, { num: 3, den: 4 }, { num: 4, den: 4 }];

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
  /** The notice is the first visit's hint on the tick (rule 10): in plain ink, as it reports no mistake, until a switch is pressed. */
  private tickHint = false;
  /** The row the notice stands on (null: the whole song's row). */
  private noticeRow: string | null = null;
  /** The keys walk the rows only after a first key has shown where the selection is, so no key plays by surprise. */
  private keysShown = false;
  private noticeTimer: Phaser.Time.TimerEvent | null = null;
  /** The items of the page, as last drawn, in order: what Up and Down walk. */
  private items: PageItem[] = [];
  /** Where each row on the page was drawn, by its id ('' for the whole song's): for a press, a field and a landing line. */
  private rowRects = new Map<string, { left: number; top: number; width: number; depth: number }>();
  /** An own song's edits on this visit (rule 12), for Undo and Redo; null for a bundled song or a lone piece. */
  private history: History<Song> | null = null;
  /** The faint line where a move would put the row (d286), while the pointer rests on the choice. */
  private landing: PixelImage | null = null;
  /** The open title or name field's closer, while one is open. */
  private closeField: (() => void) | null = null;
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
    this.tickHint = false;
    this.folded = startFolded(this.outline()?.rows ?? []);
    const own = 'songId' in data ? contextOf(this).ownSongs.get(data.songId) : undefined;
    this.history = own ? startHistory(own) : null;
    this.closeField = null;
    this.landing = null;
    // a player's first song page says once what a tick does (rule 10): on the first part's row, beside its box, until a switch is pressed
    const profiles = contextOf(this).profiles;
    const first = 'songId' in data && !profiles.songTickTold ? this.outline()?.rows[0] : undefined;
    if (first) {
      this.notice = t('song.tickHint');
      this.noticeRow = first.id;
      this.tickHint = true;
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
    if (this.undoKey(e)) return true;
    if (e.key === 'Delete' && this.history) {
      const node = this.selectedNode(this.history.present);
      if (node) this.remove(this.history.present, node);
      return node !== undefined;
    }
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
    if (this.tickHint) this.notice = null;
    this.tickHint = false;
    void contextOf(this).profiles.setSongPartsOff(this.opened.songId, off).then(() => {
      if (this.scene.isActive()) this.redraw();
    });
    this.redraw();
  }

  private say(notice: string, row: string | null): void {
    this.notice = notice;
    this.tickHint = false;
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

  /** The own song being edited (rule 12), or null: a bundled song, and a piece's own parts, are read only. */
  private get ownSong(): Song | null {
    return this.history?.present ?? null;
  }

  /** The selected row's node in the own song, or undefined for the whole song. */
  private selectedNode(song: Song): SongNode | undefined {
    return this.selected === null ? undefined : walkSong(song.nodes).find(({ node }) => node.id === this.selected)?.node;
  }

  /** Keep an edit: one step to undo, saved on this device at once, the page drawn again. */
  private commit(next: Song): void {
    if (!this.history) return;
    this.history = push(this.history, next);
    this.keep();
  }

  private keep(): void {
    if (!this.history) return;
    // an open name field belongs to the tree as it was: it goes; so does the first visit's hint, once the song is being written
    this.closeField?.();
    if (this.tickHint) this.notice = null;
    this.tickHint = false;
    this.closeField = null;
    const song = this.history.present;
    const { ownSongs, profiles } = contextOf(this);
    void ownSongs.save(song);
    const ids = new Set(walkSong(song.nodes).map(({ node }) => node.id));
    if (this.selected !== null && !ids.has(this.selected)) this.selected = null;
    // the player's switches forget rows that left the song, so a row put back or made again comes back on
    const off = profiles.songPartsOff(song.id);
    if (off.some((id) => !ids.has(id))) void profiles.setSongPartsOff(song.id, off.filter((id) => ids.has(id)));
    this.redraw();
  }

  /** Ctrl+Z undoes an edit of an own song, Ctrl+Y and Ctrl+Shift+Z redo it; false for any other key. */
  private undoKey(e: KeyboardEvent): boolean {
    if (!this.history || !(e.ctrlKey || e.metaKey) || !['z', 'Z', 'y'].includes(e.key)) return false;
    if (e.key === 'y' || e.shiftKey) this.redoEdit();
    else this.undoEdit();
    return true;
  }

  private undoEdit(): void {
    if (!this.history || !canUndo(this.history)) return;
    this.history = undo(this.history);
    this.keep();
  }

  private redoEdit(): void {
    if (!this.history || !canRedo(this.history)) return;
    this.history = redo(this.history);
    this.keep();
  }

  /** The row under a press (art pixels): its id, '' mapped to null for the whole song; undefined over no row. */
  private rowAt(at: { x: number; y: number }): string | null | undefined {
    for (const [id, r] of this.rowRects) {
      if (at.x >= r.left && at.x < r.left + r.width && at.y >= r.top && at.y < r.top + CARD_HEIGHT) return id === '' ? null : id;
    }
    return undefined;
  }

  protected override hasBubbleAt(): boolean {
    return this.history !== null;
  }

  /**
   * An own song's editing in the bubble, in fixed slots (rule 12): 0 add, 1 name, 2 tempo, 3 key, 4 meter, 5 write or
   * edit, 6 move, 7 remove. A press on a row selects it first; on empty paper the whole
   * song is selected, so Add puts a part at the end. A bundled song has no bubble. An option's choices open in a row under
   * the selected row, never over other rows' names.
   */
  protected override bubbleOptions(at: { x: number; y: number } | null): (ToolbarItem | null)[] | null {
    const song = this.ownSong;
    if (!song) return null;
    if (at) {
      const hit = this.rowAt(at);
      const id = hit === undefined ? null : hit;
      if (id !== this.selected) {
        this.selected = id;
        this.redraw();
      }
    }
    const node = this.selectedNode(song);
    const moves = node ? this.moveChoices(song, node) : [];
    // a piece holds its own numbers (rule 4) and a link plays its piece as it is: neither sets a value here
    const values = node?.kind !== 'piece' && node?.kind !== 'link';
    const value = <F extends keyof SongValues>(key: StringKey, icon: ToolbarItem['icon'], field: F, offered: readonly SongValues[F][], name: (v: SongValues[F]) => string): ToolbarItem => ({
      label: t(key), ...(icon ? { icon } : {}), disabled: !values, onClick: () => this.choicesUnderRow(this.valueChoices(song, node, field, offered, name), 2, VALUE_CELL),
    });
    return [
      { label: t('song.add'), icon: TOOL_ICONS.add, onClick: () => this.choicesUnderRow(this.addChoices(song, node)) },
      { label: t('song.rename'), icon: TOOL_ICONS.rename, onClick: () => this.rename(song, node) },
      value('song.tempoOption', TOOL_ICONS.tempo, 'bpm', TEMPOS, (v) => t('song.tempo', { bpm: v })),
      value('song.keyOption', TOOL_ICONS.circle, 'key', KEYS, keyName),
      value('song.meterOption', TOOL_ICONS.meter, 'meter', METERS, meterName),
      this.writeOption(song, node),
      { label: t('song.move'), icon: TOOL_ICONS.move, disabled: moves.every((m) => m.disabled), onClick: () => this.choicesUnderRow(moves) },
      { label: t('song.remove'), icon: TOOL_ICONS.trash, disabled: !node, onClick: () => node && this.remove(song, node) },
    ];
  }

  /** An option's choices in a row (or a few) under the selected row (rule 12), `columns` wide at most. */
  private choicesUnderRow(items: MenuItem[], columns = 2, cell = CHOICE_CELL): void {
    const r = this.rowRects.get(this.selected ?? '');
    if (!r) return;
    this.openMenu({ rect: { x: r.left, y: r.top, width: r.width, height: CARD_HEIGHT - 4 } }, items, { cell, columns: Math.min(columns, items.length), open: 'below' });
  }

  /**
   * Slots 2 to 4's choices (rule 12): Follow the song (the group, inside one) first on a row, then the values, the one in
   * use lit. A value equal to the one the row would follow makes it follow, so a row never sets its parent's value again.
   * With no row the song's own default is set. `AX-3 provisional:` a changed song or group value does not yet rewrite the
   * pieces that follow it (rule 4): each keeps its numbers and shows them as its own.
   */
  private valueChoices<F extends keyof SongValues>(song: Song, node: SongNode | undefined, field: F, offered: readonly SongValues[F][], name: (v: SongValues[F]) => string): MenuItem[] {
    const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
    const row = node ? contextOf(this).songs.resolved(song).rows.find((r) => r.id === node.id) : undefined;
    const current = (row ? row[field] : { value: song[field], own: true, parent: song[field] }) as RowValue<SongValues[F]>;
    const id = node?.id ?? null;
    const pick = (value: SongValues[F] | undefined) => () => {
      const next = setValue(song, id, field, node && value !== undefined && same(value, current.parent) ? undefined : value);
      if (!same(next, song)) this.commit(next);
    };
    const values = offered.some((v) => same(v, current.value)) ? offered : [current.value, ...offered];
    const follow: MenuItem[] = node ? [{ label: t(row?.parent ? 'song.followGroup' : 'song.follow'), active: !current.own, onPick: pick(undefined) }] : [];
    return [...follow, ...values.map((v) => ({ label: name(v), active: current.own && same(v, current.value), onPick: pick(v) }))];
  }

  /**
   * Slot 5 (rules 11 and 12): Write a blank, or Edit an own piece, in the piece maker; Back there returns to this page.
   * Shown and greyed on any other row and on the whole song.
   */
  private writeOption(song: Song, node: SongNode | undefined): ToolbarItem {
    if (node?.kind === 'piece' && contextOf(this).ownPieces.get(node.piece)) {
      const piece = node.piece;
      return { label: t('song.edit'), icon: TOOL_ICONS.write, onClick: () => startScene(this, 'editor', { id: piece, song: { songId: song.id, nodeId: node.id } }) };
    }
    const blank = node?.kind === 'blank' ? node : undefined;
    return { label: t('song.write'), icon: TOOL_ICONS.write, disabled: !blank, onClick: () => blank && this.write(song, blank.id) };
  }

  /** The piece maker writes the blank (rule 11): a new piece of its bars in the values it takes. */
  private write(song: Song, nodeId: string): void {
    startScene(this, 'editor', { song: { songId: song.id, nodeId } });
  }

  /** Slot 0's choices: a new part or group after the selected row (at the end with none), and into a selected group. */
  private addChoices(song: Song, node: SongNode | undefined): MenuItem[] {
    const place = node ? { after: node.id } : ('end' as const);
    const blank = (): SongNode => {
      const name = t('song.newPart', { n: walkSong(song.nodes).filter(({ node: n }) => n.kind === 'blank').length + 1 });
      return { kind: 'blank', id: freeNodeId(song, name), name, bars: NEW_BLANK_BARS };
    };
    const group = (): SongNode => {
      const name = t('song.newGroup', { n: walkSong(song.nodes).filter(({ node: n }) => n.kind === 'group').length + 1 });
      return { kind: 'group', id: freeNodeId(song, name), name, nodes: [blank()] };
    };
    // each choice shows where the new row will stand while the pointer rests on it (d286)
    const choice = (label: string, at: Parameters<typeof addNode>[1], make: () => SongNode): MenuItem => {
      const made = make();
      const next = addNode(song, at, made);
      return {
        label,
        preview: (on) => this.showLanding(on ? next : null, made.id),
        onPick: () => {
          this.selected = made.id;
          this.commit(next);
        },
      };
    };
    return [
      choice(t('song.addPart'), place, blank),
      choice(t('song.addGroup'), place, group),
      ...(node?.kind === 'group' ? [choice(t('song.addInside'), { inside: node.id }, blank)] : []),
    ];
  }

  /** Slot 6's choices: each move, shown as a faint line where the row would land while the pointer rests on it (d286). */
  private moveChoices(song: Song, node: SongNode): MenuItem[] {
    const kinds: { kind: MoveKind; key: StringKey }[] = [
      { kind: 'up', key: 'song.moveUp' }, { kind: 'down', key: 'song.moveDown' }, { kind: 'into', key: 'song.moveInto' }, { kind: 'out', key: 'song.moveOut' },
    ];
    return kinds.map(({ kind, key }) => {
      const moved = moveNode(song, node.id, kind);
      return {
        label: t(key), disabled: moved === null,
        preview: (on: boolean) => this.showLanding(on && moved ? moved : null, node.id),
        onPick: () => moved && this.commit(moved),
      };
    });
  }

  /**
   * The faint line where a moved row lands: under the row it will follow in the moved song (the whole song's row when it
   * goes first), set in to its new depth. Nothing when that row is not on this page.
   */
  private showLanding(moved: Song | null, id: string): void {
    this.landing?.destroy();
    this.landing = null;
    if (!moved) return;
    const rows = shownRows(contextOf(this).songs.resolved(moved).rows, this.folded).map((r) => r.row);
    const at = rows.findIndex((r) => r.id === id);
    if (at < 0) return;
    // the row it follows: the nearest one above it that is not inside it
    const inside = new Set([id]);
    for (const r of rows) if (r.parent !== null && inside.has(r.parent)) inside.add(r.id);
    const before = rows.slice(0, at).reverse().find((r) => !inside.has(r.id));
    const anchor = this.rowRects.get(before?.id ?? '');
    if (!anchor) return;
    const depth = rows[at]!.depth;
    const x = anchor.left + 2 + depth * INDENT;
    const line = createBitmap(Math.max(4, anchor.left + anchor.width - 4 - x), 2);
    line.pixels.fill(C.redDark);
    this.landing = new PixelImage(this, x, anchor.top + CARD_HEIGHT - 4, line).setName('landingLine').setAlpha(0.7);
    this.root.add(this.landing);
  }

  /** Slot 1: a field over the row's name (the song's title with no row selected); Enter keeps it, Esc does not. */
  private rename(song: Song, node: SongNode | undefined): void {
    const rect = this.rowRects.get(node?.id ?? '');
    if (!rect) return;
    this.closeField?.();
    const current = node ? ('name' in node && node.name ? node.name : this.selectedRowName()) : song.title;
    this.closeField = openTextField(
      { scene: this, root: this.root, scale: this.px.scale, x: rect.left + 2, y: rect.top + 1, w: rect.width - SMALL - 6, h: CARD_HEIGHT / 2 - 2 },
      {
        value: current, label: t(node ? 'song.partName' : 'song.titleLabel'), maxLength: 60,
        onDone: (value) => {
          this.closeField = null;
          const now = this.history?.present;
          if (!now || value === '' || value === current) return;
          this.commit(node ? renameNode(now, node.id, value) : { ...now, title: value });
        },
        onCancel: () => {
          this.closeField = null;
        },
      },
    );
  }

  private selectedRowName(): string {
    const outline = this.outline();
    return (outline && this.selectedRow(outline)?.name) ?? '';
  }

  /** Slot 7: the row leaves the song at once (no question: Undo is in the strip), and the page says so (rule 12). */
  private remove(song: Song, node: SongNode): void {
    const next = removeNode(song, node.id);
    const name = 'name' in node && node.name ? node.name : this.selectedRowName();
    if (!next) {
      this.say(t('song.lastRow'), null);
      return;
    }
    this.commit(next);
    this.say(t('song.removed', { name }), null);
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
    const history = this.history;
    const edits: ToolbarItem[] = history
      ? [
        { label: t('editor.undo'), icon: TOOL_ICONS.undo, disabled: !canUndo(history), onClick: () => this.undoEdit() },
        { label: t('editor.redo'), icon: TOOL_ICONS.redo, disabled: !canRedo(history), onClick: () => this.redoEdit() },
      ]
      : [];
    return [
      ...edits,
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
    this.rowRects.clear();
    this.landing = null;
    // as many rows a page as the piece book shows, so the two read alike
    const slice = pageOf(this.items.length, this.page, { singlePageMax: grid.perPage, perPage: grid.perPage });
    this.page = slice.page;
    this.perPage = grid.perPage;
    this.items.slice(slice.first, slice.first + slice.count).forEach((item, i) => {
      const { x, y } = rectCentre(grid.pageCell(i, this.perPage));
      const left = x - grid.cardWidth / 2;
      const top = y - rowHeight / 2;
      this.rowRects.set(item === null ? '' : item.row.id, { left, top, width: grid.cardWidth, depth: item === null ? -1 : item.row.depth });
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
    this.root.add(new PixelText(this, left + 4, line, clipToWidth(notice, width - 6, fits), { color: this.tickHint ? C.umberDark : C.redDark }).setName('songNotice'));
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
    this.rowEnd(outline, row, right - SMALL / 2, mid);
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
      const tempo = (v: number) => t('song.tempo', { bpm: v });
      // own values that do not all fit with the values they replace drop the crossed-out ones: the chips alone
      const compact = vx + valueWidth(row.bpm, tempo) + valueWidth(row.key, keyName) + valueWidth(row.meter, meterName) > right;
      vx = this.value(vx, line, row.bpm, tempo, faded, right, compact);
      vx = this.value(vx, line, row.key, keyName, faded, right, compact);
      vx = this.value(vx, line, row.meter, meterName, faded, right, compact);
    }
    // a piece's best stars, at the line's end while they fit
    if ((row.kind === 'piece' || row.kind === 'link') && row.piece && vx + STARS <= right) {
      faded.push(...pixelStars(this, this.root, right - STARS, line, contextOf(this).profiles.recordFor(row.piece)?.bestGrade ?? 0, { gap: 1, ink: true }));
    }
    if (!row.on) faded.forEach((o) => o.setAlpha(OFF_FADE));
  }

  /** The button at a row's right end: play (rule 6), or on a blank of an own song a pen that writes it in the piece maker (rule 11). */
  private rowEnd(outline: ResolvedSong, row: SongRow, x: number, y: number): void {
    if (rowPlay(row, outline.rows)) {
      this.playButton(x, y, t('song.play', { name: row.name }), true, () => this.play(outline, row));
      return;
    }
    const own = this.ownSong;
    if (row.kind !== 'blank' || !own) return;
    this.button({ x, y, width: SMALL, height: SMALL, look: 'ink', inkBox: true, icon: TOOL_ICONS.write, iconOnly: true, label: t('song.writePart', { name: row.name }), onClick: () => this.write(own, row.id) });
  }

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
  private value<T>(x: number, y: number, value: RowValue<T>, format: (v: T) => string, faded: { setAlpha(a: number): unknown }[], right: number, compact: boolean): number {
    if (!value.own) return x + fits(format(value.value)) > right ? x : this.text(x, y, format(value.value), C.umberLight, faded) + 5;
    if (compact) return this.chip(x, y, format(value.value), faded) + 5;
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

/** How wide a row's value is drawn: an own value with the crossed-out one it replaces, a follower's alone. */
function valueWidth<T>(value: RowValue<T>, format: (v: T) => string): number {
  return value.own ? fits(format(value.parent)) + 3 + fits(format(value.value)) + 4 + 5 : fits(format(value.value)) + 5;
}

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
