import { createBitmap, type Bitmap } from '../bitmap';
import { cropTogether, type Overlay } from '../pack';

/**
 * The motion every painted place shares, as Keri's palette is shared (generalize it as was done with colors, so that no scene
 * implements its own dynamics). A picture
 * that moves is painted in a loop of looks (a few-frame loop, as the painted adventure games moved their water and
 * grass); in each look the painter asks here how the wind bends a blade, where the sea's strokes have rocked to and
 * which glints are lit. The clouds are lifted out of the sky to drift over it in the game (`SkyMask`); the smoke is its
 * own loop (`smoke.ts`). The game steps the looks and moves the clouds at the pace of the one wind
 * (`../windMotion.ts`, ft_1_14.AC9). Pure: no Phaser, no DOM.
 */

const TAU = Math.PI * 2;

/**
 * Whether the ground moves with the wind: the grass, the stems, the bushes and the canes. Still for now (the plants
 * swung too far and the steps were choppy: the ground keeps still while the sky and the sea move, until it is worked out). The sea, its glints and foam, the clouds, the gulls (flown by the game, `flock.ts`) and the flags still move.
 */
export const GROUND_MOVES = false;

/** The look the ground is painted in: the look itself while the ground moves, else always the loop's first. */
export function groundLook(look: number): number {
  return GROUND_MOVES ? look : 0;
}

/** Which way the wind blows in a view: -1 to the viewer's left, 1 to the right. */
export type WindWay = -1 | 1;

/** Where look `look` of `looks` lies in the loop, 0 to under 1. */
export function beat(look: number, looks: number): number {
  return look / looks;
}

/** A value that goes once round a sine in the loop, `at` (0 to 1) later than the loop's start: the sea's rocking, the surf's breathing. */
export function swing(look: number, looks: number, at = 0): number {
  return Math.sin(TAU * (beat(look, looks) + at));
}

/**
 * How strong the wind is at (`x`, `y`) in a look, 0 in the lull to 1 in the gust: gusts `span` pixels apart run the
 * wind's way over the picture, once along their span in the loop, and a little slower further back (`y` up).
 */
export function gust(x: number, y: number, look: number, looks: number, way: WindWay, span = 300): number {
  const s = 0.5 + 0.5 * Math.sin(TAU * (beat(look, looks) - (way * x) / span - y / (span * 1.75)));
  return s * s;
}

/**
 * How a blade, a stalk or a branch leans at (`x`, `y`) in a look, as a share of its height, the wind's way: `still` in the
 * lull, `still + gusty` in the gust. The ground stands as in the first look while it does not move (`GROUND_MOVES`).
 */
export function lean(x: number, y: number, look: number, looks: number, way: WindWay, still = 0.17, gusty = 0.3): number {
  return way * (still + gusty * gust(x, y, groundLook(look), looks, way));
}

/** Whether a glint with its own `seed` (0 to 1) shows in a look: each is lit for the share `on` of its turn, twice round in a loop. */
export function twinkle(seed: number, look: number, looks: number, on = 0.45): boolean {
  return (seed + 2 * beat(look, looks)) % 1 < on;
}

/**
 * Remembers, for a picture being painted, where the bare sky was the last thing put: the painter marks while it paints
 * its sky (`sky = true`) and stops before its clouds and everything after. What stands before the sky (stems, gulls,
 * a mast) is then lifted out of each look as the layer the game lays over the drifting clouds.
 */
export class SkyMask {
  /** True while the painter paints the bare sky. */
  sky = false;
  private marks: Uint8Array;

  constructor(private readonly w: number, private readonly h: number) {
    this.marks = new Uint8Array(w * h);
  }

  /** A new look begins: nothing marked. */
  reset(): void {
    this.marks = new Uint8Array(this.w * this.h);
    this.sky = false;
  }

  /** The pixel `i` was just painted. */
  put(i: number): void {
    this.marks[i] = this.sky ? 1 : 0;
  }

  /** This look's marks, 1 where the bare sky was the last thing put: for a still part to keep and lay again (`StillPart`). */
  get marked(): Uint8Array {
    return this.marks;
  }

