import Phaser from 'phaser';
import { pagerBoxes } from '../../../core/layout/cardGrid';
import type { PageSlice } from '../../../core/layout/paging';
import { ART_DETAIL, FRAME_ROWS, VINE_ROWS, frameCorners, frameView, toolbarLayout, type FrameView } from '../../../core/layout/frame';
import { BAND_ROWS, bandCells, bandItemPage, bandLayout, wheelChoice, wheelPage, type BandCell } from '../../../core/layout/band';
import type { PixelView } from '../../../core/layout/pixelView';
import { rectCentre, type Rect } from '../../../core/layout/rect';
import { dropMenuLayout } from '../../../core/layout/dropMenu';
import { clipToWidth } from '../../../core/text/clip';
import { t } from '../../../core/text/strings';
import { initialFocus, moveFocus, refocus, type FocusMove } from '../../../core/layout/focus';
import { panelBitmap, trayBitmap } from './frames';
import { ICONS } from './iconArt';
import { PALETTE, C } from './palette';
import { createBitmap, recolor, type Bitmap } from './bitmap';
import { LiveImage, PixelBar, PixelButton, PixelImage, PixelText, type PixelButtonOptions, type RgbaArt } from './PixelObjects';
import { LiveWaterPlayer } from './liveWater';
import type { LiveWater } from './paint/live';
import { TITLE_X, TOP_BAR } from './playBars';
import { DESK_PALETTE, paintBeam, paintDesk } from './paint/desk';
import { paintedOnce } from './paintedOnce';
import { CARD_PALETTE, RIBBON_TAIL, paintCard, paintRibbon } from './paint/card';
import { BOOK_PALETTE, REGISTER_PALETTE, paintBook } from './paint/book';
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
  /** The key that does what the item does (the piece maker): drawn on the item while `shortcutsShown`. */
  shortcut?: string;
  onClick: () => void;
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
  onPick: () => void;
}

/** A drop-down is drawn over everything of its screen, the staff too (the staff draws at depth 8 to 10). */
const MENU_DEPTH = 1000;
const MENU_GAP = 2;
const MENU_PAD = 3;

