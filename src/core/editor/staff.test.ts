// Covers ft_1_02d.AC27, ft_1_02a.AC10, ft_1_02a.AC11, ft_1_02a.AC12.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { naturalAtPosition, staffPosition } from '../chart/pitch';
import type { StaffLayout } from '../layout/staff';
import { toChart } from './chart';
import { hitTest, placeClick, pointOf, targetOf } from './hitTest';
import { EDITOR_LENGTHS, emptyPiece, placeNote, placeRest, restLengthFor, type EditorHands, type EditorLength, type EditorPiece } from './model';
import { barBoxes, barsInRect, columnWidth, drawnWhileWriting, editorFrame, editorStaff, pageOfBar, repeatPreview, RESERVE_CHORD, RESERVE_HIGH, RESERVE_LOW, shadowsFor, targetBox } from './staff';

/** The editor's staff area on 1280x720 and on the 1366x768 laptop at 4x, on 960x540 at 3x, and on a 1920x1080 screen. */
const VIEWPORTS = [{ width: 1280, height: 296 }, { width: 1366, height: 344 }, { width: 960, height: 222 }, { width: 1920, height: 864 }];
const LAPTOP = VIEWPORTS[1]!;

const staffOf = (piece: EditorPiece, viewport = LAPTOP) => {
  const chart = toChart(piece, { id: 'draft' });
  return { chart, layout: editorStaff(piece, chart, viewport) };
};
/** What must never move while writing: the staff size, the clef and the lines of the first line, and the time signature. */
const frameOf = (layout: StaffLayout) => ({
  staffSpace: layout.staffSpace, linesPerPage: layout.linesPerPage,
  clefs: layout.clefs.filter((c) => c.system === 0), timeSignatures: layout.timeSignatures,
  staffLines: layout.staffLines.filter((l) => l.system === 0).map((l) => ({ staff: l.staff, y: l.y, x1: l.x1 })),
});
/** The widest chord of the piece, in staff positions: notes of one hand that start together. */
const widestChord = (piece: EditorPiece) => {
  const chords = new Map<string, number[]>();
  for (const n of piece.notes) {
    const key = `${n.hand}:${n.bar}:${n.start}`;
    chords.set(key, [...(chords.get(key) ?? []), staffPosition({ step: n.step, alter: 0, octave: n.octave }, n.hand === 'RH' ? 'treble' : 'bass')]);
  }
  return Math.max(0, ...[...chords.values()].map((p) => Math.max(...p) - Math.min(...p)));
};
const ok = <T extends { ok: boolean }>(edit: T) => {
  if (!edit.ok) throw new Error(`refused: ${JSON.stringify(edit)}`);
  return (edit as unknown as { piece: EditorPiece }).piece;
};

