import { createBitmap, type Bitmap } from '../bitmap';
import { cropTogether, type Overlay } from '../pack';

/**
 * Live water (some pixels should be dynamic and generated at random): the parts of a
 * sea that move are not painted into the picture's looks, which the game can only step or dissolve between, but
 * recorded as a field of the pixels that may light and in what colour. The game lights them while it runs
 * (`liveWater.ts`): a wave stroke is born, stretches, slides with the wind and goes; a glint flashes on its own beat;
 * the pale bands round a post slide outward a pixel at a time; the surf comes and goes along the shore. Nothing then
 * changes all at once, and nothing repeats.
 *
 * The painter records while it paints its first look (`on`) and paints none of these in any look; at the end
 * `seal` keeps only the pixels that still show the water they were recorded on (whatever was painted over them later,
 * a leg, a boulder, the quay, hides them).
 */

/** The field's layers, in this order in `LiveWater.layers.frames`. */
export const LIVE = {
  /** A wave stroke's colour at a pixel of a stroke row: a step lighter than the water under it. */
  up: 0,
  /** In the dark far band, a step darker (a far stroke goes either way); 0 in the body, where strokes only go lighter. */
  down: 1,
  /** A glint's colour. */
  glint: 2,
  /** The glint's own beat, 1 to 255 (pixels of one glint share it). */
  glintBeat: 3,
  /** Where a pale band round a thing lies at a pixel: its place along the band's run, 1 to 255. */
  ringAt: 4,
  /** How wide the band is there, as a share of the run, 1 to 255. */
  ringWide: 5,
  /** The band's core and rim colours. */
  ringCore: 6,
  ringRim: 7,
  /** The surf: `SURF_EDGE` on a column's water edge, `SURF_OPEN` where its foam may lie. */
  surf: 8,
  /** Under a stroke's pixel, the darker line some seas draw beneath their strokes (the knoll's): its colour, on the row below. */
  shade: 9,
} as const;
export const LIVE_LAYERS = 10;
export const SURF_OPEN = 1;
export const SURF_EDGE = 2;
/** A column's edge where something stands over the water's edge: the column keeps its place, but no foam lies there. */
export const SURF_HIDDEN = 3;
/** How many rows above its edge the surf may reach. */
export const SURF_REACH = 9;

export interface LiveWater {
  /** The layers (`LIVE`), cut to one box in the picture's fine pixels. */
  layers: Overlay;
  /** The horizon's row in the picture. */
  horizon: number;
  /** The way the water drifts: 1 to the right, -1 to the left. */
  way: 1 | -1;
  /** The foam's white, for whitecaps and the surf. */
  foam: number;
  /** How thick the strokes lie, 1 for the kit's sea; a sea painted with denser strokes (the knoll's) more. */
  cover: number;
}

/** The pixels the painter has put so far in the look it paints, by index, to see what a live pixel lies on. */
type Pixels = { readonly [i: number]: number };

export class LiveRecorder {
  /** True while the first look is painted: only then is anything recorded. */
  on = false;
  private readonly layers: Uint8Array[];
  /** What lay at each recorded pixel when it was recorded, to see at the end whether something was painted over it. */
  private readonly under = new Map<number, number>();

  constructor(private readonly w: number, private readonly h: number, private readonly pixels: () => Pixels, private readonly horizon: number, private readonly way: 1 | -1, private readonly foam: number, private readonly cover = 1) {
    this.layers = Array.from({ length: LIVE_LAYERS }, () => new Uint8Array(w * h));
  }

  private at(x: number, y: number): number {
    const px = Math.round(x), py = Math.round(y);
    if (!this.on || px < 0 || py < 0 || px >= this.w || py >= this.h) return -1;
    const i = py * this.w + px;
    if (!this.under.has(i)) this.under.set(i, this.pixels()[i] ?? 0);
    return i;
  }

  /**
   * A pixel of a stroke row: lit a step lighter (`up`) and, in the far band, a step darker too (`down`, 0 for none);
   * `shade` is the colour of a darker line on the row below while a stroke lies over the pixel (0 for none).
   */
  stroke(x: number, y: number, up: number, down = 0, shade = 0): void {
    const i = this.at(x, y);
    if (i < 0) return;
    this.layers[LIVE.up]![i] = up;
    this.layers[LIVE.down]![i] = down;
    if (!shade) return;
    const j = this.at(x, y + 1);
    if (j >= 0) this.layers[LIVE.shade]![j] = shade;
  }

  /** A glint's pixel: its colour and its beat (0 to 1; the pixels of one glint share it). */
  glint(x: number, y: number, colour: number, beat: number): void {
    const i = this.at(x, y);
    if (i < 0) return;
    this.layers[LIVE.glint]![i] = colour;
    this.layers[LIVE.glintBeat]![i] = 1 + Math.min(254, Math.floor(beat * 255));
  }

  /** A pixel a pale band may cross: its place along the band's run (0 to 1), the band's width (0 to 1), its core and rim. */
  ring(x: number, y: number, at: number, wide: number, core: number, rim: number): void {
    const i = this.at(x, y);
    if (i < 0) return;
    this.layers[LIVE.ringAt]![i] = 1 + Math.min(254, Math.floor((at - Math.floor(at)) * 255));
    this.layers[LIVE.ringWide]![i] = 1 + Math.min(254, Math.floor(wide * 255));
    this.layers[LIVE.ringCore]![i] = core;
    this.layers[LIVE.ringRim]![i] = rim;
  }

  /** The surf of column `x`, its water's edge at row `edge`: the foam may lie from there up to `SURF_REACH` rows out. */
  surf(x: number, edge: number): void {
    for (let k = 0; k <= SURF_REACH; k++) {
      const i = this.at(x, edge - k);
      if (i >= 0) this.layers[LIVE.surf]![i] = k === 0 ? SURF_EDGE : SURF_OPEN;
    }
  }

  /**
   * Takes what lies under every recorded pixel now as what it lies on: for a painter that reworks its water after
   * recording (the harbour smooths its dither), so the reworked water does not count as painted over.
   */
  settle(): void {
    const pixels = this.pixels();
    for (const i of this.under.keys()) this.under.set(i, pixels[i] ?? 0);
  }

  /**
   * The field, with every pixel dropped that `final` (the first look as painted) no longer shows as it was recorded on,
   * or that `hidden` says something was painted over afterwards (for a painter that grains its water before the last thing).
   */
  seal(final: Bitmap, hidden: (i: number) => boolean = () => false): LiveWater {
    const surf = this.layers[LIVE.surf]!;
    for (const [i, was] of this.under) {
      if (final.pixels[i] === was && !hidden(i)) continue;
      const edge = surf[i] === SURF_EDGE;
      for (const layer of this.layers) layer[i] = 0;
      if (edge) surf[i] = SURF_HIDDEN;
    }
    const frames = this.layers.map((pixels) => ({ ...createBitmap(this.w, this.h), pixels }));
    return { layers: cropTogether(frames), horizon: this.horizon, way: this.way, foam: this.foam, cover: this.cover };
  }
}
