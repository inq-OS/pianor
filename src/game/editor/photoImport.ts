/**
 * The piece maker's photo import (ft_Y_04 slice 4): the requests to the game's own server on the computer
 * (`tools/vite-photo.ts`), which reads a photo of a sheet with Audiveris, and the cleaned photo laid behind the staff,
 * bar by bar (`photoPatches`), in a page layer over the canvas that clicks pass through. The photo's ink is drawn in
 * the cursor colour, half see-through, so the piece's own notes stay black and a missing one shows as a coloured head.
 */
import { photoBarCount, photoPatches, type PhotoLayout } from '../../core/editor/photoOverlay';
import type { EditorHand } from '../../core/editor/model';
import type { StaffLayout } from '../../core/layout/staffTypes';
import type { ImportProblem } from '../../core/editor/fromChart';

export const PHOTO_API = '/__pianor/photo';

/** The answer to a photo sent: the own piece file and what to fill by hand, or why there is none. */
export type PhotoReply = { ok: true; id: string; file: string; problems: ImportProblem[]; stavesUneven?: boolean } | { ok: false; reason: string };

/** Whether the server here reads photos (the game's server on a PC with Audiveris), or why not. */
export async function photoServer(fetcher: typeof fetch = fetch): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const res = await fetcher(PHOTO_API);
    if (!res.ok) return { ok: false, reason: `the server answered ${res.status}` };
    return (await res.json()) as { ok: true } | { ok: false; reason: string };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

/** Sends a photo to be read; about a minute a page. */
export async function sendPhoto(name: string, bytes: Uint8Array, title?: string, fetcher: typeof fetch = fetch): Promise<PhotoReply> {
  try {
    const query = `name=${encodeURIComponent(name)}${title ? `&title=${encodeURIComponent(title)}` : ''}`;
    const res = await fetcher(`${PHOTO_API}?${query}`, { method: 'POST', body: new Blob([bytes as BlobPart]) });
    if (!res.ok) return { ok: false, reason: `the server answered ${res.status}` };
    return (await res.json()) as PhotoReply;
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

/** The bar map of an own piece's photo, or null when it has none. */
export async function photoMap(id: string, fetcher: typeof fetch = fetch): Promise<{ image: string; layout: PhotoLayout } | null> {
  try {
    const res = await fetcher(`${PHOTO_API}/${encodeURIComponent(id)}/map`);
    if (!res.ok) return null;
    const map = (await res.json()) as { image?: unknown; layout?: PhotoLayout };
    return map.layout && Array.isArray(map.layout.systems) ? { image: `${PHOTO_API}/${encodeURIComponent(id)}/image`, layout: map.layout } : null;
  } catch {
    return null;
  }
}

/** The bars of the report, one each, in order: what the message after an import names. */
export function barsToFill(problems: readonly ImportProblem[]): number[] {
  return [...new Set(problems.map((p) => p.bar))].sort((a, b) => a - b);
}

/** The cleaned photo's ink as a see-through picture in one colour: paper becomes clear, ink `rgb` at up to `alpha`. */
function tint(image: HTMLImageElement, rgb: number, alpha: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const g = canvas.getContext('2d');
  if (!g) return canvas;
  g.drawImage(image, 0, 0);
  const data = g.getImageData(0, 0, canvas.width, canvas.height);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const ink = 255 - (px[i] ?? 255);
    px[i] = (rgb >> 16) & 255;
    px[i + 1] = (rgb >> 8) & 255;
    px[i + 2] = rgb & 255;
    px[i + 3] = Math.round(ink * alpha);
  }
  g.putImageData(data, 0, 0);
  return canvas;
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

/** The photo behind the staff: a page canvas laid exactly over the game's canvas, which clicks pass through. */
export class PhotoOverlay {
  shift = 0;
  shown = true;
  private readonly canvas: HTMLCanvasElement;
  private constructor(private readonly ink: HTMLCanvasElement, readonly layout: PhotoLayout) {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'editor-photo';
    this.canvas.style.cssText = 'position:absolute;pointer-events:none;z-index:4';
    document.body.append(this.canvas);
  }

  /** The photo of an own piece, or null when it has none (or no server keeps photos here). */
  static async load(id: string, colour: number): Promise<PhotoOverlay | null> {
    const map = await photoMap(id);
    if (!map) return null;
    const image = await loadImage(map.image);
    return image ? new PhotoOverlay(tint(image, colour, 0.55), map.layout) : null;
  }

  /** How many bars the photo has (the shift stays within them). */
  get bars(): number {
    return photoBarCount(this.layout);
  }

  /**
   * Draws the photo's bars behind the bars of `page`: `staff` is the staff's layout, `origin` where it is drawn in the
   * scene, `gameCanvas` and `gameWidth` turn scene units into page pixels.
   */
  draw(staff: StaffLayout, options: { page: number; hand?: EditorHand; origin: { x: number; y: number }; gameCanvas: HTMLCanvasElement; gameWidth: number }): void {
    const rect = options.gameCanvas.getBoundingClientRect();
    const zoom = rect.width / options.gameWidth;
    const ratio = window.devicePixelRatio || 1;
    Object.assign(this.canvas.style, { left: `${rect.left + window.scrollX}px`, top: `${rect.top + window.scrollY}px`, width: `${rect.width}px`, height: `${rect.height}px`, display: this.shown ? 'block' : 'none' });
    this.canvas.width = Math.round(rect.width * ratio);
    this.canvas.height = Math.round(rect.height * ratio);
    const g = this.canvas.getContext('2d');
    if (!g || !this.shown) return;
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const k = zoom * ratio;
    for (const p of photoPatches(staff, this.layout, { page: options.page, shift: this.shift, ...(options.hand ? { hand: options.hand } : {}) })) {
      g.drawImage(this.ink, p.sx, p.sy, p.sw, p.sh, (options.origin.x + p.dx) * k, (options.origin.y + p.dy) * k, p.dw * k, p.dh * k);
    }
  }

  /** Shows or hides it (a screen over the piece maker hides it, the G key toggles it). */
  setVisible(on: boolean): void {
    this.canvas.style.display = on && this.shown ? 'block' : 'none';
  }

  destroy(): void {
    this.canvas.remove();
  }
}
