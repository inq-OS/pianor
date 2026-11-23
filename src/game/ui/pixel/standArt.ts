import { createBitmap, type Bitmap } from './bitmap';
import { C } from './palette';

/**
 * The pictures of the stand's panel (ft_1_08.AC11), one per trainer, drawn here at their own size (64 x 48 fine pixels)
 * in the manner of the 1997 game's inventory items (the 1997 game has many good examples; `projects/painter/vocabulary/mi3.md`): a fat thing, a dozen colours, a rim in its own colour gone dark and
 * never black, one glint at the upper left, a checker only on glass. Drawn from shapes, not from a pack: no free pack
 * has an ear or a sight at this size (use-free-art-packs). The first sketches were approved.
 */

export const STAND_ART = { w: 64, h: 48 } as const;

type Pen = (x: number, y: number, colour: number) => void;

function canvas(): { bitmap: Bitmap & { pixels: Uint8Array }; at: (x: number, y: number) => number; pen: Pen } {
  const bitmap = createBitmap(STAND_ART.w, STAND_ART.h);
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < STAND_ART.w && y < STAND_ART.h;
  return {
    bitmap,
    at: (x, y) => (inside(x, y) ? bitmap.pixels[y * STAND_ART.w + x]! : C.clear),
    pen: (x, y, colour) => {
      if (inside(x, y)) bitmap.pixels[Math.floor(y) * STAND_ART.w + Math.floor(x)] = colour;
    },
  };
}

const within = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;

/** Every pixel on the edge of what is drawn takes the dark of its own colour (`dark`), so the thing has a rim and no black line. */
function rimmed(bitmap: Bitmap & { pixels: Uint8Array }, dark: (colour: number) => number): Bitmap {
  const { w, h } = STAND_ART;
  const src = bitmap.pixels.slice();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = src[y * w + x]!;
    if (c === C.clear) continue;
    const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
      const xx = x + dx!, yy = y + dy!;
      return xx < 0 || yy < 0 || xx >= w || yy >= h || src[yy * w + xx] === C.clear;
    });
    if (edge) bitmap.pixels[y * w + x] = dark(c);
  }
  return bitmap;
}

/** How far each pixel of `inside` lies from its edge, in steps of one pixel (0 outside, 1 on the edge). */
function depthIn(inside: (x: number, y: number) => boolean): Float32Array {
  const { w, h } = STAND_ART;
  const depth = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!inside(x, y)) continue;
    let best = 9;
    for (let dy = -8; dy <= 8; dy++) for (let dx = -8; dx <= 8; dx++) {
      const d = Math.hypot(dx, dy);
      if (d < best && !inside(x + dx, y + dy)) best = d;
    }
    depth[y * w + x] = best;
  }
  return depth;
}

const EAR = { LIGHT: C.skin, MID: C.skinShade, SHADE: C.brownLight, DEEP: C.legDark, HOLE: C.brownDark } as const;

/** The ear's outline: a tall round top, narrowing to the lobe, its front (toward the sound) straighter. */
function inEar(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < 39 && y < STAND_ART.h && (within(x, y, 25, 18.5, 14.5, 17) || within(x, y, 23, 34, 9.5, 10.5));
}

/** The ear's skin at a point `d` pixels inside its edge: lit from the upper left; the rim rolls round its top and back, not its front. */
function earSkin(x: number, y: number, d: number): number {
  const t = (x - 25) / 13 + (y - 20) / 16;
  // the lobe: soft, one tone lighter at its front
  if (y >= 35) return x < 22 || t < 0.9 ? EAR.MID : EAR.SHADE;
  const onRim = !(x > 32 && y > 13);
  // the rolled rim: lit on its outside, a dark fold where it turns in
  if (onRim && d < 4.2) return t < 0.1 ? EAR.LIGHT : EAR.MID;
  if (onRim && d < 6) return EAR.DEEP;
  return t < -0.6 ? EAR.LIGHT : t < 0.5 ? EAR.MID : EAR.SHADE;
}

/** The sound running in from the right: three gold arcs, the nearest the palest, and an eighth note riding the outer one. */
function soundIn(bitmap: Bitmap & { pixels: Uint8Array }, pen: Pen): void {
  const arcs = [C.goldLight, C.gold, C.goldDark];
  [8, 13, 18].forEach((r, k) => {
    for (let a = -55; a <= 55; a += 2) {
      const x = Math.round(42 + r * Math.cos((a * Math.PI) / 180)), y = Math.round(26 + r * Math.sin((a * Math.PI) / 180));
      if (x <= 41) continue;
      pen(x, y, arcs[k]!);
      if (x + 1 < STAND_ART.w && bitmap.pixels[y * STAND_ART.w + x + 1] === C.clear) pen(x + 1, y, C.goldDark);
    }
  });
  for (let y = 7; y < 16; y++) for (let x = 51; x < 60; x++) if (within(x, y, 55, 12, 2.8, 2.1)) pen(x, y, C.ink);
  for (let y = 2; y < 12; y++) pen(57, y, C.ink);
  for (const [x, y] of [[58, 3], [59, 4], [60, 5], [60, 6], [59, 7]] as const) pen(x, y, C.ink);
  pen(54, 11, C.silver);
}

