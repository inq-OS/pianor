import type { Ramp } from './figureModel';

/**
 * The template character's colours (d144): every material is a ramp of five tones, deep (the shaded edge), dark, mid,
 * light and high. A ramp is made from its mid tone: the darker tones lean cool and the lighter ones warm, as painted shade
 * and light do, with strong steps between them, because the 1991 game's people are saturated and clearly banded.
 */
export function ramp(mid: number, opts: { spread?: number; warm?: number } = {}): Ramp {
  const r = ((mid >> 16) & 255) / 255;
  const g = ((mid >> 8) & 255) / 255;
  const b = (mid & 255) / 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  const d = mx - mn;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let hue = 0;
  if (d) {
    if (mx === r) hue = ((g - b) / d) % 6;
    else if (mx === g) hue = (b - r) / d + 2;
    else hue = (r - g) / d + 4;
    hue *= 60;
  }
  const spread = opts.spread ?? 1.3;
  const warm = opts.warm ?? 1;
  const tone = (dl: number, dh: number, ds: number): number => {
    const L = Math.max(0.03, Math.min(0.96, l + dl * spread));
    const H = (((hue + dh * warm) % 360) + 360) % 360;
    const S = Math.max(0, Math.min(1, s * ds));
    const C = (1 - Math.abs(2 * L - 1)) * S;
    const X = C * (1 - Math.abs(((H / 60) % 2) - 1));
    const m = L - C / 2;
    const [rr, gg, bb] = H < 60 ? [C, X, 0] : H < 120 ? [X, C, 0] : H < 180 ? [0, C, X] : H < 240 ? [0, X, C] : H < 300 ? [X, 0, C] : [C, 0, X];
    const to = (v: number) => Math.round(Math.max(0, Math.min(1, v + m)) * 255);
    return (to(rr) << 16) | (to(gg) << 8) | to(bb);
  };
  // turn the hue toward a target, the short way round
  const toward = (target: number, amount: number) => ((((target - hue + 540) % 360) - 180) * amount);
  return [
    tone(-0.27, toward(250, 0.2), 1.05),
    tone(-0.14, toward(250, 0.1), 1.1),
    mid,
    tone(0.12, toward(50, 0.12), 1.0),
    tone(0.22, toward(50, 0.2), 0.9),
  ];
}

/** A ghost's version of a ramp: the same lightness, pale sea-green, no warmth. */
export function ghostly(mid: number): Ramp {
  const l = (((mid >> 16) & 255) * 0.3 + ((mid >> 8) & 255) * 0.59 + (mid & 255) * 0.11) / 255;
  const lift = 0.35 + l * 0.55;
  const c = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255);
  return ramp((c(lift * 0.62) << 16) | (c(lift * 0.86) << 8) | c(lift * 0.9), { spread: 0.9, warm: 0 });
}

/** Skins, set by hand: a made ramp's shade turns skin red. */
export const SKINS = {
  fair: [0x7a4430, 0xb46c4e, 0xe2a07a, 0xf4c49c, 0xfde0c0],
  tan: [0x5a2e1c, 0x8e5232, 0xc07c52, 0xdca074, 0xf0c294],
  ruddy: [0x6e3428, 0xa85a44, 0xd88a68, 0xeeae8a, 0xfcd0b0],
  deep: [0x2e160e, 0x4e2a1a, 0x7a4a2e, 0x9c6a46, 0xbe8e64],
} as const satisfies Record<string, Ramp>;

/** The named colours a person's layers take (the mid tone of each ramp). */
export const COLOURS = {
  navy: 0x2c3a74,
  indigo: 0x262c58,
  sea: 0x1e58a8,
  denim: 0x2a56b0,
  olive: 0x557a26,
  moss: 0x3e5a24,
  mustard: 0xe4a01c,
  rust: 0xc0381e,
  red: 0xc8302a,
  scarlet: 0xb82a20,
  plum: 0x7a2a4a,
  cream: 0xecd896,
  /** a sailor shirt's off-white ground */
  sail: 0xdcdcd0,
  khaki: 0xe0d49a,
  tan: 0x7a5432,
  brown: 0x6a5232,
  oak: 0x4a2e1c,
  leather: 0x3a2622,
  soot: 0x3a2c24,
  charcoal: 0x3e3a40,
  brass: 0xc89a2c,
  gold: 0xc08a2c,
  grey: 0xc8c0b4,
  auburn: 0x5a2414,
  chestnut: 0x4a2a18,
  'dark-brown': 0x4e3024,
  black: 0x2e1e14,
  ash: 0xb0a89c,
} as const;
export type ColourName = keyof typeof COLOURS;
