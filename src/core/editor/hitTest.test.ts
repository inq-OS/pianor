// Covers ft_1_02a.AC1, ft_1_02a.AC9, ft_1_02d.AC33: the staff of the editor for a piece of both hands, also while a hand has no notes yet.
import { describe, expect, it } from 'vitest';
import { layoutStaff } from '../layout/staff';
import { toChart } from './chart';
import { hitTest, placeClick, pointOf, type Hit } from './hitTest';
import { emptyPiece, placeNote, placeRest, type EditorPiece } from './model';

const viewport = { width: 1280, height: 600 };
const staffOf = (hands: 'RH' | 'LH' | 'both') => {
  const chart = toChart(emptyPiece({ title: 'T', hands, beats: 4, bars: 2 }), { id: 'draft' });
  return { chart, layout: layoutStaff(chart, { viewport, allPlayTracks: true }) };
};

describe('the editor staff', () => {
  it('ft_1_02a.AC1 is a grand staff for both hands, even with no notes yet', () => {
    const { layout } = staffOf('both');
    expect(layout.systems[0]!.staves.map((s) => s.clef)).toEqual(['treble', 'bass']);
  });

  it('is a single staff with the right clef for one hand', () => {
    expect(staffOf('LH').layout.systems[0]!.staves.map((s) => s.clef)).toEqual(['bass']);
    expect(staffOf('RH').layout.systems[0]!.staves.map((s) => s.clef)).toEqual(['treble']);
  });

  it('ft_1_02a.AC1 finds the place on the bass staff of a piece for both hands, and on the treble staff above it', () => {
    const { chart, layout } = staffOf('both');
    const bass = pointOf(layout, chart, { bar: 0, start: 0, staff: 1, position: 2 })!;
    expect(hitTest(layout, chart, bass)).toMatchObject({ kind: 'place', staff: 1, trackId: 'lh', clef: 'bass', position: 2 });
    const treble = pointOf(layout, chart, { bar: 0, start: 0, staff: 0, position: 2 })!;
    expect(hitTest(layout, chart, treble)).toMatchObject({ kind: 'place', staff: 0, trackId: 'rh', clef: 'treble', position: 2 });
  });
});

describe('a click on a place (ft_1_02a.AC9)', () => {
  const place = (over: Partial<Extract<Hit, { kind: 'place' }>> = {}): Extract<Hit, { kind: 'place' }> =>
    ({ kind: 'place', staff: 0, trackId: 'rh', clef: 'treble', bar: 0, start: 0, position: 0, step: 'E', octave: 4, ...over });
  const withC = (): EditorPiece => {
    const edit = placeNote(emptyPiece({ title: 'T', hands: 'RH', beats: 4, bars: 1 }), { hand: 'RH', bar: 0, start: 0, length: 'half', step: 'C', octave: 4 });
    if (!edit.ok) throw new Error(edit.reason);
    return edit.piece;
  };

  it('selects the note that is already at that start and pitch', () => {
    expect(placeClick(withC(), place({ step: 'C' }), 'eighth')).toEqual({ kind: 'select', ref: { hand: 'RH', bar: 0, start: 0, step: 'C', octave: 4 } });
  });

  it('adds a chord note, with the chord\'s length, on an empty pitch of an occupied start', () => {
    expect(placeClick(withC(), place(), 'eighth')).toEqual({ kind: 'add', note: { hand: 'RH', bar: 0, start: 0, step: 'E', octave: 4, length: 'half', alter: 0 } });
  });

  it('adds a note on an empty start with the selected length, for the hand of the staff', () => {
    expect(placeClick(withC(), place({ start: 960, trackId: 'lh', step: 'C', octave: 3 }), 'quarter')).toEqual({ kind: 'add', note: { hand: 'LH', bar: 0, start: 960, step: 'C', octave: 3, length: 'quarter', alter: 0 } });
  });
});

describe('rest mode and placed rests', () => {
  const place = (over: Partial<Extract<Hit, { kind: 'place' }>> = {}): Extract<Hit, { kind: 'place' }> =>
    ({ kind: 'place', staff: 0, trackId: 'rh', clef: 'treble', bar: 0, start: 0, position: 0, step: 'E', octave: 4, ...over });
  const empty = () => emptyPiece({ title: 'T', hands: 'RH', beats: 4, bars: 1 });

  it('in rest mode a click on a free place adds a rest of the selected length, shortened to fit and never dotted', () => {
    expect(placeClick(empty(), place(), 'quarter', 'rest')).toEqual({ kind: 'addRest', rest: { hand: 'RH', bar: 0, start: 0, length: 'quarter' } });
    expect(placeClick(empty(), place({ start: 480 }), 'whole', 'rest')).toEqual({ kind: 'addRest', rest: { hand: 'RH', bar: 0, start: 480, length: 'half' } });
  });

  it('a note put on a placed rest takes its place, with the room the rest leaves', () => {
    const edit = placeRest(empty(), { hand: 'RH', bar: 0, start: 0, length: 'quarter' });
    if (!edit.ok) throw new Error(edit.reason);
    expect(placeClick(edit.piece, place(), 'half')).toEqual({ kind: 'add', note: { hand: 'RH', bar: 0, start: 0, step: 'E', octave: 4, length: 'half', alter: 0 }, over: { hand: 'RH', bar: 0, start: 0 } });
  });
});

