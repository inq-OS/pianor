import type { ActorState } from '../../../../core/scene/actor';
import type { SkyPhase } from '../../../../core/sky/skyPhase';
import { createBitmap, toRgba, type Bitmap } from '../bitmap';
import { fbm, hash2 } from '../paint/noise';
import { clamp01, smoothstep } from '../paint/ease';
import type { RgbaArt } from '../PixelObjects';
import { scenePalette } from './keriPalette';
import { scatter } from './kit/shape';

/**
 * Puuvaim, the spirit of the knoll's tree (ft_1_22, WP-11, the painter's part CT-P5; take B of sketch 1): an old burl
 * where the trunk bends, with a brow of bark, a big broken branch for a nose and a beard of grey-green hanging lichen
 * (habenasamblik). He is only there when he is there (he should be there only when available,
 * otherwise just a tree): the knoll's picture is the bare tree, and his actor lays the whole face over the trunk,
 * `PUUVAIM_SPRITE`. Nothing that moves in the picture crosses it (the dry stems stand clear of the trunk's bend in every
 * look of the gust) and nothing stands in front of it but the stems, so laying it on top keeps the picture's depth.
 *
 * Fine pixels of the knoll's picture (640 x 248), palette indices of its palette.
 */

/** The burl's middle and half sizes; below its middle it is shorter (`below`), so it stops over the roses. */
export const PUUVAIM = { x: 91, y: 74, rx: 9, ry: 12, below: 10 } as const;
/** His actor's frame on the knoll's picture: the burl with its lumps, and the beard under it. */
export const PUUVAIM_SPRITE = { x: 78, y: 58, w: 26, h: 46 } as const;

/** What the face shows: `asleep` is his eyes shut, before he wakes; the others are his actor's states. */
export type PuuvaimFace = 'asleep' | 'awake' | 'blink' | 'talk' | 'listen' | 'play' | 'hum';

/** The colours the face is painted with: runs of the knoll's palette, so every hour's light falls on him as on the tree. */
export interface PuuvaimRuns {
  ink: number;
  /** Bark, dark to light: the tree's own run (ink first, the lit grey last), so the burl is the trunk's wood. */
  bark: readonly number[];
  /** The pale edge where the sky behind lights the burl's outline, and the cut end of his nose. */
  rim: number;
  /** The lichen of his beard, grey-green, dark to light. */
  lichen: readonly number[];
  /** The whites of his eyes: the palest grey of the stones, which the hour darkens as it does everything (no glow). */
  white: number;
}

type Put = (x: number, y: number, c: number) => void;

/** One row of a mark: '#' and 'k' ink (k a pupil), 'w' the eye's white, 'l' lit bark, 'h' the bark's lightest, 'd' dark bark, 'R' the rim, '.' left alone. */
function stamp(put: Put, runs: PuuvaimRuns, x0: number, y0: number, rows: readonly string[], flip = false): void {
  const bark = runs.bark;
  const colour: Record<string, number> = { '#': runs.ink, k: runs.ink, w: runs.white, l: bark[3]!, h: bark[4]!, d: bark[1]!, R: runs.rim };
  const wide = Math.max(...rows.map((r) => r.length));
  rows.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') put(x0 + (flip ? wide - 1 - i : i), y0 + j, colour[ch]!); }));
}

/** How far the burl leans with the trunk: its foot this many pixels right of its crown. */
const LEAN = 5;

/** Where (`x`, `y`) lies in the burl's round, -1 to 1 each way, leaning with the trunk (its crown left, its foot right). */
function burlAt(x: number, y: number): { nx: number; ny: number } {
  const { x: cx, y: cy, rx, ry, below } = PUUVAIM;
  const ny = (y - cy) / (y > cy ? below : ry);
  return { nx: (x - cx - (LEAN / 2) * ny) / rx, ny };
}

/**
 * How far out in the burl (`x`, `y`) lies: 1 on its outline, over 1 outside. The outline swells in lumps as it goes round,
 * so no stretch of it runs straight; his crown is round, tucked under the tree's leaves.
 */
export function burlRound(x: number, y: number): number {
  const { nx, ny } = burlAt(x, y);
  const angle = Math.atan2(ny, nx);
  // on his left, against the sky, a knob and a dent more, so that edge never stands plumb
  const knobs = nx < 0 ? 0.07 * Math.max(0, Math.sin(ny * 4.2 + 0.6)) : 0;
  const lumps = knobs + 0.32 * Math.max(0, fbm(Math.cos(angle) * 1.7 + 3, Math.sin(angle) * 1.7, 2, 313) - 0.42) + 0.04 * (1 + Math.sin(angle * 5 + 1));
  const wonk = 1 + lumps * smoothstep(-0.75, -0.35, ny);
  return (nx * nx + ny * ny) / (wonk * wonk);
}

/**
 * The burl, lit from the side of the hour's light (`side`, -1 left to 1 right): a lump of the trunk's own wood, its
 * outline wonky (art rule 3), its bark grooves swirling round it as burl wood does and running on into the trunk's,
 * an ink line where it stands out against the sky on its left and a pale rim of the sky's light along its upper left.
 * On its right it grows into the trunk with no line at all.
 */
