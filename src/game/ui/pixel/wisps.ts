import { hash2, noise2 } from './paint/noise';

/**
 * Small things that rise and fade indoors, drawn afresh as the game runs instead of stepping through painted frames
 * (other things can be improved the same way, such as mug steam and Kiur's sleep letters): the steam over a mug, and the letters of a sleeper's breath. Pure, from the time and a seed, as `motes.ts`
 * and `flicker.ts` are: the same moment always looks the same, and no dice are rolled while the game runs. Places are
 * fine pixels; `put` takes one pixel in a palette place.
 */

const TAU = Math.PI * 2;

/** The two tones such a thing is drawn in: fresh and bright where it starts, paler as it thins. */
export interface WispTones {
  light: number;
  mid: number;
}

/**
 * How many wisps a mug has in the air at most, about how long one takes to rise and go (milliseconds), and how far up
 * its box it gets before it is gone (a share of the box's height).
 */
export const STEAM = { wisps: 3, everyMs: 3600, reach: 0.4 } as const;

/**
 * The steam over a mug at `t` ms, in a box `w` wide and `h` high whose bottom middle is the mug's mouth: a few short
 * wisps, each leaving the mouth in its own time, rising fast and then slower, winding a little wider the higher it is,
 * and breaking up into every other block before it is gone, less than half way up its box. It is drawn in blocks of two by two
 * fine pixels, as the room's sprites are, bright at the mouth and paler above: a line one fine pixel thin, winding far
 * over what stands behind, read as a scratch on the picture (art review 2). No two wisps rise alike, and
 * the gaps between them are uneven.
 */
export function steamAt(t: number, size: { w: number; h: number }, tones: WispTones, seed: number, put: (x: number, y: number, tone: number) => void): void {
  const cols = Math.floor(size.w / 2), rows = Math.floor(size.h / 2);
  const reach = rows * STEAM.reach;
  for (let k = 0; k < STEAM.wisps; k++) {
    const period = STEAM.everyMs * (0.75 + 0.5 * hash2(k, seed, 931));
    const u = t + period * (k / STEAM.wisps + 0.3 * hash2(k, seed, 932));
    const c = Math.floor(u / period);
    const life = period * (0.7 + 0.25 * hash2(k, c + seed, 933));
    const age = u - c * period;
    if (age > life) continue;
    const a = age / life;
    // its head: quick off the tea, slowing as it cools
    const head = reach * (1 - (1 - a) ** 1.7);
    const long = 2 + 1.5 * a + 1.5 * hash2(k, c + seed, 934);
    const from = (cols - 1) / 2 + (hash2(k, c + seed, 935) - 0.5) * 1.6;
    // a slow draught of the room leans the whole wisp a little one way or the other
    const lean = (noise2(t / 5000, k + 0.5, 936 + seed) - 0.5) * 2.4;
    const turn = hash2(k, c + seed, 937) * TAU;
    for (let j = 0; j < long; j++) {
      const up = Math.floor(head) - j;
      if (up < 0) break;
      const s = up / reach;
      // going: every other block, from its tail up
      if (a > 0.6 && (j + up) % 2 === 0 && j / long > 1.7 - 2 * a) continue;
      if (a > 0.9 && (up + k) % 2 !== 0) continue;
      const sway = (0.15 + 1.1 * s) * Math.sin(TAU * (up / 7 - t / 3200) + turn) + lean * s;
      const cx = Math.round(from + sway), cy = rows - 1 - up;
      if (cx < 0 || cx >= cols || cy < 0) continue;
      const tone = up < 2 && a < 0.6 ? tones.light : tones.mid;
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) put(cx * 2 + dx, size.h - rows * 2 + cy * 2 + dy, tone);
    }
  }
}

/** About how long one breath of a sleeper takes, in milliseconds. */
export const BREATH_MS = 3800;

/**
 * A sleeper's breathing at `t` ms: which breath it is on and how far through it (0 to 1), in then out. The breaths are
 * not all one length: the clock they keep wanders a little, always forward.
 */
export function breathAt(t: number, seed = 0): { breath: number; part: number; phase: number } {
  // the noise's steepest slope is about 1.5: over three breaths it adds or takes at most a third of the pace
  const phase = t / BREATH_MS + 0.65 * (noise2(t / (BREATH_MS * 3), 0.5, 941 + seed) - 0.5) + 1000;
  const breath = Math.floor(phase);
  return { breath, part: phase - breath, phase };
}

/** How far through a breath the sleeper turns from breathing in to breathing out: its letter leaves then. */
export const BREATH_OUT = 0.42;
/** How many breaths a letter stays in the air. */
const Z_LIFE = 1.7;

/** The letter small and grown, as rows of its pixels (drawn twice the size, as the room's sprites are). */
const Z_SMALL = ['zzz', '..z', '.z.', 'zzz'] as const;
const Z_BIG = ['zzzz', '...z', '..z.', '.z..', 'zzzz'] as const;

/** The box the letters of a sleeper float in, in fine pixels, and where in it they leave the sleeper's head. */
export const ZZZ_BOX = { w: 34, h: 46, from: { x: 20, y: 36 } } as const;

/**
 * The letters over a sleeper at `t` ms, in `ZZZ_BOX`: one "z" leaves the head with each breath out, floats up and away
 * on a path of its own, swaying, grows from small to big on the way, pales, and breaks up before it is gone. Two are
 * in the air at most, and since the breaths are uneven so are the gaps between them.
 */
export function zzzAt(t: number, tones: WispTones, seed: number, put: (x: number, y: number, tone: number) => void): void {
  const { breath, phase } = breathAt(t, seed);
  for (const c of [breath - 2, breath - 1, breath]) {
    const age = (phase - c - BREATH_OUT) / Z_LIFE;
    if (age < 0 || age >= 1) continue;
    const rows = age < 0.4 ? Z_SMALL : Z_BIG;
    // up and a little to the left, each on its own slant, swaying as it goes
    const slant = -6 - 8 * hash2(c, seed, 943);
    const x0 = ZZZ_BOX.from.x + slant * age + 2.2 * Math.sin(TAU * (age * 1.5 + hash2(c, seed, 944)));
    const y0 = ZZZ_BOX.from.y - (ZZZ_BOX.from.y - 2) * (1 - (1 - age) ** 1.4) - rows.length * 2;
    const left = Math.round(x0 / 2) * 2, top = Math.round(y0 / 2) * 2;
    const tone = age < 0.5 ? tones.light : tones.mid;
    rows.forEach((row, ry) => {
      for (let rx = 0; rx < row.length; rx++) {
        if (row[rx] !== 'z') continue;
        // the last of its life: every other block, then gone
        if (age > 0.8 && (rx + ry + c) % 2 === 0) continue;
        for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) {
          const x = left + rx * 2 + dx, y = top + ry * 2 + dy;
          if (x >= 0 && x < ZZZ_BOX.w && y >= 0 && y < ZZZ_BOX.h) put(x, y, tone);
        }
      }
    });
  }
}
