import { createBitmap, type Bitmap } from '../bitmap';
import { clamp01 } from './ease';
import { fineRun } from './lab';
import { bayer, fbm, hash2, noise2 } from './noise';

/**
 * Kiur at the door's two pictures (ft_1_15; from the survey of screens: a real door, not a page corner): the
 * door he points his wing at, the warden's room door standing ajar in its plastered wall with the hallway past it, and the way
 * back to the piece, the corner of a page of music turned up, a line of staff on it and the piece's first notes.
 * `open` paints the door wider and the page corner turned further: the look under the pointer.
 *
 * Painted by rule on the fine grid. Imports neither Phaser nor the DOM.
 */

const PLASTER_TONES = [0x4a3c34, 0x7a6a5c, 0xa69684, 0xcab8a0, 0xe2d4bc] as const;
const HALL_TONES = [0x1c2030, 0x323c56, 0x4e5c78, 0x6c7c96] as const;
const COAT_TONES = [0x5a4208, 0x9a7414, 0xd0a428, 0xf0cc50] as const;
const WOOD_TONES = [0x1c0c06, 0x3e1e0e, 0x6a3818, 0x8e5426, 0xb07a3e] as const;
const PAGE_TONES = [0x6a4424, 0x9a6c38, 0xc29454, 0xd8b06c, 0xe8c888, 0xf2dca4, 0xf8ecc4] as const;
const IRON = 0x14121a;
const INK = 0x1a0f0a;
const PLASTER = fineRun(PLASTER_TONES, 4);
const HALL = fineRun(HALL_TONES, 4);
const COAT = fineRun(COAT_TONES, 4);
const WOOD = fineRun(WOOD_TONES, 4);
const PAGE = fineRun(PAGE_TONES, 3);

/** The door's and the page's colours: place 0 is never painted, then plaster, wood, the hallway, the oilskin and the page, then iron and ink. */
export const DOOR_PALETTE: readonly number[] = [0x000000, ...PLASTER, ...WOOD, ...HALL, ...COAT, ...PAGE, IRON, INK];
const FIRST = {
  plaster: 1,
  wood: 1 + PLASTER.length,
  hall: 1 + PLASTER.length + WOOD.length,
  coat: 1 + PLASTER.length + WOOD.length + HALL.length,
  page: 1 + PLASTER.length + WOOD.length + HALL.length + COAT.length,
} as const;
const IRON_PLACE = FIRST.page + PAGE.length, INK_PLACE = IRON_PLACE + 1;

function tone(run: readonly number[], first: number, value: number, x: number, y: number): number {
  const at = clamp01(value) * (run.length - 1);
  const low = Math.floor(at);
  const threshold = 0.35 * bayer(x, y) + 0.65 * hash2(x, y, 93);
  return first + Math.min(run.length - 1, at - low > threshold ? low + 1 : low);
}

/**
 * The door, `width` by `height` fine pixels: the warden's room door (docs/keri/scene-room.md, pass 6) in a patch of its
 * plastered wall, a fat dark frame round it and the warm leaf of upright planks on two iron strap hinges, swung into the
 * room so that the hallway shows past its edge: blue-grey boarding and a yellow oilskin on a peg (wider when `open`).
 * The whole door leans a little, as everything in the room does (art-direction rule 3).
 */
