import type Phaser from 'phaser';
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
import { blit, createBitmap, flipX, recolor, type Bitmap } from './ui/pixel/bitmap';
import { measure, drawnText } from './ui/pixel/font';
import { clipToWidth } from '../core/text/clip';
import { HAT, hatPicture } from './ui/pixel/menuArt';
import { ART_DETAIL } from '../core/layout/frame';
import { BOOK_PALETTE, PAGE_TURN, pageCorners, paintBookmark, paintFolio, paintPageTurn } from './ui/pixel/paint/book';
import type { Rect } from '../core/layout/rect';
import { startScene } from './scenes';
import { CLEF_FLIGHT, clefDrop, type Box } from '../core/layout/clefFlight';
import { clefSpaceFor, drawMedalClef } from './practice/prizeGlyphs';
import type { Medal as LearnMedal } from '../core/learn/progress';
import type { KeriScreen } from './visit/islandVisit';
import { motionAllowed } from './motion';
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
  /** A piece just learned: its clef drops onto its card (ft_1_32.AC22). */
  clefFlight?: ClefFlight;
}

/**
 * The learned piece's clef coming into the book (ft_1_32.AC22): the piece, its clef before and after learning, where the
 * practice screen left the grown clef (screen pixels), and the character the piece goes on to after the landing.
 */
export interface ClefFlight {
  chartId: string;
  before: LearnMedal | null;
  after: LearnMedal;
  from: Box;
  then?: KeriScreen | 'profile';
}

const CARD_HEIGHT = 32;
/** Under the band (ft_1_20) a card's row is 28 high, so three rows still fit a page of the book in the 124 rows: six pieces a page. */
const BAND_CARD_ROW = 28;
const CARD_GAP = 2;
/** The New piece staff's room at each end of its card, so it starts where a piece's title does. */
const NEW_PIECE_INSET = 5;
/** The piece maker's New piece staff: short, so the card's words fit beside it. */
const MAKER_NEW_STAFF = 40;
/** The piece maker's left page has no bookmarks, but its torn edge still takes a few cells. */
const MAKER_SHIFT = 6;
const MARGIN = 6;
/** The open book's cover from the screen's sides, the list's margin inside it, and the gutter between its pages, in cells. */
const BOOK_SIDE = 3;
const BOOK_MARGIN = 14;
const BOOK_GUTTER = 18;
/** The group signs at the end of a title's line keep this far apart. */
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
/** Each bookmark's silk in the book's palette (`paintBookmark`): red, green, violet, teal. */
const BOOKMARK_SILK: Readonly<Record<Bookmark, number>> = { all: 0, own: 1, curriculum: 2, character: 3 };
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
/** A page's turned-up corner (the pager, ft_1_12 rule 1) takes a press this many cells on a side, its corner on the page's. */
const FOLD = { size: 17 } as const;
/** A page's number stands this many cells over the page's foot. */
const FOLIO_FOOT = 3;
/** The bookmarks start this far under the book's top, clear of the door in the screen's top left corner. */
const TAB_TOP = 22;
/** Each order's picture in the order button's choices (ft_1_12.AC11). */
const ORDER_ICON: Readonly<Record<BookOrder, Bitmap>> = {
  book: TOOL_ICONS.orderBook, achieved: TOOL_ICONS.orderAchieved, deadline: TOOL_ICONS.orderDeadline, difficulty: TOOL_ICONS.steps, title: TOOL_ICONS.orderTitle, recent: TOOL_ICONS.orderRecent,
};
const ORDER_CELL = { w: 26, h: 20 } as const;
/** While an order choice is under the pointer, the cards it would move are drawn this faint (d286). */
const PREVIEW_FADE = 0.12;

