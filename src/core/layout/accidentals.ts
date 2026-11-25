/**
 * Accidentals on the staff (docs/notation.md sections 4 and 5), pure: the glyph boxes, where a key signature puts its
 * sharps or flats, how a chord stacks its accidentals in columns, and the room a key signature needs above and below the
 * staff. `staff.ts` builds the layout from these; the view (`src/game/ui/staff`) draws the shapes inside the boxes.
 */
import { staffPosition, type Clef, type Spelling } from '../chart/pitch.ts';

/** The clearance two accidentals of one chord keep vertically when they would share a column. */
const ACCIDENTAL_CLEAR = 0.2;
/**
 * Accidental glyph boxes in staff spaces (docs/notation.md section 4): the width, and how far the glyph reaches above and
 * below the centre of its note. The view draws the glyph shapes (`src/game/ui/staff/glyphs.ts`) inside these boxes.
 */
export const ACCIDENTAL_BOX = {
  sharp: { width: 1.1, up: 1.4, down: 1.4 },
  flat: { width: 0.9, up: 1.7, down: 0.6 },
  natural: { width: 0.8, up: 1.5, down: 1.5 },
} as const;
export type AccidentalKind = keyof typeof ACCIDENTAL_BOX;
export const accidentalKind = (alter: number): AccidentalKind => (alter > 0 ? 'sharp' : alter < 0 ? 'flat' : 'natural');

/** Where a key signature puts its accidentals (docs/notation.md section 5), in the order of the sharps and of the flats. */
const KEY_PLACES: Record<Clef, { sharp: readonly string[]; flat: readonly string[] }> = {
  treble: { sharp: ['F5', 'C5', 'G5', 'D5', 'A4', 'E5', 'B4'], flat: ['B4', 'E5', 'A4', 'D5', 'G4', 'C5', 'F4'] },
  bass: { sharp: ['F3', 'C3', 'G3', 'D3', 'A2', 'E3', 'B2'], flat: ['B2', 'E3', 'A2', 'D3', 'G2', 'C3', 'F2'] },
};

/** The accidentals of a key signature on a staff: their alter and staff position (0 = bottom line), in order. */
export function keySignaturePositions(fifths: number, clef: Clef): { alter: 1 | -1; position: number }[] {
  const alter = fifths > 0 ? 1 : -1;
  const names = KEY_PLACES[clef][fifths > 0 ? 'sharp' : 'flat'].slice(0, Math.abs(fifths));
  return names.map((name) => ({ alter, position: staffPosition({ step: name[0] as Spelling['step'], alter: 0, octave: Number(name.slice(1)) }, clef) }));
}

/**
 * The column of each accidental of one chord (docs/notation.md section 4), 0 nearest the head, or -1 for a head that
 * prints none. The highest accidental takes the first column, then the lowest, then the rest alternately inwards; each
 * takes the nearest column in which it overlaps none of the accidentals already there.
 */
export function accidentalColumns(heads: readonly { position: number; alter: number | null }[]): number[] {
  const printed = heads.flatMap((h, i) => (h.alter === null ? [] : [i]));
  const byHigh = [...printed].sort((a, b) => heads[b]!.position - heads[a]!.position);
  const byLow = [...byHigh].reverse();
  const order: number[] = [];
  for (let k = 0; order.length < printed.length; k++) {
    for (const i of [byHigh[k], byLow[k]]) if (i !== undefined && !order.includes(i)) order.push(i);
  }
  const columns: number[] = heads.map(() => -1);
  const placed: { top: number; bottom: number }[][] = [];
  for (const i of order) {
    const head = heads[i]!;
    const box = ACCIDENTAL_BOX[accidentalKind(head.alter!)];
    const centre = head.position / 2; // staff spaces above the bottom line
    const span = { top: centre + box.up, bottom: centre - box.down };
    let column = 0;
    while (placed[column]?.some((o) => span.bottom < o.top + ACCIDENTAL_CLEAR && o.bottom < span.top + ACCIDENTAL_CLEAR)) column++;
    if (!placed[column]) placed[column] = [];
    placed[column]!.push(span);
    columns[i] = column;
  }
  return columns;
}

/**
 * The signs a key change draws at the start of its bar (core_09.AC57, docs/notation.md section 5): a natural for each
 * sign of the old key the new one drops (all of them when sharps turn to flats or back), then the new key's signature.
 * `AX-3 provisional:` the cancelling naturals are always drawn, so the student sees which signs no longer hold.
 */
export function keyChangeSigns(from: number, to: number, clef: Clef): { alter: 1 | -1 | 0; position: number }[] {
  const old = keySignaturePositions(from, clef);
  const sameWay = Math.sign(from) === Math.sign(to);
  const dropped = sameWay ? old.slice(Math.abs(to)) : old;
  return [...dropped.map(({ position }) => ({ alter: 0 as const, position })), ...keySignaturePositions(to, clef)];
}

/** The room signs at these staff positions need above the top line and below the bottom line, in staff spaces. */
export function signRooms(signs: readonly { alter: number; position: number }[]): { above: number; below: number } {
  let above = 0;
  let below = 0;
  for (const { alter, position } of signs) {
    const box = ACCIDENTAL_BOX[accidentalKind(alter)];
    above = Math.max(above, position / 2 + box.up - 4);
    below = Math.max(below, box.down - position / 2);
  }
  return { above, below };
}
