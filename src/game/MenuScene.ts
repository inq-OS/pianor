import { pieceTitle } from '../core/text/pieceTitle';
import { cardGrid } from '../core/layout/cardGrid';
import { pageOf, stepItem, type PagingOptions } from '../core/layout/paging';
import { rectCentre } from '../core/layout/rect';
import { t } from '../core/text/strings';
import { contextOf } from './context';
import type { Piece } from './content';
import { drawPieceInfo } from './menu/PieceInfoCard';
import { BOOKMARKS, groupsOf, piecesUnderBookmark, piecesThatAreOn, type Bookmark, type PieceGroup } from './pieceList';
import { BOOK_ORDERS, orderBook, type BookOrder } from '../core/layout/bookOrder';
import type { MenuItem } from './ui/pixel/PixelScene';
import { curriculumMark, type CurriculumMark } from '../core/curriculum/bookMark';
import { dayNumber } from '../core/curriculum/evaluate';
import type { Medal } from '../core/curriculum/play';
import { CHARACTER_PIECES } from './adventure/scenesData';
import { pieceClef, pieceLearned } from '../core/learn/route';
import { clefPrize } from './practice/rewardNotes';
import { CHARACTER_INK } from './ui/pixel/talkArt';
import { teacherStatuses } from './teacher/teacherStatuses';
import { dayString } from '../io/teacher/teacherDesk';
import type { ToolbarItem } from './ui/pixel/PixelScene';
import type { PieceRecord } from '../core/progression';
import { C } from './ui/pixel/palette';
import { PixelBar, PixelButton, PixelImage, PixelText, pixelStars } from './ui/pixel/PixelObjects';
import { PixelScene } from './ui/pixel/PixelScene';
import { STAR_FULL } from './ui/pixel/sprites';
import { GRADE_STARS } from '../core/scoring/stars';
import { BUBBLE, ICONS, NEW_PIECE_HEIGHT, PENCIL, newPieceArt } from './ui/pixel/iconArt';
import { blit, createBitmap, recolor, type Bitmap } from './ui/pixel/bitmap';
import { measure, drawnText } from './ui/pixel/font';
import { clipToWidth } from '../core/text/clip';
import { HAT, hatPicture } from './ui/pixel/menuArt';
import { ART_DETAIL } from '../core/layout/frame';
import type { Rect } from '../core/layout/rect';
import { startScene } from './scenes';
import { pressHide, type ArmedHide } from '../core/progression/pieceSwitch';
import { TOOL_ICONS } from './ui/pixel/toolArt';

/** Piece maker (from the main menu): the Make list opens directly, with Back to the main menu. Saves no progress. */
export const MAKER_KEY = 'maker';

/**
 * `forKiur`: the piece picked goes to Kiur, not to the piano: `learn` opens it to be learned bar by bar (ft_1_32 rule 14),
 * `tug` takes it to the room for his tug (ft_1_21.AC14).
 */
export interface MenuData {
  forKiur?: 'learn' | 'tug';
}

const CARD_HEIGHT = 32;
/** Under the band (ft_1_20) a card's row is 28 high, so three rows still fit a page of the book in the 124 rows: six pieces a page. */
const BAND_CARD_ROW = 28;
const CARD_GAP = 2;
/** The New piece staff's room at each end of its card, so it starts where a piece's title does. */
const NEW_PIECE_INSET = 5;
const MARGIN = 6;
/** The open book's cover from the screen's sides, the list's margin inside it, and the gutter between its pages, in cells. */
const BOOK_SIDE = 3;
const BOOK_MARGIN = 14;
const BOOK_GUTTER = 18;
/** The group signs on a title's line keep this far in from the card's right end, clear of the page's turned corner, and this far apart. */
const SIGN_INSET = 6;
const SIGN_GAP = 3;
/** The bar under a curriculum piece's days left: how near its level is to the expected one. */
const NEAR_BAR = { w: 14, h: 5 } as const;
/** A finished curriculum piece's hat (d139): its medal's colours, or strong green without one; light, mid, dark. */
const FINISHED_HAT: Readonly<Record<Medal | 'none', readonly [number, number, number]>> = {
  gold: [C.goldLight, C.gold, C.goldDark],
  silver: [C.cream, C.silver, C.silverDark],
  bronze: [C.orangeLight, C.orange, C.orangeDark],
  none: [C.leafLight, C.leaf, C.leafDark],
};
/** Each bookmark's picture (ft_1_12.AC10): the book's whole list, the pencil of an own piece, the teacher's hat, a head for the characters'. */
const BOOKMARK_ICON: Readonly<Record<Bookmark, () => Bitmap>> = { all: () => TOOL_ICONS.bookOpen, own: () => ICONS.maker, curriculum: () => TOOL_ICONS.teacherHat, character: () => TOOL_ICONS.head };
/** Each bookmark's ribbon: its cloth, and the cloth's dark edge. */
const BOOKMARK_CLOTH: Readonly<Record<Bookmark, readonly [number, number]>> = {
  all: [C.redDark, C.umberDark], own: [C.leaf, C.leafDark], curriculum: [C.duskLight, C.duskDark], character: [C.teal, C.tealDark],
};
/**
 * On the left page the rules under the pieces start this much further in, clear of the bookmarks in its outer margin;
 * the right page's outer margin is free for more bookmarks later.
 */
const LEFT_SHIFT = 12;
/**
 * A bookmark's ribbon, in cells: a closed one hangs `shut` wide from `out` cells in; the open one is `open` wide from the
 * screen's edge, lying over the page's margin up to the pieces. Its height and the gap between two.
 */