/**
 * A scene drawn in art pixels. It works out the whole-number zoom for the screen (`frameView`), puts everything in a
 * `root` container scaled by that zoom, and draws again when the window changes size. Subclasses only say what to
 * draw, in art pixels, in the main area. Since d110 an art pixel of `root` is a layout cell of 2 x 2 fine pixels; art
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
  /** The band's state (ft_1_20): which set of actions More has turned to and which page of items the arrows show; kept over redraws. */
  private bandPages = { actions: 0, items: 0 };
  /** Where the inventory is drawn (art pixels) and its items by slot, for the wheel (ft_1_20.AC16); null without the band. */
  private inventoryBand: { area: Rect; slots: { rect: Rect; item: ToolbarItem }[]; items: number; perPage: number } | null = null;
  /** The door and the gear over the top corners with the band and no toolbar: faded until the pointer or the focus is on them. */
  private corners: PixelButton[] = [];
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
  private menu: { container: Phaser.GameObjects.Container; buttons: PixelButton[]; focusBefore: number } | null = null;
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
    const visit = ++this.visit;
    this.events.once('shutdown', () => { if (this.visit === visit) this.visit++; });
    this.focusIndex = -1;
    this.focusShown = false;
    this.lastFocusRect = null;
    this.bandPages = { actions: 0, items: 0 };
    if (this.framed) this.cameras.main.setBackgroundColor(PALETTE[C.night]);
    // the pointer left the canvas (up into the toolbar, or down to the on-screen keys): no button stays lit or keeps its tooltip
    this.input.on('gameout', () => this.buttons.forEach((b) => b.leave()));
    // the wheel over the inventory pages it, and over an item with choices steps through them (ft_1_20.AC16)
    this.input.on('wheel', (p: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) => this.inventoryWheel(p, dy));
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
        onClick: () => {
          this.closeMenu();
          item.onPick();
        },
      });
      if (item.active) button.setActive(true);
      if (item.shortcut) this.keyBadge(container, button, item.shortcut);
      buttons.push(button);
    });
    this.menu = { container, buttons, focusBefore: this.focusIndex };
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

  /** Whether the action and inventory band is drawn under the main area (ft_1_20): a painted place then keeps no strip of its own. */
  protected get bandShown(): boolean {
    return this.screenFrame.band !== null;
  }

  /**
   * With the band and no toolbar: the strip along the main area's top that the door and the gear stand in (`rows` high), and
   * the room between them (`left` to `right`). A staff starts under it; Kiur and his bubble, or a page turner, may use the room.
   */
  protected get cornerStrip(): { rows: number; left: number; right: number } {
    const { back, settings } = frameCorners(this.px.width);
    return { rows: Math.max(back.y + back.h, settings.y + settings.h) + 1, left: back.x + back.w + 2, right: settings.x - 2 };
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
    if (band) this.drawBand(band.top);
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
   * The action and inventory band at the foot (ft_1_20, d115), `top` rows below the main area's top, with no text on it:
   * the 3 x 3 grid of the screen's actions with Back bottom left and Settings bottom right, the
   * arrows and the item slots. Today's plain panels and buttons: the painter draws the band's look.
   */
  private drawBand(top: number): void {
    const context = contextOf(this);
    const width = this.px.width;
    const keepsToolbar = this.screenFrame.toolbar;
    // the band's ground: one warm board with a dark line along its top; the plates are cut into it
    const ground = createBitmap(Math.max(5, width), BAND_ROWS);
    ground.pixels.fill(C.panel);
    ground.pixels.fill(C.groove, 0, ground.width);
    this.root.add(new PixelImage(this, 0, top, ground));
    const layout = bandLayout(width);
    const box = (r: Rect) => ({ ...rectCentre(r), y: top + r.y + r.h / 2 });

    // Back and Settings: the door and the gear where the toolbar had them, over the screen's top corners
    const corners = keepsToolbar ? null : frameCorners(width);
    // over the staff too: a screen whose staff fills the main area (practice, the piece maker) would hide them
    const cornerLayer = corners ? this.overStaff() : null;
    const corner = (r: Rect, label: string, icon: Bitmap, onClick: () => void): PixelButton => {
      // the picture alone, no button behind it (the gear and exit corner buttons show only their pictures, with no button background)
      const button: PixelButton = this.buttonOn(cornerLayer!, { ...rectCentre(r), label, picture: icon, onHover: (over) => button.setAlpha(over ? 1 : CORNER_FADED), onClick });
      button.setAlpha(CORNER_FADED);
      this.corners.push(button);
      return button;
    };
    const back = corners && this.hasBack ? corner(corners.back, t('ui.back'), ICONS.quit, () => (this.backAction ?? (() => this.back()))()) : null;
    const settings = corners && this.scene.key !== 'settings' && this.toolbarPlayer ? corner(corners.settings, t('menu.settingsButton'), ICONS.settings, () => this.openSettingsScreen()) : null;

    // the action grid: the screen's actions, and the keyboard switch on the settings screen (d099)
    const actions = this.bandActions();
    const keysAction = !keepsToolbar && this.toolbarKeys;
    if (keysAction) actions.push({ label: t('settings.keyboard'), icon: ICONS.freePlay, onClick: () => context.keyboardSwitch.toggle() });
    const grid = bandCells({ actions: actions.length, page: this.bandPages.actions });
    this.bandPages.actions = grid.page;
    const made = grid.cells.map((cell, i) => this.bandCell(cell, actions, box(layout.cells[i]!)));
    const actionButtons = grid.cells.flatMap((cell, i) => (cell !== null && typeof cell === 'object' ? [{ action: cell.action, button: made[i]! }] : []));
    if (!keepsToolbar) {
      this.toolbarButtons = {
        back,
        settings,
        keys: keysAction ? actionButtons.find((a) => a.action === actions.length - 1)?.button ?? null : null,
        items: actionButtons.filter((a) => !keysAction || a.action < actions.length - 1).map((a) => a.button),
      };
      if (keysAction) this.toolbarButtons.keys?.setDisabled(!context.keyboardSwitch.enabled());
      this.lightKeys(context.keyboardSwitch.shown());
    }

    // the inventory: the arrows page it, a page of slots at a time (rule 5)
    const items = this.bandItems();
    const page = bandItemPage({ items: items.length, slots: layout.slots.length, page: this.bandPages.items });
    this.bandPages.items = page.page;
    const turn = (by: number) => () => {
      this.bandPages.items = page.page + by;
      this.redraw();
    };
    this.button({ ...box(layout.arrows.up), label: t('band.itemsUp'), icon: ICONS.up, iconOnly: true, look: 'bandCell', disabled: !page.up, onClick: turn(-1) });
    this.button({ ...box(layout.arrows.down), label: t('band.itemsDown'), icon: ICONS.down, iconOnly: true, look: 'bandCell', disabled: !page.down, onClick: turn(1) });
    const shown: { rect: Rect; item: ToolbarItem }[] = [];
    layout.slots.forEach((slot, i) => {
      const item = items[page.first + i];
      if (i >= page.count || !item) {
        this.root.add(new PixelImage(this, slot.x, top + slot.y, trayBitmap(slot.w, slot.h, 'slotEmpty')));
        return;
      }
      this.bandButton(item, box(slot), 'bandSlot', slot.w - CELL_PAD);
      shown.push({ rect: { ...slot, y: top + slot.y }, item });
    });
    const parts = [layout.arrows.up, layout.arrows.down, ...layout.slots];
    const left = Math.min(...parts.map((r) => r.x)), right = Math.max(...parts.map((r) => r.x + r.w));
    const upper = Math.min(...parts.map((r) => r.y)), lower = Math.max(...parts.map((r) => r.y + r.h));
    this.inventoryBand = { area: { x: left, y: top + upper, w: right - left, h: lower - upper }, slots: shown, items: items.length, perPage: layout.slots.length };
  }

  /** One cell of the action grid: an action, More, or an empty panel. */
  private bandCell(cell: BandCell, actions: readonly ToolbarItem[], at: { x: number; y: number; width: number; height: number }): PixelButton | null {
    // a cell with no action is not drawn: the band shows only what can be done (AX-3 provisional, asked of the architect)
    if (cell === null) return null;
    const make = (item: ToolbarItem): PixelButton => this.bandButton(item, at, 'bandCell', at.width - CELL_PAD);
    if (cell === 'more') {
      return make({
        label: t('band.more'),
        onClick: () => {
          this.bandPages.actions += 1;
          this.redraw();
        },
      });
    }
    return make(actions[cell.action]!);
  }

  /**
   * One action cell or item slot of the band: its picture (pictures, not words) with its word in a tooltip
   * bubble, or its word when it has no picture yet (cut short when it does not fit `room`, the whole word in the tooltip).
   * An opening item with a `menu` opens its choices from the button.
   */
  private bandButton(item: ToolbarItem, at: { x: number; y: number; width: number; height: number }, look: 'bandCell' | 'bandSlot', room: number): PixelButton {
    const width = (s: string) => measure(drawnText(s));
    const fits = width(item.label) <= room;
    const label = fits || item.icon ? item.label : clipToWidth(item.label, room, width);
    const tooltip = item.tooltip ?? (fits || item.icon ? undefined : item.label);
    const menu = item.menu;
    const button: PixelButton = this.button({
      ...at, label, labelWidth: room, look, ...(item.icon ? { icon: item.icon, iconOnly: true, ...(item.fineIcon ? { fineIcon: true } : {}) } : {}), ...(tooltip ? { tooltip } : {}),
      ...(item.disabled ? { disabled: true } : {}), ...(item.keepCase ? { keepCase: true } : {}),
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
   * A layer over the staff (ft_1_20): with the band the staff fills the whole main area, so what used to sit in a bar beside
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
      return;
    }
    const page = wheelPage({ items: inventory.items, slots: inventory.perPage, page: this.bandPages.items }, dy);
    if (page === null) return;
    this.bandPages.items = page;
    this.redraw();
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
   * area's top-left corner, `ART_DETAIL` per layout cell. Art drawn before d110 stays on cells and shows at twice its size.
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

  private rebuild(): void {
    const previous = this.lastFocusRect;
    this.teardown();
    const { width, height } = this.scale;
    // an overlay (d070) keeps the plain frame: it draws over the whole paused screen under it
    const view = frameView(width, height, { band: this.framed && !this.keepsToolbar, whole: this.wholeScreen });
    this.screenFrame = view;
    this.px = { scale: view.scale, fine: view.fine, width: view.width, height: view.height };
    this.backAction = null;
    this.root = this.add.container(0, view.top * view.scale).setScale(this.px.scale);
    this.inkWriting = false;
    this.loading = false;
    this.draw();
    this.inkWriting = false;
    if (this.framed) this.drawFrame();
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
