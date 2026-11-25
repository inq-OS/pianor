import type { AccidentalKind } from '../../../core/layout/staff';
import type { OrnamentKind } from '../../../core/chart/ornaments';

/**
 * Notation shapes drawn by the staff view, as plain data (no Phaser). All original, drawn from simple
 * curves and bitmaps. Coordinates are in staff spaces inside the glyph's box, y pointing down.
 * Pixel-art restyling happens in the art pass; these are plain, high-contrast shapes.
 */

export interface Pt {
  x: number;
  y: number;
}

/** Catmull-Rom spline through `points`, sampled `perSegment` times per segment. */
export function smoothPath(points: readonly Pt[], perSegment = 10): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(points.length - 1, i + 2)]!;
    for (let s = 0; s < perSegment; s++) {
      const t = s / perSegment;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      });
    }
  }
  out.push(points[points.length - 1]!);
  return out;
}

/** Treble clef: one stroke in a 2.6 x 7 box. The loop circles the G line, 4.5 spaces from the top. */
export const TREBLE_CLEF_STROKE: readonly Pt[] = smoothPath([
  { x: 0.85, y: 6.2 }, { x: 0.72, y: 6.75 }, { x: 1.2, y: 7.0 }, { x: 1.62, y: 6.65 }, { x: 1.62, y: 6.0 },
  { x: 1.52, y: 4.2 }, { x: 1.4, y: 2.2 }, { x: 1.45, y: 1.1 }, { x: 1.75, y: 0.3 }, { x: 2.1, y: 0.1 },
  { x: 2.2, y: 0.55 }, { x: 1.9, y: 1.3 }, { x: 1.2, y: 2.2 }, { x: 0.65, y: 3.1 }, { x: 0.5, y: 4.0 },
  { x: 0.75, y: 4.85 }, { x: 1.45, y: 5.2 }, { x: 2.05, y: 4.8 }, { x: 2.15, y: 4.0 }, { x: 1.75, y: 3.45 },
  { x: 1.25, y: 3.55 }, { x: 1.0, y: 4.05 }, { x: 1.2, y: 4.6 },
]);

/** Bass clef in a 3 x 3.2 box. The ball sits on the F line, one space below the top line. */
export const BASS_CLEF_STROKE: readonly Pt[] = smoothPath([
  { x: 0.55, y: 1.0 }, { x: 0.95, y: 0.4 }, { x: 1.7, y: 0.25 }, { x: 2.3, y: 0.7 }, { x: 2.35, y: 1.5 },
  { x: 1.9, y: 2.4 }, { x: 1.1, y: 3.0 }, { x: 0.3, y: 3.25 },
]);
export const BASS_CLEF_BALL = { x: 0.6, y: 1.0, r: 0.42 };
export const BASS_CLEF_DOTS: readonly Pt[] = [{ x: 2.8, y: 0.5 }, { x: 2.8, y: 1.5 }];

/** Quarter rest zig-zag in a 1 x 3 box (top to bottom), centred on the middle line. */
export const QUARTER_REST_STROKE: readonly Pt[] = smoothPath([
  { x: 0.25, y: 0.1 }, { x: 0.75, y: 0.7 }, { x: 0.3, y: 1.3 }, { x: 0.75, y: 1.9 }, { x: 0.2, y: 2.3 },
  { x: 0.65, y: 2.55 }, { x: 0.55, y: 3.0 },
], 6);

/**
 * The brace of a grand staff, as a path in a box of width 1 and height 1 (y down): a "{" whose point faces left.
 * Scale x by the brace width and y by its height.
 */
export const BRACE_PATH: readonly Pt[] = smoothPath([
  { x: 1, y: 0 }, { x: 0.55, y: 0.05 }, { x: 0.5, y: 0.2 }, { x: 0.5, y: 0.38 }, { x: 0, y: 0.5 },
  { x: 0.5, y: 0.62 }, { x: 0.5, y: 0.8 }, { x: 0.55, y: 0.95 }, { x: 1, y: 1 },
], 8);

/** 3 x 5 bitmaps for time signature digits. */
export const DIGITS: Record<string, readonly string[]> = {
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['###', '..#', '###', '#..', '###'],
  '3': ['###', '..#', '###', '..#', '###'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '###', '..#', '###'],
  '6': ['###', '#..', '###', '#.#', '###'],
  '7': ['###', '..#', '.#.', '.#.', '.#.'],
  '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '###'],
};

/** One stroke of an accidental: a polyline in staff spaces from the glyph's centre (x across, y down), and its thickness in staff spaces. */
export interface AccidentalStroke {
  points: readonly Pt[];
  width: number;
}