describe('the editor staff stays put while notes are written', () => {
  it('no note or rest moves the clef, the lines or the time signature, or changes the staff size (ft_1_02a.AC11)', () => {
    fc.assert(fc.property(
      fc.constantFrom(...VIEWPORTS), fc.constantFrom<EditorHands>('RH', 'LH', 'both'), fc.constantFrom<2 | 3 | 4>(2, 3, 4), fc.constantFrom(4, 8, 12),
      fc.array(fc.record({
        hand: fc.constantFrom('RH' as const, 'LH' as const), bar: fc.nat(11), slot: fc.nat(15), position: fc.integer({ min: -2, max: 10 }),
        length: fc.constantFrom<EditorLength>(...EDITOR_LENGTHS), rest: fc.nat(5),
      }), { maxLength: 30 }),
      (viewport, hands, beats, bars, adds) => {
        let piece = emptyPiece({ title: 'T', hands, beats, bars });
        const frame = frameOf(staffOf(piece, viewport).layout);
        for (const add of adds) {
          const at = { hand: add.hand, bar: add.bar, start: add.slot * 120 };
          const { step, octave } = naturalAtPosition(add.position, add.hand === 'RH' ? 'treble' : 'bass');
          const edit = add.rest === 0
            ? placeRest(piece, { ...at, length: restLengthFor(add.length) })
            : placeNote(piece, { ...at, length: add.length, step, octave });
          // a chord wider than an octave may move the staff (d078)
          if (!edit.ok || widestChord(edit.piece) > RESERVE_CHORD) continue;
          piece = edit.piece;
          expect(frameOf(staffOf(piece, viewport).layout)).toEqual(frame);
        }
      },
    ), { numRuns: 100 });
  });

  it('a chord of two half notes an octave apart in a left-hand bar does not move the staff (ft_1_02a.AC11)', () => {
    // the counterexample fast-check found (seed 825292906): G2 and G3 together, whose stem goes up an octave from G3
    const viewport = VIEWPORTS[0]!;
    const empty = emptyPiece({ title: 'T', hands: 'LH', beats: 4, bars: 8 });
    let piece = empty;
    for (const position of [0, 7]) {
      const { step, octave } = naturalAtPosition(position, 'bass');
      piece = ok(placeNote(piece, { hand: 'LH', bar: 5, start: 240, length: 'half', step, octave }));
    }
    expect(frameOf(staffOf(piece, viewport).layout)).toEqual(frameOf(staffOf(empty, viewport).layout));
  });

  it('no chord up to an octave inside the reserved positions moves the staff, whichever way its stem goes (ft_1_02a.AC11)', () => {
    for (const hand of ['RH', 'LH'] as const) {
      const empty = emptyPiece({ title: 'T', hands: hand, beats: 4, bars: 4 });
      const frame = frameOf(staffOf(empty).layout);
      const clef = hand === 'RH' ? 'treble' : 'bass';
      for (let low = RESERVE_LOW; low <= RESERVE_HIGH; low++) {
        for (let high = low + 1; high <= Math.min(RESERVE_HIGH, low + RESERVE_CHORD); high++) {
          const piece = [low, high].reduce((p, position) => ok(placeNote(p, { hand, bar: 0, start: 0, length: 'quarter', ...naturalAtPosition(position, clef) })), empty);
          expect(frameOf(staffOf(piece).layout), `${hand} ${low}..${high}`).toEqual(frame);
        }
      }
    }
  });

  it('the staff size depends on the screen and the hands, meter and key, not on the notes (ft_1_02a.AC11)', () => {
    const empty = emptyPiece({ title: 'T', hands: 'both', beats: 4, bars: 8 });
    const withNote = ok(placeNote(empty, { hand: 'RH', bar: 0, start: 0, length: 'eighth', step: 'C', octave: 5 }));
    expect(editorFrame(withNote, LAPTOP)).toEqual(editorFrame(empty, LAPTOP));
    // the laptop holds one line of a two-hand staff at 11 pixels between lines (12 before room for chords); a large screen two lines
    expect(editorFrame(empty, LAPTOP)).toEqual({ staffSpace: 11, linesPerPage: 1 });
    expect(editorFrame(empty, VIEWPORTS[3]!).linesPerPage).toBe(2);
  });

  it('at the smallest view (320x180 at 1x, a staff area of 90 rows) the grand staff fits in every meter and key, at a smaller staff', () => {
    for (const beats of [2, 3, 4] as const) {
      for (const fifths of [-7, 0, 7]) {
        const piece = { ...emptyPiece({ title: 'T', hands: 'both', beats, bars: 8 }), fifths };
        const { layout } = staffOf(piece, { width: 320, height: 90 });
        expect(layout.fits, `${beats}/4, ${fifths} fifths`).toBe(true);
      }
    }
  });
});

describe('bars as wide as what is written in them', () => {
  it('an empty bar is one note wide; a bar grows with its notes and only later bars move (ft_1_02a.AC11)', () => {
    const empty = emptyPiece({ title: 'T', hands: 'both', beats: 4, bars: 8 });
    const before = staffOf(empty).layout;
    const S = before.staffSpace;
    expect(before.bars[0]!.width).toBeCloseTo((1.6 + columnWidth(480) + 0.8) * S);
    const after = staffOf(ok(placeNote(empty, { hand: 'RH', bar: 2, start: 0, length: 'quarter', step: 'C', octave: 5 }))).layout;
    expect(after.bars.slice(0, 2)).toEqual(before.bars.slice(0, 2));
    expect(after.bars[2]!.width).toBeGreaterThan(before.bars[2]!.width);
    expect(after.bars[3]!.x).toBeGreaterThan(before.bars[3]!.x);
  });

  it('bars that no longer fit a line go to the next line, and a page shows as many lines as the frame has (ft_1_02a.AC11)', () => {
    let piece = emptyPiece({ title: 'T', hands: 'both', beats: 4, bars: 8 });
    for (let bar = 0; bar < 8; bar++) {
      for (let start = 0; start < 1920; start += 240) piece = ok(placeNote(piece, { hand: 'RH', bar, start, length: 'eighth', step: 'C', octave: 5 }));
    }
    const { layout } = staffOf(piece);
    expect(layout.systems.length).toBeGreaterThan(1);
    expect(layout.pageCount).toBe(Math.ceil(layout.systems.length / layout.linesPerPage));
    expect(pageOfBar(layout, 7)).toBe(layout.systems[layout.bars[7]!.system]!.page);
    for (const system of layout.systems) {
      const bars = layout.bars.filter((b) => b.system === system.index);
      expect(bars.at(-1)!.x + bars.at(-1)!.width).toBeLessThanOrEqual(LAPTOP.width);
    }
  });

  it('core_09.AC55 a bar full of sixteenths in both hands fits one line on every screen, at the staff size an empty piece has', () => {
    for (const viewport of [...VIEWPORTS, { width: 320, height: 90 }]) {
      for (const beats of [2, 3, 4] as const) {
        const empty = emptyPiece({ title: 'T', hands: 'both', beats, bars: 4 });
        let piece = empty;
        for (let start = 0; start < beats * 480; start += 120) {
          piece = ok(placeNote(piece, { hand: 'RH', bar: 1, start, length: 'sixteenth', step: 'C', octave: 5 }));
          piece = ok(placeNote(piece, { hand: 'LH', bar: 1, start, length: 'sixteenth', step: 'C', octave: 3 }));
        }
        const { layout } = staffOf(piece, viewport);
        expect(frameOf(layout)).toEqual(frameOf(staffOf(empty, viewport).layout));
        const bar = layout.bars[1]!;
        expect(bar.x + bar.width).toBeLessThanOrEqual(viewport.width);
        // the heads stay apart: each column is at least a head and a little wider
        const xs = bar.columns!.map((c) => c.x);
        for (let i = 1; i < xs.length; i++) expect(xs[i]! - xs[i - 1]!).toBeGreaterThanOrEqual(1.3 * layout.staffSpace);
      }
    }
  });
});

