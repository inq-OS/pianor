import { describe, expect, it } from 'vitest';
import { keyName, meterName, pieceOutline, rowPlay, shownRows, startFolded } from './outline.ts';
import { resolveSong, type PieceFacts } from './resolve.ts';
import { songSchema } from './schema.ts';
import { keepOnePartOn, keepsLastPartOn, labelOn, setLabelOn, setPartOn } from './switches.ts';

const facts = (title: string, bars: number, phrases: [number, number][] = []): PieceFacts => ({
  title, bars, bpm: 80, key: { fifths: 0, mode: 'major' }, meter: { num: 4, den: 4 },
  phrases: phrases.map(([startBar, endBar], i) => ({ name: `${title} ${i + 1}`, startBar, endBar })),
});
const pieces: Record<string, PieceFacts> = { p1: facts('One', 4, [[0, 1], [2, 3]]), p2: facts('Two', 2) };
const song = songSchema.parse({
  schemaVersion: 1, id: 's', title: 'S', status: 'draft', source: 'original', license: 'CC0-1.0', bpm: 80, key: { fifths: 0, mode: 'major' }, meter: { num: 4, den: 4 },
  nodes: [
    { kind: 'piece', id: 'a', piece: 'p1', labels: ['verse'] },
    { kind: 'group', id: 'g', name: 'G', nodes: [{ kind: 'blank', id: 'b', name: 'B', bars: 3, labels: ['chorus'] }, { kind: 'piece', id: 'c', piece: 'p2', labels: ['chorus'] }] },
    { kind: 'link', id: 'l', to: 'a', labels: ['verse'] },
  ],
});
const rows = (off: string[] = []) => resolveSong(song, (id) => pieces[id], new Set(off)).rows;

describe('the song page outline', () => {
  it('ft_1_36.AC7 starts with the pieces folded, a folded row saying how many rows it hides, and unfolds on asking', () => {
    const all = rows();
    const folded = startFolded(all);
    expect([...folded]).toEqual(['a']);
    expect(shownRows(all, folded).map((s) => [s.row.number, s.folds, s.hidden])).toEqual([['1', true, 2], ['2', true, 0], ['2.1', false, 0], ['2.2', false, 0], ['3', false, 0]]);
    expect(shownRows(all, new Set(['g'])).map((s) => s.row.number)).toEqual(['1', '1.1', '1.2', '2', '3']);
    expect(shownRows(all, new Set()).length).toBe(all.length);
  });

  it('ft_1_36.AC8 plays a group as a group, a piece or link alone, a phrase as bars of its piece, and nothing for a blank or a part that is off', () => {
    const all = rows(['c']);
    const at = (id: string) => rowPlay(all.find((r) => r.id === id)!, all);
    expect(at('a')).toEqual({ kind: 'piece', piece: 'p1' });
    expect(at('l')).toEqual({ kind: 'piece', piece: 'p1' });
    expect(at('a#1')).toEqual({ kind: 'phrase', piece: 'p1', first: 2, last: 3 });
    expect(at('b')).toBeNull();
    expect(at('c')).toBeNull();
    // a group with nothing written that is on has no play button
    expect(at('g')).toBeNull();
    expect(rowPlay(rows().find((r) => r.id === 'g')!, rows())).toEqual({ kind: 'group', node: 'g' });
  });

  it('ft_1_36.AC13 shows a lone piece\'s phrases as the outline, numbered from 1', () => {
    const outline = pieceOutline('p1', pieces.p1!);
    expect(outline.rows.map((r) => [r.number, r.name, r.depth, r.parent, r.startBar, r.endBar])).toEqual([['1', 'One 1', 0, null, 1, 2], ['2', 'One 2', 0, null, 3, 4]]);
    expect(rowPlay(outline.rows[1]!, outline.rows)).toEqual({ kind: 'phrase', piece: 'p1', first: 2, last: 3 });
  });

  it('ft_1_36.AC7 gives a piece whose one phrase is the whole piece no rows under it, so it does not fold', () => {
    const whole: Record<string, PieceFacts> = { w: facts('Whole', 4, [[0, 3]]), h: facts('Half', 4, [[0, 1]]) };
    const two = songSchema.parse({ ...song, nodes: [{ kind: 'piece', id: 'a', piece: 'w' }, { kind: 'piece', id: 'b', piece: 'h' }] });
    const all = resolveSong(two, (id) => whole[id]).rows;
    expect(all.map((r) => r.number)).toEqual(['1', '2', '2.1']);
    expect(shownRows(all, startFolded(all)).map((s) => [s.row.number, s.folds])).toEqual([['1', false], ['2', true]]);
    expect(pieceOutline('w', whole.w!).rows).toEqual([]);
  });

  it('names keys and meters as a row shows them', () => {
    expect([keyName({ fifths: 0, mode: 'major' }), keyName({ fifths: 2, mode: 'major' }), keyName({ fifths: -1, mode: 'minor' }), keyName({ fifths: 3, mode: 'minor' })]).toEqual(['C', 'D', 'Dm', 'F#m']);
    expect(meterName({ num: 3, den: 4 })).toBe('3/4');
  });
});

describe('the switches of a song', () => {
  it('ft_1_36.AC11 turns a part or group off and on, and never the last written part on', () => {
    const all = rows();
    expect(setPartOn(all, [], 'g', false)).toEqual({ off: ['g'], changed: true });
    expect(setPartOn(all, ['g'], 'g', true)).toEqual({ off: [], changed: true });
    expect(setPartOn(all, ['a', 'l'], 'c', false)).toEqual({ off: ['a', 'l'], changed: false });
    expect(setPartOn(all, ['a', 'l'], 'g', false)).toEqual({ off: ['a', 'l'], changed: false });
    expect(keepsLastPartOn(all, ['a', 'l'], 'c')).toBe(true);
    expect(keepsLastPartOn(all, ['a', 'l'], 'b')).toBe(false);
    // a blank may be turned off, a phrase has no switch
    expect(setPartOn(all, [], 'b', false).changed).toBe(true);
    expect(setPartOn(all, [], 'a#0', false).changed).toBe(false);
  });

  it('ft_1_36.AC11 after a row leaves the song, a written part is still on: the first one is turned back on when none is', () => {
    const all = rows();
    // the parts that are on were removed: only c is written, and its group is off
    const left = all.filter((r) => r.id !== 'a' && r.id !== 'l');
    expect(keepOnePartOn(left, ['g', 'c'])).toEqual([]);
    expect(keepOnePartOn(all, ['a', 'l'])).toEqual(['a', 'l']);
    // nothing written: nothing to turn on
    expect(keepOnePartOn(all.filter((r) => r.kind === 'blank' || r.kind === 'group'), ['b'])).toEqual(['b']);
  });

  it('ft_1_36.AC20 turns every part with a label on or off at once, keeping the last written part on', () => {
    const all = rows();
    expect(setLabelOn(all, [], 'chorus', false)).toEqual({ off: ['b', 'c'], changed: true });
    expect(labelOn(all, ['b', 'c'], 'chorus')).toBe(false);
    expect(setLabelOn(all, ['b', 'c'], 'chorus', true)).toEqual({ off: [], changed: true });
    // with the chorus off, turning off every verse leaves the link, the last written part, on
    expect(setLabelOn(all, ['b', 'c'], 'verse', false)).toEqual({ off: ['b', 'c', 'a'], changed: true });
  });
});