  /** Of a look's pixels, those in the top `rows` rows that are not bare sky; clear elsewhere. */
  fore(look: Bitmap, rows: number): Bitmap {
    const out = createBitmap(this.w, this.h);
    for (let i = 0; i < this.w * Math.min(rows, this.h); i++) if (!this.marks[i]) out.pixels[i] = look.pixels[i]!;
    return out;
  }
}

/**
 * Paints `looks` looks with `paint`, which marks `mask` as it paints, and lifts out of each what stands before the sky in
 * its top `rows` rows (the rows the clouds reach): the looks, and that layer cut to one box. A picture in which nothing
 * moves (all its looks alike, as where only the ground would move while it stands still) keeps one look: the others would
 * only take memory.
 */
export function paintLooks(looks: number, mask: SkyMask, rows: number, paint: (look: number) => Bitmap): { frames: Bitmap[]; fore: Overlay } {
  const fore: Bitmap[] = [];
  const frames = Array.from({ length: looks }, (_, look) => {
    mask.reset();
    const bitmap = paint(look);
    fore.push(mask.fore(bitmap, rows));
    return bitmap;
  });
  const first = frames[0]!.pixels;
  const still = frames.every((frame) => frame.pixels.every((p, i) => p === first[i]));
  return still ? { frames: frames.slice(0, 1), fore: cropTogether(fore.slice(0, 1)) } : { frames, fore: cropTogether(fore) };
}

let stillOnce = true;

/**
 * Whether a still part is painted once and laid again in the later looks (the default), or painted afresh in each
 * look. Only a test turns it off, to hold the pictures painted once to the same pictures painted look by look.
 */
export function paintStillOnce(on: boolean): void {
  stillOnce = on;
}

/** A per-pixel array a painter keeps for a look: its pixels, the sky's marks, which thing stands where. */
type Channel = { [i: number]: number; readonly length: number };

/**
 * A part of a picture that is the same in every look while the ground stands still (`GROUND_MOVES`): the hill, the
 * stones, the bushes, everything but the sky and the sea. Painting it in every look was most of a picture's time (the
 * build's and the tests'), so it is painted in the first look, and in each later one the pixels it put are
 * laid again as it left them. The painter's `put` calls `touch` for each pixel; `channels` gives the per-pixel arrays of
 * the look being painted (the pixels first), whose values at those pixels are kept and laid again.
 *
 * Only for a part whose pixels do not depend on what moves under it or on what is painted before it in that look
 * (`pictureRules.test.ts` holds every picture painted so to the same picture painted look by look).
 */
export class StillPart {
  private touched: Uint8Array | null = null;
  private at: Int32Array | null = null;
  private kept: Float64Array[] = [];

  constructor(private readonly size: number) {}

  /** Whether the next `paint` lays the part again instead of painting it: what the painter kept of it then stays as it was. */
  get laid(): boolean {
    return stillOnce && !GROUND_MOVES && this.at !== null;
  }

  /** The pixel `i` was just put. */
  touch(i: number): void {
    if (this.touched) this.touched[i] = 1;
  }

  /** Paints the part with `paint` (the first time, or every time when it moves), or lays it again. */
  paint(channels: () => readonly Channel[], paint: () => void): void {
    const once = stillOnce && !GROUND_MOVES;
    if (this.laid && this.at) {
      const at = this.at, now = channels();
      now.forEach((channel, c) => {
        const kept = this.kept[c]!;
        for (let k = 0; k < at.length; k++) channel[at[k]!] = kept[k]!;
      });
      return;
    }
    if (!once) {
      paint();
      return;
    }
    const touched = (this.touched = new Uint8Array(this.size));
    paint();
    this.touched = null;
    let n = 0;
    for (let i = 0; i < touched.length; i++) n += touched[i]!;
    const at = new Int32Array(n);
    for (let i = 0, k = 0; i < touched.length; i++) if (touched[i]) at[k++] = i;
    this.kept = channels().map((channel) => Float64Array.from(at, (i) => channel[i]!));
    this.at = at;
  }
}

