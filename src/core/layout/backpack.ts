import { frameCorners } from './frame';
import type { Rect } from './rect';

/**
 * The backpack (ft_1_20, d282): the items a student keeps (a character's prize, ft_1_21.AC15), a picture in the top right
 * corner left of the gear on the room, the map and the scenes. A press opens its page over the picture: one board of filled
 * slots under the backpack, right edges in line, never an empty slot. Pure: `PixelScene` only draws it. In art rows from the
 * screen's top (the room, the map and the scenes have no toolbar).
 *
 * AX-3 provisional: the gap to the gear (the toolbar's gap), the slot size (the old band's, so the painted prizes fit) and
 * four columns of three rows; a student with more kept items than a page holds sees the first page only until there are that many.
 */
export const BACKPACK_SLOT = { w: 38, h: 27 } as const;
const GAP_TO_GEAR = 3;
const SLOT_GAP = 1;
const EDGE = 2;
const COLUMNS = 4;
const ROWS = 3;

export function backpackPage(input: { width: number; height: number; items: number }): { button: Rect; board: Rect; slots: Rect[]; perPage: number } {
  const { settings } = frameCorners(input.width);
  const button: Rect = { x: settings.x - GAP_TO_GEAR - settings.w, y: settings.y, w: settings.w, h: settings.h };
  const top = button.y + button.h + 2;
  const fitRows = Math.max(1, Math.floor((input.height - top - 2 * EDGE + SLOT_GAP) / (BACKPACK_SLOT.h + SLOT_GAP)));
  const fitColumns = Math.max(1, Math.floor((button.x + button.w - 2 * EDGE + SLOT_GAP) / (BACKPACK_SLOT.w + SLOT_GAP)));
  const columns = Math.min(COLUMNS, fitColumns), rows = Math.min(ROWS, fitRows);
  const perPage = columns * rows;
  const count = Math.min(input.items, perPage);
  const used = Math.max(1, Math.min(columns, count));
  const usedRows = Math.max(1, Math.ceil(count / columns));
  const right = button.x + button.w;
  const w = used * BACKPACK_SLOT.w + (used - 1) * SLOT_GAP + 2 * EDGE;
  const board: Rect = { x: right - w, y: top, w, h: usedRows * BACKPACK_SLOT.h + (usedRows - 1) * SLOT_GAP + 2 * EDGE };
  const slots = Array.from({ length: count }, (_, i): Rect => ({
    x: board.x + EDGE + (i % columns) * (BACKPACK_SLOT.w + SLOT_GAP),
    y: board.y + EDGE + Math.floor(i / columns) * (BACKPACK_SLOT.h + SLOT_GAP),
    w: BACKPACK_SLOT.w, h: BACKPACK_SLOT.h,
  }));
  return { button, board, slots, perPage };
}
