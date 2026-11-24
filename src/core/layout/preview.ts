/**
 * What an edit would add to the staff, for its preview before it is made (d286: no silent tool action). The scene lays out
 * the piece as it is and as the edit would leave it; the marks found only in the second are drawn faint over the staff
 * while the pointer waits, so the author sees where a tie, a slur or a pre-note goes before the click. Pure.
 */
import type { GraceGlyph, SlurGlyph, StaffLayout, TieGlyph } from './staffTypes';

/** A finger number an edit would write or change, where the staff draws it. */
export interface AddedFinger {
  system: number;
  x: number;
  y: number;
  finger: number;
}

/** The marks of `after` that `before` lacks, by where they are drawn. */
export interface AddedMarks {
  ties: TieGlyph[];
  slurs: SlurGlyph[];
  graces: GraceGlyph[];
  /** Finger numbers that are new or changed on a note that stays where it was (AUTO, a finger item). */
  fingers: AddedFinger[];
}

const r = (v: number) => Math.round(v * 10) / 10;
const tieKey = (g: TieGlyph) => [g.system, g.staff, r(g.x1), r(g.x2), r(g.y), g.up].join(':');
const slurKey = (g: SlurGlyph) => [g.system, g.staff, r(g.x1), r(g.x2), r(g.y1), r(g.y2), r(g.controlY)].join(':');
const graceKey = (g: GraceGlyph) => [g.system, g.staff, r(g.x), r(g.y)].join(':');

function added<T>(before: readonly T[], after: readonly T[], key: (g: T) => string): T[] {
  const had = new Set(before.map(key));
  return after.filter((g) => !had.has(key(g)));
}

/** The ties, slurs and pre-notes drawn in `after` and not in `before` (an edit that takes a mark away adds none). */
export function addedMarks(before: StaffLayout, after: StaffLayout): AddedMarks {
  return { ties: added(before.ties, after.ties, tieKey), slurs: added(before.slurs, after.slurs, slurKey), graces: added(before.graces, after.graces, graceKey), fingers: addedFingers(before, after) };
}

/** No marks: what a refused edit adds. */
export const NO_MARKS: AddedMarks = { ties: [], slurs: [], graces: [], fingers: [] };

/** The heads whose finger the edit sets or changes, matched by their place on the staff (a head that moved shows none). */
function addedFingers(before: StaffLayout, after: StaffLayout): AddedFinger[] {
  const was = new Map(before.notes.map((n) => [[n.system, r(n.x), r(n.y)].join(':'), n.finger]));
  const fingers: AddedFinger[] = [];
  for (const n of after.notes) {
    const key = [n.system, r(n.x), r(n.y)].join(':');
    if (n.finger === null || !was.has(key) || was.get(key) === n.finger) continue;
    fingers.push({ system: n.system, x: n.fingerX, y: n.fingerY, finger: n.finger });
  }
  return fingers;
}

/** Points along a quadratic curve from (x1, y1) through the control point to (x2, y2), `steps` + 1 of them. */
export function curvePoints(x1: number, y1: number, cx: number, cy: number, x2: number, y2: number, steps: number): { x: number; y: number }[] {
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    points.push({ x: (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * cx + t * t * x2, y: (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * cy + t * t * y2 });
  }
  return points;
}

/** The polyline a tie is drawn as (core_09.AC10): it bows away from the heads by twice its height. */
export function tiePoints(tie: TieGlyph): { x: number; y: number }[] {
  const bow = (tie.up ? -1 : 1) * tie.height * 2;
  return curvePoints(tie.x1, tie.y, (tie.x1 + tie.x2) / 2, tie.y + bow, tie.x2, tie.y, 12);
}

/** The polyline a slur is drawn as (core_09.AC27): from its first head to its last, bowing to its control point. */
export function slurPoints(slur: SlurGlyph): { x: number; y: number }[] {
  return curvePoints(slur.x1, slur.y1, (slur.x1 + slur.x2) / 2, slur.controlY, slur.x2, slur.y2, 16);
}

/**
 * The curve a waiting tie or slur shows from its first note to the pointer, before the pointer is on a note it can end on:
 * it bows above when the note's stem points down (the side a slur takes), by a share of the distance, at most `maxBow`.
 */
export function pendingArc(from: { x: number; y: number }, to: { x: number; y: number }, up: boolean, maxBow: number): { x: number; y: number }[] {
  const bow = Math.min(maxBow, Math.hypot(to.x - from.x, to.y - from.y) * 0.2) * (up ? -1 : 1);
  return curvePoints(from.x, from.y, (from.x + to.x) / 2, (from.y + to.y) / 2 + bow, to.x, to.y, 16);
}
