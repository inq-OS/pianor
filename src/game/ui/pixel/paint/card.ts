import { createBitmap, type Bitmap } from '../bitmap';
import { C } from '../palette';
import { clamp01, smoothstep } from './ease';
import { fineRun } from './lab';
import { bayer, fbm, hash2, noise2 } from './noise';

/**
 * The card: a big sheet of old parchment laid on the desk, after the title cards between the parts of the 1991 game
 * (an overhaul, on parchment in the style of the 1991 game): mottled in large warm clouds, darker and foxed
 * towards a torn edge, a dark line round it and its own shape in ink under it to the lower right. The results, the
 * ear trainer and the credits are written on it in ink. Its title rides on a ribbon (`paintRibbon`).
 *
 * Painted by rule on the fine grid for any size, from one run of skin tones (the staff's parchment, d119, a little
 * more mottled: nothing is read note by note on it). Imports neither Phaser nor the DOM.
 */

/** The skin, dark to light: charred, tan, honey, and cream where it bulges. */
const SKIN_TONES = [0x3a2414, 0x6a4424, 0x9a6c38, 0xc29454, 0xd8b06c, 0xe8c888, 0xf2dca4, 0xf8ecc4] as const;
const SKIN = fineRun(SKIN_TONES, 3);
/** The ink of the line round the sheet and of its shadow on the desk. */
const INK = 0x1a0f0a;
const SHADOW = 0x120c08;

/** The card's colours: place 0 is never painted, then the skin's run, then its ink line and its shadow. */
export const CARD_PALETTE: readonly number[] = [0x000000, ...SKIN, INK, SHADOW];
const FIRST_SKIN = 1;
const INK_PLACE = 1 + SKIN.length;
const SHADOW_PLACE = INK_PLACE + 1;

/** How far the card's shadow falls to the right and down, in fine pixels: the picture is larger than the sheet by this. */
export const CARD_SHADOW = { x: 5, y: 6 } as const;
/** How far the torn edge wanders in from the sheet's box, at most, in fine pixels: keep writing further in than this. */
export const CARD_RAG = 5;
/** How far each seed's card is turned on the desk, in radians (a positive turn lifts its right end). */
const CARD_TURN = [0.008, -0.01, 0.012, -0.007, 0.01] as const;

function tone(value: number, x: number, y: number): number {
  const at = clamp01(value) * (SKIN.length - 1);
  const low = Math.floor(at);
  const threshold = 0.35 * bayer(x, y) + 0.65 * hash2(x, y, 95);
  return FIRST_SKIN + Math.min(SKIN.length - 1, at - low > threshold ? low + 1 : low);
}

/**
 * The card, a sheet `width` by `height` fine pixels; the picture is larger by `CARD_SHADOW` for its shadow. Outside the
 * sheet and its shadow nothing is painted (place 0), so the desk shows. `seed` gives another tear and other clouds.
 */
export function paintCard(width: number, height: number, seed = 1): Bitmap {
  const out = createBitmap(width + CARD_SHADOW.x, height + CARD_SHADOW.y);
  const rag = (t: number, side: number) => (noise2(t / 9, side, 300 + seed) - 0.5) * (CARD_RAG - 1) * 2 - (hash2(Math.round(t / 5), side, 310 + seed) > 0.88 ? 2 : 0) - CARD_RAG / 2;
  // the sheet lies a little askew on the desk (art-direction rule 3: indoors nothing is plumb): turned by a hair about
  // its middle, each seed its own way, and pulled in at its ends so the turned corners stay inside the picture
  const turn = CARD_TURN[seed % CARD_TURN.length]!;
  const cx = width / 2, cy = height / 2, pull = Math.ceil(Math.abs(turn) * Math.max(cx, cy)) + 1;
  const sheet = (x: number, y: number) => {
    const u = x - (y - cy) * turn, v = y + (x - cx) * turn;
    return Math.min(u + rag(v, 1), width - 1 - u + rag(v, 2), v + rag(u, 3), height - 1 - v + rag(u, 4)) - pull;
  };
  const depth = sheet;
  for (let y = 0; y < out.height; y++) {
    for (let x = 0; x < out.width; x++) {
      const d = depth(x, y);
      if (d < 0) {
        if (depth(x - CARD_SHADOW.x, y - CARD_SHADOW.y) >= 0) out.pixels[y * out.width + x] = SHADOW_PLACE;
        continue;
      }
      if (d < 1) {
        out.pixels[y * out.width + x] = INK_PLACE;
        continue;
      }
      // big warm clouds, a fine grain, a darker rim with foxing that reaches in, a crease or two
      let value = 0.74 + (fbm(x / 120 + seed, y / 90, 4, 3) - 0.5) * 0.32 + (fbm(x / 11, y / 8, 2, 8 + seed) - 0.5) * 0.07;
      value -= Math.exp(-d / 4) * 0.3 + Math.exp(-d / 16) * smoothstep(0.45, 0.7, fbm(x / 26, y / 22, 3, 40 + seed)) * 0.25;
      const crease = Math.abs(y - height * 0.62 - (x - width / 2) * 0.05 - noise2(x / 30, 5, 320 + seed) * 4);
      if (crease < 0.7 && hash2(Math.round(x / 4), 6, 321 + seed) > 0.25) value -= 0.12;
      out.pixels[y * out.width + x] = tone(value, x, y);
    }
  }
  return out;
}