describe('the key signature in the editor (core_09.AC8)', () => {
  const keyed = (fifths: number, mode: 'major' | 'minor' = 'major'): EditorPiece => ({ ...emptyPiece({ title: 'T', hands: 'RH', beats: 4, bars: 2 }), fifths, mode });

  it('a click on a sign of the key signature is a key hit on its staff (it opens the key choice)', () => {
    const piece = keyed(1);
    const chart = toChart(piece, { id: 'draft' });
    const layout = layoutStaff(chart, { viewport, allPlayTracks: true });
    const sharp = layout.keySignature[0]!;
    expect(hitTest(layout, chart, { x: sharp.x, y: sharp.y })).toEqual({ kind: 'key', staff: 0, system: 0 });
  });

  it('a click on the time signature of the first line is a time hit (it opens the time choice)', () => {
    const chart = toChart(keyed(2), { id: 'draft' });
    const layout = layoutStaff(chart, { viewport, allPlayTracks: true });
    const time = layout.timeSignature;
    expect(hitTest(layout, chart, { x: time.x + layout.staffSpace / 2, y: time.yNum })).toEqual({ kind: 'time' });
  });

  it('a click in the clef and key area, on the staff, is a key hit even with no key', () => {
    const chart = toChart(keyed(0), { id: 'draft' });
    const layout = layoutStaff(chart, { viewport, allPlayTracks: true });
    const staff = layout.systems[0]!.staves[0]!;
    const x = layout.clefs[0]!.x;
    const y = staff.bottomLineY - (8 * layout.staffSpace) / 2;
    expect(hitTest(layout, chart, { x, y })).toEqual({ kind: 'key', staff: 0, system: 0 });
  });

  it('a click in a bar is still a place, not a key (the bar line takes its area)', () => {
    const chart = toChart(keyed(1), { id: 'draft' });
    const layout = layoutStaff(chart, { viewport, allPlayTracks: true });
    const at = pointOf(layout, chart, { bar: 0, start: 0, staff: 0, position: 4 })!;
    expect(hitTest(layout, chart, at)).toMatchObject({ kind: 'place' });
  });
});

describe('a click on a chord', () => {
  it('ft_1_02d.AC33 picks the nearest head of a close chord, so each note of a second or a third can be selected for its finger', () => {
    let piece: EditorPiece = emptyPiece({ title: 'T', hands: 'RH', beats: 4, bars: 1 });
    for (const step of ['C', 'D', 'E'] as const) {
      const edit = placeNote(piece, { hand: 'RH', bar: 0, start: 0, length: 'quarter', step, octave: 4 });
      if (!edit.ok) throw new Error(edit.reason);
      piece = edit.piece;
    }
    const chart = toChart(piece, { id: 'draft' });
    const layout = layoutStaff(chart, { viewport, allPlayTracks: true });
    // a click a little off the head's centre, toward its neighbour, still picks it: the nearest head wins
    const quarter = layout.staffSpace / 5;
    for (const head of layout.notes) {
      for (const dy of [-quarter, 0, quarter]) {
        expect(hitTest(layout, chart, { x: head.x, y: head.y + dy })).toEqual({ kind: 'note', noteIndex: head.index });
      }
    }
  });
});

describe('a click next to a note head', () => {
  const withG = () => {
    const edit = placeNote(emptyPiece({ title: 'T', hands: 'RH', beats: 4, bars: 1 }), { hand: 'RH', bar: 0, start: 0, length: 'quarter', step: 'G', octave: 4 });
    if (!edit.ok) throw new Error(edit.reason);
    const chart = toChart(edit.piece, { id: 'draft' });
    return { chart, layout: layoutStaff(chart, { viewport, allPlayTracks: true }) };
  };

  it('ft_1_02d.AC51 a click on the line or space a step from a note is that place, so a second can be written as a chord', () => {
    const { chart, layout } = withG();
    // G4 is on the second line of the treble (position 2): the space above is A4, the line below F4
    for (const [position, step] of [[3, 'A'], [1, 'F']] as const) {
      const at = pointOf(layout, chart, { bar: 0, start: 0, staff: 0, position })!;
      expect(hitTest(layout, chart, at)).toMatchObject({ kind: 'place', start: 0, position, step, octave: 4 });
    }
  });

  it('ft_1_02d.AC51 a click on the head itself, a little off its centre, is still the note', () => {
    const { chart, layout } = withG();
    const head = layout.notes[0]!;
    for (const dy of [-layout.staffSpace / 5, 0, layout.staffSpace / 5]) {
      expect(hitTest(layout, chart, { x: head.x + head.headRx / 2, y: head.y + dy })).toEqual({ kind: 'note', noteIndex: head.index });
    }
  });
});
