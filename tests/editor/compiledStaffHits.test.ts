// Covers ft_1_02a.AC1.
// Hit testing on charts made by the real piece compiler (editor files, compiler, layout and hit test together), so it lives in
// tests/editor; the unit tests of hitTest alone are next to it in src/core/editor/hitTest.test.ts (docs/testing.md section 1).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { naturalAtPosition, staffPosition } from '../../src/core/chart/pitch';
import type { Chart } from '../../src/core/chart/schema';
import { toAbc, toMeta } from '../../src/core/editor/abc';
import { hitTest, pointOf } from '../../src/core/editor/hitTest';
import { emptyPiece, placeNote, type EditorPiece } from '../../src/core/editor/model';
import { layoutStaff } from '../../src/core/layout/staff';
import { checkPiece } from '../../src/core/piece/check';
import { parseLevels } from '../../src/core/piece/levelsTable';
import { contentStyles } from '../../tools/piece/styles';

const { levels } = parseLevels(readFileSync(join(__dirname, '../../content/curriculum/levels.json'), 'utf-8'));
const VIEWPORT = { width: 1366, height: 480 };

function chartOf(piece: EditorPiece): Chart {
  const result = checkPiece({ styles: contentStyles, folder: null, abc: toAbc(piece), meta: JSON.stringify(toMeta(piece, { id: 'own-t', level: 5, author: 'T' })), levels });
  if (!result.compiled.chart) throw new Error(result.diagnostics.map((d) => d.message).join('; '));
  return result.compiled.chart;
}

/** A piece with one note per hand, so it compiles; the round trips below test the empty bars. */
function withAnchor(hands: 'RH' | 'both', beats: 2 | 3 | 4, bars: number): EditorPiece {
  let piece = emptyPiece({ title: 'T', hands, beats, bars });
  const add = (hand: 'RH' | 'LH', octave: number) => {
    const edit = placeNote(piece, { hand, bar: bars - 1, start: 0, length: 'eighth', step: 'C', octave });
    if (!edit.ok) throw new Error(edit.reason);
    piece = edit.piece;
  };
  add('RH', 4);
  if (hands === 'both') add('LH', 3);
  return piece;
}

describe('the white key at a staff position', () => {
  it('is the inverse of the staff position, on both clefs', () => {
    expect(naturalAtPosition(0, 'treble')).toEqual({ step: 'E', octave: 4 });
    expect(naturalAtPosition(-2, 'treble')).toEqual({ step: 'C', octave: 4 });
    expect(naturalAtPosition(10, 'bass')).toEqual({ step: 'C', octave: 4 });
    for (const clef of ['treble', 'bass'] as const) {
      for (let p = -12; p <= 20; p++) expect(staffPosition({ ...naturalAtPosition(p, clef), alter: 0 }, clef)).toBe(p);
    }
  });
});

describe('hit testing', () => {
  for (const [hands, beats] of [['RH', 4], ['RH', 3], ['both', 4], ['both', 2]] as const) {
    it(`round-trips every eighth and staff position of every empty bar (${hands}, ${beats}/4)`, () => {
      const piece = withAnchor(hands, beats, 4);
      const chart = chartOf(piece);
      const layout = layoutStaff(chart, { viewport: VIEWPORT });
      const staves = layout.systems[0]!.staves.length;
      for (let bar = 0; bar < 3; bar++) { // the last bar holds the anchor notes
        for (let start = 0; start < beats * 480; start += 240) {
          for (let staff = 0; staff < staves; staff++) {
            for (let position = -6; position <= 14; position++) {
              const point = pointOf(layout, chart, { bar, start, staff, position })!;
              const hit = hitTest(layout, chart, point);
              const system = layout.systems[layout.bars[bar]!.system]!;
              if (staves === 2) {
                // between the staves the gap is split in the middle: a point on the other side belongs to the other staff
                const middle = (system.staves[0]!.bottomLineY + system.staves[1]!.topLineY) / 2;
                const other = staff === 0 ? point.y >= middle : point.y < middle;
                if (other) {
                  expect(hit).toMatchObject({ kind: 'place', bar, start, staff: 1 - staff });
                  continue;
                }
              }
              expect(hit, `bar ${bar} start ${start} staff ${staff} position ${position}`).toMatchObject({ kind: 'place', bar, start, staff, position });
            }
          }
        }
      }
    });
  }

  it('finds the note under the pointer, on its head', () => {
    let piece = emptyPiece({ title: 'T', hands: 'RH', beats: 4, bars: 2 });
    for (const [start, step] of [[0, 'C'], [480, 'E'], [960, 'G']] as const) {
      const edit = placeNote(piece, { hand: 'RH', bar: 0, start, length: 'quarter', step, octave: 4 });
      if (edit.ok) piece = edit.piece;
    }
    const chart = chartOf(piece);
    const layout = layoutStaff(chart, { viewport: VIEWPORT });
    for (const n of layout.notes) expect(hitTest(layout, chart, { x: n.x, y: n.y })).toEqual({ kind: 'note', noteIndex: n.index });
    // and a note's head is where the inverse says a note at its time and position goes
    for (const n of layout.notes) {
      const note = chart.notes[n.index]!;
      const at = pointOf(layout, chart, { bar: note.bar, start: note.tick - chart.bars[note.bar]!.startTick, staff: n.staff, position: n.position })!;
      expect(at.x).toBeCloseTo(n.x, 6);
      expect(at.y).toBeCloseTo(n.y, 6);
    }
  });

  it('gives the right staff of a grand staff: above the middle the treble, below it the bass', () => {
    const chart = chartOf(withAnchor('both', 4, 2));
    const layout = layoutStaff(chart, { viewport: VIEWPORT });
    const [treble, bass] = layout.systems[0]!.staves;
    const x = pointOf(layout, chart, { bar: 0, start: 480, staff: 0, position: 4 })!.x;
    expect(hitTest(layout, chart, { x, y: treble!.topLineY })).toMatchObject({ trackId: 'rh', clef: 'treble' });
    expect(hitTest(layout, chart, { x, y: bass!.bottomLineY })).toMatchObject({ trackId: 'lh', clef: 'bass' });
  });

  it('gives nothing left of the first bar (the clef and time signature)', () => {
    const chart = chartOf(withAnchor('RH', 4, 2));
    const layout = layoutStaff(chart, { viewport: VIEWPORT });
    expect(hitTest(layout, chart, { x: 5, y: layout.systems[0]!.topLineY })).toBeNull();
  });
});