const TAB = { shut: 16, open: 30, h: 19, gap: 3, out: 5 } as const;
/** A page's turned-up corner (the pager, ft_1_12 rule 1) is this many cells on a side, this far in from the page's outer and bottom edges. */
const FOLD = { size: 17, inX: 5, inY: 6 } as const;
/** The bookmarks start this far under the book's top, clear of the door in the screen's top left corner. */
const TAB_TOP = 22;
/** Each order's picture in the order button's choices (ft_1_12.AC11). */
const ORDER_ICON: Readonly<Record<BookOrder, Bitmap>> = {
  book: TOOL_ICONS.orderBook, achieved: TOOL_ICONS.orderAchieved, deadline: TOOL_ICONS.orderDeadline, difficulty: TOOL_ICONS.steps, title: TOOL_ICONS.orderTitle, recent: TOOL_ICONS.orderRecent,
};
const ORDER_CELL = { w: 26, h: 20 } as const;
/** The small ink diamond either side of a page number. */
const DIAMOND: Bitmap = (() => {
  const d = createBitmap(5, 5);
  for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) if (Math.abs(x - 2) + Math.abs(y - 2) <= 2) d.pixels[y * 5 + x] = C.umberDark;
  return d;
})();

/**
 * A page's bottom corner turned up (the book's pager): the corner's triangle of the page's back in pale paper, its fold an
 * umber line, the place it left a darker shade of the page under it. `side` is the page's outer side.
 */
function pageFold(size: number, side: 'left' | 'right'): Bitmap {
  const out = createBitmap(size, size);
  const n = size - 1, k = Math.floor(n / 2), fold = n + k;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fx = side === 'right' ? x : n - x;
      const d = fx + y - fold;
      // beyond the fold the corner is gone and the page under it shows; the fold itself; the flap lying back over the page
      const colour = d > 0 ? C.buffDark : d === 0 ? C.umber : fx >= k && y >= k ? (fx === k || y === k ? C.umber : C.buffLight) : 0;
      out.pixels[y * size + x] = colour;
    }
  }
  return out;
}
/** While an order choice is under the pointer, the cards it would move are drawn this faint (d286). */
const PREVIEW_FADE = 0.12;

/** A bookmark's ribbon with its picture on it: a band of cloth with a dark edge and a notch cut in its left end. */
function ribbon(mark: Bookmark, width: number, height: number): Bitmap {
  const [cloth, edge] = BOOKMARK_CLOTH[mark];
  const out = createBitmap(width, height);
  const notch = Math.floor(height / 2);
  for (let y = 0; y < height; y++) {
    const cut = 3 - Math.min(3, Math.abs(y - notch));
    for (let x = cut; x < width; x++) out.pixels[y * width + x] = y === 0 || y === height - 1 || x === cut ? edge : cloth;
  }
  // the picture sits at the ribbon's outer end, where every ribbon shows it, open or shut
  const icon = BOOKMARK_ICON[mark]();
  blit(out, icon, 4 + Math.max(0, Math.floor((TAB.shut - 6 - icon.width) / 2)), Math.floor((height - icon.height) / 2));
  return out;
}

/** The hat of a curriculum piece: in its usual colours, or in the colours of a finished piece's medal. */
function hatFor(mark: CurriculumMark): Bitmap {
  if (!mark.finished) return hatPicture();
  const [light, mid, dark] = FINISHED_HAT[mark.medal ?? 'none'];
  return recolor(hatPicture(), { [C.duskLight]: light, [C.dusk]: mid, [C.duskDark]: mid, [C.duskDeep]: dark });
}
/** The light rule between two pieces on a page, in the umber of the book's faded ink. */
const RULE_COLOUR = C.umberLight;
/** The cards start right under the toolbar's vine. */
const LIST_TOP = 4;
/** The line that says progress is not saved takes this much room above the cards. */
const NO_SAVE_ROOM = 9;
/** The "i" and "S" buttons on a card: big enough for a finger at the usual zoom (44 screen pixels at 4x). */
const INFO_SIZE = 11;
/** The "S" button sits this far left of the "i" button (centre to centre). */
const STATS_OFFSET = INFO_SIZE + 3;
/** The five grade stars on a card, one pixel apart. */
/** The stacked grade's width: three stars one pixel apart (the two under them sit within). */
const GRADE_WIDTH = 3 * (STAR_FULL.width + 1) - 1;
/** The two rows of the stacked grade, from a card's top: the lower row half a star lower, overlapping like rings. */
const STAR_ROWS_AT = [14, 19] as const;
/** An armed hide (ft_1_02c.AC8) goes back to rest after this long without its second press. */
const HIDE_ARMED_MS = 4000;
/** A card whose hide is armed is drawn this faint, its title struck through: what the second press will do. */
const HIDE_FADE = 0.45;
/** Under the pointer the hide's stroke is drawn this faint before the first press (d286). */
const HIDE_HINT = 0.35;

/**
 * The piece picker: Kiur, the player's level and XP, and the pieces as cards in two columns, six to a page. A card shows
 * the title, how many stars were earned and which hand plays; a locked card shows a padlock and the level it needs.
 * Drawn in art pixels, so everything stays crisp at any whole-number zoom.
 */
