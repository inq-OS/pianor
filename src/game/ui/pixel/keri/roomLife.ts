import { blit, createBitmap, fromAscii, scale2x, type Bitmap } from '../bitmap';
import { kiurAsleep, kiurWoken } from '../kiur/kiurFrames';
import { C } from '../palette';
import { RANK_COUNT, rankBadge } from '../rankArt';
import type { RoomArt } from './roomPicture';

/**
 * The sprites laid into the painted warden's room (ft_1_18.AC3, `roomPicture.ts`): the portrait over the piano, Kiur asleep
 * on the bed, the mug of tea and its steam, the metronome and the note plant. Original art in the game's own palette,
 * drawn here pixel by pixel on the layout cells; `roomArt` brings each onto the fine grid. Kiur is on the
 * fine grid already (his model, d114).
 */

type Canvas = ReturnType<typeof createBitmap>;

function fill(b: Canvas, x: number, y: number, w: number, h: number, c: number): void {
  for (let yy = Math.max(0, y); yy < Math.min(b.height, y + h); yy++) for (let xx = Math.max(0, x); xx < Math.min(b.width, x + w); xx++) b.pixels[yy * b.width + xx] = c;
}

function px(b: Canvas, x: number, y: number, c: number): void {
  x = Math.round(x);
  y = Math.round(y);
  if (x >= 0 && y >= 0 && x < b.width && y < b.height) b.pixels[y * b.width + x] = c;
}

/** The portrait's beard and moustache: `ox`, `oy` and `iw` are the canvas inside the frame, `cx` its middle column. */
function paintBeard(b: Canvas, ox: number, oy: number, iw: number, cx: number): void {
  // the beard: from the cheeks down over the coat, tapering; pale strands on the lit side, grey in the middle, dark at the right
  for (let y = oy + 15; y < oy + 32; y++) {
    const t = (y - (oy + 15)) / 17;
    const half = y < oy + 18 ? 5.5 + (y - (oy + 15)) * 0.4 : 6.6 - t * 4.2;
    for (let x = ox; x < ox + iw; x++) {
      const dx = x + 0.5 - cx;
      if (Math.abs(dx) >= half) continue;
      const strand = (x + Math.floor(y / 3)) % 3;
      px(b, x, y, Math.abs(dx) >= half - 1 && dx > 0 ? C.silverDark : dx < -half * 0.3 ? (strand === 0 ? C.silver : C.white) : dx > half * 0.4 ? (strand === 0 ? C.silverDark : C.silver) : strand === 0 ? C.white : C.silver);
    }
  }
  // the moustache over the mouth, and the mouth's shadow under it
  fill(b, cx - 3, oy + 16, 6, 1, C.white); px(b, cx - 4, oy + 17, C.white); px(b, cx + 3, oy + 17, C.silver);
  fill(b, cx - 1, oy + 18, 2, 1, C.silverDark);
}

/**
 * A framed portrait of the composer Arvo Pärt, painted in pixels (a tribute, drawn here from no photograph): the high bald
 * crown catching the light, deep-set eyes under grey brows, the grey fringe over the ears, the long beard with its
 * strands, a dark coat. Lit from the top left like everything else; the backdrop glows behind the head as in an old oil
 * portrait, and the gilt frame has a lit and a shaded side.
 */
