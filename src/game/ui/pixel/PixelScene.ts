import Phaser from 'phaser';
import { pagerBoxes } from '../../../core/layout/cardGrid';
import type { PageSlice } from '../../../core/layout/paging';
import { ART_DETAIL, FRAME_ROWS, VINE_ROWS, frameCorners, frameView, toolbarLayout, type FrameView } from '../../../core/layout/frame';
import { BUBBLE_SLOTS, SLIDER_CELLS, bubbleLayout, bubblePage, cellSpan, pinFlow, pinRows, sliderArc, sliderFraction, sliderPoint, sliderStep, twoFingerTap, twoFingersSlid, wheelChoice, type BubbleLayout, type SliderArc } from '../../../core/layout/bubble';
import type { PixelView } from '../../../core/layout/pixelView';
import { rectCentre, type Rect } from '../../../core/layout/rect';
import { dropMenuLayout } from '../../../core/layout/dropMenu';
import { t } from '../../../core/text/strings';
import { clipToWidth } from '../../../core/text/clip';
import { initialFocus, moveFocus, refocus, type FocusMove } from '../../../core/layout/focus';
import { panelBitmap } from './frames';
import { ICONS } from './iconArt';
import { TOOL_ICONS } from './toolArt';
import { signOnly } from './itemArt';
import { PALETTE, C } from './palette';
import { createBitmap, flipX, recolor, type Bitmap } from './bitmap';
import { LiveImage, PixelBar, PixelButton, PixelImage, PixelText, type PixelButtonOptions, type RgbaArt } from './PixelObjects';
import { BACKPACK, BUBBLE_ALPHA, choicePatch, choicesSausage, CHOICE_SIZE, stripBitmap, stripCell, wornChip } from './bubbleArt';
import { LiveWaterPlayer } from './liveWater';
import type { LiveWater } from './paint/live';
import { TITLE_X, TOP_BAR } from './playBars';
import { DESK_PALETTE, paintBeam, paintDesk } from './paint/desk';
import { paintedOnce } from './paintedOnce';
import { CARD_PALETTE, RIBBON_TAIL, paintCard, paintRibbon } from './paint/card';
import { BOOK_PALETTE, PAGE_TURN, REGISTER_PALETTE, pageCorners, paintBook, paintFolio, paintPageTurn } from './paint/book';
import { RULING_PALETTE, inkField, paintRuling } from './paint/register';
import { REGISTER, registerLayout, type RegisterLayout } from '../../../core/layout/register';
import { contextOf } from '../../context';
import { motionAllowed } from '../../motion';
import { measure, drawnText, wrap } from './font';
import type { WindWay } from './paint/motion';
import { cloudX, fadeWeights, type CloudCourse } from './windMotion';
import { STILL_AIR, type Air } from './windField';
import type { Mote } from './motes';
import { gullLook, type Flock } from './flock';
import type { LoadedPictures } from './pack';

/** One of a screen's own buttons on the toolbar (d088): `iconOnly` when the bar is full, so give it an icon. */
export interface ToolbarItem {
  label: string;
  icon?: Bitmap;
  /** Width in art pixels with its label; an icon-only item is 22 wide. Default: the label's width plus a margin. */
  width?: number;
  /** Lit, like a tab that is chosen. */
  active?: boolean;
  /** A band slot on a purple ground: the item a click on the staff writes with (`setArmed`). */
  armed?: boolean;
  /** Always the picture only, 22 wide, with the label as its name (a hint switch); otherwise only when the bar is full. */
  iconOnly?: boolean;
  /** The icon is on the fine grid (d110): an item's picture in a slot of the band (`itemArt.ts`). */
  fineIcon?: boolean;
  tooltip?: string;
  /** Dim and pressing it does nothing (a step that is at its end, a tempo at its slowest). */
  disabled?: boolean;
  /** Draw the label as written (a dynamic such as `mf`, a finger number). */
  keepCase?: boolean;
  /**
   * An opening item (ft_1_20 rule 2) that opens a drop-down of choices from its own cell or slot (`openMenu`); its
   * `onClick` is then not called.
   */
  menu?: { items: () => readonly (MenuItem | null)[]; cell: { w: number; h: number }; columns: number };
  /** Hears the button made for the item, so a screen can change its label, picture or light later without drawing again. */
  ref?: (button: PixelButton) => void;
  /** The key that does what the item does (the piece maker): drawn on the item while `shortcutsShown`, and always in the bubble. */
  shortcut?: string;
  /** The screen's main action (Play again, Done): it stands at the right end of the strip, in the same place on every screen (ft_1_20, d282). */
  main?: boolean;
  /** A worn option (note names, fingers): picked in the bubble it switches and leaves the bubble open, and while on it stands lit beside More. */
  worn?: boolean;
  /** A bubble option's preview (d286): drawn while the pointer rests on it, taken away when it leaves or the bubble closes. */
  preview?: (on: boolean) => void;
  /**
   * A bubble option that sets a value in a range (ft_1_20.AC26): it opens a slider along the outer ring in place of
   * choices. `change` shows each value while the knob is dragged (the preview, d286); `commit` keeps the one let go of
   * (or set with the arrow keys); a drag given up with Esc shows `value` again.
   */
  slider?: BubbleSlider;
  onClick: () => void;
}

/** The choices an open bubble option shows on the outer ring: none for a slider (ft_1_20.AC26), which has a track there. */
function ringChoices(open: ToolbarItem | null | undefined): readonly (MenuItem | null)[] {
  if (!open || open.slider) return [];
  return open.menu?.items() ?? [];
}

/** An open slider: its option, the value shown, whether its knob is held, and how it is moved (`keep` keeps the value). */
interface OpenSlider {
  item: BubbleSlider;
  /** Its track, in art pixels. */
  arc: SliderArc;
  value: number;
  /** The value kept last (the one a drag given up goes back to). */
  kept: number;
  dragging: boolean;
  set: (value: number, keep: boolean) => void;
}

/** A slider in the bubble (ft_1_20.AC26): its value now, its range and steps, and what showing and keeping a value do. */
export interface BubbleSlider {
  value: number;
  min: number;
  max: number;
  step: number;
  change: (value: number) => void;
  commit: (value: number) => void;
  /** A drag given up (Esc, or the bubble closed while the knob is held): the screen takes its preview away. */
  cancel?: () => void;
}

/** A layer drawn over the staff (which draws at depth 8 to 10) and under a drop-down menu: Kiur, his bubble, an open panel. */
const OVER_STAFF_DEPTH = 20;

const TOOLBAR_ICON_WIDTH = 22;
/** Room a band cell keeps round its word (the frame and a margin); a longer word shows its picture instead. */
const CELL_PAD = 4;
/**
 * How solid the door and the gear in the top corners are while the pointer is elsewhere (clear when
 * hovered, faded when not); full while the pointer or the keyboard focus is on them. AX-3 provisional: the exact amount.
 */
const CORNER_FADED = 0.45;
/** The cells a corner's plate reaches above and below its button's box (frameCorners' boxes start two cells down). */
const CORNER_PLATE_GROW = 1;
/** A book page's turned-up corner (the pager, ft_1_12 rule 1) takes a press this many cells on a side, its corner on the page's. */
const FOLD = { size: 17 } as const;
/** A book page's number stands this many cells over the page's foot. */
const FOLIO_FOOT = 3;

/** One choice in a drop-down menu (`openMenu`): a picture with its name as the tooltip, or a short label. */
export interface MenuItem {
  label: string;
  icon?: Bitmap;
  tooltip?: string;
  /** The value in use now: drawn lit, so the menu shows where you are. */
  active?: boolean;
  /** Shown but cannot be picked (a length the bar cannot hold). */
  disabled?: boolean;
  keepCase?: boolean;
  /** The icon is on the fine grid (d110): an item's picture (`itemArt.ts`). */
  fineIcon?: boolean;
  /** The key that picks this choice while the menu is open from the keyboard (a digit): drawn on its cell. */
  shortcut?: string;
  /** Shows (true) and takes away (false) what picking the choice would do, while the pointer rests on it (d286). */
  preview?: (on: boolean) => void;
  onPick: () => void;
}

/** A drop-down is drawn over everything of its screen, the staff too (the staff draws at depth 8 to 10). */
const MENU_DEPTH = 1000;
/** A cell of the strip, in layout cells (ft_1_20, d282: `src/core/layout/bubble.ts`). */
const STRIP_CELL_WIDTH = 30;
/** Room between the backpack and the gear, so the two are not taken for each other. */
const BACKPACK_GAP = 2;
/** A long press opens the bubble after this long (ft_1_20, d282); moving the finger farther than `LONG_PRESS_SLIP` screen pixels cancels it. */
/** The largest music sign (fine pixels) in a round option of the bubble and in a cell of the strip. */
const BUBBLE_SIGN = 24;
const STRIP_SIGN = 22;
/** The long press's ring starts to fill this long after the finger went down. */
const LONG_PRESS_RING_FROM_MS = 150;
/** More pulses on this many first visits of a screen. */
const MORE_PULSE_VISITS = 3;
const LONG_PRESS_MS = 450;
const LONG_PRESS_SLIP = 12;

const MENU_GAP = 2;
const MENU_PAD = 3;

/**
 * A scene drawn in art pixels. It works out the whole-number zoom for the screen (`frameView`), puts everything in a
 * `root` container scaled by that zoom, and draws again when the window changes size. Subclasses only say what to
 * draw, in art pixels, in the main area. An art pixel of `root` is a layout cell of 2 x 2 fine pixels; art
 * drawn on the finer 640 x 360 grid goes through `fineImage`: every screen's frame (d088), the toolbar and the vine above the main area, is
 * drawn here. `root`'s origin is the main area's top-left corner; the toolbar sits at negative y above it.
 */
/** Something that moves: it runs every frame with the scene clock in milliseconds and shows its look for that time. */
export type Animator = (timeMs: number) => void;

/** How often live water (`liveWater`) is lit afresh: about 15 times a second, the pace of a 1991 game's animation. */
const LIVE_STEP_MS = 66;

/** Something a scene draws afresh as it runs (a thread of smoke): its box in a picture (fine pixels), and how it is drawn at a time. */
export interface LiveLayer {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** Draws it at `time` ms into `out` (`w` x `h` palette places, cleared to 0 before). */
  draw(time: number, out: Uint8Array): void;
}

/** A mote's heart: one white pixel, tinted to its colour. */
const MOTE_HEART = 'mote-heart';
/** How wide the glow's texture is, in its own pixels. */
const MOTE_GLOW = 16;

/** The glow round a mote: white, soft, fading to nothing at its rim; made once per game, with the heart's pixel. */
function moteTexture(scene: Phaser.Scene): string {
  const key = 'mote-glow';
  if (scene.textures.exists(key)) return key;
  const size = MOTE_GLOW, glow = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const r = Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) / (size / 2);
    const o = (y * size + x) * 4;
    glow.fill(255, o, o + 3);
    glow[o + 3] = Math.round(255 * Math.max(0, 1 - r) ** 1.6);
  }
  scene.textures.addUint8Array(key, glow, size, size);
  if (!scene.textures.exists(MOTE_HEART)) scene.textures.addUint8Array(MOTE_HEART, new Uint8Array([255, 255, 255, 255]), 1, 1);
  return key;
}

/** How long each dot of the loading view is lit. */
const LOADING_DOT_MS = 250;

/** The mark that shows where the next letter goes in a box being written in, in layout cells: as tall as a capital. */
const CARET_HEIGHT = 7;

