import { pixelView } from './pixelView';
import { rectRight, type Rect } from './rect';

/**
 * The frame of every screen (d088), top to bottom: the toolbar, one vine line across the screen, the main area
 * (the screen itself), and under the game the on-screen keyboard. Pure: the scenes and the toolbar art only draw this.
 */
export const TOOLBAR_ROWS = 20;
export const VINE_ROWS = 3;
/** Rows above the main area: the toolbar and the vine. */
export const FRAME_ROWS = TOOLBAR_ROWS + VINE_ROWS;
/** The one screen the game is made and tested for (d105): the 1920x1080 full screen, in physical pixels. */
export const TARGET_SCREEN = { width: 1920, height: 1080 } as const;
/**
 * Fine art pixels per layout cell, each way (d110). The finest grid, the one new art is drawn on, is the art canvas:
 * 640 x 360 fine pixels, 3 x 3 screen pixels each on the target screen. Layouts, hit areas, the font and the art drawn before
 * d110 count in cells of 2 x 2 fine pixels, so they carry over exactly at twice their old size.
 */
export const ART_DETAIL = 2;
const TARGET_FINE_ZOOM = 3;
/** The art canvas on the target screen in fine pixels (d110): 640 x 360. */
export const ART_CANVAS = { width: TARGET_SCREEN.width / TARGET_FINE_ZOOM, height: TARGET_SCREEN.height / TARGET_FINE_ZOOM } as const;
/**
 * The layout area every screen is laid out and tested for (d105, d110): the art canvas in cells, 320 x 180 with the toolbar
 * and the vine. The zoom is the largest whole number that keeps at least this much, so a smaller window gets a smaller zoom,
 * never a more cramped layout.
 */
export const FRAME_MIN = { width: ART_CANVAS.width / ART_DETAIL, height: ART_CANVAS.height / ART_DETAIL } as const;
/** The largest fine zoom: 4 screen pixels per fine pixel, 8 per cell. */
export const MAX_FINE_ZOOM = 4;

/**
 * Whether a canvas of `width` x `height` physical pixels is big enough to play (d105, d110): it holds the whole art
 * canvas at one screen pixel per fine pixel (two per cell). AX-3 provisional (d105): smaller, the pixel font is too small to
 * read (AX-0). Below it the game shows only the line `screen.tooSmall` until the window grows.
 */
export function frameFits(width: number, height: number): boolean {
  return Math.min(width / ART_CANVAS.width, height / ART_CANVAS.height) >= 1;
}

/** How many layout cells a picture of `size` fine pixels takes (d110): half each way, rounded up. */
export function fineToCells(size: { w: number; h: number }): { w: number; h: number } {
  return { w: Math.ceil(size.w / ART_DETAIL), h: Math.ceil(size.h / ART_DETAIL) };
}

export interface FrameView {
  /** Whole screen pixels per layout cell: always `ART_DETAIL` times `fine`. */
  scale: number;
  /** Whole screen pixels per fine art pixel (3 on the target screen). */
  fine: number;
  /** The screen's width in art pixels. */
  width: number;
  /** The main area's height in art pixels: the screen less the toolbar and the vine. */
  height: number;
  /** The main area starts this many art rows from the top. */
  top: number;
  /** Whether the toolbar and the vine are drawn above the main area. */
  toolbar: boolean;
  /** The action and inventory band under the main area (ft_1_20): its top in rows from the main area's top; null without it. */
  band: { top: number; rows: number } | null;
}

/**
 * The one flag of the frame's layout for the top toolbar under the band (d115, ft_1_20.AC12; the
 * toolbar is set aside for now, kept in the code so it can come back). Off: the band holds Back, Settings and the
 * player, and the main area has every row above it (124 on the target screen). On: the toolbar and the vine are drawn as
 * before d115 and hold them, and the main area has 101 rows. No scene changes when it flips.
 */
export const BAND_KEEPS_TOOLBAR = false;

