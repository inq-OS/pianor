import type { Rect } from './rect';

/**
 * The stand's panel (ft_1_08.AC11): the pictures of the trainers and minigames the stand opens, laid over the room's
 * picture. All sizes in layout cells (2 fine pixels each, d110).
 */

/** One picture as it is drawn (`standArt.ts`): 64 x 48 fine pixels. */
export const STAND_PICTURE = { w: 32, h: 24 } as const;

/** The room round a picture inside its cell (its frame and the hover ring), the gap between cells, the panel's margin. */
const FRAME = 3;
const GAP = 6;
const PAD = 7;

/**
 * Where the panel and each of `count` cells go over `picture` (the room's picture on the screen): one row while it fits
 * with a margin of the room to either side, more rows when it does not; centred, so the room shows round it.
 */
export function standPanel(picture: Rect, count: number): { panel: Rect; cells: Rect[] } {
  const cw = STAND_PICTURE.w + 2 * FRAME, ch = STAND_PICTURE.h + 2 * FRAME;
  const room = picture.w - 2 * PAD - 32;
  const perRow = Math.max(1, Math.min(count, Math.floor((room + GAP) / (cw + GAP))));
  const rows = Math.max(1, Math.ceil(count / perRow));
  const w = 2 * PAD + perRow * cw + (perRow - 1) * GAP;
  const h = 2 * PAD + rows * ch + (rows - 1) * GAP;
  const panel = { x: picture.x + Math.floor((picture.w - w) / 2), y: picture.y + Math.floor((picture.h - h) / 2), w, h };
  const cells = Array.from({ length: count }, (_, i) => {
    const row = Math.floor(i / perRow), col = i % perRow;
    // a last row that is not full sits in the middle
    const inRow = row === rows - 1 ? count - row * perRow : perRow;
    const rowStart = panel.x + PAD + Math.floor(((perRow - inRow) * (cw + GAP)) / 2);
    return { x: rowStart + col * (cw + GAP), y: panel.y + PAD + row * (ch + GAP), w: cw, h: ch };
  });
  return { panel, cells };
}