export abstract class PixelScene extends Phaser.Scene {
  /**
   * Zoom and the main area's size in layout cells (`px.scale`, `px.width`, `px.height`), valid inside `draw`; `px.fine` is
   * the screen pixels per fine art pixel (d110).
   */
  protected px!: PixelView & { fine: number };
  /** The toolbar's buttons (Back, the screen's items, settings, the keyboard switch), also in `buttons`. */
  protected toolbarButtons: { back: PixelButton | null; settings: PixelButton | null; keys: PixelButton | null; items: PixelButton[] } = { back: null, settings: null, keys: null, items: [] };
  /** False on a screen without an active player (the profile picker, admin): the toolbar leaves out the name, rank, XP and settings. */
  protected toolbarPlayer = true;
  /** False on a screen with nowhere to go back to: the toolbar leaves out the Back door. */
  protected toolbarBack = true;
  /** True on the settings screen only: the on-screen keyboard switch at the toolbar's right end (d099, a developer's tool now). */
  protected toolbarKeys = false;
  /** True on a screen that paints every row itself (the main menu, ft_1_07): no toolbar, no vine and no band are drawn, and the main area is the whole screen. */
  protected wholeScreen = false;
  /** False on an overlay (d070): no frame and no background of its own, so the paused screen under it shows through. */
  protected framed = true;
  /**
   * True on a screen that keeps the toolbar and draws no band: the teacher's screens, administrative with no gameplay.
   * Every other framed screen has the band (ft_1_20.AC9).
   */
  protected keepsToolbar = false;
  /** What the toolbar's Back does; `back()` by default (the play screens set it through `topBar`). */
  private backAction: (() => void) | null = null;
  /** The frame this screen is drawn in: with or without the toolbar and the band (ft_1_20), set before `draw`. */
  private screenFrame!: FrameView;
  /** The bubble's page (More in its last slot turns it, ft_1_20.AC19); kept over redraws. */
  private bubblePageNo = 0;
  /** Pinned actions the strip had no room for: they go into the bubble's empty slots (ft_1_20.AC21). */
  private stripOverflow: ToolbarItem[] = [];
  /** Where the strip's items are drawn (art pixels), for the wheel over an item with choices (ft_1_20.AC16); null without a strip. */
  private inventoryBand: { area: Rect; slots: { rect: Rect; item: ToolbarItem }[] } | null = null;
  /** The strip's free stretch between its left group (with the worn options) and its main action, in art pixels; null without a strip. */
  private stripFree: { left: number; right: number; top: number; rows: number } | null = null;
  /** A long press on a touch screen that may open the bubble (ft_1_20, d282): where it began and its timer. */
  private longPress: { x: number; y: number; timer: Phaser.Time.TimerEvent; ring: Phaser.GameObjects.Graphics } | null = null;
  /** The bubble was just opened by a long press: the lift of that finger must not close it or pick anything. */
  private bubbleFreshTouch = false;
  /** The fingers on a touch screen now, where and when each landed, for the two-finger tap (ft_1_20.AC25). */
  private touches = new Map<number, { x: number; y: number; t: number; palm: boolean }>();
  /** The two fingers that opened the bubble, where they landed: sliding apart is a pinch, which closes it again. */
  private twoFinger: { ids: number[]; start: { x: number; y: number }[] } | null = null;
  /** Lifts of the fingers that opened the bubble still to come: they pick nothing. */
  private bubbleTouchLifts = 0;
  /** Whether the fingers now on the screen, or the last ones, came down two or more at once (a gesture, never a tap). */
  private manyFingers = false;
  /** The door and the gear over the top corners with the band and no toolbar: faded until the pointer or the focus is on them. */
  private corners: PixelButton[] = [];
  /**
   * True on a screen whose card or frame reaches under the top corners (the score screen, the settings): the door and the
   * gear stand on a strip cell of their own, never faded, so they read over the light parchment.
   */
  protected cornersOnCard = false;
  /** Everything of the scene goes in here, positions in art pixels. */
  protected root!: Phaser.GameObjects.Container;
  /** Buttons made with `button` (so a test can find and press them). */
  protected buttons: PixelButton[] = [];
  /** Menu-like screens set this to let the keyboard move between buttons (arrows), press one (Enter, Space) and go back (Esc). */
  protected keyboardNavigation = false;
  /** Index into `buttons` of the focused button, or -1. The ring shows only after the first navigation key. */
  protected focusIndex = -1;
  private focusShown = false;
  private others: { destroy(): void }[] = [];
  /** True while a painted picture this screen shows is still loading (d143); end-to-end tests wait until it is false. */
  loading = false;
  /** Counts the scene's visits: a picture that arrives after the visit it was asked for has ended draws nothing. */
  private visit = 0;
  /** The open drop-down menu, if any: its container and its choices (which are also in `buttons` while it is open). */
  /** The open menu; `previews` are its choices' previews, taken away when it closes (a closing menu sends no pointer-out). */
  private menu: { container: Phaser.GameObjects.Container; buttons: PixelButton[]; focusBefore: number; bubble?: boolean; ring?: PixelButton[]; previews?: ((on: boolean) => void)[]; slider?: OpenSlider } | null = null;
  /** F1 in the piece maker: every band item with a key shows it in its corner. */
  protected shortcutsShown = false;
  /** The band's buttons by their key, as last drawn: a key opens its item's menu from the item. */
  protected shortcutButtons = new Map<string, PixelButton>();

  /**
   * A line of text in the scene, with a dark shadow unless `shadow` is false; `big` draws it at twice the size, and
   * `maxWidth` wraps it (in art pixels, before the doubling). `y` is the top of the capitals: every letter, Õ Ä Ö Ü with
   * their marks too, fits the capital height (d086).
   */
  protected label(x: number, y: number, value: string, color: number = C.white, options: { big?: boolean; maxWidth?: number; shadow?: boolean } = {}): PixelText {
    const ink = this.inkWriting;
    const text = new PixelText(this, x, y, value, { color: ink ? inkOf(color) : color, ...(options.shadow === false || ink ? {} : { shadow: C.groove }), ...(options.maxWidth ? { maxWidth: options.maxWidth } : {}) });
    if (options.big) text.setScale(2);
    this.root.add(text);
    return text;
  }

  /** Draw the scene into `this.root` for the current `this.px`. Called again after every resize. */
  protected abstract draw(): void;

  /**
   * Called after the frame is drawn, with the strip's free stretch (between its left group and its main action, in art
   * pixels from the main area's top), so a screen can show a small reading there; nothing by default.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected afterFrame(_free: { left: number; right: number; top: number; rows: number } | null): void {}

  /**
   * True while a screen writes on parchment (a card, a book): `label` writes in ink, with no
   * shadow, the light colours in brown-black and the golds in red ink. Set it in `draw`; it is cleared before the frame
   * (the beam's texts) is drawn.
   */
  protected inkWriting = false;

  /**
   * A card of parchment laid on the desk (`paint/card.ts`) over `rect` (layout cells), drawn where it is called: call it
   * before what is written on it. `seed` gives another tear.
   */
  protected parchmentCard(rect: Rect, seed = 1): PixelImage {
    const w = rect.w * ART_DETAIL, h = rect.h * ART_DETAIL;
    return this.fineImage(rect.x * ART_DETAIL, rect.y * ART_DETAIL, paintedOnce(`card:${w}x${h}:${seed}`, () => paintCard(w, h, seed)), CARD_PALETTE);
  }

  /** An open book (`paint/book.ts`) laid on the desk over `rect` (layout cells): call it before what is written in it. */
  protected openBook(rect: Rect): PixelImage {
    const w = rect.w * ART_DETAIL, h = rect.h * ART_DETAIL;
    return this.fineImage(rect.x * ART_DETAIL, rect.y * ART_DETAIL, paintedOnce(`book:${w}x${h}`, () => paintBook(w, h)), BOOK_PALETTE);
  }

