import { hash2, noise2 } from './paint/noise';
import type { Air } from './windField';

/**
 * Small lights that drift over a painted place and glow (modern-looking sparks and fireflies
 * with 1990s pixel art): a fire's sparks, the fireflies over the grass at dusk, the spray off the
 * rocks in a gust. Each is a mote: a whole fine pixel at its heart and a soft glow round it that the game lays on with
 * light (`PixelScene.motes`). Their courses follow the place's wind (`windField.ts`) and the laws a student knows: sparks
 * rise and slow and bend downwind, spray flies up and falls back. Pure, from the time and the day's seed, so the same
 * moment always looks the same; no dice are rolled while the game runs. Places are fine pixels of the picture.
 */
export interface Mote {
  x: number;
  y: number;
  /** How bright it is, 0 (gone) to 1. */
  glow: number;
  /** Its colour, 0xRRGGBB. */
  colour: number;
  /** How wide its glow is, in fine pixels; 0 for a sharp dot with no glow. */
  size: number;
}

/** A colour between `a` and `b` (0xRRGGBB) at `u`, 0 to 1. */
function mix(a: number, b: number, u: number): number {
  const ch = (shift: number) => Math.round(((a >> shift) & 0xff) * (1 - u) + ((b >> shift) & 0xff) * u);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/** A spark's colour as it cools: white-hot, then yellow, orange and a dull red. */
const SPARK = [0xfff6c8, 0xffc04a, 0xff7a1e, 0xb83214] as const;

/** Where slot `k` of a stream of motes is in its life at `t` ms: its cycle, its age and its life (ms), or null between lives. */
function slot(k: number, t: number, every: number, life: [number, number], seed: number, salt: number): { c: number; age: number; life: number; born: number } | null {
  const period = every * (0.8 + 0.4 * hash2(k, seed, salt));
  const u = t + hash2(k, seed, salt + 1) * period;
  const c = Math.floor(u / period);
  const age = u - c * period - hash2(k, c + seed, salt + 2) * Math.max(0, period - life[1]);
  const span = life[0] + (life[1] - life[0]) * hash2(k, c + seed, salt + 3);
  if (age < 0 || age > span) return null;
  return { c, age, life: span, born: t - age };
}

/**
 * The sparks over a fire at `t` ms: they leave the embers now and then, more when the fire flares (`heat`, 0 to 1, as
 * `flicker.ts` gives it), rise and slow down, wavering a little, some carried on up into the sky, leaning only gently downwind, and cool from white
 * to red until they go out. Sharp dots with no glow (the bonfire sparks are sharp dots, not glowing,
 * and move up in general, not thrown sideways). `n` at most at once.
 */
export function sparksAt(t: number, fire: { x: number; y: number }, air: Air, heat: (t: number) => number, seed = 0, n = 36): Mote[] {
  const out: Mote[] = [];
  for (let k = 0; k < n; k++) {
    const s = slot(k, t, 7000, [3800, 5600], seed, 951);
    if (!s) continue;
    // a spark is born only as often as the fire is hot
    if (hash2(k, s.c + seed, 955) > 0.35 + 0.65 * heat(s.born)) continue;
    // most die after a couple of seconds; about one in three is carried on up into the sky (sparks live
    // longer, and some reach the sky)
    const high = hash2(k, s.c + seed, 959) < 0.3;
    const life = high ? s.life : 1500 + 1500 * hash2(k, s.c + seed, 960);
    if (s.age > life) continue;
    const a = s.age / 1000, u = s.age / life;
    // slower than a thrown thing: a first push up that dies away, and the high ones keep a steady climb on the warm air
    const rise = 20 + 18 * hash2(k, s.c + seed, 956);
    const climb = high ? 7 + 6 * hash2(k, s.c + seed, 961) : 0;
    // a gentle lean downwind, growing slowly as the spark slows: never a throw sideways
    const push = air.way * (1 + 1.5 * air.wind) * (0.3 + 0.7 * air.gust(s.born, fire.x));
    const x = fire.x + (hash2(k, s.c + seed, 957) - 0.5) * 4 + push * a + 0.8 * Math.sin(a * (3 + 3 * hash2(k, s.c + seed, 958)) + k);
    const y = fire.y - 3 - (rise * (1 - Math.exp(-0.8 * a))) / 0.8 - climb * a;
    const flick = 0.75 + 0.25 * Math.sin(s.age / 37 + k * 2.1);
    const cool = u * (SPARK.length - 1), low = Math.min(SPARK.length - 2, Math.floor(cool));
    out.push({ x, y, glow: (1 - u) ** 0.8 * flick, colour: mix(SPARK[low]!, SPARK[low + 1]!, cool - low), size: 0 });
  }
  return out;
}

/** A firefly's cold green-yellow light. */
const FIREFLY = 0xd6ff72;

/**
 * Fireflies over the grass at `t` ms, `n` of them in `box`: each wanders on its own slow path, lights up softly now and
 * then and goes dark again, and some of the time stays dark.
 */
export function firefliesAt(t: number, box: { x: number; y: number; w: number; h: number }, n: number, seed = 0): Mote[] {
  const out: Mote[] = [];
  const spread = (v: number) => Math.max(0, Math.min(1, (v - 0.2) / 0.6));
  for (let k = 0; k < n; k++) {
    const beat = 2600 + 2400 * hash2(k, seed, 961);
    const u = t / beat + hash2(k, seed, 962);
    const c = Math.floor(u), f = u - c;
    // dark some beats; when lit, a soft swell and fade in the first part of the beat
    if (hash2(k, c + seed, 963) < 0.3 || f > 0.55) continue;
    const glow = Math.sin((Math.PI * f) / 0.55) ** 2;
    const x = box.x + box.w * spread(noise2(t / 7000 + k * 7.3, k, 964 + seed));
    const y = box.y + box.h * spread(noise2(t / 9000 + k * 3.1, k + 50, 965 + seed));
    out.push({ x, y, glow, colour: FIREFLY, size: 10 });
  }
  return out;
}

/** Spray's pale colour, a touch of the sea in it. */
const SPRAY = 0xe8f6ff;

/**
 * Spray off the rocks at `t` ms (`points`: where the surf breaks, fine pixels): in a gust strong enough, drops fly up off
 * a rock, downwind, and fall back as a thrown stone does. None in a calm; more and higher the harder it blows.
 */
export function sprayAt(t: number, points: readonly { x: number; y: number }[], air: Air, seed = 0, n = 16): Mote[] {
  const out: Mote[] = [];
  if (points.length === 0 || air.wind === 0) return out;
  for (let k = 0; k < n; k++) {
    const s = slot(k, t, 900, [450, 800], seed, 971);
    if (!s) continue;
    const from = points[Math.floor(hash2(k, s.c + seed, 975) * points.length)]!;
    const gust = air.gust(s.born, from.x);
    // only a gust throws spray, and a harder wind more often
    if (gust < 0.75 - 0.12 * air.wind || hash2(k, s.c + seed, 976) > air.wind / 3) continue;
    const a = s.age / 1000;
    const up = 18 + 14 * hash2(k, s.c + seed, 977) + 6 * air.wind;
    const x = from.x + air.way * (6 + 14 * gust) * a + (hash2(k, s.c + seed, 978) - 0.5) * 6 * a;
    const y = from.y - up * a + 0.5 * 70 * a * a;
    if (y > from.y + 1) continue;
    out.push({ x, y, glow: 0.9 * (1 - s.age / s.life), colour: SPRAY, size: 3 });
  }
  return out;
}

/** A moth's wings in a lamp's light: warm as the lamp, so it is not taken for one of the stars beside it (art review 2). */
const MOTH = 0xffc060;

/**
 * Moths round a lit lamp at `t` ms, `n` of them: each circles it on a path that never settles, now close, now wide,
 * now over it, now under, darting, its wings beating so it shows and hides; and some of the time it is off in the
 * dark. Sharp pale dots, as a fire's sparks are.
 */
export function mothsAt(t: number, lamp: { x: number; y: number }, n: number, seed = 0): Mote[] {
  const out: Mote[] = [];
  for (let k = 0; k < n; k++) {
    // away some stretches of the night
    if (hash2(k, Math.floor(t / 7000 + hash2(k, seed, 981)) + seed, 982) < 0.25) continue;
    // its wings: seen two beats in three
    if (Math.sin(t / 55 + k * 1.9) < -0.5) continue;
    const way = hash2(k, seed, 983) < 0.5 ? 1 : -1;
    const turn = way * (t / (1300 + 900 * hash2(k, seed, 984))) * Math.PI * 2 + 5 * Math.PI * (noise2(t / 2300 + k * 3.3, k, 985 + seed) - 0.5);
    const far = 3 + 12 * noise2(t / 1500 + k * 5.1, k + 20, 986 + seed);
    const x = lamp.x + Math.cos(turn) * far * 1.25;
    const y = lamp.y + Math.sin(turn) * far * 0.6 + 7 * (noise2(t / 1900 + k * 2.7, k + 40, 987 + seed) - 0.5);
    out.push({ x, y, glow: 1, colour: MOTH, size: 0 });
  }
  return out;
}

/** Dust in a shaft of daylight: warm and pale. */
const DUST = 0xfff2d2;

/**
 * Dust in a room's window light at `t` ms, `n` specks in `box` (the shaft of light): each drifts on a slow path of its
 * own, sinking a little, and shows only while it turns to the light, swelling up softly and fading again.
 */
export function dustAt(t: number, box: { x: number; y: number; w: number; h: number }, n: number, seed = 0): Mote[] {
  const out: Mote[] = [];
  const spread = (v: number) => Math.max(0, Math.min(1, (v - 0.2) / 0.6));
  for (let k = 0; k < n; k++) {
    const beat = 4200 + 3800 * hash2(k, seed, 1061);
    const u = t / beat + hash2(k, seed, 1062);
    const c = Math.floor(u), f = u - c;
    if (hash2(k, c + seed, 1063) < 0.35 || f > 0.7) continue;
    const glow = 0.75 * Math.sin((Math.PI * f) / 0.7) ** 2;
    const x = box.x + box.w * spread(noise2(t / 16_000 + k * 6.1, k, 1064 + seed));
    const y = box.y + box.h * ((spread(noise2(t / 21_000 + k * 2.3, k + 60, 1065 + seed)) + t / 90_000) % 1);
    out.push({ x, y, glow, colour: DUST, size: 3 });
  }
  return out;
}
