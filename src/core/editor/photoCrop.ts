/**
 * The photo tool's picture (ft_Y_04 slice 5, AC18): the photo turned by quarter turns, fitted into the tool's window, and
 * the part the person marks with a drag, the piece to read, without the examples and other pieces a sheet often holds.
 * Pure: the tool draws and crops in the browser.
 */

/** A quarter turn clockwise, as many times as the person pressed Turn. */
export type Turn = 0 | 1 | 2 | 3;

export interface Size {
  readonly width: number;
  readonly height: number;
}

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Where the turned photo is shown: its top left corner in the window and how many window pixels a photo pixel takes. */
export interface View {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
}

/** The smallest part worth reading, in photo pixels: below it a drag was a click. */
export const MIN_CROP = 40;

export function nextTurn(turn: Turn): Turn {
  return ((turn + 1) % 4) as Turn;
}

/** The photo's size once turned. */
export function turnedSize(photo: Size, turn: Turn): Size {
  return turn % 2 === 0 ? photo : { width: photo.height, height: photo.width };
}

/** The turned photo as large as fits in `box`, centred, never larger than itself. */
export function fitIn(photo: Size, box: Size): View {
  const scale = Math.min(1, box.width / photo.width, box.height / photo.height);
  return { x: (box.width - photo.width * scale) / 2, y: (box.height - photo.height * scale) / 2, scale };
}

/** The whole turned photo. */
export function wholeOf(photo: Size): Rect {
  return { x: 0, y: 0, width: photo.width, height: photo.height };
}

/** A drag in the window, from one corner to the other, as a part of the turned photo (kept inside it); null for a click. */
export function cropOf(from: { x: number; y: number }, to: { x: number; y: number }, view: View, photo: Size): Rect | null {
  const at = (p: { x: number; y: number }) => ({
    x: Math.max(0, Math.min(photo.width, (p.x - view.x) / view.scale)),
    y: Math.max(0, Math.min(photo.height, (p.y - view.y) / view.scale)),
  });
  const a = at(from);
  const b = at(to);
  const rect = { x: Math.round(Math.min(a.x, b.x)), y: Math.round(Math.min(a.y, b.y)), width: Math.round(Math.abs(a.x - b.x)), height: Math.round(Math.abs(a.y - b.y)) };
  return rect.width < MIN_CROP || rect.height < MIN_CROP ? null : rect;
}

/** A part of the turned photo in the window. */
export function shownRect(rect: Rect, view: View): Rect {
  return { x: view.x + rect.x * view.scale, y: view.y + rect.y * view.scale, width: rect.width * view.scale, height: rect.height * view.scale };
}

/**
 * How to draw the photo turned: the canvas transform (a, b, c, d, e, f as `setTransform` takes it) that puts the photo's
 * pixel (x, y) where it lies in the turned photo, moved so that `crop`'s corner is the origin.
 */
export function turnTransform(photo: Size, turn: Turn, crop: Rect): [number, number, number, number, number, number] {
  const [a, b, c, d, e, f]: [number, number, number, number, number, number] =
    turn === 0 ? [1, 0, 0, 1, 0, 0]
    : turn === 1 ? [0, 1, -1, 0, photo.height, 0]
    : turn === 2 ? [-1, 0, 0, -1, photo.width, photo.height]
    : [0, -1, 1, 0, 0, photo.width];
  return [a, b, c, d, e - crop.x, f - crop.y];
}
