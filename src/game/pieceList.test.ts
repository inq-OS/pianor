// Covers ft_0_11.AC2, ft_1_02c.AC1, ft_1_12.AC10.
import { describe, expect, it } from 'vitest';
import { chartWith } from '../../tests/helpers/charts';
import type { Chart } from '../core/chart';
import { groupsOf, offeredPieces, piecesInShownGroups, piecesThatAreOn, type Piece, type PieceGroup } from './pieceList';

const chart = (id: string, title = id): Chart => ({ ...chartWith([{ tick: 0, dur: 1920, midi: 60 }]), id, title });

const piece = (id: string, over: Partial<Piece> = {}): Piece => ({
  chart: chart(id), status: 'approved', level: 1, unlockLevel: 1, source: 'original', ...over,
});

/** Three play tracks: the grand staff cannot draw it, so the menu must not offer it. */
const undrawable = (): Chart => ({
  ...chartWith(
    [{ tick: 0, dur: 1920, midi: 60 }, { tick: 0, dur: 1920, midi: 48, track: 'lh' }, { tick: 0, dur: 1920, midi: 64, track: 'x' }],
    { tracks: [{ id: 'rh', role: 'play', hand: 'RH', clef: 'treble' }, { id: 'lh', role: 'play', hand: 'LH', clef: 'bass' }, { id: 'x', role: 'play', hand: null, clef: 'treble' }] },
  ),
  id: 'too-many-hands',
});

describe('offeredPieces', () => {
  const approved = piece('approved-one');
  const draft = piece('draft-one', { status: 'draft' });

  it('shows a student only approved pieces: drafts are hidden unless drafts are switched on (the dev server)', () => {
    expect(offeredPieces([approved, draft], false).map((p) => p.chart.id)).toEqual(['approved-one']);
    expect(offeredPieces([approved, draft], true).map((p) => p.chart.id).sort()).toEqual(['approved-one', 'draft-one']);
  });

  it('shows nothing when there are only drafts, rather than a draft by mistake', () => {
    expect(offeredPieces([draft, piece('another', { status: 'draft' })], false)).toEqual([]);
  });

  it('never offers a piece the staff cannot draw, drafts on or off', () => {
    const hidden = piece('too-many-hands', { chart: undrawable() });
    expect(offeredPieces([approved, hidden], false).map((p) => p.chart.id)).toEqual(['approved-one']);
    expect(offeredPieces([approved, hidden], true).map((p) => p.chart.id)).toEqual(['approved-one']);
  });

  it('offers a piece id once, the first one listed winning', () => {
    const first = piece('same', { source: 'compiled' });
    const second = piece('same', { source: 'dev sample' });
    expect(offeredPieces([first, second], true)).toEqual([first]);
  });

  it('orders easiest first: by the level that unlocks it, then its curriculum level, then its title', () => {
    const list = [
      piece('c', { chart: chart('c', 'Carrot'), unlockLevel: 2, level: 2 }),
      piece('b', { chart: chart('b', 'Banana'), unlockLevel: 1, level: 3 }),
      piece('a2', { chart: chart('a2', 'Apple'), unlockLevel: 1, level: 1 }),
      piece('a1', { chart: chart('a1', 'Almond'), unlockLevel: 1, level: 1 }),
    ];
    expect(offeredPieces(list, false).map((p) => p.chart.title)).toEqual(['Almond', 'Apple', 'Banana', 'Carrot']);
  });

  it('does not change the list it is given', () => {
    const list = [draft, approved];
    offeredPieces(list, false);
    expect(list.map((p) => p.chart.id)).toEqual(['draft-one', 'approved-one']);
  });
});

describe('piecesThatAreOn', () => {
  const list = [piece('a'), piece('b'), piece('c', { own: true })];

  it('ft_1_02c.AC1: leaves out the pieces the player turned off, keeping the order of the rest', () => {
    expect(piecesThatAreOn(list, ['b']).map((p) => p.chart.id)).toEqual(['a', 'c']);
    expect(piecesThatAreOn(list, ['a', 'c']).map((p) => p.chart.id)).toEqual(['b']);
  });

  it('ft_1_02c.AC1: an own piece that is off is left out too, and turning every piece off leaves an empty list (the menu says so)', () => {
    expect(piecesThatAreOn(list, ['c']).map((p) => p.chart.id)).toEqual(['a', 'b']);
    expect(piecesThatAreOn(list, ['a', 'b', 'c'])).toEqual([]);
  });

  it('ft_1_02c.AC3: ignores ids that are not in the list, and with nothing turned off returns every piece', () => {
    expect(piecesThatAreOn(list, ['gone', 'also-gone'])).toEqual(list);
    expect(piecesThatAreOn(list, [])).toEqual(list);
  });

  it('does not change the list it is given', () => {
    const copy = [...list];
    piecesThatAreOn(list, ['a']);
    expect(list).toEqual(copy);
  });
});

describe('the piece book filter (ft_1_12.AC10)', () => {
  const mine = (id: string) => piece(id, { own: true });
  const curriculum = new Set(['taught', 'mine-taught']);
  const characters = new Map([['phrase', 'puuvaim']]);
  const pieces = [piece('plain'), mine('mine'), piece('taught'), piece('phrase'), mine('mine-taught')];
  const groups = (p: Piece) => groupsOf(p, curriculum, characters);

  it('ft_1_12.AC10 puts each piece in its groups: own, curriculum, character, or none', () => {
    expect(pieces.map((p) => groups(p))).toEqual([[], ['own'], ['curriculum'], ['character'], ['own', 'curriculum']]);
  });

  it('ft_1_12.AC10 hides the pieces of a hidden group; a piece in no group always shows', () => {
    const ids = (hidden: PieceGroup[]) => piecesInShownGroups(pieces, groups, new Set(hidden)).map((p) => p.chart.id);
    expect(ids([])).toEqual(['plain', 'mine', 'taught', 'phrase', 'mine-taught']);
    expect(ids(['own'])).toEqual(['plain', 'taught', 'phrase']);
    expect(ids(['curriculum', 'character'])).toEqual(['plain', 'mine']);
    expect(ids(['own', 'curriculum', 'character'])).toEqual(['plain']);
  });
});
