export interface PixelView {
  /** Whole screen pixels per art pixel. */
  scale: number;
  /** The screen in art pixels, rounded up so art covers every screen pixel. */
  width: number;
  height: number;
}

export interface PixelViewOptions {
  /** The smallest layout area in art pixels. Default 320 x 180 (a classic 16:9 pixel-art screen). */
  minWidth?: number;
  minHeight?: number;
  /** The largest zoom. Default 8. */
  maxScale?: number;
}

/**
 * How big one art pixel is on this screen. Pixel art stays crisp only at whole-number zoom, so the zoom is the largest
 * whole number that still leaves room for the smallest layout area: 4x on a 1366x768 laptop, 3x at 1024x600.
 */
export function pixelView(screenWidth: number, screenHeight: number, options: PixelViewOptions = {}): PixelView {
  const { minWidth = 320, minHeight = 180, maxScale = 8 } = options;
  const fit = Math.floor(Math.min(screenWidth / minWidth, screenHeight / minHeight));
  const scale = Math.max(1, Math.min(maxScale, Number.isFinite(fit) ? fit : 1));
  return { scale, width: Math.ceil(screenWidth / scale), height: Math.ceil(screenHeight / scale) };
}
