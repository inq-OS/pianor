import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { chartSchema, type Chart } from '../chart/schema.ts';
import { compilePiece } from '../piece/compile.ts';
import { pieceFactsOf, resolveSong, type PieceFacts } from './resolve.ts';
import { piecesInTwoSongs, songSchema, type Song, type SongNode } from './schema.ts';
import { songChart } from './songChart.ts';

import exampleSong from '../../../content/songs/morning-song/song.json';
import introMeta from '../../../content/pieces/morning-song-intro/piece.meta.json';
import outroMeta from '../../../content/pieces/morning-song-outro/piece.meta.json';
import introAbc from '../../../content/pieces/morning-song-intro/piece.abc?raw';
import outroAbc from '../../../content/pieces/morning-song-outro/piece.abc?raw';

/** A right-hand piece of `bars` bars, compiled. */
function piece(id: string, bars: number, opts: { bpm?: number; key?: string; meter?: string; phrases?: [number, number][] } = {}): Chart {
  const [num] = (opts.meter ?? '4/4').split('/').map(Number);
  const bar = `${'C '.repeat(num!).trim()} |`;
  const abc = `X:1\nT:${id}\nM:${opts.meter ?? '4/4'}\nL:1/4\nQ:1/4=${opts.bpm ?? 80}\nK:${opts.key ?? 'C'}\n${Array.from({ length: bars }, () => bar).join(' ')}]\n`;
  const meta = {
    id, title: id, level: 1, status: 'draft', hands: ['RH'], styles: [], source: 'original', license: 'CC0-1.0', generator: { kind: 'manual' },
    phrases: (opts.phrases ?? []).map(([a, b], i) => ({ name: `${id} part ${i + 1}`, bars: [a, b] })),
  };
  const compiled = compilePiece({ abc, meta: JSON.stringify(meta) });
  if (!compiled.chart) throw new Error(compiled.diagnostics.map((d) => d.message).join('\n'));
  return compiled.chart;
}

const BASE = { schemaVersion: 1, id: 'test-song', title: 'Test Song', status: 'draft', source: 'original', license: 'CC0-1.0', bpm: 80, key: { fifths: 0, mode: 'major' }, meter: { num: 4, den: 4 } };
const song = (nodes: unknown[], extra: Record<string, unknown> = {}): Song => songSchema.parse({ ...BASE, ...extra, nodes });
const problems = (nodes: unknown[]) => {
  const r = songSchema.safeParse({ ...BASE, nodes });
  return r.success ? [] : r.error.issues.map((i) => i.message);
};
const lookup = (charts: Chart[]) => (id: string) => charts.find((c) => c.id === id);
const factsOf = (charts: Chart[]) => (id: string): PieceFacts | undefined => {
  const c = lookup(charts)(id);
  return c ? pieceFactsOf(c) : undefined;
};

describe('song schema', () => {
  it('ft_1_36.AC1 takes groups, pieces, links and blanks with unique ids', () => {
    const s = song([
      { kind: 'piece', id: 'a', piece: 'p1', labels: ['intro'] },
      { kind: 'group', id: 'g', name: 'Verse', bpm: 70, nodes: [{ kind: 'blank', id: 'b', name: 'Verse 1', bars: 8 }, { kind: 'link', id: 'l', to: 'a' }] },
    ]);
    expect(s.nodes.map((n) => n.kind)).toEqual(['piece', 'group']);
    expect(s.contentVersion).toBe(1);
  });

  it('ft_1_36.AC1 refuses a link to a later node or to a group, a piece twice and more than four levels of groups, naming the node', () => {
    expect(problems([{ kind: 'link', id: 'l', to: 'a' }, { kind: 'piece', id: 'a', piece: 'p1' }])).toEqual([expect.stringMatching(/node "l": a link must point at a piece node before it/)]);
    expect(problems([{ kind: 'group', id: 'g', name: 'G', nodes: [] }, { kind: 'link', id: 'l', to: 'g' }])).toEqual(['node "l": a link must point at a piece, and "g" is a group']);
    expect(problems([{ kind: 'piece', id: 'a', piece: 'p1' }, { kind: 'piece', id: 'b', piece: 'p1' }])).toEqual(['node "b": piece "p1" is already node "a"; repeat it with a link']);
    expect(problems([{ kind: 'piece', id: 'a', piece: 'p1' }, { kind: 'blank', id: 'a', name: 'A', bars: 2 }])).toEqual(['node "a": the id is used twice']);
    const nest = (depth: number): unknown => ({ kind: 'group', id: `g${depth}`, name: `G${depth}`, nodes: depth > 1 ? [nest(depth - 1)] : [{ kind: 'blank', id: 'b', name: 'B', bars: 1 }] });
    expect(problems([nest(4)])).toEqual([]);
    expect(problems([nest(5)])).toEqual(['node "g1": more than 4 levels of groups']);
  });

  it('ft_1_36.AC1 finds a piece in two songs, naming each song and node', () => {
    const one = song([{ kind: 'piece', id: 'a', piece: 'p1' }], { id: 'one' });
    const two = song([{ kind: 'piece', id: 'x', piece: 'p1' }, { kind: 'piece', id: 'y', piece: 'p2' }], { id: 'two' });
    expect(piecesInTwoSongs([one, two])).toEqual([{ piece: 'p1', places: [{ song: 'one', node: 'a' }, { song: 'two', node: 'x' }] }]);
  });
});

