import { ART_CANVAS, MAX_FINE_ZOOM } from './frame';
import { MAX_STAFF_SPACE, MIN_STAFF_SPACE } from './staff';

export interface CanvasSize {
  /** The canvas in physical screen pixels: the game's own width and height. */
  width: number;
  height: number;
  /** CSS pixels per canvas pixel, so the canvas covers its CSS size exactly (Phaser's `zoom`). */
  zoom: number;
  /**
   * Where the canvas's left and top edges go, in physical pixels from the page's: 0, or negative when the canvas is wider or
   * higher than the page and its edges are trimmed, centred (`TRIM_FINE`).
   */
  offsetX: number;
  offsetY: number;
}

/**
 * Fine art pixels the page may be short of a zoom on each axis, trimmed half on each side, before the game falls to the next
 * zoom (d110). On a 1920x1080 screen, Chrome's F11 full screen gives the page 1910 x 1070 of it:
 * without this the game drops from 3x to 2x in a wide border, the notes a third smaller (AX-0). Four fine pixels is two a
 * side, at most one layout cell, inside the 4-cell margin the frame keeps at its edges.
 */
export const TRIM_FINE = 4;

/**
 * How big to make the game canvas. Under Windows display scaling (125% or 150% on a 14-inch FHD laptop) the page has
 * fewer CSS pixels than the screen has pixels; a canvas the size of the page would be stretched by the browser, so the staff
 * goes soft and pixel art gets uneven pixels. The canvas is drawn in physical pixels instead, and the whole-number zoom
 * (`frameView`) is then chosen from those. A page a few pixels short of a zoom gets a canvas of the full size, its edges
 * trimmed (`TRIM_FINE`).
 */
export function canvasSize(cssWidth: number, cssHeight: number, devicePixelRatio: number): CanvasSize {
  const ratio = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  const pageWidth = Math.max(1, Math.round(cssWidth * ratio));
  const pageHeight = Math.max(1, Math.round(cssHeight * ratio));
  // the largest fine zoom the page holds once its edges may be trimmed; a page too small even for 1x is left as it is
  let fine = MAX_FINE_ZOOM;
  while (fine > 0 && (pageWidth < (ART_CANVAS.width - TRIM_FINE) * fine || pageHeight < (ART_CANVAS.height - TRIM_FINE) * fine)) fine--;
  const width = Math.max(pageWidth, ART_CANVAS.width * fine);
  const height = Math.max(pageHeight, ART_CANVAS.height * fine);
  return { width, height, zoom: 1 / ratio, offsetX: Math.floor((pageWidth - width) / 2), offsetY: Math.floor((pageHeight - height) / 2) };
}

/**
 * The staff space range for a canvas at `zoom` (CSS pixels per canvas pixel, `CanvasSize.zoom`). The range counts CSS
 * pixels, so at 125% scaling the staff is as big on the screen as before the canvas was drawn in physical pixels:
 * smaller notes would be harder for the student to read (AX-0).
 */
export function staffSpaceLimits(zoom: number): { minStaffSpace: number; maxStaffSpace: number } {
  const ratio = Number.isFinite(zoom) && zoom > 0 ? 1 / zoom : 1;
  return { minStaffSpace: MIN_STAFF_SPACE * ratio, maxStaffSpace: MAX_STAFF_SPACE * ratio };
}