/**
 * The sharp, flat and natural, each inside its box in `ACCIDENTAL_BOX` (core/layout/staff.ts). Thick bars and thin
 * stems, as the noteheads and clefs here are plain high-contrast shapes; a pixel-art pass can restyle them later.
 */
export const ACCIDENTAL_STROKES: Record<AccidentalKind, readonly AccidentalStroke[]> = {
  sharp: [
    { points: [{ x: -0.3, y: -1.4 }, { x: -0.3, y: 1.4 }], width: 0.12 },
    { points: [{ x: 0.22, y: -1.4 }, { x: 0.22, y: 1.4 }], width: 0.12 },
    { points: [{ x: -0.55, y: -0.1 }, { x: 0.55, y: -0.5 }], width: 0.3 },
    { points: [{ x: -0.55, y: 0.5 }, { x: 0.55, y: 0.1 }], width: 0.3 },
  ],
  flat: [
    { points: [{ x: -0.25, y: -1.7 }, { x: -0.25, y: 0.5 }], width: 0.13 },
    { points: smoothPath([{ x: -0.25, y: 0.5 }, { x: 0.2, y: 0.35 }, { x: 0.36, y: -0.05 }, { x: 0.32, y: -0.35 }, { x: 0.08, y: -0.45 }, { x: -0.25, y: -0.2 }], 6), width: 0.13 },
  ],
  natural: [
    { points: [{ x: -0.22, y: -1.5 }, { x: -0.22, y: 0.6 }], width: 0.12 },
    { points: [{ x: 0.22, y: -0.6 }, { x: 0.22, y: 1.5 }], width: 0.12 },
    { points: [{ x: -0.4, y: -0.1 }, { x: 0.4, y: -0.45 }], width: 0.22 },
    { points: [{ x: -0.4, y: 0.45 }, { x: 0.4, y: 0.1 }], width: 0.22 },
  ],
};

/**
 * The ornament signs (core_09.AC60, d303), in staff spaces from the sign's centre, inside the box `ORNAMENT_BOX`
 * (core/layout/staff.ts) gives: the trill's letters t and r with a short wave, the mordent's zigzag (the lower mordent
 * with a stroke through it), and the turn lying on its side. Plain strokes like the accidentals.
 */
export const ORNAMENT_STROKES: Record<OrnamentKind, readonly AccidentalStroke[]> = {
  trill: [
    { points: [{ x: -0.75, y: -0.55 }, { x: -0.75, y: 0.4 }, { x: -0.55, y: 0.5 }], width: 0.16 },
    { points: [{ x: -0.95, y: -0.2 }, { x: -0.5, y: -0.2 }], width: 0.12 },
    { points: [{ x: -0.25, y: 0.5 }, { x: -0.25, y: -0.2 }], width: 0.16 },
    { points: smoothPath([{ x: -0.25, y: 0.05 }, { x: -0.05, y: -0.2 }, { x: 0.15, y: -0.2 }], 3), width: 0.12 },
    { points: [{ x: 0.3, y: 0.15 }, { x: 0.5, y: -0.05 }, { x: 0.7, y: 0.15 }, { x: 0.9, y: -0.05 }], width: 0.1 },
  ],
  upperMordent: [
    { points: [{ x: -0.8, y: 0.2 }, { x: -0.45, y: -0.3 }, { x: -0.15, y: 0.25 }, { x: 0.15, y: -0.3 }, { x: 0.45, y: 0.25 }, { x: 0.8, y: -0.2 }], width: 0.16 },
  ],
  lowerMordent: [
    { points: [{ x: -0.8, y: 0.2 }, { x: -0.45, y: -0.3 }, { x: -0.15, y: 0.25 }, { x: 0.15, y: -0.3 }, { x: 0.45, y: 0.25 }, { x: 0.8, y: -0.2 }], width: 0.16 },
    { points: [{ x: 0, y: -0.55 }, { x: 0, y: 0.55 }], width: 0.12 },
  ],
  turn: [
    // point-symmetric like the printed sign: a bold wave lying on its side, each tip curled back toward the middle
    {
      points: smoothPath([{ x: -0.8, y: -0.1 }, { x: -0.55, y: 0.25 }, { x: -0.25, y: 0.2 }, { x: 0, y: 0 }, { x: 0.25, y: -0.2 }, { x: 0.55, y: -0.25 }, { x: 0.8, y: 0.1 }], 4),
      width: 0.22,
    },
    { points: smoothPath([{ x: -0.8, y: -0.1 }, { x: -0.7, y: -0.32 }, { x: -0.48, y: -0.3 }, { x: -0.45, y: -0.12 }], 3), width: 0.12 },
    { points: smoothPath([{ x: 0.8, y: 0.1 }, { x: 0.7, y: 0.32 }, { x: 0.48, y: 0.3 }, { x: 0.45, y: 0.12 }], 3), width: 0.12 },
  ],
};