describe('resolved song', () => {
  it('ft_1_36.AC2 gives every node its own value or its parent\'s and says which', () => {
    const charts = [piece('p1', 2), piece('p2', 2, { bpm: 60, key: 'G', meter: '3/4' })];
    const s = song([
      { kind: 'group', id: 'g', name: 'G', bpm: 70, key: { fifths: 1, mode: 'major' }, nodes: [
        { kind: 'blank', id: 'b', name: 'B', bars: 4 },
        { kind: 'piece', id: 'q', piece: 'p2', bpm: 60 },
      ] },
      { kind: 'piece', id: 'a', piece: 'p1' },
      { kind: 'link', id: 'l', to: 'q' },
    ]);
    const rows = new Map(resolveSong(s, factsOf(charts)).rows.map((r) => [r.id, r]));
    expect(rows.get('g')!.bpm).toEqual({ value: 70, own: true, parent: 80 });
    expect(rows.get('b')!.bpm).toEqual({ value: 70, own: false, parent: 70 });
    expect(rows.get('b')!.key).toEqual({ value: { fifths: 1, mode: 'major' }, own: false, parent: { fifths: 1, mode: 'major' } });
    expect(rows.get('q')!.bpm).toEqual({ value: 60, own: true, parent: 70 });
    // A piece written in another meter shows its own as set (rule 4).
    expect(rows.get('q')!.meter).toEqual({ value: { num: 3, den: 4 }, own: true, parent: { num: 4, den: 4 } });
    expect(rows.get('a')!.bpm).toEqual({ value: 80, own: false, parent: 80 });
    // A link plays its piece, so it shows the piece's values against those around it.
    expect(rows.get('l')!.bpm).toEqual({ value: 60, own: true, parent: 80 });
  });

  it('ft_1_36.AC2 over random trees, a value is own exactly where a node sets it, else its parent\'s', () => {
    const bpm = fc.option(fc.integer({ min: 40, max: 200 }), { nil: undefined });
    let next = 0;
    const tree: fc.Arbitrary<unknown[]> = fc.letrec((tie) => ({
      node: fc.oneof(
        { depthSize: 'small', withCrossShrink: true },
        fc.record({ bars: fc.integer({ min: 1, max: 9 }), bpm }).map((r) => ({ kind: 'blank', name: 'B', ...r })),
        fc.record({ bpm, nodes: fc.array(tie('node'), { maxLength: 3 }) }).map((r) => ({ kind: 'group', name: 'G', ...r })),
      ),
      nodes: fc.array(tie('node'), { minLength: 1, maxLength: 4 }),
    })).nodes as fc.Arbitrary<unknown[]>;
    const withIds = (nodes: unknown[], depth = 0): unknown[] => nodes.map((n) => {
      const node: Record<string, unknown> = { ...(n as Record<string, unknown>), id: `n${next++}` };
      if (node.bpm === undefined) delete node.bpm;
      if (node.kind === 'group') node.nodes = depth >= 3 ? [] : withIds(node.nodes as unknown[], depth + 1);
      return node;
    });
    fc.assert(fc.property(tree, fc.integer({ min: 40, max: 200 }), (raw, songBpm) => {
      next = 0;
      const s = song(withIds(raw), { bpm: songBpm });
      const rows = resolveSong(s, () => undefined).rows;
      const byId = new Map(rows.map((r) => [r.id, r]));
      const nodes = new Map<string, SongNode>();
      const collect = (list: SongNode[]) => list.forEach((n) => { nodes.set(n.id, n); if (n.kind === 'group') collect(n.nodes); });
      collect(s.nodes);
      for (const row of rows) {
        const node = nodes.get(row.id)!;
        const parentValue = row.parent ? byId.get(row.parent)!.bpm.value : songBpm;
        const set = node.kind === 'link' ? undefined : node.bpm;
        expect(row.bpm.parent).toBe(parentValue);
        expect(row.bpm.own).toBe(set !== undefined);
        expect(row.bpm.value).toBe(set ?? parentValue);
      }
    }));
  });

  it('ft_1_36.AC3 counts blanks at their planned bars and parts that are off; the example song puts the outro at bars 71 to 82', () => {
    const example = songSchema.parse(exampleSong);
    const compile = (abc: string, meta: unknown) => compilePiece({ abc, meta: JSON.stringify(meta) }).chart!;
    const charts = [compile(introAbc, introMeta), compile(outroAbc, outroMeta)];
    for (const off of [new Set<string>(), new Set(['intro', 'middle'])]) {
      const resolved = resolveSong(example, factsOf(charts), off);
      const at = (id: string) => resolved.rows.find((r) => r.id === id)!;
      expect([at('intro').startBar, at('intro').endBar]).toEqual([1, 12]);
      expect([at('middle').startBar, at('middle').endBar]).toEqual([13, 70]);
      expect([at('outro').startBar, at('outro').endBar]).toEqual([71, 82]);
      expect(resolved.bars).toBe(82);
      expect(resolved.barsWritten).toBe(24);
    }
    const resolved = resolveSong(example, factsOf(charts), new Set(['middle']));
    expect(resolved.rows.find((r) => r.id === 'verse-1')).toMatchObject({ on: false, switchOn: true, written: false });
    expect(resolved.rows.find((r) => r.id === 'middle')).toMatchObject({ on: false, written: false, number: '2' });
    expect(resolved.rows.find((r) => r.id === 'chorus')!.number).toBe('2.2');
    // The intro unfolds into its phrases as one more level.
    expect(resolved.rows.filter((r) => r.parent === 'intro').map((r) => [r.number, r.name, r.startBar, r.endBar])).toEqual([['1.1', 'First half', 1, 6], ['1.2', 'Second half', 7, 12]]);
  });

  it('nests a piece\'s phrases as they nest, and marks a piece that is not found', () => {
    const charts = [piece('p1', 4, { phrases: [[1, 4], [1, 2], [3, 4]] })];
    const rows = resolveSong(song([{ kind: 'piece', id: 'a', piece: 'p1' }, { kind: 'piece', id: 'z', piece: 'gone' }, { kind: 'link', id: 'l', to: 'z' }]), factsOf(charts)).rows;
    expect(rows.map((r) => [r.number, r.kind, r.depth])).toEqual([
      ['1', 'piece', 0], ['1.1', 'phrase', 1], ['1.1.1', 'phrase', 2], ['1.1.2', 'phrase', 2], ['2', 'piece', 0], ['3', 'link', 0],
    ]);
    expect(rows[4]).toMatchObject({ missing: true, written: false, bars: 0, name: 'gone' });
    expect(rows[5]).toMatchObject({ missing: true, written: false, bars: 0 });
  });
});