describe('shadow notes and the rests drawn while writing', () => {
  it('a shadow note at every place a note can go, at the tonic of the key, in its column (ft_1_02a.AC10)', () => {
    let piece = emptyPiece({ title: 'T', hands: 'RH', beats: 4, bars: 2 });
    piece = ok(placeNote(piece, { hand: 'RH', bar: 0, start: 0, length: 'half', step: 'E', octave: 4 }));
    const { layout } = staffOf(piece);
    const shadows = shadowsFor(piece, layout);
    expect(shadows.map((s) => [s.bar, s.start])).toEqual([[0, 960], [1, 0]]);
    // C major: the tonic C is the third space of the treble staff (position 5); in G major it is G (position 2)
    expect(shadows[0]!.position).toBe(5);
    expect(shadowsFor({ ...piece, fifths: 1 }, layout)[0]!.position).toBe(2);
    expect(shadows[0]!.x).toBe(layout.bars[0]!.columns!.find((c) => c.tick === 960)!.x);
  });

  it('only the rests the author placed are drawn while writing; free time is not (ft_1_02a.AC10)', () => {
    let piece = emptyPiece({ title: 'T', hands: 'RH', beats: 4, bars: 2 });
    piece = ok(placeNote(piece, { hand: 'RH', bar: 0, start: 0, length: 'quarter', step: 'E', octave: 4 }));
    piece = ok(placeRest(piece, { hand: 'RH', bar: 0, start: 480, length: 'quarter' }));
    const { chart, layout } = staffOf(piece);
    expect(layout.rests.length).toBe(3); // the placed quarter, the half after it, the empty bar
    const drawn = drawnWhileWriting(layout, chart, piece);
    expect(drawn.rests.map((r) => chart.rests[r.index]!.tick)).toEqual([480]);
  });
});

describe('a click on the editor staff', () => {
  it('a click near a shadow note places a note there with the selected length (ft_1_02a.AC10)', () => {
    let piece = emptyPiece({ title: 'T', hands: 'both', beats: 4, bars: 4 });
    piece = ok(placeNote(piece, { hand: 'RH', bar: 0, start: 0, length: 'half', step: 'E', octave: 4 }));
    const { chart, layout } = staffOf(piece);
    const shadow = shadowsFor(piece, layout).find((s) => s.hand === 'RH' && s.bar === 0)!;
    // a little to the right of the shadow, at G4
    const hit = hitTest(layout, chart, { x: shadow.x + layout.staffSpace, y: layout.systems[0]!.staves[0]!.bottomLineY - layout.staffSpace });
    if (hit?.kind !== 'place') throw new Error('not a place');
    expect(hit).toMatchObject({ bar: 0, start: 960, step: 'G', octave: 4 });
    const click = placeClick(piece, hit, 'quarter');
    expect(click).toMatchObject({ kind: 'add', note: { start: 960, length: 'quarter' } });
    expect(pointOf(layout, chart, { bar: 0, start: 960, staff: 0, position: 2 })!.x).toBe(shadow.x);
  });
});

