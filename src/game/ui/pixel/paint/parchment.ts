import { SHEET, type SheetPlan } from '../../../../core/layout/sheet';
import { createBitmap, type Bitmap } from '../bitmap';
import { clamp01, smoothstep } from './ease';
import { fineRun } from './lab';
import { bayer, fbm, hash2 } from './noise';

/**
 * The sheet of parchment that lies under every staff (d119; the background is parchment, not plain
 * color, wherever there is a staff): a pale skin with a torn, darkened
 * edge and its lower right corner turned up, on the dark wood of a desk. Painted by rule on the fine grid, for any
 * size, from one run of skin tones and one of wood (docs/art-direction.md rule 19: long runs, small steps), each
 * tone dithered into its neighbour.
 *
 * Where the notes are written the skin stays pale and quiet (`WRITING_FLOOR`): the staff is read on it, so nothing
 * here may cost a note its contrast (AX-0). The dark rim and the foxing keep to the edge.
 *
 * Unlike Keri's pictures this one is painted in the game, when a staff is first shown at a size: its size is the
 * staff's, which the build cannot know. It imports neither Phaser nor the DOM, so tests and tools paint it in Node.
 */

/** The skin, dark to light: the charred rim, tan, honey, and cream where the light falls. */
const SKIN_TONES = [0x4a301c, 0x7a5630, 0xa98450, 0xc9a86c, 0xdcbc82, 0xead29c, 0xf4e4b6, 0xfdf0c8] as const;
/** The desk under it: walnut in shade, the warm board of the game's bars. */
const DESK_TONES = [0x1e1410, 0x33231a, 0x4b3625, 0x644a30, 0x7a5c3c] as const;
/** The largest step of lightness (L*) between two neighbours of a run: small, so the dither between them is quiet under the notes. */
const STEP = 2.5;

const SKIN = fineRun(SKIN_TONES, STEP);
const DESK = fineRun(DESK_TONES, STEP);

/** The picture's colours: place 0 is never painted, then the skin's run, then the desk's. */
export const PARCHMENT_PALETTE: readonly number[] = [0x000000, ...SKIN, ...DESK];
/** The places of each run in the palette, dark to light. */
export const PARCHMENT_RUNS: Readonly<Record<'skin' | 'desk', readonly number[]>> = {
  skin: SKIN.map((_, i) => 1 + i),
  desk: DESK.map((_, i) => 1 + SKIN.length + i),
};

/** Where the sheet's body sits in the skin's run, 0 (charred) to 1 (cream): pale, picked of three ages. */
const BODY = 0.92;
/** The skin under the notes is never darker than this place of its run, whatever the clouds and the foxing do. */
export const WRITING_FLOOR = 0.76;
/** How far over the floor a value starts to bend towards it. */
const KNEE = 0.06;
/** How far from a torn edge the writing starts: the floor holds from here inwards (`SHEET.clear` and the rim's own reach). */
export const WRITING_FROM = 10;
/** The flat colour nearest to the sheet's body: for a thing drawn on the sheet that must be the sheet's colour (a half note's inside). */
export const PARCHMENT_PAPER: number = SKIN[Math.round(BODY * (SKIN.length - 1))]!;

/** A tone of a run for a value 0 to 1, dithered between its two nearest: half ordered, half loose, so no mesh shows. */
function tone(run: readonly number[], first: number, value: number, x: number, y: number): number {
  const at = clamp01(value) * (run.length - 1);
  const low = Math.floor(at);
  const threshold = 0.5 * bayer(x, y) + 0.5 * hash2(x, y, 91);
  return first + Math.min(run.length - 1, at - low > threshold ? low + 1 : low);
}

/** Noise that changes slowly, kept on a coarse grid and read between its points: the same look for a fraction of the work. */
function slowField(width: number, height: number, sample: (x: number, y: number) => number): (x: number, y: number) => number {
  const GRID = 4;
  const columns = Math.ceil(width / GRID) + 2, rows = Math.ceil(height / GRID) + 2;
  const values = new Float32Array(columns * rows);
  for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) values[j * columns + i] = sample(i * GRID, j * GRID);
  return (x, y) => {
    const gx = clamp01(x / ((columns - 1) * GRID)) * (columns - 1.001), gy = clamp01(y / ((rows - 1) * GRID)) * (rows - 1.001);
    const i = Math.floor(gx), j = Math.floor(gy), fx = gx - i, fy = gy - j;
    const a = values[j * columns + i]!, b = values[j * columns + i + 1]!, c = values[(j + 1) * columns + i]!, d = values[(j + 1) * columns + i + 1]!;
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  };
}