/**
 * The ribbon a card's title rides on, `width` by `height` fine pixels for its front band; the picture is wider by a
 * folded-back tail at each end (`RIBBON_TAIL`) and lower by `RIBBON_DROP`, where the tails hang. The band waves a
 * little, is pale where it bulges, and has a dark ink line round it; the tails are its darker back with a notch cut.
 * Colours of the base palette, so it is drawn with the interface's buffs.
 */
export const RIBBON_TAIL = 30;
export const RIBBON_DROP = 8;
export function paintRibbon(width: number, height: number): Bitmap {
  const out = createBitmap(width + RIBBON_TAIL * 2, height + RIBBON_DROP + 1);
  const put = (x: number, y: number, c: number) => { if (x >= 0 && y >= 0 && x < out.width && y < out.height) out.pixels[y * out.width + x] = c; };
  const wave = (x: number) => Math.round(Math.sin(((x - RIBBON_TAIL) / width) * Math.PI) * -2);
  // the tails, behind and lower: from under the band's ends outwards, a notch cut into their outer ends
  for (const side of [-1, 1] as const) {
    for (let i = 0; i < RIBBON_TAIL + 8; i++) {
      const x = side < 0 ? RIBBON_TAIL + 8 - i : RIBBON_TAIL + width - 9 + i;
      const top = RIBBON_DROP, bottom = RIBBON_DROP + height - 1;
      for (let y = top; y <= bottom; y++) put(x, y, y === top || y === bottom ? C.ink : y - top < 2 ? C.buffDark : C.buffDeep);
    }
    // the notch: a V cut into the tail's outer end
    const endX = side < 0 ? 0 : out.width - 1;
    for (let k = 0; k < 7; k++) {
      const half = Math.round((height / 2) * (1 - k / 7));
      for (let y = RIBBON_DROP + Math.round(height / 2) - half; y <= RIBBON_DROP + Math.round(height / 2) + half - 1; y++) put(endX - side * k, y, 0);
      put(endX - side * k, RIBBON_DROP + Math.round(height / 2) - half - 1, C.ink);
      put(endX - side * k, RIBBON_DROP + Math.round(height / 2) + half, C.ink);
    }
  }
  // the front band
  for (let x = RIBBON_TAIL; x < RIBBON_TAIL + width; x++) {
    const top = 1 + wave(x) + 2, bottom = top + height - 1;
    for (let y = top; y <= bottom; y++) {
      const edge = y === top || y === bottom || x === RIBBON_TAIL || x === RIBBON_TAIL + width - 1;
      const fold = x === RIBBON_TAIL + 2 || x === RIBBON_TAIL + width - 3;
      const bulge = fbm(x / 30, y / 10, 2, 330) + (y - top) / height * -0.25;
      put(x, y, edge ? C.ink : fold ? C.buffDark : bulge > 0.42 ? C.buffLight : C.buff);
    }
  }
  return out;
}

/**
 * A wax seal for a button on a card, in layout cells (a button's picture is drawn on cells): a round blob of red wax,
 * its rim pressed up, the button's picture pressed into it in pale wax (its white pixels). `size` across, in cells.
 */
export function paintSeal(picture: Bitmap, size = 20): Bitmap {
  const out = createBitmap(size, size);
  const r = size / 2 - 1, c = (size - 1) / 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = x - c, dy = y - c, a = Math.atan2(dy, dx), d = Math.hypot(dx, dy);
    const edge = r + Math.sin(a * 7) * 0.6 + (hash2(Math.round(a * 9), 1, 340) - 0.5) * 0.8;
    if (d > edge) continue;
    const lit = -(dx + dy) / (size * 1.2);
    // the rim is lit from the upper left; the pressed middle is flat wax, so the picture in it reads
    let colour: number = d < r * 0.7 ? C.red : lit > 0.14 ? C.redLight : lit > -0.2 ? C.red : C.redDark;
    if (d > edge - 1) colour = C.ink;
    else if (d > r * 0.7 && d < r * 0.82) colour = C.redDark;
    out.pixels[y * size + x] = colour;
  }
  const px = Math.round(c - (picture.width - 1) / 2), py = Math.round(c - (picture.height - 1) / 2);
  const drawn = (x: number, y: number) => x >= 0 && y >= 0 && x < picture.width && y < picture.height && picture.pixels[y * picture.width + x] === C.white;
  for (let y = -1; y <= picture.height; y++) for (let x = -1; x <= picture.width; x++) {
    const tx = px + x, ty = py + y;
    if (tx < 0 || ty < 0 || tx >= size || ty >= size) continue;
    // the picture pressed into the wax: pale where it stands up, its edge dark on the lower right where it is cut in
    if (drawn(x, y)) out.pixels[ty * size + tx] = C.pinkLight;
    else if (drawn(x - 1, y - 1) || drawn(x - 1, y) || drawn(x, y - 1)) out.pixels[ty * size + tx] = C.redDark;
  }
  return out;
}