describe('the part of a bar an action changes (ft_1_02a.AC12)', () => {
  const both = () => {
    let piece = emptyPiece({ title: 'T', hands: 'both', beats: 4, bars: 4 });
    piece = ok(placeNote(piece, { hand: 'RH', bar: 0, start: 0, length: 'half', step: 'C', octave: 5 }));
    piece = ok(placeNote(piece, { hand: 'RH', bar: 0, start: 0, length: 'half', step: 'E', octave: 5 }));
    piece = ok(placeRest(piece, { hand: 'RH', bar: 0, start: 960, length: 'quarter' }));
    return piece;
  };
  const place = (piece: EditorPiece, hand: 'RH' | 'LH', bar: number, start: number) => {
    const { layout, chart } = staffOf(piece);
    const staff = hand === 'RH' ? 0 : 1;
    const at = pointOf(layout, chart, { bar, start, staff, position: 0 })!;
    const hit = hitTest(layout, chart, at);
    if (hit?.kind !== 'place') throw new Error('not a place');
    return hit;
  };

  it('over a note or the column of a chord: the whole chord, for its length (ft_1_02a.AC12)', () => {
    const piece = both();
    const chord = { hand: 'RH' as const, bar: 0, start: 0, end: 960 };
    expect(targetOf(piece, { hand: 'RH', bar: 0, start: 0, step: 'E', octave: 5 }, 'quarter')).toEqual({ ...chord, notes: [
      { hand: 'RH', bar: 0, start: 0, step: 'C', octave: 5 }, { hand: 'RH', bar: 0, start: 0, step: 'E', octave: 5 },
    ] });
    // above or below the chord's heads, in its column: the same chord
    expect(targetOf(piece, place(piece, 'RH', 0, 0), 'quarter')).toMatchObject({ ...chord, notes: [{ step: 'C' }, { step: 'E' }] });
  });

  it('on a placed rest: that rest; on a shadow: the room the new note or rest takes (ft_1_02a.AC12)', () => {
    const piece = both();
    expect(targetOf(piece, place(piece, 'RH', 0, 960), 'whole')).toEqual({ hand: 'RH', bar: 0, start: 960, end: 1440, notes: [] });
    expect(targetOf(piece, place(piece, 'RH', 0, 1440), 'whole')).toEqual({ hand: 'RH', bar: 0, start: 1440, end: 1920, notes: [] });
    expect(targetOf(piece, place(piece, 'LH', 0, 0), 'quarter')).toEqual({ hand: 'LH', bar: 0, start: 0, end: 480, notes: [] });
    expect(targetOf(piece, place(piece, 'LH', 0, 0), 'quarter', 'rest')).toEqual({ hand: 'LH', bar: 0, start: 0, end: 480, notes: [] });
  });

  it('nothing where no action can write: inside a note of that hand (ft_1_02a.AC12)', () => {
    let piece = emptyPiece({ title: 'T', hands: 'both', beats: 4, bars: 4 });
    piece = ok(placeNote(piece, { hand: 'RH', bar: 0, start: 0, length: 'half', step: 'C', octave: 5 }));
    piece = ok(placeNote(piece, { hand: 'LH', bar: 0, start: 480, length: 'quarter', step: 'C', octave: 3 }));
    // the left hand's quarter makes a column at 480, inside the right hand's half
    expect(targetOf(piece, place(piece, 'RH', 0, 480), 'quarter')).toBeNull();
  });

  it('the box covers the columns of its time on its own staff, between the neighbours (ft_1_02a.AC12)', () => {
    const piece = both();
    const { layout } = staffOf(piece);
    const columns = layout.bars[0]!.columns!;
    const x = (tick: number) => columns.find((c) => c.tick === tick)!.x;
    const chordBox = targetBox(layout, { hand: 'RH', bar: 0, start: 0, end: 960 })!;
    expect(chordBox.x1).toBe(layout.bars[0]!.x);
    expect(chordBox.x2).toBeCloseTo((x(0) + x(960)) / 2);
    const restBox = targetBox(layout, { hand: 'RH', bar: 0, start: 960, end: 1440 })!;
    expect(restBox.x1).toBeCloseTo(chordBox.x2);
    expect(restBox.x2).toBeCloseTo((x(960) + x(1440)) / 2);
    const last = targetBox(layout, { hand: 'RH', bar: 0, start: 1440, end: 1920 })!;
    expect(last.x2).toBe(layout.bars[0]!.x + layout.bars[0]!.width);
    const [treble, bass] = layout.systems[0]!.staves;
    expect(chordBox.y1).toBeLessThan(treble!.topLineY);
    expect(chordBox.y2).toBeGreaterThan(treble!.bottomLineY);
    expect(chordBox.y2).toBeLessThan(bass!.topLineY);
    const lh = targetBox(layout, { hand: 'LH', bar: 0, start: 0, end: 480 })!;
    expect(lh.y1).toBeGreaterThan(treble!.bottomLineY);
    expect(lh.page).toBe(0);
  });
});