function portrait(): Bitmap {
  const w = 32, h = 40;
  const b = createBitmap(w, h);
  // the frame: gilt with a pale top and left edge and a dark bottom and right edge, an inner dark lip
  fill(b, 0, 0, w, h, C.ink); fill(b, 1, 1, w - 2, h - 2, C.gold);
  fill(b, 1, 1, w - 2, 1, C.goldLight); fill(b, 1, 1, 1, h - 2, C.goldLight);
  fill(b, 1, h - 2, w - 2, 1, C.goldDark); fill(b, w - 2, 1, 1, h - 2, C.goldDark);
  fill(b, 3, 3, w - 6, h - 6, C.ink);
  const ox = 4, oy = 4, iw = w - 8, ih = h - 8;
  const cx = ox + iw / 2, headY = oy + 11;
  // the backdrop: dark at the edges, a soft glow behind the head and shoulder on the lit side
  for (let y = oy; y < oy + ih; y++) for (let x = ox; x < ox + iw; x++) {
    const glow = 1 - Math.hypot((x - (cx - 2)) / 11, (y - (headY + 2)) / 15);
    px(b, x, y, glow > 0.45 || (glow > 0.15 && (x + y) % 2 === 0) ? C.duskLight : glow > -0.1 && (x + 2 * y) % 4 === 0 ? C.duskLight : C.dusk);
  }
  // the coat: dark, with a lit left shoulder and the fold of a lapel
  for (let y = oy + 22; y < oy + ih; y++) for (let x = ox; x < ox + iw; x++) {
    const half = 6 + (y - (oy + 22)) * 1.6;
    const dx = x + 0.5 - cx;
    if (Math.abs(dx) >= half) continue;
    const edge = Math.abs(dx) >= half - 1;
    px(b, x, y, edge ? C.ink : dx < -half * 0.45 ? C.blueDark : (x + y) % 5 === 0 ? C.duskDark : C.duskDeep);
  }
  for (let k = 0; k < 6; k++) { px(b, cx - 5 - k * 0.5, oy + 26 + k, C.blueDark); px(b, cx + 4 + k * 0.5, oy + 26 + k, C.duskDark); }
  // the head: an egg, lit from the top left, shade down the right cheek and under the brow
  for (let y = oy + 1; y < oy + 22; y++) for (let x = ox; x < ox + iw; x++) {
    const dx = (x + 0.5 - cx) / 6.6, dy = (y + 0.5 - headY) / 9.6;
    const d = Math.hypot(dx, dy);
    if (d >= 1) continue;
    const lit = dx * 0.7 + dy * 0.6;
    px(b, x, y, d > 0.9 ? C.ink : lit > 0.42 ? C.skinShade : lit < -0.62 ? C.cream : C.skin);
  }
  // the shine on the bald crown
  fill(b, cx - 3, oy + 3, 2, 1, C.white); px(b, cx - 4, oy + 4, C.white);
  // the grey fringe over the ears, lighter on the lit side
  for (let y = oy + 9; y < oy + 16; y++) { px(b, cx - 7, y, C.white); px(b, cx - 6, y, C.silver); px(b, cx + 5, y, C.silver); px(b, cx + 6, y, C.silverDark); }
  // brows, deep-set eyes with a glint, the long nose
  fill(b, cx - 5, oy + 10, 4, 1, C.silver); fill(b, cx + 1, oy + 10, 4, 1, C.silverDark);
  fill(b, cx - 4, oy + 11, 3, 1, C.skinShade); fill(b, cx + 1, oy + 11, 3, 1, C.skinShade);
  px(b, cx - 4, oy + 12, C.white); px(b, cx - 3, oy + 12, C.ink); px(b, cx + 1, oy + 12, C.white); px(b, cx + 2, oy + 12, C.ink);
  for (let y = oy + 12; y < oy + 16; y++) { px(b, cx - 1, y, C.skin); px(b, cx, y, C.skinShade); }
  px(b, cx - 1, oy + 15, C.cream); px(b, cx + 1, oy + 15, C.skinShade);
  paintBeard(b, ox, oy, iw, cx);
  return b;
}

/** The sleeping Kiur's frame on the fine grid: his picture's columns from `KIUR_LEFT`, with room above for the letters. */
const KIUR_SLEEP = { w: 40, h: 44 } as const;
const KIUR_LEFT = 2;
/** Where the letters of his sleep leave his head, in his frame. */
export const KIUR_ZZZ_FROM = { x: 34, y: 14 } as const;

/**
 * Kiur asleep on the bed (d114): sitting on his feet, fluffed up, his head turned back and the bill tucked into the back
 * feathers, as a small bird sleeps. No line round him, as nothing in the painted room has one. Breathing out, then
 * breathing in (a little rounder and taller). The letters of his sleep are not in his frames: the game floats them up
 * over his head as it runs (`wisps.ts`).
 */