export class MenuScene extends PixelScene {
  /** Which page of pieces is shown; kept when a piece is played and the player comes back. */
  private page = 0;
  /** The piece whose info card is open, if any. */
  private infoId: string | null = null;
  /** The small "i" button of each unlocked card on this page, by piece id (not in `buttons`: they are not piece cards). */
  protected infoButtons = new Map<string, PixelButton>();
  /** The small "S" button of each unlocked card on this page, by piece id: it opens the piece's stats page (core_04). */
  protected statsButtons = new Map<string, PixelButton>();
  /** An own piece's pencil, which opens it in the piece maker (ft_1_12), by piece id. */
  protected editButtons = new Map<string, PixelButton>();
  /** The hide button of each piece that may be taken out of the book (ft_1_02c.AC8), by piece id. */
  protected hideButtons = new Map<string, PixelButton>();
  /** The piece whose hide was pressed once (armed): a second press takes it out of the book. */
  protected armedHide: ArmedHide | null = null;
  private disarmHide: Phaser.Time.TimerEvent | null = null;
  /** The parts button of a piece that has parts (core_06), by piece id. */
  protected partsButtons = new Map<string, PixelButton>();
  /** The Close button of the open info card (kept for the tests, which press it with the mouse). */
  protected infoClose: PixelButton | null = null;
  /** Piece maker (from the main menu): the Make list is shown, and Back goes to the main menu. Kept across restarts. */
  private maker = false;
  /** Picking for Kiur (`MenuData.forKiur`): a piece picked is learned with him, or taken to the room for his tug. */
  private forKiur: 'learn' | 'tug' | null = null;
  /** The title line of each piece on this page (and New piece), in reading order: what the wheel moves along. */
  private pieceButtons: PixelButton[] = [];
  /** How the list was cut into pages, as last drawn: the wheel and Page Up / Page Down turn its pages. */
  private paging: { total: number; options: PagingOptions; first: number } = { total: 0, options: {}, first: 0 };
  /**
   * The marks of the pieces in the curriculum of the player `curriculumPlayer` (ft_1_26.AC8), by piece id: read again on
   * each visit and kept over a page turn (a restart), so a hat does not blink away while the read is out.
   */
  protected curriculumMarks: ReadonlyMap<string, CurriculumMark> = new Map();
  /** The bookmark the book is open at (ft_1_12.AC10): this visit of the game only, not saved (AX-3 provisional). */
  protected bookmark: Bookmark = 'all';
  /** The order the book's pieces are read in (ft_1_12.AC11): this visit of the game only, not saved (AX-3 provisional). */
  protected order: BookOrder = 'book';
  /** The pieces in the book as drawn (under the bookmark, in the order), and each card on this page with its place among them. */
  private shown: Piece[] = [];
  private slots: { index: number; card: PixelButton; id: string }[] = [];
  /** What an order choice under the pointer draws (d286): the titles that would stand on this page, faint over the faded cards. */
  private orderPreview: Phaser.GameObjects.GameObject[] = [];
  /** The bookmarks as drawn, by mark (for the tests and the keyboard). */
  protected bookmarkButtons = new Map<Bookmark, PixelButton>();
  private curriculumPlayer: string | null = null;
  /** Counts the curriculum reads: a read that comes back after its visit ended draws nothing. */
  private curriculumRead = 0;

  protected override keyboardNavigation = true;

  override create(): void {
    // the wheel moves along the pieces, Ctrl + wheel turns the pages; Ctrl also keeps the browser from zooming
    this.input.on('wheel', (p: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) => {
      if (dy !== 0 && !this.pointerOnInventory(p)) this.wheelStep(dy > 0 ? 1 : -1, p.event.ctrlKey || p.event.metaKey);
    });
    super.create();
  }

  /** Page Up and Page Down turn the book's pages, keeping the focus's place on the page. */
  protected override screenKey(e: KeyboardEvent): boolean {
    if (e.key !== 'PageUp' && e.key !== 'PageDown') return false;
    this.wheelStep(e.key === 'PageDown' ? 1 : -1, true);
    return true;
  }

  /** One notch of the wheel: the focus moves to the next or previous piece (`pages`: the same place a page on), turning the page when it must. */
  private wheelStep(step: 1 | -1, pages: boolean): void {
    if (this.infoId !== null || this.menuOpen) return;
    const { total, options, first } = this.paging;
    const focused = this.focusedButton;
    const at = focused ? this.pieceButtons.indexOf(focused) : -1;
    const target = stepItem(total, at < 0 ? null : first + at, at < 0 ? 0 : step, { ...options, page: this.page, pages });
    if (target === null) return;
    const page = pageOf(total, Math.floor(target / (options.perPage ?? 6)), options).page;
    if (page !== this.page) {
      this.page = page;
      this.redraw();
    }
    this.focusOn(this.pieceButtons[target - this.paging.first]);
  }

  /** While the info card is open only its Close button is reachable; otherwise the cards and their info buttons. */
  protected override focusables(): PixelButton[] {
    if (this.infoId !== null) return this.infoClose ? [this.infoClose] : [];
    return [...this.buttons, ...this.partsButtons.values(), ...this.editButtons.values(), ...this.statsButtons.values(), ...this.infoButtons.values(), ...this.hideButtons.values(), ...this.bookmarkButtons.values()];
  }

  /** Esc and the toolbar's Back: close a piece's info, or go back to the player's room, or to the main menu from the piece maker. */
  protected override back(): void {
    if (this.infoId !== null) {
      this.showInfo(null);
      return;
    }
    // an armed hide goes back to rest first (ft_1_02c.AC8)
    if (this.armedHide !== null) {
      this.armedHide = null;
      this.redraw();
      return;
    }
    startScene(this, this.maker ? 'profiles' : 'profile');
  }

  constructor() {
    super('menu');
  }

  init(data?: MenuData): void {
    this.infoId = null;
    this.armedHide = null;
    this.disarmHide = null;
    this.maker = this.registry.get(MAKER_KEY) === true && contextOf(this).flags.editor;
    this.forKiur = this.maker ? null : (data?.forKiur ?? null);
    // the piece maker saves nothing for a player: the toolbar shows no name, level or settings
    this.toolbarPlayer = !this.maker;
    if (this.maker) {
      // the piece maker belongs to no player: no hats
      this.curriculumMarks = new Map();
      this.curriculumPlayer = null;
      return;
    }
    const player = contextOf(this).profiles.profile.id;
    if (player !== this.curriculumPlayer) this.curriculumMarks = new Map();
    this.curriculumPlayer = player;
    this.readCurriculum(player);
  }

