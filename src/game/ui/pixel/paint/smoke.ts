import { createBitmap } from '../bitmap';
import { cropTogether, type Overlay } from '../pack';
import type { WindWay } from './motion';

/**
 * Smoke over a fire, a chimney or a pipe in any painted place (part of the shared motion, `motion.ts`): one thin thread,
 * not puffs (on the knoll's embers: more like a thin vine than puffs of balls). It
 * leaves its source one pixel wide and winds wider as it rises, the waves running up it; the wind bends it its way
 * toward its top, where it breaks into pieces that rise and fade. A lit side and a shaded one (the light comes from the
 * top left), so it reads on a cloud as on the sky. Pure: a moment and the wind give its pixels, in palette places that
 * are the same at every hour.
 */

/** The smoke's palette places: its lit side, its middle and fading end, where it leaves the embers, its shaded side. */
export interface SmokeTones {
  light: number;
  mid: number;
  root: number;
  shade: number;
}

/** How high the thread rises (fine pixels), how far the wind bends its top for each of its strengths, and its beats. */
export const THREAD = { rise: 112, drift: 30, waveMs: 4000, breakMs: [8000 / 3, 4000] } as const;
/** Its loop: every beat comes round in this time, so the frames repeat without a jump. */
export const SMOKE_LOOP_MS = 8000;
/** One frame of the loop. */
export const SMOKE_FRAME_MS = 125;

const TAU = Math.PI * 2;

/** The thread at `timeMs` in the wind `wind` (0 calm to 3 storm) blowing its `way`, its foot at (`x`, `y`): each of its pixels to `put`. */
export function smokeThread(timeMs: number, wind: number, way: WindWay, foot: { x: number; y: number }, tones: SmokeTones, put: (x: number, y: number, tone: number) => void, rise: number = THREAD.rise): void {
  let last = NaN;
  // a lower thread (a grill's wisp) is the same thread drawn smaller: it winds and bends less in the same measure
  const small = rise / THREAD.rise;
  for (let k = 0; k <= rise; k++) {
    const s = k / rise, y = foot.y - 3 - k;
    // the winding: small over the embers, wider as it rises; its waves run up the thread
    const reach = 0.8 + 9 * small * s ** 1.6;
    const wave = TAU * (s * 2.4 - timeMs / THREAD.waveMs);
    const sway = reach * (Math.sin(wave) + 0.35 * Math.sin(TAU * (s * 4.6 - (2 * timeMs) / THREAD.waveMs) + 1.1));
    const x = Math.round(foot.x + way * wind * THREAD.drift * small * s ** 1.7 + sway);
    // breaks: none low down, more toward the top; they rise with the smoke
    const gaps = Math.sin(TAU * (k / 21 - timeMs / THREAD.breakMs[0])) + 0.7 * Math.sin(TAU * (k / 34 - timeMs / THREAD.breakMs[1]) + 1.3);
    if (gaps <= -2 + 3.4 * Math.max(0, (s - 0.3) / 0.7) ** 1.3) {
      last = NaN;
      continue;
    }
    // grey where it leaves the embers, light in its middle, every other pixel and dimmer toward its end
    const thin = s > 0.82 && (x + y) % 2 === 0;
    const tone = thin ? tones.mid : s < 0.06 ? tones.root : s < 0.7 ? tones.light : tones.mid;
    // where it swings by more than a pixel from the row below, the row is joined so the thread never tears
    if (!Number.isNaN(last) && Math.abs(x - last) > 1) for (let xx = last + Math.sign(x - last); xx !== x; xx += Math.sign(x - last)) put(xx, y, tone);
    put(x, y, tone);
    // its second pixel: the middle tone where it is widest, the shaded side where it is thin, none just over the embers
    if (!thin && s > 0.06) put(x + 1, y, s > 0.16 && s < 0.78 ? tones.mid : tones.shade);
    last = x;
  }
}

/**
 * The thread's loop in the wind `wind` blowing its `way`, a frame each `SMOKE_FRAME_MS`, its foot at (`x`, `y`) of the
 * picture: frames cut to one box, with its place. Made when the scene opens; the first frame is what reduced motion shows.
 */
export function smokeFrames(wind: number, way: WindWay, foot: { x: number; y: number }, tones: SmokeTones, rise: number = THREAD.rise): Overlay {
  const bent = Math.ceil(wind * THREAD.drift) + 16;
  const left = way < 0 ? bent : 16, right = way < 0 ? 16 : bent, top = rise + 4;
  const w = left + right, h = top + 1;
  const frames = Array.from({ length: SMOKE_LOOP_MS / SMOKE_FRAME_MS }, (_, f) => {
    const b = createBitmap(w, h);
    smokeThread(f * SMOKE_FRAME_MS, wind, way, { x: left, y: top }, tones, (x, y, tone) => {
      if (x >= 0 && y >= 0 && x < w && y < h) b.pixels[y * w + x] = tone;
    }, rise);
    return b;
  });
  const cut = cropTogether(frames);
  return { x: foot.x - left + cut.x, y: foot.y - top + cut.y, frames: cut.frames };
}
