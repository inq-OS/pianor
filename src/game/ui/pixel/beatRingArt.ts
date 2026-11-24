import { ringPoint, type BeatRing, type PaceMark } from '../../../core/layout/beat';
import { C } from './palette';

/**
 * The beat ring's picture (core_13 rule 2), painted afresh as it changes into a square of pixels (palette places, 0
 * clear), drawn in ink on the parchment: a faint circle, one grey dot a beat with the first beat larger, the hand from the centre, the lit dot bright, and in a
 * learning run the dot of the key just played and the mark where the hand was at the press coloured by how the key kept
 * the student's pace: green in step, orange a little early or late, red far off; a click lights its dot blue, the colour of the cursor.
 */
export const BEAT_RING_SIZE = 32;

/**
 * The ring's measures at `BEAT_RING_SIZE`, scaled with the ring: the dots' circle; the mark sits on a circle inside it, the
 * hand reaches to the inner edge of the dots.
 */
const DOT_CIRCLE = 11.5;
const MARK_CIRCLE = 6;
const DOT_RADIUS = 2.6;
const FIRST_DOT_RADIUS = 3.4;

/** The colour of a key's dot and mark against the pace. */
export function paceColour(mark: Omit<PaceMark, 'at'> | null): number {
  if (!mark) return C.blue;
  if (mark.side === 'even') return C.leaf;
  return mark.far ? C.red : C.orange;
}

function disc(pixels: Uint8Array, size: number, cx: number, cy: number, radius: number, colour: number): void {
  const r2 = radius * radius;
  for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
    for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
      if (x < 0 || y < 0 || x >= size || y >= size) continue;
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r2) pixels[y * size + x] = colour;
    }
  }
}

/** A line `width` pixels thick from (x0, y0) to (x1, y1). */
function line(pixels: Uint8Array, size: number, x0: number, y0: number, x1: number, y1: number, width: number, colour: number): void {
  const steps = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2);
  for (let i = 0; i <= steps; i++) disc(pixels, size, x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps, width / 2, colour);
}

/** Paint `ring` into `pixels`, `size` pixels square (`BEAT_RING_SIZE` by default), cleared first. */
export function paintBeatRing(ring: BeatRing, pixels: Uint8Array, size = BEAT_RING_SIZE): void {
  pixels.fill(C.clear);
  const k = size / BEAT_RING_SIZE;
  const centre = (size - 1) / 2;
  const dotCircle = DOT_CIRCLE * k;
  // the circle the dots stand on, faint; while a key off the pace is lit the whole circle takes its colour, twice as thick,
  // so a key early or late shows by more than a dot's colour
  const off = ring.mark !== null && ring.mark.side !== 'even' && ring.lit !== null && ring.glow > 0;
  const around = Math.ceil(2 * Math.PI * dotCircle * 1.5);
  const thick = Math.max(1, k * (off ? 2 : 1));
  for (let i = 0; i < around; i++) {
    const p = ringPoint(i, around, dotCircle);
    disc(pixels, size, centre + p.x, centre + p.y, thick / 2 + 0.25, off ? paceColour(ring.mark) : C.lock);
  }
  if (ring.hand !== null) {
    const tip = ringPoint(ring.hand, ring.beats, dotCircle - (DOT_RADIUS + 1) * k);
    // thick, so it reads at a glance
    line(pixels, size, centre, centre, centre + tip.x, centre + tip.y, Math.max(2, 2 * k), C.ink);
  }
  // a lit dot is bright against grey ones: blue for a click, the pace's colour for a key; the first beat's dot is larger and paler
  const lit = paceColour(ring.mark);
  for (let i = 0; i < ring.beats; i++) {
    const p = ringPoint(i, ring.beats, dotCircle);
    const on = ring.lit === i && ring.glow > 0;
    const colour = on ? lit : i === 0 ? C.ink : C.lock;
    disc(pixels, size, centre + p.x, centre + p.y, ((i === 0 ? FIRST_DOT_RADIUS : DOT_RADIUS) + (on ? 0.6 + ring.glow * 0.8 : 0)) * k, colour);
  }
  if (ring.mark) {
    const p = ringPoint(ring.mark.at, ring.beats, MARK_CIRCLE * k);
    disc(pixels, size, centre + p.x, centre + p.y, 2.2 * k, paceColour(ring.mark));
  }
  disc(pixels, size, centre, centre, 1.5 * k, C.ink);
}