export function paintDoor(width: number, height: number, open = false): Bitmap {
  const out = createBitmap(width, height);
  const put = (x: number, y: number, place: number) => { if (x >= 0 && y >= 0 && x < width && y < height) out.pixels[y * width + x] = place; };
  // the lean: the door's top stands this many pixels right of its foot
  const lean = Math.max(2, Math.round(width * 0.06));
  const shift = (y: number) => Math.round(lean * (1 - y / height));
  const wall = Math.max(3, Math.round(width * 0.08)), frame = Math.max(5, Math.round(width * 0.13)), head = Math.max(6, Math.round(height * 0.08));
  plasterWall(width, height, put);
  const inner = { left: wall + frame, right: width - 1 - wall - frame, top: head + frame - 2, bottom: height - 3 };
  // the fat dark frame, lit a little on its left
  for (let y = head; y < height - 2; y++) {
    const dx = shift(y);
    for (let x = wall; x < width - wall; x++) {
      const inOpening = x >= inner.left && x <= inner.right && y >= inner.top;
      if (inOpening) continue;
      const lit = x < wall + 2 || y < head + 2 ? 0.2 : 0;
      put(x + dx, y, tone(WOOD, FIRST.wood, 0.18 + lit + (fbm(x / 3, y / 20, 2, 85) - 0.5) * 0.15, x, y));
    }
  }
  const gap = Math.round((inner.right - inner.left) * (open ? 0.5 : 0.26));
  hallway(inner, gap, height, shift, put);
  // the leaf: warm upright planks swung into the room on its hinges, its near edge dark, two iron straps across
  const leafLeft = inner.left + gap, plank = Math.max(4, Math.round((inner.right - leafLeft) / 3));
  const straps = [Math.round(height * 0.32), Math.round(height * 0.74)];
  for (let y = inner.top; y <= inner.bottom; y++) {
    const dx = shift(y);
    for (let x = leafLeft; x <= inner.right; x++) {
      if (straps.some((b) => y >= b && y < b + 3) && x > leafLeft + 1) { put(x + dx, y, IRON_PLACE); continue; }
      let value = 0.62 + (fbm(x / 3, y / 30, 2, 86 + Math.floor((x - leafLeft) / plank)) - 0.5) * 0.3;
      if ((x - leafLeft) % plank === 0) value = 0.25;
      if (x - leafLeft < 2) value = 0.15;
      put(x + dx, y, tone(WOOD, FIRST.wood, value, x, y));
    }
  }
  // the knob, near the leaf's edge
  const knobY = Math.round(height * 0.56);
  for (const [kx, ky] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) put(leafLeft + 3 + kx + shift(knobY), knobY + ky, FIRST.coat + COAT.length - 1);
  // the sill
  for (let x = wall; x < width - wall; x++) for (let y = height - 3; y < height; y++) put(x, y, tone(WOOD, FIRST.wood, y === height - 3 ? 0.5 : 0.15, x, y));
  return out;
}

type Put = (x: number, y: number, place: number) => void;

/** The plaster round the door's frame: pale and uneven, its edge ragged where the picture stops, level dashes on it. */
function plasterWall(width: number, height: number, put: Put): void {
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const ragged = Math.min(x, width - 1 - x, y) + (noise2(x / 5, y / 5, 81) - 0.5) * 4;
    if (ragged < 0) continue;
    let value = 0.62 + (fbm(x / 10, y / 10, 2, 82) - 0.5) * 0.25;
    if (ragged < 1.5) value = 0.3;
    if ((y + Math.round(noise2(x / 9, 0, 83) * 2)) % 11 === 0 && hash2(x >> 2, y, 84) > 0.6) value -= 0.12; // the level dashes on the plaster
    put(x, y, tone(PLASTER, FIRST.plaster, value, x, y));
  }
}

/** The hallway past the door's leaf: blue-grey boarding, floor boards, and on a peg the yellow oilskin. */
function hallway(inner: { left: number; top: number; bottom: number }, gap: number, height: number, shift: (y: number) => number, put: Put): void {
  for (let y = inner.top; y <= inner.bottom; y++) {
    const dx = shift(y);
    for (let x = inner.left; x < inner.left + gap; x++) {
      const floor = y > inner.bottom - Math.round(height * 0.12);
      const value = floor ? 0.45 + ((x + y) % 5 === 0 ? -0.15 : 0) : 0.55 + ((x - inner.left) % 6 === 0 ? -0.3 : 0);
      put(x + dx, y, tone(HALL, FIRST.hall, value, x, y));
    }
  }
  const coatX = inner.left + Math.max(2, Math.round(gap * 0.35)), coatTop = inner.top + Math.round(height * 0.18);
  for (let y = coatTop; y < coatTop + Math.round(height * 0.3); y++) {
    // hung by its loop, then its shoulders, then straight down with a little flare at the hem
    const d = y - coatTop, half = d < 3 ? 1 : d < 6 ? 3 : 4 + (d > height * 0.25 ? 1 : 0);
    for (let x = coatX - half; x <= coatX + half; x++) if (x >= inner.left && x < inner.left + gap) put(x + shift(y), y, tone(COAT, FIRST.coat, x === coatX - half ? 0.2 : 0.75, x, y));
  }
}

