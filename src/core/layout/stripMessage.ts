/**
 * Where the piece maker's message stands (ft_1_02d.AC54): in the strip at the screen's foot, never over the staff. A short
 * message takes the strip's empty right side; a longer one grows to the left along the strip, over its buttons while it
 * shows (the strip has one line of room: at 320 art pixels its free right side holds about a third of the messages); only a
 * message longer than the whole strip wraps and rises from it. Art pixels.
 */
export interface StripMessageBox {
  x: number;
  y: number;
  w: number;
  h: number;
  /** The width the text wraps at (`linesAt` tells how many lines the text takes at a width: the font's own wrap). */
  textWidth: number;
}

/** The text sits this far in from the box's left and right edges, and its frame adds this to its lines' height. */
export const MESSAGE_PAD_X = 5;
const FRAME_EXTRA = 4;
/** The box keeps this far off the screen's sides. */
const EDGE = 2;

export function stripMessageBox(input: { textWidth: number; lineHeight: number; linesAt: (width: number) => number; free: { left: number; right: number; top: number; rows: number }; width: number }): StripMessageBox {
  const { free, lineHeight } = input;
  const right = Math.min(free.right, input.width) - EDGE;
  const widest = right - EDGE;
  const w = Math.min(widest, Math.ceil(input.textWidth) + 2 * MESSAGE_PAD_X);
  const textWidth = w - 2 * MESSAGE_PAD_X;
  const lines = input.linesAt(textWidth);
  // the lines of the font have a gap under the last one that the box leaves out
  const h = Math.max(1, lines) * lineHeight + FRAME_EXTRA - 2;
  const y = h <= free.rows ? free.top + Math.floor((free.rows - h) / 2) : free.top + free.rows - h - 1;
  return { x: right - w, y, w, h, textWidth };
}