export interface FrameOptions {
  /** Draw the action and inventory band at the foot (ft_1_20): every framed screen but the battle screens (d129). */
  band: boolean;
  /** With the band: keep the toolbar too. `BAND_KEEPS_TOOLBAR` by default; only tests pass it. */
  toolbar?: boolean;
  /**
   * The screen paints every row itself (the main menu, ft_1_07: its picture and its own board of plates): no toolbar, no
   * vine and no band, whatever `band` says. AX-3 provisional: asked of the architect (d088 has a toolbar on every screen).
   */
  whole?: boolean;
  /**
   * The rows of the strip at the foot (ft_1_20, d282: `pinRows`, 0 on a screen with nothing pinned); none when not given.
   */
  bandRows?: number;
}

/**
 * How tall the board is that a talk or a tug lays over the foot of a painted place (ft_1_21, ft_1_22): the height the old
 * band had, which its pictures are painted for.
 */
export const BOARD_ROWS = 56;

export function frameView(screenWidth: number, screenHeight: number, options: FrameOptions = { band: false }): FrameView {
  const fine = pixelView(screenWidth, screenHeight, { minWidth: ART_CANVAS.width, minHeight: ART_CANVAS.height, maxScale: MAX_FINE_ZOOM }).scale;
  const scale = fine * ART_DETAIL;
  const width = Math.ceil(screenWidth / scale);
  if (options.whole) return { scale, fine, width, height: Math.floor(screenHeight / scale), top: 0, toolbar: false, band: null };
  if (!options.band) return { scale, fine, width, height: Math.ceil(screenHeight / scale) - FRAME_ROWS, top: FRAME_ROWS, toolbar: true, band: null };
  // the band stands on the last whole row, so none of it is cut off at the screen's foot
  const toolbar = options.toolbar ?? BAND_KEEPS_TOOLBAR;
  const top = toolbar ? FRAME_ROWS : 0;
  const rows = options.bandRows ?? 0;
  const height = Math.floor(screenHeight / scale) - rows - top;
  return { scale, fine, width, height, top, toolbar, band: { top: height, rows } };
}

/** What a screen puts on the toolbar; widths in art pixels, the texts measured by the caller. */
export interface ToolbarInput {
  width: number;
  /** The Back door: false on a screen with nowhere to go back to. */
  back: boolean;
  /** The settings gear: false on the settings screen itself. */
  settings: boolean;
  /** The on-screen keyboard switch at the right end: only on the settings screen since d099 (a developer's tool now). */
  keys: boolean;
  /** The active player's name, rank and XP, or null on a screen without a player (the profile picker, admin). */
  player: { nameWidth: number; rankWidth: number; xpTextWidth: number } | null;
  /** The screen's own buttons, left to right, at full width and as an icon only. */
  items: readonly { width: number; iconWidth: number }[];
}

export interface ToolbarLayout {
  back: Rect | null;
  name: Rect | null;
  rank: Rect | null;
  xpBar: Rect | null;
  /** The XP numbers; null when they did not fit (the bar stays). */
  xpText: Rect | null;
  items: { rect: Rect; iconOnly: boolean }[];
  settings: Rect | null;
  keys: Rect | null;
  /** False when even icons-only items do not fit: a screen's test must fail. */
  fits: boolean;
}

const EDGE = 4;
const GAP = 3;
/** Room between the left group (Back, the player) and the right group (the buttons). */
const SPLIT = 6;
const BUTTON_HEIGHT = 16;
const BUTTON_Y = (TOOLBAR_ROWS - BUTTON_HEIGHT) / 2;
const ICON_WIDTH = 22;
const TEXT_HEIGHT = 7;
const TEXT_Y = Math.floor((TOOLBAR_ROWS - TEXT_HEIGHT) / 2);
const NAME_GAP = 6;
const XP_BAR_WIDTH = 60;
const XP_BAR_HEIGHT = 7;
const XP_GAP = 4;
/** The narrowest a long name is cut to: a few letters and the dot. */
const MIN_NAME_WIDTH = 24;