/** A bookmark's picture, at its ribbon's outer end where every ribbon shows it, open or shut; the ribbon itself is painted (`paintBookmark`). */
function bookmarkPicture(mark: Bookmark, width: number, height: number): Bitmap {
  const out = createBitmap(width, height);
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
  /** The learned piece's clef on its way onto its card, the sign it lands on, and the clef in the air (ft_1_32.AC22). */
  private flight: ClefFlight | null = null;
  private flightSign: PixelImage | null = null;
  private flyer: Phaser.GameObjects.Graphics | null = null;
  /** Where the screen goes on after the clef lands (a character, or the room where Kiur waits); Back goes there at once. */
  private goOnTo: KeriScreen | 'profile' | null = null;
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
    // a learned piece's clef on its way: Back goes on at once to where the piece goes back to
    if (this.goOnTo) {
      this.goOn();
      return;
    }
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
    this.flight = this.maker ? null : (data?.clefFlight ?? null);
    this.flyer = null;
    this.goOnTo = this.flight?.then ?? null;
    // the book opens at the page of the piece whose clef is coming
    if (this.flight) this.page = Number.POSITIVE_INFINITY;
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
    // the song bookmark (ft_1_36 rule 13): at the strip's other end, apart from the filter; never while picking for Kiur
    const songs: ToolbarItem[] = this.forKiur === null && contextOf(this).songs.list().length > 0
      ? [{ label: t('menu.songs'), icon: TOOL_ICONS.songs, iconOnly: true, main: true, onClick: () => startScene(this, 'songs') }]
      : [];
    return [order, all, ...songs];
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
      const silk = this.fineImage(x * ART_DETAIL, y * ART_DETAIL, paintBookmark(BOOKMARK_SILK[mark], w * ART_DETAIL, TAB.h * ART_DETAIL, open), BOOK_PALETTE).setName(`bookmark:${mark}`);
      // not one of the screen's `buttons`: those are the pieces and the pager, which the tests and the wheel walk
      const button = this.own(new PixelButton(this, this.root, {
        x: x + w / 2, y: y + TAB.h / 2, width: w, height: TAB.h, label: t(`menu.group.${mark}`), tooltip: t(`menu.group.${mark}`), iconOnly: true,
        picture: bookmarkPicture(mark, w, TAB.h),
        onClick: () => {
          if (this.bookmark === mark) return;
          this.bookmark = mark;
          this.page = 0;
          this.armedHide = null;
          this.redraw();
        },
      }));
      button.setActive(open);
      button.attach(silk);
      this.bookmarkButtons.set(mark, button);
    });
  }

  protected draw(): void {
    const { width, height } = this.px;
    const context = contextOf(this);
    const profiles = context.profiles;
    // drawn again while the clef is in the air: it lands at once
    if (this.flyer) this.landFlight();
    this.flightSign = null;
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
    // a song's pieces are not listed on their own: the song is, behind its bookmark (ft_1_36 rule 13)
    const inSongs = contextOf(this).songs.pieceIds();
    const offered = contextOf(this).pieces.list().filter((p) => !inSongs.has(p.chart.id));
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
    const shift = this.maker ? MAKER_SHIFT : LEFT_SHIFT;
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
    if (this.page === Number.POSITIVE_INFINITY) {
      const at = pieces.findIndex((p) => p !== 'new' && p.chart.id === this.flight?.chartId);
      this.page = at < 0 ? 0 : Math.floor(at / grid.perPage);
    }
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
        // in the piece maker (no bookmarks to say where the player is) the card says its words beside a shorter staff
        const art = newPieceArt(this.maker ? MAKER_NEW_STAFF : cardWidth - inset - 2 * NEW_PIECE_INSET);
        this.pieceButtons.push(this.button({ x: x + inset / 2, y: y + 1, width: cardWidth - inset, height: NEW_PIECE_HEIGHT + 4, label: t('menu.newPiece'), icon: art, iconOnly: !this.maker, look: 'ink', onClick: () => startScene(this, 'editor', {}) }));
        // the piece maker with no own piece yet says where they will be
        if (this.maker && pieces.length === 1) {
          this.label(cell.x + shift + NEW_PIECE_INSET, y + NEW_PIECE_HEIGHT / 2 + 8, t('menu.maker.none'), C.umberDark, { maxWidth: cardWidth - shift - 2 * NEW_PIECE_INSET });
        }
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
    this.startFlight();
  }

  /**
   * The learned piece's clef drops from where the practice screen left it onto the piece's clef sign, into the empty place
   * or onto the clef that was there (ft_1_32.AC22). With the piece not in the book, it simply shows in its new medal.
   */
  private startFlight(): void {
    const flight = this.flight;
    const sign = this.flightSign;
    if (!flight || this.flyer) return;
    if (!sign) {
      this.landFlight();
      return;
    }
    // drawn as the practice screen drew it, over the book, then on landing the book's own small clef
    const k = this.root.scaleX;
    const bitmap = clefPrize(flight.after);
    const to = { x: this.root.x + sign.x * k, y: this.root.y + sign.y * k, w: bitmap.width * k, h: bitmap.height * k };
    const { start, end } = clefDrop(flight.from, to);
    const flyer = drawMedalClef(this, flight.after, { x: start.x, y: start.y }, clefSpaceFor(flight.from.h)).setName('clefFlight').setDepth(10);
    this.flyer = flyer;
    if (!motionAllowed()) {
      this.landFlight();
      return;
    }
    this.tweens.add({ targets: flyer, x: end.x, y: end.y, scale: end.scale, delay: CLEF_FLIGHT.waitMs, duration: CLEF_FLIGHT.dropMs, ease: 'Quad.easeIn', onComplete: () => this.landFlight() });
  }

  /** The clef is on its card: the sign shows its new medal, and the screen goes on to the character or the room. */
  private landFlight(): void {
    const flight = this.flight;
    if (!flight) return;
    if (this.flyer) {
      this.tweens.killTweensOf(this.flyer);
      this.flyer.destroy();
      this.flyer = null;
    }
    this.flight = null;
    this.flightSign?.setBitmap(clefPrize(flight.after)).setName(`clefPrize:${flight.after}`);
    if (this.goOnTo) this.time.delayedCall(CLEF_FLIGHT.afterMs, () => this.goOn());
  }

  /** On to the character or the room the learned piece goes back to (ft_1_32 rule 5), once. */
  private goOn(): void {
    const to = this.goOnTo;
    if (!to || !this.scene.isActive()) return;
    this.goOnTo = null;
    startScene(this, to, {});
  }

  /**
   * The book's pager (ft_1_12 rule 1): no words. Each page has its number at its foot, printed as an old book prints it
   * (`paintFolio`: the left page 1, 3, 5 ..., the right 2, 4, 6 ...); the left page's bottom corner is turned up while
   * there is a page before, the right page's while there is one after. Under the pointer the corner rolls up further, as a
   * hand lifts it, and a press on it turns the page. A corner with no page behind lies flat and takes no press.
   */
  private bookPager(slice: { page: number; pages: number }, book: Rect, turn: (page: number) => void): void {
    const fine = (v: number) => v * ART_DETAIL;
    const at = pageCorners(fine(book.w), fine(book.h));
    // the picture is big enough for the corner lifted; the press is on the corner itself, FOLD.size cells on a side
    const size = PAGE_TURN.lifted + 16, press = fine(FOLD.size);
    const resting = paintPageTurn(size, false), lifted = paintPageTurn(size, true);
    const corners = [
      { label: t('menu.previous'), x: fine(book.x) + at.left.x, y: fine(book.y) + at.left.y + 1 - size, flip: true, can: slice.page > 0, page: slice.page - 1 },
      { label: t('menu.next'), x: fine(book.x) + at.right.x + 1 - size, y: fine(book.y) + at.right.y + 1 - size, flip: false, can: slice.page < slice.pages - 1, page: slice.page + 1 },
    ];
    for (const c of corners) {
      const look = (up: boolean) => (c.flip ? flipX(up ? lifted : resting) : up ? lifted : resting);
      const image = c.can ? this.fineImage(c.x, c.y, look(false), BOOK_PALETTE).setName(`pageTurn:${c.flip ? 'left' : 'right'}`) : null;
      const pressX = c.flip ? c.x : c.x + size - press, pressY = c.y + size - press;
      this.button({
        x: (pressX + press / 2) / ART_DETAIL, y: (pressY + press / 2) / ART_DETAIL, width: FOLD.size, height: FOLD.size, label: c.label, tooltip: c.label, iconOnly: true,
        picture: createBitmap(FOLD.size, FOLD.size), disabled: !c.can, onClick: () => turn(c.page),
        onHover: (over) => image?.setBitmap(look(over), BOOK_PALETTE),
      });
    }
    // the page numbers, each at the middle of its page's foot
    const spine = book.x + book.w / 2;
    [{ n: 2 * slice.page + 1, centre: (book.x + spine) / 2 }, { n: 2 * slice.page + 2, centre: (spine + book.x + book.w) / 2 }].forEach(({ n, centre }) => {
      // painted a fine pixel to a cell, so its strokes are as heavy as the writing on the page
      const folio = paintFolio(n);
      this.root.add(new PixelImage(this, Math.round(centre - folio.width / 2), book.y + Math.round(at.right.y / ART_DETAIL) - FOLIO_FOOT - folio.height, folio, BOOK_PALETTE).setName(`pageNumber:${n}`));
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
    // the piece whose clef is coming shows the clef it had until the new one lands
    const coming = this.flight?.chartId === piece.chart.id ? this.flight : null;
    const medal = coming ? coming.before : pieceClef(piece.chart, profiles.learnProgressOf(piece.chart.id), profiles.learnSettings, profiles.practiceFor(piece.chart.id));
    return [{ bitmap: clefPrize(medal), name: `clefPrize:${medal ?? 'empty'}` }];
  }

  private showInfo(id: string | null): void {
    this.infoId = id;
    this.armedHide = null;
    this.redraw();
  }

  /**
   * The piece's own level (ft_1_13) in the first of `places` it fits in (from `x` up to `limit`, at `y`), else not written;
   * never over a button.
   */
  private pieceLevel(button: PixelButton, record: PieceRecord, flip: (x: number, w?: number) => number, places: { x: number; y: number; limit: number }[]): void {
    const text = t('menu.pieceLevel', { level: record.level.level });
    const width = measure(drawnText(text));
    const place = places.find((p) => p.x + width <= p.limit);
    if (!place) return;
    const level = new PixelText(this, flip(place.x, width), place.y, text, { color: C.umberDark }).setName('pieceLevel');
    this.root.add(level);
    button.attach(level);
  }

  /**
   * A card's small buttons in a row on its second line, each in its own place whether or not it is there: parts, S, i and
   * the hide button, outward from the stars.
   */
  private cardButtons(piece: Piece, button: PixelButton, at: (place: number) => { x: number; y: number }): { info: PixelButton; stats: PixelButton } {
    const small = (place: { x: number; y: number }, label: string, onClick: () => void): PixelButton =>
      this.own(new PixelButton(this, this.root, { ...place, width: INFO_SIZE, height: INFO_SIZE, label, look: 'ink', inkBox: true, onClick }));
    const info = small(at(2), t('info.button'), () => this.showInfo(piece.chart.id));
    this.infoButtons.set(piece.chart.id, info);
    const stats = small(at(1), t('stats.button'), () => startScene(this, 'results', { chartId: piece.chart.id }));
    this.statsButtons.set(piece.chart.id, stats);
    // AX-3 provisional: the parts page (the song page with the piece at its root, ft_1_36.AC13) is reached by a small button, not by the card, so a tap still plays at once (core_06)
    if (piece.chart.phrases.length > 0 && !this.maker) {
      this.partsButtons.set(piece.chart.id, small(at(0), t('parts.button'), () => startScene(this, 'song', { chartId: piece.chart.id })));
    }
    // past i: take the piece out of the book, in two presses (ft_1_02c.AC8); never the last piece in it
    if (!this.maker && contextOf(this).profiles.canTurnOff(piece.chart.id)) this.hideButton(piece.chart.id, button, at(3));
    return { info, stats };
  }

  /**
   * One piece: its title and, once played, its own level (ft_1_13) under it, with its stars and small buttons. At the outer
   * end of the title's line its groups' signs: an own piece's pencil (which opens it in the piece maker), a character's speech bubble in
   * its colour, and the teacher's academic hat on a curriculum piece with the days left and a bar of how near it is, or,
   * finished, the hat in its medal's colours (ft_1_26.AC8), then its clef prizes. No piece is locked (ft_1_13.AC3).
   */
  private card(piece: Piece, x: number, y: number, width: number, record: PieceRecord | null, mirrored = false): PixelButton {
    // laid out as on the right page, then mirrored about the card's middle on the left page: a thing at x, w wide
    const cardLeft = x - width / 2;
    const flip = (at: number, w = 0): number => (mirrored ? 2 * cardLeft + width - at - w : at);
    const left = cardLeft;
    const top = y - this.cardRow / 4 - CARD_HEIGHT / 4;
    const line = CARD_HEIGHT / 2;
    // the small buttons in a row on the second line, one button's width past the stars; `at` is a place's centre
    const firstButton = left + 6 + GRADE_WIDTH + INFO_SIZE + INFO_SIZE / 2;
    const at = (place: number) => ({ x: flip(firstButton + place * STATS_OFFSET), y: top + 23 });
    const lineEnd = left + width - 5;
    // written in the book: the title on the first line with its signs at the line's outer end, the line under it the stars and the
    // piece's level; the title is what plays the piece
    const mark = this.maker ? undefined : this.curriculumMarks.get(piece.chart.id);
    const teacher = CHARACTER_PIECES.get(piece.chart.id);
    const editable = piece.own === true && !this.maker && contextOf(this).flags.editor;
    const days = mark && !mark.finished ? String(mark.daysLeft) : null;
    const daysWidth = days === null ? 0 : Math.max(measure(drawnText(days)), NEAR_BAR.w);
    const prizes = this.clefSigns(piece);
    const signs = [
      ...(piece.own === true ? [editable ? INFO_SIZE : PENCIL.width] : []),
      ...(teacher !== undefined ? [BUBBLE.width] : []),
      ...(mark ? [HAT.w + (days === null ? 0 : daysWidth + SIGN_GAP)] : []),
      ...prizes.map((p) => p.bitmap.width),
    ];
    // the signs at the title line's outer end, clear of the turned corner; a title too long for the room before them is cut on one line
    const signsStart = lineEnd - 6 - signs.reduce((a, b) => a + b + SIGN_GAP, 0) + SIGN_GAP;
    // with no signs the title has its line to the end; a title too long for that is cut too
    const room = (signs.length === 0 ? lineEnd : signsStart - 4) - (left + 6);
    const title = clipToWidth(pieceTitle(piece.chart), room, (text) => measure(drawnText(text)));
    const titleEnd = left + 6 + measure(drawnText(title));
    const buttonWidth = (signs.length === 0 ? lineEnd : signsStart - 2) - left;
    const button = this.button({
      x: flip(left + buttonWidth / 2), y: top + CARD_HEIGHT / 4, width: buttonWidth, height: CARD_HEIGHT / 2, label: title, look: 'ink', align: mirrored ? 'right' : 'left', labelWidth: room,
      onClick: () => {
        if (this.maker) startScene(this, 'editor', { id: piece.chart.id });
        else if (this.forKiur === 'tug') startScene(this, 'profile', { kiurTug: piece.chart.id });
        else if (this.forKiur === 'learn') startScene(this, 'practice', { chartId: piece.chart.id, learn: true });
        else startScene(this, 'practice', { chartId: piece.chart.id });
      },
    });
    // the signs, outward: the pencil, the bubble, the days and bar with the hat, the prizes at the line's end
    let cursor = signsStart;
    const signImages: PixelImage[] = [];
    const sign = (bitmap: Bitmap, name: string): PixelImage => {
      const image = new PixelImage(this, flip(cursor, bitmap.width), top + Math.floor((line - bitmap.height) / 2), bitmap).setName(name);
      this.root.add(image);
      signImages.push(image);
      cursor += bitmap.width + SIGN_GAP;
      return image;
    };
    if (piece.own === true && editable) {
      const pencil = this.own(new PixelButton(this, this.root, {
        x: flip(cursor + INFO_SIZE / 2), y: top + line / 2, width: INFO_SIZE, height: INFO_SIZE, label: t('menu.edit'), look: 'ink', icon: PENCIL, iconOnly: true,
        onClick: () => startScene(this, 'editor', { id: piece.chart.id }),
      }));
      this.editButtons.set(piece.chart.id, pencil);
      cursor += INFO_SIZE + SIGN_GAP;
    } else if (piece.own === true) sign(PENCIL, 'ownPencil');
    if (teacher !== undefined) sign(recolor(BUBBLE, { [C.white]: CHARACTER_INK[teacher] ?? C.teal }), 'characterBubble');
    if (mark) this.daysSign(mark, days, daysWidth, { top, cursor, flip }, signImages);
    if (mark) cursor += daysWidth === 0 ? 0 : daysWidth + SIGN_GAP;
    if (mark) sign(hatFor(mark), mark.finished ? `curriculumHat:${mark.medal ?? 'green'}` : 'curriculumHat');
    prizes.forEach((p) => {
      const image = sign(p.bitmap, p.name);
      if (this.flight?.chartId === piece.chart.id) this.flightSign = image;
    });
    const { info, stats } = this.cardButtons(piece, button, at);
    // past the small buttons, else past the title and its signs
    if (record) this.pieceLevel(button, record, flip, [{ x: firstButton + 3 * STATS_OFFSET + INFO_SIZE / 2 + 4, y: top + 20, limit: left + width - 1 }, { x: titleEnd + 6, y: top + 4, limit: signsStart - 3 }]);
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

  /** A curriculum piece's days left, over a bar of how near the deadline is, at `cursor` on the title's line, before its hat. */
  private daysSign(mark: CurriculumMark, days: string | null, daysWidth: number, card: { top: number; cursor: number; flip: (x: number, w?: number) => number }, into: PixelImage[]): void {
    if (days === null) return;
    const { top, cursor, flip } = card;
    const label = this.label(flip(cursor, measure(drawnText(days))), top, days, C.featherStreak);
    label.setName('curriculumDays');
    const bar = new PixelBar(this, flip(cursor, NEAR_BAR.w), top + 10, NEAR_BAR.w, NEAR_BAR.h, mark.closeness, 'ink');
    this.root.add(bar);
    into.push(label, bar);
  }
}
