/**
 * The learned piece's clef on its way to the book (ft_1_32.AC22, d292): on the practice screen it grows smoothly to twice its
 * size where it stands; the screen closes and the book opens; there the clef starts where the practice screen left it and
 * drops smoothly onto the piece's clef sign, into the empty place or onto the clef that was there. Pure: the screens only
 * play it. Times in milliseconds.
 */
export const CLEF_FLIGHT = {
  /** How much the clef grows on the practice screen, and how long it takes. */
  grow: 2,
  growMs: 700,
  /** The book stands open this long before the clef drops, the drop takes this long, and a piece that goes on to its character waits this long after the landing. */
  waitMs: 300,
  dropMs: 900,
  afterMs: 1200,
} as const;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Where the clef is drawn at one moment: its centre on the screen and its scale against the grown clef. */
export interface ClefPose {
  x: number;
  y: number;
  scale: number;
}

/**
 * The drop in the book, in screen pixels: from the grown clef's box (`from`, where the practice screen left it) to the box of
 * the piece's clef sign (`to`). The clef starts as it was left and shrinks to the sign's height as it drops onto it.
 */
export function clefDrop(from: Box, to: Box): { start: ClefPose; end: ClefPose } {
  return {
    start: { x: from.x + from.w / 2, y: from.y + from.h / 2, scale: 1 },
    end: { x: to.x + to.w / 2, y: to.y + to.h / 2, scale: to.h / from.h },
  };
}

/** The box of the clef grown by `CLEF_FLIGHT.grow` about its centre. */
export function grownBox(box: Box): Box {
  const w = box.w * CLEF_FLIGHT.grow;
  const h = box.h * CLEF_FLIGHT.grow;
  return { x: box.x + box.w / 2 - w / 2, y: box.y + box.h / 2 - h / 2, w, h };
}