function sleeping(breath: 0 | 1): Bitmap {
  const kiur = kiurAsleep(true)[breath];
  const b = createBitmap(KIUR_SLEEP.w, KIUR_SLEEP.h);
  blit(b, kiur, -KIUR_LEFT, KIUR_SLEEP.h - kiur.height + 1);
  return b;
}

/** Kiur's sleep in two frames (ft_1_08.AC9), on the fine grid: the same bird, rounder and a row higher in the second. */
export const KIUR_FRAMES: readonly [Bitmap, Bitmap] = [sleeping(0), sleeping(1)];

/**
 * The colours of the letters of Kiur's sleep, in his frame: one pixel of the fresh letter's white and one of the paling
 * letter's silver, where the letters leave his head, so the room's painter lights them as it lights him.
 */
export const KIUR_ZZZ: Bitmap = (() => {
  const b = createBitmap(KIUR_SLEEP.w, KIUR_SLEEP.h);
  px(b, KIUR_ZZZ_FROM.x, KIUR_ZZZ_FROM.y, C.white);
  px(b, KIUR_ZZZ_FROM.x + 1, KIUR_ZZZ_FROM.y, C.silver);
  return b;
})();

/**
 * Kiur woken on the bed (ft_1_21.AC14, his second look under the pointer once a practice tug is his to play): still sitting
 * fluffed up on his feet, but his head out of his back feathers and turned to the student, eyes open, and over his head a
 * pale gold note (pale enough to be seen by night) where the letters of his sleep were: he is ready to play. The frame of his sleep, so it lies in the same place.
 */
export const KIUR_AWAKE: Bitmap = (() => {
  const kiur = kiurWoken(true);
  const b = createBitmap(KIUR_SLEEP.w, KIUR_SLEEP.h);
  blit(b, kiur, -KIUR_LEFT, KIUR_SLEEP.h - kiur.height + 1);
  blit(b, scale2x(fromAscii(['..##.', '..#.#', '..#..', '..#..', '.##..', '###..', '.#...'], { '#': C.goldLight })), 30, 0);
  return b;
})();

export const STEAM_SIZE = { w: 9, h: 13 } as const;

/**
 * The colours of the tea's steam, on the mug's mouth: the fresh wisp's white in the bottom middle and the thinning
 * wisp's silver over it. The wisps themselves are drawn by the game as it runs (`wisps.ts`), in a box of this size
 * (twice it on the fine grid) standing on the mug.
 */
export function steamTones(): Bitmap {
  const { w, h } = STEAM_SIZE;
  const b = createBitmap(w, h);
  px(b, Math.floor(w / 2), h - 1, C.white);
  px(b, Math.floor(w / 2), h - 2, C.silver);
  return b;
}

export const METRONOME_SIZE = { w: 11, h: 17 } as const;
/** The pendulum's places, in the order it visits them: left, middle, right, middle. */
export const METRONOME_FRAMES = 4;

/** A wind-up metronome: a wooden pyramid on a foot, a gold weight on its pendulum. `frame` is the pendulum's place. */
export function metronomeFrame(frame: number): Bitmap {
  const { w, h } = METRONOME_SIZE;
  const b = createBitmap(w, h);
  const mid = (w - 1) / 2;
  for (let y = 0; y < h - 2; y++) {
    const half = 1 + Math.floor((y * (mid - 1)) / (h - 3));
    for (let x = mid - half; x <= mid + half; x++) px(b, x, y, x === mid - half || x === mid + half || y === 0 ? C.ink : x === mid - half + 1 ? C.brownLight : C.brown);
  }
  for (let x = 0; x < w; x++) {
    px(b, x, h - 2, C.ink);
    px(b, x, h - 1, C.ink);
  }
  for (let x = 1; x < w - 1; x++) px(b, x, h - 2, C.brownDark);
  // the pendulum swings about a pivot near the foot
  const swing = [-3, 0, 3, 0][frame % METRONOME_FRAMES]!;
  const reach = h - 6;
  for (let step = 0; step <= reach; step++) {
    const x = mid + Math.round((swing * step) / reach);
    const y = h - 4 - step;
    const weight = step === 4 || step === 5; // low on the rod, where the body is wide enough to show it at both ends of the swing
    if (b.pixels[y * w + x] !== C.ink) px(b, x, y, weight ? C.gold : C.cream);
    if (weight && b.pixels[y * w + x + 1] === C.brown) px(b, x + 1, y, C.goldDark);
  }
  return b;
}