  /**
   * The book's pager (ft_1_12 rule 1), on the piece book and every page written in it (the songs, ft_1_36 rule 10): no words. Each page has its number at its foot, printed as an old book prints it
   * (`paintFolio`: the left page 1, 3, 5 ..., the right 2, 4, 6 ...); the left page's bottom corner is turned up while
   * there is a page before, the right page's while there is one after. Under the pointer the corner rolls up further, as a
   * hand lifts it, and a press on it turns the page. A corner with no page behind lies flat and takes no press.
   */
  protected bookPager(slice: { page: number; pages: number }, book: Rect, turn: (page: number) => void): void {
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

  /**
   * The teacher's register (WP-14, d145): the song book bound in green cloth, laid over the whole main area, and what is
   * written from here on in ink. Returns its pages, for what is written in it.
   */
  protected register(): RegisterLayout {
    const layout = registerLayout(this.px.width, this.mainRows);
    const { book } = layout;
    const w = book.w * ART_DETAIL, h = book.h * ART_DETAIL;
    this.fineImage(book.x * ART_DETAIL, book.y * ART_DETAIL, paintedOnce(`book:${w}x${h}`, () => paintBook(w, h)), REGISTER_PALETTE);
    this.inkWriting = true;
    return layout;
  }

  /**
   * A heading at the head of a register's page: written big when it fits the page on one line, else at the writing's
   * size, wrapped. Returns the row under it.
   */
  protected registerTitle(page: { x: number; w: number }, top: number, value: string): number {
    const big = measure(drawnText(value)) * 2 <= page.w;
    const text = this.label(page.x, top, value, C.gold, big ? { big: true } : { maxWidth: page.w });
    return top + text.displayHeight + 4;
  }

  /**
   * The register's ruling (`paint/register.ts`) between `top` and `bottom` (layout cells): a faint line under each of
   * `rows` across both pages, the column rules at `columns`, the red margin at `margin`. Call it after `register`.
   */
  protected ruling(layout: RegisterLayout, rows: readonly number[], columns: readonly number[], margin: number | null, top: number, bottom: number): void {
    const { book, left, right } = layout;
    const fine = (v: number) => v * ART_DETAIL;
    const w = fine(book.w), h = fine(book.h);
    const ruling = {
      rows: rows.map((y) => fine(y - book.y)), from: fine(left.x - book.x - 4), to: fine(right.x + right.w - book.x + 2),
      gutter: [fine(left.x + left.w - book.x + 2), fine(right.x - book.x - 3)] as const,
      margin: margin === null ? null : fine(margin - book.x), columns: columns.map((x) => fine(x - book.x)), top: fine(top - book.y), bottom: fine(bottom - book.y),
    };
    this.fineImage(fine(book.x), fine(book.y), paintRuling(w, h, ruling), RULING_PALETTE);
  }

  /**
   * The register's ruling from the line at `first` (layout cells) to the book's foot: a rule over that line and under every
   * line the pages hold, so no page of the register is left bare (the art review). The row of the last line.
   */
  protected ruleToFoot(layout: RegisterLayout, first: number): number {
    const lines = Math.max(1, Math.floor((layout.bottom - first) / REGISTER.row));
    const rules = Array.from({ length: lines + 1 }, (_, i) => first + i * REGISTER.row - 2);
    this.ruling(layout, rules, [], null, first - 2, rules[lines]!);
    return first + (lines - 1) * REGISTER.row;
  }

  /** `value` written on a register's `page` one ruled line to a line from `top` (layout cells), wrapped to the page: how many lines it took. */
  protected ruledText(page: { x: number; w: number }, top: number, value: string, color: number): number {
    const lines = wrap(drawnText(value), page.w);
    lines.forEach((line, i) => this.label(page.x, top + i * REGISTER.row, line, color));
    return lines.length;
  }

  /**
   * A box to write in on a register's line at `top` (layout cells), from `x`, `w` wide, drawn by hand (`inkField`) between
   * the line's rules, with `value` written in it; the box being written in is red and shows where the next letter goes.
   */
  protected ruledField(x: number, top: number, w: number, value: string, active: boolean): void {
    const fine = (v: number) => v * ART_DETAIL;
    this.fineImage(fine(x - 3), fine(top - 1), inkField(fine(w), fine(REGISTER.row - 2), active));
    let shown = value;
    while (shown.length > 0 && measure(shown) > w - 8) shown = shown.slice(1);
    if (shown) this.label(x, top, shown, C.ink);
    if (!active) return;
    const caret = createBitmap(2, fine(CARET_HEIGHT));
    caret.pixels.fill(C.redDark);
    this.fineImage(fine(x + (shown ? measure(shown) + 2 : 0)), fine(top), caret);
  }

  /** A ribbon (`paint/card.ts`) under a title, `rect` the title's box in layout cells: the ribbon reaches past it on both sides. */
  protected ribbon(rect: Rect): PixelImage {
    const w = (rect.w + 16) * ART_DETAIL, h = (rect.h + 6) * ART_DETAIL;
    return this.fineImage((rect.x - 8) * ART_DETAIL - RIBBON_TAIL, (rect.y - 3) * ART_DETAIL - 2, paintedOnce(`ribbon:${w}x${h}`, () => paintRibbon(w, h)));
  }

  /** Called when the scene is rebuilt, before anything is drawn again: stop timers and tweens made by `draw`. */
  protected clear(): void {}

  /** What moves in the scene, made by `draw`; emptied when the scene is drawn again. Nothing is added with reduced motion. */
  protected animators: Animator[] = [];

  override update(time: number): void {
    for (const animate of this.animators) animate(time);
  }

  /**
   * Shows one of `images` at a time, `ms` each, in `order` (image numbers; every image in turn when not given). With
   * reduced motion, or with `ms` 0, only the first of the order shows. With `fade`, each look dissolves into the next
   * instead of stepping (`fadeWeights`): for what should flow, the sea and a light that breathes (the
   * stepped looks were choppy), never for a thing that moves its shape (a pendulum, a flame). `gain` (with
   * `fade`) scales every look's opacity, for looks that are themselves shown or hidden (an object's second look).
   */
  protected cycle(images: readonly PixelImage[], ms: number, order: readonly number[] = images.map((_, i) => i), how: { fade?: boolean; gain?: () => number; clock?: (time: number) => number } = {}): void {
    images.forEach((image, i) => image.setVisible(i === order[0]));
    if (!motionAllowed() || images.length < 2 || ms <= 0) return;
    const clock = how.clock ?? ((time: number) => time);
    if (how.fade) {
      const gain = how.gain ?? (() => 1);
      this.animators.push((time) => {
        const weights = fadeWeights(order, clock(time) / ms);
        images.forEach((image, i) => {
          const weight = weights.get(i) ?? 0;
          image.setVisible(weight > 0).setAlpha(weight * gain());
        });
      });
      return;
    }
    this.animators.push((time) => {
      const shown = order[Math.floor(clock(time) / ms) % order.length]!;
      images.forEach((image, i) => image.setVisible(i === shown));
    });
  }

  /**
   * Shows `images` (looks of one thing, weakest first, each laid over the one before) blended at a strength that moves
   * as `level` says (0 the first look to the number of looks - 1 the last; `flicker.ts`): the look under the level shows
   * whole and the next one over it in part, so the light wanders smoothly between them. `gain` scales them all (looks
   * that are themselves shown or hidden). With reduced motion the first look shows.
   */
  protected blend(images: readonly PixelImage[], level: (time: number) => number, gain: () => number = () => 1): void {
    const show = (time: number): void => {
      const g = Math.max(0, Math.min(images.length - 1, level(time))), low = Math.floor(g), part = g - low;
      images.forEach((image, i) => {
        const weight = i === low ? 1 : i === low + 1 ? part : 0;
        image.setVisible(weight > 0).setAlpha(weight * gain());
      });
    };
    if (!motionAllowed() || images.length < 2) {
      images.forEach((image, i) => image.setVisible(i === 0));
      return;
    }
    show(0);
    this.animators.push(show);
  }

  /**
   * Clouds that drift over a painted picture with the wind (`windMotion.ts`): each on its day's course, cut at the
   * picture's edges, leaving on one side and coming in on the other. `area` is the picture's top-left corner and width
   * in fine pixels; a cloud whose course is null does not show today. They go on the place's wind (`air`): faster in a
   * gust, slower in a lull. With reduced motion each stands where it starts.
   */
  protected drift(clouds: readonly { bitmap: Bitmap; course: CloudCourse | null }[], area: { x: number; y: number; w: number }, way: WindWay, palette?: readonly number[], air: Air = STILL_AIR): void {
    for (const { bitmap, course } of clouds) {
      if (!course) continue;
      const image = this.fineImage(area.x + course.x, area.y + course.y, bitmap, palette);
      const place = (time: number): void => {
        // on the wind's clock where the cloud is now: it surges as a gust reaches it
        const here = cloudX(course, bitmap.width, area.w, time, way) + bitmap.width / 2;
        const x = cloudX(course, bitmap.width, area.w, air.time(time, here), way);
        // cut at the picture's edges on whole pixels of the cloud
        const from = Math.max(0, Math.ceil(-x)), to = Math.min(bitmap.width, Math.floor(area.w - x));
        image.setPosition((area.x + x) / ART_DETAIL, image.y).setCrop(from, 0, Math.max(0, to - from), bitmap.height);
      };
      place(0);
      if (motionAllowed()) this.animators.push(place);
    }
  }

  /**
   * Live water over a painted picture (`liveWater.ts`): its strokes, glints, bands and surf lit as the game runs, about
   * 15 times a second, each on its own course, faster in more wind (`gustMs`). `area` is the picture's top-left corner
   * in fine pixels. With reduced motion the water stands as at its first moment.
   */
  protected liveWater(water: LiveWater | undefined, area: { x: number; y: number }, palette: readonly number[], gustMs: number, seed: number, air: Air = STILL_AIR): void {
    if (!water) return;
    const player = new LiveWaterPlayer(water, seed);
    const image = new LiveImage(this, (area.x + player.x) / ART_DETAIL, (area.y + player.y) / ART_DETAIL, player.w, player.h, palette).setScale(1 / ART_DETAIL);
    this.root.add(image);
    const pixels = new Uint8Array(player.w * player.h);
    let shown = -1;
    const place = (time: number): void => {
      const step = Math.floor(time / LIVE_STEP_MS);
      if (step === shown) return;
      shown = step;
      player.paint(air.time(step * LIVE_STEP_MS, player.x + player.w / 2), gustMs, pixels);
      image.show(pixels);
    };
    place(0);
    if (motionAllowed()) this.animators.push(place);
  }

  /**
   * Something drawn afresh as the game runs (`LiveLayer`: a thread of smoke the gusts bend), about 15 times a second, at
   * `area`'s corner (fine pixels). With reduced motion it stands as at its first moment.
   */
  protected liveLayer(layer: LiveLayer, area: { x: number; y: number }, palette: readonly number[]): LiveImage {
    const image = new LiveImage(this, (area.x + layer.x) / ART_DETAIL, (area.y + layer.y) / ART_DETAIL, layer.w, layer.h, palette).setScale(1 / ART_DETAIL);
    this.root.add(image);
    const pixels = new Uint8Array(layer.w * layer.h);
    let shown = -1;
    const place = (time: number): void => {
      const step = Math.floor(time / LIVE_STEP_MS);
      if (step === shown) return;
      shown = step;
      pixels.fill(0);
      layer.draw(step * LIVE_STEP_MS, pixels);
      image.show(pixels);
    };
    place(0);
    if (motionAllowed()) this.animators.push(place);
    return image;
  }

  /**
   * Motes that glow (`motes.ts`: sparks, fireflies, spray) over a picture whose corner is `area` (fine pixels): each a
   * whole fine pixel at its heart with a soft glow round it laid on with light, as many as `most` at once. With reduced
   * motion none show: they are only ever passing.
   */
  protected motes(source: (time: number) => readonly Mote[], area: { x: number; y: number }, most: number): void {
    if (!motionAllowed()) return;
    const halo = moteTexture(this);
    const glows = Array.from({ length: most }, () => this.add.image(0, 0, halo).setOrigin(0.5).setBlendMode(Phaser.BlendModes.ADD).setVisible(false));
    const hearts = Array.from({ length: most }, () => this.add.image(0, 0, MOTE_HEART).setOrigin(0).setScale(1 / ART_DETAIL).setVisible(false));
    this.root.add([...glows, ...hearts]);
    this.animators.push((time) => {
      const shown = source(time);
      glows.forEach((glow, k) => {
        const mote = shown[k], heart = hearts[k]!;
        // a mote of size 0 is a sharp dot: no glow, and its pixel whole while it is lit
        const sharp = mote !== undefined && mote.size === 0;
        glow.setVisible(mote !== undefined && !sharp && mote.glow > 0.02);
        heart.setVisible(mote !== undefined && mote.glow > (sharp ? 0.12 : 0.25));
        if (!mote) return;
        const x = Math.round(area.x + mote.x), y = Math.round(area.y + mote.y);
        // the glow glides on the screen's own pixels; the heart keeps to the art's
        glow.setPosition((area.x + mote.x + 0.5) / ART_DETAIL, (area.y + mote.y + 0.5) / ART_DETAIL).setScale(mote.size / MOTE_GLOW / ART_DETAIL)
          .setTint(mote.colour).setAlpha(0.85 * mote.glow);
        heart.setPosition(x / ART_DETAIL, y / ART_DETAIL).setTint(mote.colour).setAlpha(sharp ? 1 : Math.min(1, mote.glow * 1.5));
      });
    });
  }

  /**
   * A flock of gulls (`flock.ts`) over a picture whose corner is `area` (fine pixels): each in its looks (`gullLooks`),
   * beating its wings now and then, turned the way it flies, carried by the place's wind. With reduced motion they hang
   * where they start, wings level.
   */
  protected gulls(flock: Flock, looks: readonly Bitmap[], body: { x: number; y: number }, area: { x: number; y: number }, palette: readonly number[], air: Air): void {
    const birds = flock.boids.map(() => looks.map((look) => this.fineImage(0, 0, look, palette).setVisible(false)));
    const place = (time: number): void => {
      // each gull is carried by the gust where it is
      flock.advance(time, (t, x) => air.way * (1 + 2 * air.wind) * air.gust(t, x));
      flock.boids.forEach((gull, k) => {
        const shown = motionAllowed() ? gullLook(k, time, gull.vy < -3) : 1;
        birds[k]!.forEach((image, i) => {
          image.setVisible(i === shown);
          if (i === shown) image.setPosition(Math.round(area.x + gull.x - body.x) / ART_DETAIL, Math.round(area.y + gull.y - body.y) / ART_DETAIL);
        });
      });
    };
    place(flock.time);
    if (motionAllowed()) this.animators.push(place);
  }

  create(): void {
    this.screenOpenedAt = performance.now();
    const visit = ++this.visit;
    this.events.once('shutdown', () => { if (this.visit === visit) this.visit++; });
    this.focusIndex = -1;
    this.focusShown = false;
    this.lastFocusRect = null;
    this.bubblePageNo = 0;
    if (this.framed) this.cameras.main.setBackgroundColor(PALETTE[C.night]);
    // the pointer left the canvas (up into the toolbar, or down to the on-screen keys): no button stays lit or keeps its tooltip
    this.input.on('gameout', () => this.buttons.forEach((b) => b.leave()));
    // the wheel over an item of the strip with choices steps through them (ft_1_20.AC16)
    this.input.on('wheel', (p: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) => this.inventoryWheel(p, dy));
    // the bubble (ft_1_20, d282): a right click, a long press on a touch screen, the context-menu key or Shift + F10
    this.input.mouse?.disableContextMenu();
    this.moreVisitCounted = false;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.bubblePointerDown(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.longPress && Math.hypot(p.x - this.longPress.x, p.y - this.longPress.y) > LONG_PRESS_SLIP) this.cancelLongPress();
    });
    this.input.on('pointerup', () => this.cancelLongPress());
    this.listenForTwoFingers();
    this.onWindowKey((e) => this.bubbleKey(e));
    // the keyboard switch on the toolbar lights while the on-screen keyboard is shown, whoever changed it
    const keys = contextOf(this).keyboardSwitch;
    const stop = keys.onChange(() => this.lightKeys(keys.shown()));
    this.events.once('shutdown', stop);
    const rebuild = () => this.rebuild();
    this.scale.on('resize', rebuild);
    this.events.once('shutdown', () => {
      this.scale.off('resize', rebuild);
      this.teardown();
    });
    // handled navigation keys stop in `onNavigationKey`, so the arrows do not also shift the computer keyboard's octave
    if (this.keyboardNavigation) this.onWindowKey((e) => this.onNavigationKey(e));
    this.rebuild();
  }

  /**
   * Calls `handler` for every key pressed while the scene runs, until it shuts down. The listener is on the window, in the
   * capture phase, ahead of the computer-keyboard piano: the piano marks the keys it uses (the arrows, digits, letters) as
   * handled, so Phaser's own keyboard plugin would skip them, and it can also miss keys that come quickly.
   */
  protected onWindowKey(handler: (event: KeyboardEvent) => void): void {
    window.addEventListener('keydown', handler, true);
    this.events.once('shutdown', () => window.removeEventListener('keydown', handler, true));
  }

  /** What Esc does on a keyboard-navigable screen; screens that bind Esc themselves leave it alone. */
  protected back(): void {}

  /** The buttons the keyboard can reach; a screen with a modal on top returns only the modal's buttons, and an open menu only its choices. */
  protected focusables(): PixelButton[] {
    return this.menu?.buttons ?? this.buttons;
  }

  /** The band's top, in art rows of the main area (it starts under the main area), or null on a screen with no band. */
  protected get bandTop(): number | null {
    return this.screenFrame.band?.top ?? null;
  }

  /**
   * A layer over the whole screen, above the scene and its band, at the root's place and scale (a conversation drawn over a
   * scene, ft_1_22): the caller fills it and destroys it, at the latest when the screen is drawn again (`clear`).
   */
  protected overlayLayer(): Phaser.GameObjects.Container {
    return this.add.container(this.root.x, this.root.y).setScale(this.px.scale).setDepth(MENU_DEPTH);
  }

  /** Whether a drop-down menu is open: a screen with its own pointer handlers (the editor's staff) ignores the pointer meanwhile. */
  protected get menuOpen(): boolean {
    return this.menu !== null;
  }

  /**
   * Open a drop-down menu of `items` under the button `anchor`: a grid of equal cells, `columns` to a row, a `null`
   * item leaving its cell empty so the columns line up. Picking a choice closes the menu and then does it; a press anywhere
   * else (the button it opened from too) or Esc only closes it. One menu at a time; drawing the screen again closes it.
   * With `paper` the menu is no panel of keys: `paper` paints its sheet (so many layout cells, drawn on the fine grid) and
   * the choices are lines written on it (the main menu, ft_1_07).
   */
  protected openMenu(anchor: { rect: { x: number; y: number; width: number; height: number } }, items: readonly (MenuItem | null)[], options: { cell: { w: number; h: number }; columns: number; open?: 'below' | 'above'; paper?: (width: number, height: number) => Bitmap }): void {
    this.closeMenu();
    const above = this.screenFrame.top;
    const bounds = { x: 0, y: -above, w: this.px.width, h: above + this.mainRows + (this.screenFrame.band?.rows ?? 0) };
    const a = anchor.rect;
    const layout = dropMenuLayout({ anchor: { x: a.x, y: a.y, w: a.width, h: a.height }, cell: options.cell, count: items.length, columns: options.columns, gap: MENU_GAP, pad: MENU_PAD, bounds, ...(options.open ? { open: options.open } : {}) });
    const container = this.add.container(this.root.x, this.root.y).setScale(this.px.scale).setDepth(MENU_DEPTH);
    // the catcher under the panel takes every press outside the choices; it closes on release, like a button, so the press
    // that closes a menu never reaches the screen under it (the editor would write a note there)
    const catcher = this.add.zone(bounds.x, bounds.y, bounds.w, bounds.h).setOrigin(0).setInteractive();
    catcher.on('pointerup', () => this.closeMenu());
    const panel = options.paper
      ? new PixelImage(this, layout.panel.x, layout.panel.y, options.paper(layout.panel.w, layout.panel.h)).setScale(1 / ART_DETAIL)
      : new PixelImage(this, layout.panel.x, layout.panel.y, panelBitmap(layout.panel.w, layout.panel.h, 'panel'));
    container.add([catcher, panel]);
    const buttons: PixelButton[] = [];
    items.forEach((item, i) => {
      if (!item) return;
      const button = new PixelButton(this, container, {
        ...rectCentre(layout.cells[i]!), label: item.label, iconOnly: item.icon !== undefined,
        ...(item.icon ? { icon: item.icon } : {}), ...(item.fineIcon ? { fineIcon: true } : {}), ...(item.tooltip ? { tooltip: item.tooltip } : {}), ...(item.keepCase ? { keepCase: true } : {}),
        ...(item.disabled ? { disabled: true } : {}), ...(options.paper ? { look: 'ink' as const } : {}),
        ...(item.preview ? { onHover: item.preview } : {}),
        onClick: () => {
          this.closeMenu();
          item.onPick();
        },
      });
      if (item.active) button.setActive(true);
      if (item.shortcut) this.keyBadge(container, button, item.shortcut);
      buttons.push(button);
    });
    this.menu = { container, buttons, focusBefore: this.focusIndex, previews: items.flatMap((item) => (item?.preview ? [item.preview] : [])) };
    this.buttons.push(...buttons);
    // the keyboard starts on the choice in use
    if (this.keyboardNavigation) {
      this.focusIndex = Math.max(0, items.filter((item) => item !== null).findIndex((item) => item.active === true));
      this.paintFocus();
    }
  }

  /** Close the drop-down menu, if one is open; nothing is chosen. */
  protected closeMenu(): void {
    const menu = this.menu;
    if (!menu) return;
    this.menu = null;
    // a drag given up shows the value it started from again
    if (menu.slider?.dragging) {
      menu.slider.item.change(menu.slider.kept);
      menu.slider.item.cancel?.();
    }
    for (const preview of menu.previews ?? []) preview(false);
    this.buttons = this.buttons.filter((b) => !menu.buttons.includes(b));
    menu.buttons.forEach((b) => b.destroy());
    menu.container.destroy(true);
    if (this.keyboardNavigation) {
      this.focusIndex = menu.focusBefore;
      this.paintFocus();
    }
  }

  private lastFocusRect: { x: number; y: number; width: number; height: number } | null = null;

  /** A navigation key the screen takes itself before the focus moves (the book's Page Up and Page Down); true when taken. */
  protected screenKey?(e: KeyboardEvent): boolean;

  /** The focused button, while the focus ring is shown. */
  protected get focusedButton(): PixelButton | undefined {
    return this.focusShown ? this.focusables()[this.focusIndex] : undefined;
  }

  /** Hide the focus ring: the keys go back to the screen (a press on one of its own places, such as a song page's row). */
  protected hideFocus(): void {
    if (!this.focusShown) return;
    this.focusShown = false;
    this.paintFocus();
  }

  /** Put the focus ring on `button` (one of `focusables`), shown at once: the wheel moves the focus like the arrows. */
  protected focusOn(button: PixelButton | undefined): void {
    const index = button ? this.focusables().indexOf(button) : -1;
    if (index < 0) return;
    this.focusShown = true;
    this.focusIndex = index;
    this.paintFocus();
  }

  private onNavigationKey(e: KeyboardEvent): void {
    // a screen paused under an overlay (d070) takes no keys: they are the overlay's
    if (this.sys.isPaused()) return;
    // a key typed into a text field (a title) is the field's own, unless the field leaves the moving keys to the screen
    // (the name box, whose see-through field only takes letters: `data-screen-keys="move"`)
    const target = e.target as { tagName?: string; dataset?: Record<string, string | undefined> } | null;
    if ((target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') && target.dataset?.screenKeys !== 'move') return;
    const moves: Record<string, FocusMove> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
    if (!this.menuOpen && this.screenKey?.(e) === true) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    if (e.key === 'Escape') {
      if (this.menuOpen) this.closeMenu();
      else this.back();
      return;
    }
    const move = moves[e.key];
    const activate = (e.key === 'Enter' || e.key === ' ') && !e.repeat;
    if (!move && !activate) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const rects = () => this.focusables().map((b) => ({ ...b.rect, disabled: b.disabled }));
    // the first key only shows where the focus is, so it never presses or moves anything by surprise
    if (!this.focusShown) {
      this.focusShown = true;
      if (this.focusIndex < 0) this.focusIndex = initialFocus(rects());
      this.paintFocus();
      return;
    }
    if (move) {
      this.focusIndex = moveFocus(rects(), this.focusIndex, move);
      this.paintFocus();
    } else {
      this.focusables()[this.focusIndex]?.press();
    }
  }

  private paintFocus(): void {
    const all = this.focusables();
    this.lastFocusRect = all[this.focusIndex]?.rect ?? null;
    this.buttons.forEach((b) => b.setFocused(false));
    all.forEach((b, i) => b.setFocused(this.focusShown && i === this.focusIndex));
    // the door and the gear are clear while the keyboard is on them, as under the pointer
    const focused = this.focusShown ? all[this.focusIndex] : undefined;
    this.corners.forEach((c) => c.setAlpha(c === focused ? 1 : CORNER_FADED));
  }

  /** Make a button and keep it, so it is removed when the scene is drawn again. */
  protected button(options: PixelButtonOptions): PixelButton {
    const button = new PixelButton(this, this.root, options);
    this.buttons.push(button);
    return button;
  }

  /** The pager row under a card list (`cardGrid`): Previous, Next and the page label; `turn` gets the page to show. */
  protected pager(slice: PageSlice, turn: (page: number) => void): void {
    const { previous, next, labelY, centreX } = pagerBoxes(this.px.width, this.px.height);
    // written on a page (a book) the two are words in ink, not boards
    const look = this.inkWriting ? { look: 'ink' as const } : {};
    // in a book the gutter stays clear: Previous and the page number on the left page, Next on the right
    const book = this.inkWriting ? { previous: this.px.width * 0.19, label: this.px.width * 0.36, next: this.px.width * 0.75 } : null;
    const at = (box: Rect, x: number | undefined) => ({ ...rectCentre(box), ...(x === undefined ? {} : { x }) });
    this.button({ ...at(previous, book?.previous), label: t('menu.previous'), ...look, disabled: slice.page === 0, onClick: () => turn(slice.page - 1) });
    this.button({ ...at(next, book?.next), label: t('menu.next'), ...look, disabled: slice.page === slice.pages - 1, onClick: () => turn(slice.page + 1) });
    this.label(0, labelY, t('menu.page', { page: slice.page + 1, pages: slice.pages }), C.dim).centerAt(book?.label ?? centreX);
  }

  /** The top bar of the play screens and the editor (`playBars`): its panel across the screen; the toolbar's Back does `onBack` (d088). */
  protected topBar(onBack: () => void): void {
    this.root.add(new PixelImage(this, 0, 0, panelBitmap(Math.max(5, this.px.width), TOP_BAR, 'panel')));
    this.backWith(onBack);
  }

  /** What the toolbar's Back does on a screen without a top bar (the editor). */
  protected backWith(onBack: () => void): void {
    this.backAction = onBack;
  }

  /** Just before the toolbar's Settings button leaves for the settings screen: a screen with unsaved work keeps it here. */
  protected beforeSettings(): void {}

  /** The screen's own buttons on the toolbar (d088), left to right; none by default. */
  protected toolbarItems(): ToolbarItem[] {
    return [];
  }

  /**
   * The screen's actions in the band's grid (ft_1_20.AC2), in cell order; Back and Settings come in their own cells. Until a
   * screen is moved to the band its toolbar items are its actions, so every screen works in the band at once.
   */
  protected bandActions(): ToolbarItem[] {
    return this.toolbarItems();
  }

  /** The screen's items in the band's slots (ft_1_20 rule 2), in order; `active` draws one lit (a worn item that is on). None yet. */
  protected bandItems(): ToolbarItem[] {
    return [];
  }

  /** Whether the screen has somewhere to go back to: the toolbar's or the band's Back is shown. */
  private get hasBack(): boolean {
    return this.toolbarBack && (this.backAction !== null || this.back !== PixelScene.prototype.back);
  }

  /** What the Settings button does, on the toolbar or in the band. */
  private openSettingsScreen(): void {
    this.beforeSettings();
    this.scene.start('settings', { returnTo: { key: this.scene.key, data: this.sys.settings.data } });
  }

  /** The player's name, rank and XP as texts, measured but not yet placed, or null on a screen without a player. */
  private playerTexts(): { name: PixelText; rank: PixelText; xp: PixelText; fraction: number } | null {
    if (!this.toolbarPlayer) return null;
    const context = contextOf(this);
    const { level } = context.profiles.progress;
    const xp = level.xpForLevel === null ? t('menu.xpTop', { xp: context.profiles.progress.totalXp }) : t('menu.xp', { xp: level.xpIntoLevel, next: level.xpForLevel });
    return {
      name: this.label(0, 0, context.profiles.profile.name, C.gold),
      rank: this.label(0, 0, t('menu.level', { level: level.level }), C.white),
      xp: this.label(0, 0, xp, C.dim),
      fraction: level.xpForLevel === null ? 1 : level.xpIntoLevel / level.xpForLevel,
    };
  }

  /** Put the player's texts and XP bar where a layout says, `top` rows down; a name longer than its box is cut. */
  private placePlayer(player: NonNullable<ReturnType<PixelScene['playerTexts']>>, at: { name: Rect; rank: Rect; xpBar: Rect; xpText: Rect | null }, top: number): void {
    const name = contextOf(this).profiles.profile.name;
    if (player.name.width > at.name.w) player.name.setText(clipToWidth(name, at.name.w, (s) => measure(drawnText(s))));
    player.name.setPosition(at.name.x, top + at.name.y);
    player.rank.setPosition(at.rank.x, top + at.rank.y);
    this.root.add(new PixelBar(this, at.xpBar.x, top + at.xpBar.y, at.xpBar.w, at.xpBar.h, player.fraction));
    if (at.xpText) player.xp.setPosition(at.xpText.x, top + at.xpText.y);
    else player.xp.setVisible(false);
  }

  /** The keyboard switch (settings screen, d099): lit while the on-screen keyboard is shown, its keys dim while it is hidden. */
  private lightKeys(shown: boolean): void {
    const keys = this.toolbarButtons.keys;
    if (!keys) return;
    const enabled = contextOf(this).keyboardSwitch.enabled();
    keys.setDisabled(!enabled);
    keys.setLabel(enabled ? t('settings.keyboard') : t('settings.keyboardNeedsPiano'));
    keys.setActive(shown);
    keys.setIcon(shown ? ICONS.freePlay : recolor(ICONS.freePlay, { [C.white]: C.lock }));
  }

  /** Rows of screen pixels above the main area (the toolbar and the vine, none under the band alone): add it to a screen position made from art rows. */
  protected get mainTop(): number {
    return this.screenFrame.top * this.px.scale;
  }

  /**
   * Whether the screen has the frame without a toolbar (ft_1_20, d282): the door and the gear over the main area's top
   * corners, the strip at the foot when the screen pins actions; every screen but the teacher's, an overlay and the main menu.
   */
  protected get bandShown(): boolean {
    return this.cornerFramed;
  }

  /** Set in `rebuild`: the frame without a toolbar (`bandShown`). */
  private cornerFramed = false;

  /**
   * With the band and no toolbar: the strip along the main area's top that the door and the gear stand in (`rows` high), and
   * the room between them (`left` to `right`). A staff starts under it; Kiur and his bubble, or a page turner, may use the room.
   */
  protected get cornerStrip(): { rows: number; left: number; right: number } {
    const { back, settings } = frameCorners(this.px.width);
    // the piano's status and the backpack stand left of the gear, each one corner wide
    const extra = (this.cornerStatus() ? 1 : 0) + (this.backpackItems() ? 1 : 0);
    return { rows: Math.max(back.y + back.h, settings.y + settings.h) + 1, left: back.x + back.w + 2, right: settings.x - extra * (settings.w + BACKPACK_GAP) - 2 };
  }

  /** Where a screen's title starts: `margin`, or right of the door when the band puts the door in the top left corner (ft_1_20). */
  protected titleX(margin: number): number {
    return this.bandShown ? Math.max(margin, this.cornerStrip.left + 2) : margin;
  }

  /** Whether the toolbar is drawn, with the player's name, rank and XP on it (d088); not under the band alone (ft_1_20). */
  protected get toolbarShown(): boolean {
    return this.screenFrame.toolbar;
  }

  /** Art rows above the main area: the toolbar and the vine, or none with the band alone (ft_1_20). */
  protected get mainTopRows(): number {
    return this.screenFrame.top;
  }

  /** Whole art rows the main area has (a staff that must fit counts these, not the rounded-up `px.height`); with the band, every row above it. */
  protected get mainRows(): number {
    if (this.screenFrame.band || !this.screenFrame.toolbar) return this.screenFrame.height;
    return Math.floor(this.scale.height / this.px.scale) - FRAME_ROWS;
  }

  /**
   * The frame of every screen: the toolbar and the vine on top (d088) unless the band alone is drawn, and the action and
   * inventory band at the foot (ft_1_20, d115). Drawn after the screen, so a screen's buttons keep their order.
   */
  private drawFrame(): void {
    const band = this.screenFrame.band;
    if (this.screenFrame.toolbar) this.drawToolbar(band ? [] : this.toolbarItems());
    if (band) this.drawFootStrip(band.top);
  }

  /**
   * The toolbar (d088): Back, the player's name, rank and XP, the screen's own `items`, settings and the keyboard switch, and
   * the vine under it. Under the band it keeps only the global items: the screen's own go in the band's grid.
   */
  private drawToolbar(items: ToolbarItem[]): void {
    const context = contextOf(this);
    const width = this.px.width;
    const top = -FRAME_ROWS;
    // the beam the toolbar is on, its dark underside where the vine was
    this.fineImage(0, top * ART_DETAIL, paintedOnce(`beam:${width}`, () => paintBeam(width * ART_DETAIL, FRAME_ROWS * ART_DETAIL, VINE_ROWS * ART_DETAIL)), DESK_PALETTE);
    const itemWidth = (item: ToolbarItem) => (item.iconOnly && item.icon ? TOOLBAR_ICON_WIDTH : undefined) ?? item.width ?? Math.max(TOOLBAR_ICON_WIDTH, measure(drawnText(item.label)) + 10 + (item.icon ? item.icon.width + 3 : 0));
    const isSettings = this.scene.key === 'settings';
    const player = this.playerTexts();
    const layout = toolbarLayout({
      width, back: this.hasBack, settings: !isSettings && this.toolbarPlayer, keys: this.toolbarKeys,
      player: player && { nameWidth: player.name.width, rankWidth: player.rank.width, xpTextWidth: player.xp.width },
      items: items.map((item) => ({ width: itemWidth(item), iconWidth: item.icon ? TOOLBAR_ICON_WIDTH : itemWidth(item) })),
    });
    const at = (r: Rect) => ({ ...rectCentre(r), y: top + r.y + r.h / 2 });
    if (player && layout.name && layout.rank && layout.xpBar) this.placePlayer(player, { name: layout.name, rank: layout.rank, xpBar: layout.xpBar, xpText: layout.xpText }, top);
    this.toolbarButtons = {
      back: layout.back ? this.button({ ...at(layout.back), label: t('ui.back'), icon: ICONS.quit, iconOnly: true, onClick: () => (this.backAction ?? (() => this.back()))() }) : null,
      items: items.map((item, i) => {
        const placed = layout.items[i]!;
        const button = this.button({
          ...at(placed.rect), label: item.label, ...(item.icon ? { icon: item.icon } : {}), iconOnly: (placed.iconOnly || item.iconOnly === true) && item.icon !== undefined,
          ...(item.tooltip ? { tooltip: item.tooltip } : {}), ...(item.disabled ? { disabled: true } : {}), ...(item.keepCase ? { keepCase: true } : {}), onClick: item.onClick,
        });
        if (item.active) button.setActive(true);
        if (item.shortcut) this.markKey(button, item.shortcut);
        item.ref?.(button);
        return button;
      }),
      settings: layout.settings ? this.button({ ...at(layout.settings), label: t('menu.settingsButton'), icon: ICONS.settings, iconOnly: true, onClick: () => this.openSettingsScreen() }) : null,
      keys: layout.keys ? this.button({ ...at(layout.keys), label: t('settings.keyboard'), icon: ICONS.freePlay, iconOnly: true, disabled: !context.keyboardSwitch.enabled(), onClick: () => context.keyboardSwitch.toggle() }) : null,
    };
    this.lightKeys(context.keyboardSwitch.shown());
  }

  /**
   * The actions pinned in the strip along the foot (ft_1_20, d282), left to right in their order; the one marked `main`
   * stands at the right end. By default every action and item of the screen: a screen whose actions fit pins them all and has
   * no bubble.
   */
  protected stripActions(): ToolbarItem[] {
    return [...this.bandActions(), ...this.bandItems()];
  }

  /**
   * The bubble's options for a right click at `at` (art pixels; null when More opened it), slot by slot (slot 0 straight
   * up, then clockwise; a `null` leaves its slot empty), or null for no bubble there (ft_1_20, d282). None by default.
   */
  /**
   * Whether a press at `at` would open a bubble, asked at the start of a press before the bubble opens (a long press may
   * still turn into a drag): it changes nothing. By default, whether `bubbleOptions` gives any; a screen whose
   * `bubbleOptions` selects what is under the pointer answers without it.
   */
  protected hasBubbleAt(at: { x: number; y: number }): boolean {
    return this.bubbleOptions(at) !== null;
  }

  // the base screen has no bubble wherever it is opened; a screen overrides this and reads `at`
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected bubbleOptions(at: { x: number; y: number } | null): (ToolbarItem | null)[] | null {
    return null;
  }

  /** The items the student keeps, in the backpack in the top right corner (ft_1_20, d282), or null on a screen without it. */
  protected backpackItems(): ToolbarItem[] | null {
    return null;
  }

  /** A status picture left of the gear (the piano on the practice screen): lit while all is well, what it means in its tooltip; none by default. */
  protected cornerStatus(): { label: string; icon: Bitmap; lit: boolean } | null {
    return null;
  }

  /** The strip's rows on this screen (none without a strip). */
  protected get stripHeight(): number {
    return this.screenFrame.band?.rows ?? 0;
  }

  /** Whether the screen has a bubble (More is then drawn at the end of the strip's left group). */
  private get hasBubble(): boolean {
    return this.bubbleOptions(null) !== null;
  }

  /** The strip's rows: none on a screen with nothing pinned and no bubble (ft_1_20.AC21). */
  private stripRows(): number {
    try {
      return pinRows(this.stripActions().length + (this.hasBubble ? 1 : 0));
    } catch {
      // a screen whose actions need what its `draw` sets up has a strip of one row
      return pinRows(1);
    }
  }

  /** How many cells of the strip an item takes: one for a picture, as many as its whole word needs (ft_1_20.AC18). */
  private stripSpan(item: ToolbarItem): number {
    return item.icon ? 1 : cellSpan(measure(drawnText(item.label)) + CELL_PAD + 2, STRIP_CELL_WIDTH);
  }

  /** The door and the gear over the top corners (rule 3), faded until the pointer or the focus is on them, and the backpack. */
  private drawCorners(): void {
    const corners = frameCorners(this.px.width);
    // over the staff too: a screen whose staff fills the main area (practice, the piece maker) would hide them
    const layer = this.overStaff();
    // over a card they stand on a plate of the band's wood, solid like the band's buttons
    const solid = (this.sys.game.device.input.touch && !this.sys.game.device.os.desktop) || this.cornersOnCard;
    // the plate reaches a cell past the button's box above and below, so its inner field, inside the two-cell bevel, holds the 14-cell gear
    const plate = (r: Rect) => {
      if (this.cornersOnCard) layer.add(new PixelImage(this, r.x, r.y - CORNER_PLATE_GROW, stripCell(r.w, r.h + 2 * CORNER_PLATE_GROW)));
    };
    const corner = (r: Rect, label: string, icon: Bitmap, onClick: () => void): PixelButton => {
      plate(r);
      // the picture alone, no button behind it; never faded on a touch screen, which has no hover to show it
      const button: PixelButton = this.buttonOn(layer, { ...rectCentre(r), label, picture: icon, onHover: (over) => button.setAlpha(over || solid ? 1 : CORNER_FADED), onClick });
      button.setAlpha(solid ? 1 : CORNER_FADED);
      if (!solid) this.corners.push(button);
      return button;
    };
    const back = this.hasBack ? corner(corners.back, t('ui.back'), ICONS.quit, () => (this.backAction ?? (() => this.back()))()) : null;
    const showSettings = this.scene.key !== 'settings' && this.toolbarPlayer;
    const settings = showSettings ? corner(corners.settings, t('menu.settingsButton'), ICONS.settings, () => this.openSettingsScreen()) : null;
    let left = corners.settings.x;
    const status = this.cornerStatus();
    if (status) {
      left -= corners.settings.w + BACKPACK_GAP;
      const r = { ...corners.settings, x: left };
      plate(r);
      // a picture, not a button: it does nothing when pressed, its tooltip says what it means
      const shown = this.buttonOn(layer, { ...rectCentre(r), label: status.label, tooltip: status.label, picture: status.lit ? status.icon : recolor(status.icon, { [C.white]: C.lock }), onClick: () => undefined });
      shown.setAlpha(status.lit ? 1 : CORNER_FADED);
    }
    const kept = this.backpackItems();
    if (kept) {
      left -= corners.settings.w + BACKPACK_GAP;
      const r = { ...corners.settings, x: left };
      plate(r);
      // the items are read at the press, so one won while the screen is open is there
      const bag: PixelButton = this.buttonOn(layer, {
        ...rectCentre(r), label: t('band.backpack'), picture: BACKPACK,
        onClick: () => {
          const items = this.backpackItems() ?? [];
          const choices: MenuItem[] = items.length
            ? items.map((item) => ({ label: item.label, ...(item.icon ? { icon: item.icon } : {}), ...(item.fineIcon ? { fineIcon: true } : {}), ...(item.tooltip ? { tooltip: item.tooltip } : {}), onPick: item.onClick }))
            : [{ label: t('band.backpackEmpty'), disabled: true, onPick: () => undefined }];
          this.openMenu(bag, choices, { cell: items.length ? { w: 30, h: 30 } : { w: 120, h: 15 }, columns: Math.min(4, Math.max(1, items.length)), open: 'below' });
        },
      });
    }
    this.toolbarButtons = { ...this.toolbarButtons, back, settings };
  }

  /**
   * The strip along the foot (ft_1_20, d282), `top` rows below the main area's top: the pinned actions left to right, More
   * (when the screen has a bubble) after them, the worn options that are on as small lit pictures after More, and the main
   * action at the right end. A word is never cut short: it takes the cells it needs, and what does not fit goes into the bubble.
   */
  private drawFootStrip(top: number): void {
    const context = contextOf(this);
    const width = this.px.width;
    this.stripOverflow = [];
    if (!this.screenFrame.toolbar) this.drawCorners();
    const rows = this.screenFrame.band?.rows ?? 0;
    this.stripFree = null;
    if (rows === 0) {
      this.toolbarButtons = { ...this.toolbarButtons, keys: null, items: [] };
      return;
    }
    // the strip's ground: one warm board with a dark line along its top and a darker one along its foot
    this.root.add(new PixelImage(this, 0, top, stripBitmap(Math.max(5, width))));
    const actions = this.stripActions();
    const keysAction = !this.screenFrame.toolbar && this.toolbarKeys;
    if (keysAction) actions.push({ label: t('settings.keyboard'), icon: ICONS.freePlay, onClick: () => context.keyboardSwitch.toggle() });
    let bubble = this.hasBubble;
    const moreItem: ToolbarItem = { label: t('band.more'), icon: TOOL_ICONS.more, onClick: () => this.openBubble(null) };
    const plan = (withMore: boolean) => {
      const list = withMore ? [...actions.filter((a) => !a.main), moreItem, ...actions.filter((a) => a.main)] : actions;
      const main = list.findIndex((a) => a.main);
      return { list, flow: pinFlow({ spans: list.map((a) => this.stripSpan(a)), width, ...(main >= 0 ? { main } : {}) }) };
    };
    let { list, flow } = plan(bubble);
    if (!bubble && flow.toBubble.length > 0) {
      bubble = true;
      ({ list, flow } = plan(true));
    }
    this.stripOverflow = flow.toBubble.map((i) => list[i]!).filter((a) => a !== moreItem);
    const box = (r: Rect) => ({ ...rectCentre(r), y: top + r.y + r.h / 2 });
    const made = new Map<ToolbarItem, PixelButton>();
    const shown: { rect: Rect; item: ToolbarItem }[] = [];
    let moreRight = 0;
    for (const placed of flow.placed) {
      const item = list[placed.action]!;
      const button = this.bandButton(item, box(placed.rect), 'bandCell', placed.rect.w - CELL_PAD);
      made.set(item, button);
      shown.push({ rect: { ...placed.rect, y: top + placed.rect.y }, item });
      if (item === moreItem) {
        moreRight = placed.rect.x + placed.rect.w;
        this.pulseMore(button);
      }
    }
    const mainLeft = Math.min(width, ...flow.placed.filter((p) => list[p.action]!.main).map((p) => p.rect.x));
    let freeLeft = Math.max(0, ...flow.placed.filter((p) => !list[p.action]!.main).map((p) => p.rect.x + p.rect.w));
    // the worn options that are on, beside More: a press turns one off (ft_1_20, d282)
    if (bubble && moreRight > 0) {
      let x = moreRight + 3;
      for (const worn of (this.bubbleOptions(null) ?? []).filter((o): o is ToolbarItem => o !== null && o.worn === true && o.active === true && o.icon !== undefined)) {
        // a gold chip with the option's picture in ink, as wide as the picture needs
        const chip = wornChip(worn.icon!);
        if (x + chip.width > mainLeft - 2) break;
        this.button({ x: x + chip.width / 2, y: top + 1 + chip.height / 2, width: chip.width, height: chip.height, label: worn.label, icon: worn.icon!, iconOnly: true, look: 'bandCell', worn: true, ...(worn.tooltip ? { tooltip: worn.tooltip } : {}), onClick: worn.onClick });
        x += chip.width + 1;
      }
      freeLeft = Math.max(freeLeft, x);
    }
    this.stripFree = { left: freeLeft, right: mainLeft, top, rows };
    const items = actions.map((a) => made.get(a)).filter((b): b is PixelButton => b !== undefined);
    this.toolbarButtons = {
      ...this.toolbarButtons,
      keys: keysAction ? made.get(actions[actions.length - 1]!) ?? null : null,
      items: keysAction ? items.filter((b) => b !== made.get(actions[actions.length - 1]!)) : items,
    };
    if (keysAction) this.toolbarButtons.keys?.setDisabled(!context.keyboardSwitch.enabled());
    if (!this.screenFrame.toolbar) this.lightKeys(context.keyboardSwitch.shown());
    this.inventoryBand = { area: { x: 0, y: top, w: width, h: rows }, slots: shown };
  }

  /**
   * More pulses on a screen's first three visits (ft_1_20, d282), so a student finds what is behind it; once a visit, kept
   * per screen in this browser. AX-3 provisional: three visits.
   */
  private pulseMore(button: PixelButton): void {
    // once a visit: a screen drawn again (a tempo change, a hint) does not pulse again
    if (this.moreVisitCounted) return;
    // a self-playing demo keeps the browser's storage as it was (ft_Y_09.AC4)
    if (contextOf(this).flags.autoplay) return;
    const key = `pianor.morePulse.${this.scene.key}`;
    let seen = MORE_PULSE_VISITS;
    try {
      seen = Number(window.localStorage.getItem(key) ?? '0') || 0;
      window.localStorage.setItem(key, String(seen + 1));
    } catch {
      // storage is blocked: no pulse
    }
    this.moreVisitCounted = true;
    if (seen >= MORE_PULSE_VISITS || !motionAllowed()) return;
    this.tweens.add({ targets: button, alpha: 0.45, duration: 450, yoyo: true, repeat: 3, ease: 'Sine.easeInOut' });
  }

  /** Whether this visit was counted for More's pulse. */
  private moreVisitCounted = false;

  /** Opens the bubble at the right click's `p`, or starts a long press on a touch screen (ft_1_20, d282). */
  private bubblePointerDown(p: Phaser.Input.Pointer): void {
    if (this.sys.isPaused() || !this.screenFrame?.band) return;
    if (this.isBubblePress(p)) {
      if (this.menuOpen) return;
      const at = this.artPoint(p);
      if (this.hasBubbleAt(at) || this.stripOverflow.length > 0) this.openBubble(at);
      return;
    }
    if (!p.wasTouch || this.menuOpen || this.pointerOnButton(p)) return;
    this.cancelLongPress();
    const at = this.artPoint(p);
    if (!this.hasBubbleAt(at)) return;
    const timer = this.time.delayedCall(LONG_PRESS_MS, () => {
      this.cancelLongPress();
      this.bubbleFreshTouch = true;
      this.openBubble(at);
    });
    // a ring fills round the finger from a moment in, so the student sees that holding on opens something
    const ring = this.add.graphics().setDepth(MENU_DEPTH);
    const radius = 10 * this.px.scale;
    const started = this.time.now;
    ring.on('destroy', () => this.events.off('update', fill));
    const fill = () => {
      const done = (this.time.now - started - LONG_PRESS_RING_FROM_MS) / (LONG_PRESS_MS - LONG_PRESS_RING_FROM_MS);
      ring.clear();
      if (done <= 0) return;
      ring.lineStyle(Math.max(2, this.px.scale), PALETTE[C.goldLight] ?? 0xffd36b, 0.9);
      ring.beginPath().arc(p.x, p.y, radius, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * Math.min(1, done)).strokePath();
    };
    this.events.on('update', fill);
    this.longPress = { x: p.x, y: p.y, timer, ring };
  }

  /**
   * The two-finger tap (ft_1_20.AC25), read from the canvas's own touch events (the game follows one finger): the second of
   * two fingers that land together opens the bubble at once midway between them, and the first finger's lift picks
   * nothing; two fingers that then slide apart are a pinch, which closes it again.
   */
  /** Whether the touch now ending was part of two or more fingers at once: its lift is no tap. */
  protected get severalFingers(): boolean {
    return this.manyFingers;
  }

  private listenForTwoFingers(): void {
    const canvas = this.game.canvas;
    // fingers are followed in CSS pixels of the page, the same distance under the finger on any screen
    const at = (touch: Touch) => ({ x: touch.clientX, y: touch.clientY });
    const onCanvas = (p: { x: number; y: number }) => {
      const rect = canvas.getBoundingClientRect();
      return { x: ((p.x - rect.left) / rect.width) * canvas.width, y: ((p.y - rect.top) / rect.height) * canvas.height };
    };
    // a resting palm or the side of a hand is no finger
    const PALM = 40;
    const start = (e: TouchEvent) => {
      const now = this.time.now;
      // a finger alone on the screen starts a new gesture: what the last one left behind is gone
      if (e.touches.length === 1) {
        this.manyFingers = false;
        this.bubbleTouchLifts = 0;
      } else if (e.touches.length > 1) this.manyFingers = true;
      for (const touch of Array.from(e.changedTouches)) this.touches.set(touch.identifier, { ...at(touch), t: now, palm: Math.max(touch.radiusX, touch.radiusY) > PALM });
      if (e.touches.length !== 2 || this.touches.size !== 2 || this.sys.isPaused() || !this.screenFrame?.band || this.menuOpen) return;
      const [one, two] = Array.from(e.touches);
      const first = this.touches.get(one!.identifier), second = this.touches.get(two!.identifier);
      if (!first || !second || first.palm || second.palm) return;
      const [early, late, earlyNow] = first.t <= second.t ? [first, second, at(one!)] : [second, first, at(two!)];
      const middle = twoFingerTap({ ...early, now: earlyNow }, late);
      if (!middle) return;
      const art = this.artPoint(onCanvas(middle));
      if (!this.hasBubbleAt(art) && this.stripOverflow.length === 0) return;
      this.cancelLongPress();
      this.twoFinger = { ids: [one!.identifier, two!.identifier], start: [first, second].map((f) => ({ x: f.x, y: f.y })) };
      // both lifts pick nothing, whichever frames they come on (the count is cleared once every finger is up)
      this.bubbleTouchLifts = 2;
      this.openBubble(art);
    };
    const move = (e: TouchEvent) => {
      const two = this.twoFinger;
      if (!two || !this.bubbleIsOpen) return;
      const now = two.ids.map((id) => Array.from(e.touches).find((t) => t.identifier === id));
      if (now.every((t): t is Touch => t !== undefined) && twoFingersSlid(two.start, now.map(at))) {
        this.twoFinger = null;
        this.closeMenu();
      }
    };
    const end = (e: TouchEvent) => {
      for (const touch of Array.from(e.changedTouches)) this.touches.delete(touch.identifier);
      // the lifts still to be swallowed stay counted until the next finger or mouse press starts afresh, whichever order
      // the game and this listener see the last lift in
      if (e.touches.length === 0) {
        this.touches.clear();
        this.twoFinger = null;
      }
    };
    const options = { passive: true };
    canvas.addEventListener('touchstart', start, options);
    canvas.addEventListener('touchmove', move, options);
    canvas.addEventListener('touchend', end, options);
    canvas.addEventListener('touchcancel', end, options);
    this.touches.clear();
    this.twoFinger = null;
    this.bubbleTouchLifts = 0;
    this.manyFingers = false;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!p.wasTouch) this.bubbleTouchLifts = 0;
    });
    this.events.once('shutdown', () => {
      canvas.removeEventListener('touchstart', start);
      canvas.removeEventListener('touchmove', move);
      canvas.removeEventListener('touchend', end);
      canvas.removeEventListener('touchcancel', end);
    });
  }

  /** Whether a press is the right button's, which opens the bubble: a screen's own press on its staff leaves it alone (ft_1_20, d282). */
  protected isBubblePress(p: Phaser.Input.Pointer): boolean {
    return p.rightButtonDown() || (p.event as MouseEvent | undefined)?.button === 2;
  }

  private cancelLongPress(): void {
    this.longPress?.timer.remove(false);
    this.longPress?.ring.destroy();
    this.longPress = null;
  }

  /** Esc closes an open menu or bubble before the screen sees it; the context-menu key and Shift + F10 open the bubble at the focus. */
  /** With a slider open, left and right move its knob a step and keep the value (ft_1_20.AC26); true when taken. */
  private sliderKey(e: KeyboardEvent): boolean {
    const slider = this.menu?.slider;
    if (!slider || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return false;
    e.preventDefault();
    e.stopImmediatePropagation();
    const { item } = slider;
    slider.set(Math.min(item.max, Math.max(item.min, slider.value + (e.key === 'ArrowRight' ? item.step : -item.step))), true);
    return true;
  }

  private bubbleKey(e: KeyboardEvent): void {
    if (this.sys.isPaused() || !this.scene.isActive()) return;
    if (e.key === 'Escape' && this.menuOpen) {
      e.preventDefault();
      e.stopImmediatePropagation();
      this.closeMenu();
      return;
    }
    if (this.sliderKey(e)) return;
    // in the bubble the arrows walk its options round the ring: right and down clockwise, left and up back (ft_1_20, d282)
    const ring = this.menu?.ring?.filter((b) => !b.disabled) ?? [];
    const walk = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    // Enter or Space picks the focused option before the screen under the bubble hears the key
    if (this.bubbleIsOpen && (e.key === 'Enter' || e.key === ' ') && this.focusedButton) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (!e.repeat) this.focusedButton.press();
      return;
    }
    if (walk !== undefined && ring.length > 0) {
      e.preventDefault();
      e.stopImmediatePropagation();
      const at = this.focusedButton ? ring.indexOf(this.focusedButton) : -1;
      this.focusOn(ring[at < 0 ? 0 : (at + walk + ring.length) % ring.length]);
      return;
    }
    if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) {
      if (!this.screenFrame?.band || this.menuOpen || (!this.hasBubble && this.stripOverflow.length === 0)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const focused = this.focusedButton?.rect;
      this.openBubble(focused ? { x: focused.x + focused.width / 2, y: focused.y + focused.height / 2 } : null, { keyboard: true });
    }
  }

  /** Whether the bubble is open (an end-to-end test or a screen that takes the piano's keys closes it, ft_1_20.AC22). */
  get bubbleIsOpen(): boolean {
    return this.menu?.bubble === true;
  }

  /**
   * Opens the bubble (ft_1_20, d282) round `at` (art pixels; null: over More, from the strip) with the options for what is
   * there, each in its fixed slot; `open` shows that slot's choices in a row beside the ring. A pick does it and closes the
   * bubble; a worn option switches and opens the bubble again where it was; More in the last slot turns to the next options.
   */
  openBubble(at: { x: number; y: number } | null, options: { open?: number; keyboard?: boolean; page?: number } = {}): void {
    const target = at;
    const listed = [...(this.bubbleOptions(target) ?? [])];
    // the pinned actions the strip had no room for take the empty slots
    for (const extra of this.stripOverflow) {
      const free = listed.findIndex((o, i) => o === null && i < BUBBLE_SLOTS);
      if (free >= 0) listed[free] = extra;
      else listed.push(extra);
    }
    if (listed.every((o) => o === null)) return;
    this.closeMenu();
    if (options.page !== undefined) this.bubblePageNo = options.page;
    const paging = bubblePage({ options: listed.length, page: this.bubblePageNo });
    this.bubblePageNo = paging.page;
    const strip = this.screenFrame.band;
    // never under the top strip between the door and the gear (the piece maker's title is a text field over the canvas)
    const top = this.screenFrame.toolbar ? 0 : this.cornerStrip.rows;
    const whole = { x: 0, y: 0, w: this.px.width, h: this.mainRows + (strip?.rows ?? 0) };
    const bounds = { ...whole, y: top, h: whole.h - top };
    const more = this.inventoryBand?.slots.find((s) => s.item.icon === TOOL_ICONS.more)?.rect;
    // from More the bubble stands on the strip over More, never over the strip: the pointer goes straight up to it
    if (at === null && strip) bounds.h = this.mainRows - top;
    const centre = at ?? (more ? { x: more.x + more.w / 2, y: more.y } : { x: bounds.w / 2, y: bounds.y + bounds.h / 2 });
    const open = options.open !== undefined ? listed[paging.slots[options.open] as number] : undefined;
    const choices = ringChoices(open);
    const layout = bubbleLayout({ at: centre, options: BUBBLE_SLOTS, screen: bounds, ...(open && options.open !== undefined ? { open: { option: options.open, choices: open.slider ? SLIDER_CELLS : choices.length } } : {}) });
    const container = this.add.container(this.root.x, this.root.y).setScale(this.px.scale).setDepth(MENU_DEPTH);
    // the catcher takes every press outside the bubble and closes it on release, so the press never reaches the screen
    // under it; the lift of the long press that opened it is not such a press
    const catcher = this.add.zone(whole.x, whole.y, whole.w, whole.h).setOrigin(0).setInteractive();
    // a press inside the ring but between the options picks the option in that direction (a slice of the ring each), so a
    // quick move toward an option is enough; outside the ring it closes the bubble
    const sectorPick: ((() => void) | null)[] = [];
    const held: { slider?: OpenSlider | undefined } = {};
    catcher.on('pointerup', (p: Phaser.Input.Pointer) => {
      const slider = held.slider;
      if (slider?.dragging) {
        slider.dragging = false;
        slider.set(slider.value, true);
        return;
      }
      // a press that just misses the open slider's track leaves the bubble open
      if (slider) {
        const a = this.artPoint(p);
        const d = Math.hypot(a.x - slider.arc.centre.x, a.y - slider.arc.centre.y);
        if (d > layout.area.w / 2 && d <= slider.arc.radius + CHOICE_SIZE) return;
      }
      if (this.bubbleFreshTouch) {
        this.bubbleFreshTouch = false;
        return;
      }
      // the lifts of the two fingers that opened the bubble
      if (this.bubbleTouchLifts > 0) {
        this.bubbleTouchLifts -= 1;
        return;
      }
      const a = this.artPoint(p);
      const dx = a.x - layout.centre.x, dy = a.y - layout.centre.y;
      const d = Math.hypot(dx, dy);
      if (d > layout.close.w / 2 + 1 && d <= layout.area.w / 2) {
        const turn = (Math.atan2(dy, dx) + Math.PI / 2 + 2 * Math.PI) % (2 * Math.PI);
        const pick = sectorPick[Math.round(turn / ((2 * Math.PI) / BUBBLE_SLOTS)) % BUBBLE_SLOTS];
        if (pick) {
          pick();
          return;
        }
      }
      this.closeMenu();
    });
    // nothing behind the ring: the staff reads between the plates, and faintly through them (ft_1_20 look)
    container.add(catcher);
    // an option's choices lie in one sausage curved along the outer ring, under their patches and pictures
    if (layout.choices.length > 0) {
      const sausage = choicesSausage(layout.centre, layout.choices);
      container.add(new PixelImage(this, sausage.x, sausage.y, sausage.picture).setAlpha(BUBBLE_ALPHA));
    }
    const buttons: PixelButton[] = [];
    // the options in slot order, for the arrows
    const ring: PixelButton[] = [];
    const make = (r: Rect, item: ToolbarItem, onClick: () => void, onHover?: (over: boolean) => void, look: 'bubble' | 'bubbleClose' | 'bubbleChoice' = 'bubble'): PixelButton => {
      const button = new PixelButton(this, container, {
        ...(onHover ? { onHover } : {}),
        ...rectCentre(r), label: item.label, labelWidth: r.w - CELL_PAD, look,
        // a music sign on its scrap of parchment is too big for a round option: the sign alone, in the option's colour
        ...(item.icon ? { icon: item.fineIcon ? signOnly(item.icon, BUBBLE_SIGN, BUBBLE_SIGN) : item.icon, iconOnly: true, ...(item.fineIcon ? { fineIcon: true } : {}) } : {}),
        tooltip: item.tooltip ?? item.label, ...(item.disabled ? { disabled: true } : {}), ...(item.keepCase ? { keepCase: true } : {}),
        // the lift of a finger that opened the bubble by a two-finger tap picks nothing, even over an option
        onClick: () => {
          if (this.bubbleTouchLifts > 0) {
            this.bubbleTouchLifts -= 1;
            return;
          }
          onClick();
        },
      });
      if (item.active) button.setActive(true);
      if (item.armed) button.setArmed(true);
      // opened from the keyboard, the bubble shows each option's key in its corner; for the mouse the key is in the tooltip
      if (item.shortcut && (options.keyboard || this.shortcutsShown)) this.keyBadge(container, button, item.shortcut);
      buttons.push(button);
      return button;
    };
    paging.slots.forEach((slot, i) => {
      const r = layout.options[i]!;
      if (slot === 'more') {
        const turn = () => this.openBubble(at, { page: this.bubblePageNo + 1 });
        ring.push(make(r, { label: t('band.more'), icon: TOOL_ICONS.more, onClick: () => undefined }, turn));
        sectorPick[i] = turn;
        return;
      }
      const item = slot === null ? null : listed[slot];
      if (!item) return;
      const pick = () => {
        if (item.menu || item.slider) {
          this.openBubble(at, options.open === i ? {} : { open: i });
          return;
        }
        this.closeMenu();
        item.onClick();
        // a worn option leaves the bubble open, so several can be set in a row
        if (item.worn) this.time.delayedCall(0, () => this.openBubble(at));
      };
      ring.push(make(r, item, pick, item.preview));
      if (!item.disabled) sectorPick[i] = pick;
    });
    held.slider = this.mountSlider(container, catcher, layout, open?.slider);
    choices.forEach((choice, j) => {
      const r = layout.choices[j];
      if (!choice || !r) return;
      const button = make(r, { label: choice.label, ...(choice.icon ? { icon: choice.icon } : {}), ...(choice.fineIcon ? { fineIcon: true } : {}), ...(choice.tooltip ? { tooltip: choice.tooltip } : {}), ...(choice.disabled ? { disabled: true } : {}), ...(choice.keepCase ? { keepCase: true } : {}), ...(choice.shortcut ? { shortcut: choice.shortcut } : {}), onClick: () => undefined }, () => {
        this.closeMenu();
        choice.onPick();
      }, choice.preview, 'bubbleChoice');
      if (choice.active) button.setActive(true);
    });
    make(layout.close, { label: t('band.close'), icon: TOOL_ICONS.close, onClick: () => undefined }, () => this.closeMenu(), undefined, 'bubbleClose');
    const optionPreviews = paging.slots.flatMap((slot) => (typeof slot === 'number' && listed[slot]?.preview ? [listed[slot].preview] : []));
    this.menu = { container, buttons, focusBefore: this.focusIndex, bubble: true, ring, previews: [...optionPreviews, ...choices.flatMap((choice) => (choice?.preview ? [choice.preview] : []))], ...(held.slider ? { slider: held.slider } : {}) };
    this.buttons.push(...buttons);
    if (options.keyboard || this.keyboardNavigation) this.focusOn(ring.find((b) => !b.disabled) ?? buttons[0]);
  }

  /**
   * An open option's slider (ft_1_20.AC26), drawn on its sausage: the knob follows a press and a drag on its track (the
   * catcher hears them), and the value let go of is kept; none for an option without one.
   */
  private mountSlider(container: Phaser.GameObjects.Container, catcher: Phaser.GameObjects.Zone, layout: BubbleLayout, item: BubbleSlider | undefined): OpenSlider | undefined {
    const arc = item ? sliderArc(layout) : null;
    if (!item || !arc) return undefined;
    const slider = this.drawSlider(container, arc, item);
    const onTrack = (a: { x: number; y: number }) => {
      const k = sliderPoint(arc, sliderFraction(arc, a));
      return Math.hypot(a.x - k.x, a.y - k.y) <= CHOICE_SIZE / 2 + 3;
    };
    catcher.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const a = this.artPoint(p);
      if (p.rightButtonDown() || !onTrack(a)) return;
      slider.dragging = true;
      slider.set(sliderStep(sliderFraction(arc, a), item), false);
    });
    catcher.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (slider.dragging) slider.set(sliderStep(sliderFraction(arc, this.artPoint(p)), item), false);
    });
    return slider;
  }

  /**
   * The slider (ft_1_20.AC26) on its sausage: a row of dots along the track, gold up to the knob and faint past it, and the
   * gold-rimmed patch as the knob; moving it shows each value (`change`) and keeps one (`commit`).
   */
  private drawSlider(container: Phaser.GameObjects.Container, arc: SliderArc, item: BubbleSlider): OpenSlider {
    const track = this.add.graphics();
    const knob = new PixelImage(this, 0, 0, choicePatch('on'));
    container.add([track, knob]);
    const span = Math.abs(arc.to - arc.from) * arc.radius;
    const range = item.max - item.min;
    const state: OpenSlider = {
      item, arc, value: item.value, kept: item.value, dragging: false,
      set: (value, keep) => {
        state.value = value;
        const f = range > 0 ? (value - item.min) / range : 0;
        track.clear();
        for (let d = 0; d <= span; d += 2) {
          const p = sliderPoint(arc, d / span);
          track.fillStyle(PALETTE[d / span <= f ? C.goldLight : C.dim] ?? 0xffffff, 1).fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
        }
        const k = sliderPoint(arc, f);
        knob.setPosition(Math.round(k.x - CHOICE_SIZE / 2), Math.round(k.y - CHOICE_SIZE / 2));
        item.change(value);
        if (keep) {
          state.kept = value;
          item.commit(value);
        }
      },
    };
    state.set(item.value, false);
    return state;
  }

  /**
   * One action cell or item slot of the band: its picture (pictures, not words) with its word in a tooltip
   * bubble, or its word when it has no picture yet (cut short when it does not fit `room`, the whole word in the tooltip).
   * An opening item with a `menu` opens its choices from the button.
   */
  private bandButton(item: ToolbarItem, at: { x: number; y: number; width: number; height: number }, look: 'bandCell' | 'bandSlot', room: number): PixelButton {
    // a word is never cut short (ft_1_20.AC18): the strip gives it the cells it needs
    const label = item.label;
    const tooltip = item.tooltip;
    const menu = item.menu;
    const button: PixelButton = this.button({
      ...at, label, labelWidth: room, look, ...(item.icon ? { icon: item.fineIcon && look === 'bandCell' ? signOnly(item.icon, STRIP_SIGN, STRIP_SIGN) : item.icon, iconOnly: true, ...(item.fineIcon ? { fineIcon: true } : {}) } : {}), ...(tooltip ? { tooltip } : {}),
      ...(item.disabled ? { disabled: true } : {}), ...(item.keepCase ? { keepCase: true } : {}), ...(item.main ? { main: true } : {}),
      // a band item's menu opens above it, toward the staff, where the pointer goes next
      onClick: menu ? () => this.openMenu(button, menu.items(), { cell: menu.cell, columns: menu.columns, open: 'above' }) : item.onClick,
    });
    if (item.active) button.setActive(true);
    if (item.armed) button.setArmed(true);
    if (item.shortcut) this.markKey(button, item.shortcut);
    item.ref?.(button);
    return button;
  }

  /** Names `key` as the button's key: a key menu opens from it, and its name shows on it while `shortcutsShown`. */
  protected markKey(button: PixelButton, key: string, parent: Phaser.GameObjects.Container = this.root): void {
    this.shortcutButtons.set(key, button);
    if (this.shortcutsShown) this.keyBadge(parent, button, this.keyName(key));
  }

  /** The name F1 shows for a key: its own, unless a screen reads its keys another way (the piece maker's vim keys). */
  protected keyName(key: string): string {
    return key;
  }

  /** A key's name in the top left corner of a button, white on a dark box so it reads on any cell, gone with the button. */
  private keyBadge(parent: Phaser.GameObjects.Container, button: PixelButton, key: string): void {
    const r = button.rect;
    const text = new PixelText(this, r.x + 2, r.y + 2, key, { color: C.white, keepCase: true });
    const box = createBitmap(text.letterBox.right - text.letterBox.left + 2, text.letterBox.bottom - text.letterBox.top + 2);
    box.pixels.fill(C.ink);
    const back = new PixelImage(this, r.x + 1 + text.letterBox.left, r.y + 1 + text.letterBox.top, box);
    parent.add([back, text]);
    button.attach(back, text);
  }

  /**
   * A layer over the staff (ft_1_20): with the band the staff fills the whole main area, so what would sit in a bar beside
   * it (Kiur and his bubble, the page buttons of a section, an open panel) is drawn on top of it here. Same origin and zoom as
   * `root`; removed when the scene is drawn again.
   */
  protected overStaff(): Phaser.GameObjects.Container {
    const layer = this.add.container(this.root.x, this.root.y).setScale(this.px.scale).setDepth(OVER_STAFF_DEPTH);
    this.own({ destroy: () => layer.destroy(true) });
    return layer;
  }

  /** A button on a layer of `overStaff`, kept with the screen's other buttons (focus, tests, drawing again). */
  protected buttonOn(layer: Phaser.GameObjects.Container, options: PixelButtonOptions): PixelButton {
    const button = new PixelButton(this, layer, options);
    this.buttons.push(button);
    return button;
  }

  /** The pointer in art pixels, as the buttons and the band are laid out. */
  private artPoint(pointer: { x: number; y: number }): { x: number; y: number } {
    return { x: (pointer.x - this.root.x) / this.px.scale, y: (pointer.y - this.root.y) / this.px.scale };
  }

  /** Whether the pointer is over the band's inventory (its arrows and slots): a screen's own wheel leaves it to the band (ft_1_20.AC16). */
  protected pointerOnInventory(pointer: { x: number; y: number }): boolean {
    const area = this.inventoryBand?.area;
    if (!area) return false;
    const { x, y } = this.artPoint(pointer);
    return x >= area.x && x < area.x + area.w && y >= area.y && y < area.y + area.h;
  }

  /**
   * The wheel over the inventory (ft_1_20.AC16): over an item with choices (a menu) it picks the next or
   * previous one as a click in its menu would; elsewhere on the inventory it turns the page. Down is the next.
   */
  private inventoryWheel(pointer: Phaser.Input.Pointer, dy: number): void {
    const inventory = this.inventoryBand;
    if (!inventory || dy === 0 || this.menuOpen || !this.pointerOnInventory(pointer)) return;
    const { x, y } = this.artPoint(pointer);
    const over = inventory.slots.find(({ rect: r }) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
    if (over?.item.menu && !over.item.disabled) {
      const choices = over.item.menu.items();
      const next = wheelChoice(choices, dy);
      if (next !== null) choices[next]!.onPick();
    }
  }

  /** Whether the pointer is on one of the screen's buttons: a screen that takes presses on its staff leaves those to the button. */
  protected pointerOnButton(pointer: { x: number; y: number }): boolean {
    const x = (pointer.x - this.root.x) / this.px.scale;
    const y = (pointer.y - this.root.y) / this.px.scale;
    return this.buttons.some((b) => {
      const r = b.rect;
      return x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height;
    });
  }

  /** One line in the top bar right of Back (the piece's title), centred on the bar's height; `maxWidth` wraps it. */
  protected topBarTitle(value: string, maxWidth?: number): PixelText {
    const title = new PixelText(this, TITLE_X, 2, value, { color: C.white, shadow: C.groove, ...(maxWidth === undefined ? {} : { maxWidth }) });
    title.y = Math.floor((TOP_BAR - title.height) / 2);
    this.root.add(title);
    return title;
  }

  /** Keep an object that needs destroying when the scene is drawn again (a mascot, say). */
  protected own<T extends { destroy(): void }>(object: T): T {
    this.others.push(object);
    return object;
  }

  /**
   * The ground behind everything: the warden's desk (the felt goes), its planks lined up with
   * the screen's top so a sheet, a card or a book laid on it sits on one board. A painted place paints over it.
   */
  protected sky(): PixelImage {
    const width = this.px.width * ART_DETAIL, height = this.mainRows * ART_DETAIL;
    return this.fineImage(0, 0, paintedOnce(`desk:${width}x${height}`, () => paintDesk(width, height, this.screenFrame.top * ART_DETAIL)), DESK_PALETTE);
  }

  /**
   * A bitmap drawn on the fine grid of the art canvas (d110): `x`, `y` and the bitmap count fine pixels from the main
   * area's top-left corner, `ART_DETAIL` per layout cell. Art drawn on cells stays on cells and shows at twice its size.
   */
  protected fineImage(x: number, y: number, bitmap: Bitmap | RgbaArt, palette?: readonly number[]): PixelImage {
    const image = new PixelImage(this, x / ART_DETAIL, y / ART_DETAIL, bitmap, palette).setScale(1 / ART_DETAIL);
    this.root.add(image);
    return image;
  }

  /**
   * A painted picture of Keri at `key` (an hour), or null while it loads (d143, ft_1_24.AC7): the scene then draws without
   * it, a short loading view stands in `area` (the main area when not given), and the scene is drawn again once the
   * picture is there. A picture that cannot be loaded leaves the loading view and is tried again on the next drawing.
   */
  protected loaded<K extends string, T>(pictures: LoadedPictures<K, T>, key: K, area?: Rect): T | null {
    const picture = pictures.ready(key);
    if (picture !== null) return picture;
    this.loading = true;
    this.loadingView(area ?? { x: 0, y: 0, w: this.px.width, h: this.mainRows });
    const visit = this.visit;
    pictures.load(key)
      .then(() => { if (this.visit === visit) this.redraw(); })
      .catch((error: unknown) => console.warn('a painted picture did not load', error));
    return null;
  }

  /** Three dots in the middle of `area` (layout cells), lit one after another: no words (the clean UI rule). */
  private loadingView(area: Rect): void {
    const DOT = 2, GAP = 2, DOTS = 3;
    const frames = Array.from({ length: DOTS }, (_, lit) => {
      const bitmap = createBitmap(DOTS * DOT + (DOTS - 1) * GAP, DOT);
      for (let d = 0; d < DOTS; d++) for (let y = 0; y < DOT; y++) for (let x = 0; x < DOT; x++) bitmap.pixels[y * bitmap.width + d * (DOT + GAP) + x] = d === lit ? C.gold : C.dim;
      return bitmap;
    });
    const x = area.x + Math.floor((area.w - frames[0]!.width) / 2), y = area.y + Math.floor((area.h - DOT) / 2);
    this.cycle(frames.map((bitmap) => {
      const image = new PixelImage(this, x, y, bitmap).setName('loading');
      this.root.add(image);
      return image;
    }), LOADING_DOT_MS);
  }

  /** Draw the scene again from scratch (after a change that moves things, such as a hint switched on). */
  protected redraw(): void {
    this.rebuild();
  }

  /** Set while `rebuild` draws the screen again for its strip's height, so it does so once. */
  private stripRedrawn = false;

  /** When the screen opened (page time): the second click of a double click that opened it presses nothing here (`PixelButton`). */
  screenOpenedAt = 0;

  private rebuild(): void {
    const previous = this.lastFocusRect;
    this.teardown();
    const { width, height } = this.scale;
    // an overlay (d070) keeps the plain frame: it draws over the whole paused screen under it
    const strip = this.framed && !this.keepsToolbar && !this.wholeScreen;
    const view = frameView(width, height, { band: strip, whole: this.wholeScreen, bandRows: strip ? this.stripRows() : 0 });
    this.screenFrame = view;
    this.cornerFramed = strip;
    this.px = { scale: view.scale, fine: view.fine, width: view.width, height: view.height };
    this.backAction = null;
    this.root = this.add.container(0, view.top * view.scale).setScale(this.px.scale);
    this.inkWriting = false;
    this.loading = false;
    this.draw();
    this.inkWriting = false;
    // a screen whose strip actions are made in `draw` (the score screen's) has a strip of another height than was guessed:
    // it is drawn once more with the strip it has
    if (strip && !this.stripRedrawn && this.stripRows() !== view.band?.rows) {
      this.stripRedrawn = true;
      this.rebuild();
      this.stripRedrawn = false;
      return;
    }
    if (this.framed) this.drawFrame();
    this.afterFrame(this.stripFree);
    if (this.keyboardNavigation) {
      this.focusIndex = refocus(previous, this.focusables().map((b) => ({ ...b.rect, disabled: b.disabled })));
      this.paintFocus();
    }
  }

  private teardown(): void {
    this.inventoryBand = null;
    this.closeMenu();
    this.buttons.forEach((b) => b.setFocused(false));
    this.animators = [];
    this.clear();
    this.buttons.forEach((b) => b.destroy());
    this.others.forEach((o) => o.destroy());
    this.buttons = [];
    this.shortcutButtons.clear();
    this.toolbarButtons = { back: null, settings: null, keys: null, items: [] };
    this.corners = [];
    this.others = [];
    this.root?.destroy(true);
  }
}

/** The colour a label is written in on parchment: ink for the light colours, red ink for the golds; the rest as they are. */
function inkOf(color: number): number {
  if (color === C.white || color === C.cream || color === C.dim) return C.featherStreak;
  if (color === C.gold || color === C.goldLight || color === C.orange) return C.redDark;
  return color;
}