/** A torn edge along one side: for each pixel along it, how far in from the side the skin starts. No edge (a far negative) for a strip of 0. */
function tornEdge(length: number, strip: number, seed: number): Float32Array {
  const edge = new Float32Array(length);
  for (let t = 0; t < length; t++) {
    edge[t] = strip === 0
      ? -1e6
      : strip + (fbm(t / 17, seed * 7.3, 3, seed) - 0.5) * 2 * SHEET.stray * strip * 0.999 + (hash2(Math.floor(t / 3), seed, 9) > 0.9 ? SHEET.nick : 0);
  }
  return edge;
}

/**
 * Paint the sheet of `plan`: a bitmap of places in `PARCHMENT_PALETTE`, every pixel painted. The same plan gives the
 * same pixels on every machine.
 */
export function paintParchment(plan: SheetPlan): Bitmap {
  const { width: w, height: h, desk, turn } = plan;
  const bitmap = createBitmap(w, h);
  const left = tornEdge(h, desk.left, 1), right = tornEdge(h, desk.right, 2), top = tornEdge(w, desk.top, 3), bottom = tornEdge(w, desk.bottom, 4);
  const at = (edge: Float32Array, t: number): number => edge[t < 0 ? 0 : t >= edge.length ? edge.length - 1 : t]!;
  // the turned corner's own point: where the sheet's right and bottom edges would meet
  const cornerX = w - desk.right, cornerY = h - desk.bottom;
  /** How deep inside the sheet a pixel is; negative on the desk. */
  const depth = (x: number, y: number): number => {
    let d = Math.min(x - at(left, y), w - 1 - x - at(right, y), y - at(top, x), h - 1 - y - at(bottom, x));
    if (turn > 0) d = Math.min(d, (cornerX - x + (cornerY - y) - turn) * 0.7);
    return d;
  };
  const clouds = slowField(w, h, (x, y) => (fbm(x / 170, y / 120, 4, 3) - 0.5) * 0.17 - smoothstep(0.6, 0.85, fbm(x / 70, y / 52, 3, 21)) * 0.035);
  const foxing = slowField(w, h, (x, y) => smoothstep(0.45, 0.7, fbm(x / 26, y / 22, 3, 40)));
  const firstSkin = PARCHMENT_RUNS.skin[0]!, firstDesk = PARCHMENT_RUNS.desk[0]!;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = depth(x, y);
      let place: number;
      const u = cornerX - x + (cornerY - y);
      if (turn > 0 && u >= turn && x >= cornerX - turn - 1 && y >= cornerY - turn - 1 && x <= cornerX && y <= cornerY) {
        // the flap: the corner's paler underside, lying on the sheet, a dark line along its two free sides
        const side = Math.min(x - (cornerX - turn - 1), y - (cornerY - turn - 1));
        place = tone(SKIN, firstSkin, 0.96 + (fbm(x / 9, y / 9, 2, 12) - 0.5) * 0.05 - (side < 1 ? 0.22 : 0) - (u - turn < 1.5 ? 0.1 : 0), x, y);
      } else if (d >= 0) {
        // the skin: its body, slow clouds of age, a fine grain, and towards the edge a darker rim with blotches of foxing
        let value = BODY + clouds(x, y) + (fbm(x / 13, y / 9, 2, 8) - 0.5) * 0.05;
        if (d < 60) value -= Math.exp(-d / 5) * 0.24 + Math.exp(-d / 12) * foxing(x, y) * 0.2;
        // the floor under the notes: it rises over the rim's pixels, and a value nearing it is bent, not cut, so no line shows
        const floor = WRITING_FLOOR * smoothstep(1, WRITING_FROM, d);
        if (value < floor + KNEE) value = floor + KNEE * Math.exp((value - floor - KNEE) / KNEE);
        if (d < 1.2) value -= 0.12;
        // the crease of the turned corner throws a soft shadow on the sheet
        if (turn > 0 && u < turn * 2 + 5) value -= smoothstep(turn * 2 + 5, turn * 2 - 1, u) * 0.1;
        place = tone(SKIN, firstSkin, value, x, y);
      } else {
        // the desk: boards along the sheet, darker where the sheet stands between them and the lamp at the upper left
        const board = Math.floor((y + 9) / 44);
        let value = 0.55 + (fbm(x / 70 + board * 9, y / 3.2, 3, 60 + board) - 0.5) * 0.5 + (hash2(board, 0, 77) - 0.5) * 0.12;
        if ((y + 9) % 44 === 0) value -= 0.3;
        if (depth(x - 2, y - 3) >= 0) value -= 0.3;
        else if (depth(x - 4, y - 5) >= 0) value -= 0.14;
        place = tone(DESK, firstDesk, value, x, y);
      }
      bitmap.pixels[y * w + x] = place;
    }
  }
  return bitmap;
}