describe('songChart', () => {
  const charts = [piece('p1', 2, { phrases: [[1, 1]] }), piece('p2', 3, { bpm: 60, key: 'G', meter: '3/4' }), piece('p3', 1)];
  const s = song([
    { kind: 'piece', id: 'a', piece: 'p1', name: 'Intro' },
    { kind: 'blank', id: 'b', name: 'Verse 1', bars: 4 },
    { kind: 'group', id: 'g', name: 'Middle', nodes: [{ kind: 'piece', id: 'q', piece: 'p2', bpm: 60, key: { fifths: 1, mode: 'major' } }, { kind: 'piece', id: 'r', piece: 'p3' }] },
    { kind: 'link', id: 'l', to: 'a', name: 'Intro again' },
  ]);

  it('ft_1_36.AC4 joins the written parts that are on in order, a link repeating its piece, with the maps changing at a part\'s first bar', () => {
    const joined = songChart(s, lookup(charts))!;
    expect(chartSchema.safeParse(joined.chart).success).toBe(true);
    const order = [charts[0]!, charts[1]!, charts[2]!, charts[0]!];
    let offset = 0;
    const expected = order.flatMap((c) => {
      const shifted = c.notes.map((n) => ({ midi: n.midi, tick: n.tick + offset }));
      offset += c.bars[c.bars.length - 1]!.endTick;
      return shifted;
    });
    expect(joined.chart.notes.map((n) => ({ midi: n.midi, tick: n.tick }))).toEqual(expected);
    const p2Start = charts[0]!.bars[1]!.endTick;
    const p3Start = p2Start + charts[1]!.bars[2]!.endTick;
    expect(joined.chart.tempoMap).toEqual([{ tick: 0, bpm: 80 }, { tick: p2Start, bpm: 60 }, { tick: p3Start, bpm: 80 }]);
    expect(joined.chart.keyMap.map((k) => [k.tick, k.fifths])).toEqual([[0, 0], [p2Start, 1], [p3Start, 0]]);
    expect(joined.chart.meterMap.map((m) => [m.tick, m.num])).toEqual([[0, 4], [p2Start, 3], [p3Start, 4]]);
    expect(joined.chart.id).toBe('song:test-song');
  });

  it('ft_1_36.AC4 makes every part a phrase, nested as in the tree, and folds the blank with its song bars', () => {
    const joined = songChart(s, lookup(charts))!;
    expect(joined.chart.phrases.map((p) => [p.name, p.startBar, p.endBar])).toEqual([
      ['Intro', 0, 1], ['p1 part 1', 0, 0], ['Middle', 2, 5], ['p2', 2, 4], ['p3', 5, 5], ['Intro again', 6, 7], ['p1 part 1', 6, 6],
    ]);
    expect(joined.parts.map((p) => p.node)).toEqual(['a', 'g', 'q', 'r', 'l']);
    expect(joined.folds).toEqual([{ node: 'b', name: 'Verse 1', startBar: 3, endBar: 6, reason: 'blank', beforeBar: 2 }]);
    expect(joined.songBars).toEqual([1, 2, 7, 8, 9, 10, 11, 12]);
  });

  it('ft_1_36.AC4 leaves out parts that are off as one fold per part, and plays one group alone', () => {
    const joined = songChart(s, lookup(charts), new Set(['g', 'a']))!;
    expect(joined.folds.map((f) => [f.node, f.reason, f.startBar, f.endBar, f.beforeBar])).toEqual([['a', 'off', 1, 2, 0], ['b', 'blank', 3, 6, 0], ['g', 'off', 7, 10, 0]]);
    expect(joined.chart.bars).toHaveLength(2);
    const group = songChart(s, lookup(charts), new Set(), 'g')!;
    expect(group.chart).toMatchObject({ id: 'song:test-song/g', title: 'Middle' });
    expect(group.songBars).toEqual([7, 8, 9, 10]);
    expect(songChart(s, lookup(charts), new Set(), 'a')).toBeNull();
    expect(songChart(s, lookup(charts), new Set(['a', 'g', 'l']))).toBeNull();
  });

  it('folds a group with nothing written as one blank, and a missing piece as missing', () => {
    const t = song([{ kind: 'group', id: 'g', name: 'Empty', nodes: [{ kind: 'blank', id: 'b', name: 'B', bars: 3 }] }, { kind: 'piece', id: 'z', piece: 'gone' }, { kind: 'piece', id: 'a', piece: 'p3' }]);
    const joined = songChart(t, lookup(charts))!;
    expect(joined.folds.map((f) => [f.node, f.reason, f.startBar, f.endBar])).toEqual([['g', 'blank', 1, 3], ['z', 'missing', 4, 3]]);
    expect(joined.songBars).toEqual([4]);
  });
});
