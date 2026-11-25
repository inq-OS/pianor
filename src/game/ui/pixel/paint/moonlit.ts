import { clamp01 } from './ease';
import { hash2 } from './noise';

/**
 * The near ground at night as a moonlit plane (art-direction rule 9): the 1991 nights keep the ground nearest the eye a
 * mid blue the eye can read, its dark things standing on it as shapes, where ours sank to near black in the rows a
 * conversation's board covers. Each pixel of a ground run from row `from` down is lifted up its own run, by more the
 * nearer it lies, up to `lift` of the run's length at row `full` and on; the plane's upper edge is ragged by column, and
 * no pixel is lifted past `cap` of its run, so the lit tones and the strokes laid over them keep their order. A run's
 * colours keep their places: only the value plan of the near rows moves, and with it every drawn mark.
 */
export function moonlitFoot(
  pixels: Uint8Array,
  w: number,
  runs: readonly (readonly number[])[],
  { from, full, lift, cap = 0.62, seed = 1, keep }: { from: number; full: number; lift: number; cap?: number; seed?: number; keep?: (i: number) => boolean },
): void {
  const place = new Map<number, { run: readonly number[]; k: number }>();
  for (const run of runs) run.forEach((c, k) => { if (!place.has(c)) place.set(c, { run, k }); });
  const h = Math.floor(pixels.length / w);
  for (let y = Math.max(0, from - 4); y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    const at = place.get(pixels[i]!);
    if (!at || keep?.(i)) continue;
    const n = at.run.length - 1, top = Math.round(n * cap);
    if (at.k >= top) continue;
    const into = clamp01((y - from + 8 * (hash2(x >> 3, 1, seed) - 0.5)) / Math.max(1, full - from));
    const up = Math.round(lift * n * into);
    if (up > 0) pixels[i] = at.run[Math.min(top, at.k + up)]!;
  }
}