  /**
   * Reads the player's curriculum and practice log and measures each curriculum piece as the teacher's screen does
   * (`teacherStatuses`), then draws the book again when that changes a hat (ft_1_26.AC8).
   */
  private readCurriculum(player: string): void {
    const read = ++this.curriculumRead;
    this.events.once('shutdown', () => { if (this.curriculumRead === read) this.curriculumRead++; });
    const { profiles, pieces, flags } = contextOf(this);
    void Promise.all([profiles.curriculumOf(player).catch(() => null), profiles.practiceLogOf(player).catch(() => null)]).then(([curriculum, log]) => {
      if (read !== this.curriculumRead) return;
      const marks = new Map<string, CurriculumMark>();
      if (curriculum !== null && curriculum.pieces.length > 0) {
        const today = dayString(new Date(flags.sky.now ?? Date.now()));
        const deadlines = new Map(curriculum.pieces.map((p) => [p.piece, p.deadline]));
        const statuses = log === null ? [] : teacherStatuses(curriculum, log, (id) => pieces.find(id)?.chart.bars.length, today, (iso) => dayString(new Date(iso)));
        for (const status of statuses) marks.set(status.piece, curriculumMark(status, deadlines.get(status.piece)!, today));
        // a log that cannot be read still shows which pieces are the teacher's, with nothing measured
        for (const p of curriculum.pieces) if (!marks.has(p.piece)) marks.set(p.piece, { finished: false, daysLeft: Math.max(0, dayNumber(p.deadline) - dayNumber(today)), closeness: 0 });
      }
      if (JSON.stringify([...marks]) === JSON.stringify([...this.curriculumMarks])) return;
      this.curriculumMarks = marks;
      this.redraw();
    });
  }

  /** The groups of a piece in the book (ft_1_12.AC10). */
  private groups(piece: Piece): PieceGroup[] {
    return groupsOf(piece, new Set(this.curriculumMarks.keys()), CHARACTER_PIECES);
  }

  /**
   * The strip of the book (ft_1_12.AC11, ft_1_02c.AC9): the order, one button whose choices open as pictures from it, and
   * All pieces, the catalogue of every piece. Not in the piece maker.
   */
  protected override bandActions(): ToolbarItem[] {
    if (this.maker) return [];
    const order: ToolbarItem = {
      label: t('menu.order'), tooltip: t(`menu.order.${this.order}`), icon: TOOL_ICONS.order, iconOnly: true, onClick: () => undefined,
      menu: { items: () => this.orderItems(), cell: ORDER_CELL, columns: BOOK_ORDERS.length },
    };
    // every piece there is, hidden ones too, where a piece is put back in the book (ft_1_02c.AC9)
    const all: ToolbarItem = { label: t('menu.allPieces'), icon: TOOL_ICONS.pieces, iconOnly: true, onClick: () => startScene(this, 'pieces', { back: this.forKiur ? { forKiur: this.forKiur } : {} }) };
    return [order, all];
  }

  /** The order button's choices, each a picture with its name in the tooltip; the one in use lit. */
  private orderItems(): MenuItem[] {
    return BOOK_ORDERS.map((order) => ({
      label: t(`menu.order.${order}`), icon: ORDER_ICON[order], tooltip: t(`menu.order.${order}`), active: order === this.order,
      preview: (on) => this.previewOrder(on ? order : null),
      onPick: () => {
        this.order = order;
        this.page = 0;
        this.armedHide = null;
        this.redraw();
      },
    }));
  }

  /**
   * Shows what an order would do before it is picked (d286, ft_1_12.AC11): the cards on this page fade, and over each is
   * written faintly in red the title that order would put there. `null` takes the preview away.
   */
  private previewOrder(order: BookOrder | null): void {
    for (const o of this.orderPreview) if (o.scene) o.destroy();
    this.orderPreview = [];
    const fade = order === null || order === this.order ? 1 : PREVIEW_FADE;
    for (const { card, id } of this.slots) for (const b of [card, this.infoButtons.get(id), this.statsButtons.get(id), this.partsButtons.get(id), this.editButtons.get(id), this.hideButtons.get(id)]) b?.setAlpha(fade);
    if (order === null || order === this.order) return;
    const saved = this.order;
    this.order = order;
    const next = this.ordered(this.shown);
    this.order = saved;
    this.inkWriting = true;
    for (const { index, card } of this.slots) {
      const piece = next[index];
      if (!piece) continue;
      const { x, y, height } = card.rect;
      const text = this.label(x + 6, y + Math.floor(height / 2) - 4, pieceTitle(piece.chart), C.redDark, { maxWidth: card.rect.width - 8 }).setName('orderPreview');
      this.orderPreview.push(text);
    }
    this.inkWriting = false;
  }

  /** The pieces in the order chosen (ft_1_12.AC11). */
  private ordered(pieces: readonly Piece[]): Piece[] {
    const { profiles } = contextOf(this);
    const entries = pieces.map((piece) => {
      const record = profiles.recordFor(piece.chart.id);
      const mark = this.curriculumMarks.get(piece.chart.id);
      return { piece, id: piece.chart.id, title: pieceTitle(piece.chart), level: piece.level, stars: record?.bestGrade ?? 0, daysLeft: mark && !mark.finished ? mark.daysLeft : null, lastPlayedAt: record?.lastPlayedAt ?? null };
    });
    return orderBook(entries, this.order).map((e) => e.piece);
  }

  /**
   * The bookmarks (ft_1_12.AC10) in the left page's outer margin, one under another: All, Own, the teacher's, the
   * characters'. The one the book is open at reaches out past the book's edge in full colour; a press on another opens the book there.
   */
  private bookmarks(top: number): void {
    BOOKMARKS.forEach((mark, i) => {
      const open = mark === this.bookmark;
      const x = open ? 0 : TAB.out;
      const w = open ? TAB.open : TAB.shut;
      const y = top + i * (TAB.h + TAB.gap);
      // not one of the screen's `buttons`: those are the pieces and the pager, which the tests and the wheel walk
      const button = this.own(new PixelButton(this, this.root, {
        x: x + w / 2, y: y + TAB.h / 2, width: w, height: TAB.h, label: t(`menu.group.${mark}`), tooltip: t(`menu.group.${mark}`), iconOnly: true,
        picture: ribbon(mark, w, TAB.h),
        onClick: () => {
          if (this.bookmark === mark) return;
          this.bookmark = mark;
          this.page = 0;
          this.armedHide = null;
          this.redraw();
        },
      }));
      button.setActive(open);
      if (!open) button.setAlpha(0.85);
      this.bookmarkButtons.set(mark, button);
    });
  }