/**
 * The ear trainer (ft_1_10): a big ear, sharply listening, sound running into it in gold. Told from a bean by what an
 * ear has: a thick rim (the helix) that rolls round its top and back with a dark fold inside it, the rim's root curling
 * down into the bowl, a dark bowl with the hole, the little flap in front of the hole and a soft lobe below.
 */
export function listeningEar(): Bitmap {
  const { bitmap, pen } = canvas();
  const depth = depthIn(inEar);
  for (let y = 0; y < STAND_ART.h; y++) for (let x = 0; x < STAND_ART.w; x++) {
    const d = depth[y * STAND_ART.w + x]!;
    if (d > 0) pen(x, y, earSkin(x, y, d));
    // the bowl: dark, lower and toward the front, with the hole in it
    if (within(x, y, 29, 24, 6.5, 7)) pen(x, y, within(x, y, 31, 26, 2.8, 3.2) ? EAR.HOLE : x + y > 55 ? EAR.DEEP : EAR.SHADE);
  }
  // the rim's root: from the front of the top it curls down and in, over the bowl
  for (let a = -40; a <= 120; a += 3) {
    const x = 28 + 6 * Math.cos((a * Math.PI) / 180), y = 15 + 5.4 * Math.sin((a * Math.PI) / 180);
    for (let k = 0; k < 2; k++) pen(x + k, y, a < 40 ? EAR.LIGHT : EAR.MID);
  }
  // the flap in front of the hole
  for (let y = 22; y < 31; y++) for (let x = 33; x < 39; x++) if (within(x, y, 35.5, 26.5, 2.6, 3.6)) pen(x, y, x < 35 ? EAR.LIGHT : EAR.MID);
  const dark: Readonly<Record<number, number>> = { [EAR.LIGHT]: EAR.SHADE, [EAR.MID]: EAR.SHADE, [EAR.SHADE]: EAR.DEEP, [EAR.DEEP]: EAR.HOLE, [EAR.HOLE]: EAR.HOLE };
  rimmed(bitmap, (c) => dark[c] ?? EAR.HOLE);
  // one glint on the rim at the upper left
  for (const [x, y] of [[16, 9], [17, 8], [18, 7], [17, 9]] as const) pen(x, y, C.downLight);
  soundIn(bitmap, pen);
  return bitmap;
}

const SIGHT = { cx: 25.5, cy: 21.5, glass: 15.5, ring: 20 } as const;

/** The spyglass's barrel behind its eyepiece, off to the lower right: leather with brass bands, wider toward the ring. */
function barrel(x: number, y: number): number | null {
  const u = (x - SIGHT.cx + (y - SIGHT.cy)) / Math.SQRT2, v = (-(x - SIGHT.cx) + (y - SIGHT.cy)) / Math.SQRT2;
  const half = 11 - (u - 10) * 0.12;
  if (u < 10 || u > 40 || Math.abs(v) > half) return null;
  const band = (u > 24 && u < 27) || u > 37;
  const lit = v < -half * 0.35;
  if (band) return lit ? C.goldLight : C.gold;
  return lit ? C.brownLight : v > half * 0.5 ? C.brownDark : C.brown;
}

/** The eyepiece: pale glass in three flat tones from the upper left (a checker only where two meet) in a brass ring. */
function eyepiece(x: number, y: number): number | null {
  const { cx, cy, glass, ring } = SIGHT;
  const r = Math.hypot(x - cx, y - cy);
  if (r < glass) {
    const d = x - cx + (y - cy), checker = (x + 2 * y) % 5 === 0;
    const k = d < -8 || (checker && d < -3) ? 0 : d < 9 || (checker && d < 13) ? 1 : 2;
    return [C.downLight, C.down, C.downShade][k]!;
  }
  if (r >= ring) return null;
  const lit = Math.cos(Math.atan2(y - cy, x - cx) + (135 * Math.PI) / 180);
  const band = (r - glass) / (ring - glass);
  if (lit > 0.6 && band > 0.3 && band < 0.75) return C.goldLight;
  return lit > -0.25 ? C.gold : lit > -0.8 ? C.goldDark : C.brown;
}