function burl(put: Put, runs: PuuvaimRuns, side: number): void {
  const { x: cx, y: cy, rx, ry } = PUUVAIM;
  const bark = runs.bark;
  for (let y = cy - ry - 2; y <= cy + ry + 2; y++) {
    for (let x = cx - rx - 2; x <= cx + rx + 2; x++) {
      const { nx, ny } = burlAt(x, y);
      const r = burlRound(x, y);
      if (r > 1) continue;
      const left = nx < 0.1;
      // the sky behind lights his crown's edge and the upper part of his left side, so a student finds his head at night;
      // lower down, his shaded side is an ink line
      if (left && r > 0.82) { put(x, y, ny < 0.3 && nx < -0.15 && hash2(x, y, 314) > 0.15 ? runs.rim : runs.ink); continue; }
      const round = Math.sqrt(Math.max(0, 1 - r));
      // grooves along the wood, as the trunk's: running up the burl, bending round its cheeks and into the trunk's bend
      const along = x - cx - (LEAN / 2) * ny - Math.sin(ny * 2.4) * 3 * nx;
      const groove = fbm(along / 2.2 + Math.sin(y / 6) * 0.6, y / 9, 2, 311) - 0.5;
      const tone = 0.34 + 0.3 * round + 0.28 * nx * side - 0.12 * ny + groove * 0.6;
      put(x, y, scatter(bark, clamp01(tone), x, y, 0.8, 312));
    }
  }
}

/**
 * The brow over the eyes: a ridge of lit bark with its shadow under it, the shadow only over the eyes (bark between them,
 * so they read as two eyes); listening, both go up.
 */
function brow(put: Put, runs: PuuvaimRuns, face: PuuvaimFace): void {
  const { x: cx, y: cy } = PUUVAIM;
  const bark = runs.bark;
  for (let x = cx - 6; x <= cx + 6; x++) {
    const arch = Math.abs(x - cx) < 4 ? 1 : 0;
    const tilt = face === 'listen' ? 1 : 0;
    const y = cy - 8 - arch - tilt;
    // a brow raised high would run off the top of the burl: it stays on the wood
    const on = (yy: number, c: number) => { if (burlRound(x, yy) <= 1) put(x, yy, c); };
    on(y, bark[4]!);
    on(y + 1, bark[3]!);
    on(y + 2, x === cx - 1 || x === cx ? bark[3]! : runs.ink);
  }
}

/** Each eye's mark, the left one; the right one is the same mark (`look` turns its pupils toward the student). */
const EYES: Record<PuuvaimFace, readonly string[]> = {
  asleep: ['......', 'd####d', '.dddd.'],
  blink: ['......', '.####.', '......'],
  awake: ['.####.', '#wwkw#', '#wwkw#', '.####.'],
  talk: ['.####.', '#wwkw#', '#wwkw#', '.####.'],
  listen: ['.####.', '#wwww#', '#wwkw#', '.####.'],
  play: ['......', '.####.', '#....#'],
  hum: ['......', '.####.', '#....#'],
};

/** The mouth, under the nose, at most three rows (the beard hangs from the fourth). */
const MOUTHS: Record<PuuvaimFace, readonly string[]> = {
  asleep: ['.#######.'],
  blink: ['#.......#', '.#######.'],
  awake: ['#.......#', '.#######.'],
  talk: ['..#####..', '.#ddddd#.', '..#####..'],
  listen: ['..#####..'],
  play: ['.#######.', '#ddddddd#', '.#######.'],
  hum: ['...###...', '...#d#...', '...###...'],
};

/** The eyes and the mouth of `face`: the pupils toward the middle of the knoll, where the student stands. */
function features(put: Put, runs: PuuvaimRuns, face: PuuvaimFace): void {
  const { x: cx, y: cy } = PUUVAIM;
  const eyes = EYES[face];
  // the pupils look right, to the knoll's middle, where the student stands
  stamp(put, runs, cx - 7, cy - 5, eyes);
  stamp(put, runs, cx + 1, cy - 5, eyes);
  stamp(put, runs, cx - 4, cy + 4, MOUTHS[face]);
}

/**
 * The nose: a big stub of a broken branch between the eyes and the mouth (MI2's noses are big), coming out toward the
 * light and down, its cut end pale.
 */
function nose(put: Put, runs: PuuvaimRuns, side: number): void {
  const { x: cx, y: cy } = PUUVAIM;
  // lit on its top, its shadow under it; the ink only along its underside, as MI2 draws a nose
  const rows = ['.h....', 'dlh...', 'dllh..', '#dlhhR', '#ddlRR', '.####.'];
  stamp(put, runs, side >= 0 ? cx - 2 : cx - 3, cy - 2, rows, side < 0);
}

/**
 * The beard: grey-green lichen hanging from under the mouth, its top ragged, in single strands with gaps between them,
 * longest in the middle so it tapers to a point, each strand waving a little as it falls. The strands stay pale to their
 * ends so each reads against the roses behind; lit on the side of the light.
 */