  protected draw(): void {
    const { width, height } = this.px;
    const context = contextOf(this);
    const profiles = context.profiles;
    this.infoButtons.clear();
    this.statsButtons.clear();
    this.editButtons.clear();
    this.partsButtons.clear();
    this.hideButtons.clear();
    this.bookmarkButtons.clear();
    this.pieceButtons = [];
    this.slots = [];
    this.shown = [];
    this.orderPreview = [];
    this.paging = { total: 0, options: {}, first: 0 };
    this.infoClose = null;
    // pieces turned off are hidden; the Make list keeps own pieces that are off, so they can still be edited
    const offered = contextOf(this).pieces.list();
    // One list (ft_1_12): a card plays its piece, an own piece's pencil opens it in the editor. The piece maker (main
    // menu, no player) lists only own pieces, and a card opens the editor, so nothing is played (and saved) from it.
    const editable = context.flags.editor;
    const listed = this.maker ? offered.filter((p) => p.own) : piecesUnderBookmark(piecesThatAreOn(offered, profiles.hiddenPieces), (p) => this.groups(p), this.bookmark);
    // picking for Kiur's tug: only the pieces that may be tugged, the learned ones (ft_1_32 rule 15; all with learning off)
    const tuggable = (p: Piece) => !context.flags.learn || pieceLearned(p.chart, profiles.learnProgressOf(p.chart.id), profiles.learnSettings);
    const on = this.ordered(this.forKiur === 'tug' ? listed.filter(tuggable) : listed);
    this.shown = on;
    // a new piece is made from the piano's book only, never while picking for Kiur
    // at the bookmarks of the teacher's and the characters' pieces there is no new piece to make
    const pieces: (Piece | 'new')[] = editable && this.forKiur === null && (this.bookmark === 'all' || this.bookmark === 'own' || this.maker) ? ['new', ...on] : on;
    this.sky();

    // one list for everything (ft_1_12): no mode tabs and no hint
    const listTop = LIST_TOP;
    if (!context.savesPersist) this.label(MARGIN, listTop - 1, t('menu.noSave'), C.gold, { shadow: false, maxWidth: width - 2 * MARGIN });

    // a bookmark with no pieces still shows the book and its bookmarks, so another can be opened
    const marked = !this.maker && this.bookmark !== 'all';
    if (pieces.length === 0 && !marked) {
      const why = this.forKiur === 'tug' && listed.length > 0 ? 'menu.noneLearned' : offered.length > 0 ? 'menu.allOff' : 'menu.noPieces';
      this.label(MARGIN, listTop + 16, t(why), C.dim, { maxWidth: width - 2 * MARGIN });
      return;
    }

    // the cards: two columns, as many rows as fit; a pager row only when there are more pieces than fit
    const top = context.savesPersist ? listTop : listTop + NO_SAVE_ROOM;
    // the list is written in an open book on the desk, a column on each page
    this.openBook({ x: BOOK_SIDE, y: top - 2, w: width - 2 * BOOK_SIDE, h: height - top + 1 });
    if (!this.maker) this.bookmarks(top + TAB_TOP);
    const margin = BOOK_MARGIN;
    const shift = this.maker ? 0 : LEFT_SHIFT;
    if (pieces.length === 0) {
      // the bookmark's own picture on the empty page, then the sentence under it
      const picture = BOOKMARK_ICON[this.bookmark]();
      this.root.add(new PixelImage(this, margin + shift + 6, top + 10, picture).setName('emptyBookmark'));
      this.inkWriting = true;
      this.label(margin + shift + 6, top + 16 + picture.height, t(this.forKiur === 'tug' ? 'menu.noneLearned' : 'menu.noneHere'), C.umberDark, { maxWidth: width / 2 - margin - shift - BOOK_GUTTER / 2 - 6 });
      this.inkWriting = false;
      return;
    }
    this.inkWriting = true;
    const grid = cardGrid({ width, height, top: top + 4, margin, rowHeight: this.bandShown ? BAND_CARD_ROW : CARD_HEIGHT, rowGap: CARD_GAP, columnGap: BOOK_GUTTER });
    const { cardWidth } = grid;
    const slice = pageOf(pieces.length, this.page, { singlePageMax: grid.singlePageMax, perPage: grid.perPage });
    this.page = slice.page;
    this.paging = { total: pieces.length, options: { singlePageMax: grid.singlePageMax, perPage: grid.perPage }, first: slice.first };

    const capacity = slice.paged ? grid.perPage : grid.singlePageMax;
    pieces.slice(slice.first, slice.first + slice.count).forEach((piece, i) => {
      // read as a book: down the left page, then down the right
      const cell = grid.pageCell(i, capacity);
      const { x, y } = rectCentre(cell);
      // a light rule under a piece that has another under it on the same page; on the left page it stays clear of the bookmarks
      if (i + 1 < slice.count && grid.pageCell(i + 1, capacity).x === cell.x) this.rule(cell.x < width / 2 ? { ...cell, x: cell.x + shift, w: cell.w - shift } : cell, CARD_GAP);
      if (piece === 'new') {
        // an empty staff with a pencil, as wide as a piece card; the label stays for tests and the tooltip
        // on the left page it stays clear of the bookmarks, as the rules do
        const inset = cell.x < width / 2 ? shift : 0;
        this.pieceButtons.push(this.button({ x: x + inset / 2, y: y + 1, width: cardWidth - inset, height: NEW_PIECE_HEIGHT + 4, label: t('menu.newPiece'), icon: newPieceArt(cardWidth - inset - 2 * NEW_PIECE_INSET), iconOnly: true, look: 'ink', onClick: () => startScene(this, 'editor', {}) }));
        return;
      }
      // a card on the left page is mirrored, so every title is lined up to the spine
      const card = this.card(piece, x, y, cardWidth, profiles.recordFor(piece.chart.id) ?? null, cell.x < width / 2);
      this.pieceButtons.push(card);
      this.slots.push({ index: slice.first + i - (pieces[0] === 'new' ? 1 : 0), card, id: piece.chart.id });
    });

    if (slice.paged) {
      this.bookPager(slice, { x: BOOK_SIDE, y: top - 2, w: width - 2 * BOOK_SIDE, h: height - top + 1 }, (page) => {
        this.page = page;
        this.armedHide = null;
        this.scene.restart();
      });
    }

    this.inkWriting = false;
    const open = this.infoId === null ? undefined : contextOf(this).pieces.find(this.infoId);
    if (open) this.infoClose = this.own(drawPieceInfo({ scene: this, root: this.root, width, height, close: () => this.showInfo(null) }, open));
  }

