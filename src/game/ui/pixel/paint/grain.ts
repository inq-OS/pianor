import { hash2 } from './noise';

/**
 * The grain of scanned paint. The 1991 pictures were painted by hand and scanned down to a palette: every area is a
 * scatter of three to five near tones of its run, a third of the pixels unlike all four neighbours, laid often in short
 * level dashes, with almost no ordered dither (the MI2 atlas, `projects/painter/vocabulary/mi2-manner.md` point 1).
 * Ours were clean flat bands. `grain` moves each pixel of a run a place or two up or down that run now and then, in dashes
 * of one to three pixels, so the value plan stays as it was painted and only the surface turns to paint.
 *
 * `runs` are whole runs dark to light (a scene's `fine` runs), each bare or with a `dash`: how many times longer its
 * dashes are (the sea's and the sky's are strokes along the swell, MI2's sea swatches); a colour of no run (ink, foam, a
 * light, a glint) is left alone, and so is a pixel `keep` says to keep. `strength` is how often a pixel moves to each
 * side (0 to 0.5).
 */
export function grain(
  pixels: Uint8Array,
  w: number,
  runs: readonly (readonly number[] | { run: readonly number[]; dash: number })[],
  { seed, strength = 0.3, keep }: { seed: number; strength?: number; keep?: (i: number) => boolean },
): void {
  const place = new Map<number, { run: readonly number[]; k: number; dash: number }>();
  for (const entry of runs) {
    const { run, dash } = 'run' in entry ? entry : { run: entry, dash: 1 };
    run.forEach((c, k) => { if (!place.has(c)) place.set(c, { run, k, dash }); });
  }
  const h = Math.floor(pixels.length / w);
  for (let y = 0; y < h; y++) {
    // each row has its own dash lengths and offsets, so the dashes do not stack into columns
    const pick = hash2(y, seed, 1);
    const len = pick < 0.5 ? 1 : pick < 0.8 ? 2 : 3;
    const shift = Math.floor(hash2(y, seed, 2) * len);
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const at = place.get(pixels[i]!);
      if (!at || keep?.(i)) continue;
      const long = Math.round(len * at.dash);
      const r = hash2(Math.floor((x + shift * at.dash) / long), y, seed + 3 + (at.dash > 1 ? 7 : 0));
      // mostly one place, now and then two: three to five near tones in every area
      const far = strength / 6;
      const step = r < far ? -2 : r < strength ? -1 : r > 1 - far ? 2 : r > 1 - strength ? 1 : 0;
      const k = at.k + step;
      if (step !== 0 && k >= 0 && k < at.run.length) pixels[i] = at.run[k]!;
    }
  }
}