/**
 * Where everything on the toolbar goes (d088), AX-3 provisional order: at the left Back, the name, the rank and the XP bar
 * with its numbers; at the right the screen's own items, then settings, then the keyboard switch (settings screen only, d099) at the right end. When it
 * does not fit, the XP numbers go first, then the screen's items show as icons only, then a long name is narrowed.
 */
export function toolbarLayout(input: ToolbarInput): ToolbarLayout {
  for (const [xpNumbers, iconsOnly] of [[true, false], [false, false], [false, true]] as const) {
    const layout = place(input, xpNumbers, iconsOnly);
    if (layout.fits) return layout;
  }
  const last = place(input, false, true);
  if (!input.player || !last.name) return last;
  // last, a name longer than the name screen allows (an imported save may have 40 letters) gets only the room left;
  // the scene cuts its text to `name.w`
  const over = rectRight(last.xpBar!) + SPLIT - rightStart(last, input.width);
  const nameWidth = Math.max(MIN_NAME_WIDTH, last.name.w - over);
  return place({ ...input, player: { ...input.player, nameWidth } }, false, true);
}

/** Where the right group starts: the first item, or settings, or the keyboard switch, or the right edge. */
function rightStart(layout: ToolbarLayout, width: number): number {
  return layout.items[0]?.rect.x ?? layout.settings?.x ?? layout.keys?.x ?? width - EDGE;
}

function place(input: ToolbarInput, xpNumbers: boolean, iconsOnly: boolean): ToolbarLayout {
  const button = (x: number, w: number): Rect => ({ x, y: BUTTON_Y, w, h: BUTTON_HEIGHT });
  const text = (x: number, w: number): Rect => ({ x, y: TEXT_Y, w, h: TEXT_HEIGHT });

  // the left group
  let x = EDGE;
  const back = input.back ? button(x, ICON_WIDTH) : null;
  if (back) x = rectRight(back) + GAP + 1;
  let name: Rect | null = null;
  let rank: Rect | null = null;
  let xpBar: Rect | null = null;
  let xpText: Rect | null = null;
  if (input.player) {
    name = text(x, input.player.nameWidth);
    rank = text(rectRight(name) + NAME_GAP, input.player.rankWidth);
    xpBar = { x: rectRight(rank) + XP_GAP, y: TEXT_Y, w: XP_BAR_WIDTH, h: XP_BAR_HEIGHT };
    if (xpNumbers) xpText = text(rectRight(xpBar) + XP_GAP, input.player.xpTextWidth);
    x = rectRight(xpText ?? xpBar);
  }
  const leftEnd = x;

  // the right group, from the right edge
  let right = input.width - EDGE;
  let keys: Rect | null = null;
  if (input.keys) {
    keys = button(right - ICON_WIDTH, ICON_WIDTH);
    right = keys.x - GAP;
  }
  let settings: Rect | null = null;
  if (input.settings) {
    settings = button(right - ICON_WIDTH, ICON_WIDTH);
    right = settings.x - GAP;
  }
  const widths = input.items.map((item) => (iconsOnly ? item.iconWidth : item.width));
  const itemsWidth = widths.reduce((sum, w) => sum + w, 0) + GAP * Math.max(0, widths.length - 1);
  let itemX = right - itemsWidth;
  const items = widths.map((w) => {
    const rect = button(itemX, w);
    itemX += w + GAP;
    return { rect, iconOnly: iconsOnly };
  });
  const rightStart = widths.length > 0 ? right - itemsWidth : right;
  return { back, name, rank, xpBar, xpText, items, settings, keys, fits: leftEnd + SPLIT <= rightStart };
}

/**
 * Where Back (the door) and Settings (the gear) go with the band and no toolbar (Back and Settings
 * stay as the door and the gear in the places they had in the toolbar): the toolbar's own places, now over the
 * top corners of the main area. In rows from the screen's top.
 */
export function frameCorners(width: number): { back: Rect; settings: Rect } {
  const bar = toolbarLayout({ width, back: true, settings: true, keys: false, player: null, items: [] });
  return { back: bar.back!, settings: bar.settings! };
}