/** On the glass: five staff lines, red cross hairs stopping short of the note, and the note, a fat tilted head with its stem and flag. */
function staffInSight(pen: Pen): void {
  const { cx, cy, glass, ring } = SIGHT;
  const mx = Math.floor(cx), my = Math.floor(cy);
  for (const ly of [-8, -4, 0, 4, 8]) for (let x = 0; x < STAND_ART.w; x++) if (Math.abs(x - cx) < glass - 1 && Math.hypot(x - cx, ly) < glass - 1) pen(x, my + ly, C.ink);
  for (let d = -ring - 1; d <= ring + 1; d++) {
    if (Math.abs(d) < 8) continue;
    pen(Math.floor(cx + d + 0.5), my + 1, C.red);
    pen(mx + 1, Math.floor(cy + d), C.red);
  }
  const cos = Math.cos(0.4), sin = Math.sin(0.4);
  for (let y = my - 5; y <= my + 5; y++) for (let x = mx - 6; x <= mx + 6; x++) {
    const u = x - cx, v = y - cy;
    if (((u * cos + v * sin) / 4.4) ** 2 + ((-u * sin + v * cos) / 3.1) ** 2 <= 1) pen(x, y, C.ink);
  }
  for (let y = my - 12; y < my; y++) { pen(mx + 3, y, C.ink); pen(mx + 4, y, C.ink); }
  for (const [dx, dy] of [[5, -12], [6, -11], [7, -10], [7, -9], [8, -8], [8, -7], [7, -6]] as const) pen(mx + dx, my + dy, C.ink);
}

/**
 * The note-name trainer (ft_0_17): a note on a staff of five lines, seen through the eyepiece of a brass spyglass whose
 * barrel runs off to the lower right, with red cross hairs on the note. The five lines and the flag make it a note,
 * the barrel makes the ring a spyglass and not a clock's face.
 */
export function noteInSight(): Bitmap {
  const { bitmap, pen } = canvas();
  for (let y = 0; y < STAND_ART.h; y++) for (let x = 0; x < STAND_ART.w; x++) {
    const c = eyepiece(x, y) ?? barrel(x, y);
    if (c !== null) pen(x, y, c);
  }
  staffInSight(pen);
  const dark: Readonly<Record<number, number>> = {
    [C.down]: C.downShade, [C.downLight]: C.downShade, [C.downShade]: C.silverDark, [C.goldLight]: C.goldDark, [C.gold]: C.brown,
    [C.goldDark]: C.brownDark, [C.brown]: C.brownDark, [C.brownLight]: C.brownDark, [C.brownDark]: C.brownDark, [C.red]: C.redDark, [C.ink]: C.ink,
  };
  rimmed(bitmap, (c) => dark[c] ?? C.ink);
  // a glint on the glass at the upper left, and on the note's head
  const { cx, cy } = SIGHT;
  for (let a = 200; a < 250; a += 4) pen(Math.floor(cx + 12 * Math.cos((a * Math.PI) / 180)), Math.floor(cy + 12 * Math.sin((a * Math.PI) / 180)), C.white);
  pen(Math.floor(cx) - 2, Math.floor(cy) - 1, C.silver);
  return bitmap;
}

/**
 * The scales and chords trainer (ft_1_29): three wooden steps going up to the right with a black note on each, a scale
 * climbing. AX-3 provisional: a first sketch from shapes so the trainer can be reached; the painter draws the real one
 * (the TODO in the feature file).
 */
export function scaleSteps(): Bitmap {
  const { bitmap, pen } = canvas();
  const STEP_W = 20, RISE = 12, FLOOR = 46;
  for (let x = 2; x < 62; x++) {
    const step = Math.min(2, Math.floor((x - 2) / STEP_W));
    const top = FLOOR - RISE * (step + 1);
    for (let y = top; y < FLOOR; y++) pen(x, y, y < top + 3 ? C.goldLight : C.gold);
  }
  for (let step = 0; step < 3; step++) {
    const cx = 2 + step * STEP_W + 9, cy = FLOOR - RISE * (step + 1) - 4;
    for (let y = cy - 3; y <= cy + 3; y++) for (let x = cx - 5; x <= cx + 5; x++) if (within(x, y, cx, cy, 4.5, 3)) pen(x, y, C.ink);
    for (let y = cy - 14; y <= cy; y++) { pen(cx + 4, y, C.ink); pen(cx + 3, y, C.ink); }
  }
  rimmed(bitmap, (c) => (c === C.goldLight ? C.goldDark : c === C.gold ? C.brown : C.brownDark));
  // a glint on each head
  for (let step = 0; step < 3; step++) pen(2 + step * STEP_W + 7, FLOOR - RISE * (step + 1) - 6, C.silver);
  return bitmap;
}