/**
 * The way back to the piece, `width` by `height` fine pixels: the lower right corner of a page of music, two staff
 * lines and a few notes in ink on it, its corner turned up to show the paler back (further when `open`).
 */
export function paintPageCorner(width: number, height: number, open = false): Bitmap {
  const out = createBitmap(width, height);
  const put = (x: number, y: number, place: number) => { if (x >= 0 && y >= 0 && x < width && y < height) out.pixels[y * width + x] = place; };
  const fold = Math.round(Math.min(width, height) * (open ? 0.58 : 0.42));
  // the page's sheet, torn straight across its top and left (the rest of the page is off the picture)
  const inSheet = (x: number, y: number) => x + y < width + height - 2 - fold && x >= Math.round(noise2(0, y / 4, 61) * 2) && y >= Math.round(noise2(x / 4, 0, 62) * 2);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (!inSheet(x, y)) continue;
    const edge = !inSheet(x - 1, y) || !inSheet(x + 1, y) || !inSheet(x, y - 1) || !inSheet(x, y + 1);
    const value = 0.78 + (fbm(x / 12, y / 12, 2, 63) - 0.5) * 0.25 - (x + y > width + height - fold - 8 ? 0.15 : 0);
    put(x, y, edge ? INK_PLACE : tone(PAGE, FIRST.page, value, x, y));
  }
  inkStaff(width, height, inSheet, put);
  // the turned corner: the page's back, paler, its fold a dark crease, a line of ink round it. The flap is the cut
  // corner reflected across the fold, so a point is on it when its mirror image is inside the corner.
  const diagonal = width + height - 2 - fold;
  const inCorner = (x: number, y: number) => x + y >= diagonal && x < width && y < height
    && (width - 1 - x) + (height - 1 - y) <= fold && x >= width - 1 - fold + Math.round(fold * 0.12) && y >= height - 1 - fold + Math.round(fold * 0.12);
  const onFlap = (x: number, y: number) => inCorner(diagonal - y, diagonal - x);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (!onFlap(x, y)) continue;
    const edge = !onFlap(x - 1, y) || !onFlap(x + 1, y) || !onFlap(x, y - 1) || !onFlap(x, y + 1);
    const crease = x + y >= diagonal - 2;
    put(x, y, edge || crease ? INK_PLACE : tone(PAGE, FIRST.page, 0.95 - (width + height - fold - x - y) / (fold * 4), x, y));
  }
  return out;
}

/** The page's staff: five lines across it, a little uneven, and three notes on them, all in ink. */
function inkStaff(width: number, height: number, inSheet: (x: number, y: number) => boolean, put: (x: number, y: number, place: number) => void): void {
  const lineGap = Math.max(4, Math.round(height / 12));
  const staffTop = Math.round(height * 0.18);
  for (let k = 0; k < 5; k++) for (let x = 3; x < width - 3; x++) {
    const y = staffTop + k * lineGap + (hash2(x >> 3, k, 64) > 0.85 ? 1 : 0);
    if (inSheet(x, y) && inSheet(x + 2, y + 2)) put(x, y, INK_PLACE);
  }
  const notes = [[0.22, 3], [0.42, 2], [0.62, 1]] as const;
  for (const [at, line] of notes) {
    const nx = Math.round(width * at), ny = staffTop + line * lineGap + Math.round(lineGap / 2);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -3; dx <= 3; dx++) if (dx * dx / 9 + dy * dy / 4 <= 1 && inSheet(nx + dx, ny + dy)) put(nx + dx, ny + dy, INK_PLACE);
    for (let dy = 0; dy < lineGap * 3; dy++) if (inSheet(nx + 3, ny - dy)) put(nx + 3, ny - dy, INK_PLACE);
  }
}