  /**
   * The book's pager (ft_1_12 rule 1): no words. Each page has its number at its foot, written large between two small
   * ink diamonds (the left page 1, 3, 5 ..., the right 2, 4, 6 ...); the left page's bottom corner is turned up while there
   * is a page before, the right page's while there is one after, and a press on a turned corner turns the page. A corner
   * with no page behind lies flat and takes no press.
   */
  private bookPager(slice: { page: number; pages: number }, book: Rect, turn: (page: number) => void): void {
    const bottom = book.y + book.h - FOLD.inY;
    const corners = [
      { label: t('menu.previous'), x: book.x + FOLD.inX, side: 'left' as const, can: slice.page > 0, page: slice.page - 1 },
      { label: t('menu.next'), x: book.x + book.w - FOLD.inX - FOLD.size, side: 'right' as const, can: slice.page < slice.pages - 1, page: slice.page + 1 },
    ];
    for (const c of corners) {
      this.button({
        x: c.x + FOLD.size / 2, y: bottom - FOLD.size / 2, width: FOLD.size, height: FOLD.size, label: c.label, tooltip: c.label, iconOnly: true,
        picture: c.can ? pageFold(FOLD.size, c.side) : createBitmap(FOLD.size, FOLD.size), disabled: !c.can, onClick: () => turn(c.page),
      });
    }
    // the page numbers, each at the middle of its page's foot
    const spine = book.x + book.w / 2;
    [{ n: 2 * slice.page + 1, centre: (book.x + spine) / 2 }, { n: 2 * slice.page + 2, centre: (spine + book.x + book.w) / 2 }].forEach(({ n, centre }, i) => {
      const number = this.label(0, bottom - 18, String(n), C.umberDark, { big: true, shadow: false }).setName(`pageNumber:${i}`);
      number.centerAt(centre);
      for (const side of [-1, 1]) this.root.add(new PixelImage(this, Math.round(centre + side * (number.displayWidth / 2 + 6)) - 2, bottom - 18 + Math.round(number.displayHeight / 2) - 2, DIAMOND).setName('pageOrnament'));
    });
  }

  /** The light rule in the gap under `cell`: one fine pixel high, a little shorter than the card at each end. */
  private rule(cell: Rect, gap: number): void {
    const inset = 4;
    const line = createBitmap((cell.w - 2 * inset) * ART_DETAIL, 1);
    line.pixels.fill(RULE_COLOUR);
    this.fineImage((cell.x + inset) * ART_DETAIL, (cell.y + cell.h) * ART_DETAIL + Math.floor((gap * ART_DETAIL - 1) / 2), line);
  }

  /**
   * A piece's hide (ft_1_02c.AC8): under the pointer a faint stroke through the title shows what it does (d286); the first
   * press arms it, the card faint with its title struck through, the picture of the book without it; a second press within
   * a few seconds takes the piece out of the book (the piece is turned off, its stars kept), else it goes back to rest.
   */
  private hideButton(id: string, card: PixelButton, at: { x: number; y: number }): void {
    const armed = this.armedHide?.piece === id;
    // a stroke through the middle of each line of the title, as long as that line
    const strokes = card.textLines().map((line, i) => {
      const stroke = createBitmap(Math.max(1, Math.round((line.width + 2) * ART_DETAIL)), 2);
      stroke.pixels.fill(C.redDark);
      const image = this.fineImage(Math.round((line.x - 1) * ART_DETAIL), Math.round((line.y + line.height / 2) * ART_DETAIL) - 1, stroke).setName(armed ? `hideStroke:armed:${i}` : `hideStroke:${i}`);
      image.setAlpha(armed ? 1 : HIDE_HINT).setVisible(armed);
      return image;
    });
    const hide = this.own(new PixelButton(this, this.root, {
      ...at, width: INFO_SIZE, height: INFO_SIZE, label: t(armed ? 'menu.hideAgain' : 'menu.hide'), look: 'ink', inkBox: true, icon: TOOL_ICONS.hide, iconOnly: true,
      ...(armed ? {} : { onHover: (over: boolean) => strokes.forEach((s) => s.setVisible(over)) }),
      onClick: () => this.pressHide(id),
    }));
    hide.setActive(armed);
    if (armed) {
      // the armed hide is ringed in red ink: the one thing on the faded card still to press
      const { x, y, width, height } = hide.rect;
      const w = (width + 2) * ART_DETAIL, h = (height + 2) * ART_DETAIL;
      const ring = createBitmap(w, h);
      for (let i = 0; i < w; i++) for (const row of [0, 1, h - 2, h - 1]) ring.pixels[row * w + i] = C.redDark;
      for (let j = 0; j < h; j++) for (const col of [0, 1, w - 2, w - 1]) ring.pixels[j * w + col] = C.redDark;
      this.fineImage((x - 1) * ART_DETAIL, (y - 1) * ART_DETAIL, ring).setName('hideRing');
    }
    this.hideButtons.set(id, hide);
  }

