import { bayer } from '../paint/noise';

/**
 * The lighthouse's turning beam on the map of Keri, drawn while the game runs (a lighthouse cycle: before, the beam stepped through four looks and blinked instead of sweeping). The painter gives the beam's box, the lamp
 * and the two colours; the game draws it at any angle, about 30 times a second, so it sweeps round smoothly. Pure, and
 * small, so the game can carry it without the map's painter.
 */
export interface MapBeam {
  /** The box it may light, in the map's fine pixels (inside the part of the map every screen shows). */
  x: number;
  y: number;
  w: number;
  h: number;
  /** The lamp, in the map's fine pixels. */
  lamp: { x: number; y: number };
  /** How much the map's slant squashes the beam up and down. */
  tilt: number;
  /** True from dusk to dawn: the beam turns; by day only a glint blinks on the lantern's glass. */
  lit: boolean;
  /** The beam's pale dots and its white core, places of the map's palette. */
  pale: number;
  white: number;
}

/** How long the lamp takes to turn half round, in milliseconds: its two arms then lie where they started. */
export const BEAM_HALF_TURN_MS = 2080;
/** By day, how long the glint on the glass shows and how long it is gone. */
export const GLINT_MS = 520;

/** The beam's angle at `t` milliseconds. */
export function beamAngle(t: number): number {
  return 0.3 + (Math.PI * t) / BEAM_HALF_TURN_MS;
}

/**
 * Draws the beam at `t` milliseconds into `out` (the box's `w` x `h`, palette places, 0 clear): from dusk to dawn its two
 * arms seen at the map's slant, a wedge of pale dots thinning with the distance, white near the lamp; by day the glint.
 */
export function drawBeam(beam: MapBeam, t: number, out: Uint8Array): void {
  out.fill(0);
  const { w, h, lamp } = beam;
  const lx = lamp.x - beam.x, ly = lamp.y - beam.y;
  if (!beam.lit) {
    if (Math.floor(t / GLINT_MS) % 2 === 1) for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, -1], [0, 1]] as const) {
      const x = lx + dx, y = ly + dy;
      if (x >= 0 && y >= 0 && x < w && y < h) out[y * w + x] = beam.white;
    }
    return;
  }
  const angle = beamAngle(t);
  const ax = Math.cos(angle), ay = Math.sin(angle) * beam.tilt, len = Math.hypot(ax, ay);
  const reach = 130 * (0.55 + 0.45 * Math.abs(Math.cos(angle)));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = x - lx, dy = y - ly;
    const along = Math.abs(dx * ax + dy * ay) / len, across = Math.abs(dx * ay - dy * ax) / len;
    if (along > reach || across > 1 + along * 0.13) continue;
    const strength = (1 - along / reach) * (1 - across / (1.5 + along * 0.13));
    // the dots stay put on the map's grid as the beam passes over them, as the painted beam's did
    if (strength > bayer(x + beam.x, y + beam.y) * 1.25) out[y * w + x] = strength > 0.75 ? beam.white : beam.pale;
  }
}