function beard(put: Put, runs: PuuvaimRuns, side: number): void {
  const { x: cx, y: cy } = PUUVAIM;
  const lichen = runs.lichen;
  for (let dx = -6; dx <= 6; dx++) {
    const outer = Math.abs(dx) > 4;
    // a ragged top: the strands start a row or two apart, and the outer ones higher, like sideburns (never over the mouth)
    const top = cy + (outer ? 5 : Math.abs(dx) >= 3 ? 6 : 7) + Math.floor(3 * hash2(dx, 2, 325));
    const long = (outer ? 3 : 4) + Math.round(5 * hash2(dx, 1, 321)) + 2 * (5 - Math.min(5, Math.abs(dx)));
    for (let k = 0; k < long; k++) {
      const fade = k / long;
      const x = cx + dx + Math.round(Math.sin(k / 3 + dx) * fade * 1.2);
      // below its top the beard parts into strands: every other column frays out first
      if (k > 2 && (dx & 1) === 1 && fade > 0.35) continue;
      if (fade > 0.6 && hash2(dx, k, 323) > 0.65) continue;
      const tone = 0.85 - 0.4 * fade + 0.2 * side * (dx / 6) + (hash2(dx, k, 322) - 0.5) * 0.3;
      put(x, top + k, k === long - 1 ? lichen[1]! : scatter(lichen, clamp01(tone), x, top + k, 0.5, 324));
    }
  }
}

/**
 * One face of his actor (`PUUVAIM_SPRITE`), in the knoll palette's indices, 0 where the picture shows through: the burl
 * with its brow, eyes, nose and mouth, and the beard hanging over the roses below it.
 */
export function puuvaimSprite(runs: PuuvaimRuns, side: number, face: PuuvaimFace): Bitmap {
  const { x: px, y: py, w, h } = PUUVAIM_SPRITE;
  const sprite = createBitmap(w, h);
  const put: Put = (x, y, c) => {
    const i = x - px, j = y - py;
    if (i < 0 || j < 0 || i >= w || j >= h) throw new Error(`Puuvaim paints outside his sprite at ${x},${y}`);
    sprite.pixels[j * w + i] = c;
  };
  burl(put, runs, side);
  brow(put, runs, face);
  features(put, runs, face);
  nose(put, runs, side);
  beard(put, runs, side);
  return sprite;
}

/** The knoll's palette (the same `scenePalette()` its painter lays the picture in), so the sprite's indices are the picture's. */
const SHARED = scenePalette();

/** Puuvaim's colours: the tree's own bark run (the limbs' in knollPicture.ts), the stones' grey for his rim and the whites of his eyes, a grey-green lichen. */
export const PUUVAIM_RUNS: PuuvaimRuns = {
  ink: SHARED.run.ink,
  bark: [SHARED.run.ink, SHARED.run.earth[0]!, SHARED.run.earth[1]!, SHARED.run.earth[2]!, SHARED.run.earth[3]!, SHARED.run.stone[2]!],
  rim: SHARED.run.stone[3]!,
  lichen: [SHARED.run.shingle[0]!, SHARED.run.far[1]!, SHARED.run.shingle[1]!, SHARED.run.far[2]!, SHARED.run.shingle[2]!, SHARED.run.shingle[3]!],
  white: SHARED.run.stone[4]!,
};

/** The side the knoll's light comes from at each hour, -1 left to 1 right: the picture's (`LIGHT` in knollPicture.ts). */
export const PUUVAIM_SIDE: Readonly<Record<SkyPhase, number>> = { day: 0.4, dawn: -1, dusk: 1, night: 0.5 };

/**
 * The faces of each state of his actor (contract A.4: `content/actors/puuvaim.json` steps them at its fps): awake, he
 * blinks now and then; talking, his mouth opens and shuts; listening, both brows up and his eyes down on the student's hands (a listener, never a judge: AX-2); playing, eyes
 * shut, humming. Asleep (eyes shut, the moment before he wakes) is a face for the conversation to show, no state of A.4.
 */
export const PUUVAIM_STATES: Readonly<Partial<Record<ActorState, readonly PuuvaimFace[]>>> = {
  idle: ['awake', 'awake', 'awake', 'awake', 'awake', 'blink'],
  talk: ['talk', 'awake'],
  listen: ['listen'],
  play: ['play', 'hum'],
};

const frames = new Map<string, readonly RgbaArt[]>();

/** The frames of `state` at `hour`, lit as the picture is; null for a state he does not have (the runtime falls back to idle). */
export function puuvaimFrames(state: ActorState, hour: SkyPhase): readonly RgbaArt[] | null {
  const faces = PUUVAIM_STATES[state];
  if (!faces) return null;
  const key = `${state}:${hour}`;
  let out = frames.get(key);
  if (!out) {
    const palette = SHARED.at(hour);
    out = faces.map((face) => {
      const sprite = puuvaimSprite(PUUVAIM_RUNS, PUUVAIM_SIDE[hour], face);
      return { width: sprite.width, height: sprite.height, rgba: toRgba(sprite, palette) };
    });
    frames.set(key, out);
  }
  return out;
}
