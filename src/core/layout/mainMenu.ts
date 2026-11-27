import { LANTERN_PICTURE } from './lantern';
import type { Rect } from './rect';

/**
 * The main menu (ft_1_07, the first screen). The lantern over Keri fills the whole screen, with no
 * lower section and the lantern on the right; the game's name hangs on a board in the picture's upper left corner, and
 * under it, on the left, the players are written one under the other on a sheet of parchment, as the 1991 game would
 * do it rather than plain box buttons. A line for each player; the next empty line is the outline of a button with "+";
 * at the sheet's head, over the names, the bare piano (a button with a picture of a keyboard) and the gear (credits and
 * admin are in the settings), which stay where they are whatever the number of players. The sheet is a scroll after the
 * 1991 game's island map parchment: `roll` and `foot` are its curled ends. No heading (the sheet says it is the choice
 * of player), no toolbar and no band: the screen paints every row itself.
 * Pure numbers, in layout cells; `ProfilesScene` draws them.
 */
export const MAIN_MENU = {
  /** Lines on the sheet: one for each of the most players a device holds. */
  lines: 10,
  /** The board with the game's name: its size, and how far from the picture's left and top it hangs. */
  name: { w: 82, h: 20, x: 9, y: 5 },
  /** The sheet: its width, how far from the picture's left edge it hangs, and how far under the name's board. */
  sheet: { w: 88, left: 6, gap: 2 },
  /** The rolled top of the scroll, and the bare parchment under the roll before the two pictures. */
  roll: 5,
  head: 1,
  /** A line of the list: a player's name, or the outlined free place; wide enough for twelve of the widest letters (ft_1_07). */
  line: { w: 80, h: 12 },
  /**
   * The row of pictures at the sheet's head: its height, the parchment between it and the first line (a flourish is drawn
   * there), and the width of the piano (a keyboard of five keys), the academic hat (WP-14, d145) and the gear.
   */
  tools: { gap: 3, h: 14, piano: 32, hat: 16, gear: 20 },
  /** The curled foot of the scroll under the last line. */
  foot: 5,
} as const;

export interface MainMenuInput {
  /** The screen in layout cells. */
  width: number;
  height: number;
  /** How many players the device has, and whether one more may be added. */
  players: number;
  canAdd: boolean;
  /** Whether the bare piano is offered. */
  piano: boolean;
}

export interface MainMenuLayout {
  /** The picture: the whole screen on the target screen, in the middle of a larger one. */
  picture: Rect;
  /** The hung board with the game's name, over the picture. */
  name: Rect;
  /** The sheet of parchment under the name, only as long as what is written on it. */
  sheet: Rect;
  /** A line for each player, in the order given, from the top down. */
  players: Rect[];
  /** The outlined "+" on the next free line, or null when no player may be added. */
  add: Rect | null;
  /**
   * The bare piano, the academic hat and the gear, side by side at the sheet's head, the gear on the right and the hat in the
   * room between: the same places whatever is written under them, with the piano or without it.
   */
  piano: Rect | null;
  hat: Rect;
  gear: Rect;
}

export function mainMenuLayout(input: MainMenuInput): MainMenuLayout {
  const { lines, name, sheet, roll, head, line, tools, foot } = MAIN_MENU;
  const written = input.players + (input.canAdd ? 1 : 0);
  if (written > lines) throw new Error(`the main menu's sheet holds ${lines} lines, not ${input.players} players${input.canAdd ? ' and a free place' : ''}`);
  const picture: Rect = { x: Math.floor((input.width - LANTERN_PICTURE.w) / 2), y: Math.max(0, Math.floor((input.height - LANTERN_PICTURE.h) / 2)), w: LANTERN_PICTURE.w, h: LANTERN_PICTURE.h };
  const top = picture.y + name.y + name.h + sheet.gap, toolsY = top + roll + head;
  // the two pictures lie at the sheet's head, so no line written or wiped under them moves them
  const first = toolsY + tools.h + tools.gap;
  const paper: Rect = { x: picture.x + sheet.left, y: top, w: sheet.w, h: first + written * line.h + foot - top };
  const left = paper.x + Math.floor((sheet.w - line.w) / 2);
  const place = (i: number): Rect => ({ x: left, y: first + i * line.h, w: line.w, h: line.h });
  return {
    picture,
    name: { x: picture.x + name.x, y: picture.y + name.y, w: name.w, h: name.h },
    sheet: paper,
    players: Array.from({ length: input.players }, (_, i) => place(i)),
    add: input.canAdd ? place(input.players) : null,
    piano: input.piano ? { x: left, y: toolsY, w: tools.piano, h: tools.h } : null,
    hat: { x: left + tools.piano + Math.floor((line.w - tools.piano - tools.hat - tools.gear) / 2), y: toolsY, w: tools.hat, h: tools.h },
    gear: { x: left + line.w - tools.gear, y: toolsY, w: tools.gear, h: tools.h },
  };
}