  /** A piece whose hide is armed is drawn faint, all but its hide: the book as it will be without it (ft_1_02c.AC8). */
  private fadeIfArmed(id: string, ...buttons: PixelButton[]): void {
    if (this.armedHide?.piece !== id) return;
    for (const b of [...buttons, this.partsButtons.get(id), this.editButtons.get(id)]) b?.setAlpha(HIDE_FADE);
  }

  /** A press on a piece's hide: arms it, or (the second press) takes the piece out of the book and draws the book without it. */
  private pressHide(id: string): void {
    const press = pressHide(this.armedHide, id, this.time.now);
    this.armedHide = press.armed;
    this.disarmHide?.remove();
    this.disarmHide = press.armed === null ? null : this.time.delayedCall(HIDE_ARMED_MS, () => {
      this.armedHide = null;
      this.redraw();
    });
    if (press.hide === null) return this.redraw();
    void contextOf(this).profiles.setPieceOn(press.hide, false).then(() => {
      if (this.scene.isActive()) this.redraw();
    });
  }

  /** A card's row height: smaller under the band. */
  private get cardRow(): number {
    return this.bandShown ? BAND_CARD_ROW : CARD_HEIGHT;
  }

  /**
   * The clef prize of learning `piece` (ft_1_32.AC21), the rightmost sign of its card: in its medal once learned, an empty
   * placeholder before; none in the piece maker or with learning off.
   */
  private clefSigns(piece: Piece): { bitmap: Bitmap; name: string }[] {
    const context = contextOf(this);
    if (this.maker || !context.flags.learn) return [];
    const profiles = context.profiles;
    const medal = pieceClef(piece.chart, profiles.learnProgressOf(piece.chart.id), profiles.learnSettings, profiles.practiceFor(piece.chart.id));
    return [{ bitmap: clefPrize(medal), name: `clefPrize:${medal ?? 'empty'}` }];
  }

  private showInfo(id: string | null): void {
    this.infoId = id;
    this.armedHide = null;
    this.redraw();
  }

  /**
   * The piece's own level (ft_1_13): beside its stars when it fits before the small buttons, else after the title when it
   * fits before the signs, else not written; never drawn over a button.
   */
  private pieceLevel(button: PixelButton, record: PieceRecord, title: string, card: { left: number; top: number; flip: (x: number, w?: number) => number }, buttonsLeft: number, signsLeft: number): void {
    const { left, top, flip } = card;
    const text = t('menu.pieceLevel', { level: record.level.level });
    const width = measure(drawnText(text));
    const besideStars = left + 6 + GRADE_WIDTH + 6;
    const afterTitle = left + 6 + measure(drawnText(title)) + 8;
    const place = besideStars + width <= buttonsLeft - 3 ? { x: besideStars, y: top + 20 } : afterTitle + width <= signsLeft - 3 ? { x: afterTitle, y: top + 4 } : null;
    if (!place) return;
    const level = new PixelText(this, flip(place.x, width), place.y, text, { color: C.umberDark }).setName('pieceLevel');
    this.root.add(level);
    button.attach(level);
  }

  /** A card's small buttons on its second line: i, S, the parts left of S, and the hide button right of i. */
  private cardButtons(piece: Piece, button: PixelButton, rightEdge: number, top: number, flip: (at: number, w?: number) => number): { info: PixelButton; stats: PixelButton; slot: number } {
    const info = new PixelButton(this, this.root, {
      x: flip(rightEdge - 34), y: top + 23, width: INFO_SIZE, height: INFO_SIZE, label: t('info.button'), look: 'ink', inkBox: true, onClick: () => this.showInfo(piece.chart.id),
    });
    this.own(info);
    this.infoButtons.set(piece.chart.id, info);
    const stats = new PixelButton(this, this.root, {
      x: flip(rightEdge - 34 - STATS_OFFSET), y: top + 23, width: INFO_SIZE, height: INFO_SIZE, label: t('stats.button'), look: 'ink', inkBox: true, onClick: () => startScene(this, 'results', { chartId: piece.chart.id }),
    });
    this.own(stats);
    this.statsButtons.set(piece.chart.id, stats);
    // left of S: the parts of a piece that has them (core_06)
    let slot = 2;
    const small = (label: string, onClick: () => void, icon?: Bitmap): PixelButton => {
      const made = this.own(new PixelButton(this, this.root, {
        x: flip(rightEdge - 34 - slot * STATS_OFFSET), y: top + 23, width: INFO_SIZE, height: INFO_SIZE, label, look: 'ink', inkBox: true, ...(icon ? { icon, iconOnly: true } : {}), onClick,
      }));
      slot += 1;
      return made;
    };
    // AX-3 provisional: the parts screen is reached by a small button, not by the card, so a tap still plays at once
    if (piece.chart.phrases.length > 0 && !this.maker) {
      this.partsButtons.set(piece.chart.id, small(t('parts.button'), () => startScene(this, 'parts', { chartId: piece.chart.id })));
    }
    // beyond i, away from the others (mirrored on the left page): take the piece out of the book, in two presses (ft_1_02c.AC8); never the last piece in it
    if (!this.maker && contextOf(this).profiles.canTurnOff(piece.chart.id)) this.hideButton(piece.chart.id, button, { x: flip(rightEdge - 34 + STATS_OFFSET), y: top + 23 });
    return { info, stats, slot };
  }