/** A plant in a clay pot whose two leaves are note heads on their stems. */
export const NOTE_PLANT: Bitmap = fromAscii(
  [
    '.......kkk..',
    '......kGGgk.',
    '......kGggk.',
    '.kkk...kkd..',
    'kGGgk...d...',
    'kGggk..d....',
    '.kkkd..d....',
    '....dd.d....',
    '.....ddd....',
    '......d.....',
    '.kkkkkkkkkk.',
    '.kOOoooooDk.',
    '..kOooooDk..',
    '..kooooook..',
    '..kkkkkkkk..',
  ],
  { k: C.ink, G: C.leafLight, g: C.leaf, d: C.leafDark, O: C.orangeLight, o: C.orange, D: C.orangeDark },
);

/** How many sizes the note plant grows through in a level (the XP bar as something in the room that grows). */
export const PLANT_STAGE_COUNT = 5;
/** The row of `NOTE_PLANT` where the pot starts: everything above it is the plant, which grows up from the soil. */
const PLANT_POT_ROW = 10;
/** The first row of the plant shown at each stage, from a sprout in the soil to the whole plant with both note leaves. */
const PLANT_STAGE_TOP = [9, 7, 5, 3, 0] as const;

/**
 * The note plant at each size it grows through, as the XP of the level fills: the pot always, the plant from the soil up to
 * the stage's top row; every stage the same size, so it stands on one spot. The last is the whole `NOTE_PLANT`.
 */
export const PLANT_STAGES: readonly Bitmap[] = PLANT_STAGE_TOP.map((top) => {
  const stage = { ...NOTE_PLANT, pixels: NOTE_PLANT.pixels.slice() };
  for (let y = 0; y < Math.min(top, PLANT_POT_ROW); y++) stage.pixels.fill(0, y * NOTE_PLANT.width, (y + 1) * NOTE_PLANT.width);
  return stage;
});

/** Which stage the plant shows for `fraction` of the level's XP (0 to 1): a sprout at the level's start, whole at its end. */
export function plantStage(fraction: number): number {
  return Math.min(PLANT_STAGE_COUNT - 1, Math.max(0, Math.floor(fraction * (PLANT_STAGE_COUNT - 1))));
}

/** The drawn portrait: shown where the machine has no private one (ft_1_08.AC10). */
export const ROOM_PORTRAIT: Bitmap = portrait();

/**
 * The sprites as the painted room takes them, on the fine grid: art drawn on the layout cells comes in at twice its size
 * with its stairs smoothed (the plant too, since it grows with the XP and should be seen), the metronome at its own size. `privatePortrait` is the private
 * picture where the machine has it (ft_1_08.AC10, d107), already on the fine grid.
 */
export function roomArt(privatePortrait: Bitmap | null): RoomArt {
  return {
    portrait: privatePortrait ?? scale2x(ROOM_PORTRAIT),
    shields: Array.from({ length: RANK_COUNT }, (_, i) => scale2x(rankBadge(i + 1))),
    kiur: KIUR_FRAMES,
    kiurAwake: KIUR_AWAKE,
    zzz: KIUR_ZZZ,
    steam: [scale2x(steamTones())],
    metronome: Array.from({ length: METRONOME_FRAMES }, (_, f) => metronomeFrame(f)),
    plant: PLANT_STAGES.map(scale2x),
  };
}
