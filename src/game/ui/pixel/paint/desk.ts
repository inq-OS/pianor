import { createBitmap, type Bitmap } from '../bitmap';
import { clamp01 } from './ease';
import { fineRun } from './lab';
import { bayer, fbm, hash2, noise2 } from './noise';

/**
 * The warden's desk and the beam over it: the ground of every screen that is not a painted place (the
 * survey of screens still below the MI2 standard: the felt goes, every screen is a thing in the
 * warden's room). The desk is the same walnut the parchment lies on (d119), so a sheet, a card or a book put on it
 * sits on one board; the beam is a darker, rougher rafter across the top that carries the player's name and the
 * door and the gear.
 *
 * Painted by rule on the fine grid, for any size, from one run of wood (docs/art-direction.md rule 19), each tone
 * dithered into its neighbour with grain rather than a mesh (MI2 is scanned paint). No vignette: the desk is as
 * light at its edges as in its middle (d111). Imports neither Phaser nor the DOM.
 */

/** The desk's walnut, dark to light: the parchment's desk (d119) and one lighter step for the planks' lit edges. */
const DESK_TONES = [0x1e1410, 0x33231a, 0x4b3625, 0x644a30, 0x7a5c3c] as const;
/** The beam's darker, redder oak, dark to light. */
const BEAM_TONES = [0x120b08, 0x24160f, 0x3a2416, 0x52331d, 0x6c4626, 0x86592f] as const;

const DESK = fineRun(DESK_TONES, 2.5);
const BEAM = fineRun(BEAM_TONES, 3);

/** The colours of the desk and the beam: place 0 is never painted, then the desk's run and the beam's. */
export const DESK_PALETTE: readonly number[] = [0x000000, ...DESK, ...BEAM];
const FIRST = { desk: 1, beam: 1 + DESK.length } as const;
/** How tall a plank of the desk is, in fine pixels (the parchment's desk, d119). */
export const PLANK = 44;

/** A tone of a run for a value 0 to 1, dithered between its two nearest: mostly loose grain, a little order. */
function tone(run: readonly number[], first: number, value: number, x: number, y: number): number {
  const at = clamp01(value) * (run.length - 1);
  const low = Math.floor(at);
  const threshold = 0.35 * bayer(x, y) + 0.65 * hash2(x, y, 93);
  return first + Math.min(run.length - 1, at - low > threshold ? low + 1 : low);
}

/**
 * The desk, `width` by `height` fine pixels, its planks running across, `offset` fine pixels of plank already above its
 * top (so a desk painted under a toolbar keeps its seams where the whole screen's would be). Every pixel is painted.
 */
export function paintDesk(width: number, height: number, offset = 0): Bitmap {
  const out = createBitmap(width, height);
  for (let y = 0; y < height; y++) {
    const sy = y + offset + 9;
    const board = Math.floor(sy / PLANK), inBoard = sy - board * PLANK;
    for (let x = 0; x < width; x++) {
      let value: number;
      if (inBoard === 0) value = 0.02;
      else if (inBoard === 1) value = 0.18;
      else {
        // the grain runs along the plank; each plank its own shade; a darker streak now and then; the lit top edge
        value = 0.52 + (hash2(board, 0, 77) - 0.5) * 0.12 + (fbm(x / 70 + board * 9, sy / 3.2, 3, 60 + board) - 0.5) * 0.5;
        if (Math.abs(noise2(x / 46 + board * 3, sy / 2.1, 61) - 0.5) < 0.035) value -= 0.2;
        if (inBoard < 4) value += 0.1;
      }
      out.pixels[y * width + x] = tone(DESK, FIRST.desk, value, x, y);
    }
  }
  return out;
}

/**
 * The beam across the top of a screen, `width` by `height` fine pixels: a rough rafter lit along its top edge, a dark
 * underside where it meets the room (its lowest `shadow` rows, which stand where the vine was), knots and splits in the
 * grain. Every pixel is painted.
 */
export function paintBeam(width: number, height: number, shadow = 6): Bitmap {
  const out = createBitmap(width, height);
  const face = height - shadow;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let value: number;
      if (y >= face) {
        // the underside: the beam's shadow on the room, falling off into the desk's darkest walnut
        value = 0.12 - (y - face) * 0.02;
      } else {
        // the face: grain along the beam, a split or two, lit at its top edge and darker towards its foot
        value = 0.5 + (fbm(x / 64, y / 3, 3, 21) - 0.5) * 0.45 + (fbm(x / 9, y / 1.5, 2, 24) - 0.5) * 0.1;
        if (Math.abs(noise2(x / 52, y / 2.2, 22) - 0.5) < 0.03) value -= 0.25;
        const knot = fbm(x / 7, y / 4, 2, 26);
        if (knot > 0.8) value -= (knot - 0.8) * 2;
        if (y < 2) value += 0.28;
        else if (y < 4) value += 0.12;
        value -= Math.max(0, y - face + 6) * 0.04;
        if (y === face - 1) value = 0.08;
      }
      out.pixels[y * width + x] = tone(BEAM, FIRST.beam, value, x, y);
    }
  }
  return out;
}