  /**
   * One piece: its title and, once played, its own level (ft_1_13) under it, with its stars and small buttons. At the right
   * of the title its groups' signs: an own piece's pencil (which opens it in the piece maker), a
   * character's speech bubble in its colour, and the teacher's academic hat on a curriculum piece with the days left and a
   * bar of how near it is, or, finished, the hat in its medal's colours (ft_1_26.AC8). No piece is locked (ft_1_13.AC3).
   */
  private card(piece: Piece, x: number, y: number, width: number, record: PieceRecord | null, mirrored = false): PixelButton {
    // laid out as on the right page, then mirrored about the card's middle on the left page: a thing at x, w wide
    const cardLeft = x - width / 2;
    const flip = (at: number, w = 0): number => (mirrored ? 2 * cardLeft + width - at - w : at);
    // written in the book: the title alone on the first line, the line under it the stars, the
    // piece's level and its small buttons; the title's line is what plays the piece
    const mark = this.maker ? undefined : this.curriculumMarks.get(piece.chart.id);
    const teacher = CHARACTER_PIECES.get(piece.chart.id);
    const editable = piece.own === true && !this.maker && contextOf(this).flags.editor;
    // the signs, right to left: the hat (with the days and the bar left of it), the bubble, the pencil
    const days = mark && !mark.finished ? String(mark.daysLeft) : null;
    const daysWidth = days === null ? 0 : Math.max(measure(drawnText(days)), NEAR_BAR.w);
    const prizes = this.clefSigns(piece);
    const signs = [
      ...prizes.map((p) => p.bitmap.width),
      ...(mark ? [HAT.w + (days === null ? 0 : daysWidth + SIGN_GAP)] : []),
      ...(teacher !== undefined ? [BUBBLE.width] : []),
      ...(piece.own === true ? [editable ? INFO_SIZE : PENCIL.width] : []),
    ];
    const signRoom = signs.length === 0 ? 0 : signs.reduce((a, b) => a + b + SIGN_GAP, SIGN_INSET - SIGN_GAP);
    // the title's line stops short of the signs, so the pencil is its own button; a title too long beside them is cut on one line
    const room = width - signRoom - 10;
    const title = signRoom === 0 ? pieceTitle(piece.chart) : clipToWidth(pieceTitle(piece.chart), room, (text) => measure(drawnText(text)));
    const button = this.button({
      x: flip(x - signRoom / 2), y: y - this.cardRow / 4, width: width - signRoom, height: CARD_HEIGHT / 2, label: title, look: 'ink', align: mirrored ? 'right' : 'left', labelWidth: room,
      onClick: () => {
        if (this.maker) startScene(this, 'editor', { id: piece.chart.id });
        else if (this.forKiur === 'tug') startScene(this, 'profile', { kiurTug: piece.chart.id });
        else if (this.forKiur === 'learn') startScene(this, 'practice', { chartId: piece.chart.id, learn: true });
        else startScene(this, 'practice', { chartId: piece.chart.id });
      },
    });
    const left = cardLeft;
    const top = button.rect.y;
    const rightEdge = left + width - 5;
    const line = CARD_HEIGHT / 2;
    let cursor = rightEdge - SIGN_INSET;
    const signImages: PixelImage[] = [];
    const sign = (bitmap: Bitmap, name: string): PixelImage => {
      cursor -= bitmap.width;
      const image = new PixelImage(this, flip(cursor, bitmap.width), top + Math.floor((line - bitmap.height) / 2), bitmap).setName(name);
      this.root.add(image);
      signImages.push(image);
      cursor -= SIGN_GAP;
      return image;
    };
    prizes.forEach((p) => sign(p.bitmap, p.name));
    if (mark) {
      sign(hatFor(mark), mark.finished ? `curriculumHat:${mark.medal ?? 'green'}` : 'curriculumHat');
      if (days !== null) {
        cursor -= daysWidth;
        const daysAt = cursor + daysWidth - measure(drawnText(days));
        const label = this.label(flip(daysAt, measure(drawnText(days))), top, days, C.featherStreak);
        label.setName('curriculumDays');
        const bar = new PixelBar(this, flip(cursor, NEAR_BAR.w), top + 10, NEAR_BAR.w, NEAR_BAR.h, mark.closeness, 'ink');
        this.root.add(bar);
        signImages.push(label, bar);
        cursor -= SIGN_GAP;
      }
    }
    if (teacher !== undefined) sign(recolor(BUBBLE, { [C.white]: CHARACTER_INK[teacher] ?? C.teal }), 'characterBubble');
    if (piece.own === true && editable) {
      cursor -= INFO_SIZE;
      const pencil = this.own(new PixelButton(this, this.root, {
        x: flip(cursor + INFO_SIZE / 2), y: top + line / 2, width: INFO_SIZE, height: INFO_SIZE, label: t('menu.edit'), look: 'ink', icon: PENCIL, iconOnly: true,
        onClick: () => startScene(this, 'editor', { id: piece.chart.id }),
      }));
      this.editButtons.set(piece.chart.id, pencil);
    } else if (piece.own === true) sign(PENCIL, 'ownPencil');
    const { info, stats, slot } = this.cardButtons(piece, button, rightEdge, top, flip);
    if (record) this.pieceLevel(button, record, title, { left, top, flip }, rightEdge - 34 - (slot - 1) * STATS_OFFSET - INFO_SIZE / 2, cursor);
    // the five-star grade of the best play, stacked like interlocking rings: three over two, the two set in between (ft_1_12 rule 7)
    const grade = record?.bestGrade ?? 0;
    const starsAt = flip(left + 6, GRADE_WIDTH);
    const earned = [
      ...pixelStars(this, this.root, starsAt, top + STAR_ROWS_AT[0], Math.min(grade, 3), { gap: 1, ink: true, total: 3 }),
      ...pixelStars(this, this.root, starsAt + Math.ceil((STAR_FULL.width + 1) / 2), top + STAR_ROWS_AT[1], Math.max(0, grade - 3), { gap: 1, ink: true, total: GRADE_STARS - 3 }),
    ];
    button.attach(...earned, ...signImages);
    this.fadeIfArmed(piece.chart.id, button, info, stats);
    return button;
  }
}