describe('the highlight of selected bars', () => {
  // two bars on one system with two staves: the box covers both staves, one staff space beyond them
  const layout = {
    staffSpace: 10,
    bars: [
      { system: 0, x: 0, width: 100 },
      { system: 0, x: 100, width: 100 },
      { system: 1, x: 0, width: 100 },
    ],
    systems: [
      { page: 0, staves: [{ trackId: 'rh', topLineY: 50, bottomLineY: 90 }, { trackId: 'lh', topLineY: 120, bottomLineY: 160 }] },
      { page: 1, staves: [{ trackId: 'rh', topLineY: 50, bottomLineY: 90 }] },
    ],
  } as unknown as StaffLayout;

  it('draws one box per bar in range, spanning both staves of its system', () => {
    expect(barBoxes(layout, { from: 0, to: 1 })).toEqual([
      { x1: 0, x2: 100, y1: 40, y2: 170, page: 0 },
      { x1: 100, x2: 200, y1: 40, y2: 170, page: 0 },
    ]);
  });

  it('puts a bar on the next page on that page', () => {
    expect(barBoxes(layout, { from: 2, to: 2 })).toEqual([{ x1: 0, x2: 100, y1: 40, y2: 100, page: 1 }]);
  });

  it('ft_1_02d.AC27 the repeat pick lights the bars from its start to the pointer, either way round, with its signs on their outer sides', () => {
    expect(repeatPreview(layout, null, 1, 0)).toEqual({ boxes: [{ x1: 100, x2: 200, y1: 40, y2: 170, page: 0 }], signs: [{ side: 'start', x: 100, y1: 40, y2: 170 }, { side: 'end', x: 200, y1: 40, y2: 170 }] });
    const back = repeatPreview(layout, 1, 0, 0);
    expect(back.boxes).toHaveLength(2);
    expect(back.signs).toEqual([{ side: 'start', x: 0, y1: 40, y2: 170 }, { side: 'end', x: 200, y1: 40, y2: 170 }]);
    // a repeat that runs on to the next page shows only its start sign here, and only its end sign there
    expect(repeatPreview(layout, 0, 2, 0).signs.map((s) => s.side)).toEqual(['start']);
    expect(repeatPreview(layout, 0, 2, 1)).toEqual({ boxes: [{ x1: 0, x2: 100, y1: 40, y2: 100, page: 1 }], signs: [{ side: 'end', x: 100, y1: 40, y2: 100 }] });
  });
});

describe('the lasso picks the bars it touches', () => {
  const layout = {
    staffSpace: 10,
    bars: [
      { system: 0, x: 0, width: 100 },
      { system: 0, x: 100, width: 100 },
      { system: 1, x: 0, width: 100 },
      { system: 2, x: 0, width: 100 },
    ],
    systems: [
      { page: 0, staves: [{ trackId: 'rh', topLineY: 50, bottomLineY: 90 }, { trackId: 'lh', topLineY: 120, bottomLineY: 160 }] },
      { page: 0, staves: [{ trackId: 'rh', topLineY: 250, bottomLineY: 290 }] },
      { page: 1, staves: [{ trackId: 'rh', topLineY: 50, bottomLineY: 90 }] },
    ],
  } as unknown as StaffLayout;

  it('selects every bar on the page whose box the rectangle touches, first to last', () => {
    expect(barsInRect(layout, 0, { x1: 90, y1: 60, x2: 120, y2: 70 })).toEqual({ from: 0, to: 1 });
    expect(barsInRect(layout, 0, { x1: 50, y1: 100, x2: 60, y2: 260 })).toEqual({ from: 0, to: 2 });
  });

  it('takes the corners in any order', () => {
    expect(barsInRect(layout, 0, { x1: 120, y1: 70, x2: 90, y2: 60 })).toEqual({ from: 0, to: 1 });
  });

  it('is null when it touches no bar, and ignores bars on another page', () => {
    expect(barsInRect(layout, 0, { x1: 300, y1: 0, x2: 310, y2: 10 })).toBeNull();
    expect(barsInRect(layout, 1, { x1: 0, y1: 40, x2: 10, y2: 50 })).toEqual({ from: 3, to: 3 });
  });
});
