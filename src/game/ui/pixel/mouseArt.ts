import type { MouseGesture, StaffSketch } from '../../../core/editor/help';
import { blit, createBitmap, fromAscii, type Bitmap } from './bitmap';
import { C } from './palette';

/**
 * The pictures of the piece maker's F1 help (ft_1_33.AC1): a small mouse showing what is pressed, a few bars of staff
 * before and after, the arrow between them, and a key cap. Own art, drawn by code (the free packs could not be fetched in
 * the session that made it; ft_1_33's TODO). Sizes in art pixels.
 */
export const MOUSE_COLOURS: Readonly<Record<'left' | 'wheel' | 'right', number>> = { left: C.gold, wheel: C.teal, right: C.red };

/** A mouse `width` by `height`: cream with the ink outline, two buttons split by an ink line, the wheel between them; each part `lit` in its colour. */
export function mousePicture(width: number, height: number, lit: readonly ('left' | 'wheel' | 'right')[]): Bitmap {
  const b = createBitmap(width, height);
  const mid = Math.floor(width / 2);
  const split = Math.round(height * 0.42);
  const top = Math.floor(width / 2);
  const foot = Math.floor(width / 2) - 1;
  // a capsule: round corners of radius `top` above the middle, `foot` below it
  const inside = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= width || y >= height) return false;
    const r = y < height / 2 ? top : foot;
    const px = x + 0.5, py = y + 0.5;
    const dx = Math.max(r - px, 0, px - (width - r));
    const dy = Math.max(r - py, 0, py - (height - r));
    return dx * dx + dy * dy <= r * r;
  };
  const wheel = { x0: mid - 1, x1: mid + 1, y0: 2, y1: Math.max(4, split - 2) };
  const inWheel = (x: number, y: number) => x >= wheel.x0 && x <= wheel.x1 && y >= wheel.y0 && y <= wheel.y1;
  const colour = (part: 'left' | 'wheel' | 'right') => (lit.includes(part) ? MOUSE_COLOURS[part] : C.cream);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!inside(x, y)) continue;
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      let index: number;
      if (edge) index = C.ink;
      // lit, the whole wheel is in its colour between ink ends; at rest it is an ink ring
      else if (inWheel(x, y)) index = y === wheel.y0 || y === wheel.y1 ? C.ink : lit.includes('wheel') ? MOUSE_COLOURS.wheel : x === mid ? C.cream : C.ink;
      else if (y === split || (y < split && x === mid)) index = C.ink;
      else if (y < split) index = colour(x < mid ? 'left' : 'right');
      // the body, with a shade down its right side and along its foot
      else index = x >= width - 3 || y >= height - 3 ? C.dim : C.cream;
      b.pixels[y * width + x] = index;
    }
  }
  return b;
}

const MOUSE = { w: 15, h: 21 } as const;
/** The sign beside the mouse: the wheel turned up, the left button dragged. */
const WHEEL_UP = fromAscii(['..t..', '.ttt.', 'ttttt', '.....', '..t..', '.ttt.', 'ttttt'], { t: C.teal });
const DRAG = fromAscii(['..g..', '...g.', 'ggggg', '...g.', '..g..'], { g: C.gold });
/** The size of every gesture picture: the mouse and room for its sign. */
export const GESTURE_SIZE = { w: MOUSE.w + 2 + 5, h: MOUSE.h } as const;

const LIT: Readonly<Record<MouseGesture, readonly ('left' | 'wheel' | 'right')[]>> = { left: ['left'], middle: ['wheel'], right: ['right'], wheelUp: ['wheel'], drag: ['left'] };

/** The small mouse with what is pressed lit, and the wheel's or the drag's sign beside it. */
export function gesturePicture(gesture: MouseGesture): Bitmap {
  const b = createBitmap(GESTURE_SIZE.w, GESTURE_SIZE.h);
  blit(b, mousePicture(MOUSE.w, MOUSE.h, LIT[gesture]), 0, 0);
  if (gesture === 'wheelUp') blit(b, WHEEL_UP, MOUSE.w + 2, 0);
  if (gesture === 'drag') blit(b, DRAG, MOUSE.w + 2, MOUSE.h - DRAG.height - 2);
  return b;
}

/** The arrow from the staff before to the staff after. */
export const HELP_ARROW = fromAscii(['...w..', '...ww.', 'wwwwww', '...ww.', '...w..'], { w: C.white });

/** A sketched staff: two bars, five lines a place apart. */
export const SKETCH_SIZE = { w: 32, h: 21 } as const;
const LINE_Y = (place: number) => 18 - 2 * place;
const BAR_X = [9, 24] as const;
const POINTER = fromAscii(['k...', 'kk..', 'kwk.', 'kwwk', 'kkk.', '..kk'], { k: C.ink, w: C.white });

/** The staff before or after a press: its lines and barlines on parchment, its notes (a lit one blue), the pointer, the lasso's box. */
export function staffSketch(sketch: StaffSketch): Bitmap {
  const { w, h } = SKETCH_SIZE;
  const b = createBitmap(w, h);
  const put = (x: number, y: number, index: number) => {
    if (x >= 0 && y >= 0 && x < w && y < h) b.pixels[y * w + x] = index;
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) put(x, y, C.cream);
  for (let place = 0; place <= 8; place += 2) for (let x = 1; x < w - 1; x++) put(x, LINE_Y(place), C.brownLight);
  for (const x of [1, 16, w - 2]) for (let y = LINE_Y(8); y <= LINE_Y(0); y++) put(x, y, C.brownLight);
  if (sketch.boxed) {
    for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) if (x === 0 || y === 0 || x === w - 1 || y === h - 1) put(x, y, C.blue);
  }
  for (const note of sketch.notes) {
    const ink = note.lit || sketch.boxed ? C.blue : C.ink;
    const cx = BAR_X[note.bar], y = LINE_Y(note.place);
    for (let dx = -1; dx <= 1; dx++) put(cx + dx, y - 1, ink);
    for (let dx = -1; dx <= 1; dx++) put(cx + dx, y + 1, ink);
    put(cx - 2, y, ink);
    put(cx + 2, y, ink);
    for (let dx = -1; dx <= 1; dx++) put(cx + dx, y, note.length === 'half' ? C.cream : ink);
    for (let sy = y - 8; sy < y; sy++) put(cx + 2, sy, ink);
  }
  // the pointer's tip just below and right of the place, so a note there still shows
  if (sketch.pointer) blit(b, POINTER, BAR_X[sketch.pointer.bar] + 2, LINE_Y(sketch.pointer.place) + 2);
  return b;
}

/** A key cap as wide as `width` (its word is written on it by the scene): cream with the ink outline and a shade at its foot. */
export function keyCap(width: number, height: number): Bitmap {
  const b = createBitmap(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const corner = (x === 0 || x === width - 1) && (y === 0 || y === height - 1);
      if (corner) continue;
      const edge = x === 0 || x === width - 1 || y === 0 || y === height - 1;
      b.pixels[y * width + x] = edge ? C.ink : y >= height - 3 ? C.dim : C.cream;
    }
  }
  return b;
}
