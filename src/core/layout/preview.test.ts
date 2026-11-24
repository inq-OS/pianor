// Covers ft_1_02d.AC25, ft_1_02d.AC26, ft_1_02d.AC29, ft_1_02d.AC30 (d286: every pick shows its result before the click).
import { describe, expect, it } from 'vitest';
import { arcInto } from '../editor/arcs';
import { toChart } from '../editor/chart';
import { autoFingers } from '../editor/fingers';
import { graceFromPlace } from '../editor/graces';
import { tieAll } from '../editor/ties';
import { emptyPiece, type Edit, type EditorNote, type EditorPiece, type NoteRef } from '../editor/model';
import { editorStaff } from '../editor/staff';
import { addedMarks, curvePoints, NO_MARKS, pendingArc, slurPoints, tiePoints } from './preview';

const n = (bar: number, start: number, step: EditorNote['step']): EditorNote => ({ hand: 'RH', bar, start, length: 'quarter', step, octave: 4, alter: 0 });
/** Right hand: C C E G in bar 0. */
const piece: EditorPiece = { ...emptyPiece({ title: 'Preview', hands: 'RH', beats: 4, bars: 2 }), notes: [n(0, 0, 'C'), n(0, 480, 'C'), n(0, 960, 'E'), n(0, 1440, 'G')] };
const at = (start: number, step: NoteRef['step']): NoteRef => ({ hand: 'RH', bar: 0, start, step, octave: 4 });
const layoutOf = (p: EditorPiece) => editorStaff(p, toChart(p, { id: 'draft' }), { width: 1366, height: 344 });
const made = (edit: Edit) => {
  if (!edit.ok) throw new Error(`refused: ${edit.reason}`);
  return edit.piece;
};

describe('the preview of a pick (d286)', () => {
  it('ft_1_02d.AC25 note A then the same key right after shows one tie between their heads, and nothing else', () => {
    const before = layoutOf(piece);
    const after = layoutOf(made(arcInto(piece, at(0, 'C'), at(480, 'C'))));
    const marks = addedMarks(before, after);
    expect(marks.ties).toHaveLength(1);
    expect(marks.slurs).toEqual([]);
    expect(marks.graces).toEqual([]);
    const tie = marks.ties[0]!;
    const heads = after.notes.filter((h) => h.index === 0 || h.index === 1).map((h) => h.x);
    expect(tie.x1).toBeGreaterThanOrEqual(Math.min(...heads) - after.staffSpace);
    expect(tie.x2).toBeLessThanOrEqual(Math.max(...heads) + after.staffSpace);
  });

  it('ft_1_02d.AC25 note A then another key shows one slur from A to that note', () => {
    const marks = addedMarks(layoutOf(piece), layoutOf(made(arcInto(piece, at(0, 'C'), at(1440, 'G')))));
    expect(marks.ties).toEqual([]);
    expect(marks.slurs).toHaveLength(1);
    expect(marks.slurs[0]).toMatchObject({ from: 0, to: 3 });
  });

  it('ft_1_02d.AC25 an edit that takes a mark away, or none, shows nothing added', () => {
    const tied = made(arcInto(piece, at(0, 'C'), at(480, 'C')));
    expect(addedMarks(layoutOf(tied), layoutOf(piece))).toEqual(NO_MARKS);
    expect(addedMarks(layoutOf(piece), layoutOf(piece))).toEqual(NO_MARKS);
  });

  it('ft_1_02d.AC26 a pre-note pick shows the small head before its note at the pointed place', () => {
    const marks = addedMarks(layoutOf(piece), layoutOf(made(graceFromPlace(piece, at(960, 'E'), 'D', 4))));
    expect(marks.graces).toHaveLength(1);
    expect(marks.graces[0]).toMatchObject({ main: 2, label: 'D' });
  });

  it('ft_1_02d.AC25 the curves start and end on their ends and bow to their side', () => {
    expect(curvePoints(0, 0, 5, -10, 10, 0, 4)).toEqual([{ x: 0, y: 0 }, { x: 2.5, y: -3.75 }, { x: 5, y: -5 }, { x: 7.5, y: -3.75 }, { x: 10, y: 0 }]);
    const tie = tiePoints({ system: 0, staff: 0, from: 0, to: 1, x1: 0, x2: 20, y: 50, up: true, height: 3 });
    expect(tie[0]).toEqual({ x: 0, y: 50 });
    expect(tie.at(-1)).toEqual({ x: 20, y: 50 });
    expect(Math.min(...tie.map((p) => p.y))).toBeLessThan(50);
    const slur = slurPoints({ system: 0, staff: 0, from: 0, to: 1, x1: 0, x2: 20, y1: 40, y2: 30, controlY: 60, up: false, label: { x: 0, y: 0 } });
    expect(slur[0]).toEqual({ x: 0, y: 40 });
    expect(slur.at(-1)).toEqual({ x: 20, y: 30 });
    expect(Math.max(...slur.map((p) => p.y))).toBeGreaterThan(40);
  });

  it('ft_1_02d.AC25 the curve to the pointer follows it, bows to its side, and never more than the bow allowed', () => {
    const up = pendingArc({ x: 0, y: 0 }, { x: 100, y: 0 }, true, 8);
    expect(up[0]).toEqual({ x: 0, y: 0 });
    expect(up.at(-1)).toEqual({ x: 100, y: 0 });
    expect(Math.min(...up.map((p) => p.y))).toBeCloseTo(-4);
    const down = pendingArc({ x: 0, y: 0 }, { x: 10, y: 0 }, false, 8);
    expect(Math.max(...down.map((p) => p.y))).toBeCloseTo(1);
  });

  it('ft_1_02d.AC29 ALL shows every tie it would make, and only those', () => {
    const repeats: EditorPiece = { ...piece, notes: [n(0, 0, 'C'), n(0, 480, 'C'), n(0, 960, 'E'), n(0, 1440, 'E')] };
    const marks = addedMarks(layoutOf(repeats), layoutOf(made(tieAll(repeats))));
    expect(marks.ties).toHaveLength(2);
    expect(marks.slurs).toEqual([]);
  });

  it('ft_1_02d.AC30 AUTO shows the finger it would write on each note that gets one, where the staff draws fingers', () => {
    const after = autoFingers(piece, { fingerings: {} }).piece;
    const marks = addedMarks(layoutOf(piece), layoutOf(after));
    expect(marks.fingers).toHaveLength(after.notes.filter((x) => x.finger !== undefined).length);
    expect(marks.fingers.length).toBeGreaterThan(0);
    const drawn = layoutOf(after).notes.find((h) => h.finger !== null)!;
    expect(marks.fingers).toContainEqual({ system: drawn.system, x: drawn.fingerX, y: drawn.fingerY, finger: drawn.finger });
    // fingers that stay as they were show nothing
    expect(addedMarks(layoutOf(after), layoutOf(after)).fingers).toEqual([]);
  });
});
