/**
 * Colours as the eye measures them (CIE L*a*b*, D65): lightness `l` from 0 (black) to 100 (white), `chroma` how far a
 * colour is from grey, `hue` its angle in degrees (about 30 red, 90 yellow, 140 green, 250 blue, 300 violet). Equal
 * steps of L* look equal, which steps of a hex value do not; about 2 is the smallest step that can be seen. The
 * palette's runs are measured and filled in these units (d111).
 */
export interface Lch {
  l: number;
  chroma: number;
  hue: number;
}

const WHITE = [0.95047, 1, 1.08883] as const;

const toLinear = (v: number): number => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const fromLinear = (v: number): number => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);
const curve = (t: number): number => (t > 216 / 24389 ? Math.cbrt(t) : (t * (24389 / 27) + 16) / 116);
const uncurve = (f: number): number => (f ** 3 > 216 / 24389 ? f ** 3 : (116 * f - 16) / (24389 / 27));

/** A colour (0xRRGGBB) as lightness, chroma and hue. */
export function lchOf(hex: number): Lch {
  const [r, g, b] = [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255].map((v) => toLinear(v / 255)) as [number, number, number];
  const fx = curve((0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / WHITE[0]);
  const fy = curve((0.2126729 * r + 0.7151522 * g + 0.072175 * b) / WHITE[1]);
  const fz = curve((0.0193339 * r + 0.119192 * g + 0.9503041 * b) / WHITE[2]);
  const a = 500 * (fx - fy), bb = 200 * (fy - fz);
  return { l: 116 * fy - 16, chroma: Math.hypot(a, bb), hue: ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360 };
}

/** The colour (0xRRGGBB) nearest to a lightness, chroma and hue; what the screen cannot show is cut to what it can. */
export function hexOf({ l, chroma, hue }: Lch): number {
  const a = chroma * Math.cos((hue * Math.PI) / 180), bb = chroma * Math.sin((hue * Math.PI) / 180);
  const fy = (l + 16) / 116;
  const x = uncurve(fy + a / 500) * WHITE[0], y = uncurve(fy) * WHITE[1], z = uncurve(fy - bb / 200) * WHITE[2];
  const channel = (v: number): number => Math.round(Math.max(0, Math.min(1, fromLinear(v))) * 255);
  const r = channel(3.2404542 * x - 1.5371385 * y - 0.4985314 * z);
  const g = channel(-0.969266 * x + 1.8760108 * y + 0.041556 * z);
  const b = channel(0.0556434 * x - 0.2040259 * y + 1.0572252 * z);
  return (r << 16) | (g << 8) | b;
}

/** The turn from hue `from` to hue `to` by the short way round, in degrees (-180 to 180). */
export function hueTurn(from: number, to: number): number {
  return ((((to - from) % 360) + 540) % 360) - 180;
}

/**
 * The colour a part `t` (0 to 1) of the way from `a` to `b`: lightness and chroma go straight, the hue turns the short
 * way round, so a colour between two of a run keeps the run's strength instead of greying as a mix of the two would.
 */
export function between(a: number, b: number, t: number): number {
  const from = lchOf(a), to = lchOf(b);
  // A grey has no hue of its own: it takes the other end's, so no stray colour shows on the way.
  const fromHue = from.chroma < 1 ? to.hue : from.hue, toHue = to.chroma < 1 ? from.hue : to.hue;
  return hexOf({
    l: from.l + (to.l - from.l) * t,
    chroma: from.chroma + (to.chroma - from.chroma) * t,
    hue: (fromHue + hueTurn(fromHue, toHue) * t + 360) % 360,
  });
}

/**
 * A run of colours with as many put between each two neighbours as it takes for no step of lightness to be over
 * `maxStep` (L*): a coarse run made long, so a shade that lies between two of its colours is dithered between near
 * tones and not between far ones (docs/art-direction.md rule 19). The run's own colours stay, in their order.
 */
export function fineRun(run: readonly number[], maxStep: number): number[] {
  return run.flatMap((hex, i) => {
    if (i === 0) return [hex];
    const from = run[i - 1]!;
    const gaps = Math.max(0, Math.ceil(Math.abs(lchOf(hex).l - lchOf(from).l) / maxStep - 1e-9) - 1);
    return [...Array.from({ length: gaps }, (_, k) => between(from, hex, (k + 1) / (gaps + 1))), hex];
  });
}

/** How bright a colour is to the eye, 0 to 1 (WCAG's relative luminance, which contrast is counted from). */
function luminance(hex: number): number {
  const channel = (v: number): number => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channel(((hex >> 16) & 255) / 255) + 0.7152 * channel(((hex >> 8) & 255) / 255) + 0.0722 * channel((hex & 255) / 255);
}

/** The contrast of two colours, 1 to 21 (WCAG): ink a student reads on a ground keeps more than 7. */
export function contrast(a: number, b: number): number {
  return (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
}
