import { hueTurn, lchOf } from '../../src/game/ui/pixel/paint/lab.ts';

/**
 * Measures a run of colours (one material from dark to light) the way the study of Monkey Island 2's backgrounds did
 * (docs/art-direction.md): its lightness in CIE L* (0 black to 100 white, about 2 the smallest difference an eye sees),
 * the steps between neighbours, how far the hue turns along the run, and where the most saturated colour sits.
 * Pure code: used by `npm run art:check` and by the palette's tests. Colours are measured by `lchOf` (`paint/lab.ts`).
 */

export interface RunStats {
  lightness: number[];
  /** Lightness differences between neighbours (all positive in a run dark to light). */
  steps: number[];
  maxStep: number;
  /** Hue turn from the darkest to the lightest colour, in degrees for each 10 L*; null for a grey run. */
  hueTurnPer10L: number | null;
  /** Where the most saturated colour sits: 0 the dark end, 1 the light end. */
  chromaPeakAt: number;
  /** True when the run is so grey that its hue means nothing (fewer than two colours of chroma 8 or more). */
  grey: boolean;
  /** The hue of its darkest and its lightest colour that are not grey; null for a grey run. */
  hueFrom: number | null;
  hueTo: number | null;
  /** The lightest colour's lightness and saturation. */
  light: { L: number; chroma: number };
}

/** Below this chroma a colour's hue is noise: a near-black or near-white end of a run does not count for its turn. */
const GREY_CHROMA = 8;

/** The measures of one run, given dark to light. */
export function runStats(run: readonly number[]): RunStats {
  const labs = run.map(lchOf);
  const lightness = labs.map((c) => c.l);
  const steps = lightness.slice(1).map((L, i) => L - lightness[i]!);
  if (steps.some((s) => s < 0)) throw new Error('runStats: a run is given dark to light');
  const chromatic = labs.filter((c) => c.chroma >= GREY_CHROMA);
  const grey = chromatic.length < 2;
  const first = chromatic[0];
  const last = chromatic[chromatic.length - 1];
  const span = grey ? 0 : last!.l - first!.l;
  const turn = grey ? 0 : hueTurn(first!.hue, last!.hue);
  let peak = 0;
  labs.forEach((c, i) => {
    if (c.chroma > labs[peak]!.chroma) peak = i;
  });
  return {
    lightness,
    steps,
    maxStep: steps.length ? Math.max(...steps) : 0,
    hueTurnPer10L: grey || span <= 0 ? null : (10 * turn) / span,
    chromaPeakAt: labs.length > 1 ? peak / (labs.length - 1) : 0,
    grey,
    hueFrom: grey ? null : first!.hue,
    hueTo: grey ? null : last!.hue,
    light: { L: labs[labs.length - 1]!.l, chroma: labs[labs.length - 1]!.chroma },
  };
}
